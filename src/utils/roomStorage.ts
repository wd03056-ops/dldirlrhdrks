import type { Room } from '../types/room'
import { createRoomSlug } from './roomLinks'

const ROOMS_STORAGE_KEY = 'woori-rooms-v1'

/** 사용자가 직접 지정한 방 대표 사진만 반환 (게시물 사진 자동 반영 없음) */
export function getRoomCoverPhoto(room: Room): string | null {
  return room.coverPhoto ?? null
}

export function withRoomSlug<T extends { id: number; title: string; slug?: string }>(
  room: T,
): T & { slug: string } {
  return {
    ...room,
    slug: room.slug ?? createRoomSlug(),
  }
}

function normalizeRoom(room: Room): Room {
  return withRoomSlug({
    ...room,
    // 게시물에서 채워졌을 수 있는 lastPhoto는 방 썸네일로 쓰지 않음
    lastPhoto: null,
    coverPhoto: room.coverPhoto ?? null,
  })
}

export function normalizeStoredRoom(room: Room): Room {
  return normalizeRoom(room)
}

export function loadStoredRooms(): Room[] {
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as Room[]
    if (!Array.isArray(parsed)) return []

    return parsed.map((room) => normalizeRoom(room))
  } catch {
    return []
  }
}

export function saveStoredRooms(rooms: Room[]) {
  localStorage.setItem(
    ROOMS_STORAGE_KEY,
    JSON.stringify(rooms.map((room) => normalizeRoom(room))),
  )
}

export function findRoomBySlug(rooms: Room[], slug: string) {
  const byExact = rooms.find((room) => room.slug === slug)
  if (byExact) return byExact

  // 구버전 제목-숫자 주소 호환
  const roomId = slug.match(/-(\d+)$/)?.[1]
  if (!roomId) return null

  return rooms.find((room) => String(room.id) === roomId) ?? null
}

export function upsertRoom(rooms: Room[], room: Room) {
  const normalized = normalizeRoom(room)
  const index = rooms.findIndex((item) => item.id === normalized.id)

  if (index === -1) {
    return [normalized, ...rooms]
  }

  const prev = rooms[index]
  const next = [...rooms]
  // 초대 참여 등으로 병합해도 기존 커스텀 커버는 유지, 게시물 사진으로 덮지 않음
  next[index] = normalizeRoom({
    ...prev,
    ...normalized,
    coverPhoto: normalized.coverPhoto ?? prev.coverPhoto ?? null,
    lastPhoto: null,
  })
  return next
}
