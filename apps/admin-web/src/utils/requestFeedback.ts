type ErrorReporter = (content: string) => void;

let reporter: ErrorReporter | undefined;
const pendingErrors: string[] = [];

/** 请求可能早于 React 根组件挂载；暂存错误并在 App 消息实例就绪后展示。 */
export function reportRequestError(content: string) {
  if (reporter) {
    reporter(content);
    return;
  }
  if (pendingErrors.length < 5) pendingErrors.push(content);
}

export function setRequestErrorReporter(next: ErrorReporter | undefined) {
  reporter = next;
  if (next) {
    pendingErrors.splice(0).forEach(next);
  }
}
