# 04-数据表与 API 草案

## 1. 数据表草案

### 1.1 generation_tasks

生成任务表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 任务 ID |
| mode | string | text_to_image / image_to_image；edit_image 仅作为历史数据兼容 |
| status | string | queued / processing / succeeded / failed |
| progress_stage | string | queued / requesting / generating / saving / completed / failed / canceled，用于前端展示细分进度 |
| prompt | text | 正向提示词 |
| fixed_prompt | text | 任务创建时套用的会话固定提示词快照 |
| prompt_suffix | text | 用户本次追加的补充提示词 |
| negative_prompt | text | 负面提示词 |
| size | string | 图片尺寸 |
| quantity | integer | 生成数量：1 / 2 / 4 |
| requested_concurrency | integer | 单任务并发覆盖值；低并发重试时为 1，默认跟随后台全局并发 |
| template_id | string | 使用的模板 ID |
| source_image_id | string | 参考图 / 原图 ID |
| reference_image_id / reference_image_ids | string | 额外参考图 ID，主图与参考图分开传递 |
| reference_strength | float | 参考强度 / 相似度 |
| style_strength | float | 风格强度 |
| cost_estimate | float | 预估成本 |
| error_message | text | 面向用户的失败分类与处理建议 |
| created_at | datetime | 创建时间 |
| started_at | datetime | 开始时间 |
| completed_at | datetime | 完成时间 |

### 1.2 generated_images

生成图片表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 图片 ID |
| task_id | string | 来源任务 ID |
| file_path | string | 本地存储路径 |
| width | integer | 宽 |
| height | integer | 高 |
| prompt | text | 生成使用的 prompt 快照 |
| mode | string | 生成模式 |
| template_id | string | 模板 ID |
| created_at | datetime | 创建时间 |

### 1.3 templates

模板表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 模板 ID |
| name | string | 模板名称 |
| category | string | use_case / platform / company |
| description | text | 模板说明 |
| default_prompt | text | 默认 prompt |
| default_negative_prompt | text | 默认负面词 |
| default_size | string | 默认尺寸 |
| default_reference_strength | float | 默认参考强度 |
| default_style_strength | float | 默认风格强度 |
| source_image_id | string | 如果从历史保存，可关联图片 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 1.4 usage_daily

每日用量统计表。

| 字段 | 类型 | 说明 |
|---|---|---|
| date | string | 日期 |
| total_tasks | integer | 任务数 |
| succeeded_tasks | integer | 成功数 |
| failed_tasks | integer | 失败数 |
| total_images | integer | 生成图片数 |
| estimated_cost | float | 预估成本 |

### 1.5 conversations

会话表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 会话 ID |
| user_id | string | 所属用户 |
| title | string | 会话标题 |
| fixed_prompt_enabled | integer | 是否启用会话固定提示词 |
| fixed_prompt | text | 会话固定提示词，后续发往该会话的图片会自动套用 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

## 2. API 草案

### 2.1 创建生成任务

`POST /api/generation-tasks`

请求：

```json
{
  "mode": "text_to_image",
  "prompt": "一张极简风格的产品海报",
  "negativePrompt": "模糊，低清晰度",
  "size": "1024x1024",
  "quantity": 1,
  "templateId": "template_xxx",
  "sourceImageId": null,
  "referenceStrength": 0.6,
  "styleStrength": 0.7
}
```

响应：

```json
{
  "taskId": "task_xxx",
  "status": "queued"
}
```

### 2.2 获取任务列表

`GET /api/generation-tasks?status=queued,processing`

### 2.3 获取任务详情

`GET /api/generation-tasks/:id`

### 2.4 获取历史图片

`GET /api/images?mode=text_to_image&templateId=xxx&keyword=poster&page=1&pageSize=30`

### 2.5 上传参考图

`POST /api/source-images`

multipart/form-data 上传图片。

### 2.6 模板列表

`GET /api/templates`

### 2.7 创建模板

`POST /api/templates`

### 2.8 从历史图片保存为模板

`POST /api/templates/from-image`

### 2.9 管理统计

`GET /api/admin/stats?range=today|week`

返回今日/本周生成量、模型健康概览、平均耗时、失败率、高频错误、用户成功率排行和分组消耗。

### 2.10 更新会话固定提示词

`PATCH /api/conversations/:id`

请求：

```json
{
  "enabled": true,
  "fixedPrompt": "把上传图片统一处理成白底电商主图，保留主体，柔和自然光"
}
```

开启后，`POST /api/conversations/:id/messages` 可以只上传主图不填写本次 prompt；服务端会把会话固定提示词作为最终处理规则。

### 2.11 从会话固定提示词保存模板

`POST /api/templates/from-conversation-prompt`

把当前会话固定提示词保存为公司模板，方便复用到新会话。


## 3. 后端到 sub2api image-2 的映射

详见 `06-image-2接口调用说明.md`。

本项目后端 API 与 sub2api 的映射关系：

| 本项目模式 | 本项目入口 | sub2api endpoint | model |
|---|---|---|---|
| 文生图 | `POST /api/generation-tasks` | `POST https://s2a.laolin.ai/v1/images/generations` | `gpt-image-2` |
| 图生图 | `POST /api/generation-tasks` | `POST https://s2a.laolin.ai/v1/images/edits` | `gpt-image-2` |
| 会话内继续生成 | `POST /api/conversations/:id/messages` | `POST https://s2a.laolin.ai/v1/images/edits` | `gpt-image-2` |

实现要求：

- 前端只调用本项目后端，不直接调用 sub2api。
- sub2api key 只放服务端。
- worker 根据任务 `mode` 决定调用 generations 或 edits。
- 返回 `b64_json` 时后端解码保存；返回 `url` 时后端下载保存。
