import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateAiText, stopAiMessage } from '@/services/ai';

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

interface UseAiTextGenerationOptions {
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

function estimateTokens(inputLength: number, length: AiTextDraft['length']) {
  const lengthRatio = length === 'short' ? 1.1 : length === 'long' ? 2.1 : 1.5;
  return Math.max(180, Math.ceil(inputLength * lengthRatio + 160));
}

/**
 * 文本生成状态流。发送走 Canonical SSE；停止调用显式 stop 接口。
 */
export function useAiTextGeneration(options: UseAiTextGenerationOptions = {}) {
  const { onComplete } = options;
  const [draft, setDraft] = useState<AiTextDraft>({
    scenario: 'write',
    input: '',
    // 模型由页面加载后的真实可用模型列表决定，不能写死一个可能已删除的 ID。
    modelId: '',
    tone: 'professional',
    length: 'medium',
    targetLanguage: '英文',
  });
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSubmittedDraft, setLastSubmittedDraft] = useState<AiTextDraft>();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const outputRef = useRef('');
  const assistantMessageIdRef = useRef<string | undefined>(undefined);

  const scenarioHint = scenarioHints[draft.scenario];
  const canGenerate = draft.input.trim().length > 0 && !isGenerating;

  const tokenEstimate = useMemo(() => {
    return estimateTokens(draft.input.length, draft.length);
  }, [draft.input.length, draft.length]);
  const regenerateTokenEstimate = lastSubmittedDraft
    ? estimateTokens(lastSubmittedDraft.input.length, lastSubmittedDraft.length)
    : tokenEstimate;

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
      assistantMessageIdRef.current = undefined;
      setIsGenerating(true);
      setLastSubmittedDraft(submittedDraft);
      try {
        const response = await generateAiText(
          submittedDraft,
          controller.signal,
          (event) => {
            if (event.type === 'STARTED' && event.assistantMessageId) {
              assistantMessageIdRef.current = event.assistantMessageId;
            }
            if (event.type === 'DELTA' && event.content) {
              outputRef.current += event.content;
              setOutput(outputRef.current);
            }
          },
        );
        outputRef.current = response.output ?? outputRef.current;
        setOutput(outputRef.current);
        onComplete?.(submittedDraft, outputRef.current, response.estimatedTokens ?? tokenEstimate);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
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
    // 复用上次生成的输入与参数，但模型采用页面当前选择，确保额度提示与真实请求一致。
    const submittedDraft = lastSubmittedDraft ?? { ...draft, input: draft.input.trim() };
    if (!submittedDraft.input || !draft.modelId) return;
    void startStream({ ...submittedDraft, modelId: draft.modelId });
  }, [draft, isGenerating, lastSubmittedDraft, startStream]);

  const stop = useCallback(() => {
    if (!isGenerating) return;
    const messageId = assistantMessageIdRef.current;
    abortLocal();
    if (messageId) {
      void stopAiMessage(messageId);
    }
    setOutput((current) => {
      const stoppedOutput = current ? `${current}\n\n（已停止生成）` : '已停止生成';
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
    regenerateTokenEstimate,
    hasOutput: output.trim().length > 0,
    lastSubmittedDraft,
    updateDraft,
    generate,
    regenerate,
    stop,
  };
}
