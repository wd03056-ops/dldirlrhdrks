import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { graniteEvent, Screen } from '@apps-in-toss/web-framework'

type BackHandler = () => boolean

type NavigationBackContextValue = {
  /** 핸들러가 true를 반환하면 뒤로가기를 소비해요 */
  registerBackHandler: (handler: BackHandler) => () => void
}

const NavigationBackContext = createContext<NavigationBackContextValue | null>(
  null,
)

export function AppsInTossNavigationProvider({
  children,
  onHome,
}: {
  children: ReactNode
  onHome?: () => void
}) {
  const handlersRef = useRef<BackHandler[]>([])
  const onHomeRef = useRef(onHome)
  onHomeRef.current = onHome

  const registerBackHandler = useCallback((handler: BackHandler) => {
    handlersRef.current = [...handlersRef.current, handler]
    return () => {
      handlersRef.current = handlersRef.current.filter((item) => item !== handler)
    }
  }, [])

  useEffect(() => {
    const unsubscribeBack = graniteEvent.addEventListener('backEvent', {
      onEvent: () => {
        const handlers = handlersRef.current
        for (let i = handlers.length - 1; i >= 0; i -= 1) {
          if (handlers[i]?.()) return
        }
        void Screen.close().catch(() => undefined)
      },
      onError: (error) => {
        console.error('[AppsInToss] backEvent error', error)
      },
    })

    const unsubscribeHome = graniteEvent.addEventListener('homeEvent', {
      onEvent: () => {
        onHomeRef.current?.()
      },
      onError: (error) => {
        console.error('[AppsInToss] homeEvent error', error)
      },
    })

    return () => {
      unsubscribeBack()
      unsubscribeHome()
    }
  }, [])

  return (
    <NavigationBackContext.Provider value={{ registerBackHandler }}>
      {children}
    </NavigationBackContext.Provider>
  )
}

/** 화면/모달이 시스템 뒤로가기를 가로챌 때 사용 */
export function useRegisterBackHandler(
  handler: BackHandler,
  enabled = true,
) {
  const context = useContext(NavigationBackContext)
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled || !context) return
    return context.registerBackHandler(() => handlerRef.current())
  }, [context, enabled])
}
