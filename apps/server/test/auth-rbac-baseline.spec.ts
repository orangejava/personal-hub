import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import argon2 from 'argon2';
import { DataScope, PrismaClient, RoleCode, UserStatus } from '@prisma/client';
import { GenericContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootstrapSuperAdmin } from '../src/cli/bootstrap-super-admin';
import { LOCAL_DEV_PASSWORD, seedLocalDevUsers } from '../src/cli/seed-local-dev-users';
import { PERMISSION_CATALOG, SYSTEM_ROLE_PERMISSIONS } from '../src/modules/auth/rbac-catalog';
import { runBaselineSeed, SYSTEM_MENUS } from '../prisma/seed';

const serverDirectory = resolve(__dirname, '..');

describe('Auth/RBAC M1 数据基线', () => {
  let prisma: PrismaClient;
  let stopPostgres: (() => Promise<unknown>) | undefined;

  beforeAll(async () => {
    const postgres = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'personal_hub_auth_test',
        POSTGRES_USER: 'personal_hub_auth_test',
        POSTGRES_PASSWORD: 'personal_hub_auth_test_password',
      })
      .withExposedPorts(5432)
      .start();
    stopPostgres = () => postgres.stop();

    const databaseUrl = `postgresql://personal_hub_auth_test:personal_hub_auth_test_password@${postgres.getHost()}:${postgres.getMappedPort(5432)}/personal_hub_auth_test?schema=public`;
    execFileSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      {
        cwd: serverDirectory,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      },
    );
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await stopPostgres?.();
  });

  it('可重复写入受控角色、权限、范围与菜单基线', async () => {
    await runBaselineSeed(prisma);
    await runBaselineSeed(prisma);

    const roles = await prisma.role.findMany({
      include: { permissions: true, aiEntitlement: true },
      orderBy: { code: 'asc' },
    });
    expect(roles).toHaveLength(4);

    const member = roles.find((role) => role.code === RoleCode.MEMBER);
    const editor = roles.find((role) => role.code === RoleCode.EDITOR);
    const superAdmin = roles.find((role) => role.code === RoleCode.SUPER_ADMIN);
    expect(member?.permissions).toHaveLength(1);
    expect(member?.aiEntitlement?.verificationGrantAmount).toBe(10000n);
    expect(editor?.permissions).toHaveLength(SYSTEM_ROLE_PERMISSIONS[RoleCode.EDITOR].length);
    expect(editor?.permissions.every((permission) => permission.dataScope === DataScope.OWN)).toBe(
      true,
    );
    expect(superAdmin?.permissions).toHaveLength(PERMISSION_CATALOG.length);
    expect(
      superAdmin?.permissions.every((permission) => permission.dataScope === DataScope.ALL),
    ).toBe(true);

    const menus = await prisma.menu.findMany({ include: { permissions: true } });
    expect(menus).toHaveLength(SYSTEM_MENUS.length);
    expect(menus.find((menu) => menu.routeKey === 'admin.users')?.permissions).toHaveLength(1);
    expect(menus.find((menu) => menu.routeKey === 'workspace.contents')?.parentId).toBe(
      menus.find((menu) => menu.routeKey === 'workspace.content.group')?.id,
    );
    await expect(
      prisma.permission.create({
        data: {
          code: 'unapproved:permission',
          group: 'TEST',
          label: '不允许的权限',
        },
      }),
    ).rejects.toThrow();
  });

  it('只允许首次执行创建或提升一个 active super_admin', async () => {
    await runBaselineSeed(prisma);
    const result = await bootstrapSuperAdmin(prisma, {
      email: 'Owner@Example.COM',
      temporaryPassword: 'OneTimePassword!1',
    });
    expect(result.created).toBe(true);

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@example.com' },
      include: { role: true, auditLogs: true },
    });
    expect(owner.role.code).toBe(RoleCode.SUPER_ADMIN);
    expect(owner.status).toBe(UserStatus.ACTIVE);
    expect(owner.mustChangePassword).toBe(true);
    await expect(argon2.verify(owner.passwordHash, 'OneTimePassword!1')).resolves.toBe(true);
    expect(owner.auditLogs).toHaveLength(1);

    await expect(
      bootstrapSuperAdmin(prisma, {
        email: 'second-owner@example.com',
        temporaryPassword: 'AnotherPassword!1',
      }),
    ).rejects.toThrow('已有 active super_admin');
    await expect(
      prisma.user.count({
        where: {
          role: { code: RoleCode.SUPER_ADMIN },
          status: UserStatus.ACTIVE,
        },
      }),
    ).resolves.toBe(1);
  });

  it('禁止在生产环境写入本地开发账号', async () => {
    await runBaselineSeed(prisma);
    await expect(seedLocalDevUsers(prisma, 'production')).rejects.toThrow('禁止在生产环境');
  });

  it('可把已有 super_admin 重置为文档中的本地开发账号', async () => {
    await runBaselineSeed(prisma);
    await prisma.user.deleteMany();
    await bootstrapSuperAdmin(prisma, {
      email: 'acceptance-owner@example.com',
      temporaryPassword: 'OneTimePassword!1',
    });

    const result = await seedLocalDevUsers(prisma, 'development');
    expect(result.emails).toEqual([
      'owner@example.com',
      'editor@example.com',
      'member@example.com',
    ]);

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@example.com' },
      include: { role: true },
    });
    expect(owner.role.code).toBe(RoleCode.SUPER_ADMIN);
    expect(owner.mustChangePassword).toBe(false);
    await expect(argon2.verify(owner.passwordHash, LOCAL_DEV_PASSWORD)).resolves.toBe(true);
    await expect(
      prisma.user.count({
        where: { role: { code: RoleCode.SUPER_ADMIN }, status: UserStatus.ACTIVE },
      }),
    ).resolves.toBe(1);

    const editor = await prisma.user.findUniqueOrThrow({
      where: { email: 'editor@example.com' },
      include: { role: true },
    });
    expect(editor.role.code).toBe(RoleCode.EDITOR);
    await expect(argon2.verify(editor.passwordHash, LOCAL_DEV_PASSWORD)).resolves.toBe(true);
  });
});
