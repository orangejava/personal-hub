import { HttpStatus } from '@nestjs/common';
import { AiToolCode, type AiModel, type Prisma } from '@prisma/client';
import { DomainHttpException } from '../../common/errors/domain-http.exception';

/** 新增、编辑都校验合并后的配置，避免只检查旧值或 PATCH 中某一个字段。 */
export function validateModelConfig(model: {
  modelKey: string;
  displayName: string;
  enabled: boolean;
  toolTypes: AiToolCode[];
  contextWindowTokens: number;
  maxOutputTokens: number;
  inputPricePer1k: number;
  outputPricePer1k: number;
  fixedPlatformCost: number | null;
}) {
  const invalid = (message: string): never => {
    throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_MODEL_INVALID', message);
  };
  if (!model.modelKey?.trim() || !model.displayName?.trim()) invalid('模型标识和名称不能为空');
  if (!model.toolTypes?.length) invalid('至少选择一种支持工具');
  for (const value of [model.contextWindowTokens, model.maxOutputTokens]) {
    if (!Number.isInteger(value) || value < 1 || value > 2_147_483_647)
      invalid('Token 限制必须是正整数');
  }
  for (const value of [
    model.inputPricePer1k,
    model.outputPricePer1k,
    ...(model.fixedPlatformCost == null ? [] : [model.fixedPlatformCost]),
  ]) {
    if (!Number.isInteger(value) || value < 0 || value > 2_147_483_647)
      invalid('平台消耗必须是非负整数');
  }
  if (
    model.enabled &&
    model.inputPricePer1k === 0 &&
    model.outputPricePer1k === 0 &&
    model.fixedPlatformCost == null
  ) {
    invalid('缺少定价的模型不能启用');
  }
}

/** 配置写入共用事务锁；多个管理员同时设置默认模型时也只保留每个工具的一条指向。 */
export async function lockModelConfig(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('personal-hub/ai-model-config'))::text`;
}

/** 默认关系以工具行的 defaultModelId 为准，不再用模型上的单一布尔值表达多个工具。 */
export async function updateModelDefaults(
  tx: Prisma.TransactionClient,
  model: Pick<AiModel, 'id' | 'enabled' | 'userVisible' | 'toolTypes' | 'deprecatedAt'>,
  requested?: AiToolCode[],
) {
  const usable = model.enabled && model.userVisible && model.deprecatedAt === null;
  if (
    requested?.some((tool) => !model.toolTypes.includes(tool)) ||
    (requested?.length && !usable)
  ) {
    throw new DomainHttpException(
      HttpStatus.BAD_REQUEST,
      'AI_MODEL_INVALID',
      '默认模型必须可用，且支持对应工具',
    );
  }
  // 未显式更改默认范围时，仅移除停用/隐藏或取消支持的工具关系。
  const keep = usable ? (requested ?? model.toolTypes) : [];
  await tx.aiTool.updateMany({
    where: { defaultModelId: model.id, code: { notIn: keep } },
    data: { defaultModelId: null },
  });
  if (requested?.length) {
    const providerEnabled = await tx.aiModel.count({
      where: { id: model.id, provider: { enabled: true } },
    });
    if (!providerEnabled) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        'AI_MODEL_INVALID',
        '停用厂商的模型不能设为默认',
      );
    }
    const count = await tx.aiTool.count({ where: { code: { in: requested } } });
    if (count !== new Set(requested).size) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, 'AI_MODEL_INVALID', '对应工具尚未配置');
    }
    await tx.aiTool.updateMany({
      where: { code: { in: requested } },
      data: { defaultModelId: model.id },
    });
  }
  // 旧字段只作为兼容摘要；读接口和默认选择均以工具关系为准。
  await tx.aiModel.updateMany({
    where: { defaultForTools: { none: {} } },
    data: { isDefault: false },
  });
  await tx.aiModel.updateMany({
    where: { defaultForTools: { some: {} } },
    data: { isDefault: true },
  });
}
