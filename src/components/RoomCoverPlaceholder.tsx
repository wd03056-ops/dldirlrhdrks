/** 방 대표 사진이 없을 때 쓰는 그룹(사람들) 실루엣 */
export default function RoomCoverPlaceholder({
  className = 'h-14 w-14',
}: {
  className?: string
}) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-[#F0EFEC] via-[#F7F6F3] to-[#E8E6E1] ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        className="h-[46%] w-[46%] text-neutral-400"
      >
        {/* 왼쪽 사람 */}
        <circle cx="18" cy="20" r="7" fill="currentColor" opacity="0.55" />
        <path
          d="M6 44c0-7.2 5.4-13 12-13s12 5.8 12 13"
          fill="currentColor"
          opacity="0.55"
        />
        {/* 오른쪽 사람 */}
        <circle cx="46" cy="20" r="7" fill="currentColor" opacity="0.55" />
        <path
          d="M34 44c0-7.2 5.4-13 12-13s12 5.8 12 13"
          fill="currentColor"
          opacity="0.55"
        />
        {/* 가운데(앞) 사람 */}
        <circle cx="32" cy="24" r="8.5" fill="currentColor" />
        <path
          d="M16 50c0-8.3 7.2-15 16-15s16 6.7 16 15"
          fill="currentColor"
        />
      </svg>
    </div>
  )
}
