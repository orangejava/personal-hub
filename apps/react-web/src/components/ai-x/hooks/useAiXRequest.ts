import { XRequest } from '@ant-design/x-sdk';

/**
 * Ant Design X 请求对象的本地入口。
 *
 * 当前保持与 XRequest 一致，后续接真实后端时可统一注入鉴权头、
 * 请求超时、错误码转换和 stream 取消逻辑。
 */
const useAiXRequest: typeof XRequest = (baseURL, options) =>
  XRequest(baseURL, options);

export default useAiXRequest;

