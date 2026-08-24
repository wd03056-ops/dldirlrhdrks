import { useEffect, useState } from 'react'

type CreateRoomModalProps = {
  isOpen: boolean
  onClose: () => void
  onComplete: (room: { name: string; inviteMsg: string }) => void
}

export default function CreateRoomModal({
  isOpen,
  onClose,
  onComplete,
}: CreateRoomModalProps) {
  const [step, setStep] = useState(1)
  const [roomName, setRoomName] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setRoomName('')
      setInviteMsg('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleComplete = () => {
    onComplete({ name: roomName.trim(), inviteMsg: inviteMsg.trim() })
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
        {step === 1 && (
          <>
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
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!roomName.trim()}
              className="w-full rounded-2xl bg-black py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition hover:bg-neutral-800 disabled:opacity-40"
            >
              다음
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-black">
                친구들에게 보낼 초대문구를 정해주세요
              </h2>
              <p className="mt-1.5 text-xs text-neutral-500">
                초대할 때 함께 보여줄 짧은 문구예요.
              </p>
            </div>
            <input
              type="text"
              className="w-full rounded-2xl border-0 bg-[#F7F6F3] px-4 py-4 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-black/10"
              placeholder="예: 우리들의 추억을 기록하자! 📸"
              value={inviteMsg}
              onChange={(e) => setInviteMsg(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-2xl border-0 bg-[#F7F6F3] py-3.5 text-sm font-semibold text-neutral-600 transition hover:bg-[#EFEDE8]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={!inviteMsg.trim()}
                className="flex-1 rounded-2xl bg-black py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition hover:bg-neutral-800 disabled:opacity-40"
              >
                완료
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
