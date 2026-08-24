import { Clipboard } from '@apps-in-toss/web-framework'

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
 * 초대 공유 링크 생성
 * - 토스: Share.createLink(intoss://…)
 * - 그 외: 웹 URL 폴백
 */
export async function buildInviteShareLink(slug: string) {
  const intossPath = buildIntossRoomPath(slug)
  try {
    const { Share } = await import('@apps-in-toss/web-framework')
    return await Share.createLink({ path: intossPath })
  } catch {
    return buildRoomUrl(slug)
  }
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
