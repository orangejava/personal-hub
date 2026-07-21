/**
 * 阶段 A：个人远程阅读 — PM2 用 dev 启动（非 build）
 * 用法：pm2 start ecosystem.dev.cjs
 */
module.exports = {
  apps: [
    {
      name: 'personal-hub-dev',
      cwd: __dirname,
      script: 'pnpm',
      args: '--filter react-web dev -- --host 0.0.0.0',
      env: {
        NODE_ENV: 'development',
        UMI_ENV: 'dev',
      },
      max_memory_restart: '1500M',
    },
  ],
};
