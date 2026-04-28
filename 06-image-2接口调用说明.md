# 06-image-2 接口调用说明

> 本文档把 image-2 的调用方式写死到项目资料里，方便后续开发直接照抄实现。

## 1. 固定配置

```env
SUB2API_BASE_URL=https://s2a.laolin.ai/v1
SUB2API_API_KEY=<SUB2API_API_KEY>
IMAGE_MODEL=gpt-image-2
```

说明：

- baseUrl：`https://s2a.laolin.ai/v1`
- model：`gpt-image-2`
- OpenClaw 当前默认模型名是 `openai/gpt-image-2`，但直接调用 sub2api 接口时，body 里的 `model` 写 `gpt-image-2`。
- 请求图片生成接口时建议带浏览器 User-Agent，避免被上游 WAF 拦截。

## 2. 文生图接口

### Endpoint

```http
POST https://s2a.laolin.ai/v1/images/generations
Authorization: Bearer <SUB2API_API_KEY>
Content-Type: application/json
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36
```

### 请求示例

```json
{
  "model": "gpt-image-2",
  "prompt": "一张简约高级的公司产品宣传海报，白色背景，柔和自然光，科技感，留白充足",
  "n": 1,
  "size": "1024x1024"
}
```

### curl 示例

```bash
curl -X POST "https://s2a.laolin.ai/v1/images/generations" \
  -H "Authorization: Bearer $SUB2API_API_KEY" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "一张简约高级的公司产品宣传海报，白色背景，柔和自然光，科技感，留白充足",
    "n": 1,
    "size": "1024x1024"
  }'
```

## 3. 图生图 / 改图接口

图生图和改图建议统一走图片编辑接口。

### Endpoint

```http
POST https://s2a.laolin.ai/v1/images/edits
Authorization: Bearer <SUB2API_API_KEY>
Content-Type: multipart/form-data
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36
```

### curl 示例

```bash
curl -X POST "https://s2a.laolin.ai/v1/images/edits" \
  -H "Authorization: Bearer $SUB2API_API_KEY" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" \
  -F "model=gpt-image-2" \
  -F "image=@/path/to/source.png" \
  -F "prompt=保留主体，把背景改成简约高级的办公场景，光线自然，质感干净" \
  -F "n=1" \
  -F "size=1024x1024"
```

## 4. Node.js 封装示例

```ts
const SUB2API_BASE_URL = process.env.SUB2API_BASE_URL || 'https://s2a.laolin.ai/v1';
const SUB2API_API_KEY = process.env.SUB2API_API_KEY;
if (!SUB2API_API_KEY) {
  throw new Error('SUB2API_API_KEY is required');
}
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-image-2';

const IMAGE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function generateImage(params: {
  prompt: string;
  size?: string;
  n?: number;
}) {
  const res = await fetch(`${SUB2API_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUB2API_API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': IMAGE_USER_AGENT,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: params.prompt,
      n: params.n ?? 1,
      size: params.size ?? '1024x1024',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`image generation failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function editImage(params: {
  imageFile: File | Blob;
  prompt: string;
  size?: string;
  n?: number;
}) {
  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('image', params.imageFile);
  form.append('prompt', params.prompt);
  form.append('n', String(params.n ?? 1));
  form.append('size', params.size ?? '1024x1024');

  const res = await fetch(`${SUB2API_BASE_URL}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUB2API_API_KEY}`,
      'User-Agent': IMAGE_USER_AGENT,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`image edit failed: ${res.status} ${text}`);
  }

  return res.json();
}
```

## 5. 返回结果处理

优先兼容两种常见返回：

### 5.1 返回 base64

```json
{
  "data": [
    {
      "b64_json": "..."
    }
  ]
}
```

处理方式：

1. 读取 `data[].b64_json`
2. base64 decode
3. 保存到 NAS 本地目录
4. 数据库记录 `file_path`

### 5.2 返回 URL

```json
{
  "data": [
    {
      "url": "https://..."
    }
  ]
}
```

处理方式：

1. 读取 `data[].url`
2. 后端下载图片
3. 保存到 NAS 本地目录
4. 数据库记录 `file_path`

## 6. 在本项目中的落地方式

- 前端永远不直接请求 sub2api。
- 前端调用本项目后端：`POST /api/generation-tasks`。
- 后端 worker 从任务表取任务。
- worker 根据模式调用：
  - 文生图 → `/images/generations`
  - 图生图 / 改图 → `/images/edits`
- worker 把返回图片保存到 NAS 本地目录。
- 数据库只保存图片路径、prompt、参数和任务状态。

## 7. 注意事项

- key 写在服务端环境变量或服务端配置里，不要下发到前端。
- 请求必须设置较长超时，建议 180-900 秒。
- 建议所有图片请求都加浏览器 User-Agent。
- 生成数量按产品需求限制为 1 / 2 / 4。
- 默认尺寸先用 `1024x1024`，前端可按模板覆盖。
