/**
 * 导出 API 端点
 * 支持多种格式的书签数据导出
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import type { Env, RouteParams } from '../../lib/types'
import { requireAuth, type AuthContext } from '../../middleware/auth'
import type {
  ExportFormat,
  TMarksExportData,
  ExportOptions,
  ExportBookmark,
  ExportTag,
  ExportUser,
  ExportTabGroup,
  ExportTabGroupItem
} from '../../../shared/import-export-types'

import { createJsonExporter } from '../../lib/import-export/exporters/json-exporter'
import { createHtmlExporter } from '../../lib/import-export/exporters/html-exporter'
import { EXPORT_VERSION } from '../../../shared/import-export-types'

interface ExportRequest {
  format?: ExportFormat
  options?: ExportOptions
}

export const onRequestGet: PagesFunction<Env, RouteParams, AuthContext>[] = [
  requireAuth,
  async (context) => {
    try {
      const userId = context.data.user_id

      const { searchParams } = new URL(context.request.url)
      const format = (searchParams.get('format') || 'json') as ExportFormat
      const includeMetadata = searchParams.get('include_metadata') !== 'false'
      const includeTags = searchParams.get('include_tags') !== 'false'
      const prettyPrint = searchParams.get('pretty_print') !== 'false'

      // 构建导出选项
      const options: ExportOptions = {
        include_tags: includeTags,
        include_metadata: includeMetadata,
        format_options: {
          pretty_print: prettyPrint,
          include_click_stats: searchParams.get('include_stats') === 'true',
          include_user_info: searchParams.get('include_user') === 'true'
        }
      }

      // 获取用户数据
      const exportData = await collectUserData(context.env.DB, userId)

      // 根据格式选择导出器
      let result
      switch (format) {
        case 'json': {
          const jsonExporter = createJsonExporter()
          result = await jsonExporter.export(exportData, options)
          break
        }

        case 'html': {
          const htmlExporter = createHtmlExporter()
          result = await htmlExporter.export(exportData, options)
          break
        }

        default:
          return new Response(
            JSON.stringify({ error: `Unsupported export format: ${format}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
      }

      // 返回导出文件
      return new Response(result.content, {
        status: 200,
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          'Content-Length': result.size.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })

    } catch (error) {
      console.error('Export error:', error)
      return new Response(
        JSON.stringify({
          error: 'Export failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
]

/**
 * 收集用户的所有数据用于导出
 */
async function collectUserData(db: D1Database, userId: string): Promise<TMarksExportData> {
  try {
    // 获取用户信息（如果是默认用户，创建虚拟用户信息）
    interface UserRow {
      id: string
      email: string | null
      username: string
      created_at: string
    }
    
    let user: UserRow
    if (userId === 'default-user') {
      user = {
        id: 'default-user',
        email: 'default@tmarks.local',
        username: 'Default User',
        created_at: new Date().toISOString()
      }
    } else {
      const { results: users } = await db.prepare(
        'SELECT id, email, username, created_at FROM users WHERE id = ?'
      ).bind(userId).all<UserRow>()

      const foundUser = users?.[0]
      if (!foundUser) {
        throw new Error('User not found')
      }
      user = foundUser
    }

    // 获取所有书签
    const { results: bookmarks } = await db.prepare(`
      SELECT
        id, title, url, description, cover_image, is_pinned,
        created_at, updated_at, click_count, last_clicked_at
      FROM bookmarks
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `).bind(userId).all()

    // 获取所有标签
    const { results: tags } = await db.prepare(`
      SELECT id, name, color, created_at, updated_at
      FROM tags 
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY name ASC
    `).bind(userId).all()

    // 获取书签-标签关联
    const { results: bookmarkTags } = await db.prepare(`
      SELECT bookmark_id, tag_id, t.name as tag_name
      FROM bookmark_tags bt
      JOIN tags t ON bt.tag_id = t.id
      WHERE bt.user_id = ?
    `).bind(userId).all()

    // 构建书签标签映射
    const bookmarkTagMap = new Map<string, string[]>()
    bookmarkTags?.forEach((bt: Record<string, unknown>) => {
      const bookmarkId = String(bt.bookmark_id)
      const tagName = String(bt.tag_name)
      if (!bookmarkTagMap.has(bookmarkId)) {
        bookmarkTagMap.set(bookmarkId, [])
      }
      bookmarkTagMap.get(bookmarkId)!.push(tagName)
    })

    // 构建导出数据
    const exportBookmarks: ExportBookmark[] = (bookmarks || []).map((bookmark: Record<string, unknown>) => ({
      id: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      description: bookmark.description,
      cover_image: bookmark.cover_image,
      tags: bookmarkTagMap.get(bookmark.id) || [],
      is_pinned: Boolean(bookmark.is_pinned),
      created_at: bookmark.created_at,
      updated_at: bookmark.updated_at,
      click_count: bookmark.click_count || 0,
      last_clicked_at: bookmark.last_clicked_at
    }))

    const exportTags: ExportTag[] = (tags || []).map((tag: Record<string, unknown>) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      created_at: tag.created_at,
      updated_at: tag.updated_at,
      bookmark_count: Array.from(bookmarkTagMap.values()).filter(tagList => 
        tagList.includes(tag.name)
      ).length
    }))

    const exportUser: ExportUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at
    }

    // 获取标签页组
    const { results: tabGroups } = await db.prepare(`
      SELECT id, title, parent_id, is_folder, position, color, tags, created_at, updated_at
      FROM tab_groups
      WHERE user_id = ? AND is_deleted = 0
      ORDER BY position ASC
    `).bind(userId).all()

    // 获取标签页组项目
    const { results: tabGroupItems } = await db.prepare(`
      SELECT tgi.id, tgi.group_id, tgi.title, tgi.url, tgi.favicon, tgi.position, 
             tgi.is_pinned, tgi.is_todo, tgi.is_archived, tgi.created_at
      FROM tab_group_items tgi
      JOIN tab_groups tg ON tgi.group_id = tg.id
      WHERE tg.user_id = ? AND tg.is_deleted = 0
      ORDER BY tgi.position ASC
    `).bind(userId).all()

    // 构建标签页组项目映射
    const groupItemsMap = new Map<string, ExportTabGroupItem[]>()
    tabGroupItems?.forEach((item: Record<string, unknown>) => {
      const groupId = String(item.group_id)
      if (!groupItemsMap.has(groupId)) {
        groupItemsMap.set(groupId, [])
      }
      groupItemsMap.get(groupId)!.push({
        id: String(item.id),
        title: String(item.title),
        url: String(item.url),
        favicon: item.favicon ? String(item.favicon) : undefined,
        position: Number(item.position),
        is_pinned: Boolean(item.is_pinned),
        is_todo: Boolean(item.is_todo),
        is_archived: Boolean(item.is_archived),
        created_at: String(item.created_at)
      })
    })

    // 构建导出标签页组
    const exportTabGroups: ExportTabGroup[] = (tabGroups || []).map((group: Record<string, unknown>) => ({
      id: String(group.id),
      title: String(group.title),
      parent_id: group.parent_id ? String(group.parent_id) : undefined,
      is_folder: Boolean(group.is_folder),
      position: Number(group.position),
      color: group.color ? String(group.color) : undefined,
      tags: group.tags ? String(group.tags) : undefined,
      created_at: String(group.created_at),
      updated_at: String(group.updated_at),
      items: groupItemsMap.get(String(group.id)) || []
    }))

    const exportedAt = new Date().toISOString()

    return {
      version: EXPORT_VERSION,
      exported_at: exportedAt,
      user: exportUser,
      bookmarks: exportBookmarks,
      tags: exportTags,
      tab_groups: exportTabGroups,
      metadata: {
        total_bookmarks: exportBookmarks.length,
        total_tags: exportTags.length,
        total_tab_groups: exportTabGroups.length,
        export_format: 'json'
      }
    }

  } catch (error) {
    console.error('Data collection error:', error)
    throw new Error(`Failed to collect user data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 获取导出预览信息
 */
export const onRequestPost: PagesFunction<Env, RouteParams, AuthContext>[] = [
  requireAuth,
  async (context) => {
    try {
      const userId = context.data.user_id
      const { format = 'json' } = await context.request.json() as ExportRequest

      // 获取统计信息
      const stats = await getExportStats(context.env.DB, userId)

      // 估算文件大小
      const estimatedSize = estimateExportSize(stats, format)

      return new Response(
        JSON.stringify({
          stats,
          estimated_size: estimatedSize,
          format,
          estimated_filename: generateFilename(format)
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )

    } catch (error) {
      console.error('Export preview error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to get export preview' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
]

async function getExportStats(db: D1Database, userId: string) {
  interface CountRow {
    count: number
  }
  
  const [bookmarkCount, tagCount, pinnedCount, tabGroupCount] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL')
      .bind(userId).first<CountRow>(),
    db.prepare('SELECT COUNT(*) as count FROM tags WHERE user_id = ? AND deleted_at IS NULL')
      .bind(userId).first<CountRow>(),
    db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_pinned = 1 AND deleted_at IS NULL')
      .bind(userId).first<CountRow>(),
    db.prepare('SELECT COUNT(*) as count FROM tab_groups WHERE user_id = ? AND is_deleted = 0')
      .bind(userId).first<CountRow>()
  ])

  return {
    total_bookmarks: bookmarkCount?.count || 0,
    total_tags: tagCount?.count || 0,
    pinned_bookmarks: pinnedCount?.count || 0,
    total_tab_groups: tabGroupCount?.count || 0
  }
}

function estimateExportSize(stats: { total_bookmarks: number; total_tags: number; pinned_bookmarks: number; total_tab_groups: number }, format: ExportFormat): number {
  const avgBookmarkSize = format === 'json' ? 200 : 150 // bytes per bookmark
  const avgTagSize = format === 'json' ? 50 : 30 // bytes per tag
  const avgTabGroupSize = format === 'json' ? 500 : 300 // bytes per tab group (including items)
  
  return (stats.total_bookmarks * avgBookmarkSize) + (stats.total_tags * avgTagSize) + (stats.total_tab_groups * avgTabGroupSize)
}

function generateFilename(format: ExportFormat): string {
  const date = new Date().toISOString().split('T')[0]
  return `tmarks-export-${date}.${format}`
}
