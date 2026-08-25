/**
 * Firestore 경로용 roomId 정규화.
 * 유효하지 않으면 테스트용 기본 ID로 넘어가지 않고 에러를 던집니다.
 */
export function resolveFirestoreRoomId(
  roomId: string | number | null | undefined,
): string {
  if (roomId === null || roomId === undefined) {
    throw new Error('유효한 모임 ID가 없어요.')
  }
  const normalized = String(roomId).trim()
  if (!normalized || normalized === '0' || normalized === 'NaN') {
    throw new Error('유효한 모임 ID가 없어요.')
  }
  return normalized
}
