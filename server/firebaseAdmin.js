import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** @type {import('firebase-admin/app').App | null} */
let app = null
/** @type {string | null} */
let initError = null
/** @type {string | null} */
let projectId = null

/**
 * FIREBASE_SERVICE_ACCOUNT_JSON 문자열 → 객체 (안전 파싱)
 */
export function parseServiceAccountJson(raw) {
  if (raw == null) return null

  // 이미 객체로 주입된 경우 (일부 런타임)
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return normalizeServiceAccount(raw)
  }

  let text = String(raw).trim()
  if (!text) return null

  // BOM / 스마트따옴표 정리
  text = text.replace(/^\uFEFF/, '').replace(/[\u201C\u201D]/g, '"')

  // 전체가 따옴표로 한 번 더 감싸진 경우: "{\"type\":\"service_account\"...}"
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    try {
      text = JSON.parse(text)
      if (typeof text !== 'string') {
        return normalizeServiceAccount(text)
      }
      text = text.trim()
    } catch {
      // 아래 JSON.parse 로 재시도
    }
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_JSON JSON.parse 실패: ${message}. 유효한 서비스 계정 JSON 문자열인지 확인해 주세요.`,
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON 이 JSON 객체가 아니에요. 서비스 계정 키 파일 내용을 그대로 넣어 주세요.',
    )
  }

  return normalizeServiceAccount(parsed)
}

/**
 * 서비스 계정 필드 정규화
 * - private_key 의 \\n → 실제 개행
 */
function normalizeServiceAccount(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('서비스 계정 JSON 형식이 올바르지 않아요.')
  }

  /** @type {Record<string, unknown>} */
  const account = { ...raw }

  if (typeof account.private_key === 'string') {
    account.private_key = account.private_key.replace(/\\n/g, '\n')
  }

  if (
    typeof account.client_email !== 'string' ||
    !account.client_email ||
    typeof account.private_key !== 'string' ||
    !account.private_key
  ) {
    throw new Error(
      '서비스 계정에 client_email / private_key 가 없어요. Firebase Console에서 새 비공개 키를 다시 받아 주세요.',
    )
  }

  return account
}

function readServiceAccount() {
  const fromEnv = parseServiceAccountJson(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  )
  if (fromEnv) return fromEnv

  const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim()
  if (b64) {
    const decoded = Buffer.from(b64, 'base64').toString('utf8')
    return parseServiceAccountJson(decoded)
  }

  const filePath = resolve(
    PROJECT_ROOT,
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
      'secrets/firebase-service-account.json',
  )
  if (existsSync(filePath)) {
    return parseServiceAccountJson(readFileSync(filePath, 'utf8'))
  }

  return null
}

/**
 * Firebase Admin 초기화.
 * 우선순위: FIREBASE_SERVICE_ACCOUNT_JSON → BASE64 → secrets 파일
 *
 * ※ firebase-admin v12+ 는 admin.apps 가 없습니다.
 *    getApps() / initializeApp() / cert() 모듈 API를 사용합니다.
 */
export function initFirebaseAdmin() {
  if (app) {
    return { ready: true, error: null, projectId }
  }
  if (initError) {
    return { ready: false, error: initError, projectId: null }
  }

  try {
    const serviceAccount = readServiceAccount()
    if (!serviceAccount) {
      initError =
        'Firebase 서비스 계정 JSON이 없어요. FIREBASE_SERVICE_ACCOUNT_JSON 또는 secrets/firebase-service-account.json 을 설정하세요.'
      console.warn('[firebase-admin]', initError)
      return { ready: false, error: initError, projectId: null }
    }

    const existingApps = getApps()
    if (Array.isArray(existingApps) && existingApps.length > 0) {
      app = getApp()
    } else {
      app = initializeApp({
        credential: cert(
          /** @type {import('firebase-admin/app').ServiceAccount} */ (
            serviceAccount
          ),
        ),
        projectId:
          typeof serviceAccount.project_id === 'string'
            ? serviceAccount.project_id
            : undefined,
      })
    }

    projectId =
      typeof serviceAccount.project_id === 'string'
        ? serviceAccount.project_id
        : null
    initError = null
    return { ready: true, error: null, projectId }
  } catch (error) {
    initError =
      error instanceof Error ? error.message : 'Firebase Admin 초기화 실패'
    console.error('[firebase-admin] 초기화 실패', error)
    return { ready: false, error: initError, projectId: null }
  }
}

export function isFirebaseAdminReady() {
  return initFirebaseAdmin().ready
}

/**
 * /health 응답용 상태
 * → { ready: true } 가 나와야 Custom Token 발급이 가능합니다.
 */
export function getFirebaseAdminStatus() {
  const status = initFirebaseAdmin()
  return {
    ready: Boolean(status.ready),
    projectId: status.projectId,
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
 * 토스 사용자용 Firebase Custom Token 발급
 * getAuth().createCustomToken(uid, claims)
 */
export async function createFirebaseCustomToken(userId, claims = {}) {
  const status = initFirebaseAdmin()
  if (!status.ready || !app) {
    throw new Error(
      status.error ||
        'Firebase Admin이 준비되지 않았어요. FIREBASE_SERVICE_ACCOUNT_JSON 을 설정해 주세요.',
    )
  }

  const uid = toFirebaseUid(userId)
  const token = await getAuth(app).createCustomToken(uid, {
    provider: 'toss',
    ...claims,
  })
  return { uid, token }
}
