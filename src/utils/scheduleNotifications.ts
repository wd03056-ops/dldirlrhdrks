export type ScheduleNotification = {
  id: string
  roomId: number
  roomTitle: string
  scheduleId: string
  scheduleTitle: string
  dateKey: string
  createdAt: number
  read: boolean
}

function storageKeyForUser(userId: string) {
  return `woori-schedule-notifs-v1-${userId}`
}

function storageKeyForName(name: string) {
  return `woori-schedule-notifs-name-v1-${name}`
}

function loadAll(storageKey: string): ScheduleNotification[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as ScheduleNotification[]) : []
  } catch {
    return []
  }
}

function saveAll(storageKey: string, items: ScheduleNotification[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items.slice(0, 80)))
  } catch {
    // ignore
  }
}

function resolveRecipientKeys(
  members: { userId?: string; name: string }[],
  excludeUserId?: string,
  excludeName?: string,
) {
  const keys = new Set<string>()
  for (const member of members) {
    if (member.userId) {
      if (member.userId === excludeUserId) continue
      keys.add(storageKeyForUser(member.userId))
    } else if (member.name) {
      if (excludeName && member.name === excludeName) continue
      keys.add(storageKeyForName(member.name))
    }
  }
  return [...keys]
}

/** 일정 생성 시 방 구성원에게 인앱 알림을 남깁니다 (작성자 제외). */
export function notifyScheduleCreated(params: {
  roomId: number
  roomTitle: string
  scheduleId: string
  scheduleTitle: string
  dateKey: string
  members: { userId?: string; name: string }[]
  excludeUserId?: string
  excludeName?: string
}) {
  const {
    roomId,
    roomTitle,
    scheduleId,
    scheduleTitle,
    dateKey,
    members,
    excludeUserId,
    excludeName,
  } = params

  const keys = resolveRecipientKeys(members, excludeUserId, excludeName)

  for (const key of keys) {
    const next: ScheduleNotification = {
      id: `${scheduleId}-${key}-${Date.now()}`,
      roomId,
      roomTitle,
      scheduleId,
      scheduleTitle,
      dateKey,
      createdAt: Date.now(),
      read: false,
    }
    saveAll(key, [next, ...loadAll(key)])
  }

  return keys.length
}

function keysForViewer(userId?: string, name?: string) {
  const keys: string[] = []
  if (userId) keys.push(storageKeyForUser(userId))
  if (name) keys.push(storageKeyForName(name))
  return keys
}

export function getUnreadScheduleNotifications(
  user: { id?: string; name?: string },
  roomId?: number,
): ScheduleNotification[] {
  const seen = new Set<string>()
  const items: ScheduleNotification[] = []
  for (const key of keysForViewer(user.id, user.name)) {
    for (const n of loadAll(key)) {
      if (n.read) continue
      if (roomId !== undefined && n.roomId !== roomId) continue
      if (seen.has(n.id)) continue
      seen.add(n.id)
      items.push(n)
    }
  }
  return items.sort((a, b) => b.createdAt - a.createdAt)
}

export function markRoomScheduleNotificationsRead(
  user: { id?: string; name?: string },
  roomId: number,
) {
  for (const key of keysForViewer(user.id, user.name)) {
    const next = loadAll(key).map((n) =>
      n.roomId === roomId ? { ...n, read: true } : n,
    )
    saveAll(key, next)
  }
}
