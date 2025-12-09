/**
 * Dual Authentication Middleware
 * 支持 JWT Token 和 API Key 两种认证方式
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../lib/types'
import { validateApiKey } from '../lib/api-key/validator'
import { checkRateLimit, recordRequest } from '../lib/api-key/rate-limiter'
import { hasPermission } from '../../shared/permissions'
import { unauthorized, forbidden, tooManyRequests } from '../lib/response'
import { verifyJWT } from '../lib/jwt'

export interface DualAuthContext {
  user_id: string
  auth_type: 'jwt' | 'api_key'
  api_key_id?: string
  api_key_permissions?: string[]
}

/**
 * 创建双重认证中间件
 * @param requiredPermission 需要的权限（仅用于 API Key 认证）
 */
export function requireDualAuth(
  requiredPermission: string
): PagesFunction<Env, RouteParams, DualAuthContext> {
  return async (context) => {
    const request = context.request

    try {
      // 1. 检查是否有 API Key
      const apiKey = request.headers.get('X-API-Key')
      
      if (apiKey) {
        // API Key 认证流程
        const validation = await validateApiKey(apiKey, context.env.DB)

        if (!validation.valid || !validation.data || !validation.permissions) {
          return unauthorized({
            code: 'INVALID_API_KEY',
            message: validation.error || 'Invalid API Key',
          })
        }

        const { data: keyData, permissions } = validation

        // 检查权限
        if (!hasPermission(permissions, requiredPermission)) {
          return forbidden({
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Missing required permission: ${requiredPermission}`,
            required: requiredPermission,
            available: permissions,
          })
        }

        // 检查速率限制（如果未配置 KV，则跳过限流，但仍允许请求）
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

          // 记录请求
          await recordRequest(keyData.id, kv)
        }

        // 获取请求 IP
        const ip =
          request.headers.get('CF-Connecting-IP') ||
          request.headers.get('X-Forwarded-For') ||
          null

        // 传递用户信息到 context.data
        context.data.user_id = keyData.user_id
        context.data.auth_type = 'api_key'
        context.data.api_key_id = keyData.id
        context.data.api_key_permissions = permissions

        // 更新最后使用信息（异步）
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

        return context.next()
      }

      // 2. 检查是否有 JWT Token
      const authHeader = request.headers.get('Authorization')
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)

        try {
          const payload = await verifyJWT(token, context.env.JWT_SECRET)

          if (!payload || !payload.sub) {
            return unauthorized({
              code: 'INVALID_TOKEN',
              message: 'Invalid or expired token',
            })
          }

          // 传递用户信息到 context.data
          context.data.user_id = payload.sub
          context.data.auth_type = 'jwt'

          return context.next()
        } catch {
          return unauthorized({
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
          })
        }
      }

      // 3. 没有任何认证信息
      return unauthorized({
        code: 'MISSING_AUTH',
        message: 'Authentication required. Provide either X-API-Key header or Bearer token.',
      })
    } catch (error) {
      console.error('Dual auth middleware error:', error)
      return unauthorized({
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      })
    }
  }
}

