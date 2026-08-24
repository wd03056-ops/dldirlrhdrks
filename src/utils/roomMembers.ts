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
 * 만든 사람이 나가도 방은 삭제되지 않고 유지됩니다.
 */
export function leaveRoom(
  room: Room,
  user: Pick<AuthUser, 'id' | 'name'>,
): Room {
  const nextList = room.memberList.filter(
    (member) => !isSameMember(member, user),
  )

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

/** @deprecated 방은 나가도 삭제하지 않아요. 호환용으로만 남겨 둡니다. */
export function clearRoomLocalData(room: Room) {
  try {
    localStorage.removeItem(`story-local-edits-v1-${room.id}`)
    localStorage.removeItem(`woori-schedules-v1-${room.id}`)
    room.memories?.forEach(clearStoryLocalKeys)
  } catch {
    // ignore
  }
}
