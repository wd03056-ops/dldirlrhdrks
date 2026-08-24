import { useCallback, useRef } from 'react'
import type { MouseEvent, TouchEvent } from 'react'

const DEFAULT_DELAY_MS = 500
const MOVE_CANCEL_PX = 12

export function useLongPress(
  onLongPress: () => void,
  onClick?: () => void,
  delay = DEFAULT_DELAY_MS,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(
    (clientX: number, clientY: number) => {
      longPressTriggeredRef.current = false
      startXRef.current = clientX
      startYRef.current = clientY
      clear()
      timerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(10)
        }
        onLongPress()
      }, delay)
    },
    [clear, delay, onLongPress],
  )

  const cancel = useCallback(() => {
    clear()
  }, [clear])

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const dx = Math.abs(clientX - startXRef.current)
      const dy = Math.abs(clientY - startYRef.current)
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
        cancel()
      }
    },
    [cancel],
  )

  const handleClick = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    onClick?.()
  }, [onClick])

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      event.preventDefault()
      longPressTriggeredRef.current = true
      onLongPress()
    },
    [onLongPress],
  )

  return {
    onMouseDown: (e: MouseEvent) => start(e.clientX, e.clientY),
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onMouseMove: (e: MouseEvent) => handleMove(e.clientX, e.clientY),
    onTouchStart: (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) start(touch.clientX, touch.clientY)
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onTouchMove: (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) handleMove(touch.clientX, touch.clientY)
    },
    onClick: handleClick,
    onContextMenu: handleContextMenu,
  }
}
