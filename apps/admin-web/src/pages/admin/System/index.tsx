import { history } from '@umijs/max';
import { Card, Col, Row, Typography } from 'antd';
import React from 'react';
import { PageContainer } from '@/components/shared';

const { Paragraph } = Typography;

const CONFIG_HUB_CARDS = [
  {
    path: '/admin/system/site',
    title: '站点配置',
    description: '站点名称、描述等公开身份信息。',
  },
  {
    path: '/admin/system/homepage',
    title: '首页配置',
    description: 'Hero、模块显隐、精选内容和首页推荐区块。',
  },
  {
    path: '/admin/system/content',
    title: '内容中心配置',
    description: '内容卡片样式、阅读页宽度和面包屑。',
  },
  {
    path: '/admin/system/about',
    title: '关于我配置',
    description: '关于我页面的标题与 Markdown。',
  },
  {
    path: '/admin/system/projects',
    title: '项目配置',
    description: '项目页标题与简介文案。',
  },
] as const;

/** 系统配置中心：只放按公开页面拆开的展示配置，不把 AI 管理或主题配置收进来。 */
const System: React.FC = () => {
  const openCard = (path: string) => {
    history.push(path);
  };

  return (
    <PageContainer title="系统配置">
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        按公开前台页面拆开维护展示配置。厂商模型、主题色仍在侧栏的「AI 管理」和「主题配置」。
      </Paragraph>
      <Row gutter={[16, 16]}>
        {CONFIG_HUB_CARDS.map((card) => (
          <Col xs={24} md={12} xl={8} key={card.path}>
            <Card hoverable onClick={() => openCard(card.path)}>
              <Card.Meta title={card.title} description={card.description} />
            </Card>
          </Col>
        ))}
      </Row>
    </PageContainer>
  );
};

export default System;
