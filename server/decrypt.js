import { createDecipheriv } from 'node:crypto'

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

/**
 * 토스 로그인 login-me 개인정보 복호화
 * - AES-256-GCM
 * - Base64( IV(12) || ciphertext || tag(16) )
 * - AAD: 이메일로 받은 Additional Authenticated Data
 * @see https://developers-apps-in-toss.toss.im/documentation/common/authentication/toss-login
 */
export function decryptTossField(encryptedText, base64EncodedAesKey, aad) {
  const key = normalizeAesKey(base64EncodedAesKey)
  const decoded = Buffer.from(String(encryptedText).trim(), 'base64')

  if (decoded.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error(
      `암호문 길이가 너무 짧아요. (${decoded.length} bytes, 최소 ${IV_LENGTH + AUTH_TAG_LENGTH + 1})`,
    )
  }

  const iv = decoded.subarray(0, IV_LENGTH)
  const tag = decoded.subarray(decoded.length - AUTH_TAG_LENGTH)
  const ciphertext = decoded.subarray(IV_LENGTH, decoded.length - AUTH_TAG_LENGTH)

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.from(String(aad), 'utf8'))
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8',
  )
}

function normalizeAesKey(base64EncodedAesKey) {
  const normalized = String(base64EncodedAesKey || '')
    .replace(/\s+/g, '')
    .trim()
  if (!normalized) {
    throw new Error('복호화 키가 비어 있어요.')
  }

  const key = Buffer.from(normalized, 'base64')
  if (key.length !== 32) {
    throw new Error(
      `복호화 키는 AES-256(32바이트)이어야 해요. (현재 ${key.length}바이트)`,
    )
  }
  return key
}

/** GCM 암호문(Base64)처럼 보이는지 — 짧은 실명(영문 포함)은 평문으로 취급 */
export function looksLikeEncryptedPayload(text) {
  const value = String(text || '').trim()
  // IV(12)+tag(16)+최소 1바이트 ≈ 29B → Base64 약 40자 이상
  if (value.length < 40) return false
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(value)
}

/**
 * AAD 후보를 순회하며 복호화 시도.
 * 이메일 AAD와 샘플 코드의 "TOSS" 등 흔한 값을 모두 시도해요.
 */
export function decryptWithAadCandidates(encryptedText, base64EncodedAesKey, primaryAad) {
  const candidates = []
  const push = (value) => {
    const next = String(value ?? '').trim()
    if (next && !candidates.includes(next)) candidates.push(next)
  }

  push(primaryAad)
  push(process.env.TOSS_AAD)
  push('TOSS')

  let lastError = null
  for (const aad of candidates) {
    try {
      return decryptTossField(encryptedText, base64EncodedAesKey, aad)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('복호화에 실패했어요.')
}

/**
 * 복호화 성공 시에만 평문을 반환해요.
 * 실패하면 null — 암호문을 닉네임으로 쓰지 않아요.
 */
export function decryptIfNeeded(value, base64EncodedAesKey, aad) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  if (!text || text === 'null') return null

  if (!looksLikeEncryptedPayload(text)) {
    return text
  }

  try {
    const plain = decryptWithAadCandidates(
      text,
      base64EncodedAesKey,
      aad,
    ).trim()
    return plain || null
  } catch (error) {
    console.error(
      '[decrypt] 복호화 실패',
      error instanceof Error ? error.message : error,
    )
    return null
  }
}

/** 화면에 쓸 수 있는 실명인지 (암호문·플레이스홀더 제외) */
export function isDisplayableName(name) {
  if (!name || typeof name !== 'string') return false
  const value = name.trim()
  if (!value) return false
  if (/^토스유저/i.test(value)) return false
  if (looksLikeEncryptedPayload(value)) return false
  return true
}

/**
 * login-me success 객체에서 실명 추출 + 복호화
 */
export function extractDisplayNameFromLoginMe(profile, base64EncodedAesKey, aad) {
  if (!profile || typeof profile !== 'object') {
    return { name: null, source: null, encrypted: false }
  }

  const rawCandidates = [
    profile.name,
    profile.userName,
    profile.USER_NAME,
    profile.username,
  ]

  for (const raw of rawCandidates) {
    if (raw == null || raw === '') continue
    const text = String(raw).trim()
    if (!text || text === 'null') continue

    const encrypted = looksLikeEncryptedPayload(text)
    const decrypted = decryptIfNeeded(text, base64EncodedAesKey, aad)
    if (isDisplayableName(decrypted)) {
      return {
        name: decrypted.trim(),
        source: encrypted ? 'login-me:decrypted' : 'login-me:plaintext',
        encrypted,
      }
    }
  }

  return {
    name: null,
    source: null,
    encrypted: rawCandidates.some(
      (value) => value && looksLikeEncryptedPayload(String(value)),
    ),
  }
}
