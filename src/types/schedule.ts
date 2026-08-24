import type { Timestamp } from 'firebase/firestore'

export type ScheduleStatus = 'pending' | 'confirmed'

/**
 * 일정(스케줄) — 방 단위 기간 일정
 * Firestore: rooms/{roomId}/schedules/{scheduleId}
 */
export interface Schedule {
  id: string
  roomId: string
  title: string
  memo: string
  /** 시작일 YYYY-MM-DD */
  startDate: string
  /** 종료일 YYYY-MM-DD (하루면 startDate와 동일) */
  endDate: string
  /** 확인한 구성원 userId 목록 */
  confirmedMemberIds: string[]
  status: ScheduleStatus
  createdBy?: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export type ScheduleCreateInput = Omit<
  Schedule,
  'id' | 'createdAt' | 'updatedAt'
>

export type ScheduleUpdateInput = Partial<
  Omit<Schedule, 'id' | 'roomId' | 'createdAt' | 'updatedAt'>
>
