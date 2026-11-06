CREATE TABLE ai_reward_rules (
  code VARCHAR(40) PRIMARY KEY,
  amount INTEGER NOT NULL,
  bonus_every INTEGER NOT NULL DEFAULT 0,
  bonus_amount INTEGER NOT NULL DEFAULT 0,
  label VARCHAR(120) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
INSERT INTO ai_reward_rules (code, amount, bonus_every, bonus_amount, label)
VALUES ('DAILY_LOGIN', 100, 0, 0, '每日首次登录奖励'),
       ('CHECKIN', 100, 7, 500, '每日签到奖励');

CREATE TABLE ai_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_date VARCHAR(10) NOT NULL,
  streak INTEGER NOT NULL,
  base_amount INTEGER NOT NULL,
  bonus_amount INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT ai_checkins_user_date_key UNIQUE (user_id, local_date)
);
CREATE INDEX ai_checkins_user_date_idx ON ai_checkins(user_id, local_date);
