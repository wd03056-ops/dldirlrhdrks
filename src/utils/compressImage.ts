import imageCompression from 'browser-image-compression'

/** 업로드 전 클라이언트 압축 목표 */
export const IMAGE_COMPRESS_MAX_SIZE_MB = 1
export const IMAGE_COMPRESS_MAX_DIMENSION = 1024

function toFile(blob: Blob, original: File): File {
  if (blob instanceof File) return blob

  const baseName = original.name.replace(/\.[^.]+$/, '') || 'image'
  const ext =
    blob.type === 'image/png'
      ? 'png'
      : blob.type === 'image/webp'
        ? 'webp'
        : 'jpg'
  return new File([blob], `${baseName}.${ext}`, {
    type: blob.type || 'image/jpeg',
    lastModified: Date.now(),
  })
}

/**
 * 선택 직후 1MB 이하 · 긴 변 1024px 이하로 압축합니다.
 * Firebase Storage 업로드 전에 호출하세요.
 */
export async function compressImageFile(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: IMAGE_COMPRESS_MAX_SIZE_MB,
    maxWidthOrHeight: IMAGE_COMPRESS_MAX_DIMENSION,
    useWebWorker: true,
    initialQuality: 0.8,
  })
  return toFile(compressed, file)
}
