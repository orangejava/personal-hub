import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { App, Badge, Button, Calendar, Card, DatePicker, Space, Statistic, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { getAiCheckinStatus, shanghaiCheckinMonth } from '@/components/ai/checkinStatus';
import { useRequest } from '@/hooks/useRequest';
import { claimAiCheckin, fetchAiCheckin } from '@/services/ai';

const CheckinCalendar: React.FC<{ onClaimed?: () => void | Promise<void> }> = ({ onClaimed }) => {
  const { message } = App.useApp();
  const [month, setMonth] = useState(shanghaiCheckinMonth);
  const [claiming, setClaiming] = useState(false);
  const { data, error, loading, run } = useRequest(() => fetchAiCheckin(month), { refreshDeps: [month] });
  const checkinStatus = getAiCheckinStatus(data, error);
  const currentMonth = dayjs(`${month}-01`);

  const moveMonth = (delta: number) => {
    setMonth(currentMonth.add(delta, 'month').format('YYYY-MM'));
  };

  const claim = async () => {
    setClaiming(true);
    try {
      const result = await claimAiCheckin();
      message[result.claimed ? 'success' : 'info'](
        result.claimed ? `已领取 ${result.amount} 额度` : '今天已经签到',
      );
      // 页面跨上海零点未刷新时，成功签到后应切到新月份展示刚领取的记录。
      const claimedMonth = result.date.slice(0, 7);
      if (claimedMonth === month) await run();
      else setMonth(claimedMonth);
      await onClaimed?.();
    } catch {
      /* 全局错误提示。 */
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Card
      title="每日签到"
      loading={loading && !data}
      style={{ marginTop: 24 }}
      extra={
        <Space wrap>
          <Statistic title="连续天数" value={data?.streak ?? 0} suffix="天" />
          <Button
            type="primary"
            disabled={checkinStatus !== 'unclaimed'}
            loading={claiming}
            onClick={claim}
          >
            {checkinStatus === 'claimed' ? '今日已领' : checkinStatus === 'unclaimed' ? '签到领取' : checkinStatus === 'disabled' ? '暂未开放' : checkinStatus === 'error' ? '加载失败' : '加载中'}
          </Button>
        </Space>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Button aria-label="上个月" icon={<LeftOutlined />} onClick={() => moveMonth(-1)} />
        <DatePicker
          picker="month"
          allowClear={false}
          value={currentMonth}
          format="YYYY年MM月"
          onChange={(date) => date && setMonth(date.format('YYYY-MM'))}
        />
        <Button aria-label="下个月" icon={<RightOutlined />} onClick={() => moveMonth(1)} />
        <Button onClick={() => setMonth(shanghaiCheckinMonth())}>回到本月</Button>
      </Space>
      <Calendar
        fullscreen={false}
        value={currentMonth}
        onPanelChange={(date) => {
          const nextMonth = date.format('YYYY-MM');
          if (nextMonth !== month) setMonth(nextMonth);
        }}
        cellRender={(date, info) => {
          if (info.type !== 'date') return null;
          const record = data?.records.find((row) => row.date === date.format('YYYY-MM-DD'));
          return record ? (
            <Badge status="success" text={record.bonusAmount ? `+${record.totalAmount}` : '已领'} />
          ) : null;
        }}
      />
      {checkinStatus === 'disabled' && <Typography.Text type="secondary">签到暂未开放</Typography.Text>}
    </Card>
  );
};

export default CheckinCalendar;
