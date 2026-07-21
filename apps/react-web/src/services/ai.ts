import { request } from '@umijs/max';
import type {
  AiAsset,
  AiAssetCreateInput,
  AiAssetFolder,
  AiAssetFolderNameInput,
  AiAssetFolderMutationInput,
  AiChatMessagesPersistInput,
  AiConversation,
  AiConversationCreateInput,
  AiConversationUpdateInput,
  AiHomeData,
  AiMediaGenerateInput,
  AiMediaGenerateResult,
  AiMembershipData,
  AiMessage,
  AiMessageFeedbackInput,
  AiModel,
  AiQuotaConsumeInput,
  AiQuotaSummary,
  AiTemplate,
  AiTextGenerateInput,
  AiTextGenerateResult,
  AiTool,
  ApiResponse,
} from '@personal-hub/shared-types';

/** 获取 AI 工作台首页聚合数据。 */
export async function fetchAiHome() {
  return request<ApiResponse<AiHomeData>>('/api/ai/home');
}

/** 获取 AI 工具配置，后续由后台启停和排序控制。 */
export async function fetchAiTools() {
  return request<ApiResponse<AiTool[]>>('/api/ai/tools');
}

/** 获取当前用户可见模型。 */
export async function fetchAiModels() {
  return request<ApiResponse<AiModel[]>>('/api/ai/models');
}

/** 获取 Token 配额摘要。 */
export async function fetchAiQuota() {
  return request<ApiResponse<AiQuotaSummary>>('/api/ai/quota');
}

/** 消耗 AI Token 配额，阶段 5 用于 mock 扣减和用量联动。 */
export async function consumeAiQuota(data: AiQuotaConsumeInput) {
  return request<
    ApiResponse<{
      quota: AiQuotaSummary;
      consumed: boolean;
      reason?: 'invalidTokens' | 'insufficient';
    }>
  >('/api/ai/quota/consume', {
    method: 'POST',
    data,
  });
}

/** 获取会员中心 mock 数据。 */
export async function fetchAiMembership() {
  return request<ApiResponse<AiMembershipData>>('/api/ai/membership');
}

/** 获取首页推荐模板。 */
export async function fetchAiTemplates() {
  return request<ApiResponse<AiTemplate[]>>('/api/ai/templates');
}

/** 文本生成 mock 契约；阶段 5 返回完整 Markdown，页面可继续做本地流式展示。 */
export async function generateAiText(data: AiTextGenerateInput) {
  return request<ApiResponse<AiTextGenerateResult>>('/api/ai/text/generate', {
    method: 'POST',
    data,
  });
}

/** 图片生成 mock 契约；成功结果由 mock store 统一写入 AI 资产库。 */
export async function generateAiImage(data: AiMediaGenerateInput) {
  return request<ApiResponse<AiMediaGenerateResult>>('/api/ai/image/generate', {
    method: 'POST',
    data,
  });
}

/** 视频生成 mock 契约；成功结果由 mock store 统一写入 AI 资产库。 */
export async function generateAiVideo(data: AiMediaGenerateInput) {
  return request<ApiResponse<AiMediaGenerateResult>>('/api/ai/video/generate', {
    method: 'POST',
    data,
  });
}

/** 获取对话会话列表。 */
export async function fetchAiSessions() {
  return request<ApiResponse<AiConversation[]>>('/api/ai/sessions');
}

/** 新建 AI 对话会话。 */
export async function createAiSession(data: AiConversationCreateInput = {}) {
  return request<ApiResponse<AiConversation>>('/api/ai/sessions', {
    method: 'POST',
    data,
  });
}

/** 更新 AI 对话会话元信息，阶段 5 主要用于重命名和模型记录。 */
export async function updateAiSession(id: string, data: AiConversationUpdateInput) {
  return request<ApiResponse<AiConversation>>(`/api/ai/sessions/${id}`, {
    method: 'PUT',
    data,
  });
}

/** 删除 AI 对话会话，并由 mock store 同步清理消息。 */
export async function deleteAiSession(id: string) {
  return request<ApiResponse<{ id: string; deleted: boolean }>>(
    `/api/ai/sessions/${id}`,
    {
      method: 'DELETE',
    },
  );
}

/** 获取指定会话消息。 */
export async function fetchAiMessages(sessionId: string) {
  return request<ApiResponse<AiMessage[]>>(
    `/api/ai/sessions/${sessionId}/messages`,
  );
}

/** 保存完成的一轮 Chat 消息，停止生成或失败输出不应调用该接口。 */
export async function persistAiChatMessages(
  sessionId: string,
  data: AiChatMessagesPersistInput,
) {
  return request<
    ApiResponse<{
      conversation: AiConversation;
      messages: AiMessage[];
    }>
  >(`/api/ai/sessions/${sessionId}/messages`, {
    method: 'POST',
    data,
  });
}

/** 更新 AI 回复消息反馈；feedback 为空时取消反馈。 */
export async function updateAiMessageFeedback(
  messageId: string,
  data: AiMessageFeedbackInput,
) {
  return request<ApiResponse<AiMessage>>(`/api/ai/messages/${messageId}/feedback`, {
    method: 'PUT',
    data,
  });
}

/** 获取 AI 资产列表。 */
export async function fetchAiAssets() {
  return request<ApiResponse<AiAsset[]>>('/api/ai/assets');
}

/** 保存 AI 生成结果到资产库。 */
export async function createAiAsset(data: AiAssetCreateInput) {
  return request<ApiResponse<AiAsset>>('/api/ai/assets', {
    method: 'POST',
    data,
  });
}

/** 获取 AI 资产项目文件夹列表。 */
export async function fetchAiAssetFolders() {
  return request<ApiResponse<AiAssetFolder[]>>('/api/ai/asset-folders');
}

/** 新建 AI 资产项目文件夹。 */
export async function createAiAssetFolder(data: AiAssetFolderNameInput) {
  return request<ApiResponse<AiAssetFolder>>('/api/ai/asset-folders', {
    method: 'POST',
    data,
  });
}

/** 重命名 AI 资产项目文件夹。 */
export async function renameAiAssetFolder(
  id: string,
  data: AiAssetFolderNameInput,
) {
  return request<ApiResponse<AiAssetFolder>>(`/api/ai/asset-folders/${id}`, {
    method: 'PUT',
    data,
  });
}

/** 删除空 AI 资产项目文件夹。 */
export async function deleteAiAssetFolder(id: string) {
  return request<
    ApiResponse<{
      folderId: string;
      deleted: boolean;
      reason?: 'notFound' | 'notEmpty';
    }>
  >(`/api/ai/asset-folders/${id}`, {
    method: 'DELETE',
  });
}

/** 将 AI 资产移入回收站。 */
export async function trashAiAsset(id: string) {
  return request<ApiResponse<AiAsset>>(`/api/ai/assets/${id}/trash`, {
    method: 'PATCH',
  });
}

/** 从回收站恢复 AI 资产。 */
export async function restoreAiAsset(id: string) {
  return request<ApiResponse<AiAsset>>(`/api/ai/assets/${id}/restore`, {
    method: 'PATCH',
  });
}

/** 永久删除 AI 资产。 */
export async function deleteAiAsset(id: string) {
  return request<ApiResponse<{ id: string; deleted: boolean }>>(`/api/ai/assets/${id}`, {
    method: 'DELETE',
  });
}

/** 移动单个 AI 资产到项目文件夹。 */
export async function moveAiAssetToFolder(
  id: string,
  data: AiAssetFolderMutationInput,
) {
  return request<ApiResponse<AiAsset>>(`/api/ai/assets/${id}/folder`, {
    method: 'PATCH',
    data,
  });
}

/** 批量移入回收站。 */
export async function batchTrashAiAssets(ids: string[]) {
  return request<ApiResponse<{ changed: string[] }>>('/api/ai/assets/batch-trash', {
    method: 'POST',
    data: { ids },
  });
}

/** 批量移动到项目文件夹。 */
export async function batchMoveAiAssetsToFolder(
  ids: string[],
  data: AiAssetFolderMutationInput,
) {
  return request<ApiResponse<{ changed: string[] }>>('/api/ai/assets/batch-folder', {
    method: 'POST',
    data: { ids, ...data },
  });
}

/** 批量恢复 AI 资产。 */
export async function batchRestoreAiAssets(ids: string[]) {
  return request<ApiResponse<{ changed: string[] }>>('/api/ai/assets/batch-restore', {
    method: 'POST',
    data: { ids },
  });
}

/** 批量永久删除 AI 资产。 */
export async function batchDeleteAiAssets(ids: string[]) {
  return request<ApiResponse<{ deleted: string[] }>>('/api/ai/assets/batch-delete', {
    method: 'POST',
    data: { ids },
  });
}
