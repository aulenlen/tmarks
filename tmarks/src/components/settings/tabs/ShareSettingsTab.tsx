import { useState, useEffect, useMemo } from 'react'
import { Share2, Copy, RefreshCw } from 'lucide-react'
import { useShareSettings, useUpdateShareSettings } from '@/hooks/useShare'
import { useToastStore } from '@/stores/toastStore'
import { InfoBox } from '../InfoBox'
import { Toggle } from '@/components/common/Toggle'

export function ShareSettingsTab() {
  const { data, isLoading } = useShareSettings()
  const updateShare = useUpdateShareSettings()
  const { addToast } = useToastStore()

  const [enabled, setEnabled] = useState(false)
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled || false)
      setSlug(data.slug || '')
      setTitle(data.title || '')
      setDescription(data.description || '')
    }
  }, [data])

  const shareUrl = useMemo(() => {
    if (!slug) return ''
    return `${window.location.origin}/share/${slug}`
  }, [slug])

  const handleSave = async () => {
    try {
      await updateShare.mutateAsync({
        enabled: enabled,
        slug: slug.trim() || null,
        title: title.trim() || null,
        description: description.trim() || null,
      })
      addToast('success', '分享设置已保存')
    } catch {
      addToast('error', '保存失败')
    }
  }

  const handleRegenerate = async () => {
    try {
      await updateShare.mutateAsync({
        regenerate_slug: true,
        enabled: true,
        title: title.trim() || null,
        description: description.trim() || null,
      })
      addToast('success', '链接已重新生成')
    } catch {
      addToast('error', '生成失败')
    }
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      addToast('success', '链接已复制')
    } catch {
      addToast('error', '复制失败')
    }
  }

  const handleReset = () => {
    if (data) {
      setEnabled(data.enabled || false)
      setSlug(data.slug || '')
      setTitle(data.title || '')
      setDescription(data.description || '')
      addToast('info', '已重置为上次保存的设置')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 公开分享设置 */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">公开分享</h3>
          <p className="text-sm text-muted-foreground mt-1">
            创建公开链接，让其他人查看你的书签
          </p>
        </div>

        {/* 启用开关 */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
          <div>
            <div className="text-sm font-medium mb-1">启用公开分享</div>
            <div className="text-xs text-muted-foreground">
              开启后，其他人可以通过链接访问你的公开书签
            </div>
          </div>
          <Toggle
            checked={enabled}
            onChange={setEnabled}
          />
        </div>

        {/* 分享链接设置 */}
        {enabled && (
          <>
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">分享链接后缀</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="例如：my-bookmarks"
                    className="input flex-1"
                    disabled={updateShare.isPending}
                  />
                  <button
                    onClick={handleRegenerate}
                    disabled={updateShare.isPending}
                    className="btn btn-secondary btn-sm sm:btn flex items-center gap-2 justify-center"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>重新生成</span>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  仅支持字母、数字与短横线，留空将自动生成
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">页面标题</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="公开页面标题，用于向访客介绍"
                  className="input"
                  disabled={updateShare.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">页面描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选描述，向访客说明书签集合内容"
                className="input min-h-[80px]"
                disabled={updateShare.isPending}
              />
            </div>

            {/* 分享链接预览 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">分享链接</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl || '生成后显示分享链接'}
                  className="input flex-1"
                />
                <button
                  onClick={handleCopyLink}
                  disabled={!shareUrl}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={handleReset}
                disabled={updateShare.isPending}
                className="btn btn-secondary btn-sm sm:btn"
              >
                重置
              </button>
              <button
                onClick={handleSave}
                disabled={updateShare.isPending}
                className="btn btn-primary btn-sm sm:btn"
              >
                {updateShare.isPending ? '保存中...' : '保存设置'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border"></div>

      {/* 提示信息 */}
      <InfoBox icon={Share2} title="分享功能说明" variant="success">
        <ul className="space-y-1">
          <li>• 只有标记为"公开"的书签才会在分享页面显示</li>
          <li>• 你可以随时修改分享链接或关闭分享功能</li>
          <li>• 分享页面不需要登录即可访问</li>
        </ul>
      </InfoBox>
    </div>
  )
}
