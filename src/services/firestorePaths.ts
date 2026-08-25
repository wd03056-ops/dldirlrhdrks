import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'
import { resolveFirestoreRoomId } from '../utils/firestoreRoomId'

/**
 * Firestore 데이터 경로
 *
 * - 공간:   rooms/{roomId}
 * - 멤버:   rooms/{roomId}/members/{userId}
 * - 이야기: rooms/{roomId}/stories/{storyId}
 * - 일정:   rooms/{roomId}/schedules/{scheduleId}
 */
export const FIRESTORE_PATHS = {
  rooms: 'rooms',
  members: 'members',
  stories: 'stories',
  schedules: 'schedules',
} as const

export function roomDocument(roomId: string | number) {
  const id = resolveFirestoreRoomId(roomId)
  return doc(db, FIRESTORE_PATHS.rooms, id)
}

export function membersCollection(roomId: string | number) {
  const id = resolveFirestoreRoomId(roomId)
  return collection(db, FIRESTORE_PATHS.rooms, id, FIRESTORE_PATHS.members)
}

export function memberDocument(roomId: string | number, userId: string) {
  const id = resolveFirestoreRoomId(roomId)
  const memberId = String(userId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128)
  return doc(
    db,
    FIRESTORE_PATHS.rooms,
    id,
    FIRESTORE_PATHS.members,
    memberId || 'unknown',
  )
}

export function storiesCollection(roomId: string | number) {
  const id = resolveFirestoreRoomId(roomId)
  return collection(db, FIRESTORE_PATHS.rooms, id, FIRESTORE_PATHS.stories)
}

export function storyDocument(roomId: string | number, storyId: string) {
  const id = resolveFirestoreRoomId(roomId)
  return doc(db, FIRESTORE_PATHS.rooms, id, FIRESTORE_PATHS.stories, storyId)
}

export function schedulesCollection(roomId: string | number) {
  const id = resolveFirestoreRoomId(roomId)
  return collection(db, FIRESTORE_PATHS.rooms, id, FIRESTORE_PATHS.schedules)
}

export function scheduleDocument(roomId: string | number, scheduleId: string) {
  const id = resolveFirestoreRoomId(roomId)
  return doc(
    db,
    FIRESTORE_PATHS.rooms,
    id,
    FIRESTORE_PATHS.schedules,
    scheduleId,
  )
}
