import { HttpStatus } from '@nestjs/common';
import { MenuScope, MenuType } from '@prisma/client';
import { DomainHttpException } from '../../common/errors/domain-http.exception';
import { CORE_RECOVERY_ROUTE_KEYS, MENU_ROUTE_KEY_SET } from './route-registry';

export function assertInternalRouteKey(type: MenuType, routeKey: string | null | undefined): void {
  if (type !== MenuType.INTERNAL) {
    return;
  }
  if (!routeKey || !MENU_ROUTE_KEY_SET.has(routeKey)) {
    throw new DomainHttpException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'MENU_ROUTE_KEY_UNAVAILABLE',
      '内部菜单只能选择已登记的 routeKey',
    );
  }
}

export function assertExternalUrl(type: MenuType, externalUrl: string | null | undefined): void {
  if (type !== MenuType.EXTERNAL) {
    return;
  }
  if (!externalUrl) {
    throw new DomainHttpException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'MENU_INVALID_EXTERNAL_URL',
      '外链菜单必须提供 URL',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(externalUrl);
  } catch {
    throw new DomainHttpException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'MENU_INVALID_EXTERNAL_URL',
      '外链不是合法 URL',
    );
  }
  const localhost = parsed.protocol === 'http:' && parsed.hostname === 'localhost';
  if (parsed.protocol !== 'https:' && !localhost) {
    throw new DomainHttpException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'MENU_INVALID_EXTERNAL_URL',
      '外链仅允许 https，本地可使用 http://localhost',
    );
  }
}

export function assertNotCoreLocked(routeKey: string | null | undefined, action: string): void {
  if (routeKey && CORE_RECOVERY_ROUTE_KEYS.has(routeKey)) {
    throw new DomainHttpException(
      HttpStatus.CONFLICT,
      'MENU_CORE_PROTECTED',
      `不能${action}后台恢复入口菜单`,
    );
  }
}

export function wouldCreateCycle(
  menuId: string,
  nextParentId: string | null,
  parentById: ReadonlyMap<string, string | null>,
): boolean {
  if (nextParentId === null) {
    return false;
  }
  if (nextParentId === menuId) {
    return true;
  }
  let cursor: string | null = nextParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === menuId || seen.has(cursor)) {
      return true;
    }
    seen.add(cursor);
    cursor = parentById.get(cursor) ?? null;
  }
  return false;
}

export function sameScope(
  parentScope: MenuScope | undefined,
  childScope: MenuScope,
): boolean {
  return parentScope === undefined || parentScope === childScope;
}
