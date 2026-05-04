# 画境工坊

> 一个开源的团队级 AI 图片生成工作台。

画境工坊是一套基于 Next.js + SQLite 的轻量图片生成系统，适合小团队、工作室、内容团队或公司内部自建使用。它可以接入 OpenAI 兼容格式的图片生成接口，例如 sub2api，也提供实验性的内置 OpenAI OAuth 账号连接器，把文生图、图生图、模板、历史记录、用户权限和额度管理整合到一个后台里。

## 适合谁用？

- 想给团队搭一个统一图片生成入口的人
- 想把 sub2api / OpenAI 兼容图片接口包装成内部工具的人
- 需要沉淀提示词、模板、历史图片和生成记录的内容团队
- 想快速二开一个 AI 图片 SaaS / 内部工具原型的开发者

## 主要功能

- 文生图、图生图两种核心工作流；会话内继续修改统一走图生图
- 图片生成任务队列，支持后台 Worker 轮询执行
- 会话式历史记录，支持固定提示词、主图/参考图角色和同一规则下的连续处理
- 内置模板系统，可维护常用风格和场景
- 用户注册 / 登录，第一个注册用户自动成为管理员
- 用户、分组、额度、后台配置管理
- 两种图片接口模式：sub2api API Key / 内置 OpenAI OAuth（实验性）
- SQLite 本地数据库，部署简单
- 非破坏性 schema 初始化，升级前自动备份 `data/` 与 `.env*`
- 图片本地存储，不依赖额外对象存储
- Docker Compose 一键部署
- 管理员后台检查 GitHub Releases 更新，并支持受限 Web 一键更新

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

如果只想检查代码：

```bash
bun run secret:scan
bun run lint
bun run typecheck
bun run build
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
COST_PER_IMAGE=0.04
APP_BASE_URL=
SESSION_COOKIE_SECURE=false
UPDATE_REPO=laolin5564/huajing-studio
UPDATE_CHECK_URL=https://api.github.com/repos/laolin5564/huajing-studio/releases/latest
WEB_UPDATE_ENABLED=false
WEB_UPDATE_REPO_DIR=/workspace/huajing-studio
WEB_UPDATE_LOCK_FILE=/tmp/huajing-studio-web-update.lock

# 内置 OpenAI OAuth 模式（实验性）
OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY=
OPENAI_OAUTH_REDIRECT_URI=
OPENAI_OAUTH_CLIENT_ID=
```

说明：

- `SUB2API_BASE_URL`：OpenAI 兼容图片接口地址。
- `SUB2API_API_KEY`：图片接口密钥，不要提交到 Git。
- `IMAGE_MODEL`：图片模型名，例如 `gpt-image-2`。
- `COST_PER_IMAGE`：每张图片的成本估算，仅用于后台统计，默认 `0.04`。
- `APP_BASE_URL`：可选，部署域名；未显式设置 `SESSION_COOKIE_SECURE` 时用于自动判断 HTTPS Cookie。
- `SESSION_COOKIE_SECURE`：如果只用 HTTP 访问，设为 `false`；HTTPS/公网部署建议设为 `true`。
- `UPDATE_REPO`：在线更新检查使用的 GitHub 仓库，默认 `laolin5564/huajing-studio`。
- `UPDATE_CHECK_URL`：在线更新检查地址，默认读取该仓库的 latest release。建议保持 HTTPS。
- `WEB_UPDATE_ENABLED`：是否允许管理员后台触发 Web 一键更新，默认 `false`。只有设为 `true` 才会执行固定脚本。
- `WEB_UPDATE_REPO_DIR`：Web 一键更新执行目录。宿主机执行可用项目目录；Docker 内执行时必须是宿主机 Git 项目的相同绝对路径，不能指向 `/app` 镜像目录。
- `WEB_UPDATE_LOCK_FILE`：Web 一键更新脚本锁文件路径，默认 `/tmp/huajing-studio-web-update.lock`。
- `OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY`：内置 OpenAI OAuth 模式必填，用于 AES-256-GCM 加密保存 access token / refresh token。建议使用 32 字节以上随机字符串，或 `base64:` 前缀的 32 字节 key。
- `OPENAI_OAUTH_REDIRECT_URI`：可选，固定 OAuth 回调地址；不填时使用 Codex CLI / sub2api 兼容的 `http://localhost:1455/auth/callback`，授权后复制浏览器地址栏回调链接回后台完成连接。
- `OPENAI_OAUTH_CLIENT_ID`：可选，默认使用参考 Codex CLI 的 OpenAI OAuth client_id；如果上游流程变更可覆盖。
- OpenAI OAuth 代理：在管理员后台「OpenAI 账号连接」里配置，支持 `http://`、`https://`、`socks5://`、`socks5h://`，也兼容 `socket5://` 写法，用于服务端交换 token、刷新 token 和 Codex 图片请求。带账号密码的代理地址只会脱敏展示。


## 架构与维护边界

详细维护说明见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，贡献指南见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。核心边界如下：

- `lib/config.ts`：只负责环境变量、默认值和路径解析。
- `lib/db.ts`：集中管理 SQLite schema、兼容性迁移和 CRUD。
- `lib/auth.ts` / `lib/permissions.ts`：负责登录态、管理员权限和用户资源归属。
- `lib/image-provider.ts` / `lib/sub2api.ts` / `lib/openai-oauth.ts`：封装图片接口和 token 处理。
- `workers/image-worker.ts`：后台领取队列任务并写回结果。
- `lib/update.ts` / `scripts/update.sh` / `scripts/web-update.sh`：只做 GitHub Release 检查与受限更新。

新增环境变量、数据库字段或 provider 时，请同步更新 `.env.example`、README、Docker Compose 与架构文档。

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
- 默认使用 `http://localhost:1455/auth/callback` 回调；授权后把浏览器地址栏里的 `code` / `state` 回调链接粘贴回后台，由回调接口交换 access token / refresh token。
- 授权请求只使用 Codex OAuth client 允许的基础 scope；图片生成参考 sub2api 的方式，把 `/v1/images/*` 请求转换为 ChatGPT Codex `/backend-api/codex/responses` + `image_generation` tool。
- SQLite 保存账号、邮箱、组织、套餐、token 到期时间和状态。
- access token / refresh token 使用 `OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY` 加密存储。
- Worker 调用前会自动刷新快过期 token；刷新失败会把账号标记为异常。
- 如服务器访问 OpenAI 或 ChatGPT 不稳定，可在管理员后台为内置 OAuth 连接器配置 HTTP / SOCKS5 代理；该代理只用于服务端 OAuth token 与 Codex 图片请求。

限制与注意：

- 这是非官方/实验性流程，不承诺长期稳定；OpenAI 登录流程、账号风控、接口权限和图片模型可用性都可能随上游变化失效。
- OAuth 图片生成走 ChatGPT Codex 内部 Responses 通道，而不是官方 Platform `/v1/images/generations` scope；如果上游返回风控、限流或权限错误，请切回默认 sub2api API Key 模式。
- 生产部署建议设置固定 `OPENAI_OAUTH_REDIRECT_URI`，并妥善保存 `OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY`；丢失该 key 后，历史 token 无法解密，需要重新连接账号。

## Docker 部署

```bash
SUB2API_API_KEY=your_api_key docker compose up -d --build
```

默认监听：

```text
http://服务器IP:3000
```

数据默认保存在项目目录的 `data/` 下。请不要把 `data/` 或 `.env*` 提交到 Git：

- `data/app.db`：SQLite 数据库
- `data/images/`：生成图片和上传素材

## 数据升级与备份

- 当前 schema 在应用启动时由 `lib/db.ts` 自动初始化。新增字段采用 `ALTER TABLE ... ADD COLUMN` 的非破坏性兼容迁移。
- 更新脚本会先把 `data/` 和 `.env*` 备份到 `backups/`，再拉取代码和重建容器。
- 不要手动删除 `data/app.db` 来“升级”；这会清空用户、任务、模板和历史图片记录。
- 如果未来 Release Notes 标注了手动迁移，请先停止服务、备份 `data/`，确认迁移成功后再启动。

## 在线更新与发布版本

管理员后台有「系统更新」区域，会调用 GitHub Releases latest API 检查：

- 当前版本：来自 `package.json` 的 `version`
- 最新版本 / 发布时间 / Release Notes：来自 `UPDATE_CHECK_URL`
- 是否有新版本：按 semver 比较 `latest release tag` 与当前版本

后台提供两种更新方式：

### 1. Web 一键更新（可选，默认关闭）

管理员点击「立即更新」后，服务端只会执行项目内固定脚本 `scripts/web-update.sh`，该脚本再调用 `scripts/update.sh`；接口不接受任何 command / shell 输入，并且有进程内锁和脚本级 `flock` 锁，同一时间只允许一个更新任务。后台会轮询展示状态、开始/结束时间、日志和错误。

启用步骤：

1. 确认当前部署目录是 Git clone 的项目目录，且 `scripts/update.sh` 可在宿主机手动执行成功。
2. 修改 `.env` 或 Docker Compose 环境变量。Docker 内启用时建议用宿主机项目绝对路径：

```env
WEB_UPDATE_ENABLED=true
WEB_UPDATE_REPO_DIR=/path/to/huajing-studio
```

3. Docker Compose 部署时，需要让容器能更新宿主机项目并调用 Docker。注意：通过 `/var/run/docker.sock` 调宿主机 Docker 时，Compose 的 build context 和相对 volume 会按宿主机路径解析，所以 Git 项目目录在容器内路径必须等于宿主机绝对路径。

```yaml
services:
  image-gen-system:
    environment:
      WEB_UPDATE_ENABLED: "true"
      WEB_UPDATE_REPO_DIR: "${WEB_UPDATE_REPO_DIR}"
    volumes:
      - ./data:/app/data
      - ${WEB_UPDATE_REPO_DIR}:${WEB_UPDATE_REPO_DIR}
      - /var/run/docker.sock:/var/run/docker.sock
```

推荐启动方式：

```bash
WEB_UPDATE_ENABLED=true WEB_UPDATE_REPO_DIR="$PWD" docker compose up -d --build
```

4. 重启服务后，用管理员账号进入后台「系统更新」点击「立即更新」。

风险与限制：

- 挂载 `/var/run/docker.sock` 等同于给容器宿主机 Docker 管理权限，只建议在可信内网自用部署开启。
- Web 一键更新仍会执行 `git fetch/pull/checkout` 和 `docker compose up -d --build`，更新过程中服务可能短暂重启。
- 如果容器内没有 Git 项目目录、Docker socket、Docker CLI 或 Docker Compose，脚本会拒绝执行并在后台显示清晰错误。
- 如果容器内 `WEB_UPDATE_REPO_DIR` 指向 `/app`，脚本会拒绝执行；`/app` 是镜像内运行目录，不是可安全 `git pull` 的宿主机部署目录。
- `WEB_UPDATE_ENABLED` 默认关闭；未启用时后台只显示检查结果和手动命令。

### 2. 手动更新命令

如果不想给 Web 容器 Docker 权限，可以继续 SSH 到服务器执行官方更新命令：

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

注意：脚本会拒绝在有未提交本地改动的工作区继续执行；`data/`、`.env*` 不会被提交或覆盖。Git 拉取阶段只会更新版本差异里的文件；Docker 构建阶段会复用缓存，依赖安装层只受 `package.deps.json` 和 `bun.lock` 影响，单纯修改版本号或业务代码不会重新安装依赖。

### 回滚与恢复

更新前脚本会把 `data/` 和 `.env*` 打包到 `backups/`。如更新后需要回滚：

```bash
cd /path/to/huajing-studio
git checkout v0.1.1                 # 换成要回滚的旧版本 tag
docker compose up -d --build
```

如需恢复数据或环境变量，先停止服务，再从 `backups/data-时间戳.tar.gz` 或 `backups/env-时间戳.tar.gz` 解包覆盖。解包前建议再手动复制一份当前 `data/`，避免二次覆盖。

### 发布新版本

1. 修改 `package.json` 的 `version`，例如 `0.1.1`。如果新增、删除或升级依赖，需要同步更新 `package.deps.json` 并运行 `bun test tests/package-deps.test.ts`。
2. 合并到 `main` 后打 tag：

```bash
git tag v0.1.1
git push origin main v0.1.1
```

3. 在 GitHub Releases 页面基于该 tag 创建 Release，填写更新说明、升级风险和是否需要手动迁移。建议发布前运行 `bun run secret:scan`、`bun run lint`、`bun run typecheck` 和 `bun run build`。
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
bun run typecheck # TypeScript 类型检查
bun run secret:scan # 扫描常见密钥格式
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
