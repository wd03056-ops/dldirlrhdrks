import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnvFile(filePath) {
  const absolute = resolve(filePath)
  if (!existsSync(absolute)) return

  for (const rawLine of readFileSync(absolute, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index < 0) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export function readOptionalFile(filePath) {
  if (!filePath) return ''
  const absolute = resolve(filePath)
  if (!existsSync(absolute)) return ''
  return readFileSync(absolute, 'utf8').trim()
}

/**
 * 이메일로 받은 복호화 키 파일 파싱.
 * 지원: 한 줄 Base64, KEY=/AAD= 형식, JSON { key, aad }
 */
export function parseDecryptKeyFile(contents) {
  const text = contents.trim()
  if (!text) return { key: '', aad: '' }

  if (text.startsWith('{')) {
    try {
      const json = JSON.parse(text)
      return {
        key: String(json.key ?? json.aesKey ?? json.decryptKey ?? '').trim(),
        aad: String(json.aad ?? json.AAD ?? json.add ?? '').trim(),
      }
    } catch {
      // fall through
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 1 && !lines[0].includes('=')) {
    return { key: lines[0], aad: '' }
  }

  const result = { key: '', aad: '' }
  for (const line of lines) {
    const index = line.indexOf('=')
    const colon = line.indexOf(':')
    const splitAt = index >= 0 ? index : colon
    if (splitAt < 0) continue
    const name = line.slice(0, splitAt).trim().toLowerCase()
    const value = line.slice(splitAt + 1).trim()
    if (['key', 'aes_key', 'aeskey', 'decrypt_key', 'decryptkey', 'toss_decrypt_key'].includes(name)) {
      result.key = value
    }
    if (['aad', 'add', 'toss_aad'].includes(name)) {
      result.aad = value
    }
  }

  if (!result.key) {
    result.key = lines.find((line) => !line.includes('=') && !line.includes(':')) ?? ''
  }
  return result
}
