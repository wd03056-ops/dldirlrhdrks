import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearStoredUser,
  restoreSession,
  startAppSession,
} from '../services/tossAuth'
import { signOutFirebase } from '../services/firebase'
import type { AuthUser } from '../types/auth'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isInitializing: boolean
  isLoggingIn: boolean
  error: string | null
  login: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        // 검수: 인트로 없이 즉시 토스 로그인 유도 금지
        // → 부팅 시에는 저장된 세션만 복원하고, 로그인은 인트로 CTA에서만 시작
        const restored = await restoreSession()
        if (cancelled) return
        if (restored) setUser(restored)
      } catch (bootError) {
        console.error('[Auth] boot 실패', bootError)
        if (!cancelled) {
          setError(
            errorMessage(
              bootError,
              '사용자를 확인하지 못했어요. 다시 시도해 주세요.',
            ),
          )
        }
      } finally {
        if (!cancelled) setIsInitializing(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async () => {
    setIsLoggingIn(true)
    setError(null)
    try {
      const loggedInUser = await startAppSession()
      setUser(loggedInUser)
    } catch (loginError) {
      console.error('[Auth] login 실패', loginError)
      setError(
        errorMessage(loginError, '시작에 실패했어요. 다시 시도해 주세요.'),
      )
    } finally {
      setIsLoggingIn(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearStoredUser()
    setUser(null)
    setError(null)
    void signOutFirebase()
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isInitializing,
      isLoggingIn,
      error,
      login,
      logout,
    }),
    [user, isInitializing, isLoggingIn, error, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
