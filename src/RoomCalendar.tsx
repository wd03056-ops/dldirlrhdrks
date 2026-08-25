import { useEffect, useMemo, useState } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import './room-calendar.css'
import ScheduleModal from './ScheduleModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import { useAuth } from './context/AuthContext'
import { useToast } from './context/ToastContext'
import { notifyScheduleCreated } from './utils/scheduleNotifications'
import {
  addSchedule,
  confirmScheduleMember,
  deleteSchedule,
  subscribeSchedules,
  updateSchedule,
} from './services/scheduleService'
import type { Schedule } from './types/schedule'
import { resolveFirestoreRoomId } from './utils/firestoreRoomId'

type Memory = {
  id: number | string
  title: string
  date?: string
}

type Member = {
  id: number
  name: string
  userId?: string
}

type RoomCalendarProps = {
  roomId: number | string
  roomTitle: string
  categoryMemories: Memory[]
  members: Member[]
}

/** UI/캘린더용 일정 (Firestore + 이야기 날짜 병합) */
type CalendarSchedule = {
  id: string
  title: string
  memo: string
  startDate: string
  endDate: string
  confirmedMemberIds: string[]
  status: 'pending' | 'confirmed'
  source: 'firestore' | 'memory'
  createdBy?: string
}

function toDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatShortDate(dateKey: string) {
  const [, month, day] = dateKey.split('-')
  return `${Number(month)}.${Number(day)}`
}

function coversDateKey(schedule: CalendarSchedule, key: string) {
  return schedule.startDate <= key && key <= schedule.endDate
}

function overlapsRange(
  schedule: CalendarSchedule,
  startKey: string,
  endKey: string,
) {
  return schedule.startDate <= endKey && schedule.endDate >= startKey
}

function formatScheduleRange(schedule: CalendarSchedule) {
  if (schedule.startDate === schedule.endDate) {
    return formatShortDate(schedule.startDate)
  }
  return `${formatShortDate(schedule.startDate)} ~ ${formatShortDate(schedule.endDate)}`
}

function formatCardDateLabel(start: Date, end: Date | null) {
  const startLabel = `${start.getMonth() + 1}/${start.getDate()}`
  if (!end || toDateKey(start) === toDateKey(end)) {
    return `${startLabel} 일정`
  }
  return `${startLabel} ~ ${end.getMonth() + 1}/${end.getDate()} 일정`
}

function memberKey(member: Member) {
  return member.userId ?? String(member.id)
}

function toCalendarSchedule(schedule: Schedule): CalendarSchedule {
  return {
    id: schedule.id,
    title: schedule.title,
    memo: schedule.memo,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    confirmedMemberIds: schedule.confirmedMemberIds,
    status: schedule.status,
    source: 'firestore',
    createdBy: schedule.createdBy,
  }
}

export default function RoomCalendar({
  roomId,
  roomTitle,
  categoryMemories,
  members,
}: RoomCalendarProps) {
  const firestoreRoomId = resolveFirestoreRoomId(roomId)
  const { user } = useAuth()
  const { showToast } = useToast()
  const [value, setValue] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [scheduleModalMode, setScheduleModalMode] = useState<'create' | 'edit'>(
    'create',
  )
  const [editingSchedule, setEditingSchedule] =
    useState<CalendarSchedule | null>(null)
  const [deletingSchedule, setDeletingSchedule] =
    useState<CalendarSchedule | null>(null)
  const [firestoreSchedules, setFirestoreSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
  }, [firestoreRoomId])

  useEffect(() => {
    setIsLoading(true)
    const unsubscribe = subscribeSchedules(
      firestoreRoomId,
      (next) => {
        setFirestoreSchedules(next)
        setIsLoading(false)
      },
      (error) => {
        console.error(error)
        setIsLoading(false)
        showToast('일정을 불러오지 못했어요')
      },
    )
    return unsubscribe
  }, [firestoreRoomId, showToast])

  const currentMember = useMemo(() => {
    if (!user) return null
    return (
      members.find(
        (m) =>
          (m.userId && m.userId === user.id) ||
          (!m.userId && m.name === user.name),
      ) ?? null
    )
  }, [members, user])

  const currentMemberKey = currentMember
    ? memberKey(currentMember)
    : user?.id
      ? user.id
      : null

  const allMemberKeys = useMemo(
    () => members.map((m) => memberKey(m)),
    [members],
  )

  const memorySchedules = useMemo<CalendarSchedule[]>(
    () =>
      categoryMemories
        .filter((memory) => memory.date)
        .map((memory) => ({
          id: `memory-${memory.id}`,
          title: memory.title,
          memo: '',
          startDate: memory.date as string,
          endDate: memory.date as string,
          confirmedMemberIds: allMemberKeys,
          status: 'confirmed' as const,
          source: 'memory' as const,
        })),
    [categoryMemories, allMemberKeys],
  )

  const schedules = useMemo(
    () => [
      ...memorySchedules,
      ...firestoreSchedules.map(toCalendarSchedule),
    ],
    [memorySchedules, firestoreSchedules],
  )

  const confirmedSchedules = useMemo(
    () => schedules.filter((s) => s.status === 'confirmed'),
    [schedules],
  )

  const sideSchedules = useMemo(() => {
    if (!selectedDate || !rangeStart) return []
    const startKey = toDateKey(rangeStart)
    const endKey = toDateKey(rangeEnd ?? rangeStart)
    return schedules.filter((s) => overlapsRange(s, startKey, endKey))
  }, [schedules, selectedDate, rangeStart, rangeEnd])

  const handleDayClick = (date: Date) => {
    setValue(date)
    setSelectedDate(date)

    if (!rangeStart || rangeEnd) {
      setRangeStart(date)
      setRangeEnd(null)
      return
    }

    if (toDateKey(date) < toDateKey(rangeStart)) {
      setRangeEnd(rangeStart)
      setRangeStart(date)
    } else {
      setRangeEnd(date)
    }
  }

  const createStartDate = rangeStart ?? selectedDate ?? value
  const createEndDate = rangeEnd ?? rangeStart ?? selectedDate ?? value

  const rangeLabel = useMemo(() => {
    if (!rangeStart) return null
    const startKey = toDateKey(rangeStart)
    if (!rangeEnd) {
      return `${formatShortDate(startKey)} 시작 · 종료일을 눌러 주세요`
    }
    return `${formatShortDate(startKey)} ~ ${formatShortDate(toDateKey(rangeEnd))}`
  }, [rangeStart, rangeEnd])

  const handleConfirmCurrentUser = async (schedule: CalendarSchedule) => {
    if (schedule.source !== 'firestore') return
    if (!currentMemberKey) {
      showToast('로그인 후 확인할 수 있어요')
      return
    }

    try {
      await confirmScheduleMember(
        firestoreRoomId,
        schedule.id,
        currentMemberKey,
        allMemberKeys,
      )
      showToast(
        `${currentMember?.name ?? '나'}님이 확인했어요`,
      )
    } catch {
      showToast('확인에 실패했어요')
    }
  }

  const openCreateModal = () => {
    setScheduleModalMode('create')
    setEditingSchedule(null)
    if (!rangeStart) {
      setRangeStart(value)
      setRangeEnd(null)
      setSelectedDate(value)
    }
    setIsScheduleOpen(true)
  }

  const openEditModal = (schedule: CalendarSchedule) => {
    if (schedule.source !== 'firestore') return
    setScheduleModalMode('edit')
    setEditingSchedule(schedule)
    const start = parseDateKey(schedule.startDate)
    const end = parseDateKey(schedule.endDate)
    setSelectedDate(start)
    setRangeStart(start)
    setRangeEnd(end)
    setIsScheduleOpen(true)
  }

  const handleSave = async ({
    title,
    memo,
    startDate,
    endDate,
  }: {
    title: string
    memo: string
    startDate: Date
    endDate: Date
  }) => {
    const startDateKey = toDateKey(startDate)
    const endDateKey = toDateKey(endDate)
    const targetRoomId = resolveFirestoreRoomId(roomId)


    setIsSaving(true)

    try {
      if (scheduleModalMode === 'edit' && editingSchedule) {
        await updateSchedule(targetRoomId, editingSchedule.id, {
          title,
          memo,
          startDate: startDateKey,
          endDate: endDateKey,
          confirmedMemberIds: currentMemberKey ? [currentMemberKey] : [],
          status: 'pending',
        })
        showToast('일정을 수정했어요')
      } else {
        const creatorIds = currentMemberKey ? [currentMemberKey] : []
        const isAllConfirmed =
          allMemberKeys.length > 0 &&
          allMemberKeys.every((id) => creatorIds.includes(id))

        const scheduleId = await addSchedule(targetRoomId, {
          roomId: targetRoomId,
          title,
          memo,
          startDate: startDateKey,
          endDate: endDateKey,
          confirmedMemberIds: creatorIds,
          status: isAllConfirmed ? 'confirmed' : 'pending',
          createdBy: user?.id,
        })

        const notified = notifyScheduleCreated({
          roomId: Number(roomId) || 0,
          roomTitle,
          scheduleId,
          scheduleTitle: title,
          dateKey: startDateKey,
          members,
          excludeUserId: user?.id,
          excludeName: user?.name,
        })

        if (notified > 0) {
          showToast(`구성원 ${notified}명에게 알림을 보냈어요`)
        } else {
          showToast('일정을 추가했어요')
        }
      }

      setValue(startDate)
      setSelectedDate(startDate)
      setRangeStart(startDate)
      setRangeEnd(endDate)
      setIsScheduleOpen(false)
      setEditingSchedule(null)
      setScheduleModalMode('create')
    } catch (error) {
      console.error('[RoomCalendar] 일정 저장 실패', error)
      showToast('일정 저장에 실패했어요')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingSchedule || deletingSchedule.source !== 'firestore') return
    try {
      await deleteSchedule(firestoreRoomId, deletingSchedule.id)
      showToast('일정을 삭제했어요')
      setDeletingSchedule(null)
    } catch {
      showToast('일정 삭제에 실패했어요')
    }
  }

  return (
    <>
      <section className="flex flex-1 flex-col">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-black">일정</h2>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            시작일·종료일을 차례로 누른 뒤 일정을 추가하세요
          </p>
          {rangeLabel ? (
            <p className="mt-1.5 text-xs font-medium text-black">{rangeLabel}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <Calendar
              locale="ko-KR"
              value={rangeStart ?? value}
              onClickDay={handleDayClick}
              tileClassName={({ date, view }) => {
                if (view !== 'month') return null
                const key = toDateKey(date)
                const todayKey = toDateKey(new Date())
                const classes: string[] = []

                if (key === todayKey) classes.push('is-today')

                if (rangeStart) {
                  const startKey = toDateKey(rangeStart)
                  const endKey = rangeEnd ? toDateKey(rangeEnd) : startKey
                  if (key >= startKey && key <= endKey) {
                    classes.push('in-range')
                    if (key === startKey) classes.push('range-start')
                    if (key === endKey) classes.push('range-end')
                  }
                }

                const hasSchedule = confirmedSchedules.some((s) =>
                  coversDateKey(s, key),
                )
                if (hasSchedule) classes.push('has-schedule')

                return classes.length > 0 ? classes.join(' ') : null
              }}
              tileContent={({ date, view }) => {
                if (view !== 'month') return null
                if (toDateKey(date) !== toDateKey(new Date())) return null
                return <span className="today-label">오늘</span>
              }}
              formatDay={(_locale, date) => String(date.getDate())}
              calendarType="gregory"
              prev2Label={null}
              next2Label={null}
              className="room-calendar"
            />
          </div>

          {selectedDate ? (
            <div className="flex flex-col rounded-2xl border border-black/5 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="mb-3 flex items-center gap-2">
                <p className="min-w-0 flex-1 text-xs font-semibold text-neutral-500">
                  {rangeStart
                    ? formatCardDateLabel(rangeStart, rangeEnd)
                    : `${selectedDate.getMonth() + 1}/${selectedDate.getDate()} 일정`}
                </p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  disabled={isSaving}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-black px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-50"
                  aria-label="일정 추가"
                >
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  일정 추가
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 text-[11px] font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-black"
                  aria-label="일정 목록 축소"
                >
                  축소
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
              </div>

              {isLoading ? (
                <p className="text-xs leading-relaxed text-neutral-400">
                  일정을 불러오는 중…
                </p>
              ) : sideSchedules.length === 0 ? (
                <p className="text-xs leading-relaxed text-neutral-400">
                  {rangeStart &&
                  rangeEnd &&
                  toDateKey(rangeStart) !== toDateKey(rangeEnd)
                    ? '이 기간에 일정이 없어요.'
                    : '이 날짜에 일정이 없어요.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sideSchedules.map((schedule) => {
                    const confirmedMembers = members.filter((m) =>
                      schedule.confirmedMemberIds.includes(memberKey(m)),
                    )
                    const isPending = schedule.status === 'pending'
                    const canManage = schedule.source === 'firestore'
                    const alreadyConfirmed =
                      currentMemberKey != null &&
                      schedule.confirmedMemberIds.includes(currentMemberKey)

                    return (
                      <li
                        key={schedule.id}
                        className="rounded-xl border border-black/5 bg-[#F7F6F3] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-black">
                              {schedule.title}
                            </p>
                            {schedule.memo ? (
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">
                                {schedule.memo}
                              </p>
                            ) : null}
                          </div>
                          {confirmedMembers.length > 0 ? (
                            <div className="flex max-w-[45%] flex-wrap justify-end gap-1">
                              {confirmedMembers.map((member) => (
                                <span
                                  key={memberKey(member)}
                                  className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800"
                                >
                                  {member.name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <p className="mt-1 text-[11px] text-neutral-400">
                          {formatScheduleRange(schedule)}
                        </p>

                        {canManage ? (
                          <div className="mt-2 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(schedule)}
                              className="flex-1 rounded-lg border border-neutral-300 py-1.5 text-[11px] text-neutral-600 hover:border-black hover:text-black"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingSchedule(schedule)}
                              className="flex-1 rounded-lg border border-neutral-300 py-1.5 text-[11px] text-neutral-600 hover:border-black hover:text-black"
                            >
                              삭제
                            </button>
                          </div>
                        ) : null}

                        {isPending ? (
                          <>
                            <p className="mt-2 text-[11px] font-medium text-neutral-500">
                              확인 {confirmedMembers.length}/{members.length}
                            </p>
                            {!alreadyConfirmed ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleConfirmCurrentUser(schedule)
                                }
                                className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white py-2 text-[11px] font-medium text-neutral-700 transition hover:border-black hover:text-black"
                              >
                                확인
                              </button>
                            ) : (
                              <p className="mt-1.5 text-[10px] text-neutral-400">
                                이미 확인했어요 · 전원 확인 후 확정
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mt-2 text-[11px] font-medium text-black">
                            확정됨
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <ScheduleModal
        isOpen={isScheduleOpen}
        date={
          scheduleModalMode === 'edit' && editingSchedule
            ? parseDateKey(editingSchedule.startDate)
            : createStartDate
        }
        mode={scheduleModalMode}
        initialTitle={editingSchedule?.title ?? ''}
        initialMemo={editingSchedule?.memo ?? ''}
        initialStartDate={
          editingSchedule
            ? parseDateKey(editingSchedule.startDate)
            : createStartDate
        }
        initialEndDate={
          editingSchedule
            ? parseDateKey(editingSchedule.endDate)
            : createEndDate
        }
        onClose={() => {
          if (isSaving) return
          setIsScheduleOpen(false)
          setEditingSchedule(null)
          setScheduleModalMode('create')
        }}
        onSave={handleSave}
      />

      <DeleteConfirmModal
        isOpen={deletingSchedule !== null}
        title={deletingSchedule?.title ?? ''}
        onClose={() => setDeletingSchedule(null)}
        onConfirm={() => {
          void handleDelete()
        }}
      />
    </>
  )
}
