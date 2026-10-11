import {
  BookOutlined,
  CopyOutlined,
  HeartFilled,
  HeartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  UnorderedListOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { useRequest } from '@/hooks/useRequest';
import { useViewportBand } from '@/hooks/useViewportBand';
import { useParams, history, useModel } from '@umijs/max';
import { Button, Drawer, Menu, Progress, message } from 'antd';
import clsx from 'clsx';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import PublicLayout from '@/layouts/PublicLayout';
import BookletChapterFooter from '@/components/shared/BookletChapterFooter';
import EllipsisTooltip from '@/components/shared/EllipsisTooltip';
import ErrorState from '@/components/shared/ErrorState';
import MarkdownViewer from '@/components/shared/MarkdownViewer';
import ReaderActionBar from '@/components/shared/ReaderActionBar';
import ScrollBackTop from '@/components/shared/ScrollBackTop';
import SectionSkeleton from '@/components/shared/SectionSkeleton';
import TocPanel from '@/components/shared/TocPanel';
import { fetchBookletChapters, fetchChapter } from '@/services/booklet';
import {
  favoriteContent,
  fetchContentDetail,
  fetchContentList,
  unfavoriteContent,
} from '@/services/content';
import { copyToClipboard } from '@/utils/copyToClipboard';
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
  ({ bookletId, collapsed, bookletList, menuTheme, menuRef, onToggle, onBookletClick }) => (
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

type MobileReaderPanel = 'chapters' | 'outline' | 'booklets' | null;

interface MobileReaderControlsProps {
  bookletId: string;
  bookletTitle: string;
  chapterId: string;
  chapters: BookletChapterType[];
  bookletList: Array<{ id: string; title: string }>;
  favorited?: boolean;
  menuTheme: 'light' | 'dark';
  hasToc: boolean;
  progressPercent: number;
  tocItems?: React.ComponentProps<typeof TocPanel>['items'];
  onChapterClick: (chapterId: string) => void;
  onBookletClick: (bookletId: string) => void;
  onScrollTop: () => void;
}

/** 移动端阅读操作：高频入口固定在底部，低频操作收进 Action Sheet。 */
const MobileReaderControls: React.FC<MobileReaderControlsProps> = ({
  bookletId,
  bookletTitle,
  chapterId,
  chapters,
  bookletList,
  favorited = false,
  menuTheme,
  hasToc,
  progressPercent,
  tocItems,
  onChapterClick,
  onBookletClick,
  onScrollTop,
}) => {
  const { initialState } = useModel('@@initialState');
  const { band, readerSheets } = useViewportBand();
  const [liked, setLiked] = useState(favorited);
  const [activePanel, setActivePanel] = useState<MobileReaderPanel>(null);

  useEffect(() => {
    setLiked(favorited);
  }, [favorited]);

  // 回到多栏时卸掉底栏浮层，避免抽屉留在桌面正文上。
  useEffect(() => {
    if (!readerSheets) setActivePanel(null);
  }, [readerSheets]);

  const openPanel = (panel: Exclude<MobileReaderPanel, null>) => {
    setActivePanel(panel);
  };

  const toggleFavorite = async () => {
    if (!initialState?.currentUser) {
      message.info('登录后可以收藏内容');
      history.push(`/user/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !liked;
    await (next ? favoriteContent(bookletId) : unfavoriteContent(bookletId));
    setLiked(next);
    message.success(next ? '已收藏' : '已取消收藏');
  };

  const handleChapterClick = (nextChapterId: string) => {
    setActivePanel(null);
    onChapterClick(nextChapterId);
  };

  const handleBookletClick = (nextBookletId: string) => {
    setActivePanel(null);
    onBookletClick(nextBookletId);
  };

  if (!readerSheets) return null;

  return (
    <>
      <ReaderActionBar
        progressive={band === 'phone'}
        notice={
          <p className="ph-booklet-reading-progress" role="status">
            阅读进度 {progressPercent}%
          </p>
        }
        primary={[
          {
            key: 'chapters',
            label: '章节',
            icon: <UnorderedListOutlined />,
            onClick: () => openPanel('chapters'),
          },
          {
            key: 'outline',
            label: '大纲',
            icon: <BookOutlined />,
            disabled: !hasToc,
            onClick: () => openPanel('outline'),
          },
          {
            key: 'favorite',
            label: liked ? '已收藏' : '收藏',
            icon: liked ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />,
            onClick: () => void toggleFavorite(),
          },
        ]}
        more={[
          {
            key: 'booklets',
            label: '小册列表',
            icon: <BookOutlined />,
            onClick: () => openPanel('booklets'),
          },
          {
            key: 'copy',
            label: '复制当前章节链接',
            icon: <CopyOutlined />,
            onClick: () => void copyToClipboard(window.location.href, '链接已复制'),
          },
          {
            key: 'quote',
            label: '引用到 AI',
            icon: <RobotOutlined />,
            onClick: () =>
              history.push(`/ai/chat?contentId=${encodeURIComponent(bookletId)}&mode=quote`),
          },
          {
            key: 'top',
            label: '回到顶部',
            icon: <VerticalAlignTopOutlined />,
            onClick: onScrollTop,
          },
        ]}
      />

      <Drawer
        className="ph-booklet-mobile-panel"
        placement="left"
        size={360}
        title={`${bookletTitle} · 章节`}
        open={activePanel === 'chapters'}
        onClose={() => setActivePanel(null)}
      >
        <Menu
          theme={menuTheme}
          mode="inline"
          selectedKeys={[chapterId]}
          items={chapters.map((chapter) => ({
            key: chapter.id,
            label: `${chapter.order}. ${chapter.title}`,
          }))}
          onClick={(event) => handleChapterClick(event.key)}
        />
      </Drawer>

      <Drawer
        className="ph-booklet-mobile-panel"
        placement="left"
        size={360}
        title="文章大纲"
        open={activePanel === 'outline'}
        onClose={() => setActivePanel(null)}
      >
        {hasToc && tocItems ? (
          <TocPanel items={tocItems} onNavigate={() => setActivePanel(null)} />
        ) : null}
      </Drawer>

      <Drawer
        className="ph-booklet-mobile-panel"
        placement="left"
        size={360}
        title="小册列表"
        open={activePanel === 'booklets'}
        onClose={() => setActivePanel(null)}
      >
        <Menu
          theme={menuTheme}
          mode="inline"
          selectedKeys={[bookletId]}
          items={bookletList.map((booklet) => ({
            key: booklet.id,
            label: booklet.title,
          }))}
          onClick={(event) => handleBookletClick(event.key)}
        />
      </Drawer>
    </>
  );
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

function scrollSidebarItemByIndex(body: HTMLElement | null, itemIndex: number) {
  if (!body || itemIndex < 0) return;
  const items = body.querySelectorAll<HTMLElement>('.ant-menu-item');
  const selected = items[itemIndex];
  if (!selected) return;
  scrollChildIntoCenter(body, selected, 'auto');
}

/** 当前章节滚过视口的比例。一屏能看完时视为这一章已经读完。 */
function readArticleScrollRatio(): number {
  const article = document.querySelector('.ph-booklet-main');
  if (!(article instanceof HTMLElement)) return 0;
  const { height, top } = article.getBoundingClientRect();
  const view = window.innerHeight;
  if (height <= view * 0.9) return 1;
  const scrolled = Math.min(Math.max(-top, 0), height - view);
  return scrolled / (height - view);
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
  /** 只有这次进入文档的第一屏才用已保存的滚动位置。 */
  const resumeScrollOnEntryRef = useRef(true);
  /** goTo 已经记下离开前的位置，章节切换的滚动清理不要再写成 0。 */
  const savedOnLeaveRef = useRef(false);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const chapterMenuRef = useRef<HTMLDivElement>(null);
  const lastChapterRef = useRef<BookletChapterType | null>(null);
  const [scrollRatio, setScrollRatio] = useState(0);

  useEffect(() => {
    setListCollapsed(true);
    setChapterCollapsed(false);
    resumeScrollOnEntryRef.current = true;
    restoredRef.current = null;
  }, [bookletId]);

  const {
    data: bookData,
    loading: bookLoading,
    error: bookError,
    run: reloadBook,
  } = useRequest(
    async () => {
      const [chapterIndex, detail] = await Promise.all([
        fetchBookletChapters(bookletId),
        fetchContentDetail(bookletId),
      ]);
      return { ...chapterIndex, detail };
    },
    { refreshDeps: [bookletId] },
  );
  const booklet = bookData
    ? {
        ...bookData.booklet,
        title: bookData.detail.title,
        author: bookData.detail.author,
        summary: bookData.detail.summary,
        cover: bookData.detail.cover,
        categorySlug: bookData.detail.categorySlug,
        tags: bookData.detail.tags,
      }
    : undefined;
  const chapters = bookData?.chapters ?? [];

  const {
    data: chapter,
    loading: chapterLoading,
    error: chapterError,
    refresh: reloadChapter,
  } = useRequest(() => fetchChapter(bookletId, chapterId), {
    ready: !!chapterId,
    refreshDeps: [bookletId, chapterId],
  });

  if (chapter) {
    lastChapterRef.current = chapter;
  }
  const displayChapter = chapter ?? lastChapterRef.current;
  // 书目和章节是两次请求。正文出来之前只留这一层，不要先骨架、再空白、再换一套。
  const waitingForChapter =
    !bookError && !chapterError && !displayChapter && (bookLoading || chapterLoading);

  useEffect(() => {
    let frame = 0;
    const update = () => setScrollRatio(readArticleScrollRatio());
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [chapterId, displayChapter?.id]);

  const currentIndex = chapters.findIndex((c) => c.id === chapterId);
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : undefined;
  const next =
    currentIndex >= 0 && currentIndex < chapters.length - 1
      ? chapters[currentIndex + 1]
      : undefined;
  const progressPercent =
    chapters.length > 0 && currentIndex >= 0
      ? Math.round(((currentIndex + scrollRatio) / chapters.length) * 100)
      : 0;

  const { data: bookletListData } = useRequest(() =>
    fetchContentList({ type: ContentType.Booklet, page: 1, pageSize: 100 }),
  );
  const bookletList = bookletListData?.list ?? [];

  const bookletListIndex = bookletList.findIndex((b) => b.id === bookletId);

  const goTo = (nextChapterId: string) => {
    if (nextChapterId === chapterId) return;
    persistChapterProgress(bookletId, chapterId);
    savedOnLeaveRef.current = true;
    resumeScrollOnEntryRef.current = false;
    history.push(`/content/booklets/${bookletId}/chapters/${nextChapterId}`);
  };

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (savedOnLeaveRef.current || ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        if (!savedOnLeaveRef.current) {
          persistChapterProgress(bookletId, chapterId);
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (savedOnLeaveRef.current) {
        savedOnLeaveRef.current = false;
        return;
      }
      persistChapterProgress(bookletId, chapterId);
    };
  }, [bookletId, chapterId]);

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    if (chapterLoading || !chapter) return;
    const restoreKey = `${bookletId}:${chapterId}`;
    if (restoredRef.current === restoreKey) return;
    restoredRef.current = restoreKey;

    const progress = getReadingProgress(bookletId);
    const shouldRestore =
      resumeScrollOnEntryRef.current &&
      progress?.chapterId === chapterId &&
      (progress.scrollY ?? 0) > 0;
    resumeScrollOnEntryRef.current = false;

    const apply = () => {
      if (shouldRestore && progress) {
        window.scrollTo({ top: progress.scrollY, left: 0, behavior: 'auto' });
        return;
      }
      scrollPageToTop();
    };
    apply();
    const timer = window.setTimeout(apply, 50);
    return () => window.clearTimeout(timer);
  }, [bookletId, chapterId, chapterLoading, chapter?.id]);

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
      if (target !== chapterId) goTo(target);
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
      {chapterError && (
        <div className="ph-container" style={{ padding: 'var(--ph-page-padding)' }}>
          <ErrorState title="章节加载失败" onRetry={reloadChapter} />
        </div>
      )}
      {waitingForChapter && <SectionSkeleton variant="article" rows={16} fill />}
      {booklet && !waitingForChapter && (
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
                {chapterLoading && displayChapter ? (
                  <p className="ph-booklet-chapter-switching" role="status">
                    正在打开章节
                  </p>
                ) : null}
                {displayChapter && (
                  <>
                    <h2>{displayChapter.title}</h2>
                    <MarkdownViewer source={displayChapter.body} />
                  </>
                )}
              </main>

              <aside className="ph-booklet-toc">
                <div className="ph-booklet-toc-sticky">
                  {hasToc && displayChapter?.toc ? <TocPanel items={displayChapter.toc} /> : null}
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
          <MobileReaderControls
            bookletId={bookletId}
            bookletTitle={booklet.title}
            favorited={Boolean(bookData?.detail.isFavorited)}
            chapterId={chapterId}
            chapters={chapters}
            bookletList={bookletList}
            menuTheme={menuTheme}
            hasToc={hasToc}
            progressPercent={progressPercent}
            tocItems={displayChapter?.toc}
            onChapterClick={goTo}
            onBookletClick={onBookletClick}
            onScrollTop={scrollPageToTop}
          />
        </div>
      )}
      <ScrollBackTop visibilityHeight={200} />
    </PublicLayout>
  );
};

export default BookletChapter;
