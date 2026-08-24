import type { Story, StorySlide } from './story'

/**
 * UI 피드용 이야기
 */
export type DisplayMemory = {
  id: string
  title: string
  lastPhoto: string | null
  date?: string
  content?: string
  photos?: string[]
  slides: StorySlide[]
  author?: string
  authorId?: string
}

export function storyToDisplayMemory(story: Story): DisplayMemory {
  const slides = story.slides ?? []
  const photos =
    slides.length > 0
      ? slides
          .map((slide) => slide.url)
          .filter((url): url is string => Boolean(url))
      : story.photos

  return {
    id: story.id,
    title: story.title,
    lastPhoto: story.coverPhoto ?? photos[0] ?? null,
    date: story.date,
    content: story.content,
    photos: photos.length > 0 ? photos : undefined,
    slides,
    author: story.authorName,
    authorId: story.authorId,
  }
}
