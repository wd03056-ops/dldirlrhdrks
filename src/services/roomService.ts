import {
  collection,
  getDocs,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, ensureFirebaseAuth } from './firebase'
import {
  memberDocument,
  membersCollection,
  roomDocument,
  FIRESTORE_PATHS,
} from './firestorePaths'
import { resolveFirestoreRoomId } from '../utils/firestoreRoomId'
import type { Room, RoomMember } from '../types/room'

export type FirestoreRoomMeta = {
  id: number
  slug: string
  title: string
  coverPhoto: string | null
  inviteMsg?: string
  createdBy?: string | null
}

/** 멤버별 모임 이름·커버 (본인에게만 보임) */
export type MemberRoomDisplayPrefs = {
  displayTitle?: string
  /** displayCoverPhoto 필드가 문서에 있으면 true (null = 사진 없음) */
  hasDisplayCover: boolean
  displayCoverPhoto: string | null
}

export function resolveMemberRoomDisplay(
  shared: { title: string; coverPhoto?: string | null },
  prefs: MemberRoomDisplayPrefs | null,
  local?: { title?: string; coverPhoto?: string | null } | null,
): { title: string; coverPhoto: string | null } {
  const personalTitle = prefs?.displayTitle?.trim()
  const localTitle = local?.title?.trim()
  const title = personalTitle || localTitle || shared.title

  let coverPhoto: string | null
  if (prefs?.hasDisplayCover) {
    coverPhoto = prefs.displayCoverPhoto
  } else if (local && 'coverPhoto' in local) {
    coverPhoto = local.coverPhoto ?? null
  } else {
    coverPhoto = shared.coverPhoto ?? null
  }

  return { title, coverPhoto }
}

function mapMember(
  snap: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData },
): RoomMember {
  const data = 'data' in snap ? snap.data() : {}
  const userId =
    (typeof data.userId === 'string' && data.userId) || snap.id || ''
  const name =
    (typeof data.name === 'string' && data.name.trim()) || '구성원'
  const numericId =
    typeof data.numericId === 'number'
      ? data.numericId
      : Number.parseInt(String(data.numericId ?? ''), 10)

  return {
    id: Number.isFinite(numericId) ? numericId : Date.now(),
    name,
    userId,
  }
}

function mapRoomMeta(
  roomId: string,
  data: DocumentData,
): FirestoreRoomMeta | null {
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const slug = typeof data.slug === 'string' ? data.slug.trim() : ''
  if (!title || !slug) return null

  const numericId = Number.parseInt(roomId, 10)
  return {
    id: Number.isFinite(numericId) ? numericId : Date.now(),
    slug,
    title,
    coverPhoto:
      typeof data.coverPhoto === 'string' || data.coverPhoto === null
        ? (data.coverPhoto as string | null)
        : null,
    inviteMsg:
      typeof data.inviteMsg === 'string' ? data.inviteMsg : undefined,
    createdBy:
      typeof data.createdBy === 'string' ? data.createdBy : null,
  }
}

/** rooms/{roomId}/members 실시간 구독 → 멤버 목록·인원수 */
export function subscribeRoomMembers(
  roomId: string | number,
  onChange: (members: RoomMember[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const col = membersCollection(roomId)

  return onSnapshot(
    col,
    (snapshot) => {
      const members = snapshot.docs
        .map((docSnap) => mapMember(docSnap))
        .sort((a, b) => a.id - b.id)
      onChange(members)
    },
    (error) => {
      console.error('[Firestore] subscribeRoomMembers 실패', error)
      onError?.(
        error instanceof Error
          ? error
          : new Error('구성원을 불러오지 못했어요.'),
      )
    },
  )
}

export async function listRoomMembers(
  roomId: string | number,
): Promise<RoomMember[]> {
  await ensureFirebaseAuth()
  const snapshot = await getDocs(membersCollection(roomId))
  return snapshot.docs.map((docSnap) => mapMember(docSnap))
}

/** 공간 문서 + 멤버 생성 (모임 만들기) */
export async function createRoomInFirestore(input: {
  room: Room
  user: { id: string; name: string }
}): Promise<void> {
  await ensureFirebaseAuth()
  const roomId = resolveFirestoreRoomId(input.room.id)
  const roomRef = roomDocument(roomId)

  await setDoc(roomRef, {
    title: input.room.title,
    slug: input.room.slug,
    coverPhoto: input.room.coverPhoto ?? null,
    inviteMsg: input.room.inviteMsg ?? '',
    createdBy: input.user.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    membersCount: 1,
  })

  await setDoc(memberDocument(roomId, input.user.id), {
    userId: input.user.id,
    name: input.user.name,
    numericId: Date.now(),
    joinedAt: serverTimestamp(),
    // 만든 사람의 개인 표시 설정 (다른 멤버와 독립)
    displayTitle: input.room.title,
    displayCoverPhoto: input.room.coverPhoto ?? null,
  })
}

/** 멤버 추가 (초대 링크로 참여) */
export async function joinRoomInFirestore(input: {
  roomId: string | number
  user: { id: string; name: string }
}): Promise<RoomMember[]> {
  await ensureFirebaseAuth()
  const roomId = resolveFirestoreRoomId(input.roomId)
  const memberRef = memberDocument(roomId, input.user.id)
  const existing = await getDoc(memberRef)

  if (!existing.exists()) {
    await setDoc(memberRef, {
      userId: input.user.id,
      name: input.user.name,
      numericId: Date.now(),
      joinedAt: serverTimestamp(),
    })
  } else {
    await updateDoc(memberRef, {
      name: input.user.name,
    })
  }

  const members = await listRoomMembers(roomId)
  await updateDoc(roomDocument(roomId), {
    membersCount: members.length,
    updatedAt: serverTimestamp(),
  }).catch(() => {
    // 방 문서가 아직 없어도 멤버는 유지
  })

  return members
}

/** 멤버 제거 (모임 나가기) — 방 문서는 삭제하지 않음 */
export async function leaveRoomInFirestore(input: {
  roomId: string | number
  userId: string
}): Promise<RoomMember[]> {
  await ensureFirebaseAuth()
  const roomId = resolveFirestoreRoomId(input.roomId)
  await deleteDoc(memberDocument(roomId, input.userId))

  const members = await listRoomMembers(roomId)
  await updateDoc(roomDocument(roomId), {
    membersCount: members.length,
    updatedAt: serverTimestamp(),
  }).catch(() => {})

  return members
}

export async function getRoomMeta(
  roomId: string | number,
): Promise<FirestoreRoomMeta | null> {
  await ensureFirebaseAuth()
  const snap = await getDoc(roomDocument(roomId))
  if (!snap.exists()) return null
  return mapRoomMeta(snap.id, snap.data() ?? {})
}

/** slug로 공간 찾기 (다른 기기에서 초대 링크로 입장할 때) */
export async function findRoomBySlugInFirestore(
  slug: string,
): Promise<(FirestoreRoomMeta & { memberList: RoomMember[]; members: number }) | null> {
  await ensureFirebaseAuth()
  const normalized = slug.trim()
  if (!normalized) return null

  const roomsQuery = query(
    collection(db, FIRESTORE_PATHS.rooms),
    where('slug', '==', normalized),
    limit(1),
  )

  const snapshot = await getDocs(roomsQuery)
  const roomSnap = snapshot.docs[0]
  if (!roomSnap) return null

  const meta = mapRoomMeta(roomSnap.id, roomSnap.data())
  if (!meta) return null

  const memberList = await listRoomMembers(roomSnap.id)
  return {
    ...meta,
    memberList,
    members: memberList.length,
  }
}

/** @deprecated 모임 이름·사진은 멤버별 개인 설정으로 저장하세요. */
export async function updateRoomMetaInFirestore(input: {
  roomId: string | number
  title?: string
  coverPhoto?: string | null
}): Promise<void> {
  await ensureFirebaseAuth()
  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }
  if (input.title !== undefined) patch.title = input.title
  if (input.coverPhoto !== undefined) patch.coverPhoto = input.coverPhoto

  await updateDoc(roomDocument(input.roomId), patch)
}

export async function getMemberRoomDisplay(
  roomId: string | number,
  userId: string,
): Promise<MemberRoomDisplayPrefs | null> {
  await ensureFirebaseAuth()
  const snap = await getDoc(memberDocument(roomId, userId))
  if (!snap.exists()) return null

  const data = snap.data() ?? {}
  const displayTitle =
    typeof data.displayTitle === 'string' ? data.displayTitle.trim() : undefined

  return {
    displayTitle: displayTitle || undefined,
    hasDisplayCover: Object.prototype.hasOwnProperty.call(data, 'displayCoverPhoto'),
    displayCoverPhoto:
      typeof data.displayCoverPhoto === 'string' || data.displayCoverPhoto === null
        ? (data.displayCoverPhoto as string | null)
        : null,
  }
}

/** 현재 사용자만의 모임 이름·커버 저장 (공유 rooms 문서는 변경하지 않음) */
export async function updateMemberRoomDisplayInFirestore(input: {
  roomId: string | number
  userId: string
  title: string
  coverPhoto: string | null
}): Promise<void> {
  await ensureFirebaseAuth()
  const title = input.title.trim()
  if (!title) {
    throw new Error('모임 이름을 입력해 주세요.')
  }

  await setDoc(
    memberDocument(input.roomId, input.userId),
    {
      userId: input.userId,
      displayTitle: title,
      displayCoverPhoto: input.coverPhoto,
    },
    { merge: true },
  )
}

/** Firestore 멤버 목록을 Room 필드에 반영 */
export function withLiveMembers(room: Room, members: RoomMember[]): Room {
  return {
    ...room,
    memberList: members,
    members: members.length,
  }
}
