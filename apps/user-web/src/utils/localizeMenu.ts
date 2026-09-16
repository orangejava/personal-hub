import { getIntl } from '@umijs/max';
import type { MenuItem } from '@personal-hub/shared-types';

/**
 * 工作区 / 后台：用 localeKey 查 `menu.*`，没有 key 或没有译文时回退展示名。
 * 公开顶栏不要走这里，直接渲染 `name`。
 */
export function localizeMenu(menu: MenuItem[] | undefined): MenuItem[] {
  if (!menu?.length) return [];
  const intl = getIntl();
  return menu.map((m) => {
    const localeId = m.localeKey ?? m.name;
    const id = `menu.${localeId}`;
    // 没有译文时直接用展示名，避免 React Intl 对每个菜单项刷 Missing message。
    const name =
      Object.hasOwn(intl.messages, id) && intl.messages[id]
        ? intl.formatMessage({ id, defaultMessage: m.name })
        : m.name;
    return {
      ...m,
      name,
      children: m.children ? localizeMenu(m.children) : undefined,
    };
  }) as MenuItem[];
}
