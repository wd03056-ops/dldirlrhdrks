import { useEffect, useRef, useState } from 'react'

export type StoryDraftEntry = {
  photo: string | null
  content: string
  title: string
}

type StoryWriteModalProps = {
  isOpen: boolean
  mode?: 'create' | 'edit' | 'append'
  storyTitle: string
  seedId?: string
  initialTitle?: string
  initialContent?: string
  initialPhotos?: string[]
  onClose: () => void
  onSave: (data: { entries: StoryDraftEntry[] }) => void
  onDelete?: () => void
}

type DraftEntry = {
  id: string
  photo: string
  content: string
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function createDraftEntry(photo: string, content = ''): DraftEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    photo,
    content,
  }
}

export default function StoryWriteModal({
  isOpen,
  mode = 'create',
  storyTitle,
  seedId = '',
  initialTitle = '',
  initialContent = '',
  initialPhotos = [],
  onClose,
  onSave,
  onDelete,
}: StoryWriteModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoStripRef = useRef<HTMLDivElement>(null)
  const seededKeyRef = useRef<string | null>(null)
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([])
  const [textOnlyContent, setTextOnlyContent] = useState('')
  const [composeContent, setComposeContent] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)

  const isEdit = mode === 'edit'
  const isAppend = mode === 'append'

  useEffect(() => {
    if (!isOpen) {
      seededKeyRef.current = null
      return
    }

    const seedKey = `${mode}::${seedId}::${initialPhotos.length}::${initialTitle}::${initialContent}`
    if (seededKeyRef.current === seedKey) return
    seededKeyRef.current = seedKey

    if (mode === 'edit') {
      const photos = initialPhotos.filter((photo) => Boolean(photo))
      if (photos.length > 0) {
        setDraftEntries(
          photos.map((photo, index) =>
            createDraftEntry(photo, index === 0 ? initialContent : ''),
          ),
        )
        setTextOnlyContent('')
        setActivePhotoIndex(0)
      } else {
        setDraftEntries([])
        setTextOnlyContent(initialContent)
        setActivePhotoIndex(0)
      }
      setDraftTitle(initialTitle)
      setComposeContent(initialContent)
      return
    }

    setDraftEntries([])
    setTextOnlyContent('')
    setComposeContent('')
    setDraftTitle('')
    setActivePhotoIndex(0)
  }, [isOpen, mode, seedId, initialTitle, initialContent, initialPhotos])

  useEffect(() => {
    if (!isOpen || draftEntries.length === 0) return
    const strip = photoStripRef.current
    if (!strip) return
    strip.scrollLeft = 0
    setActivePhotoIndex(0)
  }, [isOpen, draftEntries.length, seedId])

  if (!isOpen) return null

  const resetState = () => {
    seededKeyRef.current = null
    setDraftEntries([])
    setTextOnlyContent('')
    setComposeContent('')
    setDraftTitle('')
    setActivePhotoIndex(0)
  }

  const scrollPhotoStripTo = (index: number) => {
    requestAnimationFrame(() => {
      const strip = photoStripRef.current
      if (!strip) return
      const target = strip.children[index] as HTMLElement | undefined
      if (!target) return
      strip.scrollLeft = target.offsetLeft
      setActivePhotoIndex(index)
    })
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleSave = () => {
    const title = draftTitle.trim()

    if (isEdit) {
      const content = (draftEntries[0]?.content ?? textOnlyContent).trim()
      if (!content && draftEntries.length === 0 && !title) return
      if (draftEntries.length > 0) {
        onSave({
          entries: draftEntries.map((entry) => ({
            photo: entry.photo,
            content,
            title,
          })),
        })
      } else {
        onSave({
          entries: [{ photo: null, content, title }],
        })
      }
    } else if (draftEntries.length > 0) {
      const content = composeContent.trim()
      onSave({
        entries: draftEntries.map((entry) => ({
          photo: entry.photo,
          content,
          title,
        })),
      })
    } else if (textOnlyContent.trim() || title) {
      onSave({
        entries: [{ photo: null, content: textOnlyContent.trim(), title }],
      })
    } else {
      return
    }

    resetState()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const selectedFiles = Array.from(files)
    e.target.value = ''

    const newPhotos = await Promise.all(
      selectedFiles.map((file) => readFileAsDataUrl(file)),
    )
    if (newPhotos.length === 0) return

    const prevCount = draftEntries.length
    const nextActiveIndex = prevCount + newPhotos.length - 1
    setDraftEntries((prev) => {
      if (isEdit && prev.length === 0) {
        const content = textOnlyContent
        return newPhotos.map((photo, index) =>
          createDraftEntry(photo, index === 0 ? content : ''),
        )
      }
      return [
        ...prev,
        ...newPhotos.map((photo) => createDraftEntry(photo)),
      ]
    })

    if (isEdit) {
      setTextOnlyContent('')
    }

    scrollPhotoStripTo(nextActiveIndex)
  }

  const removePhoto = (index: number) => {
    setDraftEntries((prev) => {
      const removed = prev[index]
      const next = prev.filter((_, i) => i !== index)

      if (isEdit && removed) {
        setTextOnlyContent(removed.content)
      }

      return next
    })
    const nextIndex = Math.max(0, Math.min(index, draftEntries.length - 2))
    scrollPhotoStripTo(nextIndex)
  }

  const updateEntryContent = (index: number, content: string) => {
    setDraftEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, content } : entry)),
    )
  }

  const canSave = isEdit
    ? Boolean(
        draftEntries[0]?.content.trim() ||
          draftEntries[0]?.photo ||
          textOnlyContent.trim() ||
          draftTitle.trim(),
      )
    : draftEntries.length > 0 ||
      Boolean(textOnlyContent.trim()) ||
      Boolean(draftTitle.trim())

  const sharedComposeContent = isEdit
    ? (draftEntries[0]?.content ?? textOnlyContent)
    : composeContent

  const headerTitle = isEdit
    ? '이야기 수정'
    : isAppend
      ? '사진/글 추가'
      : '글 작성'
  const headerAction = isEdit ? '완료' : '등록'
  const guideText = isEdit
    ? '내가 작성한 사진과 글을 수정할 수 있어요.'
    : isAppend
      ? '제목, 사진, 내용을 작성해 이 게시물에 추가해 주세요.'
      : `${storyTitle}에 남길 글을 작성해 주세요.`

  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-md flex-col bg-white font-sans text-black">
      <header className="flex shrink-0 items-center justify-between border-b border-black/5 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={handleClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-black transition hover:bg-stone-100"
          aria-label="닫기"
        >
          ✕
        </button>
        <h1 className="text-sm font-semibold text-black">{headerTitle}</h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="text-sm font-semibold text-black transition disabled:text-stone-300"
        >
          {headerAction}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        <p className="mb-4 text-xs text-stone-400">{guideText}</p>

        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="제목을 입력해 보세요."
          className="mb-4 w-full border-0 border-b border-stone-200 bg-transparent pb-2 text-base font-semibold text-black placeholder:text-stone-400 focus:border-black focus:outline-none"
        />

        <div className="mb-4">
          {draftEntries.length > 0 ? (
            <>
              <div
                ref={photoStripRef}
                className="flex snap-x snap-mandatory overflow-x-auto pb-1 scrollbar-hide"
                onScroll={(e) => {
                  const el = e.currentTarget
                  if (el.clientWidth === 0) return
                  setActivePhotoIndex(
                    Math.round(el.scrollLeft / el.clientWidth),
                  )
                }}
              >
                {draftEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="relative aspect-[4/5] w-full min-w-full shrink-0 snap-center"
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-3xl bg-[#F7F6F3]">
                      <img
                        src={entry.photo}
                        alt={`사진 ${index + 1}`}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-sm font-medium text-white backdrop-blur-[2px] transition hover:bg-black/70"
                      aria-label="사진 취소"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {draftEntries.length > 1 ? (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {draftEntries.map((entry, index) => (
                    <span
                      key={`dot-${entry.id}`}
                      className={`h-1.5 rounded-full transition-all ${
                        index === activePhotoIndex
                          ? 'w-4 bg-black/50'
                          : 'w-1.5 bg-black/20'
                      }`}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative flex aspect-[4/5] w-full items-center justify-center rounded-3xl border border-stone-200 bg-white text-stone-400 transition hover:border-stone-300 hover:text-stone-500"
              aria-label="사진 추가"
            >
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          )}

          {draftEntries.length > 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 w-full rounded-2xl border border-dashed border-stone-300 bg-stone-50 py-3 text-xs font-semibold text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
            >
              + 사진 추가
            </button>
          ) : null}

          {draftEntries.length > 1 ? (
            <p className="mt-2 text-xs text-stone-400">
              선택한 모든 사진에 같은 제목과 글이 적용돼요
            </p>
          ) : null}
        </div>

        {draftEntries.length > 0 ? (
          <textarea
            value={sharedComposeContent}
            onChange={(e) => {
              const next = e.target.value
              if (isEdit) {
                if (draftEntries.length > 0) {
                  updateEntryContent(0, next)
                } else {
                  setTextOnlyContent(next)
                }
              } else {
                setComposeContent(next)
              }
            }}
            placeholder="글을 작성해보세요."
            className="mb-4 min-h-[160px] w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-black placeholder:text-stone-400 focus:outline-none"
          />
        ) : (
          <textarea
            value={textOnlyContent}
            onChange={(e) => setTextOnlyContent(e.target.value)}
            placeholder="사진 없이 글만 남길 수도 있어요..."
            className="mb-4 min-h-[160px] w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-black placeholder:text-stone-400 focus:outline-none"
          />
        )}

        {isEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="mb-8 w-full py-2 text-center text-sm font-semibold text-[#B85C5C] transition hover:text-[#8A3A3A]"
          >
            글 삭제
          </button>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
