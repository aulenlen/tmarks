import { apiClient } from '@/lib/api-client'
import type {
  Bookmark,
  BookmarksResponse,
  CreateBookmarkRequest,
  UpdateBookmarkRequest,
  BookmarkQueryParams,
  BatchActionRequest,
  BatchActionResponse,
} from '@/lib/types'

export const bookmarksService = {
  /**
   * 获取书签列表
   */
  async getBookmarks(params?: BookmarkQueryParams) {
    const searchParams = new URLSearchParams()

    if (params?.keyword) searchParams.set('keyword', params.keyword)
    if (params?.tags) searchParams.set('tags', params.tags)
    if (params?.page_size) searchParams.set('page_size', params.page_size.toString())
    if (params?.page_cursor) searchParams.set('page_cursor', params.page_cursor)
    if (params?.sort) searchParams.set('sort', params.sort)
    if (params?.archived !== undefined) searchParams.set('archived', params.archived.toString())
    if (params?.pinned !== undefined) searchParams.set('pinned', params.pinned.toString())

    const query = searchParams.toString()
    const endpoint = query ? `/bookmarks?${query}` : '/bookmarks'

    const response = await apiClient.get<BookmarksResponse>(endpoint)
    return response.data!
  },

  /**
   * 创建书签
   */
  async createBookmark(data: CreateBookmarkRequest) {
    const response = await apiClient.post<{ bookmark: Bookmark }>('/bookmarks', data)
    return response.data!.bookmark
  },

  /**
   * 更新书签
   */
  async updateBookmark(id: string, data: UpdateBookmarkRequest) {
    const response = await apiClient.patch<{ bookmark: Bookmark }>(`/bookmarks/${id}`, data)
    return response.data!.bookmark
  },

  /**
   * 删除书签
   */
  async deleteBookmark(id: string) {
    await apiClient.delete(`/bookmarks/${id}`)
  },

  /**
   * 恢复已删除的书签
   */
  async restoreBookmark(id: string) {
    const response = await apiClient.put<{ bookmark: Bookmark }>(`/bookmarks/${id}`)
    return response.data!.bookmark
  },

  /**
   * 记录书签点击
   */
  async recordClick(id: string) {
    const response = await apiClient.post<{ message: string; clicked_at: string }>(`/bookmarks/${id}/click`)
    return response.data
  },

  /**
   * 批量操作书签
   */
  async batchAction(data: BatchActionRequest) {
    const response = await apiClient.patch<BatchActionResponse>('/bookmarks/bulk', data)
    return response.data!
  },

  /**
   * 获取书签统计数据
   */
  async getStatistics(params: {
    granularity: 'day' | 'week' | 'month' | 'year'
    startDate: string
    endDate: string
  }) {
    const { granularity, startDate, endDate } = params
    const response = await apiClient.get(
      `/bookmarks/statistics?granularity=${granularity}&start_date=${startDate}&end_date=${endDate}`
    )
    return response.data
  },

  /**
   * 检查 URL 是否已存在
   */
  async checkUrlExists(url: string) {
    const response = await apiClient.get<{ exists: boolean; bookmark?: Bookmark }>(
      `/bookmarks/check-url?url=${encodeURIComponent(url)}`
    )
    return response.data!
  },
}
