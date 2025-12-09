import { useMemo, useRef, useState, useEffect } from 'react'
import type { Bookmark } from '@/lib/types'
import { useRecordClick } from '@/hooks/useBookmarks'
import { usePreferences } from '@/hooks/usePreferences'
import { DefaultBookmarkIconComponent } from './DefaultBookmarkIcon'
import { SnapshotViewer } from './SnapshotViewer'

interface BookmarkTitleViewProps {
  bookmarks: Bookmark[]
  onEdit?: (bookmark: Bookmark) => void
  readOnly?: boolean
  batchMode?: boolean
  selectedIds?: string[]
  onToggleSelect?: (id: string) => void
}

export function BookmarkTitleView({
  bookmarks,
  onEdit,
  readOnly = false,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: BookmarkTitleViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)
  const [showEditHint, setShowEditHint] = useState(true)

  // 移动端10秒后隐藏编辑按钮提示
  useEffect(() => {
    // 检测是否为移动端（宽度小于640px）
    const isMobile = window.innerWidth < 640
    
    if (isMobile) {
      const timer = setTimeout(() => {
        setShowEditHint(false)
      }, 10000)

      return () => clearTimeout(timer)
    } else {
      // PC端立即隐藏
      setShowEditHint(false)
    }
  }, [])

  // 动态计算列数
  useEffect(() => {
    const updateColumns = () => {
      if (!containerRef.current) return

      const containerWidth = containerRef.current.offsetWidth
      
      // 移动端（< 640px）固定2列
      if (containerWidth < 640) {
        setColumns(2)
        return
      }
      
      // 桌面端动态计算列数
      // 每列最小宽度240px，间距10px
      const minColumnWidth = 240
      const gap = 10

      // 计算可以容纳的列数（最多4列）
      let cols = 2 // 至少2列
      for (let i = 2; i <= 4; i++) {
        const totalWidth = i * minColumnWidth + (i - 1) * gap
        if (containerWidth >= totalWidth) {
          cols = i
        } else {
          break
        }
      }

      setColumns(cols)
    }

    // 初始计算
    updateColumns()

    // 监听窗口大小变化
    const resizeObserver = new ResizeObserver(updateColumns)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // 按置顶状态分组书签
  const pinnedBookmarks = bookmarks.filter(b => b.is_pinned)
  const unpinnedBookmarks = bookmarks.filter(b => !b.is_pinned)

  // 动态分列：将书签分配到各列
  const columnedBookmarks = (() => {
    // 创建 N 个空列数组
    const cols: Bookmark[][] = Array.from({ length: columns }, () => [])
    
    // 1. 先将置顶书签按行分散到各列顶部
    for (let i = 0; i < pinnedBookmarks.length; i++) {
      const colIndex = i % columns
      const col = cols[colIndex]
      const bookmark = pinnedBookmarks[i]
      if (col && bookmark) {
        col.push(bookmark)
      }
    }
    
    // 2. 再将未置顶书签按列顺序分配
    for (let i = 0; i < unpinnedBookmarks.length; i++) {
      const colIndex = i % columns
      const col = cols[colIndex]
      const bookmark = unpinnedBookmarks[i]
      if (col && bookmark) {
        col.push(bookmark)
      }
    }
    
    return cols
  })()

  return (
    <div ref={containerRef} className="w-full min-w-0">
      {/* CSS Grid 布局 - 并排显示各列 */}
      {columnedBookmarks.length > 0 && (
        <div
          className="w-full min-w-0"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: '0.625rem',
            outline: 'none',
          } as React.CSSProperties}
        >
          {columnedBookmarks.map((col, colIndex) => (
            <div key={`col-${colIndex}`} className="min-w-0" style={{ outline: 'none' }}>
              {col.map((bookmark) => (
                <div key={bookmark.id} className="mb-2.5 sm:mb-3" style={{ outline: 'none' }}>
                  <TitleOnlyCard
                    bookmark={bookmark}
                    onEdit={onEdit ? () => onEdit(bookmark) : undefined}
                    readOnly={readOnly}
                    batchMode={batchMode}
                    isSelected={selectedIds.includes(bookmark.id)}
                    onToggleSelect={onToggleSelect}
                    showEditHint={showEditHint}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface TitleOnlyCardProps {
  bookmark: Bookmark
  onEdit?: () => void
  readOnly?: boolean
  batchMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
  showEditHint?: boolean
}

function TitleOnlyCard({
  bookmark,
  onEdit,
  readOnly = false,
  batchMode = false,
  isSelected = false,
  onToggleSelect,
  showEditHint = false,
}: TitleOnlyCardProps) {
  const recordClick = useRecordClick()
  const hasEditClickRef = useRef(false)
  const { data: preferences } = usePreferences()
  const defaultIcon = preferences?.default_bookmark_icon || 'orbital-spinner'
  
  const [coverImageError, setCoverImageError] = useState(false)
  const [faviconError, setFaviconError] = useState(false)
  const [googleFaviconIsDefault, setGoogleFaviconIsDefault] = useState(false)
  
  const domain = useMemo(() => {
    try {
      return new URL(bookmark.url).hostname
    } catch {
      return bookmark.url.replace(/^https?:\/\//i, '').split('/')[0] || bookmark.url
    }
  }, [bookmark.url])
  
  // 生成Google Favicon URL作为最终fallback
  const googleFaviconUrl = useMemo(() => {
    try {
      const urlObj = new URL(bookmark.url)
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
    } catch {
      return ''
    }
  }, [bookmark.url])
  
  // 检测 Google Favicon 是否为默认灰色地球图标
  const checkIfGoogleDefaultIcon = (img: HTMLImageElement) => {
    // Google 的默认图标特征：图片很小（通常是 16x16 或更小）
    if (img.naturalWidth <= 16 && img.naturalHeight <= 16) {
      setGoogleFaviconIsDefault(true)
    }
  }
  
  // 决定显示什么图标 - 与全局一致的回退策略
  // 1. cover_image (封面图)
  // 2. favicon (网站图标，从插件获取)
  // 3. Google Favicon API (但跳过默认灰色地球)
  // 4. 用户自定义的 SVG 图标
  const hasCoverImage = bookmark.cover_image && bookmark.cover_image.trim() !== '' && !coverImageError
  const hasFavicon = !hasCoverImage && bookmark.favicon && bookmark.favicon.trim() !== '' && !faviconError
  const shouldShowGoogleFavicon = !hasCoverImage && !hasFavicon && googleFaviconUrl && !faviconError && !googleFaviconIsDefault
  const shouldShowIcon = hasCoverImage || hasFavicon || shouldShowGoogleFavicon

  const handleVisit = () => {
    if (!readOnly) {
      recordClick.mutate(bookmark.id)
    }
    window.open(bookmark.url, '_blank', 'noopener,noreferrer')
  }

  const handleCardClick = () => {
    if (batchMode && onToggleSelect) {
      onToggleSelect(bookmark.id)
    } else {
      handleVisit()
    }
  }

  return (
    <div className="relative group">
      <div className={`rounded-lg sm:rounded-xl border border-border/70 bg-card/95 backdrop-blur-sm shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 ${
        batchMode && isSelected ? 'ring-2 ring-primary' : ''
      }`}>
        <div className="pointer-events-none absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/4 via-transparent to-secondary/8 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* 批量选择复选框 */}
        {batchMode && onToggleSelect && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleSelect(bookmark.id)
              }}
              className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border-2 border-border hover:border-primary'
              }`}
              title={isSelected ? '取消选择' : '选择'}
            >
              {isSelected && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* 编辑按钮 - 初始显示10秒后隐藏 */}
        {!!onEdit && !readOnly && !batchMode && (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              ;(event.nativeEvent as MouseEvent).stopImmediatePropagation?.()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              ;(event.nativeEvent as MouseEvent).stopImmediatePropagation?.()
              hasEditClickRef.current = true
              setTimeout(() => {
                hasEditClickRef.current = false
              }, 0)
              onEdit()
            }}
            className={`absolute top-2 right-2 sm:top-3 sm:right-3 w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center transition-all touch-manipulation ${
              showEditHint ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 active:opacity-100'
            }`}
            title="编辑"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-base-content drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}

        {/* 内容区 - 移动端更紧凑 */}
        <div className="relative z-10 px-3 py-3 sm:px-5 sm:py-4 space-y-1.5 sm:space-y-2 pointer-events-none">
          {/* 置顶标识 - 移动端也显示 */}
          {bookmark.is_pinned && (
            <div className="flex items-center gap-1 mb-1">
              <span className="bg-warning text-warning-content text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-medium">
                置顶
              </span>
            </div>
          )}
          
          {/* 图标 + 标题 + 域名 在一行 */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* 图标 */}
            <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded overflow-hidden bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center">
              {shouldShowIcon ? (
                hasCoverImage ? (
                  <img
                    src={bookmark.cover_image!}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={() => setCoverImageError(true)}
                  />
                ) : hasFavicon ? (
                  <img
                    src={bookmark.favicon!}
                    alt=""
                    className="w-full h-full object-contain"
                    onError={() => setFaviconError(true)}
                  />
                ) : shouldShowGoogleFavicon ? (
                  <img
                    src={googleFaviconUrl}
                    alt=""
                    className="w-full h-full object-contain"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement
                      checkIfGoogleDefaultIcon(img)
                    }}
                    onError={() => setFaviconError(true)}
                  />
                ) : null
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <DefaultBookmarkIconComponent icon={defaultIcon} className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              )}
            </div>
            
            {/* 标题和域名容器 */}
            <div className="flex-1 min-w-0 flex items-baseline gap-1.5 sm:gap-2">
              {/* 标题 */}
              <button
                type="button"
                onClick={(event) => {
                  if (hasEditClickRef.current) {
                    hasEditClickRef.current = false
                    event.preventDefault()
                    return
                  }
                  handleCardClick()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleCardClick()
                  }
                }}
                className="pointer-events-auto flex-shrink min-w-0 text-left text-xs sm:text-sm font-semibold leading-snug text-foreground truncate hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-md pr-9 sm:pr-12"
                title={bookmark.title?.trim() || bookmark.url}
              >
                {bookmark.title?.trim() || bookmark.url}
              </button>
              
              {/* 域名 */}
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto flex-shrink-0 text-[10px] sm:text-xs text-muted-foreground/60 hover:text-primary transition-colors truncate max-w-[40%]"
                onClick={(e) => {
                  if (batchMode) {
                    e.preventDefault()
                    onToggleSelect?.(bookmark.id)
                  } else if (!readOnly) {
                    recordClick.mutate(bookmark.id)
                  }
                }}
                title={domain}
              >
                {domain}
              </a>
            </div>
          </div>
          
          {/* 标签和快照 - 从最左边开始 */}
          {((bookmark.tags && bookmark.tags.length > 0) || (bookmark.has_snapshot && (bookmark.snapshot_count ?? 0) > 0)) && (
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-0.5">
              {/* 快照图标 */}
              {bookmark.has_snapshot && (bookmark.snapshot_count ?? 0) > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                  <SnapshotViewer 
                    bookmarkId={bookmark.id} 
                    bookmarkTitle={bookmark.title}
                    snapshotCount={bookmark.snapshot_count ?? 0}
                  />
                </div>
              )}
              
              {/* 标签 */}
              {bookmark.tags && bookmark.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                >
                  {tag.name}
                </span>
              ))}
              {bookmark.tags && bookmark.tags.length > 3 && (
                <span className="text-[10px] sm:text-xs text-muted-foreground/60">
                  +{bookmark.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
