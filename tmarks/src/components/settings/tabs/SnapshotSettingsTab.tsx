import { Camera, Trash2, Copy, CheckCircle } from 'lucide-react'
import { InfoBox } from '../InfoBox'
import { Toggle } from '@/components/common/Toggle'

interface SnapshotSettingsTabProps {
  retentionCount: number
  autoCreate: boolean
  autoDedupe: boolean
  autoCleanupDays: number
  onRetentionCountChange: (count: number) => void
  onAutoCreateChange: (enabled: boolean) => void
  onAutoDedupeChange: (enabled: boolean) => void
  onAutoCleanupDaysChange: (days: number) => void
}

export function SnapshotSettingsTab({
  retentionCount,
  autoCreate,
  autoDedupe,
  autoCleanupDays,
  onRetentionCountChange,
  onAutoCreateChange,
  onAutoDedupeChange,
  onAutoCleanupDaysChange,
}: SnapshotSettingsTabProps) {
  return (
    <div className="space-y-6">
      {/* 快照保留策略 */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">快照保留策略</h3>
          <p className="text-sm text-muted-foreground mt-1">
            控制每个书签保留的快照数量
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex-1">
              <div className="text-sm font-medium mb-1">保留快照数量</div>
              <div className="text-xs text-muted-foreground">
                每个书签最多保留的快照版本数（-1 表示无限制）
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={retentionCount}
                onChange={(e) => onRetentionCountChange(parseInt(e.target.value) || 0)}
                min="-1"
                max="100"
                className="input w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">个</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              💡 当快照数量超过限制时，会自动删除最旧的快照。设置为 -1 表示不限制数量。
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border"></div>

      {/* 自动创建快照 */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">自动创建快照</h3>
          <p className="text-sm text-muted-foreground mt-1">
            添加书签时自动创建网页快照
          </p>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-start gap-3">
            <Copy className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium mb-1">启用自动创建</div>
              <div className="text-xs text-muted-foreground">
                添加新书签时自动保存网页快照（需要浏览器扩展支持）
              </div>
            </div>
          </div>
          <Toggle
            checked={autoCreate}
            onChange={onAutoCreateChange}
          />
        </div>
      </div>

      <div className="border-t border-border"></div>

      {/* 自动去重 */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">智能去重</h3>
          <p className="text-sm text-muted-foreground mt-1">
            避免保存重复的快照内容
          </p>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium mb-1">启用智能去重</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• 通过内容哈希检测重复快照</div>
                <div>• 如果内容相同，不会创建新快照</div>
                <div>• 节省存储空间，提高效率</div>
              </div>
            </div>
          </div>
          <Toggle
            checked={autoDedupe}
            onChange={onAutoDedupeChange}
          />
        </div>
      </div>

      <div className="border-t border-border"></div>

      {/* 自动清理 */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">自动清理</h3>
          <p className="text-sm text-muted-foreground mt-1">
            定期清理过期的快照
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium mb-1">自动清理天数</div>
                <div className="text-xs text-muted-foreground">
                  自动删除超过指定天数的快照（0 表示不自动清理）
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={autoCleanupDays}
                onChange={(e) => onAutoCleanupDaysChange(parseInt(e.target.value) || 0)}
                min="0"
                max="365"
                className="input w-20 text-center"
              />
              <span className="text-sm text-muted-foreground">天</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
            <p className="text-xs text-muted-foreground">
              ⚠️ 自动清理功能会永久删除快照，请谨慎设置。设置为 0 表示不自动清理。
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border"></div>

      {/* 快照功能说明 */}
      <InfoBox icon={Camera} title="快照功能说明" variant="info">
        <ul className="space-y-1">
          <li>• 快照功能可以保存网页的完整内容，包括文字、图片和样式</li>
          <li>• 即使原网页被删除或修改，你仍然可以查看保存的快照</li>
          <li>• 快照存储在云端，不占用本地空间</li>
          <li>• 建议启用智能去重，避免保存重复内容</li>
          <li>• 可以在书签卡片上点击快照图标查看和管理快照</li>
        </ul>
      </InfoBox>
    </div>
  )
}
