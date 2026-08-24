import { useCallback, useEffect, useState } from 'react'
import CopyRoomLinkModal from './CopyRoomLinkModal'
import CreateRoomModal from './CreateRoomModal'
import FloatingDock from './FloatingDock'
import JoinByLinkModal from './JoinByLinkModal'
import OnboardingGuide, { markOnboardingSeen } from './OnboardingGuide'
import RoomCoverPlaceholder from './components/RoomCoverPlaceholder'
import RoomDetail from './RoomDetail'
import StoryModal from './StoryModal'
import { useAuth } from './context/AuthContext'
import { useRegisterBackHandler } from './context/AppsInTossNavigationContext'
import { useToast } from './context/ToastContext'
import { useLongPress } from './hooks/useLongPress'
import type { Room } from './types/room'
import {
  buildInviteShareLink,
  copyTextToClipboard,
  createRoomSlug,
  getRoomSlugFromLocation,
  replaceRoomLocation,
  setRoomLocation,
} from './utils/roomLinks'
import {
  findRoomBySlug,
  getRoomCoverPhoto,
  loadStoredRooms,
  normalizeStoredRoom,
  saveStoredRooms,
  upsertRoom,
  withRoomSlug,
} from './utils/roomStorage'
import {
  createRoomMember,
  isRoomMember,
  leaveRoom,
} from './utils/roomMembers'

type Tab = 'home' | 'profile'

function bootstrapRooms() {
  const stored = loadStoredRooms()
  if (stored.length > 0) return stored
  saveStoredRooms([])
  return []
}

function joinRoomWithUser(room: Room, user: { id: string; name: string }) {
  if (isRoomMember(room, user)) return room

  const nextMember = createRoomMember(user)

  return {
    ...room,
    members: room.members + 1,
    memberList: [...room.memberList, nextMember],
    // 초대 참여 시 방 대표 사진은 건드리지 않음
    coverPhoto: room.coverPhoto ?? null,
    lastPhoto: null,
  }
}

function RoomCard({
  room,
  leaveMode = false,
  onOpen,
  onEdit,
  onLeave,
}: {
  room: Room
  leaveMode?: boolean
  onOpen: () => void
  onEdit: () => void
  onLeave?: () => void
}) {
  const coverPhoto = getRoomCoverPhoto(room)
  const pressHandlers = useLongPress(onEdit, onOpen)

  if (leaveMode) {
    return (
      <button
        type="button"
        onClick={onLeave}
        className="group flex flex-col text-left"
      >
        <div className="relative flex aspect-[5/4] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[22px] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.1)] ring-1 ring-black/5 transition group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
          {coverPhoto ? (
            <img
              src={coverPhoto}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <RoomCoverPlaceholder className="absolute inset-0 h-full w-full" />
          )}
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative z-10 flex flex-col items-center px-3 text-center">
            <p className="text-base font-bold tracking-tight text-white">
              나가기
            </p>
            <p className="mt-1 line-clamp-1 text-[11px] text-white/85">
              {room.title}
            </p>
          </div>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      {...pressHandlers}
      className="group flex flex-col text-left"
    >
      <div className="relative flex aspect-[5/4] w-full cursor-pointer items-end overflow-hidden rounded-[22px] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.1)] ring-1 ring-black/5 transition group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={room.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <RoomCoverPlaceholder className="absolute inset-0 h-full w-full" />
        )}
        <div className="relative z-10 w-full px-3 pt-10 pb-3">
          <h3
            className={`line-clamp-2 text-sm font-bold ${
              coverPhoto
                ? 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]'
                : 'text-black'
            }`}
          >
            {room.title}
          </h3>
          <p
            className={`mt-0.5 text-[10px] ${
              coverPhoto
                ? 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]'
                : 'text-neutral-500'
            }`}
          >
            구성원 {room.members}명
          </p>
        </div>
      </div>
    </button>
  )
}

export default function AppHome() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>('home')
  const [rooms, setRooms] = useState<Room[]>(() => bootstrapRooms())
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCenterMenuOpen, setIsCenterMenuOpen] = useState(false)
  const [isJoinByLinkOpen, setIsJoinByLinkOpen] = useState(false)
  const [isCopyLinkOpen, setIsCopyLinkOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [isRoomEditOpen, setIsRoomEditOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [isLeaveMode, setIsLeaveMode] = useState(false)

  // 진입 시 자동 바텀시트/모달 금지 (비게임 UX 가이드)
  // 도움말은 사용자가 탭했을 때만 연다.

  const persistRooms = useCallback((nextRooms: Room[]) => {
    const normalized = nextRooms.map((room) => normalizeStoredRoom(room))
    setRooms(normalized)
    saveStoredRooms(normalized)
    return normalized
  }, [])

  const openRoom = useCallback(
    (room: Room, options?: { replace?: boolean }) => {
      setSelectedRoomId(room.id)
      setTab('home')
      if (options?.replace) {
        replaceRoomLocation(room.slug)
      } else {
        setRoomLocation(room.slug)
      }
    },
    [],
  )

  const enterRoomFromSlug = useCallback(
    (slug: string, options?: { replace?: boolean; silent?: boolean }) => {
      const room = findRoomBySlug(rooms, slug)
      if (!room) {
        if (!options?.silent) {
          showToast('방을 찾을 수 없어요.')
        }
        replaceRoomLocation(null)
        setSelectedRoomId(null)
        return false
      }

      const joinedRoom = user ? joinRoomWithUser(room, user) : room
      const nextRooms = persistRooms(upsertRoom(rooms, joinedRoom))
      const latestRoom =
        nextRooms.find((item) => item.id === joinedRoom.id) ?? joinedRoom

      openRoom(latestRoom, { replace: options?.replace })
      return true
    },
    [openRoom, persistRooms, rooms, showToast, user],
  )

  useEffect(() => {
    const slug = getRoomSlugFromLocation()
    if (slug) {
      enterRoomFromSlug(slug, { replace: true, silent: true })
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const slug = getRoomSlugFromLocation()
      if (!slug) {
        setSelectedRoomId(null)
        return
      }

      enterRoomFromSlug(slug, { replace: true, silent: true })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [enterRoomFromSlug])

  const currentRoom = rooms.find((room) => room.id === selectedRoomId)

  useRegisterBackHandler(() => {
    if (isOnboardingOpen) {
      setIsOnboardingOpen(false)
      return true
    }
    if (isCopyLinkOpen) {
      setIsCopyLinkOpen(false)
      return true
    }
    if (isJoinByLinkOpen) {
      setIsJoinByLinkOpen(false)
      return true
    }
    if (isRoomEditOpen) {
      setIsRoomEditOpen(false)
      setEditingRoom(null)
      return true
    }
    if (isModalOpen) {
      setIsModalOpen(false)
      return true
    }
    if (isCenterMenuOpen) {
      setIsCenterMenuOpen(false)
      return true
    }
    if (isLeaveMode) {
      setIsLeaveMode(false)
      return true
    }
    if (selectedRoomId !== null) {
      setSelectedRoomId(null)
      replaceRoomLocation(null)
      return true
    }
    return false
  })

  const myRooms = user
    ? rooms.filter((room) => isRoomMember(room, user))
    : []

  const handleLeaveRoom = (room: Room) => {
    if (!user) return

    const confirmed = window.confirm(
      `‘${room.title}’ 모임에서 나갈까요?\n모임과 글은 그대로 남아 다른 구성원이 계속 쓸 수 있어요.`,
    )
    if (!confirmed) return

    const nextRoom = leaveRoom(room, user)
    persistRooms(
      rooms.map((item) => (item.id === room.id ? nextRoom : item)),
    )
    showToast('모임에서 나갔어요. 모임은 그대로 유지돼요.')

    setSelectedRoomId(null)
    replaceRoomLocation(null)
    setIsLeaveMode(false)
  }

  const handleComplete = (room: { name: string; inviteMsg: string }) => {
    const roomId = Date.now()
    const newRoom: Room = withRoomSlug({
      id: roomId,
      title: room.name,
      members: 1,
      memberList: [createRoomMember({ id: user?.id ?? 'local', name: user?.name ?? '나' })],
      lastPhoto: null,
      coverPhoto: null,
      inviteMsg: room.inviteMsg,
    })

    persistRooms([newRoom, ...rooms])
    setIsModalOpen(false)
    openRoom(newRoom)
  }

  const closeOnboarding = () => {
    markOnboardingSeen()
    setIsOnboardingOpen(false)
  }

  if (selectedRoomId !== null && currentRoom) {
    return (
      <>
        <RoomDetail
          room={currentRoom}
          onBack={() => {
            setSelectedRoomId(null)
            replaceRoomLocation(null)
          }}
          onLeaveRoom={() => handleLeaveRoom(currentRoom)}
        />
        <OnboardingGuide isOpen={isOnboardingOpen} onClose={closeOnboarding} />
      </>
    )
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-white font-sans text-black">
      <main className="flex flex-1 flex-col px-6 pb-28">
        {tab === 'home' ? (
          <>
            <div className="mt-8 mb-6 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-sm text-neutral-500">
                  안녕하세요, {user?.name}님
                </p>
                <h1 className="mb-1 text-xl font-bold text-black">
                  우리들의 공간
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setIsOnboardingOpen(true)}
                className="mt-1 shrink-0 rounded-full border-0 bg-white px-3 py-1.5 text-[11px] font-semibold text-black shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)]"
                aria-label="도움말"
              >
                도움말
              </button>
            </div>

            <div className="mb-4 flex flex-1 flex-col">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="shrink-0 text-lg font-semibold text-black">
                    모임
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCopyLinkOpen(true)}
                    disabled={myRooms.length === 0 || isLeaveMode}
                    className="shrink-0 rounded-full border-0 bg-white px-3 py-1.5 text-[11px] font-semibold text-black shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] disabled:opacity-40"
                  >
                    초대 주소 복사
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLeaveMode((prev) => !prev)}
                    disabled={myRooms.length === 0}
                    className={`shrink-0 rounded-full border-0 px-3 py-1.5 text-[11px] font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition disabled:opacity-40 ${
                      isLeaveMode
                        ? 'bg-black text-white'
                        : 'bg-white text-black hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)]'
                    }`}
                  >
                    {isLeaveMode ? '취소' : '모임 나가기'}
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-black shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                    {myRooms.length}개
                  </span>
                </div>
              </div>

              {isLeaveMode && myRooms.length > 0 ? (
                <p className="mb-3 text-xs text-neutral-500">
                  나갈 모임을 눌러 주세요. 만든 모임이어도 글과 모임은 유지돼요.
                </p>
              ) : null}

              {myRooms.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                  <p className="text-[15px] font-medium text-neutral-500">
                    + 눌러 시작해주세요.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {myRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      leaveMode={isLeaveMode}
                      onOpen={() => openRoom(room)}
                      onEdit={() => {
                        setEditingRoom(room)
                        setIsRoomEditOpen(true)
                      }}
                      onLeave={() => handleLeaveRoom(room)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col pt-8">
            <h2 className="mb-1 text-lg font-bold text-black">내 정보</h2>
            <p className="mb-6 text-sm text-neutral-500">
              로그인한 프로필이 글·댓글 작성에 사용돼요.
            </p>
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <p className="mb-1 text-xs text-neutral-400">닉네임</p>
              <p className="mb-4 text-base font-semibold text-black">
                {user?.name}
              </p>
              <p className="mb-1 text-xs text-neutral-400">고유 ID</p>
              <p className="break-all text-xs text-neutral-600">{user?.id}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="mt-3 rounded-xl border-0 bg-white py-3.5 text-sm font-semibold text-black shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)]"
            >
              앱 사용 설명서
            </button>
            <button
              type="button"
              onClick={logout}
              className="mt-3 rounded-xl border-0 bg-white py-3.5 text-sm font-semibold text-black shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)]"
            >
              로그아웃
            </button>
          </div>
        )}
      </main>

      <FloatingDock
        tab={tab}
        onTabChange={setTab}
        isMenuOpen={isCenterMenuOpen}
        onToggleMenu={() => setIsCenterMenuOpen((prev) => !prev)}
        onCreateRoom={() => {
          setIsCenterMenuOpen(false)
          setIsModalOpen(true)
        }}
        onJoinByLink={() => {
          setIsCenterMenuOpen(false)
          setIsJoinByLinkOpen(true)
        }}
      />

      <OnboardingGuide isOpen={isOnboardingOpen} onClose={closeOnboarding} />

      <CreateRoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onComplete={handleComplete}
      />

      <JoinByLinkModal
        isOpen={isJoinByLinkOpen}
        onClose={() => setIsJoinByLinkOpen(false)}
        onJoin={(slug) => enterRoomFromSlug(slug)}
      />

      <CopyRoomLinkModal
        isOpen={isCopyLinkOpen}
        rooms={myRooms}
        onClose={() => setIsCopyLinkOpen(false)}
        onSelect={(room) => {
          void (async () => {
            const slug = room.slug ?? createRoomSlug()
            const link = await buildInviteShareLink(slug)
            await copyTextToClipboard(link)
            setIsCopyLinkOpen(false)
            showToast('초대 주소를 복사했어요')
          })()
        }}
      />

      <StoryModal
        isOpen={isRoomEditOpen}
        mode="edit"
        variant="room"
        initialTitle={editingRoom?.title ?? ''}
        initialPhoto={editingRoom ? getRoomCoverPhoto(editingRoom) : null}
        initialPhotos={
          editingRoom && getRoomCoverPhoto(editingRoom)
            ? [getRoomCoverPhoto(editingRoom)!]
            : []
        }
        onClose={() => {
          setIsRoomEditOpen(false)
          setEditingRoom(null)
        }}
        onSave={({ title, lastPhoto }) => {
          if (!editingRoom) return
          persistRooms(
            rooms.map((room) =>
              room.id === editingRoom.id
                ? withRoomSlug({
                    ...room,
                    title,
                    lastPhoto: null,
                    coverPhoto: lastPhoto,
                    // 방 주소(ID)는 제목 수정과 무관하게 유지
                    slug: room.slug,
                  })
                : room,
            ),
          )
          setIsRoomEditOpen(false)
          setEditingRoom(null)
          showToast('모임이 수정되었어요.')
        }}
        onUploadError={(message) => showToast(message)}
      />
    </div>
  )
}
