# AI 图片生成站 v1 实现计划

- 日期：2026-10-07
- 设计来源：`docs/superpowers/specs/2026-10-07-ai-image-studio-design.md`
- 执行方式：按阶段顺序执行，每个任务完成后跑一次验证，再进入下一个任务
- 说明：本文档由 writing-plans 流程产出。因执行环境终端故障，
  未能读取到该技能的最新模板原文，格式按 Superpowers 计划文档的通用约定书写，
  终端恢复后会对照模板复核一遍。

## 前置条件

- Node.js 20 以上，包管理器统一使用 pnpm
- 一个 Supabase 项目（免费额度足够 v1）
- 一个可用的 OpenAI API Key，且账户已开通 GPTImage 权限
- Vercel 账号，用于部署与 Cron

### 动手前必须核对的两件事

1. GPTImage 当前支持的尺寸列表。设计文档按 `1024x1024`、`1536x1024`、`1024x1536` 写，
   需要对着官方文档确认是否已增加新尺寸。
2. GPTImage 生成接口的返回字段。设计文档按返回 base64 图片数据处理，
   需要确认字段名与是否支持直接返回 URL。

官方文档站从当前开发环境返回 403，核对时请换网络环境或由用户代为确认。
核对结果如果与设计不符，先改设计文档再改代码。

## 阶段总览

| 阶段 | 内容 | 完成标志 |
| --- | --- | --- |
| 0 | 脚手架与基础配置 | `pnpm dev` 能打开默认页 |
| 1 | 数据模型与积分函数 | 迁移跑通，注册自动得到 5 分 |
| 2 | 鉴权与用户会话 | 能注册、登录、登出 |
| 3 | 提示词组装 | 纯函数与单测通过 |
| 4 | 生图链路 | 端到端生成一张图并扣 1 分 |
| 5 | 对账任务 | 卡死记录能被自动退款 |
| 6 | 页面完善 | 首页、历史页、升级弹窗齐备 |
| 7 | 双语 | 中英切换生效 |
| 8 | 验证与部署 | 站点上线可访问 |

## 阶段 0：脚手架与基础配置

### 任务 0.1 初始化 Next.js 项目

**涉及文件：**
- 创建：项目根目录全部脚手架文件

**步骤：**

1. 在当前目录初始化项目：

```bash
pnpm dlx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir false --import-alias "@/*"
```

2. 启动开发服务器确认能打开：

```bash
pnpm dev
```

预期：浏览器打开 `http://localhost:3000` 显示默认页面。

3. 提交：

```bash
git add -A && git commit -m "chore: 初始化 Next.js 项目"
```

### 任务 0.2 安装基础依赖

**涉及文件：**
- 修改：`package.json`

**步骤：**

1. 安装数据库、界面与图标依赖：

```bash
pnpm add @supabase/supabase-js @supabase/ssr lucide-react clsx tailwind-merge
pnpm add -D vitest
```

2. 初始化 shadcn/ui：

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input label card dialog badge separator toast
```

预期：`components/ui/` 下出现组件文件。

### 任务 0.3 环境变量校验

**涉及文件：**
- 创建：`lib/env.ts`
- 创建：`.env.example`
- 修改：`.gitignore`

**步骤：**

1. 写一个在启动时校验环境变量的模块，缺少变量直接抛错，
   避免部署后才发现漏配：

```ts
// lib/env.ts
const required = [
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
] as const;

export function assertServerEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`缺少环境变量: ${missing.join(", ")}`);
  }
}
```

2. `.env.example` 列出全部变量名但留空值，`.gitignore` 确认忽略 `.env.local`。

3. 提交：

```bash
git add -A && git commit -m "chore: 安装依赖并加入环境变量校验"
```

## 阶段 1：数据模型与积分函数

### 任务 1.1 建表迁移

**涉及文件：**
- 创建：`supabase/migrations/20261007000001_init.sql`

**步骤：**

1. 写迁移脚本，建三张表：

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('signup_bonus','generation','refund')),
  generation_id uuid,
  created_at timestamptz not null default now()
);

create type public.generation_status as enum ('processing','succeeded','failed');

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.generation_status not null default 'processing',
  prompt text not null,
  options jsonb not null,
  subject text not null default '',
  notes text not null default '',
  size text not null,
  quality text not null,
  storage_path text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generations_user_created_idx
  on public.generations (user_id, created_at desc);

create index generations_stuck_idx
  on public.generations (status, created_at);
```

2. 在 Supabase 控制台或 CLI 执行迁移，确认三张表出现。

### 任务 1.2 注册触发器与积分函数

**涉及文件：**
- 创建：`supabase/migrations/20261007000002_credits.sql`

**步骤：**

1. 写注册触发器，注册时建档案、置 5 分、写流水：

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, credits) values (new.id, 5);
  insert into public.credit_ledger (user_id, delta, reason)
    values (new.id, 5, 'signup_bonus');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

2. 写扣分函数，用一条带条件的 UPDATE 保证并发安全：

```sql
create or replace function public.reserve_credit(
  p_user_id uuid,
  p_generation_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.profiles
     set credits = credits - 1
   where id = p_user_id and credits >= 1;

  get diagnostics affected = row_count;
  if affected = 0 then
    return false;
  end if;

  insert into public.credit_ledger (user_id, delta, reason, generation_id)
    values (p_user_id, -1, 'generation', p_generation_id);
  return true;
end;
$$;
```

3. 写退款函数，退款前先确认这条生成记录已经扣过分，避免重复退款：

```sql
create or replace function public.refund_credit(p_generation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select g.user_id into owner_id
    from public.generations g
   where g.id = p_generation_id and g.status = 'processing'
   for update;

  if owner_id is null then
    return false;
  end if;

  update public.profiles set credits = credits + 1 where id = owner_id;
  insert into public.credit_ledger (user_id, delta, reason, generation_id)
    values (owner_id, 1, 'refund', p_generation_id);
  update public.generations
     set status = 'failed', error = coalesce(error, 'refunded'), updated_at = now()
   where id = p_generation_id;
  return true;
end;
$$;
```

4. 验证：手工在 `auth.users` 插一条测试用户，确认 `profiles` 与 `credit_ledger`
   各多出一条数据。

### 任务 1.3 行级安全

**涉及文件：**
- 创建：`supabase/migrations/20261007000003_rls.sql`

**步骤：**

1. 三张表全部开启行级安全，只允许用户读自己的数据：

```sql
alter table public.profiles enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.generations enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "read own ledger" on public.credit_ledger
  for select using (auth.uid() = user_id);

create policy "read own generations" on public.generations
  for select using (auth.uid() = user_id);
```

2. 不要给这三张表开任何 insert、update、delete 策略。
   所有写操作走服务端 service role，它会绕过行级安全。

3. 验证：用匿名 key 在 SQL 编辑器模拟另一个用户，确认读不到他人数据。

### 任务 1.4 关闭邮箱确认

**涉及文件：**
- 无代码改动，Supabase 项目设置项

**步骤：**

1. 在 Supabase 控制台进入 Authentication 的 Sign In / Providers，找到 Email，
   关闭 Confirm email。
2. 验证：注册一个新账号，确认注册后立刻处于已登录状态，且没有收到验证邮件
   就被卡在待确认状态。

### 任务 1.5 提交

```bash
git add -A && git commit -m "feat: 数据模型、积分函数与行级安全"
```

## 阶段 2：鉴权与用户会话

### 任务 2.1 Supabase 客户端

**涉及文件：**
- 创建：`lib/supabase/server.ts`
- 创建：`lib/supabase/client.ts`
- 创建：`lib/supabase/admin.ts`

**步骤：**

1. `server.ts` 用 `@supabase/ssr` 的 `createServerClient` 绑定 Next.js 的 cookies，
   供 Route Handler 与服务端组件读取当前会话。
2. `client.ts` 用 `createBrowserClient`，只用于登录表单这类浏览器端调用。
3. `admin.ts` 用 service role key 创建客户端，文件顶部加注释说明
   这个模块只能在服务端导入，绝不能出现在客户端组件里。

验证：写一个临时服务端组件打印当前用户 id，未登录时应该是 null。

### 任务 2.2 注册与登录页面

**涉及文件：**
- 创建：`app/[locale]/login/page.tsx`
- 创建：`lib/auth/actions.ts`

**步骤：**

1. 用 server action 包住 Supabase 的 `signUp` 与 `signInWithPassword`，
   注册成功后直接跳转生图页。
2. 表单包含邮箱、密码两个输入框和一个提交按钮，提交中禁用按钮，
   错误信息显示在表单下方而不是弹窗。
3. 密码规则沿用 Supabase 默认的最短长度，前端做一次同步校验，
   避免提交后才报错。

验证：注册新账号，确认跳转到生图页且页面显示积分 5。

### 任务 2.3 顶部导航与登出

**涉及文件：**
- 创建：`components/app-nav.tsx`
- 修改：`app/[locale]/layout.tsx`

**步骤：**

1. 导航包含站点名、生图、历史、积分余额、语言切换、升级入口。
   未登录时显示登录按钮。
2. 积分余额在服务端渲染时读取，避免首屏闪一个错误数字。
3. 图标统一用 lucide-react。

验证：登录状态下点登出回到首页，导航变回未登录形态。

### 任务 2.4 提交

```bash
git add -A && git commit -m "feat: 邮箱密码鉴权与全局导航"
```

## 阶段 3：提示词组装

### 任务 3.1 选项字典

**涉及文件：**
- 创建：`lib/prompt/catalog.ts`

**步骤：**

1. 定义条目类型，每个选项同时带稳定 id、中英标签和英文片段：

```ts
export type OptionItem = {
  id: string;
  labelZh: string;
  labelEn: string;
  fragment: string;
};

export type RatioItem = OptionItem & { size: string };

export const imageTypes: OptionItem[] = [
  { id: "photo", labelZh: "照片写实", labelEn: "Photo", fragment: "a photorealistic image" },
  { id: "illustration", labelZh: "插画", labelEn: "Illustration", fragment: "a hand-drawn illustration" },
  { id: "render3d", labelZh: "3D 渲染", labelEn: "3D render", fragment: "a 3D rendered scene" },
  { id: "flat", labelZh: "扁平矢量", labelEn: "Flat vector", fragment: "a flat vector graphic" },
  { id: "watercolor", labelZh: "水彩", labelEn: "Watercolor", fragment: "a watercolor painting" },
];

export const ratios: RatioItem[] = [
  { id: "square", labelZh: "方图", labelEn: "Square", fragment: "square composition", size: "1024x1024" },
  { id: "landscape", labelZh: "横图", labelEn: "Landscape", fragment: "landscape composition", size: "1536x1024" },
  { id: "portrait", labelZh: "竖图", labelEn: "Portrait", fragment: "portrait composition", size: "1024x1536" },
];
```

2. 用同样结构补上风格、场景、留白三组，条目取自设计文档第 9 节。

3. 给每组写一个 `findById` 辅助函数，找不到时抛错，
   让非法 id 在服务端立刻暴露而不是拼出一段残缺提示词。

### 任务 3.2 组装函数

**涉及文件：**
- 创建：`lib/prompt/build.ts`

**步骤：**

1. 定义输入输出类型并实现组装：

```ts
export type PromptInput = {
  imageTypeId: string;
  ratioId: string;
  styleId: string;
  sceneId: string;
  whitespaceId: string;
  subject: string;
  notes: string;
};

export type BuiltPrompt = { prompt: string; size: string; quality: string };
```

2. 组装顺序固定为：画面类型、主体、风格、场景、构图与留白、画质与比例、补充要求。
   用句号分隔的完整句子，不要用逗号平铺的关键词串，因为 GPTImage 对完整句子
   的遵循度更好。

3. 画质固定为 `medium`，作为常量导出，方便后续单独调整。

4. 主体和补充要求做裁剪空白与长度上限处理，空补充要求不拼接空句子。

### 任务 3.3 单元测试

**涉及文件：**
- 创建：`lib/prompt/build.test.ts`
- 修改：`package.json`

**步骤：**

1. 先在 `package.json` 加 `"test": "vitest run"`。

2. 先写测试再写实现，覆盖这几种情况：

```ts
import { describe, expect, it } from "vitest";
import { buildPrompt } from "./build";

describe("buildPrompt", () => {
  it("把五组选项和主体拼成完整句子", () => {});
  it("对同一组输入产出完全一致的提示词", () => {});
  it("补充要求为空时不出现多余的空句子", () => {});
  it("非法选项 id 会抛错", () => {});
  it("比例决定实际请求的尺寸", () => {});
});
```

3. 运行并确认全部通过：

```bash
pnpm test
```

预期：5 个用例全部 PASS。

### 任务 3.4 提交

```bash
git add -A && git commit -m "feat: 提示词组装与选项字典"
```

## 阶段 4：生图链路

### 任务 4.1 把扣分与建记录合并成一个函数

**涉及文件：**
- 创建：`supabase/migrations/20261007000004_start_generation.sql`

**步骤：**

1. 阶段 1 写的 `reserve_credit` 有两个独立动作：扣分、建记录。
   如果两者分开执行，中途失败会留下「扣了分但没有记录」的状态，
   而对账任务是靠扫描 `generations` 找问题的，扫不到这种情况。
   所以把它们合成一个事务函数，`reserve_credit` 保留但不再被应用层调用。

```sql
create or replace function public.start_generation(
  p_user_id uuid,
  p_prompt text,
  p_options jsonb,
  p_subject text,
  p_notes text,
  p_size text,
  p_quality text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
  new_id uuid := gen_random_uuid();
begin
  update public.profiles set credits = credits - 1
   where id = p_user_id and credits >= 1;
  get diagnostics affected = row_count;
  if affected = 0 then
    return null;
  end if;

  insert into public.generations
    (id, user_id, status, prompt, options, subject, notes, size, quality)
  values
    (new_id, p_user_id, 'processing', p_prompt, p_options, p_subject, p_notes, p_size, p_quality);

  insert into public.credit_ledger (user_id, delta, reason, generation_id)
  values (p_user_id, -1, 'generation', new_id);

  return new_id;
end;
$$;
```

2. 验证：直接调一次函数，余额减 1 且 `generations` 多一条 `processing`；
   把余额改成 0 再调一次，应该返回 null 且不产生任何记录。

### 任务 4.2 Storage 桶与上传封装

**涉及文件：**
- 创建：`lib/storage/upload.ts`
- Supabase 控制台：新建 `generations` 桶

**步骤：**

1. 在 Supabase 建一个名为 `generations` 的私有桶。
2. 写上传封装，路径用用户 id 加随机 uuid，避免被顺序猜中：

```ts
const path = `${userId}/${crypto.randomUUID()}.png`;
```

3. 上传用的 service role 客户端从 `lib/supabase/admin.ts` 取。
4. 再加一个生成签名 URL 的函数，历史页用它显示图片，签名有效期设 1 小时。

### 任务 4.3 GPTImage 调用封装

**涉及文件：**
- 创建：`lib/openai/generate-image.ts`

**步骤：**

1. 用官方 SDK 封装一次调用，只暴露 prompt、size、quality 三个入参，
   返回图片二进制数据：

```ts
const response = await client.images.generate({
  model: "gpt-image-1",
  prompt,
  size,
  quality,
  n: 1,
});
```

2. 取图片数据时对缺失字段抛明确错误，不要返回 undefined 让上层猜。
3. 注意：字段名和取值需要按动手前的核对结果确认，设计文档已列出这一项风险。
   如果实际返回的是 URL 而不是 base64，把这个函数改成下载图片后返回二进制，
   上层无需改动。

### 任务 4.4 生图接口

**涉及文件：**
- 创建：`app/api/generate/route.ts`

**步骤：**

1. 声明运行时长上限并实现编排，顺序严格如下：

```ts
export const maxDuration = 60;
```

```
1. assertServerEnv()
2. 取当前会话用户，没有则返回 401
3. 解析请求体，只接受五个选项 id、主体、补充要求
4. buildPrompt() 得到 prompt、size、quality
5. 幂等检查：该用户已有 3 分钟内仍为 processing 的记录则直接返回该条
6. 调 start_generation，返回 null 则返回 402
7. 调 GPTImage
8. 上传到 Storage
9. 更新记录为 succeeded 并写入 storage_path
10. 返回图片签名 URL
```

2. 第 3 步要强调一件事：尺寸和画质由服务端从比例选项 id 推导，
   绝不接受前端传进来的 size 或 quality，否则用户可以自己指定高档画质。
3. 第 7 到 9 步包在 try 里，catch 中调 `refund_credit`，
   并把失败原因写进 `generations.error`，然后返回 502。
4. 前端错误码约定：401 未登录、402 积分不足、502 生成失败。

验证：用 curl 或页面发起一次真实生成，确认返回图片地址、
`generations` 记录为 succeeded、余额减 1。

### 任务 4.5 生图页前端

**涉及文件：**
- 创建：`app/[locale]/studio/page.tsx`
- 创建：`components/studio/option-panel.tsx`
- 创建：`components/studio/result-panel.tsx`

**步骤：**

1. 三栏布局：左侧选项面板、中间主体与补充要求输入、右侧结果预览。
   窄屏改为上下堆叠。
2. 选项组用分段控件表达，留白那组用可点选的小示意图表达更直观。
3. 提交后按钮进入禁用与加载状态，结果区显示生成中的进度状态。
4. 收到 402 时打开升级弹窗，而不是显示通用错误提示。
5. 选项状态放在客户端组件里，提交时只把选项 id 发给服务端。

验证：完整走一次生成，确认结果区出现图片，顶部积分减 1。

### 任务 4.6 提交

```bash
git add -A && git commit -m "feat: 生图接口与生图页"
```

## 阶段 5：对账任务

### 任务 5.1 对账接口

**涉及文件：**
- 创建：`app/api/cron/reconcile/route.ts`

**步骤：**

1. 只接受 GET，先校验请求头里的 `Authorization: Bearer ${CRON_SECRET}`，
   不匹配直接返回 401。
2. 查询 `status = 'processing'` 且 `created_at < now() - interval '3 minutes'` 的记录。
3. 对每条调 `refund_credit`，它内部会先锁住记录、确认状态仍是 processing，
   再退款并把状态改成 failed。
4. 返回处理条数，便于在 Vercel 日志里核对。

### 任务 5.2 配置定时触发

**涉及文件：**
- 创建：`vercel.json`

**步骤：**

1. 加入 Cron 配置，每 5 分钟调用一次对账接口：

```json
{
  "crons": [
    { "path": "/api/cron/reconcile", "schedule": "*/5 * * * *" }
  ]
}
```

2. 验证：手工把一条记录的时间改到 10 分钟前，调一次接口，
   确认积分退回、状态变为 failed。

### 任务 5.3 提交

```bash
git add -A && git commit -m "feat: 生成失败对账任务"
```

## 阶段 6：页面完善

### 任务 6.1 首页

**涉及文件：**
- 创建：`app/[locale]/page.tsx`
- 资源：若干张真实生成的作品示例图

**步骤：**

1. 首屏直接给出作品示例与进入生图页的主按钮，不放营销长文。
   页面必须有真实图像资产，不用色块或渐变撑版面。
2. 示例图用本项目自己的能力生成，覆盖不同类型的选项组合，
   放在 `public/samples/` 下。
3. 首屏在常见的手机与桌面宽度下都要能看到下一段内容的边缘，
   避免整屏只有一张图。
4. 未登录用户点主按钮跳登录页，已登录直接进生图页。

### 任务 6.2 历史页

**涉及文件：**
- 创建：`app/[locale]/history/page.tsx`
- 创建：`components/history/generation-detail.tsx`

**步骤：**

1. 服务端按 `created_at desc` 读当前用户的生成记录，分页一次取 24 条。
2. 网格展示缩略图，失败的记录显示明确的失败状态而不是空白格子。
3. 点开详情显示大图、完整提示词、全部选项、尺寸与时间。
4. 空状态给出去生图页的入口，不显示一片空白。

### 任务 6.3 升级弹窗

**涉及文件：**
- 创建：`components/studio/upgrade-dialog.tsx`

**步骤：**

1. 弹窗说明当前积分与生成所需积分，展示两到三档占位套餐。
2. 套餐按钮一律处于不可用状态并标注「即将开放」，
   不出现任何假的支付流程或假的订单号。
3. 顶部导航的固定升级入口打开同一个弹窗。

### 任务 6.4 提交

```bash
git add -A && git commit -m "feat: 首页、历史页与升级入口"
```

## 阶段 7：双语

### 任务 7.1 字典与语言切换

**涉及文件：**
- 创建：`lib/i18n/dictionary.ts`
- 创建：`lib/i18n/index.ts`
- 创建：`components/locale-switch.tsx`
- 修改：`app/[locale]/layout.tsx`

**步骤：**

1. 定义两个语言的字面量类型，字典对象用该类型约束键名，
   少写一条译文会在类型检查时报错。
2. 语言从路由段 `[locale]` 读取，默认 `zh`，非法值回落到 `zh`。
3. 切换语言时写入 cookie 并跳到对应语言的当前路径。
4. 选项字典里的 `labelZh` 与 `labelEn` 直接复用，不重复维护一套文案。
5. 提示词组装始终使用英文片段，与界面语言无关。

验证：切换语言后页面文案变化，且当前所在页面不丢失。

### 任务 7.2 提交

```bash
git add -A && git commit -m "feat: 中英双语切换"
```

## 阶段 8：验证与部署

### 任务 8.1 手动验证清单

逐条执行并把结果记在下面，任何一条不通过就先修再继续：

1. 新注册账号，积分显示 5，`credit_ledger` 有一条 `signup_bonus`
2. 连续生成 5 张，余额依次降到 0，每次都有一条 `generation` 流水
3. 第 6 次生成弹出升级提示，且没有产生任何扣分流水
4. 人为让模型调用失败，确认积分退回、状态为 failed、流水里有一条 `refund`
5. 历史页显示全部记录，点开能看到当时的完整提示词与参数
6. 切换中英文，文案变化且当前页面保持
7. 未登录直接访问生图页，被跳转到登录页

### 任务 8.2 部署

**步骤：**

1. 推送到远端仓库并在 Vercel 导入项目。
2. 在 Vercel 项目设置里配置五个环境变量，`SUPABASE_SERVICE_ROLE_KEY`
   与 `OPENAI_API_KEY` 只填在生产环境。
3. 部署后打开线上地址，跑一遍任务 8.1 的清单，重点确认第 2 和第 4 条。
4. 在 Vercel 的 Cron 面板确认对账任务已经注册，并查看一次执行日志。

### 任务 8.3 收尾提交

```bash
git add -A && git commit -m "chore: 部署配置与验证记录"
```

## 完成标准

- 站点有公开可访问的地址
- 注册赠 5 分、每张图扣 1 分、失败退分三条规则在线上都被验证过
- 积分耗尽时出现升级提示，且没有任何假的支付流程
- 生成历史可以看到图片与当时的提示词
- 中英双语可切换
- `lib/prompt` 的单元测试通过

## 已知未决项

1. GPTImage 的尺寸列表与返回字段需要在实际动手前核对，核对不通过则先改设计文档。
2. 中档画质在 Vercel 函数时长上限内的成功率需要实测，
   如果失败率偏高，需要评估升级套餐或改成异步任务。
3. 每个新账号消耗 5 次模型调用，上线前需要评估是否加更严格的频率限制。
