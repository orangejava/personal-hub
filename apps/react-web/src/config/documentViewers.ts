/**
 * 文档预览组件库选型（阶段 4+ 接入）
 * 富文本按产品文档约定使用 Textbus，本文件仅记录 PDF / Word 方向。
 */

/** PDF 在线预览：react-pdf（基于 PDF.js） */
export const PDF_VIEWER_STACK = {
  library: 'react-pdf',
  package: 'react-pdf',
  repository: 'https://github.com/wojtekmaj/react-pdf',
  reason: 'GitHub 高星（15k+）、持续维护、React 生态最常用 PDF 渲染方案',
} as const;

/** PDF 备选：react-pdf-viewer（插件化查看器） */
export const PDF_VIEWER_ALT = {
  library: '@react-pdf-viewer/core',
  package: '@react-pdf-viewer/core',
  repository: 'https://github.com/react-pdf-viewer/react-pdf-viewer',
  reason: '插件化工具栏/缩略图/搜索，适合复杂阅读器 UI',
} as const;

/** Word（.docx）预览：docx-preview */
export const WORD_VIEWER_STACK = {
  library: 'docx-preview',
  package: 'docx-preview',
  repository: 'https://github.com/VolodymyrBaydalka/docx-preview',
  reason: '纯前端将 docx 渲染为 HTML，轻量、活跃维护、无需服务端转换',
} as const;

/** 富文本编辑/阅读：Textbus（产品已定） */
export const RICH_TEXT_STACK = {
  library: 'textbus',
  site: 'https://textbus.io/',
  reason: '内容系统文档约定；支持文档编辑与协作扩展',
} as const;
