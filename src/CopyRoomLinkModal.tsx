import type { Room } from './types/room'
import RoomCoverPlaceholder from './components/RoomCoverPlaceholder'
import { getRoomCoverPhoto } from './utils/roomStorage'

type CopyRoomLinkModalProps = {
  isOpen: boolean
  rooms: Room[]
  onClose: () => void
  onSelect: (room: Room) => void
}

export default function CopyRoomLinkModal({
  isOpen,
  rooms,
  onClose,
  onSelect,
}: CopyRoomLinkModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-room-link-title"
      >
        <h2
          id="copy-room-link-title"
          className="text-lg font-bold text-black"
        >
          초대 주소 복사
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          지인에게 보낼 모임을 선택해 주세요.
        </p>

        {rooms.length === 0 ? (
          <p className="mt-8 mb-4 text-center text-sm text-neutral-500">
            아직 복사할 모임이 없어요.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => onSelect(room)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 text-left shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)]"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                    {getRoomCoverPhoto(room) ? (
                      <img
                        src={getRoomCoverPhoto(room)!}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <RoomCoverPlaceholder className="h-full w-full" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-black">
                      {room.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">
                      구성원 {room.members}명
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-neutral-500">
                    복사
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl border-0 bg-white py-3.5 text-sm font-semibold text-black shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)]"
        >
          닫기
        </button>
      </div>
    </div>
  )
}
