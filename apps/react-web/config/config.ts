// https://umijs.org/config/

import { join } from 'node:path';
import { defineConfig } from '@umijs/max';
import defaultSettings from './defaultSettings';
import proxy from './proxy';
import routes from './routes';

const { UMI_ENV = 'dev' } = process.env;

const PUBLIC_PATH: string = '/';

export default defineConfig({
  alias: {
    '@root': join(__dirname, '..'),
  },
  hash: true,
  esbuildMinifyIIFE: true,
  publicPath: PUBLIC_PATH,
  routes,
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
    default: 'zh-CN',
    antd: true,
    baseNavigator: true,
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
  headScripts: [{ src: join(PUBLIC_PATH, 'scripts/loading.js'), async: true }],
  tailwindcss: {},
  mock: {
    include: ['mock/**/*.ts', 'src/pages/**/_mock.ts'],
    exclude: ['mock/utils.ts', 'mock/data/**'],
  },
  exportStatic: {},
  define: {
    'process.env.UMI_APP_NEST_AUTH': process.env.UMI_APP_NEST_AUTH ?? '1',
    'process.env.COMMIT_HASH': process.env.COMMIT_HASH || '',
    __APP_VERSION__: require('./../package.json').version,
    __UMI_VERSION__: require('@umijs/max/package.json').version,
    __UTOO_VERSION__: require('@utoo/pack/package.json').version,
  },
});
