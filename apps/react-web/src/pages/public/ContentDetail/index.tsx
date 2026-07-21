import {
  CopyOutlined,
  HeartFilled,
  HeartOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useRequest, useParams, history, Link, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  FloatButton,
  message,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import { ContentType, ContentTypeLabel } from '@personal-hub/shared-types';
import {
  ErrorState,
  MarkdownViewer,
  PdfViewer,
  RichTextViewer,
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
  const { data, loading, error, run } = useRequest(() => fetchContentDetail(id), {
    refreshDeps: [id],
  });
  const detail = data;

  // 小册：拉取章节列表后跳转第一章
  const { data: chapterData } = useRequest(
    () => fetchBookletChapters(id),
    { ready: detail?.type === ContentType.Booklet, refreshDeps: [id, detail?.type] },
  );
  useEffect(() => {
    if (detail?.type === ContentType.Booklet && chapterData?.chapters?.length) {
      const first = chapterData.chapters[0];
      history.replace(`/content/booklets/${detail.id}/chapters/${first.id}`);
    }
  }, [detail, chapterData]);

  useEffect(() => {
    scrollPageToTop();
  }, [id]);

  // 阅读进度首版只做 mock 保存，后续接后端时替换为滚动进度持久化
  useEffect(() => {
    if (detail?.type !== ContentType.Markdown) return;
    const percent = 20;
    setReadingPercent(percent);
    void saveReadingProgress({
      contentId: detail.id,
      percent,
      updatedAt: new Date().toISOString(),
    });
  }, [detail]);

  const toggleFavorite = async () => {
    if (!initialState?.currentUser) {
      message.info('登录后可以收藏内容');
      history.push(`/user/login?redirect=${encodeURIComponent(`/content/${id}`)}`);
      return;
    }
    const next = !favorited;
    const res = next ? await favoriteContent(id) : await unfavoriteContent(id);
    if (res?.code === 0) {
      setFavorited(next);
      message.success(next ? '已收藏' : '已取消收藏');
    } else {
      message.error(res?.message || '收藏失败');
    }
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
      <FloatButton.BackTop visibilityHeight={300} />
    </PublicLayout>
  );
};

export default ContentDetail;
