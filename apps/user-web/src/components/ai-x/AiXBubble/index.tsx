import { Bubble, type BubbleProps } from '@ant-design/x';
import type { BubbleContentType } from '@ant-design/x/es/bubble/interface';
import type { AiMessage } from '@personal-hub/shared-types';
import { Tag } from 'antd';
import React from 'react';
import AiXMarkdown from '../AiXMarkdown';
import AiXThink from '../AiXThink';
import AiXThoughtChain from '../AiXThoughtChain';

interface AiXBubbleProps<ContentType extends BubbleContentType>
  extends BubbleProps<ContentType> {
  message?: AiMessage;
}

function renderAssistantMessage(message: AiMessage) {
  const parts = message.parts ?? [];
  const reasoningParts = parts.filter((part) => part.type === 'reasoning');
  const thoughtParts = parts.filter((part) => part.type === 'thought_chain');
  const contentParts = parts.filter((part) => part.type === 'content');
  const sourceParts = parts.filter((part) => part.type === 'source');
  const markdownContent =
    contentParts.map((part) => part.content).join('') || message.content;

  return (
    <div className="ph-ai-chat-bubble-content">
      {(reasoningParts.length > 0 || thoughtParts.length > 0) && (
        <div className="ph-ai-chat-thoughts">
          {reasoningParts.map((part) => (
            <AiXThink
              content={part.content}
              key={part.id}
              title={part.title ?? '思考过程'}
            />
          ))}
          {thoughtParts.length > 0 && (
            <AiXThoughtChain
              items={thoughtParts.map((part) => ({
                key: part.id,
                title: part.title ?? part.content,
                description: part.title ? part.content : undefined,
                status:
                  part.status === 'processing'
                    ? 'loading'
                    : part.status === 'pending'
                      ? 'loading'
                      : part.status,
              }))}
            />
          )}
        </div>
      )}
      <AiXMarkdown>{markdownContent}</AiXMarkdown>
      {sourceParts.length > 0 && (
        <div className="ph-ai-chat-source-list">
          {sourceParts.map((part) => (
            <Tag color="blue" key={part.id}>
              {part.title ?? part.content}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}

/** AI 消息气泡封装，统一承载 Markdown、思考过程和来源展示。 */
const AiXBubble = ({
  message,
  content,
  ...props
}: AiXBubbleProps<BubbleContentType>) => (
  <Bubble
    {...props}
    content={
      message?.role === 'assistant'
        ? renderAssistantMessage(message)
        : content
    }
  />
);

export default AiXBubble;
