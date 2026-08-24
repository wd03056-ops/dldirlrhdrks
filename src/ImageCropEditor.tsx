import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { getCroppedImageDataUrl } from './utils/cropImage'

type ImageCropEditorProps = {
  imageSrc: string
  /** 예: 4/5 스토리, 1 정사각 커버 */
  aspect?: number
  title?: string
  queueLabel?: string
  onCancel: () => void
  onConfirm: (croppedDataUrl: string) => void | Promise<void>
}

export default function ImageCropEditor({
  imageSrc,
  aspect = 4 / 5,
  title = '사진 편집',
  queueLabel,
  onCancel,
  onConfirm,
}: ImageCropEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels || isApplying) return
    setIsApplying(true)
    try {
      const dataUrl = await getCroppedImageDataUrl(imageSrc, croppedAreaPixels)
      await onConfirm(dataUrl)
    } catch (error) {
      console.error('[ImageCropEditor] 크롭 실패', error)
      setIsApplying(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] mx-auto flex max-w-md flex-col bg-black font-sans text-white"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex shrink-0 items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onCancel}
          disabled={isApplying}
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-white/90 transition hover:bg-white/10 disabled:opacity-40"
          aria-label="편집 취소"
        >
          ✕
        </button>
        <div className="text-center">
          <h1 className="text-sm font-semibold">{title}</h1>
          {queueLabel ? (
            <p className="mt-0.5 text-[11px] text-white/55">{queueLabel}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isApplying || !croppedAreaPixels}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:text-white/35"
        >
          {isApplying ? '적용 중…' : '완료'}
        </button>
      </header>

      <div className="relative min-h-0 flex-1 bg-neutral-950">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="contain"
          showGrid
          style={{
            containerStyle: { background: '#0a0a0a' },
            cropAreaStyle: {
              border: '1px solid rgba(255,255,255,0.85)',
            },
          }}
        />
      </div>

      <div className="shrink-0 space-y-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <p className="text-center text-xs text-white/55">
          사진을 드래그해 위치를 맞추고, 슬라이더로 확대·축소하세요
        </p>
        <label className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-[11px] font-medium text-white/60">
            확대
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={isApplying}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white disabled:opacity-40"
            aria-label="확대/축소"
          />
        </label>
      </div>
    </div>
  )
}
