import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  type User,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import type { AuthUser } from '../types/auth'

/**
 * Firebase 설정 — Vite 환경 변수 (.env)
 *
 * VITE_FIREBASE_API_KEY
 * VITE_FIREBASE_AUTH_DOMAIN
 * VITE_FIREBASE_PROJECT_ID
 * VITE_FIREBASE_STORAGE_BUCKET
 * VITE_FIREBASE_MESSAGING_SENDER_ID
 * VITE_FIREBASE_APP_ID
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function assertFirebaseConfig() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(
      `Firebase 환경 변수가 비어 있습니다: ${missing.join(', ')}. .env의 VITE_FIREBASE_* 값을 확인해 주세요.`,
    )
  }
}

assertFirebaseConfig()

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)
export const auth = getAuth(firebaseApp)

let authInitPromise: Promise<User | null> | null = null
let syncInFlight: Promise<User> | null = null

function authApiBase() {
  const runtime =
    import.meta.env.DEV && typeof window !== 'undefined'
      ? (window as Window & { __TOSS_AUTH_API_URL__?: string }).__TOSS_AUTH_API_URL__
      : undefined
  return (runtime || import.meta.env.VITE_TOSS_AUTH_API_URL || '')
    .trim()
    .replace(/\/$/, '')
}

function getFirebaseErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

export function formatFirebaseAuthError(error: unknown): string {
  const code = getFirebaseErrorCode(error)
  if (
    code === 'auth/admin-restricted-operation' ||
    code === 'auth/operation-not-allowed'
  ) {
    return 'Firebase 익명 로그인은 사용하지 않아요. 토스 로그인 후 Custom Token으로 인증해 주세요.'
  }
  if (code === 'auth/invalid-custom-token') {
    return 'Firebase 로그인 토큰이 올바르지 않아요. 인증 서버·서비스 계정을 확인해 주세요.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Firebase 인증에 실패했어요.'
}

/** Auth 초기 복원(세션)이 끝날 때까지 대기 */
export function waitForAuthInit(): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  if (authInitPromise) return authInitPromise

  authInitPromise = new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })

  return authInitPromise
}

/** 익명 Firebase 세션은 허용하지 않아요 */
export function isValidFirebaseSession(
  user: User | null | undefined,
): boolean {
  return Boolean(user && !user.isAnonymous)
}

export function getFirebaseCurrentUser() {
  const user = auth.currentUser
  return isValidFirebaseSession(user) ? user : null
}

/**
 * 서버에서 발급한 Custom Token으로 Firebase 로그인
 */
export async function signInFirebaseWithCustomToken(
  customToken: string,
): Promise<User> {
  const credential = await signInWithCustomToken(auth, customToken)
  if (!isValidFirebaseSession(credential.user)) {
    await signOut(auth)
    throw new Error('Firebase 로그인 세션이 유효하지 않아요.')
  }
  return credential.user
}

async function fetchFirebaseCustomToken(appUser: AuthUser): Promise<string> {
  const base = authApiBase()
  if (!base) {
    throw new Error(
      '인증 서버 주소(VITE_TOSS_AUTH_API_URL)가 없어 Firebase에 로그인할 수 없어요.',
    )
  }

  const endpoint = `${base}/api/auth/firebase-token`
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: appUser.id,
        name: appUser.name,
        authMethod: appUser.authMethod ?? 'anonymous-key',
      }),
    })
  } catch (error) {
    console.error('[Firebase] custom token 요청 실패', { endpoint, error })
    throw new Error('Firebase 로그인 토큰을 받지 못했어요.')
  }

  const text = await response.text()
  let payload: { firebaseCustomToken?: string; error?: string } = {}
  try {
    payload = text ? (JSON.parse(text) as typeof payload) : {}
  } catch {
    throw new Error('Firebase 토큰 응답이 올바르지 않아요.')
  }

  if (!response.ok || !payload.firebaseCustomToken) {
    throw new Error(
      payload.error || 'Firebase 로그인 토큰 발급에 실패했어요.',
    )
  }
  return payload.firebaseCustomToken
}

/**
 * 앱(토스) 사용자 ↔ Firebase Auth 세션 동기화
 * Custom Token만 사용하며, 익명 로그인은 절대 쓰지 않아요.
 */
export async function syncFirebaseAuthForAppUser(
  appUser: AuthUser,
  customToken?: string | null,
): Promise<User> {
  if (syncInFlight) return syncInFlight

  syncInFlight = (async () => {
    const existing = await waitForAuthInit()
    if (existing && !existing.isAnonymous) {
      const expectedPrefix = appUser.id
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 128)
      if (existing.uid === expectedPrefix || existing.uid === appUser.id) {
        return existing
      }
    }

    if (existing?.isAnonymous) {
      console.warn('[Firebase] 익명 세션 감지 → 로그아웃 후 Custom Token으로 교체')
      await signOut(auth)
    }

    const token = customToken?.trim() || (await fetchFirebaseCustomToken(appUser))
    return signInFirebaseWithCustomToken(token)
  })()

  try {
    return await syncInFlight
  } finally {
    syncInFlight = null
  }
}

/**
 * Storage/Firestore 쓰기 전: 유효한(비익명) Firebase 세션이 있어야 해요.
 */
export async function ensureFirebaseAuth(): Promise<User> {
  const existing = await waitForAuthInit()
  if (existing && !existing.isAnonymous) {
    return existing
  }

  if (existing?.isAnonymous) {
    await signOut(auth)
  }

  throw new Error(
    'Firebase 로그인이 필요해요. 앱을 다시 시작한 뒤 로그인해 주세요.',
  )
}

export async function signOutFirebase() {
  await signOut(auth)
}

export default firebaseApp
