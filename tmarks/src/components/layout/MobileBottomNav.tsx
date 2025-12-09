/**
 * 移动端底部导航栏组件
 * 提供移动端专用的导航体验
 */

import { useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, Layers, Database, Download } from 'lucide-react'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  badge?: number
}

export function MobileBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems: NavItem[] = [
    {
      id: 'bookmarks',
      label: '书签',
      icon: BookOpen,
      path: '/'
    },
    {
      id: 'tab-groups',
      label: '标签页',
      icon: Layers,
      path: '/tab'
    },
    {
      id: 'data',
      label: '数据',
      icon: Database,
      path: '/import-export'
    },
    {
      id: 'extension',
      label: '插件',
      icon: Download,
      path: '/extension'
    }
  ]

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border sm:hidden" style={{ zIndex: 20 }}>
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center space-y-1 px-2 py-2 transition-colors duration-200 touch-manipulation ${
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${
                  active ? 'text-primary' : ''
                }`} />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-xs font-medium ${
                active ? 'text-primary' : ''
              }`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
      
      {/* 安全区域适配 */}
      <div className="h-safe-area-inset-bottom bg-card" />
    </div>
  )
}

/**
 * 移动端导航占位组件
 * 为底部导航栏预留空间
 */
export function MobileNavSpacer() {
  return <div className="h-16 sm:hidden" />
}

/**
 * 移动端浮动操作按钮
 */
interface FloatingActionButtonProps {
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  variant?: 'primary' | 'secondary'
  className?: string
}

export function FloatingActionButton({
  onClick,
  icon: Icon,
  label,
  variant = 'primary',
  className = ''
}: FloatingActionButtonProps) {
  const baseClasses = 'fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 touch-manipulation z-40 sm:hidden'
  
  const variantClasses = {
    primary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
    secondary: 'bg-card hover:bg-muted text-foreground border border-border'
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      title={label}
      aria-label={label}
    >
      <Icon className="h-6 w-6" />
    </button>
  )
}

/**
 * 移动端手势提示组件
 */
interface SwipeHintProps {
  direction: 'up' | 'down' | 'left' | 'right'
  text: string
  className?: string
}

export function SwipeHint({ direction, text, className = '' }: SwipeHintProps) {
  const directionClasses = {
    up: 'animate-bounce',
    down: 'animate-bounce rotate-180',
    left: 'animate-pulse rotate-90',
    right: 'animate-pulse -rotate-90'
  }

  return (
    <div className={`flex items-center space-x-2 text-muted-foreground sm:hidden ${className}`}>
      <div className={`w-4 h-4 ${directionClasses[direction]}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M7 13l3 3 7-7" />
        </svg>
      </div>
      <span className="text-xs">{text}</span>
    </div>
  )
}

/**
 * 移动端模态框组件
 */
interface MobileModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  showHandle?: boolean
  maxHeight?: string
}

export function MobileModal({
  isOpen,
  onClose,
  title,
  children,
  showHandle = true,
  maxHeight = '90vh'
}: MobileModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 sm:hidden">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 模态框内容 */}
      <div
        className="fixed inset-x-0 bottom-0 bg-card rounded-t-xl shadow-xl transition-transform"
        style={{ maxHeight }}
      >
        {/* 拖拽手柄 */}
        {showHandle && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-border rounded-full" />
          </div>
        )}

        {/* 标题栏 */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-lg font-medium text-foreground">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        {/* 内容区域 */}
        <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: title ? 'calc(90vh - 60px)' : 'calc(90vh - 20px)' }}>
          <div className="p-4">
            {children}
          </div>
        </div>
        
        {/* 安全区域适配 */}
        <div className="h-safe-area-inset-bottom bg-card" />
      </div>
    </div>
  )
}

/**
 * 移动端下拉刷新组件
 */
interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  threshold?: number
  className?: string
}

export function PullToRefresh({
  children,
  className = ''
}: PullToRefreshProps) {
  // 这里可以实现下拉刷新逻辑
  // 为了简化，暂时只返回子组件
  // 注意：onRefresh 和 threshold 参数预留用于未来实现下拉刷新功能
  return (
    <div className={`sm:hidden ${className}`}>
      {children}
    </div>
  )
}
