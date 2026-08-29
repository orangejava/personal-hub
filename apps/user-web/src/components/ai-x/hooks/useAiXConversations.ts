import { useXConversations } from '@ant-design/x-sdk';

/**
 * Ant Design X 会话状态 hook 的本地入口。
 *
 * 业务页面通过该 hook 管理会话列表，后续接入服务端会话 CRUD 时可以在
 * 本地封装层统一适配 key、标题、排序和错误回滚策略。
 */
const useAiXConversations: typeof useXConversations = (config) =>
  useXConversations(config);

export default useAiXConversations;

