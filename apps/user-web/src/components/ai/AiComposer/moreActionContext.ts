import React, { useContext } from 'react';

/**
 * 窄屏「更多」里的动作若要打开第二个 Drawer / Modal，必须等外层 Drawer 退出结束后再打开。
 * 子 Drawer 打开时会 push 父级，底部「更多」会被抬到页面中部。
 */
type OpenAfterMoreCloses = (openPanel: () => void) => void;

const openImmediately: OpenAfterMoreCloses = (openPanel) => openPanel();

export const AiComposerMoreActionContext =
  React.createContext<OpenAfterMoreCloses>(openImmediately);

/** 标记动作当前是否渲染在 Composer 的「更多」面板中。 */
export const AiComposerMoreSurfaceContext = React.createContext(false);

export function useOpenAfterComposerMoreCloses(): OpenAfterMoreCloses {
  return useContext(AiComposerMoreActionContext);
}

export function useIsComposerMoreSurface(): boolean {
  return useContext(AiComposerMoreSurfaceContext);
}
