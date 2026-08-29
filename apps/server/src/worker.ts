/**
 * Compose `server-worker` 入口。
 *
 * HTTP `server` 只处理请求。Outbox dispatcher 与 BullMQ consumer 约定跑在独立进程，
 * 避免 API 重启拖垮队列消费，也避免 worker 崩溃影响对外接口。
 *
 * 当前仓库还没有这些消费者。本文件只占位，让生产 Compose 服务名可以先落盘。
 * 在真正接入队列之前，不要把本进程当成已经在消费任务。
 */
function keepAlive(): void {
  process.stderr.write(
    '[server-worker] Outbox / BullMQ 消费尚未实现，当前为占位进程。不要对本服务做业务验收。\n',
  );
  setInterval(() => {
    // 保持进程存活，供 Compose 编排；落地消费者后替换为本文件的 bootstrap。
  }, 60_000);
}

keepAlive();
