# 画境工坊

> 一个开源的团队级 AI 图片生成工作台。

画境工坊是一套基于 Next.js + SQLite 的轻量图片生成系统，适合小团队、工作室、内容团队或公司内部自建使用。它可以接入 OpenAI 兼容格式的图片生成接口，例如 sub2api，也提供实验性的内置 OpenAI OAuth 账号连接器，把文生图、图生图、改图、模板、历史记录、用户权限和额度管理整合到一个后台里。

## 适合谁用？

- 想给团队搭一个统一图片生成入口的人
- 想把 sub2api / OpenAI 兼容图片接口包装成内部工具的人
- 需要沉淀提示词、模板、历史图片和生成记录的内容团队
- 想快速二开一个 AI 图片 SaaS / 内部工具原型的开发者

## 主要功能

- 文生图、图生图、改图三种工作流
- 图片生成任务队列，支持后台 Worker 轮询执行
- 会话式历史记录，方便围绕同一张图持续修改
- 内置模板系统，可维护常用风格和场景
- 用户注册 / 登录，第一个注册用户自动成为管理员
- 用户、分组、额度、后台配置管理
- 两种图片接口模式：sub2api API Key / 内置 OpenAI OAuth（实验性）
- SQLite 本地数据库，部署简单
- 图片本地存储，不依赖额外对象存储
- Docker Compose 一键部署
- 管理员后台检查 GitHub Releases 更新，并提供安全更新命令

## 技术栈

- Next.js App Router
- React
- TypeScript
- SQLite（`node:sqlite`）
- Bun
- Docker / Docker Compose

## 本地开发

```bash
bun install
cp .env.example .env.local
bun run db:init
bun run dev:all
```

然后打开：

```text
http://localhost:3000
```

首次注册的用户会自动成为管理员。

## 环境变量

复制 `.env.example` 后按需修改：

```env
SUB2API_BASE_URL=https://your-sub2api.example.com/v1
SUB2API_API_KEY=your_api_key
IMAGE_MODEL=gpt-image-2
IMAGE_STORAGE_DIR=./data/images
DATABASE_URL=file:./data/app.db
IMAGE_REQUEST_TIMEOUT_MS=300000
WORKER_POLL_INTERVAL_MS=3000
SESSION_COOKIE_SECURE=false
UPDATE_REPO=laolin5564/huajing-studio
UPDATE_CHECK_URL=https://api.github.com/repos/laolin5564/huajing-studio/releases/latest

# 内置 OpenAI OAuth 模式（实验性）
OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY=
OPENAI_OAUTH_REDIRECT_URI=
OPENAI_OAUTH_CLIENT_ID=
OPENAI_OAUTH_API_BASE_URL=https://api.openai.com/v1
```

说明：

- `SUB2API_BASE_URL`：OpenAI 兼容图片接口地址。
- `SUB2API_API_KEY`：图片接口密钥，不要提交到 Git。
- `IMAGE_MODEL`：图片模型名，例如 `gpt-image-2`。
- `SESSION_COOKIE_SECURE`：如果只用 HTTP 访问，设为 `false`；HTTPS 部署可设为 `true`。
- `UPDATE_REPO`：在线更新检查使用的 GitHub 仓库，默认 `laolin5564/huajing-studio`。
- `UPDATE_CHECK_URL`：在线更新检查地址，默认读取该仓库的 latest release。建议保持 HTTPS。
- `OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY`：内置 OpenAI OAuth 模式必填，用于 AES-256-GCM 加密保存 access token / refresh token。建议使用 32 字节以上随机字符串，或 `base64:` 前缀的 32 字节 key。
- `OPENAI_OAUTH_REDIRECT_URI`：可选，固定 OAuth 回调地址；不填时按当前访问域名拼出 `/api/admin/openai-accounts/oauth/callback`。
- `OPENAI_OAUTH_CLIENT_ID`：可选，默认使用参考 Codex CLI 的 OpenAI OAuth client_id；如果上游流程变更可覆盖。
- `OPENAI_OAUTH_API_BASE_URL`：OAuth 模式下调用图片接口的 OpenAI-compatible Base URL，默认 `https://api.openai.com/v1`。

## 图片接口模式

### 1. sub2api API Key 模式（默认）

后台「站点与模型配置」选择 `sub2api / OpenAI-compatible API Key`，填写：

- Base URL：例如 `https://your-sub2api.example.com/v1`
- API Key：sub2api 或 OpenAI-compatible 服务的密钥
- 模型：例如 `gpt-image-2`

这是当前最稳定的模式，Worker 会用 `Authorization: Bearer <API Key>` 调用 `/images/generations` 和 `/images/edits`。

### 2. 内置 OpenAI OAuth 模式（实验性）

后台「OpenAI 账号连接」点击「连接 OpenAI 账号」，完成授权后，再在「站点与模型配置」把图片接口模式切到 `内置 OpenAI OAuth`。

当前实现参考 sub2api 的 Codex CLI OAuth + PKCE 流程：

- 服务端生成 state / code_verifier / code_challenge，并发起 OpenAI OAuth 授权。
- 回调接口交换 access token / refresh token。
- SQLite 保存账号、邮箱、组织、套餐、token 到期时间和状态。
- access token / refresh token 使用 `OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY` 加密存储。
- Worker 调用前会自动刷新快过期 token；刷新失败会把账号标记为异常。

限制与注意：

- 这是非官方/实验性流程，真实网页登录、账号风控、接口权限和图片模型可用性需要在你的 OpenAI 账号环境里验证。
- OAuth access token 是否可直接调用 `OPENAI_OAUTH_API_BASE_URL` 的图片接口，取决于 OpenAI 当前策略；如果失败，可继续使用默认 sub2api API Key 模式。
- 生产部署建议设置固定 `OPENAI_OAUTH_REDIRECT_URI`，并妥善保存 `OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY`；丢失该 key 后，历史 token 无法解密，需要重新连接账号。

## Docker 部署

```bash
SUB2API_API_KEY=your_api_key docker compose up -d --build
```

默认监听：

```text
http://服务器IP:3000
```

数据默认保存在项目目录的 `data/` 下：

- `data/app.db`：SQLite 数据库
- `data/images/`：生成图片和上传素材

## 在线更新与发布版本

管理员后台有「系统更新」区域，会调用 GitHub Releases latest API 检查：

- 当前版本：来自 `package.json` 的 `version`
- 最新版本 / 发布时间 / Release Notes：来自 `UPDATE_CHECK_URL`
- 是否有新版本：按 semver 比较 `latest release tag` 与当前版本

第一版**不在 Web 容器内直接执行更新命令**，原因是 Docker Compose 部署时容器通常没有宿主机 Docker 权限，也不应让后台接受任意 shell 输入。后台会展示并复制官方更新命令：

```bash
bash scripts/update.sh
```

推荐已安装实例这样更新：

```bash
cd /path/to/huajing-studio
bash scripts/update.sh
```

脚本行为：

1. 从 GitHub Releases 获取最新 tag（也可用 `UPDATE_TAG=v0.1.1 bash scripts/update.sh` 指定版本）。
2. 备份 `data/` 和 `.env*` 到 `backups/`。
3. `git fetch --tags`，快进更新 `main`，如存在目标 tag 则 checkout 到该 tag。
4. 执行 `docker compose up -d --build` 重新构建并启动。

注意：脚本会拒绝在有未提交本地改动的工作区继续执行；`data/`、`.env*` 不会被提交或覆盖。

### 发布新版本

1. 修改 `package.json` 的 `version`，例如 `0.1.1`。
2. 合并到 `main` 后打 tag：

```bash
git tag v0.1.1
git push origin main v0.1.1
```

3. 在 GitHub Releases 页面基于该 tag 创建 Release，填写更新说明。建议发布前运行 `bun run lint` 和 `bun run build`。
4. 已安装实例在后台点击「检查更新」即可看到新版本，并按脚本更新。

## 常用命令

```bash
bun run dev       # 启动 Next.js 开发服务
bun run worker    # 启动图片生成 Worker
bun run dev:all   # 同时启动 Web 和 Worker
bun run db:init   # 初始化数据库和内置模板
bun run build     # 构建生产版本
bun run start     # 启动生产 Web 服务
bun run lint      # 代码检查
bash scripts/update.sh  # 按 GitHub Release 更新 Docker Compose 部署
```

## 开源前安全提醒

请不要提交这些内容：

- `.env` / `.env.local`
- `data/app.db`
- `data/images/` 下的生成图片
- 真实 API Key、Token、账号密码

本仓库已默认通过 `.gitignore` 排除这些文件。

## 二开建议

你可以很容易地继续扩展：

- 接入更多图片模型
- 增加对象存储，例如 S3 / R2 / OSS
- 增加支付和套餐系统
- 增加团队空间和项目管理
- 增加模板市场或提示词市场
- 接入企业微信、飞书、Discord 等机器人入口

## License

MIT
