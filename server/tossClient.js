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

/**
 * 토스 파트너 API용 mTLS Agent.
 * cert = 공개 인증서(.crt), key = private key(.key)
 */
export function createMtlsAgent() {
  const certPath = resolveSecretPath(
    process.env.TOSS_MTLS_CERT_FILE || DEFAULT_CERT,
  )
  const keyPath = resolveSecretPath(
    process.env.TOSS_MTLS_KEY_FILE || DEFAULT_KEY,
  )

  if (!existsSync(certPath) || !existsSync(keyPath)) {
    throw new Error(
      `mTLS 파일을 찾을 수 없어요.\ncert: ${certPath}\nkey: ${keyPath}`,
    )
  }

  const caFile = process.env.TOSS_MTLS_CA_FILE
  const caPath = caFile ? resolveSecretPath(caFile) : ''

  return new https.Agent({
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
    ca: caPath && existsSync(caPath) ? readFileSync(caPath) : undefined,
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
