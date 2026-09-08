import { ContentType } from '@personal-hub/shared-types';
import { useRequest } from '@/hooks/useRequest';
import { history, Link, useIntl } from '@umijs/max';
import { Button, Card, Col, Pagination, Row, Tag } from 'antd';
import React, { useState } from 'react';
import {
  AnimatedList,
  ErrorState,
  PageContainer,
  ResultState,
  SectionSkeleton,
} from '@/components/shared';
import { DEFAULT_TABLE_PAGE_SIZE, DEFAULT_TABLE_PAGINATION } from '@/constants/tablePagination';
import { fetchMyContents } from '@/services/workspace';
import ContentMetaDrawer from '../Content/ContentMetaDrawer';

/** 小册管理：工作区已导入的 Nest 小册。存量目录请用 CLI，不再扫描本地 mock。 */
const Booklets: React.FC = () => {
  const intl = useIntl();
  const [metaId, setMetaId] = useState<string>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const { data, loading, error, run } = useRequest(
    () => fetchMyContents({ type: ContentType.Booklet, page, pageSize }),
    { refreshDeps: [page, pageSize] },
  );
  const booklets = data?.list ?? [];
  const total = data?.total ?? 0;

  const openMeta = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    setMetaId(id);
  };

  const handlePageChange = (nextPage: number, nextSize: number) => {
    setPage(nextPage);
    setPageSize(nextSize);
  };

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'workspace.booklets.title' })}
      extra={
        <Link to="/workspace/content/new">
          <Button type="primary">
            {intl.formatMessage({ id: 'workspace.content.new' })}
          </Button>
        </Link>
      }
    >
      <Card title={intl.formatMessage({ id: 'workspace.booklets.site' })}>
        {error && <ErrorState onRetry={run} />}
        {loading ? (
          <SectionSkeleton variant="card" count={3} columns={3} />
        ) : booklets.length > 0 ? (
          <>
            <Row gutter={16}>
              <AnimatedList
                items={booklets}
                getKey={(item) => item.id}
                wrapItem={false}
                renderItem={(item) => (
                  <Col xs={24} md={12} lg={8}>
                    <Card
                      hoverable
                      title={item.title}
                      extra={
                        <Button type="link" size="small" onClick={(event) => openMeta(event, item.id)}>
                          编辑信息
                        </Button>
                      }
                      onClick={() => history.push(`/content/${item.id}`)}
                    >
                      <p style={{ minHeight: 44 }}>{item.summary}</p>
                      <Tag>{item.status}</Tag>
                      <Tag>{item.categoryName || '未分类'}</Tag>
                      {item.reviewStatus === 'PENDING' ? (
                        <Tag color="processing">待审核</Tag>
                      ) : item.importRestriction === 'PRIVATE_UNTIL_LICENSED' ? (
                        <Tag color="orange">待审公开</Tag>
                      ) : null}
                      <span style={{ marginLeft: 8, opacity: 0.65 }}>{item.author}</span>
                    </Card>
                  </Col>
                )}
              />
            </Row>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination
                {...DEFAULT_TABLE_PAGINATION}
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={handlePageChange}
              />
            </div>
          </>
        ) : (
          <ResultState
            status="empty"
            description="暂无已导入小册。可在新建内容里上传 ZIP，或用 pnpm booklet:import-local 迁移存量目录。"
          />
        )}
      </Card>
      <ContentMetaDrawer
        contentId={metaId}
        open={!!metaId}
        onClose={() => setMetaId(undefined)}
        onSaved={run}
      />
    </PageContainer>
  );
};

export default Booklets;
