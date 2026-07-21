import { Card, Col, Row, Typography } from 'antd';
import React from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import { MarkdownViewer, MotionSurface } from '@/components/shared';

const { Title } = Typography;

const ABOUT_MD = `# 关于我

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

/** 关于我 */
const About: React.FC = () => (
  <PublicLayout>
    <Row gutter={24}>
      <Col span={16}>
        <MotionSurface>
          <Card>
            <MarkdownViewer source={ABOUT_MD} />
          </Card>
        </MotionSurface>
      </Col>
      <Col span={8}>
        <MotionSurface variant="soft">
          <Card title="站点信息">
            <div className="ph-about-side">
              Personal Hub · React-first 阶段
              <br />
              基于 Ant Design Pro 改造
            </div>
          </Card>
        </MotionSurface>
      </Col>
    </Row>
  </PublicLayout>
);

export default About;
