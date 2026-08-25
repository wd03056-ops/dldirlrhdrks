import {
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db, ensureFirebaseAuth } from './firebase'
import { inboxCollection, inboxDocument } from './firestorePaths'
import { resolveFirestoreRoomId } from '../utils/firestoreRoomId'
import type {
  InboxNotification,
  InboxNotificationType,
} from '../types/notification'

function mapInbox(
  snap: QueryDocumentSnapshot<DocumentData>,
  roomId: string,
): InboxNotification | null {
  const data = snap.data()
  const recipientId =
    typeof data.recipientId === 'string' ? data.recipientId.trim() : ''
  const storyId = typeof data.storyId === 'string' ? data.storyId.trim() : ''
  if (!recipientId || !storyId) return null

  const type: InboxNotificationType =
    data.type === 'story_appended' ? 'story_appended' : 'story_created'

  const createdAtRaw = data.createdAt
  let createdAt: number | null = null
  if (
    createdAtRaw &&
    typeof createdAtRaw === 'object' &&
    'toMillis' in createdAtRaw &&
    typeof (createdAtRaw as { toMillis: () => number }).toMillis === 'function'
  ) {
    createdAt = (createdAtRaw as { toMillis: () => number }).toMillis()
  } else if (typeof createdAtRaw === 'number') {
    createdAt = createdAtRaw
  }

  return {
    id: snap.id,
    roomId,
    type,
    storyId,
    title: typeof data.title === 'string' ? data.title : '',
    authorId: typeof data.authorId === 'string' ? data.authorId : '',
    authorName: typeof data.authorName === 'string' ? data.authorName : '',
    recipientId,
    read: data.read === true,
    createdAt,
  }
}

/**
 * 글 작성/이어붙이기 후 다른 구성원에게 인박스 알림 생성
 * (작성자 본인 제외, recipient당 1문서)
 */
export async function notifyMembersStoryInbox(input: {
  roomId: string | number
  storyId: string
  title: string
  type: InboxNotificationType
  authorId: string
  authorName: string
  memberUserIds: string[]
}): Promise<number> {
  await ensureFirebaseAuth()
  const roomId = resolveFirestoreRoomId(input.roomId)
  const recipients = [
    ...new Set(
      input.memberUserIds
        .map((id) => String(id || '').trim())
        .filter((id) => id && id !== input.authorId && !id.startsWith('temp-')),
    ),
  ]
  if (recipients.length === 0) return 0

  // writeBatch 최대 500
  const chunkSize = 400
  let created = 0
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize)
    const batch = writeBatch(db)
    for (const recipientId of chunk) {
      const ref = inboxDocument(
        roomId,
        `${input.storyId}_${recipientId}`.slice(0, 700),
      )
      batch.set(ref, {
        type: input.type,
        storyId: input.storyId,
        title: input.title.trim() || '새 이야기',
        authorId: input.authorId,
        authorName: input.authorName,
        recipientId,
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      created += 1
    }
    await batch.commit()
  }
  return created
}

/** 현재 사용자의 읽지 않은 인박스 (최신순) */
export async function getUnreadInboxNotifications(
  roomId: string | number,
  recipientId: string,
): Promise<InboxNotification[]> {
  await ensureFirebaseAuth()
  const id = resolveFirestoreRoomId(roomId)
  const uid = String(recipientId || '').trim()
  if (!uid) return []

  const snapshot = await getDocs(
    query(inboxCollection(id), where('recipientId', '==', uid), limit(40)),
  )

  return snapshot.docs
    .map((snap) => mapInbox(snap, id))
    .filter((item): item is InboxNotification => item != null && !item.read)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

/** 해당 모임에서 내 인박스 모두 읽음 처리 */
export async function markRoomInboxRead(
  roomId: string | number,
  recipientId: string,
): Promise<void> {
  await ensureFirebaseAuth()
  const id = resolveFirestoreRoomId(roomId)
  const uid = String(recipientId || '').trim()
  if (!uid) return

  const unread = await getUnreadInboxNotifications(id, uid)
  if (unread.length === 0) return

  const chunkSize = 400
  for (let i = 0; i < unread.length; i += chunkSize) {
    const chunk = unread.slice(i, i + chunkSize)
    const batch = writeBatch(db)
    for (const item of chunk) {
      batch.update(inboxDocument(id, item.id), {
        read: true,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
}

export async function markInboxNotificationRead(
  roomId: string | number,
  notificationId: string,
): Promise<void> {
  await ensureFirebaseAuth()
  await updateDoc(inboxDocument(roomId, notificationId), {
    read: true,
    updatedAt: serverTimestamp(),
  })
}
