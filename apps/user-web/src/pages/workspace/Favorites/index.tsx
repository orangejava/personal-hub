import { ProTable } from '@ant-design/pro-components';
import { type ContentType, ContentTypeLabel } from '@personal-hub/shared-types';
import { Link, useIntl } from '@umijs/max';
import { Tag } from 'antd';
import React from 'react';
import { PageContainer, ResultState } from '@/components/shared';
import { fetchFavorites } from '@/services/workspace';

/** 我的收藏 */
const Favorites: React.FC = () => {
  const intl = useIntl();
  return (
  <PageContainer title={intl.formatMessage({ id: 'workspace.favorites.title' })}>
    <ProTable
      rowKey="id"
      search={false}
      locale={{
        emptyText: (
          <ResultState
            status="empty"
            description="暂无收藏内容"
            actionText="去内容中心"
            actionTo="/content"
          />
        ),
      }}
      request={async (params) => {
        const res = await fetchFavorites({
          page: params.current,
          pageSize: params.pageSize,
        });
        return {
          data: res.data.list,
          success: res.code === 0,
          total: res.data.total,
        };
      }}
      columns={[
        {
          title: '标题',
          dataIndex: 'title',
          render: (_, r) => <Link to={`/content/${r.id}`}>{r.title}</Link>,
        },
        {
          title: '类型',
          dataIndex: 'type',
          render: (_, r) => (
            <Tag color="blue">{ContentTypeLabel[r.type as ContentType]}</Tag>
          ),
        },
        { title: '收藏数', dataIndex: 'favoriteCount' },
      ]}
    />
  </PageContainer>
  );
};

export default Favorites;
