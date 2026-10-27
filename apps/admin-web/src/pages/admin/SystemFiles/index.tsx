import { ProForm, ProFormDigit } from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { Alert, Card, message } from 'antd';
import React, { useState } from 'react';
import { ErrorState, PageContainer, SectionSkeleton } from '@/components/shared';
import { useRequest } from '@/hooks/useRequest';
import { fetchAdminBookletUploadLimit, updateAdminBookletUploadLimit } from '@/services/admin';

/** 系统管理员设置工作区 ZIP 的业务大小策略。 */
const SystemFiles: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const { data, loading, error, run } = useRequest(fetchAdminBookletUploadLimit);

  const handleFinish = async (values: { maxSizeMiB?: number }) => {
    const maxSizeMiB = values.maxSizeMiB;
    if (typeof maxSizeMiB !== 'number' || !Number.isFinite(maxSizeMiB) || maxSizeMiB < 0) {
      message.error('请输入不小于 0 的文件大小');
      return false;
    }
    setSaving(true);
    try {
      await updateAdminBookletUploadLimit(maxSizeMiB);
      message.success('文件上传配置已保存');
      await run();
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <PageContainer title="文件上传配置">
        <SectionSkeleton variant="form" count={2} />
      </PageContainer>
    );
  }
  if (error) {
    return (
      <PageContainer title="文件上传配置">
        <ErrorState title="文件上传配置加载失败" onRetry={run} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="文件上传配置" extra={<Link to="/admin/system">返回系统配置</Link>}>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        title="配置工作区小册 ZIP 上传大小"
        description="默认 50 MiB。设置为 0 可关闭该上传用途；系统不设置额外的最小值或业务最大值。腾讯云 COS 单片最大 5 GB、最多 10,000 片，存储服务的协议能力仍会限制单个对象大小。解压后总量阈值会随上传策略提升；为控制 worker 内存，ZIP 文件名与元数据累计最多 8 MiB，所有 Markdown 章节正文累计最多 64 MiB（每章最多 2 MiB、最多 1000 章），这些固定阈值不随配置变化。"
      />
      <Card>
        <ProForm<{ maxSizeMiB?: number }>
          initialValues={data}
          onFinish={handleFinish}
          submitter={{ submitButtonProps: { loading: saving } }}
        >
          <ProFormDigit
            name="maxSizeMiB"
            label="ZIP 最大上传大小（MiB）"
            fieldProps={{ min: 0, precision: 2, addonAfter: 'MiB' }}
            rules={[{ required: true, message: '请输入最大上传大小' }]}
            extra="此设置同时作用于小册导入和工作区 ZIP 上传。"
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SystemFiles;
