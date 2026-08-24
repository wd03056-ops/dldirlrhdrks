import { useEffect, useRef, useState } from 'react'

type StoryModalProps = {
  isOpen: boolean
  mode?: 'create' | 'edit'
  variant?: 'story' | 'room' | 'topic'
  initialTitle?: string
  initialPhoto?: string | null
  initialPhotos?: string[]
  onClose: () => void
  onSave: (story: {
    title: string
    lastPhoto: string | null
    photos: string[]
  }) => void
}

export default function StoryModal({
  isOpen,
  mode = 'create',
  variant = 'story',
  initialTitle = '',
  initialPhoto = null,
  initialPhotos = [],
  onClose,
  onSave,
}: StoryModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(initialTitle)
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle)
      if (initialPhotos.length > 0) {
        setPhotos(initialPhotos)
      } else if (initialPhoto) {
        setPhotos([initialPhoto])
      } else {
        setPhotos([])
      }
    }
  }, [isOpen, initialTitle, initialPhoto, initialPhotos])

  const handleClose = () => {
    setTitle('')
    setPhotos([])
    onClose()
  }

  const handleSave = () => {
    if (!title.trim()) {
      console.warn('[StoryModal] 저장 불가 — 제목이 비어 있어요')
      return
    }
    console.log('[StoryModal] 저장 클릭 → onSave 호출', {
      title: title.trim(),
      photoCount: photos.length,
    })
    onSave({
      title: title.trim(),
      lastPhoto: photos[0] ?? null,
      photos,
    })
    setTitle('')
    setPhotos([])
  }

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newPhotos = await Promise.all(
      Array.from(files).map((file) => readFileAsDataUrl(file)),
    )
    setPhotos((prev) =>
      variant === 'room' ? newPhotos.slice(0, 1) : [...prev, ...newPhotos],
    )
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  if (!isOpen) return null

  const isRoom = variant === 'room'
  const isTopic = variant === 'topic'
  const heading =
    mode === 'edit'
      ? isRoom
        ? '모임 수정'
        : isTopic
          ? '주제 수정'
          : '이야기 수정'
      : isRoom
        ? '모임 추가'
        : isTopic
          ? '주제 추가'
          : '이야기 추가'
  const description =
    mode === 'edit'
      ? isRoom
        ? '공간 이름과 대표 사진을 수정할 수 있어요.'
        : isTopic
          ? '주제 제목과 사진을 수정할 수 있어요.'
          : '제목과 사진은 내 화면에서만 바뀌고, 다른 구성원에게는 보이지 않아요.'
      : isRoom
        ? '공간 이름과 대표 사진을 추가해 주세요.'
        : isTopic
          ? '사진과 제목을 추가해 주세요.'
          : '사진과 제목을 추가해 주세요.'
  const titlePlaceholder = isRoom
    ? '모임 이름'
    : isTopic
      ? '주제 제목'
      : '이야기 제목'
  const saveLabel =
    mode === 'edit' ? (isRoom ? '저장' : '내 화면에 저장') : '추가'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-6 backdrop-blur-[2px]"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="max-h-[90dvh] w-full max-w-sm space-y-4 overflow-y-auto rounded-[28px] border border-black/5 bg-white p-7 shadow-[0_16px_48px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div>
          <h2 className="text-lg font-bold tracking-tight text-black">
            {heading}
          </h2>
          <p className="mt-1.5 text-xs text-neutral-500">{description}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-neutral-500">
            {isRoom ? '대표 사진' : '사진'}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {photos.map((photo, index) => (
              <div key={`photo-${index}`} className="group relative">
                <div className="aspect-square overflow-hidden rounded-2xl bg-[#F7F6F3] shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                  <img
                    src={photo}
                    alt={`미리보기 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white shadow-sm"
                  aria-label={`사진 ${index + 1} 삭제`}
                >
                  ×
                </button>
              </div>
            ))}
            {(!isRoom || photos.length === 0) && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center rounded-2xl border-0 bg-[#F7F6F3] transition hover:bg-[#EFEDE8]"
              >
                <svg
                  className="h-5 w-5 text-neutral-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="mt-1 text-[10px] font-medium text-neutral-500">
                  추가
                </span>
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={!isRoom}
          className="hidden"
          onChange={handleFileChange}
        />

        <input
          type="text"
          className="w-full rounded-2xl border-0 bg-[#F7F6F3] px-4 py-4 text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-black/10"
          placeholder={titlePlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-2xl border-0 bg-[#F7F6F3] py-3.5 text-sm font-semibold text-neutral-600 transition hover:bg-[#EFEDE8]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 rounded-2xl bg-black py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition hover:bg-neutral-800 disabled:opacity-40"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
