import type { MenuItem } from '@personal-hub/shared-types';
import { getIntl } from '@umijs/max';

/**
 * 将 mock 菜单的 name（locale id）转成当前语言文案
 * name 字段约定为 `workspace.dashboard` 等形式，对应 `menu.workspace.dashboard`
 */
export function localizeMenu(menu: MenuItem[] | undefined): MenuItem[] {
  if (!menu?.length) return [];
  const intl = getIntl();
  return menu.map((m) => ({
    ...m,
    name: intl.formatMessage({
      id: `menu.${m.name}`,
      defaultMessage: m.name,
    }),
    children: m.children ? localizeMenu(m.children) : undefined,
  })) as MenuItem[];
}
