import { DownloadOutlined } from '@ant-design/icons';
import React from 'react';

interface PreviewImageInfo {
  image: { url: string };
}

interface PreviewDownload {
  /** 预览地址带不出文件名时由调用方保存，例如 AI 图的 blob 地址没有扩展名。 */
  save?: () => Promise<unknown>;
}

function fileNameFromUrl(url: string) {
  const path = url.split('?')[0] ?? url;
  const name = path.split('/').pop();
  if (!name) return 'image';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/**
 * 同源图用 blob 保存，文件名取 URL 最后一段。
 * 跨域签名图读不到内容时改为新标签打开，避免下载按钮点了没反应。
 */
async function saveImage(url: string) {
  const name = fileNameFromUrl(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('download failed');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = name;
  link.click();
  // 立刻收回临时地址时，部分浏览器还没开始读文件，会存成空文件。
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

/**
 * 大图工具条默认只有翻转、旋转、缩放。下载接在这些按钮后面。
 */
export function renderImagePreviewActions(
  original: React.ReactElement,
  info: PreviewImageInfo,
  download?: PreviewDownload,
) {
  const url = info.image.url;
  const downloadButton = (
    <button
      key="download"
      type="button"
      className="ant-image-preview-actions-action"
      aria-label="下载"
      onClick={(event) => {
        event.stopPropagation();
        const task = download?.save
          ? Promise.resolve(download.save())
          : saveImage(url);
        void task.catch(() => {
          window.open(url, '_blank', 'noopener');
        });
      }}
    >
      <DownloadOutlined />
    </button>
  );
  const node = original as React.ReactElement<{ children?: React.ReactNode }>;
  const children = React.Children.toArray(node.props.children);
  return React.cloneElement(node, undefined, ...children, downloadButton);
}
