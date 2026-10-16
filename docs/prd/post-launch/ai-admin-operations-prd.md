# AI 后台运营 PRD

> 状态：阶段 A 代码已落地，隔离 HTTP 集成测试与浏览器联调待验收；阶段 B–E 待开发
> 最后更新：2026-10-16
> Worktree：AI 后台
> 计划评分（plan-review，百分制，2026-10-02）：阶段 A 91，阶段 A–E 91，可以按本文开工。充值、支付、自研模型、活动运营界面、`ai_usage_daily`、`ai_quota_grants` 后置，不计入本期。
> 关系：扩展 [../long-term/ai-tools-prd.md](../long-term/ai-tools-prd.md) 的上线后运营能力；实现时需要同步 Canonical API、数据模型和 `apps/server/docs/implementation/ai/`。

## 1. 目标

首版 AI 已能使用 Fake / OpenAI-compatible Provider。下一步要把 AI 从「能用」升级为「可配置、可运营、可控成本、可审计」。

本 PRD 覆盖：

- AI Provider 和模型配置中心
- 用户自备 API Key 能力与总开关
- AI 用量统计
- 用户额度调整
- AI 消耗规则（沿用现有平台单价，不另建倍率）
- 公共额度发放能力
- 每日登录奖励
- 连续签到日历

## 2. 不做

- 用户充值、支付、订单、发票
- 自研模型、模型训练、模型微调
- 自研模型备案流程
- LoRA / ComfyUI
- 复杂活动运营平台

说明：当前没有自研模型，因此不存在自研模型备案这条功能路径。只记录系统和用户调用的外部 Provider。

## 3. 阶段 A：AI 配置中心

### 3.1 管理员 Provider

后台支持管理员配置系统 Provider：

- Provider 名称
- Provider 类型，如 OpenAI-compatible
- Base URL
- API Key
- 是否启用
- 备注 `remark`
- 是否已备案模型来源 `sourceFiled`
- 备案说明或备案号 `filingNote`

API Key 不写入 `ai_providers`。该表现在只有厂商目录：`code`、`label`、`baseUrl`、`enabled`、`authEnvKey`（环境变量名）、超时和请求头。密钥和目录的生命周期不同，而且后面还要存用户自己填写的 Key，所以系统 Key 和用户 Key 共用新表 `ai_provider_credentials`。

| 字段 | 含义 |
| --- | --- |
| `ownerType` | `SYSTEM` 或 `USER` |
| `userId` | `USER` 必填；`SYSTEM` 为空 |
| `providerId` | 可空。系统凭据必须指向某个 Provider；用户凭据可以指向已有 Provider，也可以只填类型和地址 |
| `providerType` | 如 `openai-compatible`。用户自定义端点时使用 |
| `baseUrl` | 可空。系统凭据为空时用 Provider 上的 `baseUrl` |
| `ciphertext` | 加密后的 Key。旁边存 `nonce` 和 `keyVersion`。接口、日志、审计和幂等响应都不返回这三列 |
| `enabled` | 是否参与调用 |

`remark`、`sourceFiled`、`filingNote` 写在 `ai_providers`，不写进凭据表。它们是目录信息，不是密钥。公开配置和用户端接口不返回这三项。管理端 `adminConfig` 可以返回。

约束：每个 Provider 至多一条 `SYSTEM` 凭据，更新即轮换密文。同一用户对同一个 `providerId`，或对同一个自定义 `baseUrl`，至多一条凭据。后台只显示「已配置 / 未配置」，不显示明文，也不显示脱敏片段。

调用系统 Provider 时，优先用该 Provider 已启用的 `SYSTEM` 凭据。还没有凭据时，读取该行 `authEnvKey` 指向的环境变量。种子数据里的 OpenAI-compatible 行目前指向 `AI_OPENAI_API_KEY`，这条回退要保留。Fake Provider 不读这张表。明文不进入 `system_configs`。

加密主密钥只放环境变量 `AI_CREDENTIAL_ENCRYPTION_KEY`，算法 AES-256-GCM。密文、nonce 和 `keyVersion` 一起落在凭据行上，便于以后换主密钥仍能解开旧行。没配主密钥时，拒绝保存新凭据，已有的环境变量回退仍然可以调用。日志、审计 `detail`、幂等响应里不出现明文。

现在的 `patchProvider` 收到 `apiKey` 后只把 `authEnvKey` 写成 `AI_PROVIDER_<CODE>_KEY`，密钥本身被丢掉，响应还带 `apiKeyMasked: '********'`。阶段 A 改掉这两处：密钥写入凭据表；响应只留 `hasKey`，不再返回掩码。

补充请求侧保护：管理端先读取仅管理员可见的 P-256 公钥，再用临时 ECDH 密钥、HKDF-SHA256 和 AES-256-GCM 加密 Key。新增和更新接口只接收 `encryptedApiKey` 信封，拒绝旧的明文 `apiKey` 字段。服务端解密后仍按上面的数据库加密规则保存。公钥由主密钥域分离派生，轮换主密钥后旧页面需要重新取公钥并提交。HTTPS 仍是生产环境必须项；浏览器输入框和加密前内存中的明文无法用请求加密消除。

第一版新增 Provider 仅支持 `openai-compatible` 类型，`code` 唯一，名称和 Base URL 必填。新增目录和可选的系统 Key 在同一事务中提交；重复 `code` 返回 409。禁用沿用更新接口的 `enabled=false`，不物理删除目录。

### 3.1.1 阶段 A 文件

| 文件 | 改什么 |
| --- | --- |
| `apps/server/prisma/schema.prisma` | 新增 `AiProviderCredential`（含 `ciphertext`、`nonce`、`keyVersion`）。`AiProvider` 只增加 `remark`、`sourceFiled`、`filingNote`，不增加密钥列 |
| `apps/server/src/config/env.schema.ts` | 增加可选的 `AI_CREDENTIAL_ENCRYPTION_KEY` |
| `apps/server/src/modules/ai/ai-credential.service.ts` | 加密、解密、按 Provider 取系统凭据 |
| `apps/server/src/modules/ai/ai.service.ts` | 新增与更新 Provider 把解密后的 Key 写入凭据表；`adminConfig` 返回 `hasKey`、`remark`、`sourceFiled`、`filingNote`，不返回密钥 |
| `apps/server/src/modules/ai/providers/openai-compatible-text.provider.ts` | 按上面的顺序取密钥，不再写死只读 `AI_OPENAI_API_KEY` |
| `apps/server/src/modules/ai/dto/ai.dto.ts` | 请求只接收 `encryptedApiKey`，响应用 `hasKey: boolean` |
| `apps/admin-web/src/pages/admin/AiConfig/index.tsx` | 表格列改为「已配置 / 未配置」；去掉掩码输入框。留空表示不修改密钥 |
| `apps/server/test` | 保存后库里没有明文；响应没有 `apiKey` / `apiKeyMasked`；无凭据时仍能用 `AI_OPENAI_API_KEY` |

更新沿用 `PATCH /api/v1/admin/ai/providers/:providerId`；新增用 `POST /api/v1/admin/ai/providers`；公钥用 `GET /api/v1/admin/ai/credential-key`。页面拿到的是解包后的对象。写失败走全局 toast，读 `error.message`。

阶段 A 验收：用管理员打开 AI 配置，保存一个 Key、备注和备案号，刷新后仍显示已配置，备注和备案号还在。响应体里搜不到该 Key。用户端公开配置里也没有备案号。删掉凭据行后，已配置 `AI_OPENAI_API_KEY` 的环境仍能对话。Fake Provider 对话不受影响。邮箱验证赠额仍是账本里的一笔 `GRANT`，默认 10000。

### 3.2 模型管理

模型继续用现有 `ai_models`，不另建模型表。后台可新增模型，并编辑这些已有列：

- `modelKey`、`displayName`
- `modality` 与 `toolTypes`（能力类型）
- `contextWindowTokens`、`maxOutputTokens`
- `enabled`、`userVisible`
- `inputPricePer1k`、`outputPricePer1k`、`fixedPlatformCost`（这就是消耗规则，见 §5.3）
- `sort` 若现表没有排序列，本阶段不加；默认关系使用已有 `ai_tools.defaultModelId`，每种工具独立；接口 `defaultToolTypes` 表达默认范围，`isDefault` 仅作兼容摘要。

用户端只展示 `enabled`、`userVisible`、当前工具类型匹配、并且通过 entitlement 的模型。未登录访客不展示 `guestAllowed = false` 的模型。

### 3.2.1 后续：自定义角色与模型访问权限

当前角色为受控固定角色，本阶段不提供自定义角色创建。后续开放自定义角色时，角色、角色权限和 `AiEntitlement` 必须在同一事务中建立；新角色创建后应自动出现在「模型访问权限」列表中。

新角色默认不得使用任何 AI 模型，管理员显式配置「全部模型」或「指定模型」后才可使用。当前 `allowedModelIds = []` 的语义是「不限制模型」，不能复用为「拒绝全部」；届时需增加明确的访问模式，例如 `NONE`、`ALL`、`SELECTED`，并迁移已有权益数据。

验收：创建角色后可立即在模型访问权限表看到该角色；该角色用户端模型列表为空，服务端调用也被拒绝；保存「全部模型」或「指定模型」后，用户端与服务端均按配置生效。

### 3.3 连接测试

新增 `POST /api/v1/admin/ai/providers/:providerId/test`，权限 `ai:provider:manage`。密钥解析顺序与正式调用相同。测试不写用量、不预占额度、不把 `Authorization` 或密钥写入日志。

- 不传 `modelId`：向 `{baseUrl}/models` 发 GET，Bearer 用解析出的密钥，超时取该 Provider 的 `timeoutMs`，最长 20 秒。HTTP 2xx 且 body 是 JSON 即成功。
- 传入 `modelId`：先走上面的 GET。返回的模型列表里有该 `modelKey` 即成功。厂商对 `/models` 返回 404 时，再发一次非流式 `POST {baseUrl}/chat/completions`，`max_tokens: 1`，消息正文固定为 `ping`。只此一种回退。
- Fake Provider 不发外网请求，直接返回成功。
- 失败时前端展示后端 `error.message`。没有主密钥且也没有环境变量回退时，错误写明哪一项缺失。

按钮放在 `AiConfig` 的厂商行上。模型行把当前 `modelId` 传给同一个接口。

### 3.4 验收

- 管理员能新增、编辑、禁用 Provider。
- API Key 保存后不可回显。
- 禁用模型后，用户端不再可选。
- 没有可用模型时，用户端展示清晰空状态。
- 连接测试成功 / 失败都有明确结果。在厂商行点「测试」：没有凭据行、环境里有 `AI_OPENAI_API_KEY` 时，要么成功，要么展示厂商或网络错误。浏览器网络面板和接口响应里都没有密钥。Fake Provider 点测试直接成功，不产生用量记录。

## 4. 阶段 B：用户自备 API Key

用户自备 API Key 与系统 Key 写入同一张 `ai_provider_credentials`（`ownerType = USER`），不另建密钥表。入口默认展示，管理端可以关闭。

### 4.1 后台开关

后台可配置：

- 是否允许用户自备 Provider。默认开启，用户侧入口默认展示
- 允许的 Provider 类型。第一版只有 `openai-compatible`，与现有文本 Provider 相同
- 是否允许用户改选模型。默认关闭：即使用户有自己的 Key，仍用系统当前默认模型，只是请求发往用户凭据。打开后，只能在系统已启用且 `userVisible` 的模型里改选，不能填写任意模型名
- 是否允许用户自备 Key 占用平台额度。默认关闭。用量记录始终写。开关关闭时不预占、不结算平台额度，因为费用发生在用户自己的厂商账号上。开关打开时，在写用量之外再走现有预占和结算

关闭总开关后，用户侧入口不可见，已保存的用户凭据保留但不参与调用。再次开启后沿用这些凭据，不要求用户重填。未登录访客没有用户凭据入口，也不能签到或领取每日登录额度。

用户侧入口和签到页沿用 `useViewportBand`：手机单列，可点区域不小于 44px。矮屏不把表单固定成一屏高度。

### 4.2 用户侧能力

用户在个人设置或 AI 设置中维护自己的 Key：

- Provider 类型
- Base URL
- API Key
- 启用状态
- 连接测试

用户自备 Key 同样只写不回显，密文写入 `ai_provider_credentials`。入口放在已有的 `/workspace/profile`，新增一张卡片，不改个人资料那张仍是 mock 的表单。

三个开关写入已有的 `ai.branding`，不新建配置组：`userProviderEnabled` 默认 true，`userCanPickModel` 默认 false，`userKeyConsumesQuota` 默认 false。

接口：

- `GET /api/v1/app/ai/credentials`：当前用户的凭据列表，只含类型、地址、`hasKey`、是否启用
- `PUT /api/v1/app/ai/credentials`：写入或轮换。`apiKey` 只写。必填幂等键
- `DELETE /api/v1/app/ai/credentials/:id`：只删自己的 `USER` 行
- 连接测试复用管理端同一套厂商探测，路径为 `POST /api/v1/app/ai/credentials/test`，只能测自己的凭据

`userProviderEnabled = false` 时，个人中心不渲染这张卡片，对话也不读取 `USER` 凭据。

### 4.2.1 阶段 B 文件

| 文件 | 改什么 |
| --- | --- |
| `apps/server/src/modules/system/config-registry.ts` | `ai.branding` 增加上面三个布尔字段，默认值如上 |
| `apps/server/src/modules/ai/app-ai.controller.ts` | 用户凭据的读、写、删、测试 |
| `apps/server/src/modules/ai/ai-credential.service.ts` | 限制 `USER` 行只能由所属用户读写 |
| `apps/server/src/modules/ai/ai-runtime.service.ts` | 开关打开且用户有启用凭据时，该用户的文本请求改走用户密钥；否则仍走系统 Provider |
| `apps/admin-web/src/pages/admin/AiConfig/index.tsx` | 品牌设置增加三个开关 |
| `apps/user-web/src/pages/workspace/Profile/index.tsx` | 只加凭据卡片 |
| `packages/api-client`、`packages/shared-types` | 凭据 DTO 与三个开关 |

### 4.3 验收

- 默认状态下，用户侧入口可见。
- 后台关闭开关后，用户侧入口不可见；已保存的 Key 仍在，且不会被用来调用。
- 后台重新开启后，入口恢复，已保存的 Key 继续可用。
- 用户自备 Key 不影响系统 Provider。
- 用户自备调用仍保留用量记录。`userKeyConsumesQuota` 为 false 时，账本可用额度不变。
- 个人资料表单仍按原来的 mock 保存，不因凭据卡片改成真实资料接口。
- 手机 390px 下凭据卡片单列，按钮高度不小于 44px。

## 5. 阶段 C：AI 用量与额度

### 5.1 用量统计

后台需要看到：

- 全站总用量
- 按用户统计
- 按模型统计
- 按工具统计
- 按时间范围统计
- 输入、输出、图片、视频任务等维度

### 5.2 用户额度

超级管理员可以查看和调整用户额度：

- 当前可用额度
- 已预占额度
- 历史消耗
- 手动增加额度
- 手动扣减额度
- 调整原因

所有额度变化必须进入账本，不允许只改余额。扣减的是当前可用额度 `availableAmount`。扣减后不得小于 0。若本次扣减会使余额小于 0，整笔拒绝：不写账本，可用额度和预占额度都保持原值，并返回明确错误。不把余额改成 0 来凑整。

### 5.3 消耗规则

不另加一套「倍率」列。平台额度已经由 `platformCost` 决定：文本用 `inputPricePer1k` 和 `outputPricePer1k`；图片和视频用 `fixedPlatformCost`，按一次成功任务计，不按秒再拆。改这些字段只影响之后的预占和结算。`ai_usage_records` 里已经写入的 `platformCost` 不回算。

按时长计视频费、按张数再乘系数，留到有真实视频厂商之后再加字段。本阶段两种都不用。

### 5.4 验收

- 管理员能看到全站、用户、模型维度用量。
- 手动调整额度后用户余额立即变化。
- 扣减超过当前可用额度时，请求失败，余额不变。
- 账本可以追溯操作者、原因、变化前后值。
- 修改 `inputPricePer1k`、`outputPricePer1k` 或 `fixedPlatformCost` 后，新请求按新价消耗，旧用量记录不变。

### 5.5 怎么落地

用量直接聚合现有 `ai_usage_records`，本阶段不建 `ai_usage_daily`。扩展已有 `GET /api/v1/admin/ai/stats?range=24h|7d|30d`，按用户、模型、工具汇总 `inputTokens`、`outputTokens`、`platformCost` 和次数。图片、视频用 `ai_generation_jobs` 的次数，不从用量记录里猜。

调额度：`POST /api/v1/admin/ai/quota-adjustments`，权限沿用 `ai:entitlement:manage` 且 `DataScope.ALL`（现有超级管理员种子具备）。body 为 `{ userId, direction: "GRANT" | "DEDUCT", amount, reason }`。`amount` 为正整数。`DEDUCT` 超过 `availableAmount` 时返回 `AI_QUOTA_ADJUSTMENT_REJECTED`。成功写一条 `ADJUSTMENT` 账本。必填幂等键。不实现 `POST /api/v1/admin/users/:userId/quota-adjustments`。种子里已有的 `ai:quota:adjust` 不挂到这条接口上。

价格没有新接口。继续用 `PATCH /api/v1/admin/ai/models/:modelId` 改三列价格。

| 文件 | 改什么 |
| --- | --- |
| `apps/server/src/modules/ai/ai.service.ts` | `adminStats` 改为按时间范围聚合，不再返回空趋势 |
| `apps/server/src/modules/ai/admin-ai.controller.ts` | 增加调额度接口 |
| `apps/server/src/modules/ai/ai-quota.service.ts` | 事务内扣减，不足则整笔拒绝 |
| `apps/admin-web/src/pages/admin/AiConfig/index.tsx` | 用量表和时间范围；用户额度调整弹窗 |

验收：用管理员打开 AI 配置，把范围切到 7 天，能看到至少按模型拆开的次数。对一个测试用户扣减超过可用额度，余额不变并看到错误。把模型的 `inputPricePer1k` 改大，下一轮对话的新用量变大，改价前那条用量数字不变。

## 6. 阶段 D：公共额度发放能力

增加 AI 额度不能写死在登录接口里。需要抽成公共发放能力，后续用于登录、签到、活动、邀请和管理员赠送。

### 6.1 发放规则

后台可配置：

- 规则名称
- 规则类型：每日登录、签到、活动、管理员赠送
- 发放额度
- 生效时间
- 失效时间
- 每用户周期内最多领取次数
- 是否启用
- 展示文案

### 6.2 默认规则

第一版内置默认规则：

- 每日首次登录发放 AI 额度
- 每个用户每天最多一次
- 「一天」按 Asia/Shanghai 的自然日计算
- 默认额度由后台可配置
- 重复登录、刷新 Token、自动续期不重复发放

### 6.3 幂等

每次发放必须有幂等键，例如：

```text
daily-login:<userId>:<yyyy-mm-dd>
```

重复触发时直接返回已领取结果。

### 6.4 验收

- 用户每天首次登录获得额度。
- 同一天多次登录只获得一次。
- 关闭规则后不再发放。
- 发放记录进入额度账本。
- 登录失败和 refresh 不触发发放。

### 6.5 怎么落地

不建 `ai_quota_grants`。发放结果就是 `ai_quota_transactions` 上已有的唯一 `idempotencyKey`。新建 `ai_quota_rules`：名称、类型（`DAILY_LOGIN` / `CHECKIN` / `ACTIVITY` / `ADMIN_GRANT`）、额度、生效与失效时间、每周期次数、是否启用、文案。本阶段界面只启用 `DAILY_LOGIN`。`ACTIVITY` 和 `ADMIN_GRANT` 可以入库但没有运营页面。

种子一条每日登录规则，额度 100，时区 Asia/Shanghai。只在 `AuthService.login` 成功写出刷新令牌之后调用发放。`refresh` 不调用。发放失败只记日志，不让登录失败。同一天重复登录回放已领取结果，不再加余额。

| 文件 | 改什么 |
| --- | --- |
| `apps/server/prisma/schema.prisma` | 新增 `AiQuotaRule` |
| `apps/server/src/modules/ai/ai-quota-grant.service.ts` | 按规则和幂等键发放 |
| `apps/server/src/modules/auth/auth.service.ts` | 仅 `login` 成功后调用，`refresh` 不调用 |
| `apps/admin-web/src/pages/admin/AiConfig/index.tsx` | 每日登录规则的额度、文案、启用开关 |

验收：同一账号当天第一次登录后可用额度增加 100，退出再登录不变。刷新访问令牌不变。把规则关掉后再登录，额度不增加。登录密码错误时额度不变。

## 7. 阶段 E：连续签到日历

连续签到是公共发放能力的第一个前台化入口。

### 7.1 用户侧

用户可以看到：

- 今日是否已签到
- 连续签到天数
- 本周期奖励日历
- 今日可领取额度
- 断签提示

### 7.2 后台配置

后台可配置：

- 每日基础奖励
- 连续第 N 天额外奖励
- 是否断签重置
- 最大连续天数
- 是否循环
- 活动开始 / 结束时间

### 7.3 验收

- 用户可主动签到领取额度。
- 每天只能签到一次。
- 连续天数计算正确。
- 断签策略符合后台配置。
- 签到和每日登录是两条规则，幂等键分开：`daily-login:<userId>:<yyyy-mm-dd>` 与 `checkin:<userId>:<yyyy-mm-dd>`。同一条规则同一天只发一次。两条规则互不抵消，用户可以同一天既拿到登录发放，也拿到签到发放。
- 未登录不能签到。断签按后台「是否断签重置」计算；日期同样用 Asia/Shanghai。
- 浏览器不改系统时钟：工作台卡片展示接口返回的上海日期，当天再点一次余额不变。断签重置由服务端测试覆盖：只插入前天的 `ai_checkins`、打开 `resetOnBreak`，再签到，连续天数应为 1。

### 7.4 怎么落地

签到状态新建 `ai_checkins`：`userId`、上海日历日、连续天数、所用规则 ID，唯一键 `(userId, date)`。奖励仍走阶段 D 的发放服务，幂等键 `checkin:<userId>:<yyyy-mm-dd>`。

`GET /api/v1/app/ai/checkins?month=yyyy-mm` 必须登录，只读，不发放额度。`month` 省略时用 Asia/Shanghai 的当月。响应含上海今日日期、今日是否已签、连续天数，以及该月已签日期。月历卡片用这份响应渲染，不在浏览器里推算跨天。

`POST /api/v1/app/ai/checkins` 必须登录，必填幂等键。当天已签到则回放，不加倍。`resetOnBreak = true` 时，缺了一天就把连续天数回到 1；为 false 时连续天数保持，只是当天不额外奖励。`maxStreak` 到达后若 `cycle = true`，下一圈从第 1 天的基础奖励再算。额外奖励配置在 `CHECKIN` 规则上，形如 `{ day: 7, amount: 50 }`，最多 31 条。

界面放在已有的 `/workspace/dashboard`，一张月历卡片。手机单列，日期格不小于 44px，不横向滚动。未登录访问工作台会被现有路由挡住，不另做游客签到。

| 文件 | 改什么 |
| --- | --- |
| `apps/server/prisma/schema.prisma` | 新增 `AiCheckin` |
| `apps/server/src/modules/ai/app-ai.controller.ts` | `GET /app/ai/checkins` 读当月状态，`POST /app/ai/checkins` 签到 |
| `apps/server/src/modules/ai/ai-quota-grant.service.ts` | 复用发放，不另写加余额 |
| `apps/user-web/src/pages/workspace/Dashboard/index.tsx` | 月历卡片 |
| `apps/admin-web/src/pages/admin/AiConfig/index.tsx` | 签到规则：基础奖励、第 N 天额外奖励、断签重置、最大天数、是否循环、起止时间 |

签到是否成功只按 §7.3 验收。不改操作系统时钟，也不把「跨过上海零点再签一次」当作浏览器步骤。

## 8. 影响范围

### 后端

- Provider / Model 配置
- API Key 加密与脱敏
- 连接测试
- 用量聚合
- 额度账本
- 额度调整
- 发放规则
- 签到记录

### 数据模型

在现有模型上扩展，不另起一套厂商表：

- `ai_providers`、`ai_models`：继续用现有表。Provider 不增加 API Key 列
- `ai_provider_credentials`：新建。系统 Key 与用户 Key 都在这张表，见 §3.1
- `ai_quota_accounts`、`ai_quota_transactions`：继续用现有账本。人工扣减走 `ADJUSTMENT`，且不得把 `availableAmount` 扣成负数
- `ai_quota_rules`：阶段 D 新建。发放结果写入已有账本的 `idempotencyKey`，不另建 `ai_quota_grants`
- `ai_checkins`：阶段 E 新建
- 用量不建 `ai_usage_daily`，直接聚合 `ai_usage_records`

`ai_user_provider_keys` 不再单独建表。

### 前端

- `apps/admin-web`：AI 配置、用量、额度、发放规则、签到规则
- `apps/user-web`：模型选择、额度展示、签到入口、用户自备 Key 入口
- `packages/api-client`：接口方法与类型
- `packages/shared-types`：共享枚举和 DTO 类型

## 9. 风险与控制

- API Key 泄露风险：只写不回显、日志脱敏、传输走 HTTPS。
- 重复发放风险：所有发放规则必须有幂等键。
- 账本错账风险：余额只能由账本事务计算或在同一事务内更新。人工扣减会使 `availableAmount` 小于 0 时返回 `AI_QUOTA_ADJUSTMENT_REJECTED`，不写账本。
- 现有对话、Fake Provider、流式输出和邮箱验证赠额必须保持可用。阶段 A 不改预占公式。
- 用户自备 Key 合规风险：入口默认展示，管理端可关闭；关闭后已存凭据不参与调用。
- 范围过大风险：严格按 A → B → C → D → E 阶段开发和验收。

## 10. 验收总清单

- [ ] 管理员可配置 Provider 和模型
- [ ] API Key 不回显，日志不泄露
- [ ] 用户端只展示启用模型
- [ ] 用户自备 Key 入口默认展示，管理端可关闭；关闭后不调用已存用户 Key
- [ ] 后台可查看用量统计
- [ ] 超级管理员可调整额度；扣减不得使可用额度小于 0
- [ ] 修改现有三列价格只影响之后的用量
- [ ] 每日登录奖励可配置且幂等
- [ ] 连续签到日历可用
- [ ] 所有额度变化进入账本
- [ ] 关键接口有测试
- [ ] 浏览器验收通过后台和用户端关键路径
