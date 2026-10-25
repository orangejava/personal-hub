import { useRequest } from '@/hooks/useRequest';
import { useReadingProgressCheckpoint } from '@/hooks/useReadingProgressCheckpoint';
import { useViewportBand } from '@/hooks/useViewportBand';
import {
  BookOutlined,
  CopyOutlined,
  HeartFilled,
  HeartOutlined,
  RobotOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { useParams, history, Link, useModel } from '@umijs/max';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Drawer,
  message,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import { ContentType, ContentTypeLabel } from '@personal-hub/shared-types';
import ErrorState from '@/components/shared/ErrorState';
import MarkdownViewer from '@/components/shared/MarkdownViewer';
import ReaderActionBar from '@/components/shared/ReaderActionBar';
import RichTextViewer from '@/components/shared/RichTextViewer';
import ScrollBackTop from '@/components/shared/ScrollBackTop';
import SectionSkeleton from '@/components/shared/SectionSkeleton';
import TocPanel from '@/components/shared/TocPanel';
import {
  favoriteContent,
  fetchContentDetail,
  saveReadingProgress,
  unfavoriteContent,
} from '@/services/content';
import { copyToClipboard } from '@/utils/copyToClipboard';

/** 预览器只在打开对应内容时加载，避免 pdfjs / docx 跟着入口包下载。 */
const PdfViewer = React.lazy(() => import('@/components/shared/PdfViewer'));
const WordViewer = React.lazy(() => import('@/components/shared/WordViewer'));
import {
  calcScrollPercent,
  getReadingProgress,
  type LocalReadingProgress,
} from '@/utils/clientPreferences';
import { extractMarkdownToc } from '@/utils/markdown';
import { fetchBookletChapters } from '@/services/booklet';
import { scrollPageToTop } from '@/utils/scroll';

const { Title, Paragraph } = Typography;

const READER_MAX_WIDTH: Record<string, string> = {
  narrow: '680px',
  comfortable: '820px',
  wide: '1040px',
};

/**
 * 把配置组里的阅读宽度落到行内 max-width。
 * comfortable 与 tokens 默认 820px 对齐，其它两档只改本页正文。
 */
function readingMaxWidth(width?: string): string | undefined {
  if (!width) return undefined;
  return READER_MAX_WIDTH[width];
}

/** 内容详情：按类型分流。小册点进详情会重定向到章节，避免在本页再渲染整本目录。 */
const ContentDetail: React.FC = () => {
  const params = useParams<{ id: string }>();
  const id = params.id!;
  const { initialState } = useModel('@@initialState');
  const [favorited, setFavorited] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [readingPercent, setReadingPercent] = useState(0);
  const [wordReady, setWordReady] = useState(false);
  const { band, readerSheets } = useViewportBand();
  const restoredRef = useRef<string | null>(null);
  const restoringScrollRef = useRef(false);
  const { data, loading, error, run } = useRequest(() => fetchContentDetail(id), {
    refreshDeps: [id],
  });
  // useRequest 切换 id 时会暂留上一条 data；旧正文不能参与新路由的进度采集或小册跳转。
  const detail = data?.id === id ? data : undefined;
  const awaitingCurrentDetail = Boolean(data && data.id !== id);
  const categoryLabel = detail?.categoryName || detail?.categorySlug;
  const layout = initialState?.systemConfig?.layout;
  const showBreadcrumb = layout?.showBreadcrumb !== false;
  const readerWidth = readingMaxWidth(layout?.contentReaderWidth);
  const needsLogin = (error as { response?: { status?: number } } | undefined)?.response?.status === 401;
  const loginPath = `/user/login?redirect=${encodeURIComponent(`/content/${id}`)}`;
  const isScrollableReader =
    detail?.type === ContentType.Markdown ||
    detail?.type === ContentType.RichText ||
    detail?.type === ContentType.Word;
  const scrollableReaderReady = isScrollableReader &&
    (detail?.type !== ContentType.Word || wordReady);
  const syncReadingProgress = useCallback(
    async (progress: LocalReadingProgress) => {
      if (!initialState?.currentUser) return;
      await saveReadingProgress({
        contentId: detail?.id ?? id,
        chapterId: progress.chapterId,
        percent: progress.percent,
        updatedAt: progress.updatedAt,
      });
    },
    [detail?.id, id, initialState?.currentUser],
  );
  const readLatestScrollProgress = useCallback(() => {
    if (!scrollableReaderReady) return undefined;
    const scrollY = window.scrollY;
    return { scrollY, percent: calcScrollPercent(scrollY), kind: 'scroll' as const };
  }, [scrollableReaderReady]);
  const { report: reportScrollProgress } = useReadingProgressCheckpoint({
    contentId: detail?.id ?? id,
    enabled: scrollableReaderReady,
    sync: initialState?.currentUser ? syncReadingProgress : undefined,
    readLatest: readLatestScrollProgress,
  });
  const { report: reportPdfProgress } = useReadingProgressCheckpoint({
    contentId: detail?.id ?? id,
    enabled: detail?.type === ContentType.Pdf,
    sync: initialState?.currentUser ? syncReadingProgress : undefined,
  });

  useEffect(() => {
    setFavorited(Boolean(detail?.isFavorited));
  }, [detail?.isFavorited]);

  useEffect(() => {
    if (!readerSheets) setOutlineOpen(false);
  }, [readerSheets]);

  // 小册入口：优先跳上次章节，否则第一章（带 chapterId 的 URL 不经此页）
  const {
    data: chapterData,
    error: chapterError,
    run: reloadChapters,
  } = useRequest(
    async () => ({ contentId: id, chapters: (await fetchBookletChapters(id)).chapters }),
    { ready: detail?.type === ContentType.Booklet, refreshDeps: [id, detail?.type] },
  );
  useEffect(() => {
    if (
      detail?.type !== ContentType.Booklet ||
      chapterData?.contentId !== detail.id ||
      !chapterData.chapters.length
    ) {
      return;
    }
    const chapters = chapterData.chapters;
    const saved = getReadingProgress(detail.id);
    const target =
      saved?.chapterId && chapters.some((c) => c.id === saved.chapterId)
        ? saved.chapterId
        : chapters[0].id;
    history.replace(`/content/booklets/${detail.id}/chapters/${target}`);
  }, [detail, chapterData]);

  useEffect(() => {
    scrollPageToTop();
    restoredRef.current = null;
    setReadingPercent(0);
    setWordReady(false);
  }, [id]);

  // 滚动类阅读器只报告内存快照；公共 hook 按位置检查点落本地，并在离开时同步服务端。
  useEffect(() => {
    if (!detail || !scrollableReaderReady) return;
    let pendingFrame = 0;
    const onScroll = () => {
      if (restoringScrollRef.current) return;
      const scrollY = window.scrollY;
      const percent = calcScrollPercent(scrollY);
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      // 先同步更新内存快照，确保同一事件循环内离开页面也能保留最后滚动位置。
      reportScrollProgress(
        { scrollY, percent, kind: 'scroll' },
        { atBoundary: scrollY <= 0 || scrollY >= maxScroll - 2 },
      );
      if (pendingFrame) return;
      pendingFrame = window.requestAnimationFrame(() => {
        setReadingPercent(calcScrollPercent(window.scrollY));
        pendingFrame = 0;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
    };
  }, [detail, reportScrollProgress, scrollableReaderReady]);

  useEffect(() => {
    if (!detail || !scrollableReaderReady || loading) return;
    if (restoredRef.current === detail.id) return;
    restoredRef.current = detail.id;

    const saved = getReadingProgress(detail.id);
    // 同一路由组件切换文章时，先按新内容初始化显示值，不能沿用上一篇的百分比。
    setReadingPercent(saved?.scrollY ? saved.percent : 0);
    if (!saved?.scrollY) return;

    const timer = window.setTimeout(() => {
      restoringScrollRef.current = true;
      window.scrollTo({ top: saved.scrollY, behavior: 'auto' });
      setReadingPercent(saved.percent);
      window.setTimeout(() => {
        restoringScrollRef.current = false;
      }, 0);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [detail, loading, scrollableReaderReady]);

  const handlePdfPageChange = useCallback(
    (page: number, totalPages: number) => {
      const percent = Math.round((page / totalPages) * 100);
      setReadingPercent(percent);
      reportPdfProgress(
        { scrollY: 0, percent, page, totalPages, kind: 'page' },
        { atBoundary: page === 1 || page === totalPages },
      );
    },
    [reportPdfProgress],
  );

  const toggleFavorite = async () => {
    if (!initialState?.currentUser) {
      message.info('登录后可以收藏内容');
      history.push(`/user/login?redirect=${encodeURIComponent(`/content/${id}`)}`);
      return;
    }
    const next = !favorited;
    await (next ? favoriteContent(id) : unfavoriteContent(id));
    setFavorited(next);
    message.success(next ? '已收藏' : '已取消收藏');
  };

  const copyLink = () => void copyToClipboard(window.location.href, '链接已复制');

  const quoteToAi = () => {
    if (!detail) return;
    history.push(`/ai/chat?contentId=${encodeURIComponent(detail.id)}&mode=quote`);
  };

  const tocItems =
    detail?.type === ContentType.Markdown && detail.body
      ? extractMarkdownToc(detail.body)
      : [];
  const readerPrimary = useMemo(
    () => [
      {
        key: 'outline',
        label: '大纲',
        icon: <BookOutlined />,
        disabled: tocItems.length === 0,
        onClick: () => setOutlineOpen(true),
      },
      {
        key: 'favorite',
        label: favorited ? '已收藏' : '收藏',
        icon: favorited ? (
          <HeartFilled style={{ color: '#ff4d4f' }} />
        ) : (
          <HeartOutlined />
        ),
        onClick: () => void toggleFavorite(),
      },
    ],
    [favorited, tocItems.length, toggleFavorite],
  );
  const readerMore = useMemo(
    () => [
      {
        key: 'copy',
        label: '复制链接',
        icon: <CopyOutlined />,
        onClick: copyLink,
      },
      {
        key: 'quote',
        label: '引用到 AI',
        icon: <RobotOutlined />,
        onClick: quoteToAi,
      },
      {
        key: 'top',
        label: '回到顶部',
        icon: <VerticalAlignTopOutlined />,
        onClick: () => scrollPageToTop(),
      },
    ],
    [detail?.id],
  );

  return (
    <PublicLayout>
      {needsLogin && (
        <Alert
          type="info"
          showIcon
          title="这篇内容需要登录后查看"
          action={
            <Button type="primary" onClick={() => history.push(loginPath)}>
              去登录
            </Button>
          }
        />
      )}
      {error && !needsLogin && <ErrorState title="内容不存在或加载失败" onRetry={run} />}
      {detail?.type === ContentType.Booklet && chapterError && (
        <ErrorState title="小册章节加载失败" onRetry={reloadChapters} />
      )}
      {/* 小册还要再请求章节后才跳走。这层骨架留到离开本页，避免详情回来后空一帧再换另一套。 */}
      {(loading || awaitingCurrentDetail || (detail?.type === ContentType.Booklet && !chapterError)) && (
        <SectionSkeleton variant="article" rows={16} fill />
      )}
      {detail && detail.type !== ContentType.Booklet && (
        <div className="ph-content-detail-layout">
          <div
            className="ph-reading ph-content-detail-main"
            style={readerWidth ? { maxWidth: readerWidth } : undefined}
          >
            {showBreadcrumb && (
              <Breadcrumb
                style={{ marginBottom: 12 }}
                items={[
                  { title: <Link to="/content">内容中心</Link> },
                  { title: detail.title },
                ]}
              />
            )}
            <Space style={{ marginBottom: 12 }}>
              <Tag color="blue">{ContentTypeLabel[detail.type]}</Tag>
              {categoryLabel && <Tag>{categoryLabel}</Tag>}
              {detail.tags?.map((t) => <Tag key={t}>{t}</Tag>)}
            </Space>
            <Title level={2}>{detail.title}</Title>
            <div className="ph-detail-meta">
              {detail.author} · {detail.publishedAt}
            </div>
            {!readerSheets && (
              <Card
                className="ph-content-detail-actions"
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Space wrap>
                  <Button icon={<CopyOutlined />} onClick={copyLink}>
                    复制链接
                  </Button>
                  <Button
                    icon={
                      favorited ? (
                        <HeartFilled style={{ color: '#ff4d4f' }} />
                      ) : (
                        <HeartOutlined />
                      )
                    }
                    onClick={toggleFavorite}
                  >
                    {favorited ? '取消收藏' : '收藏'}
                  </Button>
                  <Button icon={<RobotOutlined />} onClick={quoteToAi}>
                    引用到 AI
                  </Button>
                  {detail.type === ContentType.Markdown && (
                    <span className="ph-reading-progress">
                      阅读进度
                      <Progress percent={readingPercent} size="small" />
                    </span>
                  )}
                </Space>
              </Card>
            )}

            {detail.type === ContentType.Markdown && (
              <MarkdownViewer source={detail.body ?? ''} />
            )}

            {detail.type === ContentType.Link && (
              <Card>
                <Paragraph>{detail.summary}</Paragraph>
                <Button type="primary" href={detail.link} target="_blank">
                  打开外链
                </Button>
              </Card>
            )}

            {(detail.type === ContentType.Pdf || detail.type === ContentType.Word) &&
              detail.previewUrl && (
                <Card>
                  {detail.type === ContentType.Pdf ? (
                    <React.Suspense fallback={<SectionSkeleton />}>
                      <PdfViewer
                        key={detail.id}
                        url={detail.previewUrl}
                        initialPage={getReadingProgress(detail.id)?.page}
                        onPageChange={handlePdfPageChange}
                      />
                    </React.Suspense>
                  ) : (
                    <React.Suspense fallback={<SectionSkeleton />}>
                      <WordViewer url={detail.previewUrl} onReady={() => setWordReady(true)} />
                    </React.Suspense>
                  )}
                </Card>
              )}

            {(detail.type === ContentType.Pdf || detail.type === ContentType.Word) &&
              !detail.previewUrl && (
              <Card>
                <Alert type="warning" title="暂无预览文件" description={detail.summary} />
              </Card>
            )}

            {detail.type === ContentType.RichText && (
              <RichTextViewer source={detail.body} />
            )}

            {detail.type === ContentType.Project && (
              <Card>
                <Paragraph type="secondary">{detail.summary}</Paragraph>
              </Card>
            )}

            <div style={{ marginTop: 32 }}>
              <Link to="/content">← 返回内容中心</Link>
            </div>
          </div>
          {detail.type === ContentType.Markdown && detail.body && (
            <div className="ph-content-detail-toc">
              <TocPanel items={tocItems} />
            </div>
          )}
        </div>
      )}
      {detail && detail.type !== ContentType.Booklet && readerSheets && (
        <>
          <ReaderActionBar
            more={readerMore}
            primary={readerPrimary}
            progressive={band === 'phone'}
          />
          <Drawer
            className="ph-booklet-mobile-panel"
            open={outlineOpen}
            placement="left"
            size={360}
            title="大纲"
            onClose={() => setOutlineOpen(false)}
          >
            <TocPanel items={tocItems} onNavigate={() => setOutlineOpen(false)} />
          </Drawer>
        </>
      )}
      <ScrollBackTop visibilityHeight={300} />
    </PublicLayout>
  );
};

export default ContentDetail;
