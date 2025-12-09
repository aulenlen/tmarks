/**
 * 插入线指示器 - Notion 风格
 * 在拖拽时显示插入位置
 */

interface InsertionIndicatorProps {
  position: 'before' | 'after' | 'inside'
}

export function InsertionIndicator({ position }: InsertionIndicatorProps) {
  if (position === 'inside') {
    return (
      <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-lg pointer-events-none" />
    )
  }

  return (
    <div
      className={`absolute left-0 right-0 h-0.5 bg-primary pointer-events-none ${
        position === 'before' ? '-top-1' : '-bottom-1'
      }`}
    >
      {/* 左侧圆点 */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
      {/* 右侧圆点 */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
    </div>
  )
}
