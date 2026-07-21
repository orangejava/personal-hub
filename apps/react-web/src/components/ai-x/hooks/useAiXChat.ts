import { useXChat } from '@ant-design/x-sdk';

/**
 * Ant Design X Chat hook 的本地入口。
 *
 * 阶段 5 先做透传，后续真实 SSE、统一错误提示、Token 不足拦截和埋点
 * 都应在这个入口上扩展，而不是散落在页面里。
 */
const useAiXChat: typeof useXChat = (config) => useXChat(config);

export default useAiXChat;

