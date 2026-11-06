import { describe, expect, it } from 'vitest';
import {
  isPublicIpv4,
  isPublicIpv6,
  parseUserProviderUrl,
  userProviderFetch,
} from '../src/modules/ai/user-provider-fetch';

describe('user provider outbound address policy', () => {
  it('rejects private, loopback and special purpose IPv4 addresses', () => {
    for (const address of [
      '0.0.0.1',
      '10.0.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '192.0.0.1',
      '192.0.2.1',
      '192.88.99.1',
      '198.18.0.1',
      '203.0.113.1',
    ]) {
      expect(isPublicIpv4(address), address).toBe(false);
    }
  });

  it('rejects IPv4-mapped IPv6 private addresses while allowing a public mapping', () => {
    expect(isPublicIpv6('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicIpv6('::ffff:10.0.0.1')).toBe(false);
    expect(isPublicIpv6('::ffff:8.8.8.8')).toBe(true);
  });

  it('checks the IPv4 embedded in NAT64 and 6to4 addresses', () => {
    for (const address of ['64:ff9b::7f00:1', '64:ff9b::a00:1', '2002:7f00:1::', '2002:a00:1::']) {
      expect(isPublicIpv6(address), address).toBe(false);
    }
    expect(isPublicIpv6('64:ff9b::808:808')).toBe(true);
    expect(isPublicIpv6('2002:808:808::')).toBe(true);
  });

  it('checks the inverted IPv4 embedded in Teredo addresses', () => {
    expect(isPublicIpv6('2001:0:1234:5678:ffff:ffff:80ff:fffe')).toBe(false);
    expect(isPublicIpv6('2001:0:1234:5678:ffff:ffff:f7f7:f7f7')).toBe(true);
  });

  it('rejects bracketed IPv6 and IPv4 literals before opening an outbound connection', async () => {
    for (const address of ['https://[::1]:44444/v1', 'https://127.0.0.1:44444/v1']) {
      expect(() => parseUserProviderUrl(address)).toThrow('自备厂商须使用公网 HTTPS 域名');
      await expect(
        userProviderFetch(`${address}/models`, {
          method: 'GET',
          headers: {},
          signal: AbortSignal.timeout(500),
        }),
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(parseUserProviderUrl('https://api.example.com/v1').hostname).toBe('api.example.com');
  });
});
