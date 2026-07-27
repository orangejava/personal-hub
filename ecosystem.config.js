/**
 * 阶段 A：个人远程阅读（PM2 标准配置文件名）。
 *
 * - 启动前自动 sync:booklets，生成 local-booklets.generated.ts
 * - CONTENT_LOCAL_DIR 指向服务器小册目录（默认 /data/personal-hub/content-local）
 * - 必须使用 Umi dev 以保留 mock；接入 NestJS 后改用生产配置
 *
 * 用法（仓库根）：pm2 start ecosystem.config.js --only personal-hub-dev
 * 详见 docs/deploy/pm2-deployment.md
 */
module.exports = {
  apps: [
    {
      name: 'personal-hub-dev',
      cwd: __dirname,
      script: 'scripts/pm2-start-dev.sh',
      interpreter: 'bash',
      env: {
        NODE_ENV: 'development',
        UMI_ENV: 'dev',
        HOST: '0.0.0.0',
        PORT: '8000',
        CONTENT_LOCAL_DIR: '/data/personal-hub/content-local',
      },
      max_memory_restart: '1500M',
    },
  ],
};
