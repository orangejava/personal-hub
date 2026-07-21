import { HeartFilled, HeartOutlined } from '@ant-design/icons';
import type { ContentItem } from '@personal-hub/shared-types';
import { history, Link, useModel } from '@umijs/max';
import { Button, Card, message, Tag } from 'antd';
import React, { useState } from 'react';
import { favoriteContent, unfavoriteContent } from '@/services/content';
import ContentTypeTag from '../ContentTypeTag';
import MotionSurface from '../MotionSurface';

interface ContentCardProps {
  item: ContentItem;
}

/** 内容卡片：列表项统一展示 */
const ContentCard: React.FC<ContentCardProps> = ({ item }) => {
  const { initialState } = useModel('@@initialState');
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(item.favoriteCount);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const href = `/content/${item.id}`;

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
      const res = next
        ? await favoriteContent(item.id)
        : await unfavoriteContent(item.id);
      if (res?.code === 0) {
        setFavorited(next);
        setFavoriteCount((count) => Math.max(0, count + (next ? 1 : -1)));
        message.success(next ? '已收藏' : '已取消收藏');
      } else {
        message.error(res?.message || '收藏失败');
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <MotionSurface variant="soft">
      <Card
        hoverable
        cover={
          <div className="ph-content-card-cover">
            {item.cover ? (
              <img alt={item.title} src={item.cover} loading="lazy" />
            ) : (
              <div className="ph-content-card-cover-placeholder">
                <ContentTypeTag type={item.type} />
              </div>
            )}
          </div>
        }
        onClick={() => history.push(href)}
        style={{ marginBottom: 16 }}
      >
        <Card.Meta
          title={<Link to={href}>{item.title}</Link>}
          description={
            <>
              <div style={{ marginBottom: 8 }}>
                <ContentTypeTag type={item.type} />
                {item.categorySlug && <Tag>{item.categorySlug}</Tag>}
              </div>
              <div className="ph-content-card-summary">{item.summary}</div>
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
            </>
          }
        />
      </Card>
    </MotionSurface>
  );
};

export default ContentCard;
