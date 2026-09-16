import argon2 from 'argon2';

/** 与 Canonical 注册/bootstrap 一致：至少 8 位，含大小写、数字和特殊字符。 */
export const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

export function assertPasswordPolicy(password: string, envName = '密码'): void {
  if (!PASSWORD_POLICY.test(password)) {
    throw new Error(`${envName} 必须至少 8 位且含大小写字母、数字和特殊字符。`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}
