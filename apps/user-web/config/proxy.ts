/**
 * @name 代理的配置
 * @see 在生产环境 代理是无法生效的，所以这里没有生产环境的配置
 * @doc https://umijs.org/docs/guides/proxy
 */
import { forwardBrowserOriginOnProxyReq } from '@personal-hub/app-origins';

export default {
  /**
   * 开发期把 Canonical Nest API 代理到 `apps/server`。
   * 浏览器只访问本前端 Origin，Refresh Cookie 才能同源。
   */
  dev: {
    '/api/v1': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      onProxyReq: forwardBrowserOriginOnProxyReq,
    },
  },
  test: {
    '/api/': {
      target: 'https://pro-api.ant-design-demo.workers.dev',
      changeOrigin: true,
    },
  },
  pre: {
    '/api/': {
      target: 'your pre url',
      changeOrigin: true,
    },
  },
};
