/** roomId가 비어 있을 때 쓰는 Firestore 테스트용 기본 ID */
export const FALLBACK_ROOM_ID = 'test-room-1'

/**
 * Firestore 경로용 roomId 정규화.
 * 숫자 0, 빈 문자열, null/undefined 이면 test-room-1 사용.
 */
export function resolveFirestoreRoomId(
  roomId: string | number | null | undefined,
): string {
  if (roomId === null || roomId === undefined) return FALLBACK_ROOM_ID
  const normalized = String(roomId).trim()
  if (!normalized || normalized === '0' || normalized === 'NaN') {
    return FALLBACK_ROOM_ID
  }
  return normalized
}
