/**
 * 共享类型引用探针：验证 apps/user-web 能正确解析 @personal-hub/shared-types。
 * 阶段 1 起该文件会替换为真实业务类型聚合出口。
 */
import type {
  ApiResponse,
  ContentType,
  User,
  UserRole,
} from '@personal-hub/shared-types';

export type { ApiResponse, ContentType, User, UserRole };
