import type { AuthUser } from '../types/auth'
import type { Room, RoomMember, RoomMemory } from '../types/room'

export function isSameMember(
  member: RoomMember,
  user: Pick<AuthUser, 'id' | 'name'>,
) {
  if (member.userId) return member.userId === user.id
  return member.name === user.name
}

export function isRoomMember(room: Room, user: Pick<AuthUser, 'id' | 'name'>) {
  return room.memberList.some((member) => isSameMember(member, user))
}

export function createRoomMember(
  user: Pick<AuthUser, 'id' | 'name'>,
  id = Date.now(),
): RoomMember {
  return {
    id,
    name: user.name,
    userId: user.id,
  }
}

/**
 * 멤버를 방에서 제거합니다.
 * 남은 멤버가 없으면 null을 반환해 방 전체 삭제를 의미합니다.
 */
export function leaveRoom(
  room: Room,
  user: Pick<AuthUser, 'id' | 'name'>,
): Room | null {
  const nextList = room.memberList.filter(
    (member) => !isSameMember(member, user),
  )

  if (nextList.length === 0) return null

  return {
    ...room,
    memberList: nextList,
    members: nextList.length,
  }
}

function clearStoryLocalKeys(memory: RoomMemory) {
  localStorage.removeItem(`story-detail-entries-v2-${memory.id}`)
  localStorage.removeItem(`story-detail-local-v1-${memory.id}`)
  memory.children?.forEach(clearStoryLocalKeys)
}

/** 마지막 멤버 퇴장 시 방 관련 로컬 데이터 정리 */
export function clearRoomLocalData(room: Room) {
  try {
    localStorage.removeItem(`story-local-edits-v1-${room.id}`)
    localStorage.removeItem(`woori-schedules-v1-${room.id}`)
    room.memories?.forEach(clearStoryLocalKeys)
  } catch {
    // ignore
  }
}
