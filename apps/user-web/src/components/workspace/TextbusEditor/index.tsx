import '@textbus/editor/bundles/textbus.min.css';
import { createEditor } from '@textbus/editor';
import type { Editor } from '@textbus/editor/bundles/editor';
import React, { useEffect, useImperativeHandle, useRef } from 'react';

export type TextbusEditorHandle = {
  getHTML: () => string;
};

type TextbusEditorProps = {
  /** 初始 HTML */
  initialHtml?: string;
  /** 只读模式 */
  readonly?: boolean;
  minHeight?: string;
};

/**
 * Textbus 富文本封装。读写必须走官方 getHTML / createEditor，禁止改 DOM textContent，否则编辑器状态会和画面脱节。
 */
const TextbusEditor = React.forwardRef<TextbusEditorHandle, TextbusEditorProps>(
  ({ initialHtml = '', readonly = false, minHeight = '480px' }, ref) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);

    useImperativeHandle(ref, () => ({
      getHTML: () => editorRef.current?.getHTML() ?? '',
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const editor = createEditor({
        content: initialHtml || undefined,
        placeholder: '开始编写富文本内容…',
        minHeight,
      });

      editorRef.current = editor;
      void editor.mount(host).then(() => {
        editor.readonly = readonly;
      });

      return () => {
        editor.destroy();
        editorRef.current = null;
      };
    }, [initialHtml, minHeight, readonly]);

    return <div ref={hostRef} className="ph-textbus-editor" />;
  },
);

TextbusEditor.displayName = 'TextbusEditor';

export default TextbusEditor;
