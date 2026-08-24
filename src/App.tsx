import AppHome from './AppHome'
import LoginScreen from './components/LoginScreen'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppsInTossNavigationProvider } from './context/AppsInTossNavigationContext'
import { ToastProvider } from './context/ToastContext'
import { useCallback, useState } from 'react'

function AppGate({ homeNonce }: { homeNonce: number }) {
  const { isAuthenticated, isInitializing } = useAuth()

  if (isInitializing) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center bg-white font-sans text-sm text-neutral-500">
        불러오는 중...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <AppHome key={homeNonce} />
}

function App() {
  const [homeNonce, setHomeNonce] = useState(0)
  const handleHome = useCallback(() => {
    setHomeNonce((value) => value + 1)
  }, [])

  return (
    <AuthProvider>
      <ToastProvider>
        <AppsInTossNavigationProvider onHome={handleHome}>
          <AppGate homeNonce={homeNonce} />
        </AppsInTossNavigationProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
