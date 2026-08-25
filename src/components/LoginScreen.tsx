import { useAuth } from '../context/AuthContext'

const FEATURES = [
  {
    title: '우리만의 모임',
    body: '초대한 사람들끼리만 모이는 공간을 만들고, 일상을 나눠요.',
  },
  {
    title: '이어 쓰는 이야기',
    body: '사진과 글을 남기고, 같은 이야기에 이어서 대화를 이어가요.',
  },
  {
    title: '함께 잡는 일정',
    body: '모임 일정을 공유하고 구성원이 함께 확인할 수 있어요.',
  },
] as const

/**
 * 서비스 소개 인트로 → 사용자가 CTA를 누른 뒤에만 토스 로그인 진행
 * (앱인토스 검수: 즉시 로그인 유도 금지)
 */
export default function LoginScreen() {
  const { login, isLoggingIn, error } = useAuth()

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white font-sans text-black">
      <main className="flex flex-1 flex-col px-6 pb-8 pt-12">
        <p className="mb-2 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
          우리들만의 공간
        </p>
        <h1 className="mb-3 text-[28px] font-bold leading-tight tracking-tight">
          소중한 추억을
          <br />
          함께 기록해요
        </h1>
        <p className="mb-8 max-w-sm text-[15px] leading-relaxed text-neutral-500">
          친구·가족과만 나누는 비공개 공간이에요. 이야기와 사진, 일정을 한곳에
          모아 둘 수 있어요.
        </p>

        <ul className="mb-10 flex flex-col gap-4">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-3">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-black"
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold text-black">
                  {feature.title}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-neutral-500">
                  {feature.body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-3">
          <p className="text-center text-xs leading-relaxed text-neutral-400">
            시작하기를 누르면 토스 로그인으로 연결돼요.
            <br />
            로그인 정보는 모임 이용에만 사용돼요.
          </p>
          <button
            type="button"
            onClick={() => void login()}
            disabled={isLoggingIn}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-black text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {isLoggingIn ? '로그인 중...' : '토스로 시작하기'}
          </button>
          {error ? (
            <p className="text-center text-xs text-red-500">{error}</p>
          ) : null}
        </div>
      </main>
    </div>
  )
}
