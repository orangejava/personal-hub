/**
 * 会话列表展示用摘要。完整 User-Agent 与精确 IP 不返回给客户端。
 */

export function summarizeUserAgent(userAgent: string | null): {
  deviceName: string;
  browser: string;
} {
  if (!userAgent) {
    return { deviceName: '未知设备', browser: '未知浏览器' };
  }

  let deviceName = '电脑';
  if (/iPhone/i.test(userAgent)) {
    deviceName = 'iPhone';
  } else if (/iPad/i.test(userAgent)) {
    deviceName = 'iPad';
  } else if (/Android/i.test(userAgent)) {
    deviceName = 'Android';
  } else if (/Mac OS X|Macintosh/i.test(userAgent)) {
    deviceName = 'Mac';
  } else if (/Windows/i.test(userAgent)) {
    deviceName = 'Windows';
  } else if (/Linux/i.test(userAgent)) {
    deviceName = 'Linux';
  }

  let browser = '浏览器';
  if (/Edg\//i.test(userAgent)) {
    browser = 'Edge';
  } else if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) {
    browser = 'Chrome';
  } else if (/Safari\//i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    browser = 'Safari';
  } else if (/Firefox\//i.test(userAgent)) {
    browser = 'Firefox';
  }

  return { deviceName, browser };
}

/** IPv4 只保留前三段；IPv6 只保留前三段。 */
export function maskIp(ip: string): string {
  const v4 = ip.replace(/^::ffff:/i, '');
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(v4)) {
    const [a, b, c] = v4.split('.');
    return `${a}.${b}.${c}.0`;
  }
  if (v4.includes(':')) {
    const parts = v4.split(':').filter((part) => part.length > 0);
    if (parts.length === 0) {
      return '未知';
    }
    return `${parts.slice(0, 3).join(':')}:*`;
  }
  return '未知';
}

export function formatDeviceLabel(userAgent: string | null): string {
  const summary = summarizeUserAgent(userAgent);
  return `${summary.deviceName} · ${summary.browser}`;
}
