#!/usr/bin/env node
/**
 * 本地 OpenAI-compatible stub。不访问外网，用来验证 SSE / 401 / 429。
 *
 *   node apps/server/scripts/openai-compatible-stub.mjs
 *   AI_TEXT_PROVIDER=openai_compatible
 *   AI_OPENAI_BASE_URL=http://127.0.0.1:4010/v1
 *   AI_OPENAI_API_KEY=sk-local-stub
 */
import http from 'node:http';

const port = Number(process.env.AI_STUB_PORT ?? 4010);

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || !req.url?.includes('/chat/completions')) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const auth = req.headers.authorization ?? '';
  if (!auth.includes('sk-local-stub')) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'invalid api key' } }));
    return;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  const parsed = JSON.parse(body || '{}');
  const last = [...(parsed.messages ?? [])].reverse().find((item) => item.role === 'user');
  const topic = String(last?.content ?? 'hello').slice(0, 40);

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
  });
  const chunks = [`收到 stub：${topic}。`, '这是本地 OpenAI 兼容协议的流式增量。'];
  for (const content of chunks) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
  }
  res.write(
    `data: ${JSON.stringify({
      choices: [{ delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 8, completion_tokens: 16 },
    })}\n\n`,
  );
  res.write('data: [DONE]\n\n');
  res.end();
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`openai-compatible stub http://127.0.0.1:${port}/v1/chat/completions\n`);
});
