import { App, Button, Form, Input, InputNumber, Space, Switch } from 'antd';
import React, { useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { fetchAdminAiRewardRules, updateAdminAiRewardRule, type AdminAiRewardRule } from '@/services/admin';

const RewardRules: React.FC = () => {
  const { message } = App.useApp();
  const { data, loading, run } = useRequest(fetchAdminAiRewardRules);
  const [saving, setSaving] = useState<string>();

  const save = async (rule: AdminAiRewardRule, values: Omit<AdminAiRewardRule, 'code'>) => {
    setSaving(rule.code);
    try {
      await updateAdminAiRewardRule(rule.code, values);
      await run();
      message.success('奖励规则已保存');
    } catch { /* 服务端错误由全局处理。 */ }
    finally { setSaving(undefined); }
  };

  return <div style={{ display: 'grid', gap: 24, maxWidth: 620, padding: '20px 0' }}>
    {(data ?? []).map((rule) => <div key={`${rule.code}-${rule.amount}-${rule.bonusAmount}-${rule.enabled}`}>
      <h3>{rule.code === 'DAILY_LOGIN' ? '每日登录' : '签到'}</h3>
      <Form layout="vertical" initialValues={rule} onFinish={(values) => save(rule, values)} disabled={loading}>
        <Form.Item name="label" label="文案" rules={[{ required: true }]}><Input maxLength={120} /></Form.Item>
        <Space wrap>
          <Form.Item name="amount" label="每日额度" rules={[{ required: true }]}><InputNumber min={0} max={1000000000} precision={0} /></Form.Item>
          {rule.code === 'CHECKIN' && <>
            <Form.Item name="bonusEvery" label="连续间隔（天）" rules={[{ required: true }]}><InputNumber min={1} max={365} precision={0} /></Form.Item>
            <Form.Item name="bonusAmount" label="额外额度" rules={[{ required: true }]}><InputNumber min={0} max={1000000000} precision={0} /></Form.Item>
          </>}
        </Space>
        <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        <Button type="primary" htmlType="submit" loading={saving === rule.code}>保存规则</Button>
      </Form>
    </div>)}
  </div>;
};

export default RewardRules;
