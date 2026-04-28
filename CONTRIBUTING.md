# Contributing to 画境工坊

感谢你愿意参与维护。这个项目优先保证「小团队自部署稳定可用」，再考虑功能扩展。

## 本地开发

```bash
bun install
cp .env.example .env.local
bun run db:init
bun run dev:all
```

常用检查：

```bash
bun run secret:scan
bun run lint
bun run typecheck
bun run build
```

## 代码约定

- API 路由只做请求解析、权限校验和响应转换；业务逻辑尽量放在 `lib/`。
- 数据库读写集中在 `lib/db.ts`，不要在组件里直接操作 SQLite。
- 图片接口接入放在 provider 边界内，不要让 Worker 直接散落不同厂商调用细节。
- 管理员能力必须经过 `requireAdmin()`；普通用户资源必须检查归属。
- 新环境变量必须同步更新 `.env.example`、README 和 Docker Compose（如适用）。

## 数据和安全

不要提交：

- `.env*` 真实配置文件
- `data/app.db*`
- `data/images/` 生成图片或上传素材
- API Key、OAuth token、账号密码

新增数据库字段时优先使用非破坏性迁移。不要自动删除用户数据。

## Pull Request 建议

PR 描述请包含：

1. 改了什么；
2. 为什么这样改；
3. 如何验证；
4. 是否影响已有部署或数据升级。
