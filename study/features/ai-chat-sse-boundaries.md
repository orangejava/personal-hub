# AI 对话 SSE 边界与故障定位

## 场景背景

AI 厂商的 SSE 是事件流，浏览器收到的网络 chunk 不是事件边界。一次 `read()` 可能包含多个事件，也可能只包含半个 JSON。把 chunk 直接 `JSON.parse` 会出现“接口已返回、页面没有回答”或刷新后状态不一致。

## 调用链

```text
OpenAI-compatible /chat/completions
  -> OpenAiCompatibleTextProvider.stream
  -> AiService.streamChat
  -> STARTED / DELTA / DONE / ERROR
  -> consumeAiSse
  -> useAiChat
```

## 实现要点

1. 发送上游请求时使用 `stream: true`；需要真实 token 时可使用 `stream_options.include_usage`。
2. 接收端保留字符串 buffer，只在 `\n\n` 或 `\r\n\r\n` 事件分隔符处解析；EOF 时先 flush `TextDecoder`，再解析残余帧。
3. `data:` 多行按 SSE 规则用换行拼接后再解析 JSON；`[DONE]` 是上游结束标记，不是普通 JSON。
4. 服务端把消息内容、消息终态和会话活动指针作为核心持久化；额度、usage 等旁路写入失败应告警并补偿，不能覆盖已生成内容。
5. 历史消息返回稳定 `errorCode`，这样刷新页面后仍能区分上游错误、非法 SSE 和终态收尾失败。
6. UI 不要求厂商每个 token 单独发包：前端把 `DELTA` 放入队列，每个浏览器帧只提交有限字符；队列排空后才处理 `DONE/ERROR`。这样既保留网络效率，也避免大段文本一次性触发 React/Markdown 重渲染。

## 常见错误

- 按 TCP/Fetch chunk 渲染，而不是按 SSE 事件渲染。
- 只找第一行 `data:`，忽略多行 data 和 CRLF。
- 忘记 `decoder.decode()` 的 EOF flush，最后一个 DONE 事件会丢失。
- 上游 JSON 解析失败时静默跳过，最终得到空的 DONE 或无法定位的失败。
- 在 usage 或额度写入失败时重新把 assistant 消息设为 `FAILED`，导致历史出现空失败消息。
- 收到一大段文本后直接 `setState(previous + chunk)`，导致 Markdown、代码高亮和滚动区域在单次更新中卡顿。

## 手动验证

1. 在浏览器 Network 中确认聊天响应的 `Content-Type` 为 `text/event-stream`，并能看到 `STARTED`、若干 `DELTA`、`DONE`。
2. 用代理将上游事件拆成半包、合并多事件和 CRLF，确认页面仍按事件增量渲染。
3. 让上游返回错误帧或截断 JSON，确认页面显示失败，刷新历史接口仍返回 `status: failed` 和 `errorCode`。
4. 返回一段很长的 `DELTA`，确认文本持续增长、不会整段瞬间跳出，且完成后全文与历史接口一致。
