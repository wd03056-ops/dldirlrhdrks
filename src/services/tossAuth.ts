import { Environment, User } from '@apps-in-toss/web-framework'
import type { AuthUser } from '../types/auth'

const AUTH_STORAGE_KEY = 'woori-auth-user-v2'

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

/**
 * 비게임 식별키(getAnonymousKey)로 사용자 식별
 * @see https://developers-apps-in-toss.toss.im/documentation/common/authentication/hash-key
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

  // 브라우저/미지원 환경 폴백 (로컬 테스트용)
  const tempId = createTempUserId()
  const user: AuthUser = {
    id: `temp-${tempId}`,
    name: createNicknameFromId(tempId),
  }
  saveStoredUser(user)
  return user
}

/** @deprecated resolveAnonymousUser 사용 */
export async function loginForTestPhase(): Promise<AuthUser> {
  return resolveAnonymousUser()
}

export async function restoreSession(): Promise<AuthUser | null> {
  return loadStoredUser()
}
