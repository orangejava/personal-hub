import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    passWithNoTests: false,
    // HTTP 用例各自起 Testcontainers；并行会抢 Docker 端口探测窗口。
    fileParallelism: false,
    // 必须在加载 AppModule 前就是 test，ConfigModule 才不会读 .env.local
    env: {
      NODE_ENV: 'test',
    },
  },
});
