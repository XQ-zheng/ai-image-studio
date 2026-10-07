# AI 图片生成站 v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零做出一个可部署上线的 AI 图片生成站：用户勾选结构化选项，系统组装成专业 GPTImage 提示词并出图，配套登录、历史与积分闭环。

**Architecture:** Next.js App Router 单仓全栈，部署于 Vercel；Supabase 提供 Postgres、鉴权与对象存储。生图走同步链路，扣分与建记录由同一个 Postgres 事务函数完成，出图后写入 Storage，任何失败都退款；另有每 5 分钟一次的对账任务，兜住函数被时长上限杀掉的情况。

**Tech Stack:** Next.js 15（App Router、TypeScript）、Tailwind CSS、shadcn/ui、lucide-react、Supabase（Postgres + Auth + Storage）、OpenAI Images API（gpt-image-1）、Vercel（含 Cron）、Vitest、pnpm。

**Spec:** `docs/superpowers/specs/2026-10-07-ai-image-studio-design.md`

## Global Constraints

- 包管理器统一用 pnpm，Node 20 以上。
- 所有面向用户的界面文案同时提供中文与英文，默认中文。
- 代码标识符、文件名、数据库对象名统一 ASCII；界面文案、文档与注释可用中文。
- OpenAI API Key 与 Supabase service role key 只在服务端使用，绝不下发到浏览器。
- 扣分与建记录必须在同一个 Postgres 事务函数内完成，禁止拆成两步。
- 尺寸与画质由服务端从选项 id 推导，禁止接受前端传入的 size 或 quality。
- 画质固定为 medium，以常量形式导出，不散落硬编码。
- 每次生成固定消耗 1 积分；失败、超时、上传失败都必须退款。
- 提示词组装是纯函数：不发起网络请求，不调用大模型。
- 自动化测试只覆盖 lib/prompt。
- 第一版不做：真实支付、邮件、运营后台、复杂 SEO、图片编辑、参考图上传、多模型切换、批量生成。

---

## File Structure

| 文件 | 职责 |
| --- | --- |
| lib/env.ts | 启动时校验服务端环境变量 |
| lib/supabase/server.ts | 绑定 Next.js cookies 的服务端 Supabase 客户端 |
| lib/supabase/client.ts | 浏览器端 Supabase 客户端 |
| lib/supabase/admin.ts | service role 客户端，仅服务端可导入 |
| lib/prompt/catalog.ts | 五组选项字典与查找函数 |
| lib/prompt/build.ts | 纯函数：把选项拼装成提示词 |
| lib/openai/generate-image.ts | GPTImage 调用封装，返回图片二进制 |
| lib/storage/upload.ts | 上传图片到 Storage 并生成签名 URL |
| lib/i18n/index.ts | 语言读取与字典查找 |
| lib/i18n/dictionary.ts | 中英文文案字典 |
| lib/user/current.ts | 当前用户与积分读取 |
| app/api/generate/route.ts | 生图编排入口 |
| app/api/cron/reconcile/route.ts | 对账任务 |
| app/[locale]/page.tsx | 首页 |
| app/[locale]/studio/page.tsx | 生图页 |
| app/[locale]/history/page.tsx | 历史页 |
| app/[locale]/login/page.tsx | 登录与注册 |
| components/app-nav.tsx | 顶部导航 |
| components/login-form.tsx | 登录与注册表单 |
| components/studio/option-group.tsx | 选项组分段控件 |
| components/studio/studio-client.tsx | 生图页状态管理与提交 |
| components/studio/upgrade-dialog.tsx | 升级弹窗 |
| supabase/migrations/*.sql | 建表、函数、触发器、行级安全 |

---

### Task 1: 项目脚手架与依赖

**Files:**
- Create: 项目脚手架产物（package.json、app/、tsconfig.json 等）
- Modify: package.json（新增依赖与脚本）

**Interfaces:**
- Consumes: 无
- Produces: 可运行的 Next.js 项目；@/* 别名指向项目根目录

- [ ] **Step 1: 初始化 Next.js 项目**

Run: `pnpm dlx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"`

Expected: 当前目录出现 package.json、app/、tsconfig.json，且 tsconfig.json 的 paths 含 "@/*": ["./*"]。若出现交互提问，全部接受默认值。

- [ ] **Step 2: 安装运行依赖**

Run: `pnpm add @supabase/supabase-js @supabase/ssr openai lucide-react clsx tailwind-merge`

Expected: package.json 的 dependencies 中出现上述六个包。

- [ ] **Step 3: 安装开发依赖**

Run: `pnpm add -D vitest`

Expected: devDependencies 中出现 vitest。

- [ ] **Step 4: 初始化 shadcn/ui**

Run: `pnpm dlx shadcn@latest init -y`

再 Run: `pnpm dlx shadcn@latest add button input label dialog badge card separator toast`

Expected: 出现 components/ui/，其中有 button.tsx、input.tsx、dialog.tsx 等文件。

- [ ] **Step 5: 加入测试脚本**

在 package.json 的 scripts 中加入：

```json
"test": "vitest run"
```

Expected: 执行 `pnpm test` 时能启动 vitest（此时还没有测试文件，退出码为 0 或提示无测试文件）。

- [ ] **Step 6: 启动开发服务器确认可用**

Run: `pnpm dev`

Expected: 打开 http://localhost:3000 能显示页面。确认后按 Ctrl+C 退出。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "chore: 初始化 Next.js 项目与依赖"
```

### Task 2: 环境变量校验

**Files:**
- Create: `lib/env.ts`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 无
- Produces: `assertServerEnv(): void`，任一必需变量缺失时抛出 Error，消息中包含缺失变量名

- [ ] **Step 1: 写校验函数**

Create `lib/env.ts`:

```ts
const REQUIRED = [
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
] as const;

export function assertServerEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`缺少环境变量: ${missing.join(", ")}`);
  }
}
```

- [ ] **Step 2: 写示例文件**

Create `.env.example`，值全部留空：

```
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

- [ ] **Step 3: 确认 .gitignore 忽略真实环境文件**

`.gitignore` 中必须存在 `.env*`，并补一行 `!.env.example` 保证示例文件仍被跟踪。

- [ ] **Step 4: 类型检查**

Run: `pnpm exec tsc --noEmit`

Expected: 无类型错误。真实触发点在 Task 13 的生图接口里验证。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "chore: 环境变量校验"
```
### Task 3: 建表迁移

**Files:**
- Create: `supabase/migrations/20261007000001_init.sql`

**Interfaces:**
- Consumes: 无
- Produces: 表 `public.profiles`、`public.credit_ledger`、`public.generations`，以及枚举类型 `public.generation_status`

- [ ] **Step 1: 写迁移脚本**

Create `supabase/migrations/20261007000001_init.sql`:

```sql
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('signup_bonus', 'generation', 'refund')),
  generation_id uuid,
  created_at timestamptz not null default now()
);

create type public.generation_status as enum ('processing', 'succeeded', 'failed');

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

- [ ] **Step 2: 执行迁移**

Run（在项目根目录，使用 Supabase CLI 连接远端项目）: `pnpm dlx supabase db push`

若未使用 CLI，则把脚本内容贴进 Supabase 控制台的 SQL Editor 执行。

Expected: 执行无报错。

- [ ] **Step 3: 验证表已建立**

在 SQL Editor 执行：

```sql
select table_name
  from information_schema.tables
 where table_schema = 'public'
 order by table_name;
```

Expected: 结果中出现 credit_ledger、generations、profiles 三行。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 建表迁移"
```

### Task 4: 注册触发器与积分函数

**Files:**
- Create: `supabase/migrations/20261007000002_credits.sql`

**Interfaces:**
- Consumes: Task 3 建立的 `public.profiles`、`public.credit_ledger`、`public.generations`
- Produces:
  - 触发器 `on_auth_user_created`，注册后自动建 profile 并赠送 5 积分
  - `public.start_generation(p_user_id uuid, p_prompt text, p_options jsonb, p_subject text, p_notes text, p_size text, p_quality text) returns uuid`，成功返回新记录 id，积分不足返回 null
  - `public.refund_credit(p_generation_id uuid) returns boolean`，退款成功返回 true

- [ ] **Step 1: 写注册触发器**

Create `supabase/migrations/20261007000002_credits.sql`，先写触发器：

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

- [ ] **Step 2: 写扣分与建记录的事务函数**

追加到同一文件：

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
  update public.profiles
     set credits = credits - 1
   where id = p_user_id
     and credits >= 1;

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

- [ ] **Step 3: 写退款函数**

追加到同一文件：

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
   where g.id = p_generation_id
     and g.status = 'processing'
   for update;

  if owner_id is null then
    return false;
  end if;

  update public.profiles set credits = credits + 1 where id = owner_id;

  insert into public.credit_ledger (user_id, delta, reason, generation_id)
    values (owner_id, 1, 'refund', p_generation_id);

  update public.generations
     set status = 'failed',
         error = coalesce(error, 'refunded'),
         updated_at = now()
   where id = p_generation_id;

  return true;
end;
$$;
```

- [ ] **Step 4: 执行迁移**

Run: `pnpm dlx supabase db push`

Expected: 无报错。

- [ ] **Step 5: 验证扣分与退款**

在 SQL Editor 里，先把某个测试账号的余额设为 1：

```sql
update public.profiles set credits = 1 where id = '<测试用户 uuid>';
```

再调用一次生成函数：

```sql
select public.start_generation(
  '<测试用户 uuid>'::uuid,
  'test prompt',
  '{}'::jsonb,
  '',
  '',
  '1024x1024',
  'medium'
);
```

Expected: 返回一个新 uuid；`select credits from public.profiles where id = '<测试用户 uuid>'` 得到 0；`generations` 多一条 processing 记录；`credit_ledger` 多一条 delta 为 -1 的 generation 流水。

- [ ] **Step 6: 验证余额不足时不产生记录**

再次调用同一个函数。

Expected: 返回 null；`generations` 与 `credit_ledger` 都不新增任何行。

- [ ] **Step 7: 验证退款**

用上一步拿到的记录 id 调用：

```sql
select public.refund_credit('<生成记录 uuid>'::uuid);
```

Expected: 返回 true；余额回到 1；该记录状态变为 failed；`credit_ledger` 多一条 delta 为 1 的 refund 流水。再次调用同一函数应返回 false 且不再加分。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat: 注册触发器与积分事务函数"
```
### Task 5: 行级安全策略

**Files:**
- Create: `supabase/migrations/20261007000003_rls.sql`

**Interfaces:**
- Consumes: Task 3 建立的三张表
- Produces: 三张表的行级安全策略，用户只能读自己的数据；不提供任何写策略

- [ ] **Step 1: 写策略脚本**

Create `supabase/migrations/20261007000003_rls.sql`:

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

- [ ] **Step 2: 执行迁移**

Run: `pnpm dlx supabase db push`

Expected: 无报错。

- [ ] **Step 3: 验证策略已生效**

在 SQL Editor 执行：

```sql
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public';
```

Expected: 三张表的 rowsecurity 都是 true。

- [ ] **Step 4: 确认没有写策略**

执行：

```sql
select tablename, cmd
  from pg_policies
 where schemaname = 'public';
```

Expected: 只有三行，cmd 全部是 SELECT。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 行级安全策略"
```

### Task 6: 提示词选项字典

**Files:**
- Create: `lib/prompt/catalog.ts`

**Interfaces:**
- Consumes: 无
- Produces: 类型 `OptionItem`、`RatioItem`；常量 `imageTypes`、`ratios`、`styles`、`scenes`、`whitespaces`；不会与其他任务共享函数

- [ ] **Step 1: 写字典**

Create `lib/prompt/catalog.ts`:

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

export const styles: OptionItem[] = [
  { id: "minimal", labelZh: "简约现代", labelEn: "Minimal modern", fragment: "a clean minimal modern aesthetic" },
  { id: "business", labelZh: "商务专业", labelEn: "Business", fragment: "a polished professional business aesthetic" },
  { id: "warm", labelZh: "温暖治愈", labelEn: "Warm and cozy", fragment: "a warm and comforting mood" },
  { id: "tech", labelZh: "科技感", labelEn: "Tech", fragment: "a futuristic technology mood" },
  { id: "retro", labelZh: "复古胶片", labelEn: "Retro film", fragment: "a retro film photography look" },
];

export const scenes: OptionItem[] = [
  { id: "solid", labelZh: "纯色背景", labelEn: "Solid background", fragment: "on a plain solid color background" },
  { id: "indoor", labelZh: "室内", labelEn: "Indoor", fragment: "in a realistic indoor setting" },
  { id: "nature", labelZh: "自然环境", labelEn: "Nature", fragment: "in a natural outdoor setting" },
  { id: "city", labelZh: "城市街景", labelEn: "City", fragment: "in an urban street setting" },
  { id: "abstract", labelZh: "抽象空间", labelEn: "Abstract", fragment: "in an abstract spatial environment" },
];

export const whitespaces: OptionItem[] = [
  { id: "none", labelZh: "无留白满构图", labelEn: "Full bleed", fragment: "fill the entire frame with no empty space" },
  { id: "even", labelZh: "四周均匀留白", labelEn: "Even margin", fragment: "leave an even margin of empty space around the subject" },
  { id: "top", labelZh: "顶部留白留标题位", labelEn: "Top space", fragment: "leave clean empty space along the top of the frame for a title" },
  { id: "wide", labelZh: "大面积负空间", labelEn: "Negative space", fragment: "use generous negative space around the subject" },
];
```

- [ ] **Step 2: 类型检查**

Run: `pnpm exec tsc --noEmit`

Expected: 无类型错误。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 提示词选项字典"
```

### Task 7: 提示词组装函数

**Files:**
- Create: `lib/prompt/build.ts`
- Test: `lib/prompt/build.test.ts`

**Interfaces:**
- Consumes: `lib/prompt/catalog.ts` 的 `imageTypes`、`ratios`、`styles`、`scenes`、`whitespaces`、`OptionItem`
- Produces: 常量 `QUALITY`；类型 `PromptInput`、`BuiltPrompt`；函数 `buildPrompt(input: PromptInput): BuiltPrompt`。`BuiltPrompt` 形如 `{ prompt: string; size: string; quality: string; options: PromptInput }`

- [ ] **Step 1: 写失败的测试**

Create `lib/prompt/build.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPrompt } from "./build";
import type { PromptInput } from "./build";

const base: PromptInput = {
  imageTypeId: "photo",
  ratioId: "square",
  styleId: "minimal",
  sceneId: "solid",
  whitespaceId: "none",
  subject: "一只戴着圆眼镜的橘猫",
  notes: "",
};

describe("buildPrompt", () => {
  it("把选项与主体拼成完整句子", () => {
    const { prompt } = buildPrompt(base);
    expect(prompt).toContain("Create a photorealistic image.");
    expect(prompt).toContain("一只戴着圆眼镜的橘猫");
    expect(prompt).toContain("square composition at 1024x1024");
  });

  it("同一组输入产出完全一致的提示词", () => {
    expect(buildPrompt(base).prompt).toBe(buildPrompt(base).prompt);
  });

  it("补充要求为空时不出现多余句子", () => {
    expect(buildPrompt(base).prompt).not.toContain("Additional requirements");
  });

  it("补充要求非空时会被拼接", () => {
    const { prompt } = buildPrompt({ ...base, notes: "背景要干净" });
    expect(prompt).toContain("Additional requirements: 背景要干净.");
  });

  it("非法选项 id 会抛错", () => {
    expect(() => buildPrompt({ ...base, ratioId: "16:9" })).toThrow(/未知的比例选项/);
  });

  it("主体为空会抛错", () => {
    expect(() => buildPrompt({ ...base, subject: "   " })).toThrow(/主体不能为空/);
  });

  it("比例决定实际请求的尺寸", () => {
    expect(buildPrompt({ ...base, ratioId: "portrait" }).size).toBe("1024x1536");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test`

Expected: FAIL，报错指出 `lib/prompt/build.ts` 无法解析或 buildPrompt 未导出。

- [ ] **Step 3: 写实现**

Create `lib/prompt/build.ts`:

```ts
import {
  imageTypes,
  ratios,
  scenes,
  styles,
  whitespaces,
  type OptionItem,
} from "./catalog";

export const QUALITY = "medium";

const MAX_SUBJECT_LENGTH = 300;
const MAX_NOTES_LENGTH = 300;

export type PromptInput = {
  imageTypeId: string;
  ratioId: string;
  styleId: string;
  sceneId: string;
  whitespaceId: string;
  subject: string;
  notes: string;
};

export type BuiltPrompt = {
  prompt: string;
  size: string;
  quality: string;
  options: PromptInput;
};

function pick<T extends OptionItem>(list: T[], id: string, group: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) {
    throw new Error(`未知的${group}选项: ${id}`);
  }
  return found;
}

function clean(text: string, limit: number): string {
  return text.trim().replace(/\s+/g, " ").slice(0, limit);
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
  const imageType = pick(imageTypes, input.imageTypeId, "图片类型");
  const ratio = pick(ratios, input.ratioId, "比例");
  const style = pick(styles, input.styleId, "风格");
  const scene = pick(scenes, input.sceneId, "场景");
  const whitespace = pick(whitespaces, input.whitespaceId, "留白");

  const subject = clean(input.subject, MAX_SUBJECT_LENGTH);
  if (!subject) {
    throw new Error("主体不能为空");
  }
  const notes = clean(input.notes, MAX_NOTES_LENGTH);

  const sentences = [
    `Create ${imageType.fragment}.`,
    `The subject is: ${subject}.`,
    `Render it in ${style.fragment}.`,
    `Place the subject ${scene.fragment}.`,
    `For composition, ${whitespace.fragment}.`,
    `Use a ${ratio.fragment} at ${ratio.size}.`,
  ];

  if (notes) {
    sentences.push(`Additional requirements: ${notes}.`);
  }

  return {
    prompt: sentences.join(" "),
    size: ratio.size,
    quality: QUALITY,
    options: input,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test`

Expected: 7 个用例全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 提示词组装函数与测试"
```
### Task 8: Supabase 客户端

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/admin.ts`

**Interfaces:**
- Consumes: 环境变量 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
- Produces: `createServerSupabase()`（异步，读当前会话）、`createBrowserSupabase()`、`createAdminSupabase()`

- [ ] **Step 1: 写服务端客户端**

Create `lib/supabase/server.ts`:

```ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
```

- [ ] **Step 2: 写浏览器端客户端**

Create `lib/supabase/client.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: 写 service role 客户端**

Create `lib/supabase/admin.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

// 只能在服务端导入。使用 service role key，会绕过行级安全。
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step 4: 类型检查**

Run: `pnpm exec tsc --noEmit`

Expected: 无类型错误。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: Supabase 客户端"
```

### Task 9: 双语字典与语言读取

**Files:**
- Create: `lib/i18n/dictionary.ts`
- Create: `lib/i18n/index.ts`

**Interfaces:**
- Consumes: 无
- Produces: 类型 `Locale`、`Dictionary`；常量 `locales`、`dictionary`；函数 `resolveLocale(value: string \| undefined): Locale`、`getDictionary(locale: Locale): Dictionary`

- [ ] **Step 1: 以中文为基准写字典**

Create `lib/i18n/dictionary.ts`。中文是基准，英文用同一类型约束，少写一个键就会在类型检查时报错：

```ts
export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];

const zh = {
  nav: {
    studio: "生图",
    history: "历史",
    credits: "积分",
    upgrade: "升级",
    login: "登录",
    logout: "退出",
  },
  home: {
    title: "把选项拼成专业提示词",
    subtitle: "选好类型、比例、风格、场景与留白，写下你的主体，剩下的交给系统。",
    cta: "开始生成",
    samples: "作品示例",
  },
  studio: {
    title: "生成图片",
    imageType: "图片类型",
    ratio: "比例",
    style: "风格",
    scene: "场景",
    whitespace: "留白",
    subject: "主体",
    subjectPlaceholder: "例如：一只戴着圆眼镜的橘猫",
    notes: "补充要求",
    notesPlaceholder: "可选，例如：背景要干净",
    submit: "生成",
    generating: "正在生成，请稍候",
    retry: "重试",
    download: "下载",
    failed: "这次生成失败了，积分已经退回",
  },
  history: {
    title: "生成历史",
    empty: "还没有生成记录",
    emptyCta: "去生成一张",
    detail: "详情",
    prompt: "使用的提示词",
    options: "参数",
    createdAt: "时间",
    failed: "生成失败",
  },
  login: {
    title: "登录或注册",
    email: "邮箱",
    password: "密码",
    signIn: "登录",
    signUp: "注册",
    toSignUp: "还没有账号？去注册",
    toSignIn: "已有账号？去登录",
    invalidInput: "请填写邮箱和至少 6 位密码",
  },
  upgrade: {
    title: "积分不足",
    description: "每次生成消耗 1 积分。升级入口即将开放。",
    current: "当前积分",
    required: "本次需要",
    close: "知道了",
    comingSoon: "即将开放",
  },
};

export type Dictionary = typeof zh;

const en: Dictionary = {
  nav: {
    studio: "Create",
    history: "History",
    credits: "Credits",
    upgrade: "Upgrade",
    login: "Sign in",
    logout: "Sign out",
  },
  home: {
    title: "Turn choices into a professional prompt",
    subtitle: "Pick a type, ratio, style, scene and whitespace, describe your subject, and let the system do the rest.",
    cta: "Start creating",
    samples: "Samples",
  },
  studio: {
    title: "Generate an image",
    imageType: "Image type",
    ratio: "Ratio",
    style: "Style",
    scene: "Scene",
    whitespace: "Whitespace",
    subject: "Subject",
    subjectPlaceholder: "e.g. an orange cat wearing round glasses",
    notes: "Extra requirements",
    notesPlaceholder: "optional, e.g. keep the background clean",
    submit: "Generate",
    generating: "Generating, please wait",
    retry: "Try again",
    download: "Download",
    failed: "This run failed and the credit was refunded",
  },
  history: {
    title: "History",
    empty: "No generations yet",
    emptyCta: "Create your first image",
    detail: "Details",
    prompt: "Prompt used",
    options: "Options",
    createdAt: "Created",
    failed: "Failed",
  },
  login: {
    title: "Sign in or sign up",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signUp: "Sign up",
    toSignUp: "No account yet? Sign up",
    toSignIn: "Already have an account? Sign in",
    invalidInput: "Enter an email and a password of at least 6 characters",
  },
  upgrade: {
    title: "Not enough credits",
    description: "Each generation costs 1 credit. Upgrades are coming soon.",
    current: "Current credits",
    required: "Required",
    close: "Got it",
    comingSoon: "Coming soon",
  },
};

export const dictionary: Record<Locale, Dictionary> = { zh, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionary[locale];
}
```

- [ ] **Step 2: 写语言读取**

Create `lib/i18n/index.ts`:

```ts
import { locales, type Locale } from "./dictionary";

export * from "./dictionary";

export function resolveLocale(value: string | undefined): Locale {
  if (value && (locales as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return "zh";
}
```

- [ ] **Step 3: 类型检查**

Run: `pnpm exec tsc --noEmit`

Expected: 无类型错误。故意删掉 en 里的一个键再跑一次，应报缺少属性，确认约束真的生效，然后改回来。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 中英文字典与语言读取"
```

### Task 10: 注册与登录

**Files:**
- Create: `lib/auth/actions.ts`
- Create: `components/login-form.tsx`
- Create: `app/[locale]/login/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabase()`（Task 8）、`getDictionary`/`resolveLocale`（Task 9）
- Produces: `signUpAction`、`signInAction`、`signOutAction`；类型 `AuthState = { error: string | null }`；组件 `LoginForm`

- [ ] **Step 1: 写 server actions**

Create `lib/auth/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type AuthState = { error: string | null };

function read(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    locale: String(formData.get("locale") ?? "zh"),
  };
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password, locale } = read(formData);
  if (!email || password.length < 6) {
    return { error: "invalid_input" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return { error: error.message };
  }

  redirect(`/${locale}/studio`);
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password, locale } = read(formData);
  if (!email || password.length < 6) {
    return { error: "invalid_input" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  redirect(`/${locale}/studio`);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "zh");
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}
```

- [ ] **Step 2: 写登录表单**

Create `components/login-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthState } from "@/lib/auth/actions";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: AuthState = { error: null };

export function LoginForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const action = mode === "signIn" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <label className="flex flex-col gap-1 text-sm">
        {dict.login.email}
        <Input name="email" type="email" required autoComplete="email" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {dict.login.password}
        <Input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
        />
      </label>

      {state.error ? (
        <p className="text-sm text-red-600">
          {state.error === "invalid_input" ? dict.login.invalidInput : state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {mode === "signIn" ? dict.login.signIn : dict.login.signUp}
      </Button>

      <button
        type="button"
        className="text-sm text-neutral-600 underline"
        onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
      >
        {mode === "signIn" ? dict.login.toSignUp : dict.login.toSignIn}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: 写登录页**

Create `app/[locale]/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/login-form";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <main className="mx-auto flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">{dict.login.title}</h1>
      <LoginForm locale={locale} dict={dict} />
    </main>
  );
}
```

- [ ] **Step 4: 需要先建一个最小 layout 才能跑起来**

若 `app/[locale]/layout.tsx` 尚不存在，Create 它并至少包含：

```tsx
export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 5: 手动验证**

Run: `pnpm dev`

打开 `http://localhost:3000/zh/login`，注册一个新账号。

Expected: 注册后跳转到 `/zh/studio`（该页面在 Task 15 才实现，此时出现 404 属于正常，重点是跳到 studio 路径且浏览器已有会话 cookie）。在 Supabase 控制台确认 profiles 多一行、credits 为 5。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: 注册与登录"
```
### Task 11: 当前用户读取与全局导航

**Files:**
- Create: `lib/user/current.ts`
- Create: `components/app-nav.tsx`
- Modify: `app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `createServerSupabase()`（Task 8）、`signOutAction`（Task 10）、`getDictionary`/`resolveLocale`（Task 9）
- Produces: `getCurrentProfile(): Promise<CurrentProfile | null>`，`CurrentProfile = { userId: string; credits: number }`；组件 `AppNav`

- [ ] **Step 1: 写当前用户读取**

Create `lib/user/current.ts`：

```ts
import { createServerSupabase } from "@/lib/supabase/server";

export type CurrentProfile = {
  userId: string;
  credits: number;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return { userId: user.id, credits: data.credits };
}
```

- [ ] **Step 2: 写导航组件**

Create `components/app-nav.tsx`。积分在服务端渲染时读出来，避免首屏闪一个错误数字：

```tsx
import Link from "next/link";
import { Coins, LogOut, Sparkles } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { getCurrentProfile } from "@/lib/user/current";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export async function AppNav({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const profile = await getCurrentProfile();

  return (
    <header className="border-b border-neutral-200">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <Link href={`/${locale}`} className="font-semibold">
          ImageStudio
        </Link>

        <Link href={`/${locale}/studio`} className="text-sm">
          {dict.nav.studio}
        </Link>
        <Link href={`/${locale}/history`} className="text-sm">
          {dict.nav.history}
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {profile ? (
            <>
              <span className="flex items-center gap-1 text-sm tabular-nums">
                <Coins className="h-4 w-4" aria-hidden />
                {profile.credits}
              </span>
              <Link
                href={`/${locale}/studio?upgrade=1`}
                className="flex items-center gap-1 text-sm"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {dict.nav.upgrade}
              </Link>
              <form action={signOutAction}>
                <input type="hidden" name="locale" value={locale} />
                <Button type="submit" variant="ghost" size="sm">
                  <LogOut className="h-4 w-4" aria-hidden />
                  {dict.nav.logout}
                </Button>
              </form>
            </>
          ) : (
            <Link href={`/${locale}/login`}>{dict.nav.login}</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 3: 接进布局**

Modify `app/[locale]/layout.tsx`：

```tsx
import { AppNav } from "@/components/app-nav";
import { getDictionary, resolveLocale } from "@/lib/i18n";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <AppNav locale={locale} dict={dict} />
      {children}
    </div>
  );
}
```

- [ ] **Step 4: 手动验证**

Run: `pnpm dev`

打开 `http://localhost:3000/zh`。

Expected: 页面顶部出现导航；未登录时右侧显示登录链接；登录后显示积分数值、升级入口与退出按钮；点退出回到未登录状态。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 当前用户读取与全局导航"
```

### Task 12: Storage 上传封装

**Files:**
- Create: `lib/storage/upload.ts`

**Interfaces:**
- Consumes: `createAdminSupabase()`（Task 8）
- Produces: `uploadGenerationImage(userId: string, data: Buffer): Promise<string>` 返回存储路径；`createSignedImageUrl(path: string, expiresInSeconds?: number): Promise<string>` 返回可直接放进 img 的地址

- [ ] **Step 1: 建私有桶**

在 Supabase 控制台 Storage 里新建一个名为 `generations` 的私有桶（Public bucket 关闭）。

Expected: 桶列表中出现 generations，且标记为 Private。

- [ ] **Step 2: 写上传与签名**

Create `lib/storage/upload.ts`：

```ts
import { createAdminSupabase } from "@/lib/supabase/admin";

const BUCKET = "generations";

export async function uploadGenerationImage(
  userId: string,
  data: Buffer,
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.png`;
  const admin = createAdminSupabase();

  const { error } = await admin.storage.from(BUCKET).upload(path, data, {
    contentType: "image/png",
    upsert: false,
  });

  if (error) {
    throw new Error(`图片上传失败: ${error.message}`);
  }

  return path;
}

export async function createSignedImageUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw new Error(`签名地址生成失败: ${error?.message ?? "unknown"}`);
  }

  return data.signedUrl;
}
```

- [ ] **Step 3: 类型检查**

Run: `pnpm exec tsc --noEmit`

Expected: 无类型错误。真实上传在 Task 14 的端到端验证里触发。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: Storage 上传封装"
```

### Task 13: GPTImage 调用封装

**Files:**
- Create: `lib/openai/generate-image.ts`

**Interfaces:**
- Consumes: 环境变量 `OPENAI_API_KEY`
- Produces: `generateImage(params: { prompt: string; size: string; quality: string }): Promise<Buffer>`

- [ ] **Step 1: 确认接口参数**

对照官方文档确认 gpt-image-1 的尺寸取值、quality 取值与返回字段名。设计文档第 16 节把这一项列为未决风险。若接口已变化，先改设计文档再改这里的代码。

- [ ] **Step 2: 写封装**

Create `lib/openai/generate-image.ts`：

```ts
import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function generateImage(params: {
  prompt: string;
  size: string;
  quality: string;
}): Promise<Buffer> {
  const response = await getClient().images.generate({
    model: "gpt-image-1",
    prompt: params.prompt,
    size: params.size as "1024x1024" | "1536x1024" | "1024x1536",
    quality: params.quality as "low" | "medium" | "high" | "auto",
    n: 1,
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error("模型未返回图片数据");
  }

  return Buffer.from(base64, "base64");
}
```

- [ ] **Step 3: 类型检查**

Run: `pnpm exec tsc --noEmit`

Expected: 无类型错误。真实调用在 Task 14 验证。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: GPTImage 调用封装"
```
### Task 14: 生图接口

**Files:**
- Create: `app/api/generate/route.ts`

**Interfaces:**
- Consumes: `assertServerEnv`（Task 2）、`createServerSupabase`/`createAdminSupabase`（Task 8）、`buildPrompt`/`PromptInput`（Task 7）、`generateImage`（Task 13）、`uploadGenerationImage`/`createSignedImageUrl`（Task 12）、数据库函数 `start_generation` 与 `refund_credit`（Task 4）
- Produces: `POST /api/generate`。请求体为七个字段：imageTypeId、ratioId、styleId、sceneId、whitespaceId、subject、notes。成功返回 `{ generationId, url }`；401 未登录；400 选项非法；402 积分不足；409 已有进行中的生成；502 生成失败

- [ ] **Step 1: 写路由**

Create `app/api/generate/route.ts`：

```ts
import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildPrompt, type PromptInput } from "@/lib/prompt/build";
import { generateImage } from "@/lib/openai/generate-image";
import { uploadGenerationImage, createSignedImageUrl } from "@/lib/storage/upload";

export const maxDuration = 60;

const IN_PROGRESS_WINDOW_MS = 3 * 60 * 1000;

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseInput(body: unknown): PromptInput {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    imageTypeId: readString(raw.imageTypeId),
    ratioId: readString(raw.ratioId),
    styleId: readString(raw.styleId),
    sceneId: readString(raw.sceneId),
    whitespaceId: readString(raw.whitespaceId),
    subject: readString(raw.subject),
    notes: readString(raw.notes),
  };
}

export async function POST(request: Request) {
  assertServerEnv();

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let input: PromptInput;
  try {
    input = parseInput(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  let built;
  try {
    built = buildPrompt(input);
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_options",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 400 },
    );
  }

  const admin = createAdminSupabase();

  const since = new Date(Date.now() - IN_PROGRESS_WINDOW_MS).toISOString();
  const { data: pending } = await admin
    .from("generations")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "processing")
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  if (pending) {
    return NextResponse.json({ error: "in_progress" }, { status: 409 });
  }

  const { data: generationId, error: startError } = await admin.rpc(
    "start_generation",
    {
      p_user_id: user.id,
      p_prompt: built.prompt,
      p_options: input,
      p_subject: input.subject,
      p_notes: input.notes,
      p_size: built.size,
      p_quality: built.quality,
    },
  );

  if (startError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  if (!generationId) {
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
  }

  try {
    const image = await generateImage({
      prompt: built.prompt,
      size: built.size,
      quality: built.quality,
    });

    const path = await uploadGenerationImage(user.id, image);

    const { error: updateError } = await admin
      .from("generations")
      .update({
        status: "succeeded",
        storage_path: path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const url = await createSignedImageUrl(path);
    return NextResponse.json({ generationId, url });
  } catch (error) {
    await admin.rpc("refund_credit", { p_generation_id: generationId });
    await admin
      .from("generations")
      .update({ error: error instanceof Error ? error.message : "unknown" })
      .eq("id", generationId);

    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }
}
```

- [ ] **Step 2: 启动开发服务器**

Run: `pnpm dev`

- [ ] **Step 3: 手动触发一次生成**

在浏览器登录后，打开 `http://localhost:3000/zh`，按 F12 打开控制台，粘贴执行：

```js
await fetch("/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    imageTypeId: "photo",
    ratioId: "square",
    styleId: "minimal",
    sceneId: "solid",
    whitespaceId: "none",
    subject: "一只戴着圆眼镜的橘猫",
    notes: "",
  }),
}).then((r) => r.json().then((b) => ({ status: r.status, body: b })));
```

Expected: 返回 status 200，body 里有 url。打开该 url 能看到生成的图片。

- [ ] **Step 4: 核对数据库状态**

在 Supabase 表编辑器查看 `generations` 与 `profiles`。

Expected: 多一条 succeeded 记录且 storage_path 非空；对应账号 credits 减 1；`credit_ledger` 多一条 delta 为 -1 的 generation 流水。

- [ ] **Step 5: 验证积分不足分支**

在 SQL Editor 把该账号 credits 改成 0，再执行一次 Step 3 的脚本。

Expected: 返回 status 402，body 为 `{ "error": "insufficient_credits" }`；`generations` 不新增记录。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: 生图接口"
```

### Task 15: 升级弹窗

**Files:**
- Create: `components/studio/upgrade-dialog.tsx`

**Interfaces:**
- Consumes: `Dictionary`（Task 9）、`components/ui/dialog`（Task 1）
- Produces: 组件 `UpgradeDialog`，属性为 `{ open: boolean; onOpenChange: (open: boolean) => void; locale: Locale; dict: Dictionary; credits: number }`

- [ ] **Step 1: 写弹窗**

Create `components/studio/upgrade-dialog.tsx`：

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Dictionary, Locale } from "@/lib/i18n";

const PLANS = [
  { id: "starter", zh: "体验包 · 20 积分", en: "Starter · 20 credits" },
  { id: "plus", zh: "标准包 · 60 积分", en: "Plus · 60 credits" },
  { id: "pro", zh: "专业包 · 200 积分", en: "Pro · 200 credits" },
];

export function UpgradeDialog({
  open,
  onOpenChange,
  locale,
  dict,
  credits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  dict: Dictionary;
  credits: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.upgrade.title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-neutral-600">{dict.upgrade.description}</p>

        <div className="flex gap-6 text-sm">
          <span>
            {dict.upgrade.current}:{" "}
            <span className="tabular-nums">{credits}</span>
          </span>
          <span>
            {dict.upgrade.required}: <span className="tabular-nums">1</span>
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {PLANS.map((plan) => (
            <li
              key={plan.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2"
            >
              <span className="text-sm">
                {locale === "zh" ? plan.zh : plan.en}
              </span>
              <Button variant="outline" size="sm" disabled>
                {dict.upgrade.comingSoon}
              </Button>
            </li>
          ))}
        </ul>

        <Button onClick={() => onOpenChange(false)}>{dict.upgrade.close}</Button>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm exec tsc --noEmit`

Expected: 无类型错误。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: 升级弹窗"
```
### Task 16: 生图页

**Files:**
- Create: `components/studio/option-group.tsx`
- Create: `components/studio/studio-client.tsx`
- Create: `app/[locale]/studio/page.tsx`
- Modify: 依赖（新增 shadcn textarea）

**Interfaces:**
- Consumes: `OptionItem` 与五组字典（Task 6）、`UpgradeDialog`（Task 15）、`getCurrentProfile`（Task 11）、`getDictionary`/`resolveLocale`（Task 9）、`POST /api/generate`（Task 14）
- Produces: 组件 `OptionGroup`、`StudioClient`；页面 `/studio`

- [ ] **Step 1: 补一个输入组件**

Run: `pnpm dlx shadcn@latest add textarea`

Expected: 出现 `components/ui/textarea.tsx`。

- [ ] **Step 2: 写选项组组件**

Create `components/studio/option-group.tsx`。选项组统一用分段控件表达，不用下拉框：

```tsx
"use client";

import type { OptionItem } from "@/lib/prompt/catalog";
import type { Locale } from "@/lib/i18n";

export function OptionGroup({
  title,
  items,
  value,
  locale,
  onChange,
}: {
  title: string;
  items: OptionItem[];
  value: string;
  locale: Locale;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{title}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(item.id)}
              className={
                active
                  ? "rounded-md border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white"
                  : "rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:border-neutral-500"
              }
            >
              {locale === "zh" ? item.labelZh : item.labelEn}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 3: 写生图页客户端组件**

Create `components/studio/studio-client.tsx`：

```tsx
"use client";

import { useState } from "react";
import {
  imageTypes,
  ratios,
  scenes,
  styles,
  whitespaces,
} from "@/lib/prompt/catalog";
import { OptionGroup } from "./option-group";
import { UpgradeDialog } from "./upgrade-dialog";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ErrorKind = "insufficient" | "failed" | null;

export function StudioClient({
  locale,
  dict,
  initialCredits,
  upgradeOpen,
}: {
  locale: Locale;
  dict: Dictionary;
  initialCredits: number;
  upgradeOpen: boolean;
}) {
  const [imageTypeId, setImageTypeId] = useState(imageTypes[0].id);
  const [ratioId, setRatioId] = useState(ratios[0].id);
  const [styleId, setStyleId] = useState(styles[0].id);
  const [sceneId, setSceneId] = useState(scenes[0].id);
  const [whitespaceId, setWhitespaceId] = useState(whitespaces[0].id);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");

  const [pending, setPending] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<ErrorKind>(null);
  const [credits, setCredits] = useState(initialCredits);
  const [upgrade, setUpgrade] = useState(upgradeOpen);

  async function submit() {
    if (pending || subject.trim().length === 0) {
      return;
    }

    setPending(true);
    setError(null);
    setImageUrl(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageTypeId,
          ratioId,
          styleId,
          sceneId,
          whitespaceId,
          subject,
          notes,
        }),
      });

      if (response.status === 402) {
        setError("insufficient");
        setUpgrade(true);
        return;
      }

      if (!response.ok) {
        setError("failed");
        return;
      }

      const data = (await response.json()) as { url: string };
      setImageUrl(data.url);
      setCredits((value) => value - 1);
    } catch {
      setError("failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[260px_1fr_1fr]">
      <section className="flex flex-col gap-6">
        <OptionGroup title={dict.studio.imageType} items={imageTypes} value={imageTypeId} locale={locale} onChange={setImageTypeId} />
        <OptionGroup title={dict.studio.ratio} items={ratios} value={ratioId} locale={locale} onChange={setRatioId} />
        <OptionGroup title={dict.studio.style} items={styles} value={styleId} locale={locale} onChange={setStyleId} />
        <OptionGroup title={dict.studio.scene} items={scenes} value={sceneId} locale={locale} onChange={setSceneId} />
        <OptionGroup title={dict.studio.whitespace} items={whitespaces} value={whitespaceId} locale={locale} onChange={setWhitespaceId} />
      </section>

      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {dict.studio.subject}
          <Textarea
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={dict.studio.subjectPlaceholder}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {dict.studio.notes}
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={dict.studio.notesPlaceholder}
          />
        </label>

        <Button onClick={submit} disabled={pending || subject.trim().length === 0}>
          {pending ? dict.studio.generating : dict.studio.submit}
        </Button>

        {error === "failed" ? (
          <p className="text-sm text-red-600">{dict.studio.failed}</p>
        ) : null}

        <p className="text-sm tabular-nums text-neutral-500">
          {dict.nav.credits}: {credits}
        </p>
      </section>

      <section className="flex min-h-[360px] items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        {pending ? (
          <p className="text-sm text-neutral-500">{dict.studio.generating}</p>
        ) : imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={subject}
              className="max-h-[520px] w-auto rounded-md"
            />
          </>
        ) : (
          <p className="max-w-xs text-center text-sm text-neutral-400">
            {dict.studio.subjectPlaceholder}
          </p>
        )}
      </section>

      <UpgradeDialog
        open={upgrade}
        onOpenChange={setUpgrade}
        locale={locale}
        dict={dict}
        credits={credits}
      />
    </main>
  );
}
```

- [ ] **Step 4: 写生图页**

Create `app/[locale]/studio/page.tsx`：

```tsx
import { redirect } from "next/navigation";
import { StudioClient } from "@/components/studio/studio-client";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { getCurrentProfile } from "@/lib/user/current";

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/${locale}/login`);
  }

  const upgradeOpen = (await searchParams).upgrade === "1";

  return (
    <StudioClient
      locale={locale}
      dict={dict}
      initialCredits={profile.credits}
      upgradeOpen={upgradeOpen}
    />
  );
}
```

- [ ] **Step 5: 手动验证主流程**

Run: `pnpm dev`

登录后打开 `http://localhost:3000/zh/studio`，选一组选项、填主体、点生成。

Expected: 按钮进入生成中状态并禁用；出现图片；底部积分减 1；生成期间重复点击无效。

- [ ] **Step 6: 手动验证积分不足分支**

在 SQL Editor 把 credits 改成 0，再点一次生成。

Expected: 弹出升级弹窗，显示当前积分与所需积分，三档套餐按钮都是禁用状态且写着「即将开放」，没有任何可用的支付动作。

- [ ] **Step 7: 手动验证窄屏**

把浏览器宽度调到 400px 左右再看一次。

Expected: 三栏改为上下堆叠，按钮文字不溢出，图片不超出容器。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat: 生图页与升级弹窗接入"
```
### Task 17: 对账任务与定时触发

**Files:**
- Create: `app/api/cron/reconcile/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `createAdminSupabase()`（Task 8）、数据库函数 `refund_credit`（Task 4）
- Produces: `GET /api/cron/reconcile`，返回 `{ checked, refunded }`；Vercel Cron 每 5 分钟调用一次

- [ ] **Step 1: 写对账路由**

Create `app/api/cron/reconcile/route.ts`：

```ts
import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const STUCK_AFTER_MS = 3 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");

  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();

  const { data: stuck, error } = await admin
    .from("generations")
    .select("id")
    .eq("status", "processing")
    .lt("created_at", cutoff);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let refunded = 0;
  for (const row of stuck ?? []) {
    const { data } = await admin.rpc("refund_credit", {
      p_generation_id: row.id,
    });
    if (data === true) {
      refunded += 1;
    }
  }

  return NextResponse.json({ checked: stuck?.length ?? 0, refunded });
}
```

- [ ] **Step 2: 配置 Cron**

Create `vercel.json`：

```json
{
  "crons": [
    {
      "path": "/api/cron/reconcile",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- [ ] **Step 3: 手动验证未授权被拒**

Run: `curl -i http://localhost:3000/api/cron/reconcile`

Expected: HTTP 401，body 为 `{"error":"unauthorized"}`。

- [ ] **Step 4: 手动验证卡死记录能被退款**

在 SQL Editor 造一条卡死记录（把时间拨到 10 分钟前，用户余额先设为 1）：

```sql
update public.profiles set credits = 1 where id = '<测试用户 uuid>';

delete from public.generations where user_id = '<测试用户 uuid>';

insert into public.generations
  (user_id, status, prompt, options, size, quality, created_at)
values
  ('<测试用户 uuid>', 'processing', 'stuck', '{}'::jsonb, '1024x1024', 'medium', now() - interval '10 minutes');

update public.profiles set credits = 0 where id = '<测试用户 uuid>';

insert into public.credit_ledger (user_id, delta, reason)
values ('<测试用户 uuid>', -1, 'generation');
```

然后在 `.env.local` 里确保 `CRON_SECRET` 有值，并执行：

Run: `curl -i -H "Authorization: Bearer <你的 CRON_SECRET>" http://localhost:3000/api/cron/reconcile`

Expected: 返回 `{"checked":1,"refunded":1}`；该记录状态变为 failed；余额回到 1；`credit_ledger` 多一条 refund 流水。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 对账任务与定时触发"
```

### Task 18: 首页

**Files:**
- Create: `app/[locale]/page.tsx`
- Create: `public/samples/sample-1.png`、`sample-2.png`、`sample-3.png`

**Interfaces:**
- Consumes: `getDictionary`/`resolveLocale`（Task 9）、`getCurrentProfile`（Task 11）
- Produces: 首页 `/`

- [ ] **Step 1: 生成示例图**

先把 Task 16 的生图页跑起来，用三组不同选项各生成一张，把结果另存为 `public/samples/sample-1.png`、`sample-2.png`、`sample-3.png`。

Expected: `public/samples/` 下有三个真实的 png 文件，每张不小于 200KB。

- [ ] **Step 2: 写首页**

Create `app/[locale]/page.tsx`：

```tsx
import Image from "next/image";
import Link from "next/link";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { getCurrentProfile } from "@/lib/user/current";
import { Button } from "@/components/ui/button";

const SAMPLES = [
  { src: "/samples/sample-1.png", zh: "产品海报", en: "Product poster" },
  { src: "/samples/sample-2.png", zh: "角色插画", en: "Character art" },
  { src: "/samples/sample-3.png", zh: "场景概念", en: "Scene concept" },
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);
  const profile = await getCurrentProfile();
  const target = profile ? `/${locale}/studio` : `/${locale}/login`;

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16">
      <section className="grid gap-8 py-12 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="flex flex-col gap-5">
          <h1 className="text-4xl font-semibold leading-tight">
            {dict.home.title}
          </h1>
          <p className="max-w-md text-neutral-600">{dict.home.subtitle}</p>
          <Button asChild className="w-fit">
            <Link href={target}>{dict.home.cta}</Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Image
            src={SAMPLES[0].src}
            alt={locale === "zh" ? SAMPLES[0].zh : SAMPLES[0].en}
            width={512}
            height={512}
            className="col-span-2 h-[260px] w-full rounded-lg object-cover"
            priority
          />
          <Image
            src={SAMPLES[1].src}
            alt={locale === "zh" ? SAMPLES[1].zh : SAMPLES[1].en}
            width={512}
            height={512}
            className="h-[180px] w-full rounded-lg object-cover"
          />
          <Image
            src={SAMPLES[2].src}
            alt={locale === "zh" ? SAMPLES[2].zh : SAMPLES[2].en}
            width={512}
            height={512}
            className="h-[180px] w-full rounded-lg object-cover"
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-neutral-200 pt-8">
        <h2 className="text-lg font-medium">{dict.home.samples}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {SAMPLES.map((sample) => (
            <figure key={sample.src} className="flex flex-col gap-2">
              <Image
                src={sample.src}
                alt={locale === "zh" ? sample.zh : sample.en}
                width={512}
                height={512}
                className="h-[220px] w-full rounded-lg object-cover"
              />
              <figcaption className="text-sm text-neutral-500">
                {locale === "zh" ? sample.zh : sample.en}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: 手动验证**

Run: `pnpm dev`

Expected: 打开 `/zh` 能看到示例图与主按钮；未登录点按钮进登录页，登录后进生图页；把窗口缩到 400px 宽时三张图不重叠、文字不溢出，且首屏底部能看到下一段区域。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 首页与示例图"
```
### Task 19: 历史页

**Files:**
- Create: `app/[locale]/history/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabase`（Task 8）、`createSignedImageUrl`（Task 12）、`getCurrentProfile`（Task 11）、`getDictionary`/`resolveLocale`（Task 9）
- Produces: 页面 `/history`

- [ ] **Step 1: 写历史页**

Create `app/[locale]/history/page.tsx`：

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createSignedImageUrl } from "@/lib/storage/upload";
import { getCurrentProfile } from "@/lib/user/current";
import { getDictionary, resolveLocale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale);
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/${locale}/login`);
  }

  const supabase = await createServerSupabase();
  const { data: rows } = await supabase
    .from("generations")
    .select(
      "id, status, prompt, options, subject, size, quality, storage_path, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(24);

  const items = await Promise.all(
    (rows ?? []).map(async (row) => {
      let url: string | null = null;
      if (row.storage_path) {
        try {
          url = await createSignedImageUrl(row.storage_path);
        } catch {
          url = null;
        }
      }
      return { ...row, url };
    }),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{dict.history.title}</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-neutral-300 p-8">
          <p className="text-neutral-500">{dict.history.empty}</p>
          <Button asChild>
            <Link href={`/${locale}/studio`}>{dict.history.emptyCta}</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3"
            >
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.subject}
                  className="h-[220px] w-full rounded-md object-cover"
                />
              ) : (
                <div className="flex h-[220px] w-full items-center justify-center rounded-md bg-neutral-100 text-sm text-neutral-500">
                  {dict.history.failed}
                </div>
              )}

              <p className="text-sm text-neutral-500 tabular-nums">
                {new Date(item.created_at).toLocaleString(
                  locale === "zh" ? "zh-CN" : "en-US",
                )}
              </p>

              <details className="text-sm">
                <summary className="cursor-pointer">
                  {dict.history.detail}
                </summary>
                <div className="mt-2 flex flex-col gap-1 text-neutral-600">
                  <p className="break-all">
                    {dict.history.prompt}: {item.prompt}
                  </p>
                  <p>
                    {dict.history.options}: {item.size} / {item.quality}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 手动验证有数据的状态**

Run: `pnpm dev`

先正常生成两张图，再打开 `http://localhost:3000/zh/history`。

Expected: 出现两张缩略图；展开「详情」能看到当时的完整提示词、尺寸与时间。

- [ ] **Step 3: 手动验证失败记录与空状态**

在 SQL Editor 把某条记录状态改成 failed 并清空 storage_path，刷新页面。

Expected: 该格子显示失败状态而不是空白；用一个新注册的空账号打开同一页面时显示空状态和去生成按钮。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: 历史页"
```

### Task 20: 部署与线上验证

**Files:**
- 无新增代码文件；修改 Vercel 项目配置

**Interfaces:**
- Consumes: 前 19 个任务的成果
- Produces: 一个可公开访问的线上地址

- [ ] **Step 1: 推送代码**

Run:

```bash
git push -u origin main
```

若默认分支叫 master，则用 `git push -u origin master`。

- [ ] **Step 2: 在 Vercel 导入项目**

导入该仓库，框架会自动识别为 Next.js。

Expected: 首次构建成功。

- [ ] **Step 3: 配置环境变量**

在 Vercel 项目设置的 Environment Variables 中加入五个变量：OPENAI_API_KEY、NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY、CRON_SECRET。前两个客户端可见变量可以放到所有环境，OPENAI_API_KEY 与 SUPABASE_SERVICE_ROLE_KEY 只放 Production。

Expected: 保存后重新部署一次，构建与运行时都不报缺少环境变量。

- [ ] **Step 4: 跑一遍线上验证清单**

在线上地址逐条确认：

1. 注册新账号后积分显示 5
2. 连续生成 5 张，余额依次降到 0
3. 第 6 次点击弹出升级提示，且 `credit_ledger` 里没有新增扣分记录
4. 历史页能看到刚才的图与提示词
5. 切换中英文后文案变化且当前页面不跳走
6. 未登录直接访问 `/zh/studio` 会被送到登录页

Expected: 六条全部通过。

- [ ] **Step 5: 确认 Cron 已注册**

在 Vercel 项目的 Cron Jobs 面板查看。

Expected: 出现 `/api/cron/reconcile`，计划为每 5 分钟一次；手动触发一次后日志里返回 `{"checked":0,"refunded":0}` 或类似结构。

- [ ] **Step 6: 提交收尾**

```bash
git add -A
git commit -m "chore: 部署配置"
```

## 自检记录

按 writing-plans 的自检清单逐项核对过：

**1. Spec 覆盖**
- 首页、生图页、登录、历史、积分系统：Task 18、16、10、19、4
- 新用户 5 分、每张图 1 分：Task 4 的触发器与 start_generation
- 积分不足弹升级提示、不做真实支付：Task 15
- 不做邮件：Task 10 的注册走 Supabase Auth 且设计文档要求在控制台关闭 Confirm email
- 不做后台、SEO、图片编辑、参考图上传、多模型切换：全篇无相关任务
- 结构化选项组装提示词：Task 6 与 Task 7
- 中英双语：Task 9
- 失败退款与对账：Task 4、Task 14、Task 17
- 部署上线：Task 20

**2. 占位符扫描**
全文没有 TBD、TODO、待补充；每个代码步骤都给了可执行的代码，每个验证步骤都给了命令与预期结果。

**3. 类型与命名一致性**
- `buildPrompt` 在 Task 7 定义，Task 14 以同名同签名调用
- `start_generation` 与 `refund_credit` 的参数名在 Task 4 的定义与 Task 14、17 的调用处一致
- `getCurrentProfile` 返回 `{ userId, credits }`，Task 11、16、18、19 使用的都是这两个字段
- 字典键 `studio`、`history`、`login`、`upgrade`、`nav`、`home` 在 Task 9 定义，后续任务的引用全部落在这些键内

## 未决项

1. GPTImage 的尺寸取值与返回字段需要在实际动手前核对，见 Task 13 第 1 步。核对不通过时先改设计文档。
2. 中档画质在 Vercel 函数时长上限内的成功率需要实测。若失败率偏高，需要评估升级套餐或改成异步任务，这会成为一份新的设计文档。
3. 每个新账号消耗 5 次模型调用，上线前需要评估是否加更严格的频率限制。当前只依赖 Supabase 自带的鉴权，没有额外的单账号限流。
---

## 实施记录（2026-10-07）

执行方式：本会话内联执行（executing-plans），分支 `feat/ai-image-studio-v1`。

### 与计划的偏差

1. 脚手架先在临时目录生成再复制进项目。目录名 `AI 应用生成APP` 不是合法 npm 包名，`create-next-app` 拒绝在当前目录初始化，包名改为 `ai-image-studio`。
2. 实际安装的是 Next.js 16.3.8，不是计划里写的 15。按项目内 AGENTS.md 的要求先读了 `node_modules/next/dist/docs/` 里版本匹配的文档，确认 `maxDuration` 仍可用、`params` 与 `cookies()` 必须异步访问，计划中的写法已符合。
3. 新增 `proxy.ts`。计划写的是不做 middleware，但 Next 16 把 middleware 改名为 proxy，且 Supabase 会话刷新依赖它；没有它时 `cookies()` 在服务端组件里无法写入，会话闲置后会失效。
4. shadcn/ui 实际安装的是 Base UI 版本，`Button` 没有 `asChild`，改用导出的 `buttonVariants()` 给链接套样式。
5. `lib/i18n/dictionary.ts` 的基准字典去掉了 `as const`。字面量类型会让英文文案无法赋值给 `Dictionary`。
6. `lib/prompt/build.ts` 的 `pick()` 改成泛型，否则比例选项会丢失 `size` 字段。
7. `lib/openai/generate-image.ts` 增加开发环境占位图分支：没有 `OPENAI_API_KEY` 时返回程序生成的 PNG，生产环境直接报错，避免假图流到线上。
8. `lib/env.ts` 不再强制要求 `OPENAI_API_KEY`，改由生图模块在真正调用时检查。
9. `lib/supabase/server.ts` 与 `admin.ts` 在缺环境变量时抛出带指引的错误，而不是让底层库抛出难懂信息。
10. 计划里的 `reserve_credit` 被 `start_generation` 取代，扣分与建记录合并在一个事务里，设计文档第 5.4 与第 7 节已同步。

### 已验证项

| 检查项 | 结果 |
| --- | --- |
| `pnpm exec tsc --noEmit` | 通过 |
| `pnpm test` | 11 个用例通过 |
| `pnpm build` | 通过，全部路由动态渲染，Proxy 已注册 |
| 未登录访问 `/zh/studio` | 307 跳转登录页 |
| 注册新账号 | profiles 自动创建，credits=5，signup_bonus 流水 1 条 |
| 连续生成 5 次 | 每次 200，credits 依次递减到 0，每次 1 条 generation 流水 |
| 第 6 次生成 | 402 insufficient_credits，不产生任何记录 |
| 生成结果 | Storage 中是合法 PNG，尺寸与所选比例一致，status=succeeded 且 storage_path 非空 |
| 历史页 | 200，渲染出图片、签名地址与提示词 |
| 对账接口未授权 | 401 |
| 对账接口授权 | 卡死记录被退款，credits 回到 1，status 变 failed，refund 流水 1 条 |
| 行级安全 | 另一账号读取 generations 得到 0 行，只能读到自己的 profile 与流水 |

### 尚未验证

- 真实调用 OpenAI 出图（当前没有 API key，走的是占位图分支）
- Vercel 线上部署与线上 Cron
- 首页示例图仍是程序生成的占位图，等有真实出图能力后替换