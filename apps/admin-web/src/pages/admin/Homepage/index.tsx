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

import { Link } from '@umijs/max';
import { Alert, Button, Card, Col, Form, message, Row, Tag } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import {
  fetchAdminHomepageConfig,
  updateAdminHomepageConfig,
} from '@/services/admin';
import styles from './index.module.less';

type HomepageFormValues = Omit<HomepageConfig, 'featuredContent'> & {
  featuredContent: { contentIds: string };
};

type ListItemMeta = {
  listDom: React.ReactNode;
  action: React.ReactNode;
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

/** 列表项标题只说明序号，具体字段仍在卡片里。 */
function renderListItem(label: string, { listDom, action }: ListItemMeta, index: number) {
  return (
    <div className={styles.entryCard}>
      <div className={styles.entryHead}>
        <span>
          {label} {index + 1}
        </span>
        <div className={styles.entryActions}>{action}</div>
      </div>
      {listDom}
    </div>
  );
}

/** 首页配置：集中维护公开首页 Hero、模块排序、精选内容和推荐区块。 */
const Homepage: React.FC = () => {
  const [form] = Form.useForm<HomepageFormValues>();
  const [modules, setModules] = useState<HomepageModuleConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const heroTitle = Form.useWatch(['hero', 'title'], form);
  const heroSubtitle = Form.useWatch(['hero', 'subtitle'], form);

  const { data, loading, error, refresh } = useRequest(fetchAdminHomepageConfig);

  const config = data;
  const visibleModules = useMemo(
    () => modules.filter((item) => item.visible).map((item) => item.title),
    [modules],
  );

  /** 等 ProForm 挂载后再写入，避免 loading 阶段 useForm 未连接 Form。 */
  useEffect(() => {
    if (!config?.featuredContent) {
      return;
    }
    form.setFieldsValue({
      ...config,
      featuredContent: {
        contentIds: config.featuredContent.contentIds.join(','),
      },
    });
    setModules([...config.modules].sort((a, b) => a.sort - b.sort));
  }, [config, form]);

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
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = (key: string) => {
    setModules((items) =>
      items.map((item) => (item.key === key ? { ...item, visible: !item.visible } : item)),
    );
  };

  const renderAiToolItem = (meta: ListItemMeta, index: number) =>
    renderListItem('AI 工具', meta, index);

  const renderTechItem = (meta: ListItemMeta, index: number) =>
    renderListItem('技术栈', meta, index);

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
    <PageContainer title="首页配置" extra={<Link to="/admin/system">返回系统配置</Link>}>
      <Alert
        className={styles.form}
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        title="首页配置来自 Nest system_configs（site.homepage）"
        description="入口在「系统配置」卡片。Hero、模块显隐、精选内容和首页推荐区块都在此页。AI 工具推荐和技术栈目前仍是首页模块数据，不是独立的 AI 管理页。"
      />
      <Card>
        <ProForm<HomepageFormValues>
          className={styles.form}
          form={form}
          layout="vertical"
          submitter={{
            render: (_, dom) => (
              <div className={styles.submitter}>
                {dom}
                <Button onClick={() => refresh()} disabled={saving}>
                  重置为当前配置
                </Button>
              </div>
            ),
            submitButtonProps: { loading: saving },
          }}
          onFinish={async (values) => save(values)}
        >
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Hero</div>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <ProFormText name={['hero', 'title']} label="标题" rules={[{ required: true }]} />
              </Col>
              <Col xs={24} md={12}>
                <ProFormText
                  name={['hero', 'subtitle']}
                  label="副标题"
                  rules={[{ required: true }]}
                />
              </Col>
              <Col xs={24} md={12}>
                <ProFormText name={['hero', 'primaryText']} label="主按钮文案" />
              </Col>
              <Col xs={24} md={12}>
                <ProFormText name={['hero', 'primaryLink']} label="主按钮链接" />
              </Col>
              <Col xs={24} md={12}>
                <ProFormText name={['hero', 'secondaryText']} label="次按钮文案" />
              </Col>
              <Col xs={24} md={12}>
                <ProFormText name={['hero', 'secondaryLink']} label="次按钮链接" />
              </Col>
            </Row>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>精选内容</div>
            <ProFormText
              name={['featuredContent', 'contentIds']}
              label="精选内容 ID"
              extra="用英文逗号分隔，例如 c-md-01,c-md-02,c-book-01"
            />
          </div>

          <div className={`${styles.section} ${styles.cols2}`}>
            <div className={styles.sectionTitle}>AI 工具推荐</div>
            <p className={styles.hint}>每项一张卡片。宽度够时两列并排。</p>
            <ProFormList
              name="aiTools"
              containerClassName="entryGrid"
              containerStyle={{ width: '100%', minWidth: 0 }}
              creatorButtonProps={{ creatorButtonText: '新增 AI 工具推荐' }}
              itemRender={(meta, { index }) => renderAiToolItem(meta, index)}
            >
              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <ProFormText name="key" label="Key" rules={[{ required: true }]} />
                </Col>
                <Col xs={24} sm={12}>
                  <ProFormText name="title" label="名称" rules={[{ required: true }]} />
                </Col>
              </Row>
              <ProFormText name="description" label="描述" />
              <ProFormSwitch name="enabled" label="启用" />
            </ProFormList>
          </div>

          <div className={`${styles.section} ${styles.cols3}`}>
            <div className={styles.sectionTitle}>技术栈</div>
            <p className={styles.hint}>每项一张卡片。宽度够时最多三列并排。</p>
            <ProFormList<HomepageTechStackConfig>
              name="techStack"
              containerClassName="entryGrid"
              containerStyle={{ width: '100%', minWidth: 0 }}
              creatorButtonProps={{ creatorButtonText: '新增技术栈' }}
              itemRender={(meta, { index }) => renderTechItem(meta, index)}
            >
              <ProFormText name="name" label="名称" rules={[{ required: true }]} />
              <ProFormText name="category" label="分类" rules={[{ required: true }]} />
              <ProFormText name="icon" label="图标 URL" />
            </ProFormList>
          </div>
        </ProForm>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card>
            <div className={styles.sectionTitle}>模块排序与显隐</div>
            <p className={styles.hint}>拖动行调整顺序，点「显示 / 隐藏」切换模块。和上面的内容一起保存。</p>
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
                    <a key="toggle" onClick={() => toggleModule(record.key)}>
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
        </Col>
        <Col xs={24} lg={8}>
          <Card>
            <div className={styles.sectionTitle}>当前预览</div>
            <p className={styles.previewTitle}>{heroTitle || '未填写标题'}</p>
            <p className={styles.previewSubtitle}>{heroSubtitle || '未填写副标题'}</p>
            <Row gutter={[8, 8]}>
              {visibleModules.map((item) => (
                <Col key={item}>
                  <Tag color="blue">{item}</Tag>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default Homepage;
