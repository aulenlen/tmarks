/**
 * API Key Authentication Middleware for Cloudflare Pages Functions
 * 用于对外 API 的 API Key 认证
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../lib/types'
import { validateApiKey } from '../lib/api-key/validator'
import { checkRateLimit, recordRequest } from '../lib/api-key/rate-limiter'
import { logApiKeyUsage } from '../lib/api-key/logger'
import { unauthorized, forbidden, tooManyRequests } from '../lib/response'
import { hasPermission } from '../../shared/permissions'

export interface ApiKeyAuthContext extends Record<string, unknown> {
  user_id: string
  api_key_id: string
  api_key_permissions: string[]
}

/**
 * 创建 API Key 认证中间件工厂函数
 * @param requiredPermission 需要的权限
 */
export function requireApiKeyAuth(
  requiredPermission: string
): PagesFunction<Env, RouteParams, ApiKeyAuthContext> {
  return async (context) => {
    const request = context.request

    try {
      // 1. 获取 API Key
      const apiKey = request.headers.get('X-API-Key')

      if (!apiKey) {
        return unauthorized({
          code: 'MISSING_API_KEY',
          message: 'API Key is required. Please provide X-API-Key header.',
        })
      }

      // 2. 验证 API Key
      const validation = await validateApiKey(apiKey, context.env.DB)

      if (!validation.valid || !validation.data || !validation.permissions) {
        return unauthorized({
          code: 'INVALID_API_KEY',
          message: validation.error || 'Invalid API Key',
        })
      }

      const { data: keyData, permissions } = validation

      // 3. 检查权限
      if (!hasPermission(permissions, requiredPermission)) {
        return forbidden({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Missing required permission: ${requiredPermission}`,
          required: requiredPermission,
          available: permissions,
        })
      }

      // 4. 检查速率限制（如果未配置 KV，则跳过限流，但仍允许请求）
      const kv = context.env.TMARKS_KV

      if (kv) {
        const rateLimitResult = await checkRateLimit(keyData.id, kv)

        if (!rateLimitResult.allowed) {
          return tooManyRequests(
            {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded',
              retry_after: rateLimitResult.retryAfter,
            },
            {
              'X-RateLimit-Limit': String(rateLimitResult.limit),
              'X-RateLimit-Remaining': String(rateLimitResult.remaining),
              'X-RateLimit-Reset': String(rateLimitResult.reset),
              'Retry-After': String(rateLimitResult.retryAfter || 60),
            }
          )
        }

        // 5. 记录请求（同步，确保计数准确）
        await recordRequest(keyData.id, kv)
      }

      // 6. 获取请求 IP
      const ip =
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For') ||
        null

      // 7. 传递用户信息到 context.data（必须在返回前设置）
      context.data.user_id = keyData.user_id
      context.data.api_key_id = keyData.id
      context.data.api_key_permissions = permissions

      // 8. 更新最后使用信息（异步，不阻塞请求）
      context.waitUntil(
        (async () => {
          try {
            await context.env.DB.prepare(
              `UPDATE api_keys SET last_used_at = datetime('now'), last_used_ip = ? WHERE id = ?`
            )
              .bind(ip, keyData.id)
              .run()
          } catch (error) {
            console.error('Failed to update last_used:', error)
          }
        })()
      )

      // 9. 记录 API 使用日志（异步，不阻塞请求）
      context.waitUntil(
        (async () => {
          try {
            await logApiKeyUsage(
              {
                api_key_id: keyData.id,
                user_id: keyData.user_id,
                endpoint: new URL(request.url).pathname,
                method: request.method,
                status: 200, // 成功通过认证
                ip,
              },
              context.env.DB
            )
          } catch (error) {
            console.error('Failed to log API usage:', error)
          }
        })()
      )

      // 10. 认证成功，继续到下一个处理函数（返回 undefined 或 next()）
      // 在 Pages Functions 中，中间件返回 undefined 表示继续执行后续函数
      return context.next()
    } catch (error) {
      console.error('API Key auth middleware error:', error)
      return unauthorized({
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      })
    }
  }
}
