/**
 * 进度指示器组件
 * 提供丰富的进度显示和动画效果
 */

import { useState, useEffect } from 'react'
import { CheckCircle, Loader2, Clock, Zap } from 'lucide-react'

interface ProgressInfo {
  current: number
  total: number
  percentage: number
  status: string
  message?: string
  estimated_remaining?: number
  speed?: number // items per second
}

interface ProgressIndicatorProps {
  progress: ProgressInfo
  variant?: 'default' | 'compact' | 'detailed'
  showSpeed?: boolean
  showETA?: boolean
  className?: string
}

export function ProgressIndicator({
  progress,
  variant = 'default',
  showSpeed = true,
  showETA = true,
  className = ''
}: ProgressIndicatorProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // 动画效果
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(progress.percentage)
    }, 100)

    return () => clearTimeout(timer)
  }, [progress.percentage])

  // 完成状态检测
  useEffect(() => {
    if (progress.percentage >= 100) {
      const timer = setTimeout(() => {
        setIsComplete(true)
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setIsComplete(false)
    }
  }, [progress.percentage])

  // 紧凑模式
  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className="flex-shrink-0">
          {isComplete ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground truncate">
              {progress.status}
            </span>
            <span className="text-muted-foreground ml-2">
              {Math.round(animatedPercentage)}%
            </span>
          </div>
          <div className="mt-1 w-full bg-muted rounded-full h-1.5">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${animatedPercentage}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // 详细模式
  if (variant === 'detailed') {
    return (
      <div className={`space-y-3 sm:space-y-4 ${className}`}>
        {/* 状态头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {isComplete ? (
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
              ) : (
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-spin" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm sm:text-base md:text-lg font-semibold text-foreground truncate">
                {progress.status}
              </h4>
              {progress.message && (
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {progress.message}
                </p>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
              {Math.round(animatedPercentage)}%
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {progress.current} / {progress.total}
            </div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="space-y-2">
          <div className="w-full bg-muted rounded-full h-2 sm:h-3 overflow-hidden">
            <div
              className="h-2 sm:h-3 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-primary to-primary/90"
              style={{ width: `${animatedPercentage}%` }}
            >
              {/* 动画光效 */}
              <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            </div>
          </div>

          {/* 统计信息 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center space-x-3 sm:space-x-4">
              {showSpeed && progress.speed && (
                <div className="flex items-center space-x-1">
                  <Zap className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{Math.round(progress.speed)} 项/秒</span>
                </div>
              )}
              {showETA && progress.estimated_remaining && (
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">剩余 {formatTime(progress.estimated_remaining)}</span>
                </div>
              )}
            </div>
            <div className="whitespace-nowrap">
              已处理 {progress.current.toLocaleString()} 项
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 默认模式
  return (
    <div className={`space-y-2 sm:space-y-3 ${className}`}>
      {/* 状态和百分比 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {isComplete ? (
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
          ) : (
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-spin flex-shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-medium text-foreground truncate">
            {progress.status}
          </span>
        </div>
        <span className="text-xs sm:text-sm font-medium text-foreground flex-shrink-0 ml-2">
          {Math.round(animatedPercentage)}%
        </span>
      </div>

      {/* 进度条 */}
      <div className="w-full bg-muted rounded-full h-1.5 sm:h-2 overflow-hidden">
        <div
          className="bg-primary h-1.5 sm:h-2 rounded-full transition-all duration-500 ease-out relative"
          style={{ width: `${animatedPercentage}%` }}
        >
          {/* 动画条纹 */}
          {!isComplete && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          )}
        </div>
      </div>

      {/* 详细信息 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0 text-xs text-muted-foreground">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <span className="whitespace-nowrap">{progress.current} / {progress.total}</span>
          {showSpeed && progress.speed && (
            <span className="whitespace-nowrap">{Math.round(progress.speed)} 项/秒</span>
          )}
          {showETA && progress.estimated_remaining && (
            <span className="whitespace-nowrap">剩余 {formatTime(progress.estimated_remaining)}</span>
          )}
        </div>
        {progress.message && (
          <span className="text-xs text-muted-foreground truncate">
            {progress.message}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * 简单的进度条组件
 */
interface SimpleProgressProps {
  percentage: number
  size?: 'sm' | 'md' | 'lg'
  color?: 'blue' | 'green' | 'red' | 'yellow'
  animated?: boolean
  className?: string
}

export function SimpleProgress({
  percentage,
  size = 'md',
  color = 'blue',
  animated = false,
  className = ''
}: SimpleProgressProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage)
    }, 100)
    return () => clearTimeout(timer)
  }, [percentage])

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }

  const colorClasses = {
    blue: 'bg-primary',
    green: 'bg-success',
    red: 'bg-destructive',
    yellow: 'bg-warning'
  }

  return (
    <div className={`w-full bg-muted rounded-full overflow-hidden ${sizeClasses[size]} ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-full transition-all duration-500 ease-out ${colorClasses[color]} ${
          animated ? 'relative' : ''
        }`}
        style={{ width: `${animatedPercentage}%` }}
      >
        {animated && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
        )}
      </div>
    </div>
  )
}

/**
 * 圆形进度指示器
 */
interface CircularProgressProps {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
  showPercentage?: boolean
  className?: string
}

export function CircularProgress({
  percentage,
  size = 64,
  strokeWidth = 4,
  color,
  backgroundColor,
  showPercentage = true,
  className = ''
}: CircularProgressProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0)

  // 使用 CSS 变量作为默认颜色
  const defaultColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || 'hsl(221.2 83.2% 53.3%)'
    : 'hsl(221.2 83.2% 53.3%)'
  const defaultBgColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || 'hsl(210 40% 96.1%)'
    : 'hsl(210 40% 96.1%)'

  const finalColor = color || defaultColor
  const finalBgColor = backgroundColor || defaultBgColor

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage)
    }, 100)
    return () => clearTimeout(timer)
  }, [percentage])

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* 背景圆 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={finalBgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* 进度圆 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={finalColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-foreground">
            {Math.round(animatedPercentage)}%
          </span>
        </div>
      )}
    </div>
  )
}

// 工具函数：格式化时间
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}秒`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
  }
}
