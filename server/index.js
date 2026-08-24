import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { decryptIfNeeded } from './decrypt.js'
import {
  loadEnvFile,
  parseDecryptKeyFile,
  readOptionalFile,
} from './loadEnv.js'
import { fetchLoginMe, generateToken } from './tossClient.js'

loadEnvFile(resolve(process.cwd(), '.env'))

const PORT = Number(process.env.AUTH_SERVER_PORT || 4000)

function loadDecryptSecrets() {
  const fromFile = parseDecryptKeyFile(
    readOptionalFile(process.env.TOSS_DECRYPT_KEY_FILE),
  )
  const key =
    process.env.TOSS_DECRYPT_KEY?.trim() ||
    fromFile.key ||
    ''
  const aad =
    process.env.TOSS_AAD?.trim() ||
    readOptionalFile(process.env.TOSS_AAD_FILE) ||
    fromFile.aad ||
    ''
  return { key, aad }
}

function allowedOrigins() {
  return (process.env.AUTH_CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function applyCors(req, res) {
  const origin = req.headers.origin
  const allowed = allowedOrigins()
  if (origin && allowed.includes(origin)) {
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
        '복호화 키 또는 AAD가 없어요. secrets/ 파일 또는 서버 .env 를 확인해 주세요.',
    })
    return
  }

  const tokenResult = await generateToken(authorizationCode, referrer)
  if (tokenResult.resultType !== 'SUCCESS' || !tokenResult.success?.accessToken) {
    sendJson(res, 401, {
      error: tokenResult.error?.reason || '토큰 발급에 실패했어요.',
    })
    return
  }

  const accessToken = tokenResult.success.accessToken
  const meResult = await fetchLoginMe(accessToken)
  if (meResult.resultType !== 'SUCCESS' || meResult.success?.userKey == null) {
    sendJson(res, 401, {
      error: meResult.error?.reason || '사용자 정보를 가져오지 못했어요.',
    })
    return
  }

  const profile = meResult.success
  const name = decryptIfNeeded(profile.name, key, aad)

  sendJson(res, 200, {
    user: {
      id: String(profile.userKey),
      name: name || `토스유저${String(profile.userKey).slice(-4)}`,
    },
  })
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
      sendJson(res, 200, {
        ok: true,
        decryptKeyLoaded: Boolean(key),
        aadLoaded: Boolean(aad),
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/toss-login') {
      await handleTossLogin(req, res)
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

server.listen(PORT, () => {
  const { key, aad } = loadDecryptSecrets()
  console.info(`Toss auth server listening on http://localhost:${PORT}`)
  console.info(`decrypt key: ${key ? 'loaded' : 'missing'}, aad: ${aad ? 'loaded' : 'missing'}`)
})
