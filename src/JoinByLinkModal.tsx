import { useEffect, useState } from 'react'
import { extractRoomSlug, getRoomSlugFromLocation } from './utils/roomLinks'

type JoinByLinkModalProps = {
  isOpen: boolean
  onClose: () => void
  onJoin: (slug: string) => boolean | Promise<boolean>
}

export default function JoinByLinkModal({
  isOpen,
  onClose,
  onJoin,
}: JoinByLinkModalProps) {
  const [linkInput, setLinkInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLinkInput('')
    setError(null)
  }, [isOpen])

  if (!isOpen) return null

  const handleJoin = async () => {
    const slug = extractRoomSlug(linkInput) ?? getRoomSlugFromLocation()
    if (!slug) {
      setError('올바른 방 주소를 입력해 주세요.')
      return
    }

    const ok = await onJoin(slug)
    if (!ok) {
      setError('방을 찾을 수 없어요. 주소를 다시 확인해 주세요.')
      return
    }

    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-by-link-title"
      >
        <h2 id="join-by-link-title" className="text-lg font-bold text-black">
          주소로 참여하기
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          친구가 보낸 모임 주소를 붙여넣기 하세요.
        </p>

        <input
          type="text"
          value={linkInput}
          onChange={(e) => {
            setLinkInput(e.target.value)
            setError(null)
          }}
          placeholder="예: intoss://woori-secret-space/room/…"
          className="mt-5 w-full rounded-xl border-0 bg-[#F7F6F3] px-4 py-3.5 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-black/10"
        />

        {error ? (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        ) : null}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border-0 bg-neutral-100 py-3.5 text-sm font-semibold text-black"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={!linkInput.trim()}
            className="flex-1 rounded-xl bg-black py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-40"
          >
            참여하기
          </button>
        </div>
      </div>
    </div>
  )
}
