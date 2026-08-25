import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MembersModal from './MembersModal'
import StoryWriteModal, { type StoryDraftEntry } from './StoryWriteModal'
import { useLongPress } from './hooks/useLongPress'
import type { Room } from './types/room'
import type { DisplayMemory } from './types/displayMemory'
import type { Story, StorySlide } from './types/story'
import {
  addStory,
  appendStorySlides,
  deleteStory,
  getStoriesPage,
  STORIES_PAGE_SIZE,
  storiesToDisplayMemories,
  updateStory,
} from './services/storyService'
import { resolveRemotePhotoUrls } from './services/storageService'
import {
  createRoomInFirestore,
  getRoomMeta,
  joinRoomInFirestore,
  subscribeRoomMembers,
} from './services/roomService'
import {
  ensureFirebaseAuth,
  formatFirebaseAuthError,
  getFirebaseCurrentUser,
  isValidFirebaseSession,
  syncFirebaseAuthForAppUser,
} from './services/firebase'
import { useAuth } from './context/AuthContext'
import { useRegisterBackHandler } from './context/AppsInTossNavigationContext'
import { useToast } from './context/ToastContext'
import { isInTossApp } from './services/tossAuth'
import {
  getUnreadScheduleNotifications,
  markRoomScheduleNotificationsRead,
} from './utils/scheduleNotifications'
import { resolveFirestoreRoomId } from './utils/firestoreRoomId'
import type { AuthUser } from './types/auth'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'

type Memory = DisplayMemory

type StoryWriteMode = 'create' | 'edit' | 'append'

type RoomDetailProps = {
  room: Room
  onBack: () => void
  onLeaveRoom: () => void
  onMembersChange?: (members: Room['memberList']) => void
}

function formatStoryDate(date?: string) {
  if (!date) return null
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return date
  return `${year}.${month}.${day}`
}

function resolveSlides(memory: Memory): StorySlide[] {
  if (memory.slides && memory.slides.length > 0) return memory.slides

  const photos =
    memory.photos && memory.photos.length > 0
      ? memory.photos
      : memory.lastPhoto
        ? [memory.lastPhoto]
        : []

  if (photos.length === 0) {
    if (!(memory.content ?? '').trim()) return []
    return [
      {
        id: `${memory.id}-text`,
        url: null,
        text: memory.content ?? '',
        authorId: memory.authorId,
        authorName: memory.author,
      },
    ]
  }

  return photos.map((url, index) => ({
    id: `${memory.id}-${index}`,
    url,
    text: index === 0 ? (memory.content ?? '') : '',
    authorId: memory.authorId,
    authorName: memory.author,
  }))
}

function isOwnStory(memory: Memory, user: AuthUser) {
  if (memory.authorId) return memory.authorId === user.id
  if (memory.author) return memory.author === user.name
  return true
}

type Comment = {
  id: number
  author: string
  authorId?: string
  text: string
  date: string
}

function formatCommentDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}.${day}`
}

function getStoryCommentsKey(storyId: string) {
  return `story-comments-v1-${storyId}`
}

function loadStoryComments(storyId: string): Comment[] {
  try {
    const raw = localStorage.getItem(getStoryCommentsKey(storyId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as Comment[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveStoryComments(storyId: string, comments: Comment[]) {
  try {
    localStorage.setItem(getStoryCommentsKey(storyId), JSON.stringify(comments))
  } catch {
    // ignore
  }
}

function StoryPhotoCarousel({
  slides,
  fallbackAuthor,
  onLongPressAdd,
  onIndexChange,
}: {
  slides: StorySlide[]
  fallbackAuthor?: string
  onLongPressAdd: () => void
  onIndexChange?: (index: number) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const pressHandlers = useLongPress(onLongPressAdd, undefined, 600)

  useEffect(() => {
    setActiveIndex(0)
    onIndexChange?.(0)
    scrollerRef.current?.scrollTo({ left: 0 })
  }, [slides, onIndexChange])

  const updateIndex = (next: number) => {
    const clamped = Math.max(0, Math.min(next, Math.max(slides.length - 1, 0)))
    setActiveIndex(clamped)
    onIndexChange?.(clamped)
  }

  if (slides.length === 0) {
    return (
      <div
        {...pressHandlers}
        className="relative flex aspect-[4/5] w-full items-center justify-center bg-[#F7F6F3] select-none"
      >
        <p className="text-xs text-neutral-400">길게 눌러 사진/글을 추가하세요</p>
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F7F6F3]">
      <div
        ref={scrollerRef}
        {...pressHandlers}
        className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto scrollbar-hide select-none"
        onScroll={(e) => {
          const el = e.currentTarget
          if (el.clientWidth === 0) return
          updateIndex(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {slides.map((slide, index) => {
          const authorLabel = slide.authorName || fallbackAuthor || '익명'
          return (
            <div
              key={slide.id}
              className="relative h-full w-full min-w-full shrink-0 snap-center overflow-hidden leading-[0]"
            >
              {slide.url ? (
                <img
                  src={slide.url}
                  alt={`사진 ${index + 1}`}
                  className="block h-full w-full object-cover object-center"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#F7F6F3] px-6">
                  <p className="line-clamp-6 text-center text-sm leading-relaxed text-neutral-600">
                    {slide.text || '글만 남긴 슬라이드'}
                  </p>
                </div>
              )}
              <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[70%] rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-[2px]">
                <span className="block truncate text-[11px] font-medium text-white">
                  {authorLabel}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {slides.length > 1 ? (
        <div className="pointer-events-none absolute top-3 right-3 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white">
          {activeIndex + 1} / {slides.length}
        </div>
      ) : null}

      {slides.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
          {slides.map((slide, index) => (
            <span
              key={`dot-${slide.id}`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StoryFeedCard({
  memory,
  user,
  onEdit,
  onDelete,
  onRequestAppend,
}: {
  memory: Memory
  user: AuthUser
  onEdit: () => void
  onDelete: () => void
  onRequestAppend: () => void
}) {
  const slides = useMemo(() => resolveSlides(memory), [memory])
  const title = memory.title.trim()
  const mainContent = (memory.content ?? '').trim()
  const dateLabel = formatStoryDate(memory.date)
  const authorName = memory.author ?? user.name
  const isOwn = isOwnStory(memory, user)
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [comments, setComments] = useState<Comment[]>(() =>
    loadStoryComments(memory.id),
  )
  const [inputComment, setInputComment] = useState('')

  useEffect(() => {
    setComments(loadStoryComments(memory.id))
    setInputComment('')
    setActiveSlideIndex(0)
  }, [memory.id])

  const currentSlide = slides[activeSlideIndex]
  const slideTitle = (currentSlide?.title ?? '').trim()
  const slideText = (currentSlide?.text ?? '').trim()
  const displayTitle = slideTitle || title
  const displayContent = slideText || (!slideTitle ? mainContent : '')
  const displayAuthor =
    currentSlide?.authorName?.trim() || authorName

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputComment.trim()) return

    const nextComment: Comment = {
      id: Date.now(),
      author: user.name,
      authorId: user.id,
      text: inputComment.trim(),
      date: formatCommentDate(new Date()),
    }
    const nextComments = [...comments, nextComment]
    setComments(nextComments)
    saveStoryComments(memory.id, nextComments)
    setInputComment('')
  }

  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
      <div className="flex min-h-[72px] flex-col items-center justify-center gap-1 border-b border-black/5 px-5 py-4 text-center">
        {displayTitle ? (
          <h2 className="w-full text-base font-bold tracking-tight text-[#1A1A1A]">
            {displayTitle}
          </h2>
        ) : (
          <h2 className="w-full text-base font-bold tracking-tight text-neutral-400">
            제목 없음
          </h2>
        )}
        {dateLabel ? (
          <p className="w-full text-[11px] text-[#A8A8A2]">{dateLabel}</p>
        ) : null}
      </div>

      <StoryPhotoCarousel
        slides={slides}
        fallbackAuthor={authorName}
        onLongPressAdd={onRequestAppend}
        onIndexChange={setActiveSlideIndex}
      />

      <div className="px-5 py-5">
        <div className="flex items-center justify-center gap-2">
          <span className="max-w-[140px] truncate text-sm font-semibold text-black">
            {displayAuthor}
          </span>
          {isOwn ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="shrink-0 text-xs font-semibold text-[#555552] underline decoration-[#A8C8A0] decoration-2 underline-offset-2 transition hover:text-black"
              >
                글 수정
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="shrink-0 text-xs font-semibold text-[#B85C5C] underline decoration-[#E8C4C4] decoration-2 underline-offset-2 transition hover:text-[#8A3A3A]"
              >
                글 삭제
              </button>
            </>
          ) : null}
        </div>

        {displayContent ? (
          <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.75] tracking-[-0.01em] text-[#1A1A1A]">
            {displayContent}
          </p>
        ) : null}

        <div className="mt-5 border-t border-black/5 pt-4">
          <h3 className="text-xs font-bold tracking-wider text-black uppercase">
            대화 ({comments.length})
          </h3>

          <div className="mt-3 flex flex-col gap-2.5">
            {comments.length === 0 ? (
              <p className="text-xs text-neutral-400">
                아직 댓글이 없어요. 첫 대화를 남겨 보세요.
              </p>
            ) : (
              comments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-[#F7F6F3] px-3.5 py-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#333331]">
                      {item.author}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#A8A8A2]">
                      {item.date}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#1A1A1A]">
                    {item.text}
                  </p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleAddComment}
            className="mt-3 flex items-center gap-1.5 rounded-full border border-black/5 bg-white p-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
          >
            <input
              type="text"
              value={inputComment}
              onChange={(e) => setInputComment(e.target.value)}
              placeholder="댓글을 남겨보세요"
              className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-xs text-[#1A1A1A] placeholder:text-neutral-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputComment.trim()}
              className="shrink-0 rounded-full bg-[#F7F6F3] px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-[#EFEDE8] disabled:opacity-40"
            >
              등록
            </button>
          </form>
        </div>
      </div>
    </article>
  )
}

function StoryFeedView({
  memories,
  user,
  onEdit,
  onDelete,
  onRequestAppend,
}: {
  memories: Memory[]
  user: AuthUser
  onEdit: (memory: Memory) => void
  onDelete: (memory: Memory) => void
  onRequestAppend: (memory: Memory) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {memories.map((memory) => (
        <StoryFeedCard
          key={memory.id}
          memory={memory}
          user={user}
          onEdit={() => onEdit(memory)}
          onDelete={() => onDelete(memory)}
          onRequestAppend={() => onRequestAppend(memory)}
        />
      ))}
    </div>
  )
}

function EmptyGuide({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center px-8">
      <div className="flex max-w-[240px] flex-col items-center text-center">
        <p className="text-[22px] font-bold leading-snug tracking-tight text-black">
          첫 글을
          <br />
          작성해보세요
        </p>
        <p className="mt-4 text-[13px] leading-[1.7] text-neutral-400">
          사진과 글로
          <br />
          오늘의 이야기를 남겨 보세요.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-8 rounded-full bg-black px-7 py-3 text-[13px] font-semibold tracking-wide text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition active:scale-[0.98]"
        >
          글 작성
        </button>
      </div>
    </div>
  )
}

function ConfirmOverlay({
  title,
  description,
  confirmLabel,
  cancelLabel = '아니오',
  confirmClassName = 'bg-black text-white',
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  confirmClassName?: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-[0_16px_48px_rgba(0,0,0,0.16)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="text-base font-bold text-black">{title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-500">
          {description}
        </p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-[#F7F6F3] py-3 text-sm font-semibold text-neutral-600"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-2xl py-3 text-sm font-semibold ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function draftEntriesToStoryFields(entries: StoryDraftEntry[]) {
  const title = entries[0]?.title.trim() ?? ''
  const content = entries[0]?.content.trim() ?? ''
  const photos = entries
    .map((entry) => entry.photo)
    .filter((photo): photo is string => Boolean(photo))
  const coverPhoto = photos[0] ?? null
  return { title, content, photos, coverPhoto }
}

export default function RoomDetail({
  room,
  onBack,
  onLeaveRoom,
  onMembersChange,
}: RoomDetailProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [liveMembers, setLiveMembers] = useState<Room['memberList']>(
    room.memberList,
  )
  const members = liveMembers
  const memberCount = members.length
  const firestoreRoomId = resolveFirestoreRoomId(room.id)
  const [isMembersOpen, setIsMembersOpen] = useState(false)
  const [isWriteOpen, setIsWriteOpen] = useState(false)
  const [storyMode, setStoryMode] = useState<StoryWriteMode>('create')
  const [editingStory, setEditingStory] = useState<Memory | null>(null)
  const [appendTarget, setAppendTarget] = useState<Memory | null>(null)
  const [deletingStory, setDeletingStory] = useState<Memory | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [isStoriesLoading, setIsStoriesLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreStories, setHasMoreStories] = useState(false)
  const [isSavingStory, setIsSavingStory] = useState(false)
  const pageCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(
    null,
  )
  const loadingRoomRef = useRef<string | null>(null)
  const isLoadingMoreRef = useRef(false)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)

  const displayMemories = storiesToDisplayMemories(stories)

  const onMembersChangeRef = useRef(onMembersChange)
  onMembersChangeRef.current = onMembersChange

  // Firestore 멤버 실시간 구독 + 현재 유저 참여 보장
  useEffect(() => {
    let cancelled = false
    setLiveMembers(room.memberList)

    const unsubscribe = subscribeRoomMembers(
      firestoreRoomId,
      (nextMembers) => {
        if (cancelled) return
        setLiveMembers(nextMembers)
        onMembersChangeRef.current?.(nextMembers)
      },
      (error) => {
        console.error('[RoomDetail] 구성원 구독 실패', error)
      },
    )

    void (async () => {
      if (!user?.id || user.id.startsWith('temp-')) return
      try {
        if (!isValidFirebaseSession(getFirebaseCurrentUser())) {
          await syncFirebaseAuthForAppUser(user)
        } else {
          await ensureFirebaseAuth()
        }

        const meta = await getRoomMeta(firestoreRoomId)
        if (!meta) {
          await createRoomInFirestore({
            room: {
              ...room,
              id: Number.parseInt(firestoreRoomId, 10) || room.id,
            },
            user: { id: user.id, name: user.name },
          })
        } else {
          await joinRoomInFirestore({
            roomId: firestoreRoomId,
            user: { id: user.id, name: user.name },
          })
        }
      } catch (error) {
        console.error('[RoomDetail] 멤버 동기화 실패', error)
      }
    })()

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [
    firestoreRoomId,
    room.id,
    room.slug,
    room.title,
    room.coverPhoto,
    room.inviteMsg,
    user,
  ])

  useRegisterBackHandler(() => {
    if (isWriteOpen) {
      if (isSavingStory) return true
      setIsWriteOpen(false)
      setEditingStory(null)
      setStoryMode('create')
      return true
    }
    if (appendTarget) {
      setAppendTarget(null)
      return true
    }
    if (deletingStory) {
      setDeletingStory(null)
      return true
    }
    if (isMembersOpen) {
      setIsMembersOpen(false)
      return true
    }
    onBack()
    return true
  })

  const applyPageResult = useCallback(
    (
      pageStories: Story[],
      lastDoc: QueryDocumentSnapshot<DocumentData> | null,
      hasMore: boolean,
      mode: 'replace' | 'append',
    ) => {
      pageCursorRef.current = lastDoc
      setHasMoreStories(hasMore)
      setStories((prev) => {
        if (mode === 'replace') return pageStories
        const seen = new Set(prev.map((story) => story.id))
        const merged = [...prev]
        for (const story of pageStories) {
          if (!seen.has(story.id)) merged.push(story)
        }
        return merged
      })
    },
    [],
  )

  const loadFirstPage = useCallback(
    async (forceRefresh = false) => {
      loadingRoomRef.current = firestoreRoomId
      setIsStoriesLoading(true)
      try {
        const page = await getStoriesPage(firestoreRoomId, {
          pageSize: STORIES_PAGE_SIZE,
          forceRefresh,
        })
        if (loadingRoomRef.current !== firestoreRoomId) return
        applyPageResult(page.stories, page.lastDoc, page.hasMore, 'replace')
      } catch (error) {
        console.error(error)
        if (loadingRoomRef.current === firestoreRoomId) {
          showToast('이야기를 불러오지 못했어요')
        }
      } finally {
        if (loadingRoomRef.current === firestoreRoomId) {
          setIsStoriesLoading(false)
        }
      }
    },
    [applyPageResult, firestoreRoomId, showToast],
  )

  const loadMoreStories = useCallback(async () => {
    if (
      isLoadingMoreRef.current ||
      !hasMoreStories ||
      !pageCursorRef.current
    ) {
      return
    }
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const page = await getStoriesPage(firestoreRoomId, {
        pageSize: STORIES_PAGE_SIZE,
        cursor: pageCursorRef.current,
      })
      applyPageResult(page.stories, page.lastDoc, page.hasMore, 'append')
    } catch (error) {
      console.error(error)
      showToast('더 불러오지 못했어요')
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [applyPageResult, firestoreRoomId, hasMoreStories, showToast])

  useEffect(() => {
    console.log('[RoomDetail] Firestore roomId =', firestoreRoomId)
    pageCursorRef.current = null
    void loadFirstPage(false)
  }, [firestoreRoomId, loadFirstPage])

  useEffect(() => {
    const node = loadMoreSentinelRef.current
    if (!node || !hasMoreStories || isStoriesLoading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreStories()
        }
      },
      { root: null, rootMargin: '240px 0px', threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [
    hasMoreStories,
    isStoriesLoading,
    loadMoreStories,
    displayMemories.length,
  ])

  useEffect(() => {
    if (!user) return
    const unread = getUnreadScheduleNotifications(user, room.id)
    if (unread.length === 0) return

    const latest = unread[0]
    showToast(
      unread.length === 1
        ? `새 일정: ${latest.scheduleTitle}`
        : `새 일정 ${unread.length}건이 있어요`,
    )
    markRoomScheduleNotificationsRead(user, room.id)
  }, [room.id, user, showToast])

  const openStoryCreate = () => {
    setStoryMode('create')
    setEditingStory(null)
    setIsWriteOpen(true)
  }

  const openStoryEdit = (memory: Memory) => {
    setStoryMode('edit')
    setEditingStory(memory)
    setIsWriteOpen(true)
  }

  const openAppendConfirm = (memory: Memory) => {
    setAppendTarget(memory)
  }

  const confirmAppend = () => {
    if (!appendTarget) return
    setStoryMode('append')
    setEditingStory(appendTarget)
    setAppendTarget(null)
    setIsWriteOpen(true)
  }

  const patchLocalStory = useCallback(
    (storyId: string, updater: (story: Story) => Story) => {
      setStories((prev) =>
        prev.map((story) => (story.id === storyId ? updater(story) : story)),
      )
    },
    [],
  )

  const handleSaveStory = async ({
    entries,
    mode = storyMode,
    target = editingStory,
  }: {
    entries: StoryDraftEntry[]
    mode?: StoryWriteMode
    target?: Memory | null
  }) => {
    if (entries.length === 0) return

    const draftFields = draftEntriesToStoryFields(entries)
    if (
      !draftFields.title &&
      !draftFields.content &&
      draftFields.photos.length === 0
    ) {
      return
    }

    const targetRoomId = resolveFirestoreRoomId(room.id)
    setIsSavingStory(true)
    try {
      if (!user?.id || user.id.startsWith('temp-')) {
        throw new Error('로그인이 필요해요. 앱을 다시 시작해 주세요.')
      }

      // 토스 세션 → Firebase Custom Token 세션이 있어야 Storage/Firestore 쓰기 가능
      let firebaseUser = getFirebaseCurrentUser()
      if (!isValidFirebaseSession(firebaseUser)) {
        firebaseUser = await syncFirebaseAuthForAppUser(user)
      }
      firebaseUser = await ensureFirebaseAuth()

      console.info('[RoomDetail] 저장 전 인증 상태', {
        tossUserId: user.id,
        firebaseUid: firebaseUser.uid,
        isAnonymous: firebaseUser.isAnonymous,
        hasPhotos: draftFields.photos.length > 0,
      })

      if (firebaseUser.isAnonymous) {
        throw new Error('익명 Firebase 세션으로는 글을 등록할 수 없어요.')
      }

      const photos = await resolveRemotePhotoUrls(
        draftFields.photos,
        targetRoomId,
        mode === 'create' ? undefined : target?.id,
      )
      const coverPhoto = photos[0] ?? null
      const title = draftFields.title
      const content = draftFields.content

      if (mode === 'append' && target) {
        const slides =
          photos.length > 0
            ? photos.map((url) => ({
                url,
                title: title || undefined,
                text: content,
                origin: 'append' as const,
                authorId: user?.id,
                authorName: user?.name,
              }))
            : [
                {
                  url: null as string | null,
                  title: title || undefined,
                  text: content,
                  origin: 'append' as const,
                  authorId: user?.id,
                  authorName: user?.name,
                },
              ]

        const appended = await appendStorySlides(
          targetRoomId,
          target.id,
          slides,
        )
        patchLocalStory(target.id, (story) => {
          const nextSlides = [...story.slides, ...appended]
          const nextPhotos = nextSlides
            .map((slide) => slide.url)
            .filter((url): url is string => Boolean(url))
          return {
            ...story,
            slides: nextSlides,
            photos: nextPhotos,
          }
        })
        showToast('사진/글을 추가했어요')
      } else if (mode === 'edit' && target) {
        const slides =
          photos.length > 0
            ? photos.map((url, index) => ({
                id: target.slides[index]?.id,
                url,
                origin: target.slides[index]?.origin,
                title: target.slides[index]?.title,
                text:
                  index === 0
                    ? content
                    : (target.slides[index]?.text ?? ''),
                authorId:
                  target.slides[index]?.authorId ?? target.authorId ?? user?.id,
                authorName:
                  target.slides[index]?.authorName ??
                  target.author ??
                  user?.name,
              }))
            : target.slides

        await updateStory(targetRoomId, target.id, {
          title: title || target.title,
          content,
          coverPhoto: coverPhoto ?? target.lastPhoto,
          photos,
          slides,
        })
        patchLocalStory(target.id, (story) => ({
          ...story,
          title: title || target.title,
          content,
          coverPhoto: coverPhoto ?? target.lastPhoto,
          photos,
          slides: slides.map((slide, index) => ({
            id: slide.id ?? `edit-${index}`,
            url: slide.url ?? null,
            text: slide.text ?? '',
            title: slide.title,
            origin: slide.origin ?? target.slides[index]?.origin,
            authorId: slide.authorId,
            authorName: slide.authorName,
            createdAt: Date.now() + index,
          })),
        }))
        showToast('이야기를 수정했어요')
      } else {
        const storyId = await addStory(targetRoomId, {
          roomId: targetRoomId,
          parentId: null,
          title: title || '제목 없음',
          content,
          photos,
          coverPhoto,
          slides: photos.map((url, index) => ({
            url,
            text: index === 0 ? content : '',
            authorId: user?.id,
            authorName: user?.name,
          })),
          authorId: user?.id,
          authorName: user?.name,
        })
        const localSlides: StorySlide[] = photos.map((url, index) => ({
          id: `local-${storyId}-${index}`,
          url,
          text: index === 0 ? content : '',
          authorId: user?.id,
          authorName: user?.name,
          createdAt: Date.now() + index,
        }))
        setStories((prev) => [
          {
            id: storyId,
            roomId: targetRoomId,
            parentId: null,
            title: title || '제목 없음',
            content,
            photos,
            slides: localSlides,
            coverPhoto,
            authorId: user?.id,
            authorName: user?.name,
            createdAt: null,
            updatedAt: null,
          },
          ...prev.filter((story) => story.id !== storyId),
        ])
        showToast('이야기를 등록했어요')
      }

      setIsWriteOpen(false)
      setEditingStory(null)
      setStoryMode('create')
    } catch (error) {
      console.error('[RoomDetail] 이야기 저장 실패', error)
      const message =
        error instanceof Error && error.message
          ? formatFirebaseAuthError(error)
          : '저장에 실패했어요'
      showToast(message)
      throw error
    } finally {
      setIsSavingStory(false)
    }
  }

  const handleDeleteStory = async (storyId: string) => {
    const targetRoomId = resolveFirestoreRoomId(room.id)
    try {
      const result = await deleteStory(targetRoomId, storyId)
      if (result.keptAppended) {
        setStories((prev) =>
          prev.map((story) =>
            story.id === storyId ? result.story : story,
          ),
        )
        showToast('원글을 삭제했어요. 이어 쓴 글은 그대로 남아요')
      } else {
        setStories((prev) => prev.filter((story) => story.id !== storyId))
        showToast('이야기를 삭제했어요')
      }
      setIsWriteOpen(false)
      setEditingStory(null)
      setDeletingStory(null)
    } catch (error) {
      console.error('[RoomDetail] 이야기 삭제 실패', error)
      showToast('삭제에 실패했어요')
    }
  }

  if (!user) return null

  const showInAppBack = !isInTossApp()

  if (isWriteOpen) {
    const editPhotos =
      storyMode === 'append' || !editingStory
        ? []
        : (() => {
            const fromSlides = resolveSlides(editingStory)
              .map((slide) => slide.url)
              .filter((url): url is string => Boolean(url))
            if (fromSlides.length > 0) return fromSlides
            if (editingStory.photos && editingStory.photos.length > 0) {
              return editingStory.photos
            }
            if (editingStory.lastPhoto) return [editingStory.lastPhoto]
            return []
          })()

    return (
      <StoryWriteModal
        key={`${storyMode}-${editingStory?.id ?? 'new'}`}
        isOpen
        mode={storyMode}
        seedId={editingStory?.id ?? 'new'}
        storyTitle={room.title}
        initialTitle={
          storyMode === 'append' ? '' : (editingStory?.title ?? '')
        }
        initialContent={
          storyMode === 'append' ? '' : (editingStory?.content ?? '')
        }
        initialPhotos={editPhotos}
        isSaving={isSavingStory}
        onClose={() => {
          if (isSavingStory) return
          setIsWriteOpen(false)
          setEditingStory(null)
          setStoryMode('create')
        }}
        onSave={handleSaveStory}
        onUploadError={(message) => showToast(message)}
        onDelete={
          storyMode === 'edit' && editingStory
            ? () => handleDeleteStory(editingStory.id)
            : undefined
        }
      />
    )
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-white px-6 font-sans text-black">
      <div className="relative z-10 mt-[3cm] mb-4 flex items-center justify-between gap-2">
        {showInAppBack ? (
          <button
            type="button"
            onClick={onBack}
            className="relative z-10 flex shrink-0 items-center gap-1 text-sm font-medium text-black"
          >
            ← 뒤로
          </button>
        ) : (
          <span className="w-8 shrink-0" aria-hidden />
        )}
        <div className="pointer-events-none absolute inset-x-0 flex items-baseline justify-center gap-2 px-16">
          {/* 오른쪽 '구성원 N'과 같은 폭으로 왼쪽을 맞춰 제목만 화면 중앙에 오게 함 */}
          <span
            className="invisible shrink-0 text-xs font-medium"
            aria-hidden
          >
            구성원 {memberCount}
          </span>
          <h1 className="truncate text-center text-2xl font-bold tracking-tight text-black">
            {room.title}
          </h1>
          <button
            type="button"
            onClick={() => setIsMembersOpen(true)}
            className="pointer-events-auto shrink-0 text-xs font-medium text-neutral-500 transition hover:text-neutral-700"
            aria-label={`구성원 ${memberCount}명`}
          >
            구성원 {memberCount}
          </button>
        </div>
        {displayMemories.length > 0 ? (
          <button
            type="button"
            onClick={openStoryCreate}
            className="relative z-10 ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black transition hover:bg-stone-100"
            aria-label="새 글 작성"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        ) : (
          <span className="h-9 w-9 shrink-0" aria-hidden />
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-start pb-10">
        {isStoriesLoading ? (
          <p className="mt-8 text-center text-xs text-neutral-400">
            이야기를 불러오는 중…
          </p>
        ) : displayMemories.length > 0 ? (
          <>
            <StoryFeedView
              memories={displayMemories}
              user={user}
              onEdit={openStoryEdit}
              onDelete={(memory) => setDeletingStory(memory)}
              onRequestAppend={openAppendConfirm}
            />
            <div
              ref={loadMoreSentinelRef}
              className="flex min-h-8 items-center justify-center py-4"
              aria-hidden
            >
              {isLoadingMore ? (
                <p className="text-xs text-neutral-400">불러오는 중…</p>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyGuide onAdd={openStoryCreate} />
        )}
      </div>

      <MembersModal
        isOpen={isMembersOpen}
        roomTitle={room.title}
        members={members}
        onClose={() => setIsMembersOpen(false)}
        onLeaveRoom={() => {
          setIsMembersOpen(false)
          onLeaveRoom()
        }}
      />

      {appendTarget ? (
        <ConfirmOverlay
          title="사진/글 추가"
          description="이 게시물에 사진/글을 추가하시겠습니까?"
          confirmLabel="예"
          cancelLabel="아니오"
          onClose={() => setAppendTarget(null)}
          onConfirm={confirmAppend}
        />
      ) : null}

      {deletingStory ? (
        <ConfirmOverlay
          title="이야기 삭제"
          description={
            '원글만 삭제돼요.\n이어서 작성된 글은 그대로 남아요.'
          }
          confirmLabel="삭제"
          cancelLabel="닫기"
          confirmClassName="bg-[#B85C5C] text-white"
          onClose={() => setDeletingStory(null)}
          onConfirm={() => {
            void handleDeleteStory(deletingStory.id)
          }}
        />
      ) : null}
    </div>
  )
}
