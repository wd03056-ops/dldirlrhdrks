import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { ensureFirebaseAuth } from './firebase'
import { schedulesCollection, scheduleDocument } from './firestorePaths'
import { resolveFirestoreRoomId } from '../utils/firestoreRoomId'
import type {
  Schedule,
  ScheduleCreateInput,
  ScheduleUpdateInput,
} from '../types/schedule'

function mapSchedule(
  snap: DocumentSnapshot<DocumentData>,
  roomId: string,
): Schedule {
  const data = snap.data() ?? {}
  const startDate = (data.startDate as string) ?? (data.dateKey as string) ?? ''
  const endDate =
    (data.endDate as string) ?? (data.endDateKey as string) ?? startDate

  return {
    id: snap.id,
    roomId,
    title: (data.title as string) ?? '',
    memo: (data.memo as string) ?? '',
    startDate,
    endDate,
    confirmedMemberIds: Array.isArray(data.confirmedMemberIds)
      ? (data.confirmedMemberIds as string[]).map(String)
      : [],
    status: data.status === 'confirmed' ? 'confirmed' : 'pending',
    createdBy: data.createdBy as string | undefined,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  }
}

function sortByStartDate(list: Schedule[]) {
  return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** rooms/{roomId}/schedules 목록 조회 (1회) */
export async function getSchedules(roomId: string | number): Promise<Schedule[]> {
  const id = resolveFirestoreRoomId(roomId)
  const snapshot = await getDocs(schedulesCollection(id))
  return sortByStartDate(snapshot.docs.map((snap) => mapSchedule(snap, id)))
}

/**
 * rooms/{roomId}/schedules 실시간 구독
 * orderBy 인덱스 없이 동작하도록 클라이언트 정렬
 */
export function subscribeSchedules(
  roomId: string | number,
  onData: (schedules: Schedule[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const id = resolveFirestoreRoomId(roomId)
  return onSnapshot(
    schedulesCollection(id),
    (snapshot) => {
      const list = sortByStartDate(
        snapshot.docs.map((snap) => mapSchedule(snap, id)),
      )
      onData(list)
    },
    (error) => {
      console.error('[Firestore] subscribeSchedules error', error)
      onError?.(error)
    },
  )
}

/** rooms/{roomId}/schedules/{scheduleId} 단건 조회 */
export async function getSchedule(
  roomId: string | number,
  scheduleId: string,
): Promise<Schedule | null> {
  const id = resolveFirestoreRoomId(roomId)
  const snap = await getDoc(scheduleDocument(id, scheduleId))
  if (!snap.exists()) return null
  return mapSchedule(snap, id)
}

/** rooms/{roomId}/schedules 에 일정 추가 — 실제 addDoc 호출 */
export async function addSchedule(
  roomId: string | number,
  input: Omit<ScheduleCreateInput, 'roomId'> & { roomId?: string },
): Promise<string> {
  await ensureFirebaseAuth()
  const id = resolveFirestoreRoomId(roomId)
  const payload = {
    roomId: id,
    title: input.title,
    memo: input.memo ?? '',
    startDate: input.startDate,
    endDate: input.endDate || input.startDate,
    confirmedMemberIds: input.confirmedMemberIds ?? [],
    status: input.status ?? 'pending',
    createdBy: input.createdBy ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }


  const ref = await addDoc(schedulesCollection(id), payload)
  return ref.id
}

/** rooms/{roomId}/schedules/{scheduleId} 수정 */
export async function updateSchedule(
  roomId: string | number,
  scheduleId: string,
  input: ScheduleUpdateInput,
): Promise<void> {
  await ensureFirebaseAuth()
  const id = resolveFirestoreRoomId(roomId)
  await updateDoc(scheduleDocument(id, scheduleId), {
    ...input,
    updatedAt: serverTimestamp(),
  })
}

/** rooms/{roomId}/schedules/{scheduleId} 삭제 */
export async function deleteSchedule(
  roomId: string | number,
  scheduleId: string,
): Promise<void> {
  await ensureFirebaseAuth()
  const id = resolveFirestoreRoomId(roomId)
  await deleteDoc(scheduleDocument(id, scheduleId))
}

/** 구성원이 일정 확인 */
export async function confirmScheduleMember(
  roomId: string | number,
  scheduleId: string,
  memberId: string,
  allMemberIds: string[],
): Promise<void> {
  const id = resolveFirestoreRoomId(roomId)
  const current = await getSchedule(id, scheduleId)
  if (!current) throw new Error('일정을 찾을 수 없습니다.')
  if (current.confirmedMemberIds.includes(memberId)) return

  const confirmedMemberIds = [...current.confirmedMemberIds, memberId]
  const isAllConfirmed =
    allMemberIds.length > 0 &&
    allMemberIds.every((mid) => confirmedMemberIds.includes(mid))

  await updateSchedule(id, scheduleId, {
    confirmedMemberIds,
    status: isAllConfirmed ? 'confirmed' : 'pending',
  })
}
