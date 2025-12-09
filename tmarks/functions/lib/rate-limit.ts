import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env } from './types'

type RateLimiterContext = Parameters<PagesFunction<Env>>[0]

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  key: string // The identifier (IP, user_id, etc.)
  limit: number // Maximum number of requests
  window: number // Time window in seconds
}

/**
 * Rate limiter using KV storage
 *
 * Store format in KV:
 * Key: `ratelimit:{identifier}`
 * Value: JSON { count: number, reset_at: number }
 */
export async function checkRateLimit(
  kv: KVNamespace | undefined,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  // If KV is not available, allow all requests (development mode)
  if (!kv) {
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: Date.now() + config.window * 1000,
    }
  }

  const kvKey = `ratelimit:${config.key}`
  const now = Date.now()

  try {
    // Get current rate limit data
    const data = await kv.get(kvKey, 'json') as { count: number; reset_at: number } | null

    // If no data or window expired, create new window
    if (!data || data.reset_at < now) {
      const resetAt = now + config.window * 1000
      await kv.put(
        kvKey,
        JSON.stringify({ count: 1, reset_at: resetAt }),
        { expirationTtl: config.window + 10 } // Add 10 seconds buffer
      )
      return {
        allowed: true,
        remaining: config.limit - 1,
        resetAt,
      }
    }

    // Check if limit exceeded
    if (data.count >= config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: data.reset_at,
      }
    }

    // Increment counter
    const newCount = data.count + 1
    await kv.put(
      kvKey,
      JSON.stringify({ count: newCount, reset_at: data.reset_at }),
      { expirationTtl: Math.ceil((data.reset_at - now) / 1000) + 10 }
    )

    return {
      allowed: true,
      remaining: config.limit - newCount,
      resetAt: data.reset_at,
    }
  } catch (error) {
    console.error('Rate limit check error:', error)
    // On error, allow the request to avoid blocking legitimate users
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: now + config.window * 1000,
    }
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Try Cloudflare headers first
  const cfIP = request.headers.get('CF-Connecting-IP')
  if (cfIP) return cfIP

  // Try X-Forwarded-For
  const xForwardedFor = request.headers.get('X-Forwarded-For')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }

  // Try X-Real-IP
  const xRealIP = request.headers.get('X-Real-IP')
  if (xRealIP) return xRealIP

  // Fallback
  return 'unknown'
}

/**
 * Rate limit middleware factory
 * Creates a rate limiting middleware with specified config
 */
export function createRateLimiter(
  getKey: (context: RateLimiterContext) => string,
  limit: number,
  windowSeconds: number
): PagesFunction<Env> {
  return async (context) => {
    const key = getKey(context)
    const result = await checkRateLimit(context.env.TMARKS_KV, {
      key,
      limit,
      window: windowSeconds,
    })

    // Add rate limit headers
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    }

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      return new Response(
        JSON.stringify({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retry_after: retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            ...headers,
          },
        }
      )
    }

    // Continue to next middleware
    const response = await context.next()

    // Add rate limit headers to response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }
}

/**
 * Rate limiter for login endpoint (5 requests per minute per IP)
 */
export const loginRateLimiter = createRateLimiter(
  (context) => {
    const ip = getClientIP(context.request)
    return `login:${ip}`
  },
  5, // 5 requests
  60 // 60 seconds
)

/**
 * Rate limiter for bookmarks/filter endpoints (60 requests per minute per user)
 */
export const filterRateLimiter = createRateLimiter(
  (context) => {
    // Assumes user_id is available in context.data (from auth middleware)
    const userId = context.data?.user_id || getClientIP(context.request)
    return `filter:${userId}`
  },
  60, // 60 requests
  60 // 60 seconds
)
