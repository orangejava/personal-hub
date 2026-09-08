import { PrismaClient, RoleCode, UserStatus } from '@prisma/client';
import { normalizeEmail } from '../modules/auth/email';
import { assertPasswordPolicy, hashPassword } from '../modules/auth/password';
import { seedContentTaxonomy, seedSampleContents } from '../../prisma/seed-content';

/**
 * 仅本地开发使用的固定登录账号，权威记录见 docs/engineering/dev-credentials.md。
 * 不要把这组密码用于生产 bootstrap。
 */
export const LOCAL_DEV_PASSWORD = 'HubDev!234';

export const LOCAL_DEV_USERS = [
  {
    email: 'owner@example.com',
    role: RoleCode.SUPER_ADMIN,
    nickname: '系统所有者',
  },
  {
    email: 'editor@example.com',
    role: RoleCode.EDITOR,
    nickname: '编辑者',
  },
  {
    email: 'member@example.com',
    role: RoleCode.MEMBER,
    nickname: '普通会员',
  },
] as const;

export interface SeedLocalDevUsersResult {
  emails: string[];
}

/**
 * 把本地库里的登录账号重置成文档中的固定邮箱/密码。
 * 已有 active super_admin 时只改这一条（可改邮箱），避免再创建一个系统所有者。
 */
export async function seedLocalDevUsers(
  client: PrismaClient,
  nodeEnv: string,
): Promise<SeedLocalDevUsersResult> {
  if (nodeEnv === 'production') {
    throw new Error('禁止在生产环境写入本地开发账号。');
  }

  assertPasswordPolicy(LOCAL_DEV_PASSWORD, '本地开发密码');
  const passwordHash = await hashPassword(LOCAL_DEV_PASSWORD);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const emails: string[] = [];

  await client.$transaction(async (tx) => {
    for (const account of LOCAL_DEV_USERS) {
      const email = normalizeEmail(account.email);
      const role = await tx.role.findUnique({
        where: { code: account.role },
        select: { id: true },
      });
      if (role === null) {
        throw new Error(`未找到角色 ${account.role}；请先运行 prisma:seed。`);
      }

      let userId: string;
      if (account.role === RoleCode.SUPER_ADMIN) {
        const existingOwner = await tx.user.findFirst({
          where: { roleId: role.id, status: UserStatus.ACTIVE },
          select: { id: true },
        });
        if (existingOwner !== null) {
          const updated = await tx.user.update({
            where: { id: existingOwner.id },
            data: {
              email,
              passwordHash,
              nickname: account.nickname,
              status: UserStatus.ACTIVE,
              emailVerifiedAt: now,
              mustChangePassword: false,
              authVersion: { increment: 1 },
            },
          });
          userId = updated.id;
        } else {
          const created = await tx.user.create({
            data: {
              email,
              passwordHash,
              nickname: account.nickname,
              status: UserStatus.ACTIVE,
              roleId: role.id,
              emailVerifiedAt: now,
              mustChangePassword: false,
            },
          });
          userId = created.id;
        }
      } else {
        const existing = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (existing === null) {
          const created = await tx.user.create({
            data: {
              email,
              passwordHash,
              nickname: account.nickname,
              status: UserStatus.ACTIVE,
              roleId: role.id,
              emailVerifiedAt: now,
              mustChangePassword: false,
            },
          });
          userId = created.id;
        } else {
          const updated = await tx.user.update({
            where: { id: existing.id },
            data: {
              passwordHash,
              nickname: account.nickname,
              status: UserStatus.ACTIVE,
              roleId: role.id,
              emailVerifiedAt: now,
              mustChangePassword: false,
              authVersion: { increment: 1 },
            },
          });
          userId = updated.id;
        }
      }

      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'LOCAL_DEV_USER_SEED' },
      });
      await tx.auditLog.create({
        data: {
          category: 'SECURITY',
          action: 'AUTH_LOCAL_DEV_USER_SEEDED',
          actorId: userId,
          targetType: 'USER',
          targetId: userId,
          detail: { source: 'local-dev-cli', email, role: account.role },
          expiresAt,
        },
      });
      emails.push(email);
    }
  });

  return { emails };
}

async function main(): Promise<void> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const prisma = new PrismaClient();
  try {
    const result = await seedLocalDevUsers(prisma, nodeEnv);
    await seedContentTaxonomy(prisma);
    await seedSampleContents(prisma);
    console.info(
      `本地开发账号已就绪：${result.emails.join('、')}。密码见 docs/engineering/dev-credentials.md。`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('写入本地开发账号失败。', error);
    process.exitCode = 1;
  });
}
