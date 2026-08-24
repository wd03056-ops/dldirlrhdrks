export type StoredSchedule = {
  id: number
  title: string
  memo: string
  /** 시작일 YYYY-MM-DD */
  dateKey: string
  /** 종료일 YYYY-MM-DD (없으면 하루 일정) */
  endDateKey?: string
  confirmedMemberIds: number[]
  status: 'pending' | 'confirmed'
}

const keyFor = (roomId: number) => `woori-schedules-v1-${roomId}`

export function loadSchedules(roomId: number): StoredSchedule[] {
  try {
    const raw = localStorage.getItem(keyFor(roomId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as StoredSchedule[]) : []
  } catch {
    return []
  }
}

export function saveSchedules(roomId: number, schedules: StoredSchedule[]) {
  try {
    localStorage.setItem(keyFor(roomId), JSON.stringify(schedules))
  } catch {
    // ignore
  }
}

export function clearSchedules(roomId: number) {
  try {
    localStorage.removeItem(keyFor(roomId))
  } catch {
    // ignore
  }
}
