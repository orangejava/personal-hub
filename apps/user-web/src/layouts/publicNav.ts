import type { MenuItem } from '@personal-hub/shared-types';

/**
 * 阅读页已经有章节目录或 TocPanel，公共导航再占一列会并排挤爆。
 * 列表 `/content` 不是详情，仍按导航配置走。
 */
export function isPublicReaderPath(pathname: string): boolean {
  if (pathname.includes('/content/booklets/')) return true;
  return /^\/content\/[^/]+\/?$/.test(pathname);
}

/** 关掉 AI 入口时只藏菜单，路由仍保留，避免收藏地址变成 404。 */
export function hideClosedAiMenu(items: MenuItem[], aiEnabled: boolean | undefined): MenuItem[] {
  if (aiEnabled !== false) return items;
  return items
    .filter((item) => !item.path.startsWith('/ai'))
    .map((item) =>
      item.children?.length
        ? { ...item, children: hideClosedAiMenu(item.children, aiEnabled) }
        : item,
    );
}
