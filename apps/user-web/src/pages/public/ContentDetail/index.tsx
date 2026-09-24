import { useRequest } from '@/hooks/useRequest';
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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import { ContentType, ContentTypeLabel } from '@personal-hub/shared-types';
import {
  ErrorState,
  MarkdownViewer,
  ReaderActionBar,
  PdfViewer,
  RichTextViewer,
  ScrollBackTop,
  SectionSkeleton,
  TocPanel,
  WordViewer,
} from '@/components/shared';
import {
  favoriteContent,
  fetchContentDetail,
  saveReadingProgress,
  unfavoriteContent,
} from '@/services/content';
import { copyToClipboard } from '@/utils/copyToClipboard';
import {
  calcScrollPercent,
  getReadingProgress,
  setReadingProgress,
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
  const { band, readerSheets } = useViewportBand();
  const restoredRef = useRef<string | null>(null);
  // 同步失败后停止本次阅读会话的后续上报，避免滚动时反复产生失败请求。
  const readingSyncDisabledRef = useRef(false);
  const { data, loading, error, run } = useRequest(() => fetchContentDetail(id), {
    refreshDeps: [id],
  });
  const detail = data;
  const categoryLabel = detail?.categoryName || detail?.categorySlug;
  const layout = initialState?.systemConfig?.layout;
  const showBreadcrumb = layout?.showBreadcrumb !== false;
  const readerWidth = readingMaxWidth(layout?.contentReaderWidth);
  const needsLogin = (error as { response?: { status?: number } } | undefined)?.response?.status === 401;
  const loginPath = `/user/login?redirect=${encodeURIComponent(`/content/${id}`)}`;

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
    () => fetchBookletChapters(id),
    { ready: detail?.type === ContentType.Booklet, refreshDeps: [id, detail?.type] },
  );
  useEffect(() => {
    if (detail?.type !== ContentType.Booklet || !chapterData?.chapters?.length) {
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
    readingSyncDisabledRef.current = false;
  }, [id]);

  // Markdown：滚动进度写入本地；登录后才同步 Nest，避免匿名 401 刷屏
  useEffect(() => {
    if (detail?.type !== ContentType.Markdown) return;

    const saved = getReadingProgress(detail.id);
    if (saved) setReadingPercent(saved.percent);
    const loggedIn = Boolean(initialState?.currentUser);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const percent = calcScrollPercent(scrollY);
        setReadingPercent(percent);
        setReadingProgress(detail.id, { scrollY, percent });
        if (loggedIn && !readingSyncDisabledRef.current) {
          void saveReadingProgress({
            contentId: detail.id,
            percent,
            updatedAt: new Date().toISOString(),
          }).catch(() => {
            readingSyncDisabledRef.current = true;
          });
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      const scrollY = window.scrollY;
      const percent = calcScrollPercent(scrollY);
      setReadingProgress(detail.id, { scrollY, percent });
    };
  }, [detail, initialState?.currentUser]);

  useEffect(() => {
    if (detail?.type !== ContentType.Markdown || loading) return;
    if (restoredRef.current === detail.id) return;
    restoredRef.current = detail.id;

    const saved = getReadingProgress(detail.id);
    if (!saved?.scrollY) return;

    const timer = window.setTimeout(() => {
      window.scrollTo({ top: saved.scrollY, behavior: 'auto' });
      setReadingPercent(saved.percent);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [detail, loading]);

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
      {loading && <SectionSkeleton variant="article" rows={10} />}
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
                    <PdfViewer url={detail.previewUrl} />
                  ) : (
                    <WordViewer url={detail.previewUrl} />
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
