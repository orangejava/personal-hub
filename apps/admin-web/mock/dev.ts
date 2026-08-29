/**
 * 开发辅助 mock：图床代理等
 */
import type { Request, Response } from 'express';
import { fail } from './utils';

const ALLOWED_HOSTS = /byteimg\.com|juejin\.cn|bytedance\.com/i;

export default {
  /** 为 Markdown 外链图片补 Referer，解决掘金图床在浏览器直连 403 */
  'GET /api/dev/proxy-image': async (req: Request, res: Response) => {
    const raw = String(req.query.url || '');
    if (!raw.startsWith('http')) {
      fail(res, 400, '无效图片地址');
      return;
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      fail(res, 400, '无效图片地址');
      return;
    }
    if (!ALLOWED_HOSTS.test(url.hostname)) {
      fail(res, 403, '不允许代理该域名');
      return;
    }
    try {
      const upstream = await fetch(url.toString(), {
        headers: {
          Referer: 'https://juejin.cn/',
          'User-Agent': 'Mozilla/5.0 (compatible; PersonalHub/1.0)',
        },
      });
      if (!upstream.ok) {
        fail(res, upstream.status, '图床返回错误');
        return;
      }
      const buffer = Buffer.from(await upstream.arrayBuffer());
      const contentType = upstream.headers.get('content-type') || 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch {
      fail(res, 502, '图片代理失败');
    }
  },
};
