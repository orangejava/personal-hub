import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    passWithNoTests: false,
    // 必须在加载 AppModule 前就是 test，ConfigModule 才不会读 .env.local
    env: {
      NODE_ENV: 'test',
    },
  },
});
