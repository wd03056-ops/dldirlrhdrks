/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_TOSS_AUTH_API_URL: string
  /** 콘솔에 등록한 사용자 정보 동의 키 (예: cud_delivery) — USER_NAME 조회용 */
  readonly VITE_TOSS_CONSENTED_DATA_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
