import { useEffect, useRef, useState } from 'react'
import ImageCropEditor from './ImageCropEditor'
import {
  assertValidImageType,
  assertValidUploadFile,
  StorageUploadError,
} from './services/storageService'
import { compressImageFile } from './utils/compressImage'

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
  isSaving?: boolean
  onClose: () => void
  onSave: (data: { entries: StoryDraftEntry[] }) => void | Promise<void>
  onDelete?: () => void
  onUploadError?: (message: string) => void
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
  isSaving = false,
  onClose,
  onSave,
  onDelete,
  onUploadError,
}: StoryWriteModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoStripRef = useRef<HTMLDivElement>(null)
  const seededKeyRef = useRef<string | null>(null)
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([])
  const [textOnlyContent, setTextOnlyContent] = useState('')
  const [composeContent, setComposeContent] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  /** 압축 후 편집 대기열 (data URL) */
  const [editQueue, setEditQueue] = useState<string[]>([])

  const isEdit = mode === 'edit'
  const isAppend = mode === 'append'
  const isEditingPhoto = editQueue.length > 0
  const busy = isSaving || isSubmitting || isCompressing || isEditingPhoto

  useEffect(() => {
    if (!isOpen) {
      seededKeyRef.current = null
      setIsSubmitting(false)
      setIsCompressing(false)
      setEditQueue([])
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
    setIsSubmitting(false)
    setEditQueue([])
  }

  const handleCropConfirm = async (croppedDataUrl: string) => {
    setDraftEntries((prev) => {
      const next =
        isEdit && prev.length === 0
          ? [createDraftEntry(croppedDataUrl, textOnlyContent)]
          : [...prev, createDraftEntry(croppedDataUrl)]
      scrollPhotoStripTo(next.length - 1)
      return next
    })
    if (isEdit) {
      setTextOnlyContent('')
    }
    setEditQueue((queue) => queue.slice(1))
  }

  const handleCropCancel = () => {
    // 편집 중인 사진과 대기열을 모두 취소
    setEditQueue([])
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
    if (busy) return
    resetState()
    onClose()
  }

  const handleSave = async () => {
    if (busy) return
    const title = draftTitle.trim()
    let payload: { entries: StoryDraftEntry[] } | null = null

    if (isEdit) {
      const content = (draftEntries[0]?.content ?? textOnlyContent).trim()
      if (!content && draftEntries.length === 0 && !title) return
      if (draftEntries.length > 0) {
        payload = {
          entries: draftEntries.map((entry) => ({
            photo: entry.photo,
            content,
            title,
          })),
        }
      } else {
        payload = {
          entries: [{ photo: null, content, title }],
        }
      }
    } else if (draftEntries.length > 0) {
      const content = composeContent.trim()
      payload = {
        entries: draftEntries.map((entry) => ({
          photo: entry.photo,
          content,
          title,
        })),
      }
    } else if (textOnlyContent.trim() || title) {
      payload = {
        entries: [{ photo: null, content: textOnlyContent.trim(), title }],
      }
    } else {
      return
    }

    setIsSubmitting(true)
    try {
      await onSave(payload)
      resetState()
    } catch {
      // 부모에서 토스트 처리. 초안은 유지해요.
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || busy) return

    const selectedFiles = Array.from(files)
    e.target.value = ''

    setIsCompressing(true)
    try {
      const compressedFiles: File[] = []
      for (const file of selectedFiles) {
        try {
          assertValidImageType(file, {
            fileName: file.name,
            contentType: file.type,
          })
          const compressed = await compressImageFile(file)
          assertValidUploadFile(compressed, {
            fileName: compressed.name,
            contentType: compressed.type,
          })
          compressedFiles.push(compressed)
        } catch (error) {
          const message =
            error instanceof StorageUploadError
              ? error.message
              : '이미지를 압축하지 못했어요. 다른 사진을 선택해 주세요.'
          onUploadError?.(message)
        }
      }
      if (compressedFiles.length === 0) return

      const newPhotos = await Promise.all(
        compressedFiles.map((file) => readFileAsDataUrl(file)),
      )
      if (newPhotos.length === 0) return

      // 바로 초안에 넣지 않고, 편집 창을 거쳐 등록해요.
      setEditQueue((prev) => [...prev, ...newPhotos])
    } finally {
      setIsCompressing(false)
    }
  }

  const removePhoto = (index: number) => {
    if (busy) return
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

  const canSave =
    !busy &&
    (isEdit
      ? Boolean(
          draftEntries[0]?.content.trim() ||
            draftEntries[0]?.photo ||
            textOnlyContent.trim() ||
            draftTitle.trim(),
        )
      : draftEntries.length > 0 ||
        Boolean(textOnlyContent.trim()) ||
        Boolean(draftTitle.trim()))

  const sharedComposeContent = isEdit
    ? (draftEntries[0]?.content ?? textOnlyContent)
    : composeContent

  const headerTitle = isEdit
    ? '이야기 수정'
    : isAppend
      ? '사진/글 추가'
      : '글 작성'
  const headerAction = busy ? '저장 중...' : isEdit ? '완료' : '등록'
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
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-black transition hover:bg-stone-100 disabled:opacity-40"
          aria-label="닫기"
        >
          ✕
        </button>
        <h1 className="text-sm font-semibold text-black">{headerTitle}</h1>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="text-sm font-semibold text-black transition disabled:text-stone-300"
        >
          {headerAction}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        <p className="mb-4 text-xs text-stone-400">{guideText}</p>
        {isCompressing ? (
          <p className="mb-4 text-xs font-medium text-stone-500">
            사진을 준비하는 중이에요…
          </p>
        ) : isEditingPhoto ? (
          <p className="mb-4 text-xs font-medium text-stone-500">
            사진 편집을 완료해 주세요…
          </p>
        ) : isSaving || isSubmitting ? (
          <p className="mb-4 text-xs font-medium text-stone-500">
            사진을 업로드하고 글을 저장하는 중이에요…
          </p>
        ) : null}

        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="제목을 입력해 보세요."
          disabled={busy}
          className="mb-4 w-full border-0 border-b border-stone-200 bg-transparent pb-2 text-base font-semibold text-black placeholder:text-stone-400 focus:border-black focus:outline-none disabled:opacity-60"
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
                      disabled={busy}
                      className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-sm font-medium text-white backdrop-blur-[2px] transition hover:bg-black/70 disabled:opacity-40"
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
              disabled={busy}
              className="relative flex aspect-[4/5] w-full items-center justify-center rounded-3xl border border-stone-200 bg-white text-stone-400 transition hover:border-stone-300 hover:text-stone-500 disabled:opacity-50"
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
              disabled={busy}
              className="mt-3 w-full rounded-2xl border border-dashed border-stone-300 bg-stone-50 py-3 text-xs font-semibold text-stone-500 transition hover:border-stone-400 hover:text-stone-700 disabled:opacity-50"
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
            disabled={busy}
            className="mb-4 min-h-[160px] w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-black placeholder:text-stone-400 focus:outline-none disabled:opacity-60"
          />
        ) : (
          <textarea
            value={textOnlyContent}
            onChange={(e) => setTextOnlyContent(e.target.value)}
            placeholder="사진 없이 글만 남길 수도 있어요..."
            disabled={busy}
            className="mb-4 min-h-[160px] w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-black placeholder:text-stone-400 focus:outline-none disabled:opacity-60"
          />
        )}

        {isEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="mb-8 w-full py-2 text-center text-sm font-semibold text-[#B85C5C] transition hover:text-[#8A3A3A] disabled:opacity-40"
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
        onChange={(e) => void handleFileChange(e)}
      />

      {editQueue[0] ? (
        <ImageCropEditor
          key={editQueue[0].slice(0, 64)}
          imageSrc={editQueue[0]}
          aspect={4 / 5}
          title="사진 편집"
          queueLabel={
            editQueue.length > 1
              ? `남은 사진 ${editQueue.length}장`
              : undefined
          }
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </div>
  )
}
