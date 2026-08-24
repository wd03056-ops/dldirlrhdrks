const ONBOARDING_STORAGE_KEY = 'woori-onboarding-seen-v2'

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

const SECTIONS = [
  {
    title: '새 글 작성하기',
    body: '홈 화면에서 새 글을 작성하면, 독립된 새로운 게시물로 등록됩니다. 새로운 주제나 오늘의 첫 이야기를 시작하고 싶을 때 사용해 보세요.',
  },
  {
    title: '사진/글 릴레이 대화하기',
    body: '이미 등록된 게시물을 꾹 누르면 글과 사진을 이어서 추가할 수 있습니다. 마치 대화하듯 하나의 주제에 꼬리를 물고 소통할 수 있습니다.',
  },
] as const

type OnboardingGuideProps = {
  isOpen: boolean
  onClose: () => void
}

export default function OnboardingGuide({
  isOpen,
  onClose,
}: OnboardingGuideProps) {
  if (!isOpen) return null

  const finish = () => {
    markOnboardingSeen()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-5 backdrop-blur-[2px]"
      onClick={finish}
      role="presentation"
    >
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_20px_56px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="앱 사용 설명서"
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="text-[11px] font-semibold tracking-wider text-neutral-400">
            도움말
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-[11px] font-medium text-neutral-400 underline-offset-2 hover:text-black hover:underline"
          >
            닫기
          </button>
        </div>

        <div className="relative max-h-[65dvh] overflow-y-auto px-6 pt-5 pb-4">
          <h2 className="text-xl font-bold tracking-tight text-black">
            이야기를 이어가는 방법
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            우리끼리 일상을 나누고 이야기를 이어가는 방법입니다. 상황에 맞춰
            아래 기능을 이용해 보세요!
          </p>

          <div className="mt-6 space-y-3">
            {SECTIONS.map((section) => (
              <div
                key={section.title}
                className="rounded-2xl bg-[#F7F6F3] px-4 py-3.5"
              >
                <h3 className="text-[13px] font-bold text-[#1A1A1A]">
                  {section.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#333331]">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={finish}
            className="w-full rounded-2xl bg-black py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition hover:bg-neutral-800"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
