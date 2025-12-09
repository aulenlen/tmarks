import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  onClose: (id: string) => void
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const COLORS = {
  success: {
    bg: 'bg-card',
    bgOverlay: 'bg-success/10',
    border: 'border-success',
    icon: 'text-success',
    text: 'text-foreground',
  },
  error: {
    bg: 'bg-card',
    bgOverlay: 'bg-destructive/10',
    border: 'border-destructive',
    icon: 'text-destructive',
    text: 'text-foreground',
  },
  info: {
    bg: 'bg-card',
    bgOverlay: 'bg-primary/10',
    border: 'border-primary',
    icon: 'text-primary',
    text: 'text-foreground',
  },
  warning: {
    bg: 'bg-card',
    bgOverlay: 'bg-warning/10',
    border: 'border-warning',
    icon: 'text-warning',
    text: 'text-foreground',
  },
}

export function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  const Icon = ICONS[type]
  const colors = COLORS[type]

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  return (
    <div
      className={`relative flex items-start gap-3 p-4 rounded-lg border-2 shadow-lg ${colors.bg} ${colors.border} min-w-[320px] max-w-md animate-slide-in backdrop-blur-sm`}
    >
      {/* 半透明彩色覆盖层 */}
      <div className={`absolute inset-0 rounded-lg ${colors.bgOverlay} -z-10`}></div>
      
      <Icon className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />
      <p className={`flex-1 text-sm font-medium ${colors.text}`}>{message}</p>
      <button
        onClick={() => onClose(id)}
        className={`${colors.icon} hover:opacity-70 transition-opacity flex-shrink-0`}
        aria-label="关闭"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, onClose }: { toasts: ToastProps[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 flex flex-col gap-2" style={{ zIndex: 300 }}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  )
}

