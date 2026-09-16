import { useSearchParams, Link, useModel } from '@umijs/max';
import { useRequest } from '@/hooks/useRequest';
import { Button, Col, Input, Pagination, Row, Select, Space, Tag } from 'antd';
import React, { useEffect } from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import { DEFAULT_TABLE_PAGE_SIZE, DEFAULT_TABLE_PAGINATION } from '@/constants/tablePagination';
import {
  ContentCard,
  ErrorState,
  ResultState,
  SectionSkeleton,
} from '@/components/shared';
import { fetchContentList, fetchContentMeta, type ContentListQuery } from '@/services/content';
import { ContentType, ContentTypeLabel, UserRole } from '@personal-hub/shared-types';

const typeOptions = [
  { label: '全部类型', value: 'all' },
  ...Object.values(ContentType).map((t) => ({ label: ContentTypeLabel[t], value: t })),
];
const sortOptions = [
  { label: '最新发布', value: 'latest' },
  { label: '阅读最多', value: 'views' },
];

/** 内容中心：筛选 + 卡片列表 + 分页 */
const Content: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') ?? '';
  const type = searchParams.get('type') ?? 'all';
  const category = searchParams.get('category') ?? '';
  const tag = searchParams.get('tag') ?? '';
  const sort = (searchParams.get('sort') as ContentListQuery['sort']) ?? 'latest';
  const page = Number(searchParams.get('page') ?? 1);
  const pageSize = Number(searchParams.get('pageSize') ?? DEFAULT_TABLE_PAGE_SIZE);

  const query: ContentListQuery = { keyword, type, category, tag, sort, page, pageSize };
  const { data, loading, error, run } = useRequest(() => fetchContentList(query));
  const result = data;
  const { data: meta } = useRequest(fetchContentMeta);
  const categories = meta?.categories ?? [];
  const tags = meta?.tags ?? [];

  // 登录的管理员/编辑显示「进入管理」入口
  const { initialState } = useModel('@@initialState');
  const canManage =
    initialState?.currentUser?.role === UserRole.Admin ||
    initialState?.currentUser?.role === UserRole.Editor;

  // 任意筛选条件变化时重新拉取
  useEffect(() => {
    run();
  }, [keyword, type, category, tag, sort, page, pageSize]);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    if (!patch.page) next.set('page', '1');
    setSearchParams(next);
  };

  return (
    <PublicLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>内容中心</h2>
        {canManage && (
          <Link to="/workspace/content">
            <Button type="primary">进入管理</Button>
          </Link>
        )}
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索标题或摘要"
          allowClear
          defaultValue={keyword}
          onSearch={(v) => update({ keyword: v })}
          style={{ width: 220 }}
        />
        <Select
          value={type}
          options={typeOptions}
          onChange={(v) => update({ type: v })}
          style={{ width: 140 }}
        />
        <Select
          value={category || undefined}
          placeholder="分类"
          allowClear
          options={categories.map((c) => ({ label: c.name, value: c.slug }))}
          onChange={(v) => update({ category: v ?? '' })}
          style={{ width: 140 }}
        />
        <Select
          value={sort}
          options={sortOptions}
          onChange={(v) => update({ sort: v })}
          style={{ width: 140 }}
        />
      </Space>

      {/* 标签快速过滤 */}
      {tags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {tags.map((t) => (
            <Tag.CheckableTag
              key={t.slug}
              checked={tag === t.slug}
              onChange={(checked) => update({ tag: checked ? t.slug : '' })}
            >
              {t.name}
            </Tag.CheckableTag>
          ))}
        </div>
      )}

      {error && <ErrorState onRetry={run} />}
      {loading ? (
        <SectionSkeleton variant="list" count={3} rows={3} />
      ) : result && result.list.length > 0 ? (
        <>
          <Row gutter={[16, 16]}>
            {result.list.map((item) => (
              <Col
                xs={24}
                md={12}
                lg={8}
                key={item.id}
                style={{ display: 'flex' }}
              >
                <ContentCard item={item} />
              </Col>
            ))}
          </Row>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination
              {...DEFAULT_TABLE_PAGINATION}
              current={result.page}
              pageSize={result.pageSize}
              total={result.total}
              onChange={(p, size) =>
                update({ page: String(p), pageSize: String(size) })
              }
            />
          </div>
        </>
      ) : (
        <ResultState
          status="empty"
          description="没有匹配的内容"
          actionText="清除筛选"
          actionTo="/content"
        />
      )}
    </PublicLayout>
  );
};

export default Content;
