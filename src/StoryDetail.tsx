import { useEffect, useRef, useState } from 'react'
import StoryWriteModal, { type StoryDraftEntry } from './StoryWriteModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import { useAuth } from './context/AuthContext'
import type { AuthUser } from './types/auth'
import type { DisplayMemory } from './types/displayMemory'

type Comment = {
  id: number
  author: string
  authorId?: string
  text: string
  date: string
  taggedPhotoIndex?: number
}

type StoryDetailProps = {
  story: DisplayMemory
  roomTitle: string
  onBack: () => void
  onSave: (entries: StoryDraftEntry[]) => Promise<void> | void
  onDelete: () => Promise<void> | void
}

function formatMemoryDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${year}.${month}.${day}`
}

function formatCommentDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}.${day}`
}

function formatUploadDateFromStory(story: DisplayMemory) {
  if (story.date) return formatMemoryDate(story.date)
  return null
}

function getStoryPhotos(story: DisplayMemory) {
  if (story.photos && story.photos.length > 0) return story.photos
  if (story.lastPhoto) return [story.lastPhoto]
  return [] as string[]
}

function isOwnStory(story: DisplayMemory, user: AuthUser) {
  if (story.authorId) return story.authorId === user.id
  if (story.author) return story.author === user.name
  return true
}

export default function StoryDetail({
  story,
  roomTitle,
  onBack,
  onSave,
  onDelete,
}: StoryDetailProps) {
  const { user } = useAuth()
  const photos = getStoryPhotos(story)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photoHighlight, setPhotoHighlight] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [inputComment, setInputComment] = useState('')
  const [taggedPhotoIndex, setTaggedPhotoIndex] = useState<number | null>(null)
  const [isMentionSelectorOpen, setIsMentionSelectorOpen] = useState(false)
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const touchStartX = useRef(0)
  const mouseStartX = useRef<number | null>(null)
  const entryViewerRef = useRef<HTMLDivElement>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCurrentIndex(0)
    setTaggedPhotoIndex(null)
    setIsMentionSelectorOpen(false)
    setIsWriteModalOpen(false)
  }, [story.id])

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current)
      }
    }
  }, [])

  if (!user) return null

  const currentPhoto = photos[currentIndex] ?? null
  const displayContent = (story.content ?? '').trim()
  const displayTitle = story.title.trim()
  const authorName = story.author ?? user.name
  const isOwn = isOwnStory(story, user)
  const uploadDateLabel = formatUploadDateFromStory(story)
  const displayDate = story.date ? formatMemoryDate(story.date) : null
  const hasBody = Boolean(displayContent || displayTitle || currentPhoto)

  const goToPhoto = (index: number, emphasize = false) => {
    if (photos.length === 0) return
    const nextIndex = Math.max(0, Math.min(index, photos.length - 1))
    setCurrentIndex(nextIndex)

    if (emphasize) {
      setPhotoHighlight(false)
      requestAnimationFrame(() => {
        setPhotoHighlight(true)
        entryViewerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current)
      }
      highlightTimerRef.current = setTimeout(() => {
        setPhotoHighlight(false)
      }, 900)
    }
  }

  const handleSwipe = (startX: number, endX: number) => {
    const diff = startX - endX
    if (Math.abs(diff) < 50) return
    if (diff > 0) {
      goToPhoto(currentIndex + 1)
    } else {
      goToPhoto(currentIndex - 1)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    handleSwipe(touchStartX.current, e.changedTouches[0].clientX)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartX.current = e.clientX
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (mouseStartX.current === null) return
    handleSwipe(mouseStartX.current, e.clientX)
    mouseStartX.current = null
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputComment.trim()) return

    const newComment: Comment = {
      id: Date.now(),
      author: user.name,
      authorId: user.id,
      text: inputComment.trim(),
      date: formatCommentDate(new Date()),
      ...(taggedPhotoIndex !== null ? { taggedPhotoIndex } : {}),
    }

    setComments((prev) => [...prev, newComment])
    setInputComment('')
    setTaggedPhotoIndex(null)
    setIsMentionSelectorOpen(false)
  }

  const toggleTagPhoto = (index: number) => {
    setTaggedPhotoIndex((prev) => (prev === index ? null : index))
  }

  const handleSaveStory = async ({
    entries,
  }: {
    entries: StoryDraftEntry[]
  }) => {
    if (entries.length === 0) return
    setIsSaving(true)
    try {
      await onSave(entries)
      setIsWriteModalOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    setIsSaving(true)
    try {
      await onDelete()
      setIsDeleteConfirmOpen(false)
      setIsWriteModalOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteConfirmModal = (
    <DeleteConfirmModal
      isOpen={isDeleteConfirmOpen}
      heading="이야기 삭제"
      description={'이 이야기를 삭제할까요?\n삭제하면 되돌릴 수 없어요.'}
      onClose={() => {
        if (isSaving) return
        setIsDeleteConfirmOpen(false)
      }}
      onConfirm={() => {
        void confirmDelete()
      }}
    />
  )

  if (isWriteModalOpen) {
    return (
      <>
        <StoryWriteModal
          isOpen
          mode="edit"
          storyTitle={roomTitle}
          initialTitle={story.title}
          initialContent={story.content ?? ''}
          initialPhotos={photos}
          isSaving={isSaving}
          onClose={() => {
            if (isSaving) return
            setIsWriteModalOpen(false)
          }}
          onSave={handleSaveStory}
          onDelete={() => setIsDeleteConfirmOpen(true)}
        />
        {deleteConfirmModal}
      </>
    )
  }

  return (
    <>
      <div
        className={`relative mx-auto flex min-h-dvh max-w-md flex-col app-shell font-sans text-[#333331] ${
          isMentionSelectorOpen ? 'pb-52' : 'pb-28'
        }`}
      >
        <header className="px-6 pt-10 pb-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 text-sm font-medium text-[#333331]"
            >
              ← 뒤로가기
            </button>
            {displayDate ? (
              <span className="shrink-0 text-xs text-[#A8A8A2]">
                {displayDate}
              </span>
            ) : null}
          </div>
          <p className="text-center text-[11px] text-[#A8A8A2]">{roomTitle}</p>
          <h1 className="mt-1 text-center text-lg font-bold tracking-tight text-[#333331]">
            {displayTitle || '이야기'}
          </h1>
        </header>

        {!hasBody ? (
          <div className="mb-6 px-6 py-16 text-center">
            <p className="text-[15px] leading-[1.75] tracking-[-0.01em] text-[#1A1A1A]">
              아직 작성된 내용이 없어요.
            </p>
            {isOwn ? (
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(true)}
                className="mt-4 text-sm font-semibold text-black underline underline-offset-2"
              >
                이야기 수정하기
              </button>
            ) : null}
          </div>
        ) : (
          <div
            ref={entryViewerRef}
            className="mb-6 scroll-mt-6 px-6 select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          >
            <div
              className={`overflow-hidden rounded-3xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-shadow duration-500 ${
                photoHighlight
                  ? 'shadow-[0_12px_36px_rgba(0,0,0,0.14)] ring-4 ring-[#A8C8A0]'
                  : 'ring-0'
              }`}
            >
              <div className="flex min-h-[72px] flex-col items-center justify-center gap-1 border-b border-black/5 px-5 py-4 text-center">
                {displayTitle ? (
                  <h2 className="w-full text-base font-bold tracking-tight text-[#1A1A1A]">
                    {displayTitle}
                  </h2>
                ) : null}
                {uploadDateLabel ? (
                  <p className="w-full text-[11px] text-[#A8A8A2]">
                    {uploadDateLabel}
                  </p>
                ) : null}
              </div>

              {currentPhoto ? (
                <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden leading-[0]">
                  <img
                    key={currentIndex}
                    src={currentPhoto}
                    alt={`${displayTitle || '이야기'} ${currentIndex + 1}`}
                    className="absolute inset-0 block h-full w-full max-h-none max-w-none object-cover object-center transition-opacity duration-300"
                    draggable={false}
                  />
                </div>
              ) : null}

              <div className="px-5 py-5">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="max-w-[140px] truncate text-sm font-semibold text-black">
                      {authorName}
                    </span>
                    {isOwn ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsWriteModalOpen(true)}
                          className="shrink-0 text-xs font-semibold text-[#555552] underline decoration-[#A8C8A0] decoration-2 underline-offset-2 transition hover:text-black"
                        >
                          글 수정
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDeleteConfirmOpen(true)}
                          className="shrink-0 text-xs font-semibold text-[#B85C5C] underline decoration-[#E8C4C4] decoration-2 underline-offset-2 transition hover:text-[#8A3A3A]"
                        >
                          글 삭제
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {photos.length > 1 ? (
                  <div className="mt-6 flex items-center justify-center gap-4 px-2">
                    <button
                      type="button"
                      onClick={() => goToPhoto(currentIndex - 1)}
                      disabled={currentIndex === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F6F3] text-[#333331] transition hover:bg-[#EFEDE8] disabled:pointer-events-none disabled:opacity-30"
                      aria-label="이전 사진"
                    >
                      ‹
                    </button>
                    <span className="min-w-[48px] text-center text-[11px] font-medium text-[#A8A8A2]">
                      {currentIndex + 1} / {photos.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToPhoto(currentIndex + 1)}
                      disabled={currentIndex === photos.length - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F6F3] text-[#333331] transition hover:bg-[#EFEDE8] disabled:pointer-events-none disabled:opacity-30"
                      aria-label="다음 사진"
                    >
                      ›
                    </button>
                  </div>
                ) : null}

                <div className={photos.length > 1 ? 'mt-6' : 'mt-4'}>
                  {displayContent ? (
                    <p className="whitespace-pre-line text-[15px] leading-[1.75] tracking-[-0.01em] text-[#1A1A1A]">
                      {displayContent}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="my-6 h-px w-full bg-black/5" />

        <div className="flex flex-1 flex-col gap-4 px-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-wider text-black uppercase">
              대화 ({comments.length})
            </h3>
          </div>

          <div className="flex flex-col gap-3 pb-4">
            {comments.map((item) => {
              const taggedPhoto =
                item.taggedPhotoIndex != null
                  ? photos[item.taggedPhotoIndex]
                  : null

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                >
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
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

                    {taggedPhoto ? (
                      <button
                        type="button"
                        onClick={() => goToPhoto(item.taggedPhotoIndex!, true)}
                        className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl border border-[#EBEBE6] shadow-sm transition hover:ring-2 hover:ring-[#A8C8A0]"
                        aria-label={`언급된 ${(item.taggedPhotoIndex ?? 0) + 1}번째 사진 보기`}
                      >
                        <img
                          src={taggedPhoto}
                          alt={`언급된 사진 ${(item.taggedPhotoIndex ?? 0) + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4 pb-4 pt-2">
          {isMentionSelectorOpen && photos.length > 0 ? (
            <div className="pointer-events-auto mb-2 rounded-[24px] border border-black/5 bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#8E8E87]">
                  사진 언급 (선택)
                </span>
                {taggedPhotoIndex !== null ? (
                  <button
                    type="button"
                    onClick={() => setTaggedPhotoIndex(null)}
                    className="text-[10px] text-[#A8A8A2] underline-offset-2 hover:underline"
                  >
                    선택 해제
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {photos.map((photo, index) => (
                  <button
                    key={`tag-${index}`}
                    type="button"
                    onClick={() => toggleTagPhoto(index)}
                    className={`relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      taggedPhotoIndex === index
                        ? 'border-[#A8C8A0] ring-2 ring-[#A8C8A0]/40'
                        : 'border-[#EBEBE6] opacity-80 hover:opacity-100'
                    }`}
                    aria-label={`${index + 1}번째 사진 언급`}
                    aria-pressed={taggedPhotoIndex === index}
                  >
                    <img
                      src={photo}
                      alt={`사진 ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute right-0.5 bottom-0.5 rounded bg-black/50 px-1 text-[9px] text-white">
                      {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <form
            onSubmit={handleAddComment}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-black/5 bg-white p-1.5 shadow-lg"
          >
            {photos.length > 0 ? (
              <button
                type="button"
                onClick={() => setIsMentionSelectorOpen((prev) => !prev)}
                className={`shrink-0 rounded-full px-3.5 py-2.5 text-xs font-medium transition ${
                  isMentionSelectorOpen || taggedPhotoIndex !== null
                    ? 'bg-[#F0F5EF] text-[#5A7A52]'
                    : 'bg-transparent text-[#8E8E87] hover:bg-[#F7F6F3] hover:text-[#5A7A52]'
                }`}
              >
                {taggedPhotoIndex !== null
                  ? `사진 ${taggedPhotoIndex + 1}`
                  : '사진언급'}
              </button>
            ) : null}
            <input
              type="text"
              value={inputComment}
              onChange={(e) => setInputComment(e.target.value)}
              placeholder={
                taggedPhotoIndex !== null
                  ? `사진 ${taggedPhotoIndex + 1}번을 언급하며 댓글 남기기...`
                  : '댓글을 남겨보세요'
              }
              className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 text-xs text-[#1A1A1A] placeholder:text-neutral-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputComment.trim()}
              className="shrink-0 rounded-full bg-[#F7F6F3] px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-[#EFEDE8] disabled:opacity-40"
            >
              등록
            </button>
          </form>
        </div>
      </div>
      {deleteConfirmModal}
    </>
  )
}
