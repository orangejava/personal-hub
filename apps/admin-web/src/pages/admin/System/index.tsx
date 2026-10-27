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
  {
    path: '/admin/system/theme',
    title: '主题配置',
    description: '公开区的主题色和外观设置。',
  },
  {
    path: '/admin/system/metrics',
    title: '性能汇总',
    description: '全站页面指标的上报比例，以及小时数据保留几天。',
  },
  {
    path: '/admin/system/files',
    title: '文件上传配置',
    description: '小册 ZIP 与工作区 ZIP 上传大小上限。',
  },
] as const;

/** 系统配置中心。主题和性能汇总从卡片进入。 */
const System: React.FC = () => {
  const openCard = (path: string) => {
    history.push(path);
  };

  return (
    <PageContainer title="系统配置">
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        按公开前台页面拆开维护。主题和性能汇总也可以从下面的卡片进入。厂商模型仍在侧栏的「AI
        管理」。
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
