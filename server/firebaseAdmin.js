import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** @type {import('firebase-admin') | null} */
let admin = null
/** @type {import('firebase-admin').app.App | null} */
let app = null
let initError = null

function readServiceAccount() {
  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()
  if (rawJson) {
    return JSON.parse(rawJson)
  }

  const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim()
  if (b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  }

  const filePath = resolve(
    PROJECT_ROOT,
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
      'secrets/firebase-service-account.json',
  )
  if (existsSync(filePath)) {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  }

  return null
}

/**
 * Firebase Admin 초기화. 서비스 계정이 없으면 ready=false.
 */
export function initFirebaseAdmin() {
  if (app) return { ready: true, error: null }
  if (initError) return { ready: false, error: initError }

  try {
    admin = require('firebase-admin')
    const serviceAccount = readServiceAccount()
    if (!serviceAccount) {
      initError =
        'Firebase 서비스 계정 JSON이 없어요. FIREBASE_SERVICE_ACCOUNT_JSON 또는 secrets/firebase-service-account.json 을 설정하세요.'
      console.warn('[firebase-admin]', initError)
      return { ready: false, error: initError }
    }

    if (admin.apps.length > 0) {
      app = admin.app()
    } else {
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    }
    console.info('[firebase-admin] 초기화 완료', {
      projectId: serviceAccount.project_id || null,
    })
    return { ready: true, error: null }
  } catch (error) {
    initError =
      error instanceof Error ? error.message : 'Firebase Admin 초기화 실패'
    console.error('[firebase-admin] 초기화 실패', error)
    return { ready: false, error: initError }
  }
}

export function isFirebaseAdminReady() {
  return initFirebaseAdmin().ready
}

export function getFirebaseAdminStatus() {
  const status = initFirebaseAdmin()
  return {
    ready: status.ready,
    error: status.error,
  }
}

/**
 * 앱 사용자 id → Firebase Auth UID
 * (영숫자·-_ 만 허용, 1~128자)
 */
export function toFirebaseUid(userId) {
  const raw = String(userId || '').trim()
  if (!raw) {
    throw new Error('사용자 ID가 없어요.')
  }
  if (raw.startsWith('temp-')) {
    throw new Error('임시 계정으로는 Firebase에 로그인할 수 없어요.')
  }
  const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128)
  if (!sanitized) {
    throw new Error('유효하지 않은 사용자 ID예요.')
  }
  return sanitized
}

/**
 * 토스/앱 사용자용 Firebase Custom Token 발급
 */
export async function createFirebaseCustomToken(userId, claims = {}) {
  const status = initFirebaseAdmin()
  if (!status.ready || !admin) {
    throw new Error(
      status.error ||
        'Firebase Admin이 준비되지 않았어요. 서비스 계정 JSON을 설정해 주세요.',
    )
  }

  const uid = toFirebaseUid(userId)
  const token = await admin.auth().createCustomToken(uid, {
    provider: 'toss',
    ...claims,
  })
  return { uid, token }
}
