import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, Bookmark, BookmarkRow, RouteParams, SQLParam } from '../../../lib/types'
import { success, badRequest, created, internalError } from '../../../lib/response'
import { requireAuth, AuthContext } from '../../../middleware/auth'
import { isValidUrl, sanitizeString } from '../../../lib/validation'
import { filterRateLimiter } from '../../../lib/rate-limit'
import { generateUUID } from '../../../lib/crypto'
import { normalizeBookmark } from '../../../lib/bookmark-utils'
import { invalidatePublicShareCache } from '../../shared/cache'
import { CacheService } from '../../../lib/cache'
import { createBookmarkCacheManager } from '../../../lib/cache/bookmark-cache'
import type { QueryParams } from '../../../lib/cache/types'
import { createOrLinkTags } from '../../../lib/tags'
import { uploadCoverImageToR2 } from '../../../lib/image-upload'

interface CreateBookmarkRequest {
  title: string
  url: string
  description?: string
  cover_image?: string
  favicon?: string
  tag_ids?: string[]  // 兼容旧版：标签 ID 数组
  tags?: string[]     // 新版：标签名称数组（推荐）
  is_pinned?: boolean
  is_archived?: boolean
  is_public?: boolean
}

interface BookmarkWithTags extends Bookmark {
  tags: Array<{ id: string; name: string; color: string | null }>
}

// GET /api/v1/bookmarks - 获取书签列表
export const onRequestGet: PagesFunction<Env, RouteParams, AuthContext>[] = [
  requireAuth,
  filterRateLimiter,
  async (context) => {
    try {
      const userId = context.data.user_id
      const url = new URL(context.request.url)

      // 解析查询参数
      const keyword = url.searchParams.get('keyword') || ''
      const tagIds = url.searchParams.get('tags')?.split(',').filter(Boolean) || []
      const pageSize = Math.min(parseInt(url.searchParams.get('page_size') || '30'), 100)
      const pageCursor = url.searchParams.get('page_cursor') || ''
      const sortBy = url.searchParams.get('sort') || 'created' // created, updated, pinned
      const isArchived = url.searchParams.get('archived') === 'true'
      const isPinned = url.searchParams.get('pinned') === 'true'

      // 初始化缓存服务
      const cache = new CacheService(context.env)
      const bookmarkCache = createBookmarkCacheManager(cache)

      // 构建查询参数对象
      const queryParams: QueryParams = {
        keyword: keyword || undefined,
        tags: tagIds.length > 0 ? tagIds : undefined,
        archived: isArchived || undefined,
        pinned: isPinned || undefined,
        sort: sortBy !== 'created' ? sortBy : undefined,
        page_cursor: pageCursor || undefined,
      }

      // 尝试从缓存获取 (只缓存默认列表查询)
      const cached = await bookmarkCache.getBookmarkList(userId, queryParams)
      if (cached) {
        return success({
          ...cached,
          _cached: true, // 标记为缓存数据
        })
      }

      // 记录标签点击统计(异步执行,不阻塞主查询)
      if (tagIds.length > 0) {
        const now = new Date().toISOString()
        Promise.all(
          tagIds.map(tagId =>
            context.env.DB.prepare(
              'UPDATE tags SET click_count = click_count + 1, last_clicked_at = ?, updated_at = ? WHERE id = ? AND user_id = ?'
            )
              .bind(now, now, tagId, userId)
              .run()
          )
        ).catch(err => console.error('Failed to record tag clicks:', err))
      }

      // 构建查询条件（不包含占位符的参数值）
      const conditions: string[] = ['b.user_id = ?', 'b.deleted_at IS NULL']
      const conditionParams: SQLParam[] = [userId]

      if (isArchived) {
        conditions.push('b.is_archived = 1')
      } else {
        conditions.push('b.is_archived = 0')
      }

      if (isPinned) {
        conditions.push('b.is_pinned = 1')
      }

      if (keyword) {
        conditions.push('(b.title LIKE ? OR b.description LIKE ? OR b.url LIKE ?)')
        const searchPattern = `%${keyword}%`
        conditionParams.push(searchPattern, searchPattern, searchPattern)
      }

      // 游标分页（基于 ID）
      if (pageCursor) {
        conditions.push('b.id < ?')
        conditionParams.push(pageCursor)
      }

      // 如果有标签筛选，使用标签交集查询
      let query = `
        SELECT DISTINCT b.*
        FROM bookmarks b
      `
      let params: SQLParam[] = []

      if (tagIds.length > 0) {
        query += `
          INNER JOIN bookmark_tags bt ON b.id = bt.bookmark_id
          WHERE bt.tag_id IN (${tagIds.map(() => '?').join(',')})
            AND ${conditions.join(' AND ')}
          GROUP BY b.id
          HAVING COUNT(DISTINCT bt.tag_id) = ?
        `
        // 参数顺序：tagIds, conditionParams, tagIds.length
        params = [...tagIds, ...conditionParams, tagIds.length]
      } else {
        query += ` WHERE ${conditions.join(' AND ')}`
        params = conditionParams
      }

      // 排序
      let orderBy = ''
      switch (sortBy) {
        case 'updated':
          orderBy = 'ORDER BY b.is_pinned DESC, b.updated_at DESC, b.id DESC'
          break
        case 'pinned':
          orderBy = 'ORDER BY b.is_pinned DESC, b.created_at DESC, b.id DESC'
          break
        case 'popular':
          orderBy = 'ORDER BY b.is_pinned DESC, b.click_count DESC, b.last_clicked_at DESC, b.id DESC'
          break
        case 'created':
        default:
          orderBy = 'ORDER BY b.is_pinned DESC, b.created_at DESC, b.id DESC'
          break
      }

      query += ` ${orderBy} LIMIT ?`
      params.push(pageSize + 1) // 多获取一条以判断是否有下一页

      // 执行查询
      const { results } = await context.env.DB.prepare(query).bind(...params).all<BookmarkRow>()

      // 判断是否有下一页
      const hasMore = results.length > pageSize
      const bookmarks = hasMore ? results.slice(0, pageSize) : results

      // 获取下一页游标（最后一条记录的 ID）
      const nextCursor = hasMore && bookmarks.length > 0 ? String(bookmarks[bookmarks.length - 1].id) : null

      // 优化：使用单次查询获取所有书签的标签
      const bookmarkIds = bookmarks.map(b => b.id)

      // 一次性获取所有书签的标签
      let allTags: Array<{ bookmark_id: string; id: string; name: string; color: string | null }> = []

      if (bookmarkIds.length > 0) {
        const placeholders = bookmarkIds.map(() => '?').join(',')
        const { results: tagResults } = await context.env.DB.prepare(
          `SELECT
             bt.bookmark_id,
             t.id,
             t.name,
             t.color
           FROM tags t
           INNER JOIN bookmark_tags bt ON t.id = bt.tag_id
           WHERE bt.bookmark_id IN (${placeholders})
             AND t.deleted_at IS NULL
           ORDER BY bt.bookmark_id, t.name`
        )
          .bind(...bookmarkIds)
          .all<{ bookmark_id: string; id: string; name: string; color: string | null }>()

        allTags = tagResults ?? []
      }

      // 将标签按书签ID分组
      const tagsByBookmarkId = new Map<string, Array<{ id: string; name: string; color: string | null }>>()
      for (const tag of allTags || []) {
        if (!tagsByBookmarkId.has(tag.bookmark_id)) {
          tagsByBookmarkId.set(tag.bookmark_id, [])
        }
        const tags = tagsByBookmarkId.get(tag.bookmark_id)
        if (tags) {
          tags.push({
            id: tag.id,
            name: tag.name,
            color: tag.color,
          })
        }
      }

      // 一次性获取所有书签的快照数量
      const snapshotCounts = new Map<string, number>()
      
      if (bookmarkIds.length > 0) {
        try {
          const placeholders = bookmarkIds.map(() => '?').join(',')
          const { results: countResults } = await context.env.DB.prepare(
            `SELECT bookmark_id, COUNT(*) as count
             FROM bookmark_snapshots
             WHERE bookmark_id IN (${placeholders})
             GROUP BY bookmark_id`
          )
            .bind(...bookmarkIds)
            .all<{ bookmark_id: string; count: number }>()

          for (const row of countResults || []) {
            snapshotCounts.set(row.bookmark_id, row.count)
          }
        } catch (snapshotError) {
          // 如果快照表不存在，忽略错误（向后兼容）
          console.warn('Failed to fetch snapshot counts (table may not exist):', snapshotError)
        }
      }

      // 组装书签和标签数据
      const bookmarksWithTags: BookmarkWithTags[] = bookmarks.map(bookmark => ({
        ...normalizeBookmark(bookmark),
        tags: tagsByBookmarkId.get(bookmark.id) || [],
        snapshot_count: snapshotCounts.get(bookmark.id) || 0,
      }))

      const responseData = {
        bookmarks: bookmarksWithTags,
        meta: {
          page_size: pageSize,
          count: bookmarks.length,
          next_cursor: nextCursor,
          has_more: hasMore,
        },
      }

      // 异步写入缓存 (不阻塞响应)
      await bookmarkCache.setBookmarkList(userId, queryParams, responseData, { async: true })

      return success(responseData)
    } catch (error) {
      console.error('Get bookmarks error:', error)
      return internalError('Failed to get bookmarks')
    }
  },
]

// POST /api/v1/bookmarks - 创建书签
export const onRequestPost: PagesFunction<Env, RouteParams, AuthContext>[] = [
  requireAuth,
  async (context) => {
    try {
      const userId = context.data.user_id
      const body = await context.request.json() as CreateBookmarkRequest

      // 验证输入
      if (!body.title || !body.url) {
        return badRequest('Title and URL are required')
      }

      if (!isValidUrl(body.url)) {
        return badRequest('Invalid URL format')
      }

      const title = sanitizeString(body.title, 500)
      const url = sanitizeString(body.url, 2000)
      const description = body.description ? sanitizeString(body.description, 1000) : null
      let coverImage = body.cover_image ? sanitizeString(body.cover_image, 2000) : null
      const favicon = body.favicon ? sanitizeString(body.favicon, 2000) : null

      // 检查URL是否已存在（包括已删除的）
      const existing = await context.env.DB.prepare(
        'SELECT id, deleted_at FROM bookmarks WHERE user_id = ? AND url = ?'
      )
        .bind(userId, url)
        .first<{ id: string; deleted_at: string | null }>()

      const now = new Date().toISOString()
      let bookmarkId: string
      const isPinned = body.is_pinned ? 1 : 0
      const isArchived = body.is_archived ? 1 : 0
      const isPublic = body.is_public ? 1 : 0

      // 如果有封面图且配置了 R2 bucket，上传到 R2
      let coverImageId: string | null = null
      if (coverImage && context.env.SNAPSHOTS_BUCKET && context.env.R2_PUBLIC_URL) {
        // 生成临时 ID（如果是新书签）
        const tempBookmarkId = existing?.id || generateUUID()

        const uploadResult = await uploadCoverImageToR2(
          coverImage,
          userId,
          tempBookmarkId,
          context.env.SNAPSHOTS_BUCKET,
          context.env.DB,
          context.env.R2_PUBLIC_URL,
          context.env
        )

        // 如果上传成功，使用 R2 URL 和 imageId
        if (uploadResult.success && uploadResult.r2Url) {
          coverImage = uploadResult.r2Url
          coverImageId = uploadResult.imageId || null
        }
        // 如果上传失败，继续使用原始 URL（降级方案）
      }

      if (existing) {
        bookmarkId = existing.id
        
        // 如果是未删除的书签
        if (!existing.deleted_at) {
          // 返回现有书签信息，让前端可以为其创建快照
          const bookmarkRow = await context.env.DB.prepare('SELECT * FROM bookmarks WHERE id = ?')
            .bind(bookmarkId)
            .first<BookmarkRow>()

          const { results: tags } = await context.env.DB.prepare(
            `SELECT t.id, t.name, t.color
             FROM tags t
             INNER JOIN bookmark_tags bt ON t.id = bt.tag_id
             WHERE bt.bookmark_id = ?`
          )
            .bind(bookmarkId)
            .all<{ id: string; name: string; color: string | null }>()

          if (!bookmarkRow) {
            return internalError('Failed to retrieve bookmark')
          }

          const bookmark = normalizeBookmark(bookmarkRow)

          return success(
            {
              bookmark: {
                ...bookmark,
                tags: tags || [],
              },
            },
            {
              message: 'Bookmark already exists',
              code: 'BOOKMARK_EXISTS',
            }
          )
        }

        // 如果是已删除的书签，恢复并更新
        await context.env.DB.prepare(
          `UPDATE bookmarks
           SET title = ?, description = ?, cover_image = ?, cover_image_id = ?, favicon = ?,
               is_pinned = ?, is_archived = ?, is_public = ?,
               deleted_at = NULL, updated_at = ?
           WHERE id = ?`
        )
          .bind(
            title,
            description,
            coverImage,
            coverImageId,
            favicon,
            isPinned,
            isArchived,
            isPublic,
            now,
            bookmarkId
          )
          .run()

        // 清除旧的标签关联
        await context.env.DB.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?')
          .bind(bookmarkId)
          .run()
      } else {
        // 不存在，创建新书签
        const bookmarkUuid = generateUUID()
        bookmarkId = bookmarkUuid

        await context.env.DB.prepare(
          `INSERT INTO bookmarks (id, user_id, title, url, description, cover_image, cover_image_id, favicon, is_pinned, is_archived, is_public, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            bookmarkUuid,
            userId,
            title,
            url,
            description,
            coverImage,
            coverImageId,
            favicon,
            isPinned,
            isArchived,
            isPublic,
            now,
            now
          )
          .run()
      }

      // 处理标签（支持两种方式）
      if (body.tags && body.tags.length > 0) {
        // 新版：直接传标签名称，后端自动创建或链接
        await createOrLinkTags(context.env.DB, bookmarkId, body.tags, userId)
      } else if (body.tag_ids && body.tag_ids.length > 0) {
        // 兼容旧版：传标签 ID
        for (const tagId of body.tag_ids) {
          await context.env.DB.prepare(
            'INSERT INTO bookmark_tags (bookmark_id, tag_id, user_id, created_at) VALUES (?, ?, ?, ?)'
          )
            .bind(bookmarkId, tagId, userId, now)
            .run()
        }
      }

      // 获取完整的书签信息（包含标签）
      const bookmarkRow = await context.env.DB.prepare('SELECT * FROM bookmarks WHERE id = ?')
        .bind(bookmarkId)
        .first<BookmarkRow>()

      const { results: tags } = await context.env.DB.prepare(
        `SELECT t.id, t.name, t.color
         FROM tags t
         INNER JOIN bookmark_tags bt ON t.id = bt.tag_id
         WHERE bt.bookmark_id = ?`
      )
        .bind(bookmarkId)
        .all<{ id: string; name: string; color: string | null }>()

      if (!bookmarkRow) {
        return internalError('Failed to load bookmark after creation')
      }

      // 失效缓存
      const cache = new CacheService(context.env)
      const bookmarkCache = createBookmarkCacheManager(cache)
      await bookmarkCache.invalidateUserBookmarks(userId)

      if (body.is_public) {
        await invalidatePublicShareCache(context.env, userId)
      }

      return created({
        bookmark: {
          ...normalizeBookmark(bookmarkRow),
          tags: tags || [],
        },
      })
    } catch (error) {
      console.error('Create bookmark error:', error)
      return internalError('Failed to create bookmark')
    }
  },
]
