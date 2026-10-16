// https://umijs.org/config/

import { join } from 'node:path';
import { resolvePublicPath } from '@personal-hub/app-origins';
import { defineConfig } from '@umijs/max';
import defaultSettings from './defaultSettings';
import proxy from './proxy';
import routes from './routes';

const { UMI_ENV = 'dev' } = process.env;

const PUBLIC_PATH: string = resolvePublicPath(process.env.PUBLIC_PATH);

export default defineConfig({
  alias: {
    '@root': join(__dirname, '..'),
  },
  hash: true,
  esbuildMinifyIIFE: true,
  publicPath: PUBLIC_PATH,
  // /__motion 只给开发环境验收动效组件。生产构建不注册，也不进公开菜单。
  routes:
    process.env.NODE_ENV === 'production'
      ? routes
      : [
          ...routes,
          { path: '/__motion', layout: false, component: './dev/MotionLab' },
        ],
  ignoreMomentLocale: true,
  proxy: proxy[UMI_ENV as keyof typeof proxy],
  fastRefresh: true,
  routePrefetch: {},
  manifest: {},
  // Umi 数据流
  model: {},
  initialState: {},
  title: 'Personal Hub',
  layout: {
    locale: true,
    ...defaultSettings,
  },
  moment2dayjs: {
    preset: 'antd',
    plugins: ['duration', 'relativeTime'],
  },
  locale: {
    // 只加载 src/locales 下的 zh-CN / en-US；其它语言在 src/locales-frozen
    // 英文页面没有做完。没在地球图标里手动选过语言时固定中文，不跟浏览器语言。
    default: 'zh-CN',
    antd: true,
    baseNavigator: false,
  },
  antd: {
    appConfig: {},
    configProvider: {
      variant: 'filled',
      theme: {
        token: {
          fontFamily: 'AlibabaSans, sans-serif',
        },
      },
    },
  },
  request: {},
  reactQuery: {},
  access: {},
  // 不要 async：脚本必须在页面包之前执行，才能按站点配置画出首屏，而不是被 React 清掉。
  headScripts: [{ src: join(PUBLIC_PATH, 'scripts/loading.js') }],
  tailwindcss: {},
  mock: {
    // 仅 `pnpm dev:mock` 会加载；`MOCK=none`（默认 `dev`）和生产 `max build` 都不跑 mock 中间件
    // Umi 默认已加载 mock/*.ts；再 include mock/** 会重复注册同一路由
    exclude: ['mock/utils.ts', 'mock/data/**'],
  },
  exportStatic: {},
  define: {
    'process.env.UMI_APP_NEST_AUTH': process.env.UMI_APP_NEST_AUTH ?? '1',
    'process.env.UMI_APP_USER_WEB_ORIGIN':
      process.env.UMI_APP_USER_WEB_ORIGIN ?? 'http://localhost:8000',
    'process.env.UMI_APP_ADMIN_WEB_ORIGIN':
      process.env.UMI_APP_ADMIN_WEB_ORIGIN ?? 'http://localhost:8001',
    'process.env.COMMIT_HASH': process.env.COMMIT_HASH || '',
    __APP_VERSION__: require('./../package.json').version,
    __UMI_VERSION__: require('@umijs/max/package.json').version,
  },
});
