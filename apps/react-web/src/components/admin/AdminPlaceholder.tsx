import { Card, Typography } from 'antd';
import React from 'react';
import { PageContainer } from '@/components/shared';

type AdminPlaceholderProps = {
  title: string;
  description?: string;
};

/**
 * 后台页面占位：阶段 4 逐页替换为 ProTable / ProForm 实现
 */
const AdminPlaceholder: React.FC<AdminPlaceholderProps> = ({
  title,
  description = '本页面 CRUD 与联调在阶段 4 迭代中实现。',
}) => (
  <PageContainer title={title}>
    <Card>
      <Typography.Paragraph>{description}</Typography.Paragraph>
      <Typography.Text type="secondary">
        路由与菜单已就绪，后续接入 `services/admin` mock 与 NestJS API。
      </Typography.Text>
    </Card>
  </PageContainer>
);

export default AdminPlaceholder;
