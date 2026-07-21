import { XStream } from '@ant-design/x-sdk';

/**
 * Ant Design X Stream 解析能力的本地入口。
 *
 * 用于把后端 SSE / fetch readable stream 转成前端可消费的增量数据，
 * 后续可在这里统一适配不同 AI 厂商的 event/data 格式。
 */
const useAiXStream: typeof XStream = (options) => XStream(options);

export default useAiXStream;

