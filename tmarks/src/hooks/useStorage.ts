import { useQuery } from '@tanstack/react-query'
import { storageService } from '@/services/storage'
import type { R2StorageQuota } from '@/lib/types'

export const storageKeys = {
  r2Quota: ['storage', 'r2-quota'] as const,
}

export function useR2StorageQuota() {
  return useQuery<R2StorageQuota>({
    queryKey: storageKeys.r2Quota,
    queryFn: () => storageService.getR2Quota(),
    staleTime: 60 * 1000, // 1 分钟内视为新鲜
  })
}

