import { Environment, TossAuth, User } from '@apps-in-toss/web-framework'
import type { AuthUser } from '../types/auth'
import { syncFirebaseAuthForAppUser } from './firebase'

const AUTH_STORAGE_KEY = 'woori-auth-user-v5'

declare global {
  interface Window {
    /** 빌드 없이 테스트할 때 런타임으로 인증 서버 URL을 덮어쓸 수 있어요 */
    __TOSS_AUTH_API_URL__?: string
  }
}

function authApiBase() {
  const runtime =
    typeof window !== 'undefined' ? window.__TOSS_AUTH_API_URL__ : undefined
  return (runtime || import.meta.env.VITE_TOSS_AUTH_API_URL || '')
    .trim()
    .replace(/\/$/, '')
}

function consentedDataKey() {
  return (import.meta.env.VITE_TOSS_CONSENTED_DATA_KEY || '').trim()
}

/** 파트너 서버가 공개 HTTPS로 준비됐을 때만 토스 로그인(토큰 교환)을 사용해요 */
export function isTossLoginConfigured() {
  return Boolean(authApiBase())
}

export function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function saveStoredUser(user: AuthUser) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
}

export function clearStoredUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function createNicknameFromId(id: string) {
  const normalized = id.replace(/[^a-zA-Z0-9]/g, '')
  const suffix = (normalized.slice(-4) || '0000').toUpperCase()
  return `토스유저${suffix}`
}

/** 암호문·임시 닉네임이 아닌지 */
export function isDisplayableUserName(name: string | null | undefined) {
  if (!name) return false
  const value = name.trim()
  if (!value) return false
  if (/^토스유저/i.test(value)) return false
  if (value.length > 40 && /^[A-Za-z0-9+/=_-]+$/.test(value)) return false
  return true
}

export function isInTossApp() {
  try {
    return (
      Environment.environment === 'toss' || Environment.environment === 'sandbox'
    )
  } catch {
    return false
  }
}

/**
 * 콘솔에 등록한 동의 키로 실명(USER_NAME)을 가져와요.
 * @see https://developers-apps-in-toss.toss.im/documentation/common/user-info
 */
export async function fetchConsentedUserName(): Promise<string | null> {
  const key = consentedDataKey()
  if (!key) return null

  try {
    if (!User.getConsentedData.isSupported()) return null
    const data = await User.getConsentedData({
      consentedUserDataKey: key,
      shouldRequestAgreementWhenUserDeclined: false,
    })
    const name = data?.USER_NAME?.trim()
    return isDisplayableUserName(name) ? name! : null
  } catch (error) {
    console.warn('[Auth] getConsentedData(USER_NAME) 실패', error)
    return null
  }
}

async function resolveDisplayName(fallbackId: string, preferred?: string | null) {
  if (isDisplayableUserName(preferred)) return preferred!.trim()

  const consented = await fetchConsentedUserName()
  if (consented) return consented

  return createNicknameFromId(fallbackId)
}

async function exchangeAuthorizationCode(
  authorizationCode: string,
  referrer: 'DEFAULT' | 'SANDBOX',
): Promise<{ user: AuthUser; firebaseCustomToken: string }> {
  const base = authApiBase()
  if (!base) {
    throw new Error(
      '토스 로그인용 인증 서버 주소(VITE_TOSS_AUTH_API_URL)가 없어요.',
    )
  }

  const endpoint = `${base}/api/auth/toss-login`
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorizationCode, referrer }),
    })
  } catch (error) {
    console.error('[Auth] 토큰 교환 네트워크 실패', { endpoint, error })
    throw new Error('인증 서버에 연결하지 못했어요.')
  }

  const text = await response.text()
  let payload: {
    user?: AuthUser
    error?: string
    firebaseCustomToken?: string
  } = {}
  try {
    payload = text ? (JSON.parse(text) as typeof payload) : {}
  } catch {
    throw new Error('인증 서버 응답이 올바르지 않아요.')
  }

  if (!response.ok || !payload.user?.id) {
    throw new Error(payload.error || '토스 로그인에 실패했어요.')
  }

  if (!payload.firebaseCustomToken) {
    throw new Error(
      'Firebase 로그인 토큰이 없어요. 인증 서버의 Firebase 서비스 계정을 확인해 주세요.',
    )
  }

  const id = String(payload.user.id)
  const name = await resolveDisplayName(id, payload.user.name)
  return {
    user: { id, name, authMethod: 'toss-login' },
    firebaseCustomToken: payload.firebaseCustomToken,
  }
}

let tossLoginInFlight: Promise<AuthUser> | null = null

/**
 * 토스 로그인 (OAuth)
 * 클라이언트: TossAuth.login() → authorizationCode
 * 서버: generate-token → login-me → name 복호화
 * @see https://developers-apps-in-toss.toss.im/documentation/common/authentication/toss-login
 */
export async function loginWithToss(): Promise<AuthUser> {
  if (tossLoginInFlight) return tossLoginInFlight

  tossLoginInFlight = (async (): Promise<AuthUser> => {
    const loginResult = await TossAuth.login()
    const authorizationCode = loginResult?.authorizationCode?.trim()
    const referrer =
      loginResult?.referrer === 'SANDBOX' ? 'SANDBOX' : 'DEFAULT'

    if (!authorizationCode) {
      throw new Error('인가 코드를 받지 못했어요. 다시 로그인해 주세요.')
    }

    const exchanged = await exchangeAuthorizationCode(authorizationCode, referrer)
    await syncFirebaseAuthForAppUser(
      exchanged.user,
      exchanged.firebaseCustomToken,
    )
    saveStoredUser(exchanged.user)
    return exchanged.user
  })()

  const pending = tossLoginInFlight
  void pending.finally(() => {
    if (tossLoginInFlight === pending) tossLoginInFlight = null
  })
  return pending
}

/**
 * 비게임 사용자 식별키 + (가능하면) 동의 기반 실명
 * @see https://developers-apps-in-toss.toss.im/documentation/common/authentication/hash-key
 * @see https://developers-apps-in-toss.toss.im/documentation/common/user-info
 */
export async function resolveAnonymousUser(): Promise<AuthUser> {
  try {
    if (!User.getAnonymousKey.isSupported()) {
      console.warn('[Auth] getAnonymousKey 미지원 환경')
    } else {
      const keyResult: unknown = await User.getAnonymousKey()

      if (keyResult === undefined) {
        throw new Error('지원하지 않는 SDK/앱 버전이에요.')
      }
      if (keyResult === 'INVALID_CATEGORY') {
        throw new Error('비게임 카테고리 미니앱에서만 식별키를 쓸 수 있어요.')
      }
      if (keyResult === 'ERROR') {
        throw new Error('사용자 식별키를 가져오지 못했어요.')
      }
      if (
        keyResult &&
        typeof keyResult === 'object' &&
        'type' in keyResult &&
        'hash' in keyResult &&
        (keyResult as { type: string; hash: string }).type === 'HASH' &&
        (keyResult as { hash: string }).hash
      ) {
        const hash = (keyResult as { hash: string }).hash
        const name = await resolveDisplayName(hash)
        const user: AuthUser = {
          id: hash,
          name,
          authMethod: 'anonymous-key',
        }
        await syncFirebaseAuthForAppUser(user)
        saveStoredUser(user)
        return user
      }
    }
  } catch (error) {
    console.warn('[Auth] getAnonymousKey 실패', error)
    if (isInTossApp()) throw error
  }

  throw new Error(
    '유효한 토스 사용자 세션이 없어요. 토스 앱에서 다시 열어 주세요.',
  )
}

/**
 * 저장된 닉네임이 이상하면(토스유저·암호문) 실명으로 다시 채워요.
 */
export async function refreshUserDisplayName(
  user: AuthUser,
): Promise<AuthUser> {
  if (isDisplayableUserName(user.name) && !/^토스유저/i.test(user.name)) {
    return user
  }

  const name = await resolveDisplayName(user.id, null)
  if (name === user.name) return user

  const next: AuthUser = { ...user, name }
  saveStoredUser(next)
  return next
}

export async function startAppSession(): Promise<AuthUser> {
  if (isTossLoginConfigured()) {
    return loginWithToss()
  }
  return resolveAnonymousUser()
}

/** @deprecated startAppSession 사용 */
export async function loginForTestPhase(): Promise<AuthUser> {
  return startAppSession()
}

export async function restoreSession(): Promise<AuthUser | null> {
  const stored = loadStoredUser()
  if (!stored) return null
  if (stored.id.startsWith('temp-')) {
    clearStoredUser()
    return null
  }
  const refreshed = await refreshUserDisplayName(stored)
  await syncFirebaseAuthForAppUser(refreshed)
  return refreshed
}
