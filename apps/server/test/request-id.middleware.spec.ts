import { describe, expect, it } from 'vitest';
import { assignRequestId } from '../src/common/middleware/request-id.middleware';

describe('assignRequestId', () => {
  it('always creates a server-side UUID and exposes it in the response header', () => {
    const request = {} as Parameters<typeof assignRequestId>[0];
    const headers: Record<string, string> = {};
    let nextCalled = false;

    assignRequestId(
      request,
      {
        setHeader(name: string, value: string): void {
          headers[name] = value;
        },
      } as Parameters<typeof assignRequestId>[1],
      () => {
        nextCalled = true;
      },
    );

    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(headers['X-Request-Id']).toBe(request.requestId);
    expect(nextCalled).toBe(true);
  });
});
