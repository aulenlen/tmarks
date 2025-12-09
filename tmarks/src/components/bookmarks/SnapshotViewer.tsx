import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ExternalLink, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useQueryClient } from '@tanstack/react-query';
import { BOOKMARKS_QUERY_KEY } from '@/hooks/useBookmarks';

interface Snapshot {
  id: string;
  version: number;
  file_size: number;
  snapshot_title: string;
  created_at: string;
  view_url: string; // 签名 URL
}

interface SnapshotViewerProps {
  bookmarkId: string;
  bookmarkTitle: string;
  snapshotCount?: number; // 从书签数据中传入，避免额外请求
}

export function SnapshotViewer({ bookmarkId, bookmarkTitle, snapshotCount = 0 }: SnapshotViewerProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const accessToken = useAuthStore(state => state.accessToken);
  const { addToast } = useToastStore();
  const queryClient = useQueryClient();

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`/api/v1/bookmarks/${bookmarkId}/snapshots`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      // API 返回格式: { data: { snapshots: [...], total: ... } }
      setSnapshots(result.data?.snapshots || []);
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 防止触发卡片点击
    setIsOpen(true);
    loadSnapshots();
  };

  // 键盘支持：ESC 关闭弹窗
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleView = (viewUrl: string) => {
    // 直接使用 API 返回的签名 URL
    window.open(viewUrl, '_blank');
  };

  const handleDelete = async (snapshotId: string, version: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 防止触发查看操作
    
    // 使用更友好的确认方式
    const confirmed = window.confirm(`确定要删除版本 ${version} 的快照吗？\n\n删除后将无法恢复。`);
    if (!confirmed) {
      return;
    }

    setDeletingId(snapshotId);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`/api/v1/bookmarks/${bookmarkId}/snapshots/${snapshotId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 从列表中移除
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
      
      // 刷新书签列表（更新快照计数）
      queryClient.invalidateQueries({ queryKey: [BOOKMARKS_QUERY_KEY] });
      
      addToast('success', '快照已删除');
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      addToast('error', '删除快照失败');
    } finally {
      setDeletingId(null);
    }
  };



  // 使用 Portal 将弹窗渲染到 body，避免被父容器限制
  const modalContent = isOpen ? createPortal(
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" 
      style={{ zIndex: 200 }}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(false);
      }}
    >
      {/* 弹窗容器 - 使用和 BookmarkForm 相同的样式 */}
      <div 
        className="card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-xl font-bold text-foreground truncate">
              {bookmarkTitle}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              共 {snapshots.length} 个快照
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-foreground transition-colors flex-shrink-0"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 scrollbar-hide">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-primary absolute top-0 left-0"></div>
              </div>
              <p className="text-sm text-muted-foreground mt-4 font-medium">加载快照中...</p>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="relative inline-block mb-4">
                <Camera className="w-16 h-16 mx-auto opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-0.5 bg-border rotate-45"></div>
                </div>
              </div>
              <p className="text-base font-medium text-foreground mb-1">暂无快照</p>
              <p className="text-xs text-muted-foreground">使用浏览器插件可以保存网页快照</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/50 hover:bg-muted transition-all group"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleView(snapshot.view_url);
                    }}
                    className="flex-1 flex items-center justify-between gap-3 text-left min-w-0 group/item"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center group-hover/item:scale-110 transition-transform">
                        <Camera className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* 快照标题（如果有） */}
                        {snapshot.snapshot_title && snapshot.snapshot_title.trim() !== '' && (
                          <div className="text-sm font-medium text-foreground truncate mb-0.5">
                            {snapshot.snapshot_title}
                          </div>
                        )}
                        
                        {/* 版本号 */}
                        <div className="flex items-center gap-2 text-xs text-foreground/80">
                          <span className="font-medium">版本 {snapshot.version}</span>
                          {snapshot.file_size > 0 && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">{formatFileSize(snapshot.file_size)}</span>
                            </>
                          )}
                        </div>
                        
                        {/* 时间 - 相对时间 + 绝对时间 */}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(snapshot.created_at), { 
                            addSuffix: true, 
                            locale: zhCN 
                          })}
                          <span className="mx-1">•</span>
                          {format(new Date(snapshot.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                        </div>
                      </div>
                    </div>
                    
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover/item:text-primary group-hover/item:scale-110 transition-all flex-shrink-0" />
                  </button>
                  
                  <button
                    onClick={(e) => handleDelete(snapshot.id, snapshot.version, e)}
                    disabled={deletingId === snapshot.id}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all opacity-0 sm:group-hover:opacity-100 active:opacity-100 disabled:opacity-50 flex-shrink-0"
                    title="删除快照"
                  >
                    {deletingId === snapshot.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-destructive"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {!isOpen && snapshotCount > 0 && (
        <button
          onClick={handleOpen}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105 active:scale-95 transition-all"
          title={`查看 ${snapshotCount} 个快照`}
        >
          <Camera className="w-3 h-3" strokeWidth={2} />
          <span className="font-medium">{snapshotCount}</span>
        </button>
      )}
      {modalContent}
    </>
  );
}
