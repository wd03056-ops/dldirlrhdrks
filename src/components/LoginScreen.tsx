import { useAuth } from '../context/AuthContext'

export default function LoginScreen() {
  const { login, isLoggingIn, error } = useAuth()

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white px-6 font-sans text-black">
      <div className="flex flex-1 flex-col items-center justify-center pb-24 text-center">
        <p className="mb-2 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
          우리들만의 공간
        </p>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">
          소중한 추억을
          <br />
          함께 기록해요
        </h1>
        <p className="mb-10 max-w-xs text-sm leading-relaxed text-neutral-500">
          친구·가족과 일상을 나누고, 하나의 이야기에 사진을 이어 붙이며 대화를
          이어갈 수 있어요.
        </p>

        <button
          type="button"
          onClick={() => void login()}
          disabled={isLoggingIn}
          className="flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-black text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {isLoggingIn ? '시작하는 중...' : '시작하기'}
        </button>

        {error ? (
          <p className="mt-4 max-w-xs text-xs text-red-500">{error}</p>
        ) : null}
      </div>
    </div>
  )
}
