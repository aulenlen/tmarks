/**
 * 长按检测 Hook
 * 用于移动端拖拽触发
 * 参考 Notion 和 Trello 的移动端实现
 */

import { useCallback, useRef } from 'react'

interface UseLongPressOptions {
  /**
   * 长按触发时间（毫秒）
   * 默认: 500ms
   */
  delay?: number
  
  /**
   * 长按触发回调
   */
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void
  
  /**
   * 移动容差（像素）
   * 超过此距离取消长按
   * 默认: 10
   */
  moveTolerance?: number
  
  /**
   * 是否启用触觉反馈
   * 默认: true
   */
  enableHaptic?: boolean
}

export function useLongPress(options: UseLongPressOptions) {
  const {
    delay = 500,
    onLongPress,
    moveTolerance = 10,
    enableHaptic = true,
  } = options

  const timeoutRef = useRef<number | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)
  const isLongPressRef = useRef(false)

  /**
   * 触发触觉反馈
   */
  const triggerHaptic = useCallback(() => {
    if (enableHaptic && 'vibrate' in navigator) {
      navigator.vibrate(50) // 50ms 震动
    }
  }, [enableHaptic])

  /**
   * 开始长按检测
   */
  const onStart = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    // 记录起始位置
    const clientX = 'touches' in event ? event.touches[0]?.clientX ?? 0 : event.clientX
    const clientY = 'touches' in event ? event.touches[0]?.clientY ?? 0 : event.clientY
    
    startPosRef.current = { x: clientX, y: clientY }
    isLongPressRef.current = false

    // 设置定时器
    timeoutRef.current = window.setTimeout(() => {
      isLongPressRef.current = true
      triggerHaptic()
      onLongPress(event)
    }, delay)
  }, [delay, onLongPress, triggerHaptic])

  /**
   * 移动检测
   */
  const onMove = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    if (!startPosRef.current || !timeoutRef.current) return

    const clientX = 'touches' in event ? event.touches[0]?.clientX ?? 0 : event.clientX
    const clientY = 'touches' in event ? event.touches[0]?.clientY ?? 0 : event.clientY

    const deltaX = Math.abs(clientX - startPosRef.current.x)
    const deltaY = Math.abs(clientY - startPosRef.current.y)

    // 如果移动超过容差，取消长按
    if (deltaX > moveTolerance || deltaY > moveTolerance) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [moveTolerance])

  /**
   * 结束长按检测
   */
  const onEnd = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    startPosRef.current = null
  }, [])

  /**
   * 清理
   */
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  return {
    onTouchStart: onStart,
    onTouchMove: onMove,
    onTouchEnd: onEnd,
    onMouseDown: onStart,
    onMouseMove: onMove,
    onMouseUp: onEnd,
    cleanup,
    isLongPress: () => isLongPressRef.current,
  }
}
