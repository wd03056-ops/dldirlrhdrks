import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

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

console.log('[Firebase] 초기화 완료', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
})

export default firebaseApp
