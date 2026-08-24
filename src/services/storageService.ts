import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
  type UploadMetadata,
  type UploadTaskSnapshot,
} from 'firebase/storage'
import { ensureFirebaseAuth } from './firebase'
import { storage } from './firebase'

/** 업로드 최대 용량: 5MB */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** 허용 이미지 MIME */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]

export type StorageUploadErrorCode = 'file-too-large' | 'invalid-type'

export class StorageUploadError extends Error {
  readonly code: StorageUploadErrorCode

  constructor(code: StorageUploadErrorCode, message: string) {
    super(message)
    this.name = 'StorageUploadError'
    this.code = code
  }
}

export type UploadProgress = {
  bytesTransferred: number
  totalBytes: number
  /** 0 ~ 100 */
  progress: number
}

export type UploadResult = {
  path: string
  downloadURL: string
}

function createObjectId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function extensionFromMime(mime: string) {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
  }
  return map[mime.toLowerCase()] ?? 'bin'
}

function extensionFromFileName(fileName?: string) {
  if (!fileName) return null
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1].toLowerCase() : null
}

function mimeFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)/i)
  return match?.[1]?.toLowerCase() ?? ''
}

function normalizeMime(mime: string) {
  const value = mime.trim().toLowerCase()
  if (value === 'image/jpg') return 'image/jpeg'
  return value
}

function isAllowedImageMime(mime: string) {
  const normalized = normalizeMime(mime)
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized)
}

function formatMb(bytes: number) {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`
}

/**
 * 용량·이미지 형식 검사. 통과하지 못하면 StorageUploadError.
 */
export function assertValidUploadFile(
  blob: Blob,
  options?: { fileName?: string; contentType?: string },
) {
  if (blob.size <= 0) {
    throw new StorageUploadError('invalid-type', '빈 파일은 업로드할 수 없어요.')
  }

  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new StorageUploadError(
      'file-too-large',
      `파일 크기는 ${formatMb(MAX_UPLOAD_BYTES)} 이하여야 해요. (현재 ${formatMb(blob.size)})`,
    )
  }

  const contentType = normalizeMime(
    options?.contentType || blob.type || '',
  )
  if (!contentType || !isAllowedImageMime(contentType)) {
    throw new StorageUploadError(
      'invalid-type',
      'JPEG, PNG, WebP, GIF, HEIC 이미지만 업로드할 수 있어요.',
    )
  }
}

/**
 * data URL → Blob (미리보기용 base64를 Storage에 올릴 때)
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  if (!response.ok) {
    throw new Error('data URL을 Blob으로 바꾸지 못했어요.')
  }
  return response.blob()
}

async function toBlob(
  file: File | Blob | string,
): Promise<{ blob: Blob; fileName?: string; contentTypeHint?: string }> {
  if (typeof file === 'string') {
    if (file.startsWith('data:')) {
      const contentTypeHint = mimeFromDataUrl(file)
      const blob = await dataUrlToBlob(file)
      return { blob, contentTypeHint }
    }
    if (file.startsWith('blob:')) {
      const response = await fetch(file)
      if (!response.ok) throw new Error('blob URL을 읽지 못했어요.')
      return { blob: await response.blob() }
    }
    throw new Error('지원하지 않는 파일 형식이에요. File/Blob/data URL만 가능해요.')
  }

  if (file instanceof File) {
    return { blob: file, fileName: file.name, contentTypeHint: file.type }
  }

  return { blob: file, contentTypeHint: file.type }
}

function buildStoragePath(
  folder: string,
  options?: { fileName?: string; contentType?: string },
) {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
  const ext =
    extensionFromFileName(options?.fileName) ||
    extensionFromMime(options?.contentType || 'image/jpeg')
  return `${cleanFolder}/${createObjectId()}.${ext}`
}

async function prepareUpload(
  file: File | Blob | string,
  options?: { contentType?: string },
) {
  const { blob, fileName, contentTypeHint } = await toBlob(file)
  const contentType = normalizeMime(
    options?.contentType || contentTypeHint || blob.type || '',
  )
  assertValidUploadFile(blob, { fileName, contentType })
  return { blob, fileName, contentType }
}

/**
 * 파일을 Storage에 업로드하고 다운로드 URL을 반환해요.
 *
 * @example
 * const { downloadURL, path } = await uploadFile(file, 'rooms/abc/stories')
 */
export async function uploadFile(
  file: File | Blob | string,
  folder: string,
  options?: {
    /** 저장 경로를 직접 지정 (folder 무시) */
    path?: string
    contentType?: string
    metadata?: UploadMetadata
  },
): Promise<UploadResult> {
  await ensureFirebaseAuth()
  const { blob, fileName, contentType } = await prepareUpload(file, options)
  const path =
    options?.path ||
    buildStoragePath(folder, { fileName, contentType })

  const objectRef = ref(storage, path)
  await uploadBytes(objectRef, blob, {
    contentType,
    ...options?.metadata,
  })

  const downloadURL = await getDownloadURL(objectRef)
  return { path, downloadURL }
}

/**
 * 진행률 콜백이 필요한 업로드 (큰 사진 등)
 */
export function uploadFileWithProgress(
  file: File | Blob | string,
  folder: string,
  options?: {
    path?: string
    contentType?: string
    metadata?: UploadMetadata
    onProgress?: (progress: UploadProgress) => void
  },
): Promise<UploadResult> {
  return (async () => {
    await ensureFirebaseAuth()
    const { blob, fileName, contentType } = await prepareUpload(file, options)
    const path =
      options?.path ||
      buildStoragePath(folder, { fileName, contentType })

    const objectRef = ref(storage, path)
    const task = uploadBytesResumable(objectRef, blob, {
      contentType,
      ...options?.metadata,
    })

    return new Promise<UploadResult>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const totalBytes = snapshot.totalBytes || 1
          options?.onProgress?.({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes,
            progress: Math.round(
              (snapshot.bytesTransferred / totalBytes) * 100,
            ),
          })
        },
        reject,
        async () => {
          try {
            const downloadURL = await getDownloadURL(task.snapshot.ref)
            resolve({ path, downloadURL })
          } catch (error) {
            reject(error)
          }
        },
      )
    })
  })()
}

/**
 * 여러 파일을 순서대로 업로드하고 다운로드 URL 배열을 반환해요.
 */
export async function uploadFiles(
  files: Array<File | Blob | string>,
  folder: string,
): Promise<UploadResult[]> {
  const results: UploadResult[] = []
  for (const file of files) {
    results.push(await uploadFile(file, folder))
  }
  return results
}

/**
 * Storage 경로로 다운로드 URL을 다시 가져와요.
 */
export async function getFileDownloadURL(path: string) {
  await ensureFirebaseAuth()
  return getDownloadURL(ref(storage, path))
}

/**
 * Storage 객체 삭제
 */
export async function deleteFile(path: string) {
  await ensureFirebaseAuth()
  await deleteObject(ref(storage, path))
}

/**
 * 스토리 사진 업로드용 헬퍼
 * rooms/{roomId}/stories/{storyId?}/...
 */
export async function uploadStoryPhoto(
  file: File | Blob | string,
  roomId: string,
  storyId?: string,
) {
  const folder = storyId
    ? `rooms/${roomId}/stories/${storyId}`
    : `rooms/${roomId}/stories`
  return uploadFile(file, folder)
}

/** 이미 Storage/원격에 올라간 URL인지 */
export function isRemotePhotoUrl(url: string) {
  return /^https?:\/\//i.test(url.trim())
}

/**
 * data URL / blob URL 은 Storage에 올리고, 기존 https URL은 그대로 둡니다.
 * Firestore에는 항상 원격 다운로드 URL만 저장하세요.
 */
export async function resolveRemotePhotoUrls(
  photos: string[],
  roomId: string,
  storyId?: string,
): Promise<string[]> {
  const resolved: string[] = []

  for (const photo of photos) {
    const value = photo?.trim()
    if (!value) continue

    if (isRemotePhotoUrl(value)) {
      resolved.push(value)
      continue
    }

    const { downloadURL } = await uploadStoryPhoto(value, roomId, storyId)
    resolved.push(downloadURL)
  }

  return resolved
}
