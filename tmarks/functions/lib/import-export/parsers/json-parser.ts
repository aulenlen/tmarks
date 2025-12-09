/**
 * JSON 书签解析器
 * 解析 TMarks 和其他 JSON 格式的书签文件
 */

import type { 
  ImportParser, 
  ImportData, 
  ParsedBookmark, 
  ParsedTag,
  ParsedTabGroup,
  ParsedTabGroupItem,
  ValidationResult,
  TMarksExportData 
} from '../../../../shared/import-export-types'

export class JsonParser implements ImportParser {
  readonly format = 'json' as const

  async parse(content: string): Promise<ImportData> {
    try {
      const data = JSON.parse(content)
      
      // 检测 JSON 格式类型
      const formatType = this.detectJsonFormat(data)
      
      switch (formatType) {
        case 'tmarks':
          return this.parseTMarksFormat(data)
        case 'chrome':
          return this.parseChromeFormat(data)
        case 'firefox':
          return this.parseFirefoxFormat(data)
        case 'generic':
          return this.parseGenericFormat(data)
        default:
          throw new Error('Unsupported JSON format')
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid JSON format')
      }
      throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async validate(data: ImportData): Promise<ValidationResult> {
    const errors: Array<{ field: string; message: string; value?: unknown }> = []
    const warnings: Array<{ field: string; message: string; value?: unknown }> = []

    // 验证基本结构
    if (!Array.isArray(data.bookmarks)) {
      errors.push({
        field: 'bookmarks',
        message: 'Bookmarks must be an array',
        value: typeof data.bookmarks
      })
    }

    if (!Array.isArray(data.tags)) {
      errors.push({
        field: 'tags',
        message: 'Tags must be an array',
        value: typeof data.tags
      })
    }

    // 验证书签
    data.bookmarks.forEach((bookmark, index) => {
      if (!bookmark.title?.trim()) {
        errors.push({
          field: `bookmarks[${index}].title`,
          message: 'Title is required',
          value: bookmark.title
        })
      }

      if (!bookmark.url?.trim()) {
        errors.push({
          field: `bookmarks[${index}].url`,
          message: 'URL is required',
          value: bookmark.url
        })
      } else if (!this.isValidUrl(bookmark.url)) {
        errors.push({
          field: `bookmarks[${index}].url`,
          message: 'Invalid URL format',
          value: bookmark.url
        })
      }

      if (!Array.isArray(bookmark.tags)) {
        warnings.push({
          field: `bookmarks[${index}].tags`,
          message: 'Tags should be an array, converting from string',
          value: typeof bookmark.tags
        })
      }
    })

    // 验证标签
    data.tags.forEach((tag, index) => {
      if (!tag.name?.trim()) {
        errors.push({
          field: `tags[${index}].name`,
          message: 'Tag name is required',
          value: tag.name
        })
      }

      if (tag.color && !this.isValidColor(tag.color)) {
        warnings.push({
          field: `tags[${index}].color`,
          message: 'Invalid color format, using default',
          value: tag.color
        })
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  private detectJsonFormat(data: Record<string, unknown>): string {
    // TMarks 格式检测
    if (data.version && data.exported_at && data.bookmarks && data.tags) {
      return 'tmarks'
    }

    // Chrome 书签格式检测
    if (data.roots && typeof data.roots === 'object' && data.roots !== null) {
      const roots = data.roots as Record<string, unknown>
      if (roots.bookmark_bar || roots.other) {
        return 'chrome'
      }
    }

    // Firefox 书签格式检测
    if (data.children && Array.isArray(data.children)) {
      return 'firefox'
    }

    // 通用格式检测
    if (Array.isArray(data) || (data.bookmarks && Array.isArray(data.bookmarks))) {
      return 'generic'
    }

    return 'unknown'
  }

  private parseTMarksFormat(data: TMarksExportData): ImportData {
    const bookmarks: ParsedBookmark[] = data.bookmarks.map(bookmark => ({
      title: bookmark.title,
      url: bookmark.url,
      description: bookmark.description,
      cover_image: bookmark.cover_image,
      tags: bookmark.tags || [],
      created_at: bookmark.created_at,
      folder: undefined
    }))

    const tags: ParsedTag[] = data.tags.map(tag => ({
      name: tag.name,
      color: tag.color
    }))

    // 解析标签页组
    const tab_groups: ParsedTabGroup[] = (data.tab_groups || []).map(group => ({
      id: group.id,
      title: group.title,
      parent_id: group.parent_id,
      is_folder: group.is_folder,
      position: group.position,
      color: group.color,
      tags: group.tags,
      created_at: group.created_at,
      updated_at: group.updated_at,
      items: (group.items || []).map((item): ParsedTabGroupItem => ({
        id: item.id,
        title: item.title,
        url: item.url,
        favicon: item.favicon,
        position: item.position,
        is_pinned: item.is_pinned,
        is_todo: item.is_todo,
        is_archived: item.is_archived,
        created_at: item.created_at
      }))
    }))

    return {
      bookmarks,
      tags,
      tab_groups,
      metadata: {
        source: 'json',
        total_items: bookmarks.length,
        total_tab_groups: tab_groups.length,
        parsed_at: new Date().toISOString()
      }
    }
  }

  private parseChromeFormat(data: Record<string, unknown>): ImportData {
    const bookmarks: ParsedBookmark[] = []
    const tagSet = new Set<string>()

    // 递归解析 Chrome 书签结构
    const parseNode = (node: Record<string, unknown>, folderPath: string[] = []) => {
      if (node.type === 'url') {
        const bookmark: ParsedBookmark = {
          title: node.name || 'Untitled',
          url: node.url,
          description: undefined,
          tags: folderPath.length > 0 ? [folderPath.join('/')] : [],
          created_at: this.parseTimestamp(node.date_added),
          folder: folderPath.join('/') || undefined
        }
        bookmarks.push(bookmark)
        
        // 添加文件夹作为标签
        if (folderPath.length > 0) {
          tagSet.add(folderPath.join('/'))
        }
      } else if (node.type === 'folder' && Array.isArray(node.children)) {
        const newPath = [...folderPath, String(node.name || 'Folder')]
        node.children.forEach((child: unknown) => {
          if (child && typeof child === 'object') {
            parseNode(child as Record<string, unknown>, newPath)
          }
        })
      }
    }

    // 解析书签栏和其他书签
    const roots = data.roots as Record<string, unknown>
    const bookmarkBar = roots.bookmark_bar as Record<string, unknown> | undefined
    const other = roots.other as Record<string, unknown> | undefined
    
    if (bookmarkBar?.children && Array.isArray(bookmarkBar.children)) {
      bookmarkBar.children.forEach((node: unknown) => {
        if (node && typeof node === 'object') {
          parseNode(node as Record<string, unknown>, ['书签栏'])
        }
      })
    }

    if (other?.children && Array.isArray(other.children)) {
      other.children.forEach((node: unknown) => {
        if (node && typeof node === 'object') {
          parseNode(node as Record<string, unknown>, ['其他书签'])
        }
      })
    }

    const tags: ParsedTag[] = Array.from(tagSet).map(name => ({
      name,
      color: this.generateTagColor(name)
    }))

    return {
      bookmarks,
      tags,
      metadata: {
        source: 'json',
        total_items: bookmarks.length,
        parsed_at: new Date().toISOString()
      }
    }
  }

  private parseFirefoxFormat(data: Record<string, unknown>): ImportData {
    const bookmarks: ParsedBookmark[] = []
    const tagSet = new Set<string>()

    // 递归解析 Firefox 书签结构
    const parseNode = (node: Record<string, unknown>, folderPath: string[] = []) => {
      if (node.type === 'text/x-moz-place' && node.uri) {
        const tags = typeof node.tags === 'string' ? node.tags.split(',').map((t: string) => t.trim()) : []
        if (folderPath.length > 0) {
          tags.push(folderPath.join('/'))
        }

        const bookmark: ParsedBookmark = {
          title: String(node.title || 'Untitled'),
          url: String(node.uri),
          description: typeof node.description === 'string' ? node.description : undefined,
          tags,
          created_at: this.parseTimestamp(node.dateAdded),
          folder: folderPath.join('/') || undefined
        }
        bookmarks.push(bookmark)
        
        // 添加标签
        tags.forEach(tag => tagSet.add(tag))
      } else if (node.children && Array.isArray(node.children)) {
        const newPath = node.title ? [...folderPath, String(node.title)] : folderPath
        node.children.forEach((child: unknown) => {
          if (child && typeof child === 'object') {
            parseNode(child as Record<string, unknown>, newPath)
          }
        })
      }
    }

    if (Array.isArray(data.children)) {
      data.children.forEach((node: unknown) => {
        if (node && typeof node === 'object') {
          parseNode(node as Record<string, unknown>)
        }
      })
    }

    const tags: ParsedTag[] = Array.from(tagSet).map(name => ({
      name,
      color: this.generateTagColor(name)
    }))

    return {
      bookmarks,
      tags,
      metadata: {
        source: 'json',
        total_items: bookmarks.length,
        parsed_at: new Date().toISOString()
      }
    }
  }

  private parseGenericFormat(data: unknown): ImportData {
    let bookmarkArray: unknown[] = []

    if (Array.isArray(data)) {
      bookmarkArray = data
    } else if (data && typeof data === 'object' && 'bookmarks' in data) {
      const dataObj = data as Record<string, unknown>
      if (Array.isArray(dataObj.bookmarks)) {
        bookmarkArray = dataObj.bookmarks
      }
    }
    
    if (bookmarkArray.length === 0) {
      throw new Error('Cannot find bookmark array in JSON')
    }

    const bookmarks: ParsedBookmark[] = bookmarkArray.map(item => {
      if (!item || typeof item !== 'object') {
        return {
          title: 'Untitled',
          url: '',
          description: undefined,
          tags: [],
          created_at: undefined,
          folder: undefined
        }
      }
      
      const bookmark = item as Record<string, unknown>
      return {
        title: String(bookmark.title || bookmark.name || 'Untitled'),
        url: String(bookmark.url || bookmark.href || bookmark.link || ''),
        description: typeof bookmark.description === 'string' ? bookmark.description : 
                     typeof bookmark.desc === 'string' ? bookmark.desc :
                     typeof bookmark.note === 'string' ? bookmark.note : undefined,
        tags: this.normalizeTags(bookmark.tags || bookmark.categories || []),
        created_at: typeof bookmark.created_at === 'string' ? bookmark.created_at :
                    typeof bookmark.date === 'string' ? bookmark.date :
                    typeof bookmark.timestamp === 'string' ? bookmark.timestamp : undefined,
        folder: typeof bookmark.folder === 'string' ? bookmark.folder :
                typeof bookmark.category === 'string' ? bookmark.category : undefined
      }
    })

    // 提取所有标签
    const tagSet = new Set<string>()
    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => tagSet.add(tag))
    })

    const tags: ParsedTag[] = Array.from(tagSet).map(name => ({
      name,
      color: this.generateTagColor(name)
    }))

    return {
      bookmarks,
      tags,
      metadata: {
        source: 'json',
        total_items: bookmarks.length,
        parsed_at: new Date().toISOString()
      }
    }
  }

  private normalizeTags(tags: unknown): string[] {
    if (typeof tags === 'string') {
      return tags.split(',').map(tag => tag.trim()).filter(Boolean)
    }
    if (Array.isArray(tags)) {
      return tags.map(tag => String(tag).trim()).filter(Boolean)
    }
    return []
  }

  private parseTimestamp(timestamp: unknown): string | undefined {
    if (!timestamp) return undefined

    try {
      let date: Date

      if (typeof timestamp === 'string') {
        date = new Date(timestamp)
      } else if (typeof timestamp === 'number') {
        // Chrome 使用微秒时间戳
        if (timestamp > 1000000000000000) {
          date = new Date(timestamp / 1000)
        } else {
          date = new Date(timestamp)
        }
      } else {
        return undefined
      }

      return date.toISOString()
    } catch {
      return undefined
    }
  }

  private generateTagColor(tagName: string): string {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
      '#ec4899', '#6366f1', '#14b8a6', '#eab308'
    ]
    
    let hash = 0
    for (let i = 0; i < tagName.length; i++) {
      hash = ((hash << 5) - hash + tagName.charCodeAt(i)) & 0xffffffff
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private isValidColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
  }
}

/**
 * 创建 JSON 解析器实例
 */
export function createJsonParser(): JsonParser {
  return new JsonParser()
}

/**
 * 快速解析 JSON 书签文件
 */
export async function parseJsonBookmarks(content: string): Promise<ImportData> {
  const parser = createJsonParser()
  return parser.parse(content)
}
