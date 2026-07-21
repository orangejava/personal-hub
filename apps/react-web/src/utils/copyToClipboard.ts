import { message } from 'antd';

/**
 * 复制文本到剪贴板，成功/失败时给出统一提示
 * @returns 是否复制成功
 */
export async function copyToClipboard(text: string, successTip = '已复制'): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    message.success(successTip);
    return true;
  } catch {
    message.error('复制失败');
    return false;
  }
}
