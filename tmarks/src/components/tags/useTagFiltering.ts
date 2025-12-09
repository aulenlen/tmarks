/**
 * 标签筛选逻辑 Hook
 */
import { useMemo } from 'react'
import type { Bookmark, Tag } from '@/lib/types'

export function useTagFiltering(
  tags: Tag[],
  bookmarks: Bookmark[],
  selectedTags: string[],
  searchQuery: string
) {
  // 计算标签共现关系
  const coOccurrenceMap = useMemo(() => {
    const map = new Map<string, Set<string>>()

    for (const bookmark of bookmarks) {
      if (!bookmark.tags || bookmark.tags.length < 2) continue

      const ids = bookmark.tags.reduce<string[]>((acc, tag) => {
        if (tag.id) acc.push(tag.id)
        return acc
      }, [])

      if (ids.length < 2) continue

      for (let i = 0; i < ids.length; i++) {
        const sourceId = ids[i]!
        if (!map.has(sourceId)) {
          map.set(sourceId, new Set())
        }

        for (let j = 0; j < ids.length; j++) {
          if (i === j) continue
          const targetId = ids[j]
          if (!targetId) continue
          
          const sourceSet = map.get(sourceId)
          if (sourceSet) {
            sourceSet.add(targetId)
          }
        }
      }
    }

    return map
  }, [bookmarks])

  // 计算相关标签
  const relatedTagIds = useMemo(() => {
    if (selectedTags.length === 0) return new Set<string>()

    if (selectedTags.length === 1) {
      const neighbors = coOccurrenceMap.get(selectedTags[0]!)
      if (!neighbors) return new Set<string>()
      return new Set([...neighbors].filter(id => !selectedTags.includes(id)))
    }

    const firstTagNeighbors = coOccurrenceMap.get(selectedTags[0]!)
    if (!firstTagNeighbors) return new Set<string>()

    const related = new Set<string>()

    firstTagNeighbors.forEach((neighborId) => {
      if (selectedTags.includes(neighborId)) return

      const isRelatedToAll = selectedTags.every((tagId) => {
        const neighbors = coOccurrenceMap.get(tagId)
        return neighbors && neighbors.has(neighborId)
      })

      if (isRelatedToAll) {
        related.add(neighborId)
      }
    })

    return related
  }, [selectedTags, coOccurrenceMap])

  // 搜索筛选
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags

    const query = searchQuery.toLowerCase()
    return tags.filter((tag) => tag.name.toLowerCase().includes(query))
  }, [tags, searchQuery])

  // 排序：已选中、相关、其他
  const orderedTags = useMemo(() => {
    const selected: Tag[] = []
    const related: Tag[] = []
    const others: Tag[] = []

    for (const tag of filteredTags) {
      if (selectedTags.includes(tag.id)) {
        selected.push(tag)
      } else if (relatedTagIds.has(tag.id)) {
        related.push(tag)
      } else {
        others.push(tag)
      }
    }

    return [...selected, ...related, ...others]
  }, [filteredTags, selectedTags, relatedTagIds])

  return { orderedTags, relatedTagIds }
}
