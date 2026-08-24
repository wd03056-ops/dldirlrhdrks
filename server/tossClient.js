import { existsSync, readFileSync } from 'node:fs'
import https from 'node:https'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const DEFAULT_CERT = 'secrets/mtls/client.crt'
const DEFAULT_KEY = 'secrets/mtls/client.key'

function resolveSecretPath(filePath) {
  if (!filePath) return ''
  return resolve(PROJECT_ROOT, filePath)
}

/** Render 등에서는 PEM을 환경변수로 넣어요. \n 이스케이프도 허용합니다. */
function readPemFromEnv(raw) {
  if (!raw) return null
  const pem = String(raw).replace(/\\n/g, '\n').trim()
  if (!pem.includes('BEGIN')) return null
  return Buffer.from(pem, 'utf8')
}

function readPemFromBase64(raw) {
  if (!raw) return null
  try {
    const decoded = Buffer.from(String(raw).replace(/\s+/g, ''), 'base64')
    if (!decoded.toString('utf8').includes('BEGIN')) return null
    return decoded
  } catch {
    return null
  }
}

function loadMtlsMaterial() {
  const cert =
    readPemFromEnv(process.env.TOSS_MTLS_CERT) ||
    readPemFromBase64(process.env.TOSS_MTLS_CERT_BASE64) ||
    (() => {
      const path = resolveSecretPath(
        process.env.TOSS_MTLS_CERT_FILE || DEFAULT_CERT,
      )
      return existsSync(path) ? readFileSync(path) : null
    })()

  const key =
    readPemFromEnv(process.env.TOSS_MTLS_KEY) ||
    readPemFromBase64(process.env.TOSS_MTLS_KEY_BASE64) ||
    (() => {
      const path = resolveSecretPath(
        process.env.TOSS_MTLS_KEY_FILE || DEFAULT_KEY,
      )
      return existsSync(path) ? readFileSync(path) : null
    })()

  if (!cert || !key) {
    throw new Error(
      'mTLS 인증서가 없어요. Render에서는 TOSS_MTLS_CERT / TOSS_MTLS_KEY (PEM) 환경변수를 설정하세요.',
    )
  }

  let ca =
    readPemFromEnv(process.env.TOSS_MTLS_CA) ||
    readPemFromBase64(process.env.TOSS_MTLS_CA_BASE64) ||
    null
  if (!ca && process.env.TOSS_MTLS_CA_FILE) {
    const caPath = resolveSecretPath(process.env.TOSS_MTLS_CA_FILE)
    ca = existsSync(caPath) ? readFileSync(caPath) : null
  }

  return { cert, key, ca: ca || undefined }
}

/**
 * 토스 파트너 API용 mTLS Agent.
 * - 로컬: secrets/mtls/client.crt, client.key
 * - Render: TOSS_MTLS_CERT, TOSS_MTLS_KEY 환경변수
 */
export function createMtlsAgent() {
  const { cert, key, ca } = loadMtlsMaterial()
  return new https.Agent({
    cert,
    key,
    ca,
    keepAlive: true,
  })
}

let cachedAgent = null

function getMtlsAgent() {
  if (!cachedAgent) cachedAgent = createMtlsAgent()
  return cachedAgent
}

export function tossRequest({ method, apiPath, body, accessToken }) {
  const base = process.env.TOSS_API_BASE_URL || 'https://apps-in-toss-api.toss.im'
  const url = new URL(apiPath, base)
  const payload = body === undefined ? undefined : JSON.stringify(body)
  const agent = getMtlsAgent()

  return new Promise((resolvePromise, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        agent,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          try {
            resolvePromise(JSON.parse(text))
          } catch {
            reject(
              new Error(
                `Toss API 응답 파싱 실패 (${res.statusCode}): ${text.slice(0, 240)}`,
              ),
            )
          }
        })
      },
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

export async function generateToken(authorizationCode, referrer) {
  return tossRequest({
    method: 'POST',
    apiPath: '/api-partner/v1/apps-in-toss/user/oauth2/generate-token',
    body: { authorizationCode, referrer },
  })
}

export async function fetchLoginMe(accessToken) {
  return tossRequest({
    method: 'GET',
    apiPath: '/api-partner/v1/apps-in-toss/user/oauth2/login-me',
    accessToken,
  })
}
