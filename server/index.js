import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  extractDisplayNameFromLoginMe,
  isDisplayableName,
} from './decrypt.js'
import {
  loadEnvFile,
  parseDecryptKeyFile,
  readOptionalFile,
} from './loadEnv.js'
import { fetchLoginMe, generateToken } from './tossClient.js'
import {
  createFirebaseCustomToken,
  getFirebaseAdminStatus,
  initFirebaseAdmin,
} from './firebaseAdmin.js'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(resolve(PROJECT_ROOT, '.env'))
initFirebaseAdmin()

const PORT = Number(process.env.PORT || process.env.AUTH_SERVER_PORT || 4000)

function resolveProjectPath(filePath) {
  if (!filePath) return ''
  return resolve(PROJECT_ROOT, filePath)
}

function loadDecryptSecrets() {
  const keyFile = resolveProjectPath(
    process.env.TOSS_DECRYPT_KEY_FILE || 'secrets/toss-decrypt.key',
  )
  const aadFile = resolveProjectPath(
    process.env.TOSS_AAD_FILE || 'secrets/toss-aad.txt',
  )

  const fromFile = parseDecryptKeyFile(readOptionalFile(keyFile))
  const key = (
    process.env.TOSS_DECRYPT_KEY ||
    fromFile.key ||
    ''
  )
    .replace(/\s+/g, '')
    .trim()

  const aad = (
    process.env.TOSS_AAD ||
    readOptionalFile(aadFile) ||
    fromFile.aad ||
    ''
  ).trim()

  return { key, aad, keyFile, aadFile }
}

function allowedOrigins() {
  const fromEnv = (process.env.AUTH_CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const appName = 'woori-secret-space'
  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    `https://${appName}.web.tossmini.com`,
    `https://${appName}.private-web.tossmini.com`,
    `https://${appName}.apps.tossmini.com`,
    `https://${appName}.private-apps.tossmini.com`,
  ]

  return [...new Set([...defaults, ...fromEnv])]
}

function applyCors(req, res) {
  const origin = req.headers.origin
  const allowed = allowedOrigins()
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  } else if (origin && /\.tossmini\.com$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text) {
        resolvePromise({})
        return
      }
      try {
        resolvePromise(JSON.parse(text))
      } catch {
        reject(new Error('JSON 본문이 올바르지 않아요.'))
      }
    })
    req.on('error', reject)
  })
}

function verifyUnlinkBasicAuth(req) {
  const user = process.env.TOSS_UNLINK_BASIC_USER
  const password = process.env.TOSS_UNLINK_BASIC_PASSWORD
  if (!user && !password) return true
  const header = req.headers.authorization || ''
  if (!header.startsWith('Basic ')) return false
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  const index = decoded.indexOf(':')
  const incomingUser = index >= 0 ? decoded.slice(0, index) : decoded
  const incomingPassword = index >= 0 ? decoded.slice(index + 1) : ''
  return incomingUser === user && incomingPassword === password
}

/**
 * 토스 로그인 콜백:
 * 1) authorizationCode → accessToken (mTLS)
 * 2) login-me → 암호화된 name
 * 3) AES-256-GCM 복호화 → 실명
 *
 * ※ VITE_TOSS_CONSENTED_DATA_KEY 는 클라이언트 SDK(getConsentedData)용이에요.
 *    백엔드는 login-me 응답만 복호화합니다.
 */
async function handleTossLogin(req, res) {
  const body = await readBody(req)
  const authorizationCode = String(body.authorizationCode || '').trim()
  const referrer = body.referrer === 'SANDBOX' ? 'SANDBOX' : 'DEFAULT'
  if (!authorizationCode) {
    sendJson(res, 400, { error: '인가 코드가 없어요.' })
    return
  }

  const { key, aad } = loadDecryptSecrets()
  if (!key || !aad) {
    sendJson(res, 503, {
      error:
        '복호화 키 또는 AAD가 없어요. secrets/toss-decrypt.key, secrets/toss-aad.txt 또는 TOSS_DECRYPT_KEY / TOSS_AAD 를 확인해 주세요.',
    })
    return
  }

  const tokenResult = await generateToken(authorizationCode, referrer)
  if (tokenResult.resultType !== 'SUCCESS' || !tokenResult.success?.accessToken) {
    console.error('[auth-server] generate-token 실패', tokenResult)
    sendJson(res, 401, {
      error:
        tokenResult.error?.reason ||
        (typeof tokenResult.error === 'string'
          ? tokenResult.error
          : null) ||
        '토큰 발급에 실패했어요.',
    })
    return
  }

  const accessToken = tokenResult.success.accessToken
  const meResult = await fetchLoginMe(accessToken)
  if (meResult.resultType !== 'SUCCESS' || meResult.success?.userKey == null) {
    console.error('[auth-server] login-me 실패', meResult)
    sendJson(res, 401, {
      error: meResult.error?.reason || '사용자 정보를 가져오지 못했어요.',
    })
    return
  }

  const profile = meResult.success
  const extracted = extractDisplayNameFromLoginMe(profile, key, aad)
  const displayName = isDisplayableName(extracted.name) ? extracted.name : ''

  if (!displayName) {
    console.warn('[auth-server] 실명을 추출하지 못했어요', {
      userKey: profile.userKey,
      hasNameField: profile.name != null && profile.name !== '',
      nameLooksEncrypted: extracted.encrypted,
      scope: profile.scope ?? null,
    })
  } else {
    console.info('[auth-server] 실명 추출 성공', {
      userKey: profile.userKey,
      source: extracted.source,
      nameLength: displayName.length,
    })
  }

  let firebaseCustomToken = null
  let firebaseUid = null
  try {
    const minted = await createFirebaseCustomToken(String(profile.userKey), {
      authMethod: 'toss-login',
      name: displayName || undefined,
    })
    firebaseCustomToken = minted.token
    firebaseUid = minted.uid
  } catch (error) {
    console.error('[auth-server] Firebase custom token 발급 실패', error)
    sendJson(res, 503, {
      error:
        error instanceof Error
          ? error.message
          : 'Firebase 로그인 토큰을 만들지 못했어요. 서비스 계정 설정을 확인해 주세요.',
    })
    return
  }

  sendJson(res, 200, {
    user: {
      id: String(profile.userKey),
      name: displayName,
      userKey: profile.userKey,
    },
    firebaseCustomToken,
    firebaseUid,
  })
}

/**
 * 앱 사용자(식별키 등)용 Firebase Custom Token 재발급
 * — 세션 복원 시 Firebase Auth가 없을 때 클라이언트에서 호출
 */
async function handleFirebaseToken(req, res) {
  const body = await readBody(req)
  const userId = String(body.userId || body.uid || '').trim()
  const authMethod = String(body.authMethod || 'anonymous-key').trim()
  const name = String(body.name || '').trim()

  if (!userId) {
    sendJson(res, 400, { error: 'userId가 없어요.' })
    return
  }

  try {
    const minted = await createFirebaseCustomToken(userId, {
      authMethod,
      name: name || undefined,
    })
    sendJson(res, 200, {
      firebaseCustomToken: minted.token,
      firebaseUid: minted.uid,
    })
  } catch (error) {
    console.error('[auth-server] firebase-token 실패', error)
    sendJson(res, 503, {
      error:
        error instanceof Error
          ? error.message
          : 'Firebase 로그인 토큰을 만들지 못했어요.',
    })
  }
}

async function handleUnlink(req, res) {
  if (!verifyUnlinkBasicAuth(req)) {
    sendJson(res, 401, { error: 'unauthorized' })
    return
  }

  let userKey
  let referrer
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost')
    userKey = url.searchParams.get('userKey')
    referrer = url.searchParams.get('referrer')
  } else {
    const body = await readBody(req)
    userKey = body.userKey
    referrer = body.referrer
  }

  console.info('[toss-unlink]', { userKey, referrer })
  sendJson(res, 200, { ok: true })
}

const server = createServer(async (req, res) => {
  applyCors(req, res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', 'http://localhost')

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const { key, aad } = loadDecryptSecrets()
      let keyBytes = 0
      try {
        keyBytes = key ? Buffer.from(key, 'base64').length : 0
      } catch {
        keyBytes = -1
      }
      const firebaseAdmin = getFirebaseAdminStatus()
      sendJson(res, 200, {
        ok: true,
        decryptKeyLoaded: Boolean(key),
        decryptKeyBytes: keyBytes,
        aadLoaded: Boolean(aad),
        aadLength: aad.length,
        // 가이드 확인용: firebaseAdmin.ready === true 여야 Custom Token 발급 가능
        firebaseAdmin,
        firebaseAdminReady: firebaseAdmin.ready === true,
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/toss-login') {
      await handleTossLogin(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/firebase-token') {
      await handleFirebaseToken(req, res)
      return
    }

    if (
      (req.method === 'POST' || req.method === 'GET') &&
      url.pathname === '/api/auth/toss-unlink'
    ) {
      await handleUnlink(req, res)
      return
    }

    sendJson(res, 404, { error: 'not found' })
  } catch (error) {
    console.error('[auth-server]', error)
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : '서버 오류가 발생했어요.',
    })
  }
})

// Render는 0.0.0.0:$PORT 로 바인딩해야 헬스체크/외부 요청이 통과합니다.
server.listen(PORT, '0.0.0.0', () => {
  const { key, aad } = loadDecryptSecrets()
  let keyBytes = 0
  try {
    keyBytes = key ? Buffer.from(key, 'base64').length : 0
  } catch {
    keyBytes = -1
  }
  const firebaseAdmin = getFirebaseAdminStatus()
  console.info(`Toss auth server listening on 0.0.0.0:${PORT}`)
  console.info(
    `decrypt key: ${key ? `loaded (${keyBytes} bytes)` : 'missing'}, aad: ${aad ? `loaded (len ${aad.length})` : 'missing'}`,
  )
  console.info(
    `firebaseAdmin.ready: ${firebaseAdmin.ready === true}${firebaseAdmin.projectId ? ` (project=${firebaseAdmin.projectId})` : ''}${firebaseAdmin.error ? ` — ${firebaseAdmin.error}` : ''}`,
  )
  if (!firebaseAdmin.ready) {
    console.warn(
      '[auth-server] Firebase Admin 미준비 → /api/auth/toss-login 이 Custom Token을 발급하지 못합니다. FIREBASE_SERVICE_ACCOUNT_JSON 을 설정하세요.',
    )
  }
})
