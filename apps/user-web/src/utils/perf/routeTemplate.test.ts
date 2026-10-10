import { describe, expect, it } from 'vitest';
import { matchPageTemplate, toApiRouteTemplate } from './routeTemplate';

describe('matchPageTemplate', () => {
  it('prefers the booklet template over content detail', () => {
    expect(matchPageTemplate('/content/booklets/abc/chapters/def')).toBe(
      '/content/booklets/:id/chapters/:chapterId',
    );
    expect(matchPageTemplate('/content/6f1c9c3e-1b2a-4d5e-8f90-123456789abc')).toBe(
      '/content/:id',
    );
  });

  it('keeps the home page and ignores unknown routes', () => {
    expect(matchPageTemplate('/')).toBe('/');
    expect(matchPageTemplate('/ai/chat')).toBe('/ai/chat');
    expect(matchPageTemplate('/ai/image')).toBeNull();
  });
});

describe('toApiRouteTemplate', () => {
  it('drops query strings and replaces uuid or numeric ids', () => {
    expect(
      toApiRouteTemplate(
        '/api/v1/content/6f1c9c3e-1b2a-4d5e-8f90-123456789abc?raw=1',
      ),
    ).toBe('/api/v1/content/:id');
    expect(toApiRouteTemplate('https://example.com/api/v1/files/42')).toBe(
      '/api/v1/files/:id',
    );
  });
});
