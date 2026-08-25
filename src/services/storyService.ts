import {
  addDoc,
  arrayUnion,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { ensureFirebaseAuth } from './firebase'
import { storiesCollection, storyDocument } from './firestorePaths'
import { resolveFirestoreRoomId } from '../utils/firestoreRoomId'
import type {
  Story,
  StoryCreateInput,
  StorySlide,
  StorySlideInput,
  StoryUpdateInput,
} from '../types/story'
import {
  storyToDisplayMemory,
  type DisplayMemory,
} from '../types/displayMemory'

export const STORIES_PAGE_SIZE = 10

type StoriesRoomCache = {
  stories: Story[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
  fetchedAt: number
}

/** 방별 피드 페이지 캐시 — 같은 방 재진입 시 불필요한 재조회 방지 */
const storiesRoomCache = new Map<string, StoriesRoomCache>()

const CACHE_TTL_MS = 5 * 60 * 1000

function createSlideId() {
  return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function shrinkDataUrl(value: string | null, label: string): string | null {
  if (!value) return null
  if (value.length > 400_000) {
    console.warn(`[Firestore] ${label} 가 너무 커서 placeholder로 대체합니다`)
    return `placeholder://${label}`
  }
  return value
}

function normalizeSlide(
  raw: unknown,
  fallback?: Partial<StorySlide>,
): StorySlide | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const url =
    typeof data.url === 'string'
      ? data.url
      : typeof data.photo === 'string'
        ? data.photo
        : (fallback?.url ?? null)
  const text =
    typeof data.text === 'string'
      ? data.text
      : typeof data.content === 'string'
        ? data.content
        : (fallback?.text ?? '')
  const id =
    typeof data.id === 'string' && data.id
      ? data.id
      : (fallback?.id ?? createSlideId())

  return {
    id,
    url,
    title:
      typeof data.title === 'string'
        ? data.title
        : (fallback?.title ?? undefined),
    text,
    authorId:
      (typeof data.authorId === 'string' ? data.authorId : undefined) ??
      fallback?.authorId,
    authorName:
      (typeof data.authorName === 'string'
        ? data.authorName
        : typeof data.author === 'string'
          ? data.author
          : undefined) ?? fallback?.authorName,
    createdAt:
      typeof data.createdAt === 'number'
        ? data.createdAt
        : (fallback?.createdAt ?? Date.now()),
    origin:
      data.origin === 'append' || data.origin === 'create'
        ? data.origin
        : fallback?.origin,
  }
}

/** 구 photos[] / content 를 slides 로 복원 */
export function buildSlidesFromLegacy(data: {
  slides?: unknown
  photos?: unknown
  content?: unknown
  authorId?: unknown
  authorName?: unknown
  coverPhoto?: unknown
}): StorySlide[] {
  if (Array.isArray(data.slides) && data.slides.length > 0) {
    return data.slides
      .map((item) => normalizeSlide(item))
      .filter((item): item is StorySlide => item != null)
  }

  const legacyPhotos = Array.isArray(data.photos)
    ? (data.photos as string[]).filter((photo) => typeof photo === 'string')
    : []
  const content = typeof data.content === 'string' ? data.content : ''
  const authorId =
    typeof data.authorId === 'string' ? data.authorId : undefined
  const authorName =
    typeof data.authorName === 'string' ? data.authorName : undefined

  if (legacyPhotos.length > 0) {
    return legacyPhotos.map((url, index) => ({
      id: `legacy-${index}`,
      url,
      text: index === 0 ? content : '',
      authorId,
      authorName,
      createdAt: Date.now() + index,
    }))
  }

  if (content.trim() || data.coverPhoto) {
    return [
      {
        id: 'legacy-0',
        url: typeof data.coverPhoto === 'string' ? data.coverPhoto : null,
        text: content,
        authorId,
        authorName,
        createdAt: Date.now(),
      },
    ]
  }

  return []
}

function mapStory(snap: DocumentSnapshot<DocumentData>, roomId: string): Story {
  const data = snap.data() ?? {}
  const slides = buildSlidesFromLegacy(data)
  const photos =
    slides.length > 0
      ? slides
          .map((slide) => slide.url)
          .filter((url): url is string => Boolean(url))
      : Array.isArray(data.photos)
        ? (data.photos as string[])
        : []

  return {
    id: snap.id,
    roomId,
    parentId: (data.parentId as string | null) ?? null,
    title: (data.title as string) ?? '',
    content: data.content as string | undefined,
    photos,
    slides,
    coverPhoto: (data.coverPhoto as string | null) ?? photos[0] ?? null,
    authorId: data.authorId as string | undefined,
    authorName: data.authorName as string | undefined,
    date: data.date as string | undefined,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  }
}

function sortByCreatedAtDesc(list: Story[]) {
  return [...list].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? 0
    const bTime = b.createdAt?.toMillis?.() ?? 0
    return bTime - aTime
  })
}

function toSafeSlides(
  slides: StorySlideInput[],
  defaultOrigin: 'create' | 'append' = 'create',
): StorySlide[] {
  return slides.map((slide, index) => {
    const next: StorySlide = {
      id: slide.id ?? createSlideId(),
      url: shrinkDataUrl(slide.url ?? null, `slide-${index}`),
      text: slide.text ?? '',
      authorId: slide.authorId,
      authorName: slide.authorName,
      createdAt: slide.createdAt ?? Date.now() + index,
      origin: slide.origin ?? defaultOrigin,
    }
    const title = slide.title?.trim()
    if (title) next.title = title
    return next
  })
}

function isAppendedSlide(story: Pick<Story, 'authorId'>, slide: StorySlide) {
  if (slide.origin === 'append') return true
  if (slide.origin === 'create') return false
  if (slide.title?.trim()) return true
  if (slide.authorId && story.authorId && slide.authorId !== story.authorId) {
    return true
  }
  return false
}

function getCachedRoom(roomId: string): StoriesRoomCache | null {
  const cached = storiesRoomCache.get(roomId)
  if (!cached) return null
  if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    storiesRoomCache.delete(roomId)
    return null
  }
  return cached
}

function setCachedRoom(roomId: string, next: StoriesRoomCache) {
  storiesRoomCache.set(roomId, {
    ...next,
    fetchedAt: Date.now(),
  })
}

/** 캐시/로컬 상태용 — 특정 이야기 교체 */
export function upsertCachedStory(roomId: string | number, story: Story) {
  const id = resolveFirestoreRoomId(roomId)
  const cached = storiesRoomCache.get(id)
  if (!cached) {
    setCachedRoom(id, {
      stories: [story],
      lastDoc: null,
      hasMore: true,
      fetchedAt: Date.now(),
    })
    return
  }
  const exists = cached.stories.some((item) => item.id === story.id)
  const stories = exists
    ? cached.stories.map((item) => (item.id === story.id ? story : item))
    : [story, ...cached.stories]
  setCachedRoom(id, {
    ...cached,
    stories: sortByCreatedAtDesc(stories),
  })
}

/** 캐시에서 이야기 제거 */
export function removeCachedStory(roomId: string | number, storyId: string) {
  const id = resolveFirestoreRoomId(roomId)
  const cached = storiesRoomCache.get(id)
  if (!cached) return
  setCachedRoom(id, {
    ...cached,
    stories: cached.stories.filter((item) => item.id !== storyId),
  })
}

/** 캐시에 슬라이드만 병합 (재조회 없이 UI 반영) */
export function mergeCachedStorySlides(
  roomId: string | number,
  storyId: string,
  slides: StorySlide[],
) {
  const id = resolveFirestoreRoomId(roomId)
  const cached = storiesRoomCache.get(id)
  if (!cached) return
  setCachedRoom(id, {
    ...cached,
    stories: cached.stories.map((story) => {
      if (story.id !== storyId) return story
      const nextSlides = [...story.slides, ...slides]
      const photos = nextSlides
        .map((slide) => slide.url)
        .filter((url): url is string => Boolean(url))
      return {
        ...story,
        slides: nextSlides,
        photos,
      }
    }),
  })
}

export function clearStoriesCache(roomId?: string | number) {
  if (roomId == null) {
    storiesRoomCache.clear()
    return
  }
  storiesRoomCache.delete(resolveFirestoreRoomId(roomId))
}

export type StoriesPageResult = {
  stories: Story[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
  fromCache: boolean
}

/**
 * 최신순 페이지 조회
 * - pageSize 만큼만 읽음
 * - cursor(startAfter) 로 이어 붙임
 * - 첫 페이지는 TTL 캐시 재사용
 */
export async function getStoriesPage(
  roomId: string | number,
  options?: {
    pageSize?: number
    cursor?: QueryDocumentSnapshot<DocumentData> | null
    forceRefresh?: boolean
  },
): Promise<StoriesPageResult> {
  const id = resolveFirestoreRoomId(roomId)
  const pageSize = options?.pageSize ?? STORIES_PAGE_SIZE
  const cursor = options?.cursor ?? null
  const isFirstPage = !cursor

  if (isFirstPage && !options?.forceRefresh) {
    const cached = getCachedRoom(id)
    if (cached && cached.stories.length > 0) {
      return {
        stories: cached.stories,
        lastDoc: cached.lastDoc,
        hasMore: cached.hasMore,
        fromCache: true,
      }
    }
  }

  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
  if (cursor) {
    constraints.push(startAfter(cursor))
  }
  constraints.push(limit(pageSize))

  const pageQuery = query(storiesCollection(id), ...constraints)


  const snapshot = await getDocs(pageQuery)
  const pageStories = snapshot.docs.map((snap) => mapStory(snap, id))
  const lastDoc =
    snapshot.docs.length > 0
      ? snapshot.docs[snapshot.docs.length - 1]
      : null
  const hasMore = snapshot.docs.length === pageSize

  if (isFirstPage) {
    setCachedRoom(id, {
      stories: pageStories,
      lastDoc,
      hasMore,
      fetchedAt: Date.now(),
    })
  } else {
    const cached = storiesRoomCache.get(id)
    const merged = sortByCreatedAtDesc([
      ...(cached?.stories ?? []),
      ...pageStories,
    ])
    // dedupe by id
    const seen = new Set<string>()
    const unique = merged.filter((story) => {
      if (seen.has(story.id)) return false
      seen.add(story.id)
      return true
    })
    setCachedRoom(id, {
      stories: unique,
      lastDoc,
      hasMore,
      fetchedAt: Date.now(),
    })
  }

  return {
    stories: pageStories,
    lastDoc,
    hasMore,
    fromCache: false,
  }
}

/** @deprecated 전체 조회 — 가능하면 getStoriesPage 사용 */
export async function getStories(roomId: string | number): Promise<Story[]> {
  const page = await getStoriesPage(roomId, {
    pageSize: 50,
    forceRefresh: true,
  })
  return page.stories
}

/** rooms/{roomId}/stories/{storyId} 단건 조회 */
export async function getStory(
  roomId: string | number,
  storyId: string,
): Promise<Story | null> {
  const id = resolveFirestoreRoomId(roomId)
  const snap = await getDoc(storyDocument(id, storyId))
  if (!snap.exists()) return null
  const story = mapStory(snap, id)
  upsertCachedStory(id, story)
  return story
}

/** rooms/{roomId}/stories 에 이야기 추가 */
export async function addStory(
  roomId: string | number,
  input: Omit<StoryCreateInput, 'roomId'> & { roomId?: string },
): Promise<string> {
  await ensureFirebaseAuth()
  const id = resolveFirestoreRoomId(roomId)

  let slides =
    input.slides && input.slides.length > 0
      ? toSafeSlides(input.slides, 'create')
      : toSafeSlides(
          (input.photos ?? []).map((url, index) => ({
            url,
            text: index === 0 ? (input.content ?? '') : '',
            authorId: input.authorId,
            authorName: input.authorName,
            origin: 'create' as const,
          })),
          'create',
        )

  if (slides.length === 0 && (input.content || input.coverPhoto)) {
    slides = toSafeSlides([
      {
        url: input.coverPhoto ?? null,
        text: input.content ?? '',
        authorId: input.authorId,
        authorName: input.authorName,
      },
    ])
  }

  const photos = slides
    .map((slide) => slide.url)
    .filter((url): url is string => Boolean(url))
  const coverPhoto =
    shrinkDataUrl(input.coverPhoto ?? null, 'coverPhoto') ??
    photos[0] ??
    null

  const payload = {
    roomId: id,
    parentId: null,
    title: input.title,
    content: input.content ?? null,
    photos,
    slides,
    coverPhoto,
    authorId: input.authorId ?? null,
    authorName: input.authorName ?? null,
    date: input.date ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }


  const ref = await addDoc(storiesCollection(id), payload)

  upsertCachedStory(id, {
    id: ref.id,
    roomId: id,
    parentId: null,
    title: input.title,
    content: input.content,
    photos,
    slides,
    coverPhoto,
    authorId: input.authorId,
    authorName: input.authorName,
    date: input.date,
    createdAt: null,
    updatedAt: null,
  })

  return ref.id
}

/** rooms/{roomId}/stories/{storyId} 수정 */
export async function updateStory(
  roomId: string | number,
  storyId: string,
  input: StoryUpdateInput,
): Promise<void> {
  await ensureFirebaseAuth()
  const id = resolveFirestoreRoomId(roomId)
  const next: Record<string, unknown> = {
    ...input,
    updatedAt: serverTimestamp(),
  }

  if (input.slides) {
    const slides = toSafeSlides(input.slides)
    next.slides = slides
    next.photos = slides
      .map((slide) => slide.url)
      .filter((url): url is string => Boolean(url))
    if (!('coverPhoto' in input)) {
      next.coverPhoto = (next.photos as string[])[0] ?? null
    }
  }

  await updateDoc(storyDocument(id, storyId), next)

  const cached = storiesRoomCache.get(id)
  const prev = cached?.stories.find((story) => story.id === storyId)
  if (prev) {
    upsertCachedStory(id, {
      ...prev,
      ...input,
      slides: input.slides ? toSafeSlides(input.slides) : prev.slides,
      photos: input.slides
        ? toSafeSlides(input.slides)
            .map((slide) => slide.url)
            .filter((url): url is string => Boolean(url))
        : (input.photos ?? prev.photos),
      coverPhoto:
        input.coverPhoto !== undefined
          ? input.coverPhoto
          : input.slides
            ? (toSafeSlides(input.slides)
                .map((slide) => slide.url)
                .filter((url): url is string => Boolean(url))[0] ?? null)
            : prev.coverPhoto,
    })
  }
}

/**
 * 기존 게시물에 슬라이드 추가
 * - 문서 통째 덮어쓰기 없이 arrayUnion 으로만 추가
 * - 사전 getDoc 없이 write-only
 */
export async function appendStorySlides(
  roomId: string | number,
  storyId: string,
  newSlides: StorySlideInput[],
): Promise<StorySlide[]> {
  await ensureFirebaseAuth()
  const id = resolveFirestoreRoomId(roomId)
  const appended = toSafeSlides(newSlides, 'append')
  if (appended.length === 0) return []

  const photoUrls = appended
    .map((slide) => slide.url)
    .filter((url): url is string => Boolean(url))


  const patch: Record<string, unknown> = {
    slides: arrayUnion(...appended),
    updatedAt: serverTimestamp(),
  }
  if (photoUrls.length > 0) {
    patch.photos = arrayUnion(...photoUrls)
  }

  await updateDoc(storyDocument(id, storyId), patch)
  mergeCachedStorySlides(id, storyId, appended)
  return appended
}

export type DeleteStoryResult =
  | { keptAppended: false }
  | { keptAppended: true; story: Story }

/**
 * 원글 삭제
 * - 이어 쓴 슬라이드가 있으면 원글만 제거하고 문서는 유지
 * - 이어 쓴 글이 없으면 문서 삭제
 */
export async function deleteStory(
  roomId: string | number,
  storyId: string,
): Promise<DeleteStoryResult> {
  await ensureFirebaseAuth()
  const id = resolveFirestoreRoomId(roomId)
  const existing = await getStory(id, storyId)

  const remaining = (existing?.slides ?? []).filter((slide) =>
    existing ? isAppendedSlide(existing, slide) : false,
  )

  if (!existing || remaining.length === 0) {
    await deleteDoc(storyDocument(id, storyId))
    removeCachedStory(id, storyId)
    return { keptAppended: false }
  }

  const first = remaining[0]
  const photos = remaining
    .map((slide) => slide.url)
    .filter((url): url is string => Boolean(url))
  const nextStory: Story = {
    ...existing,
    title: first.title?.trim() || '',
    content: first.text ?? '',
    slides: remaining,
    photos,
    coverPhoto: photos[0] ?? null,
    authorId: first.authorId,
    authorName: first.authorName,
  }


  await updateDoc(storyDocument(id, storyId), {
    title: nextStory.title,
    content: nextStory.content,
    slides: remaining,
    photos,
    coverPhoto: nextStory.coverPhoto,
    authorId: nextStory.authorId ?? null,
    authorName: nextStory.authorName ?? null,
    updatedAt: serverTimestamp(),
  })
  upsertCachedStory(id, nextStory)
  return { keptAppended: true, story: nextStory }
}

/**
 * 피드용 플랫 목록.
 * - 과거 주제 폴더(다른 이야기의 parent)는 제외
 * - 주제 아래 있던 글(parentId 있음)은 그대로 노출
 * - 새 플랫 글(parentId null)은 내용/사진/작성자가 있는 경우만 노출
 */
export function storiesToDisplayMemories(stories: Story[]): DisplayMemory[] {
  const parentIds = new Set(
    stories
      .map((story) => story.parentId)
      .filter((pid): pid is string => typeof pid === 'string' && pid.length > 0),
  )

  return stories
    .filter((story) => {
      if (parentIds.has(story.id)) return false
      if (story.parentId != null) return true

      const hasSlides = story.slides.length > 0
      const hasPhotos =
        Boolean(story.coverPhoto) ||
        (Array.isArray(story.photos) && story.photos.length > 0)
      const hasContent = Boolean(story.content?.trim())
      const hasAuthor = Boolean(story.authorId || story.authorName)
      return hasSlides || hasPhotos || hasContent || hasAuthor
    })
    .map(storyToDisplayMemory)
}
