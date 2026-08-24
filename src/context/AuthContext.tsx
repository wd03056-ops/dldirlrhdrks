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
  isInTossApp,
  loginWithToss,
  resolveAnonymousUser,
  restoreSession,
} from '../services/tossAuth'
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        if (isInTossApp()) {
          const nextUser = await loginWithToss()
          if (!cancelled) setUser(nextUser)
          return
        }

        const restored = await restoreSession()
        if (cancelled) return
        if (restored) {
          setUser(restored)
          return
        }

        const nextUser = await resolveAnonymousUser()
        if (!cancelled) setUser(nextUser)
      } catch {
        if (!cancelled) {
          setError(
            isInTossApp()
              ? '토스 로그인을 완료해 주세요.'
              : '사용자를 확인하지 못했어요. 다시 시도해 주세요.',
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
      const loggedInUser = isInTossApp()
        ? await loginWithToss()
        : await resolveAnonymousUser()
      setUser(loggedInUser)
    } catch {
      setError('시작에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setIsLoggingIn(false)
    }
  }, [])

  const logout = useCallback(() => {
    clearStoredUser()
    setUser(null)
    setError(null)
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
