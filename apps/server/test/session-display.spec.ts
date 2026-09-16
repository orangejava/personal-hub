import { describe, expect, it } from 'vitest';
import { formatDeviceLabel, maskIp, summarizeUserAgent } from '../src/modules/auth/session-display';

describe('session-display', () => {
  it('从 User-Agent 提取设备和浏览器', () => {
    expect(
      summarizeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toEqual({ deviceName: 'Mac', browser: 'Chrome' });
    expect(formatDeviceLabel(null)).toBe('未知设备 · 未知浏览器');
  });

  it('脱敏 IPv4 与 IPv6', () => {
    expect(maskIp('127.0.0.1')).toBe('127.0.0.0');
    expect(maskIp('::ffff:192.168.1.20')).toBe('192.168.1.0');
    expect(maskIp('2001:db8:85a3::8a2e:370:7334')).toBe('2001:db8:85a3:*');
  });
});
