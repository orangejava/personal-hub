/**
 * 统一邮箱大小写策略：只接受已去除首尾空白后的有效邮箱，并以小写值写入受保护数据库列。
 */
export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new Error('邮箱格式无效或长度超过 320。');
  }
  return email;
}

export function tryNormalizeEmail(value: string): string | null {
  try {
    return normalizeEmail(value);
  } catch {
    return null;
  }
}
