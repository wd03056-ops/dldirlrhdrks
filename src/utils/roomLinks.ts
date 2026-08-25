import { Clipboard, Share } from '@apps-in-toss/web-framework'

/** 겹치지 않는 무작위 방 주소용 ID (UUID 기반) */
export function createRoomSlug() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }

  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }

  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** @deprecated 제목 기반 slug 대신 createRoomSlug() 사용 */
export function buildRoomSlug(_title?: string, _id?: number) {
  return createRoomSlug()
}

export function parseRoomIdFromSlug(slug: string) {
  const match = slug.match(/-(\d+)$/)
  if (!match) return null

  const id = Number(match[1])
  return Number.isFinite(id) ? id : null
}

export function buildRoomPath(slug: string) {
  return `/room/${encodeURIComponent(slug)}`
}

export function buildRoomUrl(slug: string) {
  return `${window.location.origin}${buildRoomPath(slug)}`
}

/** 앱인토스 공유용 intoss:// 딥링크 */
export function buildIntossRoomPath(slug: string) {
  return `intoss://woori-secret-space${buildRoomPath(slug)}`
}

/**
 * '주소로 참여하기'에 붙여넣을 수 있는 초대 주소
 * (Share.createLink 단축 URL은 slug가 없어 붙여넣기 참여에 쓸 수 없음)
 */
export function buildInviteCopyLink(slug: string) {
  return buildIntossRoomPath(slug)
}

/**
 * 초대 공유 링크 생성
 * - 토스: Share.createLink(intoss://…) — 외부 공유용
 * - 그 외: 웹 URL 폴백
 */
export async function buildInviteShareLink(slug: string) {
  const intossPath = buildIntossRoomPath(slug)
  try {
    return await Share.createLink({ path: intossPath })
  } catch {
    return buildRoomUrl(slug)
  }
}

/**
 * 붙여넣은 초대 주소/텍스트에서 room slug 추출
 * - intoss://…/room/{slug}
 * - https://…/room/{slug}
 * - 토스 공유 링크 query에 path가 실린 경우
 * - slug 원문
 */
export function extractRoomSlug(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const fromRoomPath = (value: string) => {
    const match = value.match(/\/room\/([^/?#\s]+)/i)
    if (!match) return null
    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }

  // intoss://woori-secret-space/room/{slug}
  const intossMatch = trimmed.match(
    /^intoss:\/\/[^/\s]+\/room\/([^/?#\s]+)/i,
  )
  if (intossMatch) {
    try {
      return decodeURIComponent(intossMatch[1])
    } catch {
      return intossMatch[1]
    }
  }

  const pathHit = fromRoomPath(trimmed)
  if (pathHit) return pathHit

  try {
    const url = new URL(trimmed)

    const pathMatch = url.pathname.match(/\/room\/([^/]+)\/?$/i)
    if (pathMatch) return decodeURIComponent(pathMatch[1])

    const hashHit = fromRoomPath(url.hash)
    if (hashHit) return hashHit

    for (const key of ['path', 'slug', 'room', 'roomSlug', 'redirectUrl', 'url']) {
      const raw = url.searchParams.get(key)
      if (!raw) continue
      const nested = extractRoomSlug(raw)
      if (nested) return nested
    }
  } catch {
    // not a full URL
  }

  if (/^[a-f0-9]{32}$/i.test(trimmed)) return trimmed.toLowerCase()
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      trimmed,
    )
  ) {
    return trimmed.replace(/-/g, '').toLowerCase()
  }
  // 구버전 제목-숫자 slug
  if (/^[^/\s]+-\d+$/.test(trimmed)) return trimmed
  if (/^[a-zA-Z0-9_-]{16,}$/.test(trimmed)) return trimmed

  return null
}

export function getRoomSlugFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/room\/([^/]+)\/?$/)
  if (pathMatch) return decodeURIComponent(pathMatch[1])

  const hashMatch = window.location.hash.match(/^#\/room\/([^/]+)\/?$/)
  if (hashMatch) return decodeURIComponent(hashMatch[1])

  return null
}

export function setRoomLocation(slug: string | null) {
  const nextPath = slug ? buildRoomPath(slug) : '/'
  window.history.pushState({ roomSlug: slug }, '', nextPath)
}

export function replaceRoomLocation(slug: string | null) {
  const nextPath = slug ? buildRoomPath(slug) : '/'
  window.history.replaceState({ roomSlug: slug }, '', nextPath)
}

export async function copyTextToClipboard(text: string) {
  try {
    await Clipboard.setText(text)
    return
  } catch {
    // 토스 앱 외 환경 폴백
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
