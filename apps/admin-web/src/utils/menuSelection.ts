import type { MenuItem } from '@personal-hub/shared-types';

/** 收集菜单树中所有可点击 path */
function flattenMenuPaths(items: MenuItem[]): string[] {
  const paths: string[] = [];
  for (const item of items) {
    if (item.path) paths.push(item.path);
    if (item.children?.length) paths.push(...flattenMenuPaths(item.children));
  }
  return paths;
}

/**
 * 解析当前路由应对应高亮的菜单项 path
 * - 优先精确匹配
 * - 动态子路由（如 /workspace/markdown/:id）取最长前缀匹配
 */
export function resolveMenuSelectedKey(
  pathname: string,
  menu: MenuItem[],
): string {
  const paths = flattenMenuPaths(menu);
  if (paths.includes(pathname)) return pathname;

  const prefixMatch = paths
    .filter((p) => pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];

  return prefixMatch ?? pathname;
}
