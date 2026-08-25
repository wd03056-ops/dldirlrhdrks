/** 모임 인박스 알림 (Firestore) */
export type InboxNotificationType = 'story_created' | 'story_appended'

export type InboxNotification = {
  id: string
  roomId: string
  type: InboxNotificationType
  storyId: string
  title: string
  authorId: string
  authorName: string
  recipientId: string
  read: boolean
  createdAt: number | null
}
