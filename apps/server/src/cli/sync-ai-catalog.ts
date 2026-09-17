import { PrismaClient } from '@prisma/client';
import { seedAiCatalog } from '../../prisma/seed-ai';

/**
 * 把生产 AI 目录与当前环境变量同步，而不运行会写样例内容的完整 seed。
 *
 * 已存在的角色权益及后台运营配置保持不变；仅切换受控文本模型及其关联。
 */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedAiCatalog(prisma, {
      resetEntitlements: false,
      grantMissingQuota: false,
      preserveOperationalConfig: true,
    });
    console.info('AI 目录已与当前文本 Provider 配置同步。');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('AI 目录同步失败。', error);
    process.exitCode = 1;
  });
}
