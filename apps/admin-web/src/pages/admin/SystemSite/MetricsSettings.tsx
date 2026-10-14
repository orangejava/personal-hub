import { ProForm, ProFormDigit } from '@ant-design/pro-components';
import { Card, Form, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import {
  fetchAdminMetricsSettings,
  updateAdminMetricsSettings,
} from '@/services/admin';

/**
 * 全站性能抽样和小时数据保留。和站点身份分开保存，避免改加载图时带上这组数字。
 */
const MetricsSettings: React.FC = () => {
  const [form] = Form.useForm<{
    samplePercent: number;
    hourRetentionDays: number;
  }>();
  const [version, setVersion] = useState(1);
  const [saving, setSaving] = useState(false);
  const { data, loading, error, run } = useRequest(fetchAdminMetricsSettings);

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      samplePercent: data.samplePercent,
      hourRetentionDays: data.hourRetentionDays,
    });
    setVersion(data.version);
  }, [data, form]);

  const save = async (values: {
    samplePercent: number;
    hourRetentionDays: number;
  }) => {
    setSaving(true);
    let saved = false;
    try {
      await updateAdminMetricsSettings({ ...values, version });
      saved = true;
      message.success('性能汇总配置已保存');
      await run();
      return true;
    } catch (error) {
      // 写接口失败由全局 errorHandler 提示；只有保存成功后的刷新失败需要这里补提示。
      if (saved)
        message.error(
          error instanceof Error ? error.message : '性能配置刷新失败',
        );
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="性能汇总" loading={loading}>
      {error ? <p>性能汇总配置暂时读不到</p> : null}
      <ProForm
        form={form}
        submitter={{
          searchConfig: { submitText: '保存性能配置' },
          submitButtonProps: { loading: saving },
        }}
        onFinish={save}
      >
        <ProFormDigit
          name="samplePercent"
          label="抽样比例（%）"
          min={0}
          max={100}
          fieldProps={{ precision: 0 }}
          extra="20 表示大约两成访问会在离开页面时上报。0 表示不上报。"
          rules={[{ required: true, message: '请填写抽样比例' }]}
        />
        <ProFormDigit
          name="hourRetentionDays"
          label="小时数据保留天数"
          min={1}
          max={365}
          fieldProps={{ precision: 0 }}
          extra="超过这个天数的小时记录会删掉。按天汇总的记录留下。"
          rules={[{ required: true, message: '请填写保留天数' }]}
        />
      </ProForm>
    </Card>
  );
};

export default MetricsSettings;
