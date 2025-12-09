/**
 * API Key Authentication Middleware
 * 用于验证和授权 API Key 请求
 */

import { Context } from 'hono'
import { validateApiKey, checkPermission, updateLastUsed } from '../lib/api-key/validator'
import { checkRateLimit, recordRequest } from '../lib/api-key/rate-limiter'
import { logApiKeyUsage } from '../lib/api-key/logger'

interface ApiKeyAuthOptions {
  requiredPermission: string
}

/**
 * API Key 认证中间件
 * @param options 配置选项
 * @returns 中间件函数
 */
export function requireApiKey(options: ApiKeyAuthOptions) {
  return async (c: Context, next: () => Promise<void>) => {
    const { requiredPermission } = options

    // 1. 获取 API Key
    const apiKey = c.req.header('X-API-Key')

    if (!apiKey) {
      return c.json(
        {
          error: {
            code: 'MISSING_API_KEY',
            message: 'API Key is required. Please provide X-API-Key header.',
          },
        },
        401
      )
    }

    // 2. 验证 API Key
    const validation = await validateApiKey(apiKey, c.env.DB)

    if (!validation.valid || !validation.data || !validation.permissions) {
      return c.json(
        {
          error: {
            code: 'INVALID_API_KEY',
            message: validation.error || 'Invalid API Key',
          },
        },
        401
      )
    }

    const { data: keyData, permissions } = validation

    // 3. 检查权限
    if (!checkPermission(permissions, requiredPermission)) {
      return c.json(
        {
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Missing required permission: ${requiredPermission}`,
            required: requiredPermission,
            available: permissions,
          },
        },
        403
      )
    }

    // 4. 检查速率限制（如果未配置 KV，则跳过限流，但仍允许请求）
    const kv = c.env.TMARKS_KV

    if (kv) {
      const rateLimitResult = await checkRateLimit(keyData.id, kv)

      if (!rateLimitResult.allowed) {
        // 设置速率限制响应头
        c.header('X-RateLimit-Limit', String(rateLimitResult.limit))
        c.header('X-RateLimit-Remaining', String(rateLimitResult.remaining))
        c.header('X-RateLimit-Reset', String(rateLimitResult.reset))

        if (rateLimitResult.retryAfter) {
          c.header('Retry-After', String(rateLimitResult.retryAfter))
        }

        return c.json(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded',
              retry_after: rateLimitResult.retryAfter,
            },
          },
          429
        )
      }

      // 5. 记录请求
      await recordRequest(keyData.id, kv)
    }

    // 6. 获取请求 IP
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null

    // 7. 更新最后使用信息
    await updateLastUsed(keyData.id, ip, c.env.DB)

    // 8. 传递用户信息到后续处理
    c.set('user_id', keyData.user_id)
    c.set('api_key_id', keyData.id)
    c.set('api_key_permissions', permissions)

    // 9. 继续处理请求
    await next()

    // 10. 请求完成后记录日志
    const status = c.res.status
    const endpoint = c.req.path
    const method = c.req.method

    await logApiKeyUsage(
      {
        api_key_id: keyData.id,
        user_id: keyData.user_id,
        endpoint,
        method,
        status,
        ip,
      },
      c.env.DB
    )

    // 11. 添加速率限制响应头
    c.header('X-RateLimit-Limit', String(rateLimitResult.limit))
    c.header('X-RateLimit-Remaining', String(rateLimitResult.remaining))
    c.header('X-RateLimit-Reset', String(rateLimitResult.reset))
  }
}

/**
 * 可选的 API Key 认证
 * 如果提供了 API Key 则验证，否则继续（用于可选认证的端点）
 */
export function optionalApiKey() {
  return async (c: Context, next: () => Promise<void>) => {
    const apiKey = c.req.header('X-API-Key')

    if (apiKey) {
      const validation = await validateApiKey(apiKey, c.env.DB)

      if (validation.valid && validation.data && validation.permissions) {
        c.set('user_id', validation.data.user_id)
        c.set('api_key_id', validation.data.id)
        c.set('api_key_permissions', validation.permissions)
      }
    }

    await next()
  }
}
