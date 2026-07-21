import { Suggestion, type SuggestionProps } from '@ant-design/x';
import React from 'react';

/**
 * AI 输入建议封装。
 *
 * 用于 Prompt 补全、模板变量和工具命令建议，业务层只负责提供候选项，
 * 样式和键盘交互统一从本地封装层收口。
 */
const AiXSuggestion = <T,>(props: SuggestionProps<T>) => (
  <Suggestion<T> {...props} />
);

export default AiXSuggestion;

