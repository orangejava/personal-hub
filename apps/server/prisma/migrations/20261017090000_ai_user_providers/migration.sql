ALTER TABLE ai_provider_credentials
  ADD COLUMN code VARCHAR(80),
  ADD COLUMN label VARCHAR(120);

CREATE UNIQUE INDEX ai_provider_credentials_user_code_key
  ON ai_provider_credentials(user_id, code)
  WHERE owner_type = 'USER' AND code IS NOT NULL;
DROP INDEX ai_provider_credentials_user_base_url_key;

CREATE TABLE ai_provider_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  preferred_user_model_id UUID,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE TABLE ai_user_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id UUID REFERENCES ai_provider_credentials(id) ON DELETE SET NULL,
  model_key VARCHAR(120) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT ai_user_models_credential_model_key UNIQUE (credential_id, model_key)
);
CREATE INDEX ai_user_models_user_enabled_idx ON ai_user_models(user_id, enabled);

ALTER TABLE ai_conversations
  ALTER COLUMN model_id DROP NOT NULL,
  ADD COLUMN user_model_id UUID REFERENCES ai_user_models(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ai_conversations_one_model CHECK ((model_id IS NULL) <> (user_model_id IS NULL));
ALTER TABLE ai_messages
  ADD COLUMN user_model_id UUID REFERENCES ai_user_models(id) ON DELETE SET NULL;
ALTER TABLE ai_usage_records
  ADD COLUMN user_model_id UUID REFERENCES ai_user_models(id) ON DELETE SET NULL,
  ADD COLUMN estimated_platform_cost INTEGER;

UPDATE ai_usage_records SET estimated_platform_cost = platform_cost;
