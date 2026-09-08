import { HeartFilled, HeartOutlined } from '@ant-design/icons';
import type { ContentItem } from '@personal-hub/shared-types';
import { history, Link, useModel } from '@umijs/max';
import { Button, Card, message, Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import { favoriteContent, unfavoriteContent } from '@/services/content';
import ContentTypeTag from '../ContentTypeTag';
import EllipsisTooltip from '../EllipsisTooltip';
import MotionSurface from '../MotionSurface';

interface ContentCardProps {
  item: ContentItem;
}

/** 内容卡片：固定布局，标题/描述溢出省略并 Tooltip */
const ContentCard: React.FC<ContentCardProps> = ({ item }) => {
  const { initialState } = useModel('@@initialState');
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(item.favoriteCount);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const href = `/content/${item.id}`;
  const categoryLabel = item.categoryName || item.categorySlug;
  const compact = initialState?.systemConfig?.layout?.contentCardStyle === 'compact';

  useEffect(() => {
    setFavorited(Boolean(item.isFavorited));
    setFavoriteCount(item.favoriteCount);
  }, [item.favoriteCount, item.id, item.isFavorited]);

  const openDetail = () => {
    if (item.locked && !initialState?.currentUser) {
      message.info('登录后可以查看该内容');
      history.push(`/user/login?redirect=${encodeURIComponent(href)}`);
      return;
    }
    history.push(href);
  };

  const handleFavorite = async (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!initialState?.currentUser) {
      message.info('登录后可以收藏内容');
      history.push(`/user/login?redirect=${encodeURIComponent(href)}`);
      return;
    }
    if (favoriteLoading) return;
    const next = !favorited;
    setFavoriteLoading(true);
    try {
      await (next
        ? favoriteContent(item.id)
        : unfavoriteContent(item.id));
      setFavorited(next);
      setFavoriteCount((count) => Math.max(0, count + (next ? 1 : -1)));
      message.success(next ? '已收藏' : '已取消收藏');
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <MotionSurface variant="soft" style={{ width: '100%' }}>
      <Card
        className={`ph-content-card${compact ? ' ph-content-card-compact' : ''}`}
        hoverable
        cover={
          compact ? undefined : (
            <div className="ph-content-card-cover">
              {item.cover ? (
                <img alt={item.title} src={item.cover} loading="lazy" />
              ) : (
                <div className="ph-content-card-cover-placeholder">
                  <ContentTypeTag type={item.type} />
                </div>
              )}
            </div>
          )
        }
        onClick={openDetail}
      >
        <Card.Meta
          title={
            <Link
              to={href}
              onClick={(e) => {
                e.stopPropagation();
                if (item.locked && !initialState?.currentUser) {
                  e.preventDefault();
                  openDetail();
                }
              }}
            >
              <EllipsisTooltip title={item.title} lines={1} />
            </Link>
          }
          description={
            <div className="ph-content-card-body">
              <div className="ph-content-card-tags">
                <ContentTypeTag type={item.type} />
                {categoryLabel && <Tag>{categoryLabel}</Tag>}
                {item.locked && <Tag color="warning">登录可见</Tag>}
              </div>
              <EllipsisTooltip
                className="ph-content-card-summary"
                title={item.summary || '暂无描述'}
                lines={2}
              />
              <div className="ph-content-card-meta">
                <span>
                  {item.author} · 阅读 {item.viewCount} · 收藏 {favoriteCount}
                </span>
                <Button
                  type="text"
                  size="small"
                  loading={favoriteLoading}
                  icon={
                    favorited ? (
                      <HeartFilled style={{ color: '#ff4d4f' }} />
                    ) : (
                      <HeartOutlined />
                    )
                  }
                  onClick={handleFavorite}
                >
                  收藏
                </Button>
              </div>
            </div>
          }
        />
      </Card>
    </MotionSurface>
  );
};

export default ContentCard;
