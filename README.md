# AI Image Studio

把「勾选项」变成专业提示词的 AI 生图站点。

用户不需要会写提示词。勾选图片类型、比例、风格、场景、留白要求，再写一句主体和补充要求，
系统按固定模板组装成一段完整的英文提示词，调用生图模型出图。

内置完整的积分闭环：注册赠送 5 积分，每张图扣 1 积分，失败或超时自动退款，
另有一个每 5 分钟跑一次的对账任务兜住「函数被时长上限杀掉、退款代码没机会执行」的情况。

## 功能

- 首页：真实作品示例与入口
- 生图页：五组结构化选项 + 主体 + 补充要求，实时预览
- 注册登录：邮箱加密码，不依赖任何邮件服务
- 生成历史：图片网格，可展开查看当时的完整提示词与参数
- 积分系统：先预扣、失败退回、流水可追溯
- 中英双语切换
- 积分不足时弹出升级提示（第一版不接真实支付）

## 技术栈

- Next.js 16（App Router、TypeScript、Turbopack）
- Tailwind CSS 4 + shadcn/ui（Base UI） + lucide-react
- Supabase：Postgres、Auth、Storage
- 生图：可切换的供应商适配层，支持火山方舟与 OpenAI
- Vercel：部署与 Cron
- Vitest：单元测试

## 生图供应商

生图层位于 `lib/image/generate-image.ts`，通过环境变量切换，两家都是同步调用：

| 供应商 | IMAGE_PROVIDER | 密钥变量 | 默认模型 |
| --- | --- | --- | --- |
| 火山方舟 | `ark` | `ARK_API_KEY` | `doubao-seedream-5-0-pro-260628` |
| OpenAI | `openai` | `OPENAI_API_KEY` | `gpt-image-1` |

默认用火山方舟。原因很实际：OpenAI 按 IP 归属地拒绝中国大陆访问，官方控制台返回 Cloudflare 403，
连密钥都拿不到。火山方舟的接口是 OpenAI 兼容格式，国内可直连。

方舟分支额外发送 `output_format: "png"` 与 `watermark: false`——方舟默认加水印且默认输出 JPEG。
内部画幅会换算成方舟支持的尺寸：`1536x1024` 换成 `1152x864`，`1024x1536` 换成 `864x1152`。

没有配置任何密钥时，开发环境会返回一张程序生成的占位图，方便在没有额度的情况下验证积分与历史链路；
生产环境缺密钥会直接报错，不会用假图糊弄用户。

## 本地运行

需要 Node.js 20 以上和 pnpm。

```bash
pnpm install
cp .env.example .env.local
# 填写 .env.local 中的变量
pnpm dev
```

打开 http://localhost:3000 。

### 环境变量

```
IMAGE_PROVIDER=ark          # 或 openai
ARK_API_KEY=                # 火山方舟控制台创建
ARK_IMAGE_MODEL=            # 留空使用默认模型
OPENAI_API_KEY=             # 仅 IMAGE_PROVIDER=openai 时需要
OPENAI_IMAGE_MODEL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # 服务端专用，绝不能进浏览器
CRON_SECRET=                # 自己生成一串随机字符
```

`SUPABASE_SERVICE_ROLE_KEY` 会绕过所有行级安全，只能存在于服务端环境变量里。

### 数据库

在 Supabase 的 SQL Editor 里按文件名顺序执行 `supabase/migrations/` 下的三个脚本。
另外还需要两步控制台操作：

1. 在 Authentication 的 Sign In / Providers 里关掉 Confirm email，否则注册会被邮件验证卡住
2. 在 Storage 里建一个名为 `generations` 的私有桶

## 测试

```bash
pnpm test          # 单元测试
pnpm exec tsc --noEmit
pnpm build
```

## 目录结构

```
app/[locale]/        页面：首页、生图、历史、登录
app/api/generate/    生图编排入口
app/api/cron/        对账任务
components/          导航、选项面板、结果区、升级弹窗
lib/prompt/          提示词组装（纯函数）与选项字典
lib/image/           生图调用封装，支持多供应商
lib/storage/         Supabase Storage 上传与签名地址
lib/supabase/        服务端、浏览器端、service role 三套客户端
lib/i18n/            中英文字典
supabase/migrations/ 建表、积分函数、行级安全
proxy.ts             Supabase 会话刷新
```

## 设计文档

`docs/superpowers/` 下有完整的设计文档与实现计划，包含每个决策的理由与实测记录。

## 已知限制

- 单张生成耗时实测 27 到 47 秒。Vercel 免费额度的函数上限是 60 秒，横图接近上限，
  高峰期存在超时风险。积分不会丢（对账任务会退款），但用户会看到一次失败提示。
- 尚未接入真实支付，升级入口只是占位。
- 提示词组装为确定性模板，不调用大模型润色。

## License

MIT