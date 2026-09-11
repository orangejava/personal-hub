import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateAiText } from '@/services/ai';

export type AiTextScenarioKey =
  | 'write'
  | 'rewrite'
  | 'summary'
  | 'expand'
  | 'translate'
  | 'custom';

export interface AiTextDraft {
  scenario: AiTextScenarioKey;
  input: string;
  modelId: string;
  tone: string;
  length: 'short' | 'medium' | 'long';
  targetLanguage: string;
}

interface UseAiTextGenerationMockOptions {
  onComplete?: (
    draft: AiTextDraft,
    output: string,
    estimatedTokens: number,
  ) => void;
}

const scenarioHints: Record<AiTextScenarioKey, string> = {
  write: '适合从主题、关键词或零散想法生成文章结构。',
  rewrite: '适合保留原意并调整表达、语气和可读性。',
  summary: '适合把长文本压缩成重点清单。',
  expand: '适合把提纲扩展成更完整的段落。',
  translate: '适合中英文互译和多语言改写。',
  custom: '适合直接输入你自己的完整指令。',
};

/**
 * 文本生成 mock 状态流。
 *
 * 阶段 5 已收敛到 `/api/ai/text/generate` mock 契约，前端仍把完整返回文本
 * 拆成片段播放，以保留停止、复制、重新生成等交互体验。
 */
export function useAiTextGenerationMock(options: UseAiTextGenerationMockOptions = {}) {
  const { onComplete } = options;
  const [draft, setDraft] = useState<AiTextDraft>({
    scenario: 'write',
    input: '',
    modelId: 'qwen-turbo',
    tone: 'professional',
    length: 'medium',
    targetLanguage: '英文',
  });
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSubmittedDraft, setLastSubmittedDraft] = useState<AiTextDraft>();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const outputRef = useRef('');

  const scenarioHint = scenarioHints[draft.scenario];
  const canGenerate = draft.input.trim().length > 0 && !isGenerating;

  const tokenEstimate = useMemo(() => {
    const lengthRatio = draft.length === 'short' ? 1.1 : draft.length === 'long' ? 2.1 : 1.5;
    return Math.max(180, Math.ceil(draft.input.length * lengthRatio + 160));
  }, [draft.input.length, draft.length]);

  const abortLocal = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = undefined;
  }, []);

  const updateDraft = useCallback((patch: Partial<AiTextDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const startStream = useCallback(
    async (submittedDraft: AiTextDraft) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setOutput('');
      outputRef.current = '';
      setIsGenerating(true);
      setLastSubmittedDraft(submittedDraft);
      try {
        const response = await generateAiText(submittedDraft, controller.signal);
        outputRef.current = response.output ?? '';
        setOutput(response.output ?? '');
        onComplete?.(submittedDraft, outputRef.current, response.estimatedTokens ?? tokenEstimate);
      } catch (error) {
        const failed = error instanceof Error ? error.message : '文本生成失败，请稍后重试。';
        outputRef.current = failed;
        setOutput(failed);
      } finally {
        setIsGenerating(false);
      }
    },
    [onComplete, tokenEstimate],
  );

  const generate = useCallback(() => {
    const normalizedInput = draft.input.trim();
    if (!normalizedInput || isGenerating) return;
    void startStream({ ...draft, input: normalizedInput });
  }, [draft, isGenerating, startStream]);

  const regenerate = useCallback(() => {
    if (isGenerating) return;
    void startStream(lastSubmittedDraft ?? { ...draft, input: draft.input.trim() });
  }, [draft, isGenerating, lastSubmittedDraft, startStream]);

  const stop = useCallback(() => {
    if (!isGenerating) return;
    abortLocal();
    setOutput((current) => {
      const stoppedOutput = `${current}\n\n（已停止生成）`;
      outputRef.current = stoppedOutput;
      return stoppedOutput;
    });
    setIsGenerating(false);
  }, [abortLocal, isGenerating]);

  useEffect(() => () => abortLocal(), [abortLocal]);

  return {
    draft,
    output,
    isGenerating,
    canGenerate,
    scenarioHint,
    tokenEstimate,
    hasOutput: output.trim().length > 0,
    lastSubmittedDraft,
    updateDraft,
    generate,
    regenerate,
    stop,
  };
}
