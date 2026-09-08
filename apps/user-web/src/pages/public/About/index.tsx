import { Card, Col, Row, Typography } from 'antd';
import { useModel } from '@umijs/max';
import React from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import { MarkdownViewer, MotionSurface, ResultState } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchPublicConfig } from '@/services/system';

const { Title } = Typography;

const ABOUT_MD_FALLBACK = `# 关于我

一个正在搭建个人知识中台的开发者，把阅读、写作与 AI 工具沉淀到一个站点。

## 技术栈

- 前端：React / Umi / Ant Design Pro，后续抽离 Next.js
- 后端：NestJS + Prisma + PostgreSQL
- 工程：pnpm + Turborepo 单仓多包

## 站点规划

- 公开前台：内容阅读、小册、项目
- 工作区：内容生产与管理
- 后台：用户、角色、内容审核
- AI 工具：对话、文本与图片生成（阶段 5）

## 联系

- Email：hello@example.com
- GitHub：personal-hub
`;

/** 关于我：优先读公开 site-config 的 site.about，空正文回落内置草稿。 */
const About: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const { data: liveConfig } = useRequest(fetchPublicConfig);
  const about = liveConfig?.about ?? initialState?.systemConfig?.about;
  const title = about?.title?.trim() || '关于我';
  const markdown = about?.markdown?.trim() || ABOUT_MD_FALLBACK;

  return (
    <PublicLayout>
      <Row gutter={24}>
        <Col span={16}>
          <MotionSurface>
            <Card>
              {markdown ? (
                <MarkdownViewer source={markdown} />
              ) : (
                <ResultState status="empty" description="尚未配置关于我" />
              )}
            </Card>
          </MotionSurface>
        </Col>
        <Col span={8}>
          <MotionSurface variant="soft">
            <Card title="站点信息">
              <div className="ph-about-side">
                <Title level={5} style={{ marginTop: 0 }}>
                  {title}
                </Title>
                Personal Hub · React-first 阶段
              </div>
            </Card>
          </MotionSurface>
        </Col>
      </Row>
    </PublicLayout>
  );
};

export default About;
