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
    return {
      ...m,
      name: intl.formatMessage({
        id: `menu.${localeId}`,
        defaultMessage: m.name,
      }),
      children: m.children ? localizeMenu(m.children) : undefined,
    };
  }) as MenuItem[];
}
