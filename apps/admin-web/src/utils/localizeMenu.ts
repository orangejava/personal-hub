import type { MenuItem } from '@personal-hub/shared-types';
import { getIntl } from '@umijs/max';

/**
 * 后台侧栏：用 localeKey 查 `menu.*`，没有 key 或没有译文时回退展示名。
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
