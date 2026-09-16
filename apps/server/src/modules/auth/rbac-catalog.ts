import { DataScope, RoleCode } from '@prisma/client';

export interface PermissionDefinition {
  code: string;
  group: string;
  label: string;
  description: string;
}

/**
 * M1 权限目录的唯一代码来源。
 *
 * 权限码只描述资源动作；数据范围只能在角色授权关联上指定，不能拼进权限字符串。
 */
export const PERMISSION_CATALOG = [
  { code: 'content:create', group: 'CONTENT', label: '创建内容', description: '创建个人内容草稿' },
  { code: 'content:read', group: 'CONTENT', label: '读取内容', description: '读取工作区内容' },
  {
    code: 'content:update',
    group: 'CONTENT',
    label: '更新内容',
    description: '编辑内容元数据与正文',
  },
  { code: 'content:publish', group: 'CONTENT', label: '发布内容', description: '发布或归档内容' },
  { code: 'content:delete', group: 'CONTENT', label: '删除内容', description: '软删除内容' },
  { code: 'content:restore', group: 'CONTENT', label: '恢复内容', description: '恢复软删除内容' },
  {
    code: 'content:featured',
    group: 'CONTENT',
    label: '精选内容',
    description: '设置内容精选状态',
  },
  {
    code: 'content:purge',
    group: 'CONTENT',
    label: '永久清理内容',
    description: '永久清理已删除内容',
  },
  { code: 'booklet:import', group: 'CONTENT', label: '导入小册', description: '创建小册导入任务' },
  {
    code: 'category:manage',
    group: 'CONTENT_META',
    label: '管理分类',
    description: '维护内容分类树',
  },
  { code: 'tag:manage', group: 'CONTENT_META', label: '管理标签', description: '维护内容标签' },
  { code: 'file:read', group: 'FILE', label: '读取文件', description: '读取文件资产列表' },
  { code: 'file:delete', group: 'FILE', label: '删除文件', description: '逻辑删除文件资产' },
  { code: 'user:read', group: 'USER', label: '读取用户', description: '读取后台用户信息' },
  {
    code: 'user:status:update',
    group: 'USER',
    label: '更新用户状态',
    description: '启用或禁用用户',
  },
  {
    code: 'user:role:assign',
    group: 'USER',
    label: '分配用户角色',
    description: '修改用户单角色归属',
  },
  {
    code: 'user:session:read',
    group: 'USER',
    label: '读取用户会话',
    description: '读取用户设备会话',
  },
  {
    code: 'user:session:revoke',
    group: 'USER',
    label: '撤销用户会话',
    description: '撤销用户设备会话',
  },
  { code: 'role:read', group: 'RBAC', label: '读取角色', description: '读取角色与权限目录' },
  { code: 'role:manage', group: 'RBAC', label: '管理角色', description: '管理非受保护角色' },
  {
    code: 'role:permission:manage',
    group: 'RBAC',
    label: '管理角色权限',
    description: '修改角色权限关联',
  },
  {
    code: 'system:config:manage',
    group: 'SYSTEM',
    label: '管理系统配置',
    description: '更新运营系统配置',
  },
  { code: 'menu:manage', group: 'SYSTEM', label: '管理菜单', description: '维护导航菜单' },
  { code: 'audit:read', group: 'SYSTEM', label: '读取审计日志', description: '读取后台审计记录' },
  {
    code: 'dashboard:read',
    group: 'SYSTEM',
    label: '读取后台概览',
    description: '读取后台统计概览',
  },
  {
    code: 'ai:use',
    group: 'AI',
    label: '使用 AI 工具',
    description: '登录后使用 Chat / 文本 / 图片等 AI 能力',
  },
  {
    code: 'ai:quota:adjust',
    group: 'AI',
    label: '调整 AI 额度',
    description: '人工调整用户 AI 额度',
  },
  {
    code: 'ai:provider:manage',
    group: 'AI',
    label: '管理 AI 供应商',
    description: '维护 AI 供应商元数据',
  },
  {
    code: 'ai:model:manage',
    group: 'AI',
    label: '管理 AI 模型',
    description: '维护 AI 模型元数据',
  },
  {
    code: 'ai:tool:manage',
    group: 'AI',
    label: '管理 AI 工具',
    description: '维护 AI 工具展示配置',
  },
  {
    code: 'ai:template:manage',
    group: 'AI',
    label: '管理 AI 模板',
    description: '维护系统 AI 模板',
  },
  {
    code: 'ai:entitlement:manage',
    group: 'AI',
    label: '管理 AI 权益',
    description: '维护角色 AI 权益',
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]['code'];

export const SYSTEM_ROLE_DEFINITIONS = [
  { code: RoleCode.MEMBER, label: '普通成员', isProtected: false },
  { code: RoleCode.EDITOR, label: '内容编辑', isProtected: false },
  { code: RoleCode.ADMIN, label: '系统管理员', isProtected: false },
  { code: RoleCode.SUPER_ADMIN, label: '系统所有者', isProtected: true },
] as const;

const editorPermissions = [
  'ai:use',
  'content:create',
  'content:read',
  'content:update',
  'content:publish',
  'content:delete',
  'content:restore',
  'booklet:import',
] as const satisfies readonly PermissionCode[];

const adminPermissions = PERMISSION_CATALOG.map(({ code }) => code).filter(
  (code) => code !== 'content:purge',
) as PermissionCode[];

/**
 * 系统角色的固定授权。MEMBER 仅有 `ai:use`，内容创作仍走 EDITOR。
 */
export const SYSTEM_ROLE_PERMISSIONS: Readonly<Record<RoleCode, readonly PermissionCode[]>> = {
  [RoleCode.MEMBER]: ['ai:use'],
  [RoleCode.EDITOR]: editorPermissions,
  [RoleCode.ADMIN]: adminPermissions,
  [RoleCode.SUPER_ADMIN]: PERMISSION_CATALOG.map(({ code }) => code),
};

export const SYSTEM_ROLE_DATA_SCOPE: Readonly<Record<RoleCode, DataScope>> = {
  [RoleCode.MEMBER]: DataScope.OWN,
  [RoleCode.EDITOR]: DataScope.OWN,
  [RoleCode.ADMIN]: DataScope.ALL,
  [RoleCode.SUPER_ADMIN]: DataScope.ALL,
};
