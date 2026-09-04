import { useRequest } from '@/hooks/useRequest';
import {
  CopyOutlined,
  HeartFilled,
  HeartOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useParams, history, Link, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  message,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import { ContentType, ContentTypeLabel } from '@personal-hub/shared-types';
import {
  ErrorState,
  MarkdownViewer,
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

/** 内容详情：按类型分流展示 */
const ContentDetail: React.FC = () => {
  const params = useParams<{ id: string }>();
  const id = params.id!;
  const { initialState } = useModel('@@initialState');
  const [favorited, setFavorited] = useState(false);
  const [readingPercent, setReadingPercent] = useState(0);
  const restoredRef = useRef<string | null>(null);
  const { data, loading, error, run } = useRequest(() => fetchContentDetail(id), {
    refreshDeps: [id],
  });
  const detail = data;

  // 小册入口：优先跳上次章节，否则第一章（带 chapterId 的 URL 不经此页）
  const { data: chapterData } = useRequest(
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
  }, [id]);

  // Markdown：滚动进度写入本地 + mock API；进入时恢复 scrollY
  useEffect(() => {
    if (detail?.type !== ContentType.Markdown) return;

    const saved = getReadingProgress(detail.id);
    if (saved) setReadingPercent(saved.percent);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const percent = calcScrollPercent(scrollY);
        setReadingPercent(percent);
        setReadingProgress(detail.id, { scrollY, percent });
        void saveReadingProgress({
          contentId: detail.id,
          percent,
          updatedAt: new Date().toISOString(),
        });
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
  }, [detail]);

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

  return (
    <PublicLayout>
      {error && <ErrorState title="内容不存在或加载失败" onRetry={run} />}
      {loading && <SectionSkeleton variant="article" rows={10} />}
      {detail && detail.type !== ContentType.Booklet && (
        <div className="ph-content-detail-layout">
          <div className="ph-reading ph-content-detail-main">
            <Space style={{ marginBottom: 12 }}>
              <Tag color="blue">{ContentTypeLabel[detail.type]}</Tag>
              {detail.categorySlug && <Tag>{detail.categorySlug}</Tag>}
              {detail.tags?.map((t) => <Tag key={t}>{t}</Tag>)}
            </Space>
            <Title level={2}>{detail.title}</Title>
            <div className="ph-detail-meta">
              {detail.author} · {detail.publishedAt}
            </div>
            <Card size="small" style={{ marginBottom: 16 }}>
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
                  <span style={{ minWidth: 220, display: 'inline-block' }}>
                    阅读进度
                    <Progress percent={readingPercent} size="small" />
                  </span>
                )}
              </Space>
            </Card>

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
              <TocPanel items={extractMarkdownToc(detail.body)} />
            </div>
          )}
        </div>
      )}
      <ScrollBackTop visibilityHeight={300} />
    </PublicLayout>
  );
};

export default ContentDetail;
