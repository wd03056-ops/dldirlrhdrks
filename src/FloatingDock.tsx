type FloatingDockProps = {
  tab: 'home' | 'profile'
  onTabChange: (tab: 'home' | 'profile') => void
  isMenuOpen: boolean
  onToggleMenu: () => void
  onCreateRoom: () => void
  onJoinByLink: () => void
}

export default function FloatingDock({
  tab,
  onTabChange,
  isMenuOpen,
  onToggleMenu,
  onCreateRoom,
  onJoinByLink,
}: FloatingDockProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-40 mx-auto flex max-w-md flex-col items-center px-6">
      {isMenuOpen ? (
        <div className="pointer-events-auto mb-3 flex w-full max-w-sm items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onCreateRoom}
            className="flex-1 rounded-full border-0 bg-white px-3 py-3 text-center text-xs font-semibold text-black shadow-lg transition hover:shadow-xl active:scale-[0.98]"
          >
            모임 만들기
          </button>
          <button
            type="button"
            onClick={onJoinByLink}
            className="flex-1 rounded-full border-0 bg-white px-3 py-3 text-center text-xs font-semibold text-black shadow-lg transition hover:shadow-xl active:scale-[0.98]"
          >
            주소로 참여하기
          </button>
        </div>
      ) : null}

      <nav
        className="pointer-events-auto flex w-full max-w-sm items-center justify-between rounded-full border border-black/5 bg-white/95 px-5 py-2.5 shadow-lg backdrop-blur-md"
        aria-label="하단 메뉴"
      >
        <button
          type="button"
          onClick={() => {
            onTabChange('home')
            if (isMenuOpen) onToggleMenu()
          }}
          className={`flex flex-1 flex-col items-center gap-0.5 transition ${
            tab === 'home' && !isMenuOpen ? 'text-black' : 'text-neutral-400'
          }`}
          aria-label="홈"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="text-[10px] font-medium">홈</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onTabChange('home')
            onToggleMenu()
          }}
          className="-my-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-md transition hover:bg-neutral-800 active:scale-95"
          aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={isMenuOpen}
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => {
            onTabChange('profile')
            if (isMenuOpen) onToggleMenu()
          }}
          className={`flex flex-1 flex-col items-center gap-0.5 transition ${
            tab === 'profile' ? 'text-black' : 'text-neutral-400'
          }`}
          aria-label="내 정보"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="text-[10px] font-medium">내 정보</span>
        </button>
      </nav>
    </div>
  )
}
