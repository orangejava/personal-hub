import { newIdempotencyKey } from '@personal-hub/api-client';
import { App, Button, Form, Input, InputNumber, Radio, Select, Space, Statistic } from 'antd';
import React, { useRef, useState } from 'react';
import { adjustAdminAiQuota, fetchAdminAiQuotaAccount, fetchAdminUsers } from '@/services/admin';
import type { AdminUserRecord } from '@personal-hub/shared-types';

type Values = { userId: string; direction: 'CREDIT' | 'DEBIT'; amount: number; reason: string };

const QuotaAdjustments: React.FC = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [account, setAccount] = useState<{ availableAmount: number; reservedAmount: number }>();
  const [loading, setLoading] = useState(false);
  const pendingAdjustment = useRef<{ fingerprint: string; key: string } | null>(null);
  const searchSequence = useRef(0);
  const accountSequence = useRef(0);
  const [userOptions, setUserOptions] = useState<AdminUserRecord[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const searchUsers = async (keyword: string) => {
    const sequence = ++searchSequence.current;
    if (!keyword.trim()) { setUserOptions([]); setSearchingUsers(false); return; }
    setUserOptions([]);
    setSearchingUsers(true);
    try {
      const result = await fetchAdminUsers({ keyword, pageSize: 20 });
      if (sequence === searchSequence.current) setUserOptions(result.list ?? []);
    } catch {
      // 请求层展示服务端错误；下拉保持空结果，避免旧搜索结果误选用户。
      if (sequence === searchSequence.current) setUserOptions([]);
    } finally {
      if (sequence === searchSequence.current) setSearchingUsers(false);
    }
  };

  const loadAccount = async () => {
    const userId = form.getFieldValue('userId');
    if (!userId) { message.warning('先搜索并选择用户'); return; }
    const sequence = ++accountSequence.current;
    try {
      const result = await fetchAdminAiQuotaAccount(userId);
      if (sequence === accountSequence.current && form.getFieldValue('userId') === userId) {
        setAccount(result);
      }
    } catch {
      if (sequence === accountSequence.current && form.getFieldValue('userId') === userId) {
        setAccount(undefined);
      }
    }
  };

  const submit = async (values: Values) => {
    // 提交前令余额查询失效；切换用户或旧查询返回时都不能覆盖本次结果。
    const sequence = ++accountSequence.current;
    const fingerprint = JSON.stringify(values);
    // 相同参数的网络重试复用键；任何字段改变都代表一笔新的调整。
    if (pendingAdjustment.current?.fingerprint !== fingerprint) {
      pendingAdjustment.current = { fingerprint, key: newIdempotencyKey() };
    }
    setLoading(true);
    try {
      const result = await adjustAdminAiQuota({
        ...values,
        idempotencyKey: pendingAdjustment.current.key,
      });
      if (sequence === accountSequence.current && form.getFieldValue('userId') === values.userId) {
        setAccount(result);
        form.setFieldsValue({ amount: undefined, reason: '' });
      }
      pendingAdjustment.current = null;
      message.success('额度已调整');
    } catch {
      // 保留当前幂等键，网络重试不会重复调整。
    } finally { setLoading(false); }
  };

  return <div style={{ maxWidth: 560, padding: '20px 0' }}>
    <Form form={form} layout="vertical" initialValues={{ direction: 'CREDIT' }} onFinish={submit} disabled={loading}>
      <Form.Item name="userId" label="用户" rules={[{ required: true }]}>
        <Select
          showSearch
          filterOption={false}
          loading={searchingUsers}
          placeholder="按邮箱或昵称搜索用户"
          options={userOptions.map((user) => ({
            value: user.id,
            label: `${user.nickname ?? '未设置昵称'} · ${user.email}`,
          }))}
          onSearch={searchUsers}
          onChange={() => { accountSequence.current += 1; setAccount(undefined); }}
          notFoundContent="输入邮箱或昵称搜索"
        />
      </Form.Item>
      <Button onClick={loadAccount} disabled={loading}>查询余额</Button>
      {account && <Space size="large" style={{ display: 'flex', margin: '16px 0' }}>
        <Statistic title="可用额度" value={account.availableAmount} />
        <Statistic title="预占额度" value={account.reservedAmount} />
      </Space>}
      <Form.Item name="direction" label="调整方向" rules={[{ required: true }]} style={{ marginTop: 16 }}>
        <Radio.Group options={[{ label: '增加', value: 'CREDIT' }, { label: '扣减', value: 'DEBIT' }]} optionType="button" />
      </Form.Item>
      <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
        <InputNumber min={1} max={1000000000} precision={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="reason" label="原因" rules={[{ required: true }]}>
        <Input.TextArea maxLength={300} showCount />
      </Form.Item>
      <Button htmlType="submit" type="primary" loading={loading}>确认调整</Button>
    </Form>
  </div>;
};

export default QuotaAdjustments;
