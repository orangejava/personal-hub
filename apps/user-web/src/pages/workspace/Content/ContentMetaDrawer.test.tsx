import {
  type ContentAccessGrantList,
  type ContentDetail,
  ContentStatus,
  ContentType,
  ContentVisibility,
} from '@personal-hub/shared-types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAppContent,
  fetchContentAccessGrants,
  updateContent,
} from '@/services/workspace';
import ContentMetaDrawer, { toAccessGrantFormState } from './ContentMetaDrawer';

vi.mock('@umijs/max', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      values?.emails ? `${id}: ${values.emails}` : id,
  }),
}));

vi.mock('@/hooks/useRequest', () => ({
  useRequest: () => ({
    data: {
      categories: [{ slug: 'frontend', name: 'Frontend', count: 0 }],
      tags: [],
    },
  }),
}));

vi.mock('@/services/auth', () => ({
  nestError: (error: unknown) =>
    error instanceof Error ? error : new Error(String(error)),
}));

vi.mock('@/services/content', () => ({ fetchContentMeta: vi.fn() }));

vi.mock('@/services/workspace', () => ({
  fetchAppContent: vi.fn(),
  fetchContentAccessGrants: vi.fn(),
  replaceContentAccessGrants: vi.fn(),
  updateContent: vi.fn(),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function detail(id: string, title: string): ContentDetail {
  return {
    id,
    title,
    type: ContentType.Markdown,
    categorySlug: 'frontend',
    summary: `${title} summary`,
    viewCount: 0,
    favoriteCount: 0,
    publishedAt: '2026-09-26T00:00:00.000Z',
    author: 'Editor',
    status: ContentStatus.Published,
    visibility: ContentVisibility.Private,
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z',
    importRestriction: 'NONE',
  };
}

function renderDrawer(contentId: string, onClose = vi.fn()) {
  const view = render(
    <App>
      <ContentMetaDrawer contentId={contentId} open onClose={onClose} />
    </App>,
  );
  return {
    ...view,
    rerenderWithId(nextContentId: string) {
      view.rerender(
        <App>
          <ContentMetaDrawer contentId={nextContentId} open onClose={onClose} />
        </App>,
      );
    },
  };
}

describe('ContentMetaDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('切换内容后立即清空旧值，并在新内容加载完成前禁止保存', async () => {
    const nextDetail = deferred<ReturnType<typeof detail>>();
    const nextGrants = deferred<ContentAccessGrantList>();
    vi.mocked(fetchAppContent).mockImplementation((id) =>
      id === 'content-a'
        ? Promise.resolve(detail(id, '内容 A'))
        : nextDetail.promise,
    );
    vi.mocked(fetchContentAccessGrants).mockImplementation((id) =>
      id === 'content-a'
        ? Promise.resolve({
            list: [
              {
                userId: 'reader-a',
                email: 'reader-a@example.com',
                nickname: 'Reader A',
                createdAt: '2026-09-26T00:00:00.000Z',
              },
            ],
            ignoredEmails: [],
          })
        : nextGrants.promise,
    );

    const view = renderDrawer('content-a');
    expect(await screen.findByDisplayValue('内容 A')).toBeTruthy();

    view.rerenderWithId('content-b');

    const saveButton = screen.getByRole('button', {
      name: /workspace\.contentMeta\.save/,
    });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByDisplayValue('内容 A')).toBeNull();
    fireEvent.click(saveButton);
    expect(updateContent).not.toHaveBeenCalled();

    nextDetail.resolve(detail('content-b', '内容 B'));
    nextGrants.resolve({ list: [], ignoredEmails: [] });

    expect(await screen.findByDisplayValue('内容 B')).toBeTruthy();
    await waitFor(() =>
      expect((saveButton as HTMLButtonElement).disabled).toBe(false),
    );
    expect(fetchAppContent).toHaveBeenLastCalledWith('content-b', {
      skipErrorHandler: true,
    });
    expect(fetchContentAccessGrants).toHaveBeenLastCalledWith('content-b', {
      skipErrorHandler: true,
    });
  });

  it('新内容加载失败后仍禁止保存', async () => {
    vi.mocked(fetchAppContent).mockRejectedValue(new Error('load failed'));
    vi.mocked(fetchContentAccessGrants).mockResolvedValue({
      list: [],
      ignoredEmails: [],
    });

    renderDrawer('content-failed');

    expect((await screen.findAllByText('load failed')).length).toBeGreaterThan(
      0,
    );
    const saveButton = screen.getByRole('button', {
      name: /workspace\.contentMeta\.save/,
    });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(saveButton);
    expect(updateContent).not.toHaveBeenCalled();
  });

  it('授权名单加载失败时仍回填基础信息，只提示一次并禁止保存', async () => {
    const messageError = vi.fn();
    vi.spyOn(App, 'useApp').mockReturnValue({
      message: { error: messageError },
    } as never);
    vi.mocked(fetchAppContent).mockResolvedValue(
      detail('content-grants-failed', '授权失败仍可见'),
    );
    vi.mocked(fetchContentAccessGrants).mockRejectedValue(
      new Error('grants failed'),
    );

    renderDrawer('content-grants-failed');

    expect(await screen.findByDisplayValue('授权失败仍可见')).toBeTruthy();
    await waitFor(() => expect(messageError).toHaveBeenCalledTimes(1));
    expect(messageError).toHaveBeenCalledWith('grants failed');

    const titleInput = screen.getByDisplayValue('授权失败仍可见');
    expect((titleInput as HTMLInputElement).disabled).toBe(false);
    expect(
      (
        screen.getByRole('button', {
          name: /workspace\.contentMeta\.save/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    const accessModeControl = screen
      .getByText('workspace.contentMeta.onlyMe')
      .closest('.ant-segmented');
    expect(
      accessModeControl?.classList.contains('ant-segmented-disabled'),
    ).toBe(true);
  });

  it('详情和授权名单都失败时仍只提示一次', async () => {
    const messageError = vi.fn();
    vi.spyOn(App, 'useApp').mockReturnValue({
      message: { error: messageError },
    } as never);
    vi.mocked(fetchAppContent).mockRejectedValue(new Error('detail failed'));
    vi.mocked(fetchContentAccessGrants).mockRejectedValue(
      new Error('grants failed'),
    );

    renderDrawer('content-all-failed');

    await waitFor(() => expect(messageError).toHaveBeenCalledTimes(1));
    expect(messageError).toHaveBeenCalledWith('detail failed');
  });

  it('按服务端最终名单回填，并保留被忽略的作者邮箱用于当次提示', () => {
    expect(
      toAccessGrantFormState({
        list: [],
        ignoredEmails: ['editor@example.com'],
      }),
    ).toEqual({
      privateAccessMode: 'only_me',
      grantEmails: [],
      ignoredEmails: ['editor@example.com'],
    });
  });
});
