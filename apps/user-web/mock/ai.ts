import type { Request, Response } from 'express';
import type { AiModel, AiTool } from '@personal-hub/shared-types';
import { adminAiConfigData } from './data/admin-store';
import { ok } from './utils';
import {
  aiAssets,
  aiConversations,
  aiMessages,
  aiQuota,
  aiRecentTasks,
  aiTemplates,
  aiTools,
  batchDeleteAiAssetsPermanently,
  batchMoveAiAssetsToFolder,
  batchMoveAiAssetsToTrash,
  batchRestoreAiAssets,
  consumeAiQuota,
  createAiAsset,
  createAiAssetFolder,
  createAiConversation,
  deleteAiConversation,
  deleteAiAssetPermanently,
  deleteEmptyAiAssetFolder,
  getAiAssetFolders,
  getAiHomeData,
  getAiMembershipData,
  generateAiMedia,
  generateAiText,
  moveAiAssetToFolder,
  moveAiAssetToTrash,
  persistAiChatMessages,
  renameAiAssetFolder,
  restoreAiAsset,
  updateAiConversation,
  updateAiMessageFeedback,
} from './data/ai-store';

function getConfiguredAiTools(): AiTool[] {
  const configMap = new Map(
    adminAiConfigData.tools.map((tool) => [tool.code, tool]),
  );

  return aiTools
    .map((tool) => {
      const config = configMap.get(tool.code);
      if (!config) return { ...tool, sort: Number.MAX_SAFE_INTEGER };

      return {
        ...tool,
        name: config.name || tool.name,
        status: config.status,
        defaultModelId: config.defaultModelId,
        tokenCostLabel: config.tokenCostLabel,
        guestTrialEnabled: config.guestTrialEnabled,
        sort: config.sort,
      };
    })
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort: _sort, ...tool }) => tool);
}

function getVisibleAiModels(): AiModel[] {
  return adminAiConfigData.models
    .filter((model) => model.enabled && model.visibleToUser)
    .map((model) => ({
      id: model.modelId,
      name: model.displayName,
      provider: model.providerName,
      toolTypes: model.toolTypes,
      enabled: model.enabled,
      isDefault: model.isDefault,
      description: `${model.providerName} · ${model.contextTokens.toLocaleString()} tokens`,
    }));
}

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? '');
}

export default {
  'GET /api/ai/home': (_req: Request, res: Response) => {
    ok(res, {
      ...getAiHomeData(),
      tools: getConfiguredAiTools(),
      models: getVisibleAiModels(),
    });
  },
  'GET /api/ai/tools': (_req: Request, res: Response) => {
    ok(res, getConfiguredAiTools());
  },
  'GET /api/ai/models': (_req: Request, res: Response) => {
    ok(res, getVisibleAiModels());
  },
  'GET /api/ai/quota': (_req: Request, res: Response) => {
    ok(res, aiQuota);
  },
  'POST /api/ai/quota/consume': (req: Request, res: Response) => {
    ok(
      res,
      consumeAiQuota({
        tokens: Number(req.body?.tokens ?? 0),
        toolType: req.body?.toolType ?? 'text',
        reason: String(req.body?.reason ?? 'AI mock 消耗'),
      }),
    );
  },
  'GET /api/ai/membership': (_req: Request, res: Response) => {
    ok(res, getAiMembershipData());
  },
  'GET /api/ai/templates': (_req: Request, res: Response) => {
    ok(res, aiTemplates);
  },
  'POST /api/ai/text/generate': (req: Request, res: Response) => {
    ok(
      res,
      generateAiText({
        scenario: req.body?.scenario ?? 'write',
        input: String(req.body?.input ?? ''),
        modelId: String(req.body?.modelId ?? 'qwen-turbo'),
        tone: req.body?.tone ?? 'professional',
        length: req.body?.length ?? 'medium',
        targetLanguage: req.body?.targetLanguage,
      }),
    );
  },
  'POST /api/ai/image/generate': (req: Request, res: Response) => {
    ok(
      res,
      generateAiMedia('image', {
        title: String(req.body?.title ?? ''),
        prompt: String(req.body?.prompt ?? ''),
        modelId: String(req.body?.modelId ?? 'dall-e-3'),
        params: req.body?.params,
        simulateFailure: Boolean(req.body?.simulateFailure),
      }),
    );
  },
  'POST /api/ai/video/generate': (req: Request, res: Response) => {
    ok(
      res,
      generateAiMedia('video', {
        title: String(req.body?.title ?? ''),
        prompt: String(req.body?.prompt ?? ''),
        modelId: String(req.body?.modelId ?? 'video-mock-v1'),
        params: req.body?.params,
        simulateFailure: Boolean(req.body?.simulateFailure),
      }),
    );
  },
  'GET /api/ai/sessions': (_req: Request, res: Response) => {
    ok(res, aiConversations);
  },
  'POST /api/ai/sessions': (req: Request, res: Response) => {
    ok(
      res,
      createAiConversation({
        title: req.body?.title,
        settings: req.body?.settings,
      }),
    );
  },
  'PUT /api/ai/sessions/:id': (req: Request, res: Response) => {
    ok(
      res,
      updateAiConversation(routeParam(req.params.id), {
        title: req.body?.title,
        settings: req.body?.settings,
      }),
    );
  },
  'DELETE /api/ai/sessions/:id': (req: Request, res: Response) => {
    const id = routeParam(req.params.id);
    ok(res, { id, deleted: deleteAiConversation(id) });
  },
  'GET /api/ai/sessions/:id/messages': (req: Request, res: Response) => {
    ok(
      res,
      aiMessages.filter((message) => message.sessionId === req.params.id),
    );
  },
  'POST /api/ai/sessions/:id/messages': (req: Request, res: Response) => {
    ok(
      res,
      persistAiChatMessages(routeParam(req.params.id), {
        messages: Array.isArray(req.body?.messages) ? req.body.messages : [],
        settings: req.body?.settings,
        title: req.body?.title,
      }),
    );
  },
  'PUT /api/ai/messages/:id/feedback': (req: Request, res: Response) => {
    ok(
      res,
      updateAiMessageFeedback(routeParam(req.params.id), {
        feedback: req.body?.feedback,
      }),
    );
  },
  'GET /api/ai/assets': (_req: Request, res: Response) => {
    ok(res, aiAssets);
  },
  'POST /api/ai/assets': (req: Request, res: Response) => {
    ok(res, createAiAsset(req.body));
  },
  'GET /api/ai/asset-folders': (_req: Request, res: Response) => {
    ok(res, getAiAssetFolders());
  },
  'POST /api/ai/asset-folders': (req: Request, res: Response) => {
    ok(res, createAiAssetFolder(String(req.body?.name ?? '新建文件夹')));
  },
  'PUT /api/ai/asset-folders/:id': (req: Request, res: Response) => {
    ok(
      res,
      renameAiAssetFolder(
        routeParam(req.params.id),
        String(req.body?.name ?? ''),
      ),
    );
  },
  'DELETE /api/ai/asset-folders/:id': (req: Request, res: Response) => {
    ok(res, deleteEmptyAiAssetFolder(routeParam(req.params.id)));
  },
  'PATCH /api/ai/assets/:id/trash': (req: Request, res: Response) => {
    ok(res, moveAiAssetToTrash(routeParam(req.params.id)));
  },
  'PATCH /api/ai/assets/:id/restore': (req: Request, res: Response) => {
    ok(res, restoreAiAsset(routeParam(req.params.id)));
  },
  'DELETE /api/ai/assets/:id': (req: Request, res: Response) => {
    const id = routeParam(req.params.id);
    ok(res, { id, deleted: deleteAiAssetPermanently(id) });
  },
  'PATCH /api/ai/assets/:id/folder': (req: Request, res: Response) => {
    const id = routeParam(req.params.id);
    ok(res, moveAiAssetToFolder(id, req.body?.folderId, req.body?.folderName));
  },
  'POST /api/ai/assets/batch-trash': (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    ok(res, { changed: batchMoveAiAssetsToTrash(ids) });
  },
  'POST /api/ai/assets/batch-folder': (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    ok(res, {
      changed: batchMoveAiAssetsToFolder(
        ids,
        req.body?.folderId,
        req.body?.folderName,
      ),
    });
  },
  'POST /api/ai/assets/batch-restore': (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    ok(res, { changed: batchRestoreAiAssets(ids) });
  },
  'POST /api/ai/assets/batch-delete': (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    ok(res, { deleted: batchDeleteAiAssetsPermanently(ids) });
  },
  'GET /api/ai/tasks/recent': (_req: Request, res: Response) => {
    ok(res, aiRecentTasks);
  },
};
