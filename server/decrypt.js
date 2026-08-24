import { createDecipheriv } from 'node:crypto'

const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * 토스 로그인 개인정보 복호화 (AES-256-GCM).
 * 암호문 Base64의 앞 12바이트가 IV, 뒤 16바이트가 auth tag.
 */
export function decryptTossField(encryptedText, base64EncodedAesKey, aad) {
  const decoded = Buffer.from(encryptedText, 'base64')
  const key = Buffer.from(base64EncodedAesKey, 'base64')
  if (decoded.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error('암호문 길이가 올바르지 않아요.')
  }
  if (key.length !== 32) {
    throw new Error('복호화 키는 AES-256(32바이트)이어야 해요.')
  }

  const iv = decoded.subarray(0, IV_LENGTH)
  const tag = decoded.subarray(decoded.length - TAG_LENGTH)
  const ciphertext = decoded.subarray(IV_LENGTH, decoded.length - TAG_LENGTH)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function decryptIfNeeded(value, base64EncodedAesKey, aad) {
  if (value == null || value === '') return null
  try {
    return decryptTossField(String(value), base64EncodedAesKey, aad)
  } catch {
    return String(value)
  }
}
