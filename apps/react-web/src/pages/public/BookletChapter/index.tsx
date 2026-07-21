import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useRequest, useParams, history, Link } from '@umijs/max';
import { Button, Menu, Progress, Space } from 'antd';
import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import PublicLayout from '@/layouts/PublicLayout';
import {
  ErrorState,
  MarkdownViewer,
  SectionSkeleton,
  TocPanel,
} from '@/components/shared';
import { fetchBookletChapters, fetchChapter } from '@/services/booklet';
import { fetchContentList } from '@/services/content';
import { scrollPageToTop } from '@/utils/scroll';
import { ContentType } from '@personal-hub/shared-types';

type CollapsibleSidebarProps = {
  title: string;
  width: number;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
};

/** 可折叠侧栏：高度为视口减去顶栏，内容区独立滚动 */
const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  title,
  width,
  collapsed,
  onToggle,
  className,
  children,
}) => (
  <aside
    className={clsx('ph-booklet-sidebar', className, collapsed && 'collapsed')}
    style={{ width: collapsed ? undefined : width }}
  >
    <div className="ph-booklet-sidebar-header">
      {!collapsed && <span className="ph-booklet-sidebar-title">{title}</span>}
      <Button
        type="text"
        size="small"
        aria-label={collapsed ? `展开${title}` : `收起${title}`}
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={onToggle}
      />
    </div>
    {!collapsed && <div className="ph-booklet-sidebar-body">{children}</div>}
  </aside>
);

/** 小册章节阅读：全宽四栏 + 可折叠小册列表/章节目录 */
const BookletChapter: React.FC = () => {
  const { menuTheme } = usePublicTheme();
  const params = useParams<{ id: string; chapterId: string }>();
  const bookletId = params.id!;
  const chapterId = params.chapterId!;

  // 进入章节阅读时：收起小册列表、展开章节目录
  const [listCollapsed, setListCollapsed] = useState(true);
  const [chapterCollapsed, setChapterCollapsed] = useState(false);

  useEffect(() => {
    setListCollapsed(true);
    setChapterCollapsed(false);
  }, [bookletId]);

  const {
    data: bookData,
    loading: bookLoading,
    error: bookError,
    run: reloadBook,
  } = useRequest(
    () => fetchBookletChapters(bookletId),
    { refreshDeps: [bookletId] },
  );
  const booklet = bookData?.booklet;
  const chapters = bookData?.chapters ?? [];

  const { data: chapter, loading: chapterLoading } = useRequest(
    () => fetchChapter(bookletId, chapterId),
    { ready: !!chapterId, refreshDeps: [bookletId, chapterId] },
  );

  const currentIndex = chapters.findIndex((c) => c.id === chapterId);
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : undefined;
  const next =
    currentIndex >= 0 && currentIndex < chapters.length - 1
      ? chapters[currentIndex + 1]
      : undefined;
  const progressPercent =
    chapters.length > 0 && currentIndex >= 0
      ? Math.round(((currentIndex + 1) / chapters.length) * 100)
      : 0;

  const { data: bookletListData } = useRequest(() =>
    fetchContentList({ type: ContentType.Booklet, page: 1, pageSize: 100 }),
  );
  const bookletList = bookletListData?.list ?? [];

  const goTo = (nextChapterId: string) => {
    history.push(`/content/booklets/${bookletId}/chapters/${nextChapterId}`);
    scrollPageToTop();
  };

  useEffect(() => {
    scrollPageToTop();
  }, [chapterId]);

  const onBookletClick = (id: string) => {
    if (id === bookletId && chapters[0]) {
      goTo(chapters[0].id);
      setListCollapsed(true);
      setChapterCollapsed(false);
      return;
    }
    history.push(`/content/${id}`);
  };

  return (
    <PublicLayout fullWidth>
      {bookError && (
        <div className="ph-container" style={{ padding: 'var(--ph-page-padding)' }}>
          <ErrorState title="小册不存在或加载失败" onRetry={reloadBook} />
        </div>
      )}
      {bookLoading && (
        <div className="ph-container" style={{ padding: 'var(--ph-page-padding)' }}>
          <SectionSkeleton variant="article" rows={8} />
        </div>
      )}
      {booklet && (
        <div className="ph-booklet-reader">
          <CollapsibleSidebar
            title="小册列表"
            width={240}
            collapsed={listCollapsed}
            onToggle={() => setListCollapsed((v) => !v)}
            className="ph-booklet-sidebar-list"
          >
            <Menu
              theme={menuTheme}
              mode="inline"
              selectedKeys={[bookletId]}
              items={bookletList.map((b) => ({ key: b.id, label: b.title }))}
              onClick={(e) => onBookletClick(e.key)}
            />
          </CollapsibleSidebar>

          <CollapsibleSidebar
            title={booklet.title}
            width={260}
            collapsed={chapterCollapsed}
            onToggle={() => setChapterCollapsed((v) => !v)}
            className="ph-booklet-sidebar-chapters"
          >
            <div style={{ padding: '0 12px 8px' }}>
              <Progress percent={progressPercent} size="small" />
            </div>
            <Menu
              theme={menuTheme}
              mode="inline"
              selectedKeys={[chapterId]}
              items={chapters.map((c) => ({
                key: c.id,
                label: `${c.order}. ${c.title}`,
              }))}
              onClick={(e) => goTo(e.key)}
            />
          </CollapsibleSidebar>

          <div className="ph-booklet-main">
            {chapterLoading && <SectionSkeleton variant="article" rows={10} />}
            {chapter && (
              <>
                <h2>{chapter.title}</h2>
                <MarkdownViewer source={chapter.body} />
                <div
                  style={{
                    marginTop: 32,
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <Space>
                    <Button
                      disabled={!prev}
                      onClick={() => prev && goTo(prev.id)}
                    >
                      上一章
                    </Button>
                    <Button
                      disabled={!next}
                      onClick={() => next && goTo(next.id)}
                    >
                      下一章
                    </Button>
                  </Space>
                  <Link to="/content">返回内容中心</Link>
                </div>
              </>
            )}
          </div>

          {chapter?.toc?.length ? (
            <aside className="ph-booklet-toc">
              <TocPanel items={chapter.toc} />
            </aside>
          ) : null}
        </div>
      )}
    </PublicLayout>
  );
};

export default BookletChapter;
