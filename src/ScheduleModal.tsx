import { useEffect, useState } from 'react'

type ScheduleModalProps = {
  isOpen: boolean
  /** 달력에서 누른 날짜 — 시작일 기본값 */
  date: Date | null
  mode?: 'create' | 'edit'
  initialTitle?: string
  initialMemo?: string
  initialStartDate?: Date | null
  initialEndDate?: Date | null
  onClose: () => void
  onSave: (schedule: {
    title: string
    memo: string
    startDate: Date
    endDate: Date
  }) => void
}

function toInputValue(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseInputValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatDateLabel(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

function formatRangeLabel(start: Date, end: Date) {
  if (toInputValue(start) === toInputValue(end)) {
    return formatDateLabel(start)
  }
  return `${formatDateLabel(start)} ~ ${formatDateLabel(end)}`
}

export default function ScheduleModal({
  isOpen,
  date,
  mode = 'create',
  initialTitle = '',
  initialMemo = '',
  initialStartDate = null,
  initialEndDate = null,
  onClose,
  onSave,
}: ScheduleModalProps) {
  const [title, setTitle] = useState(initialTitle)
  const [memo, setMemo] = useState(initialMemo)
  const [startValue, setStartValue] = useState('')
  const [endValue, setEndValue] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setTitle(initialTitle)
    setMemo(initialMemo)
    const start = initialStartDate ?? date
    const end = initialEndDate ?? initialStartDate ?? date
    if (start) setStartValue(toInputValue(start))
    if (end) setEndValue(toInputValue(end))
  }, [
    isOpen,
    initialTitle,
    initialMemo,
    initialStartDate,
    initialEndDate,
    date,
  ])

  if (!isOpen || !date) return null

  const startDate = parseInputValue(startValue)
  const endDate = parseInputValue(endValue)
  const rangeValid =
    startDate != null &&
    endDate != null &&
    toInputValue(endDate) >= toInputValue(startDate)

  const handleSave = () => {
    if (!title.trim() || !startDate || !endDate || !rangeValid) return
    onSave({
      title: title.trim(),
      memo: memo.trim(),
      startDate,
      endDate,
    })
    setTitle('')
    setMemo('')
  }

  const handleClose = () => {
    setTitle('')
    setMemo('')
    onClose()
  }

  const handleStartChange = (next: string) => {
    setStartValue(next)
    if (endValue && endValue < next) {
      setEndValue(next)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div>
          <h2 className="text-lg font-bold text-black">
            {mode === 'edit' ? '일정 수정' : '일정 추가'}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {startDate && endDate && rangeValid
              ? formatRangeLabel(startDate, endDate)
              : '기간을 선택해 주세요'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium text-neutral-500">
              시작일
            </span>
            <input
              type="date"
              value={startValue}
              onChange={(e) => handleStartChange(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-sm text-black focus:border-black focus:outline-none"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[11px] font-medium text-neutral-500">
              종료일
            </span>
            <input
              type="date"
              value={endValue}
              min={startValue || undefined}
              onChange={(e) => setEndValue(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-sm text-black focus:border-black focus:outline-none"
            />
          </label>
        </div>

        <input
          type="text"
          className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-4 text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none"
          placeholder="일정 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <textarea
          className="h-24 w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 p-4 text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none"
          placeholder="메모 (선택)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl border border-neutral-300 bg-neutral-50 py-3.5 text-sm font-medium text-neutral-600"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || !rangeValid}
            className="flex-1 rounded-xl border border-black bg-white py-3.5 text-sm font-medium text-black disabled:opacity-40"
          >
            {mode === 'edit' ? '수정 완료' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

