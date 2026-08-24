import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

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

let authReady: Promise<void> | null = null

/**
 * Storage 규칙(request.auth != null)을 위해 Firebase 익명 로그인을 보장해요.
 * 앱 사용자 식별(토스 식별키)과는 별개예요.
 */
export function ensureFirebaseAuth() {
  if (auth.currentUser) return Promise.resolve()

  if (!authReady) {
    authReady = new Promise<void>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            unsubscribe()
            resolve()
            return
          }

          void signInAnonymously(auth)
            .then(() => {
              unsubscribe()
              resolve()
            })
            .catch((error) => {
              authReady = null
              unsubscribe()
              reject(error)
            })
        },
        (error) => {
          authReady = null
          unsubscribe()
          reject(error)
        },
      )
    })
  }

  return authReady
}

console.log('[Firebase] 초기화 완료', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
})

export default firebaseApp
