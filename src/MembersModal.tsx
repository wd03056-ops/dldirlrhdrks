type Member = {
  id: number
  name: string
  userId?: string
}

type MembersModalProps = {
  isOpen: boolean
  roomTitle: string
  members: Member[]
  onClose: () => void
  onLeaveRoom?: () => void
}

export default function MembersModal({
  isOpen,
  roomTitle,
  members,
  onClose,
  onLeaveRoom,
}: MembersModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-[2px]"
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
          <h2 className="text-lg font-bold tracking-tight text-black">구성원</h2>
          <p className="mt-1.5 text-xs text-neutral-500">
            {roomTitle} · {members.length}명 · 모두 동등한 멤버예요
          </p>
        </div>

        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[#F7F6F3] px-4 py-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
                {member.name.slice(0, 1)}
              </span>
              <div>
                <p className="text-sm font-semibold text-black">{member.name}</p>
                <p className="text-xs text-neutral-400">구성원</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2.5">
          {onLeaveRoom ? (
            <button
              type="button"
              onClick={onLeaveRoom}
              className="w-full rounded-2xl border-0 bg-[#F7F6F3] py-3.5 text-sm font-semibold text-neutral-600 transition hover:bg-[#EFEDE8]"
            >
              모임 나가기
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-black py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition hover:bg-neutral-800"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
