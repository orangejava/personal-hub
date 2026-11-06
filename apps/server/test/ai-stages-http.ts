import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { encryptCredentialForRequest } from '../../../packages/api-client/src/ai-credential-transport';

const origin = process.env.AI_TEST_ORIGIN ?? 'http://localhost:3002';
const base = `${origin}/api/v1`;

async function call<T>(path: string, options: {
  method?: string; token?: string; body?: unknown; key?: string; cookie?: string;
} = {}): Promise<{ status: number; data: T; cookie?: string }> {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      origin: 'http://localhost:8010',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.key ? { 'Idempotency-Key': options.key } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();
  return { status: response.status, data: body.data ?? body.error ?? body, cookie: response.headers.get('set-cookie') ?? undefined };
}

async function login(email: string) {
  const response = await call<{ accessToken: string; user: { id: string } }>('/auth/login', {
    method: 'POST', body: { email, password: 'HubDev!234' },
  });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  return { token: response.data.accessToken, id: response.data.user.id, cookie: response.cookie };
}

async function main() {
  const owner = await login('owner@example.com');
  const member = await login('member@example.com');
  const editor = await login('editor@example.com');
  const state = await call<{ credentials: unknown[]; allowed: boolean }>('/app/ai/credentials', { token: member.token });
  assert.equal(state.status, 200);
  assert.equal(state.data.allowed, true);
  const key = await call<{ keyId: string; publicKey: string }>('/app/ai/credential-key', { token: member.token });
  assert.equal(key.status, 200);
  const encryptedApiKey = await encryptCredentialForRequest('test-only-key', key.data);
  const code = `test-${randomUUID().slice(0, 8)}`;
  const invalid = await call('/app/ai/credentials', { method: 'PUT', token: member.token, key: randomUUID(),
    body: { code, label: 'Test', baseUrl: 'https://localhost/v1', encryptedApiKey } });
  assert.equal(invalid.status, 400);
  const created = await call<{ id: string }>('/app/ai/credentials', { method: 'PUT', token: member.token, key: randomUUID(),
    body: { code, label: 'Test', baseUrl: 'https://example.com/v1', encryptedApiKey } });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const models = await call<{ id: string }>('/app/ai/user-models', { method: 'POST', token: member.token, key: randomUUID(),
    body: { credentialId: created.data.id, modelKey: 'test-model', displayName: 'Test Model' } });
  assert.equal(models.status, 201, JSON.stringify(models.data));
  const own = await call<{ credentials: Array<Record<string, unknown>> }>('/app/ai/credentials', { token: member.token });
  assert.equal(own.data.credentials.some((row) => row.id === created.data.id), true);
  assert.equal(JSON.stringify(own.data).includes('test-only-key'), false);
  const other = await call<{ credentials: Array<{ id: string }> }>('/app/ai/credentials', { token: editor.token });
  assert.equal(other.data.credentials.some((row) => row.id === created.data.id), false);
  const otherModel = await call('/app/ai/user-models', { token: editor.token });
  assert.equal(JSON.stringify(otherModel.data).includes(models.data.id), false);
  const enabled = await call('/app/ai/provider-preferences', { method: 'PUT', token: member.token, key: randomUUID(),
    body: { enabled: true, preferredUserModelId: models.data.id } });
  assert.equal(enabled.status, 200);
  const visible = await call<Array<{ id: string; source?: string }>>('/app/ai/models', { token: member.token });
  assert.equal(visible.data.some((row) => row.id === models.data.id && row.source === 'USER'), true);
  const stat = await call('/admin/ai/stats?range=24h', { token: owner.token });
  assert.equal(stat.status, 200);
  const accountBefore = await call<{ availableAmount: number }> (`/admin/ai/quota-accounts/${member.id}`, { token: owner.token });
  assert.equal(accountBefore.status, 200);
  const adjustmentKey = randomUUID();
  const adjustBody = { userId: member.id, direction: 'CREDIT', amount: 17, reason: '验收', idempotencyKey: adjustmentKey };
  const first = await call('/admin/ai/quota-adjustments', { method: 'POST', token: owner.token, key: randomUUID(), body: adjustBody });
  const replay = await call('/admin/ai/quota-adjustments', { method: 'POST', token: owner.token, key: randomUUID(), body: adjustBody });
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  const accountAfter = await call<{ availableAmount: number }> (`/admin/ai/quota-accounts/${member.id}`, { token: owner.token });
  assert.equal(accountAfter.data.availableAmount - accountBefore.data.availableAmount, 17);
  const overdraw = await call('/admin/ai/quota-adjustments', { method: 'POST', token: owner.token, key: randomUUID(),
    body: { ...adjustBody, direction: 'DEBIT', amount: 1000000000, idempotencyKey: randomUUID() } });
  assert.equal(overdraw.status, 409);
  const repeatLogin = await login('member@example.com');
  const afterLogin = await call<{ availableAmount: number }> (`/admin/ai/quota-accounts/${member.id}`, { token: owner.token });
  assert.equal(afterLogin.data.availableAmount, accountAfter.data.availableAmount);
  const calendar = await call<{ today: string; records: unknown[] }>('/app/ai/checkin', { token: repeatLogin.token });
  assert.equal(calendar.status, 200);
  const checkin = await call<{ claimed: boolean; amount: number }>('/app/ai/checkin', { method: 'POST', token: repeatLogin.token, key: randomUUID() });
  assert.equal(checkin.data.claimed, true);
  assert.equal(checkin.data.amount, 100);
  const again = await call<{ claimed: boolean }>('/app/ai/checkin', { method: 'POST', token: repeatLogin.token, key: randomUUID() });
  assert.equal(again.data.claimed, false);
  const afterCheckin = await call<{ availableAmount: number }> (`/admin/ai/quota-accounts/${member.id}`, { token: owner.token });
  assert.equal(afterCheckin.data.availableAmount - afterLogin.data.availableAmount, 100);
  const rules = await call<Array<{ code: string; amount: number }>>('/admin/ai/reward-rules', { token: owner.token });
  assert.equal(rules.status, 200);
  assert.equal(rules.data.find((row) => row.code === 'CHECKIN')?.amount, 100);
  const deleted = await call('/app/ai/credentials/' + created.data.id, { method: 'DELETE', token: member.token, key: randomUUID() });
  assert.equal(deleted.status, 200);
  console.log('B: 加密写入、用户隔离、模式和自建模型通过');
  console.log('C: 统计、调整幂等与超额拒绝通过');
  console.log('D: 同日重复登录未重复发放');
  console.log('E: 当日签到、重复提交和独立发放通过');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
