import type { Area } from 'react-easy-crop'

/**
 * react-easy-crop 의 croppedAreaPixels 로 canvas 크롭 이미지를 만듭니다.
 */
export async function getCroppedImageDataUrl(
  imageSrc: string,
  crop: Area,
  options?: {
    mimeType?: string
    quality?: number
    /** 출력 긴 변 상한 (기본 1024) */
    maxDimension?: number
  },
): Promise<string> {
  const image = await loadImage(imageSrc)
  const mimeType = options?.mimeType ?? 'image/jpeg'
  const quality = options?.quality ?? 0.88
  const maxDimension = options?.maxDimension ?? 1024

  let width = Math.max(1, Math.round(crop.width))
  let height = Math.max(1, Math.round(crop.height))

  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height)
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('이미지를 편집할 수 없어요.')
  }

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  )

  return canvas.toDataURL(mimeType, quality)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () =>
      reject(new Error('이미지를 불러오지 못했어요.')),
    )
    image.crossOrigin = 'anonymous'
    image.src = src
  })
}
