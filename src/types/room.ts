export type RoomMember = {
  id: number
  name: string
  /** 로그인 사용자 고유 ID — 동등한 멤버 식별용 (방장 구분 없음) */
  userId?: string
}

export type RoomMemory = {
  id: number
  title: string
  lastPhoto: string | null
  date?: string
  content?: string
  photos?: string[]
  author?: string
  children?: RoomMemory[]
}

export type Room = {
  id: number
  slug: string
  /** 현재 사용자에게 보이는 모임 이름 (멤버별 개인 설정) */
  title: string
  members: number
  memberList: RoomMember[]
  /**
   * @deprecated 방 목록 썸네일에는 쓰지 않음. 게시물에서 자동 추출되던 값.
   * 하위 호환을 위해 필드만 유지.
   */
  lastPhoto: string | null
  /** 현재 사용자에게 보이는 방 대표 사진 (멤버별 개인 설정) */
  coverPhoto?: string | null
  inviteMsg?: string
  memories?: RoomMemory[]
}
