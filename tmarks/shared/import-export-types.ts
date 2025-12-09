/**
 * 导入导出功能的共享类型定义
 * 提供类型安全的接口定义，支持多种格式的数据交换
 */

// ============ 基础数据类型 ============

export interface ExportBookmark {
  id: string
  title: string
  url: string
  description?: string
  cover_image?: string
  tags: string[]
  is_pinned: boolean
  created_at: string
  updated_at: string
  click_count?: number
  last_clicked_at?: string
}

export interface ExportTag {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
  bookmark_count?: number
}

export interface ExportUser {
  id: string
  email: string
  name?: string
  created_at: string
}

export interface ExportTabGroupItem {
  id: string
  title: string
  url: string
  favicon?: string
  position: number
  is_pinned: boolean
  is_todo: boolean
  is_archived: boolean
  created_at: string
}

export interface ExportTabGroup {
  id: string
  title: string
  parent_id?: string
  is_folder: boolean
  position: number
  color?: string
  tags?: string
  created_at: string
  updated_at: string
  items: ExportTabGroupItem[]
}

// ============ 导出格式 ============

export type ExportFormat = 'json' | 'html'

export interface TMarksExportData {
  version: string
  exported_at: string
  user: ExportUser
  bookmarks: ExportBookmark[]
  tags: ExportTag[]
  tab_groups?: ExportTabGroup[]
  metadata: {
    total_bookmarks: number
    total_tags: number
    total_tab_groups?: number
    export_format: ExportFormat
  }
}

// ============ 导入格式 ============

export type ImportFormat = 'html' | 'json' | 'tmarks'

export interface ParsedBookmark {
  title: string
  url: string
  description?: string
  cover_image?: string
  tags: string[]
  created_at?: string
  folder?: string
}

export interface ParsedTag {
  name: string
  color?: string
}

export interface ParsedTabGroupItem {
  id?: string
  title: string
  url: string
  favicon?: string
  position: number
  is_pinned: boolean
  is_todo: boolean
  is_archived: boolean
  created_at?: string
}

export interface ParsedTabGroup {
  id?: string
  title: string
  parent_id?: string
  is_folder: boolean
  position: number
  color?: string
  tags?: string
  created_at?: string
  updated_at?: string
  items: ParsedTabGroupItem[]
}

export interface ImportData {
  bookmarks: ParsedBookmark[]
  tags: ParsedTag[]
  tab_groups?: ParsedTabGroup[]
  metadata?: {
    source: ImportFormat
    total_items: number
    total_tab_groups?: number
    parsed_at: string
  }
}

// ============ 操作结果 ============

export interface ImportResult {
  success: number
  failed: number
  skipped: number
  total: number
  errors: ImportError[]
  created_bookmarks: string[]
  created_tags: string[]
  created_tab_groups: string[]
  tab_groups_success: number
  tab_groups_failed: number
}

export interface ExportResult {
  success: boolean
  format: ExportFormat
  filename: string
  size: number
  exported_at: string
  error?: string
}

export interface ImportError {
  index: number
  item: ParsedBookmark
  error: string
  code: ImportErrorCode
}

export type ImportErrorCode = 
  | 'INVALID_URL'
  | 'DUPLICATE_URL'
  | 'MISSING_TITLE'
  | 'TAG_CREATION_FAILED'
  | 'BOOKMARK_CREATION_FAILED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR'

// ============ 进度跟踪 ============

export interface ProgressInfo {
  current: number
  total: number
  percentage: number
  status: ProgressStatus
  message: string
  estimated_remaining?: number
}

export type ProgressStatus = 
  | 'preparing'
  | 'parsing'
  | 'validating'
  | 'importing'
  | 'exporting'
  | 'completed'
  | 'failed'
  | 'cancelled'

// ============ 配置选项 ============

export interface ImportOptions {
  skip_duplicates: boolean
  create_missing_tags: boolean
  preserve_timestamps: boolean
  batch_size: number
  max_concurrent: number
  default_tag_color: string
  folder_as_tag: boolean
}

export interface ExportOptions {
  include_tags: boolean
  include_metadata: boolean
  format_options: {
    pretty_print?: boolean
    include_click_stats?: boolean
    include_user_info?: boolean
  }
}

// ============ API 请求/响应 ============

export interface ExportRequest {
  format: ExportFormat
  options?: ExportOptions
}

export interface ImportRequest {
  format: ImportFormat
  data: string | File
  options?: ImportOptions
}

export interface ImportProgressResponse {
  progress: ProgressInfo
  result?: ImportResult
}

export interface ExportProgressResponse {
  progress: ProgressInfo
  result?: ExportResult
}

// ============ 解析器接口 ============

export interface ImportParser {
  format: ImportFormat
  parse(content: string): Promise<ImportData>
  validate(data: ImportData): Promise<ValidationResult>
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  value?: unknown
}

export interface ValidationWarning {
  field: string
  message: string
  value?: unknown
}

// ============ 导出器接口 ============

export interface Exporter {
  format: ExportFormat
  export(data: TMarksExportData, options?: ExportOptions): Promise<ExportOutput>
}

export interface ExportOutput {
  content: string | Buffer
  filename: string
  mimeType: string
  size: number
}

// ============ 工具函数类型 ============

export type DateParser = (dateString: string) => Date | null
export type URLValidator = (url: string) => boolean
export type TagNormalizer = (tagName: string) => string

// ============ 常量 ============

export const SUPPORTED_IMPORT_FORMATS: ImportFormat[] = ['html', 'json', 'tmarks']
export const SUPPORTED_EXPORT_FORMATS: ExportFormat[] = ['json', 'html']

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  skip_duplicates: true,
  create_missing_tags: true,
  preserve_timestamps: true,
  batch_size: 50,
  max_concurrent: 5,
  default_tag_color: '#3b82f6',
  folder_as_tag: true
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  include_tags: true,
  include_metadata: true,
  format_options: {
    pretty_print: true,
    include_click_stats: false,
    include_user_info: false
  }
}

export const EXPORT_VERSION = '1.0.0'
