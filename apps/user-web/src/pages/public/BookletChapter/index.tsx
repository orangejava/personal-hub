import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useRequest } from '@/hooks/useRequest';
import { useParams, history } from '@umijs/max';
import { Button, Menu, Progress } from 'antd';
import clsx from 'clsx';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import PublicLayout from '@/layouts/PublicLayout';
import {
  BookletChapterFooter,
  EllipsisTooltip,
  ErrorState,
  MarkdownViewer,
  ScrollBackTop,
  SectionSkeleton,
  TocPanel,
} from '@/components/shared';
import { fetchBookletChapters, fetchChapter } from '@/services/booklet';
import { fetchContentList } from '@/services/content';
import {
  calcScrollPercent,
  getReadingProgress,
  setReadingProgress,
} from '@/utils/clientPreferences';
import { scrollChildIntoCenter, scrollPageToTop } from '@/utils/scroll';
import type { BookletChapter as BookletChapterType } from '@personal-hub/shared-types';
import { ContentType } from '@personal-hub/shared-types';

type CollapsibleSidebarProps = {
  title: string;
  width: number;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  menuRef?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
  menu: React.ReactNode;
};

/** 可折叠侧栏：高度为视口减去顶栏，菜单区独立滚动 */
const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  title,
  width,
  collapsed,
  onToggle,
  className,
  menuRef,
  children,
  menu,
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
    {!collapsed && (
      <div className="ph-booklet-sidebar-body">
        {children}
        <div ref={menuRef} className="ph-booklet-sidebar-menu">
          {menu}
        </div>
      </div>
    )}
  </aside>
);

type BookletListSidebarProps = {
  bookletId: string;
  collapsed: boolean;
  bookletList: Array<{ id: string; title: string }>;
  menuTheme: 'light' | 'dark';
  menuRef: React.RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onBookletClick: (id: string) => void;
};

/** 最左侧小册列表：切章时不随 chapterId 重渲染 */
const BookletListSidebar = React.memo<BookletListSidebarProps>(
  ({
    bookletId,
    collapsed,
    bookletList,
    menuTheme,
    menuRef,
    onToggle,
    onBookletClick,
  }) => (
    <CollapsibleSidebar
      title="小册列表"
      width={240}
      collapsed={collapsed}
      onToggle={onToggle}
      className="ph-booklet-sidebar-list"
      menuRef={menuRef}
      menu={
        <Menu
          theme={menuTheme}
          mode="inline"
          selectedKeys={[bookletId]}
          items={bookletList.map((b) => ({
            key: b.id,
            label: <EllipsisTooltip title={b.title} lines={1} />,
          }))}
          onClick={(e) => onBookletClick(e.key)}
        />
      }
    />
  ),
);

type ChapterListSidebarProps = {
  title: string;
  chapterId: string;
  chapters: BookletChapterType[];
  progressPercent: number;
  collapsed: boolean;
  menuTheme: 'light' | 'dark';
  menuRef: React.RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onChapterClick: (chapterId: string) => void;
};

/** 章节目录侧栏：仅章节选中态与进度变化时更新 */
const ChapterListSidebar = React.memo<ChapterListSidebarProps>(
  ({
    title,
    chapterId,
    chapters,
    progressPercent,
    collapsed,
    menuTheme,
    menuRef,
    onToggle,
    onChapterClick,
  }) => (
    <CollapsibleSidebar
      title={title}
      width={260}
      collapsed={collapsed}
      onToggle={onToggle}
      className="ph-booklet-sidebar-chapters"
      menuRef={menuRef}
      menu={
        <Menu
          theme={menuTheme}
          mode="inline"
          selectedKeys={[chapterId]}
          items={chapters.map((c) => {
            const label = `${c.order}. ${c.title}`;
            return {
              key: c.id,
              label: <EllipsisTooltip title={label} lines={1} />,
            };
          })}
          onClick={(e) => onChapterClick(e.key)}
        />
      }
    >
      <div className="ph-booklet-sidebar-progress">
        <Progress percent={progressPercent} size="small" />
      </div>
    </CollapsibleSidebar>
  ),
);

/** 将当前窗口滚动位置写入本地阅读进度 */
function persistChapterProgress(bookletId: string, chapterId: string) {
  const scrollY = window.scrollY;
  setReadingProgress(bookletId, {
    chapterId,
    scrollY,
    percent: calcScrollPercent(scrollY),
  });
}

function scrollSidebarItemByIndex(
  body: HTMLElement | null,
  itemIndex: number,
) {
  if (!body || itemIndex < 0) return;
  const items = body.querySelectorAll<HTMLElement>('.ant-menu-item');
  const selected = items[itemIndex];
  if (!selected) return;
  scrollChildIntoCenter(body, selected, 'auto');
}

/** 小册章节阅读：全宽四栏 + 可折叠侧栏 */
const BookletChapter: React.FC = () => {
  const { menuTheme } = usePublicTheme();
  const params = useParams<{ id: string; chapterId: string }>();
  const bookletId = params.id!;
  const chapterId = params.chapterId!;

  const [listCollapsed, setListCollapsed] = useState(true);
  const [chapterCollapsed, setChapterCollapsed] = useState(false);
  const restoredRef = useRef<string | null>(null);
  const allowScrollRestoreRef = useRef(true);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const chapterMenuRef = useRef<HTMLDivElement>(null);
  const lastChapterRef = useRef<BookletChapterType | null>(null);

  useEffect(() => {
    setListCollapsed(true);
    setChapterCollapsed(false);
    allowScrollRestoreRef.current = true;
    restoredRef.current = null;
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

  if (chapter) {
    lastChapterRef.current = chapter;
  }
  const displayChapter = chapter ?? lastChapterRef.current;
  const initialChapterLoad = chapterLoading && !displayChapter;

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

  const bookletListIndex = bookletList.findIndex((b) => b.id === bookletId);

  const goTo = (
    nextChapterId: string,
    options?: { restoreScroll?: boolean },
  ) => {
    persistChapterProgress(bookletId, chapterId);
    if (nextChapterId !== chapterId) {
      if (options?.restoreScroll) {
        allowScrollRestoreRef.current = true;
      } else {
        allowScrollRestoreRef.current = false;
        scrollPageToTop();
      }
    }
    history.push(`/content/booklets/${bookletId}/chapters/${nextChapterId}`);
  };

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        persistChapterProgress(bookletId, chapterId);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      persistChapterProgress(bookletId, chapterId);
    };
  }, [bookletId, chapterId]);

  useEffect(() => {
    if (!chapter || chapterLoading) return;
    const restoreKey = `${bookletId}:${chapterId}`;
    if (restoredRef.current === restoreKey) return;
    restoredRef.current = restoreKey;

    const progress = getReadingProgress(bookletId);
    const shouldRestore =
      allowScrollRestoreRef.current &&
      progress?.chapterId === chapterId &&
      (progress.scrollY ?? 0) > 0;

    const timer = window.setTimeout(() => {
      if (shouldRestore) {
        window.scrollTo({ top: progress!.scrollY, behavior: 'auto' });
      } else {
        scrollPageToTop();
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [bookletId, chapterId, chapter, chapterLoading]);

  useLayoutEffect(() => {
    if (chapterCollapsed || currentIndex < 0) return;
    const body = chapterMenuRef.current;
    if (!body) return;

    const align = () => scrollSidebarItemByIndex(body, currentIndex);
    align();
    const raf = requestAnimationFrame(align);
    return () => cancelAnimationFrame(raf);
  }, [currentIndex, chapterCollapsed]);

  useLayoutEffect(() => {
    if (listCollapsed || bookletListIndex < 0) return;
    const body = listMenuRef.current;
    if (!body) return;

    const align = () => scrollSidebarItemByIndex(body, bookletListIndex);
    align();
    const raf = requestAnimationFrame(align);
    return () => cancelAnimationFrame(raf);
  }, [bookletListIndex, listCollapsed]);

  const onBookletClick = (id: string) => {
    if (id === bookletId && chapters.length) {
      const saved = getReadingProgress(bookletId);
      const target =
        saved?.chapterId && chapters.some((c) => c.id === saved.chapterId)
          ? saved.chapterId
          : chapters[0].id;
      goTo(target, { restoreScroll: true });
      setListCollapsed(true);
      setChapterCollapsed(false);
      return;
    }
    history.push(`/content/${id}`);
  };

  const hasToc = !!displayChapter?.toc?.length;

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
          <BookletListSidebar
            bookletId={bookletId}
            collapsed={listCollapsed}
            bookletList={bookletList}
            menuTheme={menuTheme}
            menuRef={listMenuRef}
            onToggle={() => setListCollapsed((v) => !v)}
            onBookletClick={onBookletClick}
          />

          <ChapterListSidebar
            title={booklet.title}
            chapterId={chapterId}
            chapters={chapters}
            progressPercent={progressPercent}
            collapsed={chapterCollapsed}
            menuTheme={menuTheme}
            menuRef={chapterMenuRef}
            onToggle={() => setChapterCollapsed((v) => !v)}
            onChapterClick={goTo}
          />

          <div className="ph-booklet-body">
            <div className="ph-booklet-columns ph-booklet-content">
              <main className="ph-booklet-main">
                {initialChapterLoad && (
                  <SectionSkeleton variant="article" rows={10} />
                )}
                {displayChapter && (
                  <>
                    <h2>{displayChapter.title}</h2>
                    <MarkdownViewer source={displayChapter.body} />
                  </>
                )}
              </main>

              <aside className="ph-booklet-toc">
                <div className="ph-booklet-toc-sticky">
                  {hasToc && displayChapter?.toc ? (
                    <TocPanel items={displayChapter.toc} />
                  ) : null}
                </div>
              </aside>
            </div>

            {displayChapter && (
              <BookletChapterFooter
                prevId={prev?.id}
                nextId={next?.id}
                onNavigate={goTo}
                showTocColumn
              />
            )}
          </div>
        </div>
      )}
      <ScrollBackTop visibilityHeight={200} />
    </PublicLayout>
  );
};

export default BookletChapter;
