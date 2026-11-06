UPDATE "ai_reward_rules"
SET "label" = '每日登录 / 活跃奖励'
WHERE "code" = 'DAILY_LOGIN'
  AND "label" = '每日首次登录奖励';
