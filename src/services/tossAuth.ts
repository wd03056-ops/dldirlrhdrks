import { Environment, TossAuth, User } from '@apps-in-toss/web-framework'
import type { AuthUser } from '../types/auth'

const AUTH_STORAGE_KEY = 'woori-auth-user-v3'

function authApiBase() {
  return (import.meta.env.VITE_TOSS_AUTH_API_URL || '').replace(/\/$/, '')
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

export function isInTossApp() {
  try {
    return (
      Environment.environment === 'toss' || Environment.environment === 'sandbox'
    )
  } catch {
    return false
  }
}

function createTempUserId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : String(Date.now())
}

async function exchangeAuthorizationCode(
  authorizationCode: string,
  referrer: 'DEFAULT' | 'SANDBOX',
): Promise<AuthUser> {
  const response = await fetch(`${authApiBase()}/api/auth/toss-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorizationCode, referrer }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    user?: AuthUser
    error?: string
  }
  if (!response.ok || !payload.user?.id) {
    throw new Error(payload.error || '토스 로그인에 실패했어요.')
  }
  return payload.user
}

/**
 * 토스 로그인: 미니앱에서 인가 코드만 받은 뒤, 토큰 교환·복호화는 서버에서 처리해요.
 * @see https://developers-apps-in-toss.toss.im/documentation/common/authentication/toss-login
 */
export async function loginWithToss(): Promise<AuthUser> {
  const { authorizationCode, referrer } = await TossAuth.login()
  const user = await exchangeAuthorizationCode(authorizationCode, referrer)
  saveStoredUser(user)
  return user
}

/**
 * 브라우저 로컬 테스트용. 토스 앱에서는 사용하지 않아요.
 */
export async function resolveAnonymousUser(): Promise<AuthUser> {
  try {
    if (User.getAnonymousKey.isSupported()) {
      const keyResult = await User.getAnonymousKey()
      if (keyResult?.type === 'HASH' && keyResult.hash) {
        const user: AuthUser = {
          id: keyResult.hash,
          name: createNicknameFromId(keyResult.hash),
        }
        saveStoredUser(user)
        return user
      }
    }
  } catch (error) {
    console.warn('[Auth] getAnonymousKey 실패', error)
  }

  const tempId = createTempUserId()
  const user: AuthUser = {
    id: `temp-${tempId}`,
    name: createNicknameFromId(tempId),
  }
  saveStoredUser(user)
  return user
}

/** @deprecated loginWithToss / resolveAnonymousUser 사용 */
export async function loginForTestPhase(): Promise<AuthUser> {
  return isInTossApp() ? loginWithToss() : resolveAnonymousUser()
}

export async function restoreSession(): Promise<AuthUser | null> {
  return loadStoredUser()
}
