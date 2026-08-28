/**
 * @name 代理的配置
 * @see 在生产环境 代理是无法生效的，所以这里没有生产环境的配置
 * -------------------------------
 * The agent cannot take effect in the production environment
 * so there is no configuration of the production environment
 * For details, please see
 * https://pro.ant.design/docs/deploy
 *
 * @doc https://umijs.org/docs/guides/proxy
 */
export default {
  /**
   * 开发期把 Canonical Nest API 代理到 `apps/server`。
   * 浏览器只访问 localhost:8000，Refresh Cookie 才能和前端同源。
   *
   * changeOrigin 只改 Host，便于打到 :3001；必须把浏览器的 Origin / Referer
   * 原样转给 Nest。否则 Cookie 鉴权会看到 `http://127.0.0.1:3001`，
   * 和 CORS_ORIGIN=`http://localhost:8000` 对不上，logout/refresh 会 403。
   * 浏览器 Network 里 Origin 仍是 localhost:8000，容易误判成前端切了源。
   */
  dev: {
    '/api/v1': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true,
      onProxyReq(
        proxyReq: { setHeader: (name: string, value: string) => void },
        req: { headers: { origin?: string | string[]; referer?: string | string[] } },
      ) {
        const origin = req.headers.origin;
        const originValue = Array.isArray(origin) ? origin[0] : origin;
        if (originValue) {
          proxyReq.setHeader('origin', originValue);
        }
        const referer = req.headers.referer;
        const refererValue = Array.isArray(referer) ? referer[0] : referer;
        if (refererValue) {
          proxyReq.setHeader('referer', refererValue);
        }
      },
    },
  },
  // 如果需要自定义本地开发服务器  请取消注释按需调整
  // dev: {
  //   // localhost:8000/api/** -> https://preview.pro.ant.design/api/**
  //   '/api/': {
  //     // 要代理的地址
  //     target: 'https://preview.pro.ant.design',
  //     // 配置了这个可以从 http 代理到 https
  //     // 依赖 origin 的功能可能需要这个，比如 cookie
  //     changeOrigin: true,
  //   },
  // },
  /**
   * @name 详细的代理配置
   * @doc https://github.com/chimurai/http-proxy-middleware
   */
  test: {
    // localhost:8000/api/** -> https://pro-api.ant-design-demo.workers.dev/api/**
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
