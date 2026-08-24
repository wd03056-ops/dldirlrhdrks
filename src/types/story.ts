import type { Timestamp } from 'firebase/firestore'

/**
 * 게시물 안 한 장의 슬라이드(사진 + 추가 글 + 작성자)
 */
export interface StorySlide {
  id: string
  /** 사진 URL. 글만 추가한 경우 null */
  url: string | null
  /** 슬라이드(추가 글) 제목 — 협업 추가 시 사용 */
  title?: string
  text: string
  authorId?: string
  authorName?: string
  createdAt?: number
}

/**
 * 이야기(스토리)
 * Firestore: rooms/{roomId}/stories/{storyId}
 */
export interface Story {
  id: string
  roomId: string
  /**
   * 하위 호환용. 새 이야기는 항상 null.
   * (과거 주제 폴더 구조에서 사용)
   */
  parentId: string | null
  title: string
  /** 원글(게시물) 본문 — 협업 추가 시에도 유지 */
  content?: string
  /**
   * @deprecated slides 로 이전. 하위 호환 읽기용
   */
  photos: string[]
  /** 협업 슬라이드(사진/추가글/작성자) */
  slides: StorySlide[]
  /** 카드/목록용 대표 사진 */
  coverPhoto: string | null
  authorId?: string
  authorName?: string
  /** YYYY-MM-DD */
  date?: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/** 문서 생성 시 클라이언트에서 넘기는 입력 (id·타임스탬프 제외) */
export type StoryCreateInput = Omit<
  Story,
  'id' | 'createdAt' | 'updatedAt' | 'slides'
> & {
  slides?: StorySlideInput[]
}

export type StoryUpdateInput = Partial<
  Omit<Story, 'id' | 'roomId' | 'createdAt' | 'updatedAt'>
>

export type StorySlideInput = Omit<StorySlide, 'id' | 'createdAt'> & {
  id?: string
  createdAt?: number
}
