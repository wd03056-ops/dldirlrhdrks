import { useEffect, useState } from 'react'

type CreateRoomModalProps = {
  isOpen: boolean
  onClose: () => void
  onComplete: (room: { name: string }) => void
}

export default function CreateRoomModal({
  isOpen,
  onClose,
  onComplete,
}: CreateRoomModalProps) {
  const [roomName, setRoomName] = useState('')

  useEffect(() => {
    if (isOpen) {
      setRoomName('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleComplete = () => {
    const name = roomName.trim()
    if (!name) return
    onComplete({ name })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-[2px] transition-opacity duration-300"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm space-y-5 rounded-[28px] border border-black/5 bg-white p-7 shadow-[0_16px_48px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div>
          <h2 className="text-lg font-bold tracking-tight text-black">
            모임의 이름을 정해주세요
          </h2>
          <p className="mt-1.5 text-xs text-neutral-500">
            나중에 초대 링크로 친구들을 초대할 수 있어요.
          </p>
        </div>
        <input
          type="text"
          className="w-full rounded-2xl border-0 bg-[#F7F6F3] px-4 py-4 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-black/10"
          placeholder="예) 가족, 친구"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border-0 bg-[#F7F6F3] py-3.5 text-sm font-semibold text-neutral-600 transition hover:bg-[#EFEDE8]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={!roomName.trim()}
            className="flex-1 rounded-2xl bg-black py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition hover:bg-neutral-800 disabled:opacity-40"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  )
}
