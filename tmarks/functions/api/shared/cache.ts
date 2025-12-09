import type { Env } from '../../lib/types'
import { CacheService } from '../../lib/cache'
import { getCacheInvalidationPrefix } from '../../lib/cache/strategies'

/**
 * 失效用户的公开分享缓存
 * 当用户修改书签时调用，确保分享页面显示最新数据
 */
export async function invalidatePublicShareCache(env: Env, userId: string) {
  // 查询用户的公开分享 slug
  const record = await env.DB.prepare(
    `SELECT public_slug FROM users WHERE id = ? AND public_share_enabled = 1`
  )
    .bind(userId)
    .first<{ public_slug: string | null }>()

  if (!record?.public_slug) {
    return
  }

  // 使用 CacheService 统一失效缓存
  const cache = new CacheService(env)
  const prefix = getCacheInvalidationPrefix(record.public_slug.toLowerCase(), 'publicShare')
  await cache.invalidate(prefix)
}
