import { useRequest } from '@/hooks/useRequest';
import {
  DragSortTable,
  type ProColumns,
  ProForm,
  ProFormList,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import type {
  HomepageConfig,
  HomepageModuleConfig,
  HomepageTechStackConfig,
} from '@personal-hub/shared-types';

import { Alert, Button, Card, Col, Form, message, Row, Space, Tag } from 'antd';
import React, { useMemo, useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import {
  fetchAdminHomepageConfig,
  updateAdminHomepageConfig,
} from '@/services/admin';

type HomepageFormValues = Omit<HomepageConfig, 'featuredContent'> & {
  featuredContent: { contentIds: string };
};

const moduleColumns: ProColumns<HomepageModuleConfig>[] = [
  { title: '模块', dataIndex: 'title' },
  {
    title: 'Key',
    dataIndex: 'key',
    render: (_, record) => <Tag>{record.key}</Tag>,
  },
  {
    title: '显示',
    dataIndex: 'visible',
    render: (_, record) => (record.visible ? <Tag color="success">显示</Tag> : <Tag>隐藏</Tag>),
  },
];

/** 首页配置：集中维护公开首页 Hero、模块排序、精选内容和推荐区块。 */
const Homepage: React.FC = () => {
  const [form] = Form.useForm<HomepageFormValues>();
  const [modules, setModules] = useState<HomepageModuleConfig[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refresh } = useRequest(fetchAdminHomepageConfig, {
    onSuccess: (homepage) => {
      if (homepage?.featuredContent) {
        form.setFieldsValue({
          ...homepage,
          featuredContent: {
            contentIds: homepage.featuredContent.contentIds.join(','),
          },
        });
        setModules([...homepage.modules].sort((a, b) => a.sort - b.sort));
      }
    },
  });

  const config = data;
  const visibleModules = useMemo(
    () => modules.filter((item) => item.visible).map((item) => item.title),
    [modules],
  );

  const save = async (values: HomepageFormValues) => {
    const payload: HomepageConfig = {
      ...values,
      modules: modules.map((item, index) => ({ ...item, sort: index + 1 })),
      featuredContent: {
        contentIds: String(values.featuredContent?.contentIds ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      },
    };
    setSaving(true);
    try {
      await updateAdminHomepageConfig(payload);
      message.success('首页配置已保存');
      refresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <PageContainer title="首页配置">
        <SectionSkeleton variant="article" rows={8} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="首页配置">
        <ErrorState title="首页配置加载失败" onRetry={refresh} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="首页配置">
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        title="首页配置来自 Nest system_configs（site.homepage）"
        description="精选内容 ID 在内容模块接入前可留空；保存会整组更新并清公开配置缓存。"
      />
      <Row gutter={16}>
        <Col span={16}>
          <Card title="首页内容">
            <ProForm<HomepageFormValues>
              form={form}
              layout="vertical"
              submitter={{
                render: (_, dom) => (
                  <Space>
                    {dom}
                    <Button onClick={() => refresh()} disabled={saving}>
                      重置为当前配置
                    </Button>
                  </Space>
                ),
                submitButtonProps: { loading: saving },
              }}
              onFinish={async (values) => {
                await save(values);
                return true;
              }}
            >
              <ProForm.Group title="Hero">
                <ProFormText name={['hero', 'title']} label="标题" rules={[{ required: true }]} />
                <ProFormText name={['hero', 'subtitle']} label="副标题" rules={[{ required: true }]} />
                <ProFormText name={['hero', 'primaryText']} label="主按钮文案" />
                <ProFormText name={['hero', 'primaryLink']} label="主按钮链接" />
                <ProFormText name={['hero', 'secondaryText']} label="次按钮文案" />
                <ProFormText name={['hero', 'secondaryLink']} label="次按钮链接" />
              </ProForm.Group>

              <ProFormText
                name={['featuredContent', 'contentIds']}
                label="精选内容 ID"
                tooltip="用英文逗号分隔，例如 c-md-01,c-md-02,c-book-01"
              />

              <ProFormList
                name="aiTools"
                label="AI 工具推荐"
                creatorButtonProps={{ creatorButtonText: '新增 AI 工具推荐' }}
              >
                <ProFormText name="key" label="Key" rules={[{ required: true }]} />
                <ProFormText name="title" label="名称" rules={[{ required: true }]} />
                <ProFormText name="description" label="描述" />
                <ProFormSwitch name="enabled" label="启用" />
              </ProFormList>

              <ProFormList<HomepageTechStackConfig>
                name="techStack"
                label="技术栈"
                creatorButtonProps={{ creatorButtonText: '新增技术栈' }}
              >
                <ProFormText name="name" label="名称" rules={[{ required: true }]} />
                <ProFormText name="category" label="分类" rules={[{ required: true }]} />
                <ProFormText name="icon" label="图标 URL" />
              </ProFormList>
            </ProForm>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="模块排序与显隐">
            <DragSortTable<HomepageModuleConfig>
              rowKey="key"
              search={false}
              pagination={false}
              toolBarRender={false}
              dragSortKey="sort"
              dataSource={modules}
              columns={[
                ...moduleColumns,
                {
                  title: '操作',
                  valueType: 'option',
                  render: (_, record) => [
                    <a
                      key="toggle"
                      onClick={() =>
                        setModules((items) =>
                          items.map((item) =>
                            item.key === record.key
                              ? { ...item, visible: !item.visible }
                              : item,
                          ),
                        )
                      }
                    >
                      {record.visible ? '隐藏' : '显示'}
                    </a>,
                  ],
                },
              ]}
              onDragSortEnd={(_, __, newDataSource) => {
                setModules(newDataSource.map((item, index) => ({ ...item, sort: index + 1 })));
              }}
            />
          </Card>
          <Card title="当前预览" style={{ marginTop: 16 }}>
            <p style={{ marginTop: 0, fontWeight: 600 }}>{form.getFieldValue(['hero', 'title'])}</p>
            <p style={{ color: '#667085' }}>{form.getFieldValue(['hero', 'subtitle'])}</p>
            <Space wrap>
              {visibleModules.map((item) => (
                <Tag key={item} color="blue">
                  {item}
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default Homepage;
