import type { Env } from './types'
import type { D1Database } from '@cloudflare/workers-types'

/**
 * R2 存储配额相关工具
 *
 * 目标：限制在 R2 中的总占用空间（快照 + 封面图）不超过指定上限
 * 实现：依赖 D1 中 bookmark_snapshots.file_size 和 bookmark_images.file_size 的汇总
 */

// 默认总配额逻辑：不配置或配置为 <= 0 时视为「无限制」
type UsageRow = {
  total: number | null
}

/**
 * 从环境变量读取 R2 总配额（字节）
 *
 * 约定：
 * - 未设置 / 为空: 视为「无限制」
 * - 解析失败: 视为「无限制」
 * - <= 0: 视为「无限制」
 * - > 0: 使用该值作为总配额
 */
export function getR2MaxTotalBytes(env: Env): number {
  const raw = env.R2_MAX_TOTAL_BYTES

  if (!raw || raw.trim() === '') {
    // 不配置则不限制
    return Number.POSITIVE_INFINITY
  }

  const parsed = Number(raw)

  if (!Number.isFinite(parsed)) {
    console.warn('[StorageQuota] Invalid R2_MAX_TOTAL_BYTES, treating as unlimited', raw)
    return Number.POSITIVE_INFINITY
  }

  if (parsed <= 0) {
    // 小于等于 0 视为不限制
    return Number.POSITIVE_INFINITY
  }

  return parsed
}

/**
 * 计算当前在 R2 中的大致占用（字节）
 *
 * 说明：
 * - bookmark_snapshots.file_size：快照 HTML +（在 V2 中）图片总大小
 * - bookmark_images.file_size：封面图文件大小（按 image_hash 去重）
 */
export async function getCurrentR2UsageBytes(db: D1Database): Promise<number> {
  const snapshotRow = await db
    .prepare('SELECT COALESCE(SUM(file_size), 0) AS total FROM bookmark_snapshots')
    .first<UsageRow>()

  const snapshotsTotal = snapshotRow?.total ?? 0

  let imagesTotal = 0
  try {
    const imageRow = await db
      .prepare('SELECT COALESCE(SUM(file_size), 0) AS total FROM bookmark_images')
      .first<UsageRow>()

    imagesTotal = imageRow?.total ?? 0
  } catch (error) {
    console.warn('[StorageQuota] Failed to query bookmark_images usage', error)
  }

  return snapshotsTotal + imagesTotal
}

export interface R2QuotaCheckResult {
  allowed: boolean
  limitBytes: number
  usedBytes: number
}

/**
 * 检查在写入 additionalBytes 之后，是否仍在配额之内
 */
export async function checkR2Quota(
  db: D1Database,
  env: Env,
  additionalBytes: number
): Promise<R2QuotaCheckResult> {
  const limitBytes = getR2MaxTotalBytes(env)

  // 无限配额：直接允许
  if (!Number.isFinite(limitBytes)) {
    const usedBytes = await getCurrentR2UsageBytes(db)
    return { allowed: true, limitBytes, usedBytes }
  }

  const usedBytes = await getCurrentR2UsageBytes(db)
  const willUse = usedBytes + Math.max(0, additionalBytes)

  if (willUse > limitBytes) {
    return { allowed: false, limitBytes, usedBytes }
  }

  return { allowed: true, limitBytes, usedBytes }
}

