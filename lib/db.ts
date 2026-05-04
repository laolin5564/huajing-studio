import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { appConfig, PUBLIC_FILE_PREFIX } from "./config";
import { composeConversationPrompt, normalizeConversationFixedPrompt } from "./conversation-prompt";
import { normalizeImageConcurrency } from "./concurrency";
import { normalizeImageSizeOption } from "./image-options";
import { normalizeProxyUrl, redactProxyUrl } from "./proxy";
import type {
  AdminStats,
  ConversationMessageRow,
  ConversationRow,
  GenerationMode,
  GenerationTaskRow,
  GeneratedImageRow,
  ImageProvider,
  OpenAIOAuthAccountRow,
  OpenAIOAuthAccountStatus,
  OpenAIOAuthSessionRow,
  PublicAdminSettings,
  PublicConversation,
  PublicConversationMessage,
  PublicImage,
  PublicTask,
  PublicSourceImage,
  PublicOpenAIOAuthAccount,
  PublicTemplate,
  PublicUser,
  PublicUserGroup,
  SessionRow,
  SourceImageRow,
  TaskProgressStage,
  TaskStatus,
  TemplateCategory,
  TemplateVariableDefinition,
  TemplateRow,
  TemplateScope,
  UserGroupRow,
  UserRole,
  UserRow,
} from "./types";

let db: DatabaseSync | null = null;

export interface CreateTaskInput {
  userId: string | null;
  conversationId?: string | null;
  mode: GenerationMode;
  prompt: string;
  negativePrompt: string | null;
  size: string;
  quantity: number;
  requestedConcurrency?: number | null;
  templateId: string | null;
  sourceImageId: string | null;
  referenceImageId?: string | null;
  referenceImageIds?: string[];
  referenceStrength: number;
  styleStrength: number;
  applyFixedPrompt?: boolean;
}

export interface CreateTemplateInput {
  ownerUserId?: string | null;
  name: string;
  category: TemplateCategory;
  description: string | null;
  defaultPrompt: string;
  defaultNegativePrompt: string | null;
  defaultSize: string;
  defaultReferenceStrength: number;
  defaultStyleStrength: number;
  sourceImageId: string | null;
  templateVariables?: TemplateVariableDefinition[];
}

export interface UpdateTemplateInput {
  name?: string;
  category?: TemplateCategory;
  description?: string | null;
  defaultPrompt?: string;
  defaultNegativePrompt?: string | null;
  defaultSize?: string;
  defaultReferenceStrength?: number;
  defaultStyleStrength?: number;
  sourceImageId?: string | null;
  templateVariables?: TemplateVariableDefinition[];
}

export interface ListImagesInput {
  userId?: string | null;
  isAdmin?: boolean;
  mode: GenerationMode | null;
  templateId: string | null;
  keyword: string | null;
  page: number;
  pageSize: number;
}

export interface ListTemplatesInput {
  userId?: string | null;
  category?: TemplateCategory | null;
  scope?: TemplateScope | "all";
}

export interface ListTasksInput {
  userId: string;
  isAdmin: boolean;
  statuses: TaskStatus[];
  limit: number;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  groupId: string | null;
  monthlyQuota: number | null;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  groupId?: string | null;
  monthlyQuota?: number | null;
}

type AppSettingKey =
  | "image_provider"
  | "sub2api_api_key"
  | "sub2api_base_url"
  | "openai_oauth_proxy_url"
  | "image_model"
  | "prompt_optimizer_model"
  | "image_concurrency"
  | "image_timeout_streak"
  | "image_auto_degraded_at"
  | "image_retention_days"
  | "site_title"
  | "site_subtitle"
  | "registration_enabled"
  | "registration_default_group_id"
  | "registration_default_quota";

function templateTextVariable(
  key: string,
  label: string,
  options: Partial<TemplateVariableDefinition> = {},
): TemplateVariableDefinition {
  return {
    key,
    label,
    type: options.type ?? "text",
    required: options.required ?? false,
    placeholder: options.placeholder ?? null,
    defaultValue: options.defaultValue ?? null,
    helperText: options.helperText ?? null,
    options: options.options ?? [],
  };
}

const builtInTemplates: Array<CreateTemplateInput & { id: string }> = [
  {
    id: "tpl_use_product_scene",
    name: "商品场景图",
    category: "use_case",
    description: "把商品处理成可直接用于电商展示的干净商业摄影图。",
    defaultPrompt:
      "生成一张电商商品场景图，真实商业摄影质感。产品名称：{产品名称}。标题文案：{标题文案}。品牌风格：{品牌风格}。背景风格：{背景风格}。构图要求：主体占画面 65%-75%，轮廓完整，边缘清晰，材质和真实阴影可见，背景干净，留出电商上架可用的呼吸感。灯光要求：柔和棚拍光、轻微轮廓光、不过曝。输出要求：高清、自然、不要多余文字、不要复杂道具、不要廉价促销感。",
    defaultNegativePrompt: "低清晰度，模糊，变形，多余文字，杂乱背景",
    defaultSize: "ecommerce_main_1_1",
    defaultReferenceStrength: 0.65,
    defaultStyleStrength: 0.7,
    sourceImageId: null,
    templateVariables: [
      templateTextVariable("产品名称", "产品名称", { required: true, placeholder: "例如：桌面空气净化器" }),
      templateTextVariable("品牌风格", "品牌风格", { placeholder: "例如：极简、科技、轻奢、自然" }),
      templateTextVariable("背景风格", "背景风格", { placeholder: "例如：白底、浅灰空间、家居台面" }),
      templateTextVariable("标题文案", "标题文案", { placeholder: "可留空，留空则不生成文字" }),
    ],
  },
  {
    id: "tpl_use_campaign_poster",
    name: "活动海报",
    category: "use_case",
    description: "适合促销、发布会、品牌活动的可加标题海报底图。",
    defaultPrompt:
      "生成一张活动海报，现代商业视觉。目标平台：{目标平台}。活动主题：{活动主题}。标题文案：{标题文案}。品牌风格：{品牌风格}。背景风格：{背景风格}。构图要求：单一强主视觉，主体和标题区层级明确，顶部或中部预留大标题安全区，边缘留白充足。画面要求：高级、清爽、有传播感，色调统一，适合后期叠加中文标题。输出要求：不要杂乱拼贴、不要错误文字、不要廉价促销感。",
    defaultNegativePrompt: "廉价促销风，文字乱码，低质感，过度装饰",
    defaultSize: "poster_2_3",
    defaultReferenceStrength: 0.55,
    defaultStyleStrength: 0.75,
    sourceImageId: null,
    templateVariables: [
      templateTextVariable("活动主题", "活动主题", { required: true, placeholder: "例如：618 新品限时活动" }),
      templateTextVariable("标题文案", "标题文案", { placeholder: "例如：新品上市 / 限时福利" }),
      templateTextVariable("目标平台", "目标平台", {
        type: "select",
        defaultValue: "通用海报",
        options: [
          { label: "通用海报", value: "通用海报" },
          { label: "抖音", value: "抖音" },
          { label: "小红书", value: "小红书" },
          { label: "公众号", value: "公众号" },
        ],
      }),
      templateTextVariable("品牌风格", "品牌风格", { placeholder: "例如：科技感、年轻活力、轻奢" }),
      templateTextVariable("背景风格", "背景风格", { placeholder: "例如：渐变光影、展台空间、节日氛围" }),
    ],
  },
  {
    id: "tpl_use_avatar",
    name: "品牌头像",
    category: "use_case",
    description: "适合品牌账号、人物头像和社媒形象。",
    defaultPrompt:
      "生成一个干净现代的品牌头像，适合社交媒体账号使用。品牌名称：{品牌名称}。品牌风格：{品牌风格}。图形方向：{图形方向}。构图要求：中心构图，主体占比清晰，边缘完整，小尺寸下仍然可辨认。视觉要求：几何关系稳定，颜色克制，有品牌识别度，不要复杂背景，不要多余文字。",
    defaultNegativePrompt: "夸张表情，低清晰度，比例错误，复杂背景",
    defaultSize: "ecommerce_main_1_1",
    defaultReferenceStrength: 0.6,
    defaultStyleStrength: 0.7,
    sourceImageId: null,
    templateVariables: [
      templateTextVariable("品牌名称", "品牌名称", { placeholder: "例如：Canvas Realm" }),
      templateTextVariable("品牌风格", "品牌风格", { placeholder: "例如：极简、温暖、科技、专业" }),
      templateTextVariable("图形方向", "图形方向", { placeholder: "例如：抽象符号、字母标、产品轮廓" }),
    ],
  },
  {
    id: "tpl_platform_xhs_cover",
    name: "小红书封面",
    category: "platform",
    description: "3:4 首图封面，偏生活感、干净明亮、保留标题区。",
    defaultPrompt:
      "生成一张小红书笔记封面图，3:4 竖版首图。内容主题：{内容主题}。标题文案：{标题文案}。主体描述：{主体描述}。品牌风格：{品牌风格}。背景风格：{背景风格}。构图要求：第一眼能看懂主题，主体位于中上区域，标题安全区清晰，文字区域不要压住主体。画面要求：明亮干净，生活方式质感，真实自然，留白舒服，适合信息流点击。输出要求：高清、可发布、不要低质营销感、不要拥挤排版。",
    defaultNegativePrompt: "字体乱码，拥挤，低质感，过暗，过度锐化",
    defaultSize: "xhs_cover_3_4",
    defaultReferenceStrength: 0.6,
    defaultStyleStrength: 0.72,
    sourceImageId: null,
    templateVariables: [
      templateTextVariable("内容主题", "内容主题", { required: true, placeholder: "例如：春季通勤包推荐" }),
      templateTextVariable("标题文案", "标题文案", { placeholder: "例如：通勤包怎么选" }),
      templateTextVariable("主体描述", "主体描述", { placeholder: "例如：一只米白色托特包" }),
      templateTextVariable("品牌风格", "品牌风格", { placeholder: "例如：温柔、生活感、清爽" }),
      templateTextVariable("背景风格", "背景风格", { placeholder: "例如：咖啡桌、卧室、街角自然光" }),
    ],
  },
  {
    id: "tpl_platform_wechat_header",
    name: "公众号封面图",
    category: "platform",
    description: "2.35:1 横版封面，强调文章标题区和信息流裁切安全。",
    defaultPrompt:
      "生成一张公众号文章封面图，横版构图，比例约 2.35:1，适合微信文章列表和分享卡片。文章主题：{文章主题}。标题文案：{标题文案}。主体元素：{主体元素}。品牌风格：{品牌风格}。背景风格：{背景风格}。构图要求：主视觉靠左或靠右，另一侧预留干净标题安全区，主体不要贴边，边缘留足裁切安全边距。画面要求：克制、专业、高级编辑封面感，信息密度适中，适合公众号信息流展示。输出要求：高清、干净、不要生成无意义小字、不要廉价模板感。",
    defaultNegativePrompt: "密集文字，画面拥挤，低清晰度，强烈眩光",
    defaultSize: "wechat_cover_235_1",
    defaultReferenceStrength: 0.55,
    defaultStyleStrength: 0.68,
    sourceImageId: null,
    templateVariables: [
      templateTextVariable("文章主题", "文章主题", { required: true, placeholder: "例如：AI 图片工作流升级指南" }),
      templateTextVariable("标题文案", "标题文案", { placeholder: "可留空，后期手动加字" }),
      templateTextVariable("主体元素", "主体元素", { placeholder: "例如：抽象光束、产品轮廓、办公桌面" }),
      templateTextVariable("品牌风格", "品牌风格", { placeholder: "例如：理性、科技、克制、商业" }),
      templateTextVariable("背景风格", "背景风格", { placeholder: "例如：抽象光影、办公空间、极简展台" }),
    ],
  },
  {
    id: "tpl_platform_douyin_cover",
    name: "抖音封面",
    category: "platform",
    description: "9:16 竖版封面，强对比、主体居中、适合标题叠加。",
    defaultPrompt:
      "生成一张抖音短视频封面，9:16 竖版。视频主题：{视频主题}。标题文案：{标题文案}。主体描述：{主体描述}。情绪氛围：{情绪氛围}。构图要求：主体居中偏上，脸部或产品足够大，顶部和中部保留醒目标题安全区，底部避开平台 UI 区域。画面要求：强对比、第一眼抓人、背景干净、信息层级明确。输出要求：高清锐利，不要杂乱直播间感，不要无意义文字。",
    defaultNegativePrompt: "杂乱背景，低清晰度，变形，文字乱码",
    defaultSize: "douyin_cover_9_16",
    defaultReferenceStrength: 0.58,
    defaultStyleStrength: 0.76,
    sourceImageId: null,
    templateVariables: [
      templateTextVariable("视频主题", "视频主题", { required: true, placeholder: "例如：新手 3 步拍出高级产品图" }),
      templateTextVariable("标题文案", "标题文案", { placeholder: "例如：3步拍出高级感" }),
      templateTextVariable("主体描述", "主体描述", { placeholder: "例如：拿着相机的年轻创作者" }),
      templateTextVariable("情绪氛围", "情绪氛围", {
        type: "select",
        defaultValue: "强冲击",
        options: [
          { label: "强冲击", value: "强冲击" },
          { label: "高级冷静", value: "高级冷静" },
          { label: "轻松生活感", value: "轻松生活感" },
          { label: "专业可信", value: "专业可信" },
        ],
      }),
    ],
  },
  {
    id: "tpl_platform_ecommerce_main",
    name: "电商主图",
    category: "platform",
    description: "1:1 白底或浅背景主图，突出产品占比、材质和阴影。",
    defaultPrompt:
      "生成一张电商主图，1:1 方图。产品名称：{产品名称}。产品卖点：{产品卖点}。品牌风格：{品牌风格}。背景风格：{背景风格}。构图要求：产品占画面 70%-80%，完整展示轮廓，正面或 3/4 角度，边缘清晰，适合电商货架浏览。材质与灯光：真实材质细节，柔光棚拍，轻微轮廓光，真实接触阴影。输出要求：白底或浅色干净背景，不要多余文字，不要复杂道具，不要产品变形。",
    defaultNegativePrompt: "杂乱背景，过度装饰，产品变形，边缘缺失，低清晰度，文字乱码",
    defaultSize: "ecommerce_main_1_1",
    defaultReferenceStrength: 0.72,
    defaultStyleStrength: 0.64,
    sourceImageId: null,
    templateVariables: [
      templateTextVariable("产品名称", "产品名称", { required: true, placeholder: "例如：便携榨汁杯" }),
      templateTextVariable("产品卖点", "产品卖点", { type: "textarea", placeholder: "例如：无线便携、易清洗、磨砂质感" }),
      templateTextVariable("品牌风格", "品牌风格", { placeholder: "例如：极简科技、轻奢、母婴友好" }),
      templateTextVariable("背景风格", "背景风格", {
        type: "select",
        defaultValue: "纯白背景",
        options: [
          { label: "纯白背景", value: "纯白背景" },
          { label: "浅灰摄影棚", value: "浅灰摄影棚" },
          { label: "柔和家居台面", value: "柔和家居台面" },
          { label: "高级展台空间", value: "高级展台空间" },
        ],
      }),
    ],
  },
  {
    id: "tpl_platform_product_detail",
    name: "商品详情图",
    category: "platform",
    description: "适合卖点解释、局部特写和详情页视觉模块。",
    defaultPrompt:
      "生成一张商品详情页视觉图。详情图比例：{详情图比例}。产品名称：{产品名称}。核心卖点：{核心卖点}。展示方式：{展示方式}。品牌风格：{品牌风格}。构图要求：围绕一个卖点组织画面，主体清晰，局部细节真实，预留短说明文字区。画面要求：高级电商详情页质感，背景干净，信息层级清楚，不要把文字和图标塞满画面。输出要求：高清、可信、产品不变形。",
    defaultNegativePrompt: "文字乱码，信息拥挤，产品变形，低清晰度，廉价促销风",
    defaultSize: "ecommerce_vertical_3_4",
    defaultReferenceStrength: 0.68,
    defaultStyleStrength: 0.68,
    sourceImageId: null,
    templateVariables: [
      templateTextVariable("产品名称", "产品名称", { required: true, placeholder: "例如：人体工学办公椅" }),
      templateTextVariable("核心卖点", "核心卖点", { required: true, placeholder: "例如：腰部支撑、透气网布、可调扶手" }),
      templateTextVariable("展示方式", "展示方式", {
        type: "select",
        defaultValue: "卖点场景展示",
        options: [
          { label: "卖点场景展示", value: "卖点场景展示" },
          { label: "局部特写", value: "局部特写" },
          { label: "结构拆解感", value: "结构拆解感" },
          { label: "使用前后对比", value: "使用前后对比" },
        ],
      }),
      templateTextVariable("详情图比例", "详情图比例", {
        type: "select",
        defaultValue: "3:4",
        options: [
          { label: "3:4", value: "3:4" },
          { label: "4:5", value: "4:5" },
        ],
      }),
      templateTextVariable("品牌风格", "品牌风格", { placeholder: "例如：专业、科技、温暖、轻奢" }),
    ],
  },
];

function castRows<T>(rows: unknown): T[] {
  return rows as T[];
}

function castRow<T>(row: unknown): T | null {
  return (row as T | undefined) ?? null;
}

export function getDb(): DatabaseSync {
  if (db) {
    initializeSchema(db);
    return db;
  }

  mkdirSync(path.dirname(appConfig.databasePath), { recursive: true });
  db = new DatabaseSync(appConfig.databasePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  initializeSchema(db);
  seedTemplates(db);
  return db;
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date = new Date()): string {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function startOfLocalWeek(date = new Date()): string {
  const start = new Date(date);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function initializeSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS generation_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      conversation_id TEXT,
      mode TEXT NOT NULL CHECK (mode IN ('text_to_image', 'image_to_image', 'edit_image')),
      status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'succeeded', 'failed')),
      progress_stage TEXT NOT NULL DEFAULT 'queued',
      prompt TEXT NOT NULL,
      fixed_prompt TEXT,
      prompt_suffix TEXT,
      negative_prompt TEXT,
      size TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity IN (1, 2, 4)),
      requested_concurrency INTEGER,
      template_id TEXT,
      source_image_id TEXT,
      reference_image_id TEXT,
      reference_strength REAL NOT NULL DEFAULT 0.6,
      style_strength REAL NOT NULL DEFAULT 0.7,
      cost_estimate REAL NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_generation_tasks_status_created
      ON generation_tasks (status, created_at);

    CREATE INDEX IF NOT EXISTS idx_generation_tasks_created
      ON generation_tasks (created_at);

    CREATE TABLE IF NOT EXISTS generated_images (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('text_to_image', 'image_to_image', 'edit_image')),
      template_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES generation_tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_generated_images_created
      ON generated_images (created_at);

    CREATE INDEX IF NOT EXISTS idx_generated_images_mode
      ON generated_images (mode);

    CREATE INDEX IF NOT EXISTS idx_generated_images_template
      ON generated_images (template_id);

    CREATE TABLE IF NOT EXISTS source_images (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      file_path TEXT NOT NULL,
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      original_name TEXT,
      mime_type TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('use_case', 'platform', 'company')),
      description TEXT,
      default_prompt TEXT NOT NULL,
      default_negative_prompt TEXT,
      default_size TEXT NOT NULL,
      default_reference_strength REAL NOT NULL DEFAULT 0.6,
      default_style_strength REAL NOT NULL DEFAULT 0.7,
      source_image_id TEXT,
      template_variables TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_templates_category
      ON templates (category);

    CREATE TABLE IF NOT EXISTS usage_daily (
      date TEXT PRIMARY KEY,
      total_tasks INTEGER NOT NULL DEFAULT 0,
      succeeded_tasks INTEGER NOT NULL DEFAULT 0,
      failed_tasks INTEGER NOT NULL DEFAULT 0,
      total_images INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      fixed_prompt_enabled INTEGER NOT NULL DEFAULT 0,
      fixed_prompt TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_updated
      ON conversations (updated_at);

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      task_id TEXT,
      image_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
      ON conversation_messages (conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS user_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      monthly_quota INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
      group_id TEXT,
      monthly_quota INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_group
      ON users (group_id);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token
      ON sessions (token_hash);

    CREATE TABLE IF NOT EXISTS openai_oauth_accounts (
      id TEXT PRIMARY KEY,
      email TEXT,
      account_id TEXT,
      user_id TEXT,
      organization_id TEXT,
      plan_type TEXT,
      client_id TEXT NOT NULL,
      access_token_ciphertext TEXT NOT NULL,
      refresh_token_ciphertext TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'error', 'disabled')),
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_openai_oauth_accounts_status
      ON openai_oauth_accounts (status, expires_at);

    CREATE INDEX IF NOT EXISTS idx_openai_oauth_accounts_account
      ON openai_oauth_accounts (account_id);

    CREATE TABLE IF NOT EXISTS openai_oauth_sessions (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      client_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_openai_oauth_sessions_expires
      ON openai_oauth_sessions (expires_at);
  `);
  ensureColumn(database, "generation_tasks", "user_id", "TEXT");
  ensureColumn(database, "generation_tasks", "conversation_id", "TEXT");
  ensureColumn(database, "generation_tasks", "progress_stage", "TEXT NOT NULL DEFAULT 'queued'");
  ensureColumn(database, "generation_tasks", "fixed_prompt", "TEXT");
  ensureColumn(database, "generation_tasks", "prompt_suffix", "TEXT");
  ensureColumn(database, "generation_tasks", "requested_concurrency", "INTEGER");
  ensureColumn(database, "generation_tasks", "reference_image_id", "TEXT");
  ensureColumn(database, "generation_tasks", "reference_image_ids", "TEXT");
  ensureColumn(database, "templates", "owner_user_id", "TEXT");
  ensureColumn(database, "templates", "template_variables", "TEXT");
  ensureColumn(database, "source_images", "user_id", "TEXT");
  ensureColumn(database, "conversations", "user_id", "TEXT");
  ensureColumn(database, "conversations", "fixed_prompt_enabled", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "conversations", "fixed_prompt", "TEXT");
  ensureColumn(database, "users", "monthly_quota", "INTEGER");
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_generation_tasks_user
      ON generation_tasks (user_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_generation_tasks_conversation
      ON generation_tasks (conversation_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_templates_owner
      ON templates (owner_user_id, created_at);
  `);
  seedDefaultGroups(database);
}

function ensureColumn(database: DatabaseSync, tableName: string, columnName: string, definition: string): void {
  const columns = castRows<{ name: string }>(database.prepare(`PRAGMA table_info(${tableName})`).all());
  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function seedDefaultGroups(database: DatabaseSync): void {
  const id = "grp_default";
  const now = nowIso();
  database
    .prepare(
      `
      INSERT OR IGNORE INTO user_groups (id, name, monthly_quota, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    )
    .run(id, "默认分组", 100, now, now);
}

export function countUsers(): number {
  const row = castRow<{ count: number }>(getDb().prepare("SELECT COUNT(*) AS count FROM users").get());
  return row?.count ?? 0;
}

export function getDefaultGroup(): UserGroupRow {
  const group = castRow<UserGroupRow>(
    getDb().prepare("SELECT * FROM user_groups WHERE id = 'grp_default' LIMIT 1").get(),
  );
  if (!group) {
    seedDefaultGroups(getDb());
    const seeded = castRow<UserGroupRow>(
      getDb().prepare("SELECT * FROM user_groups WHERE id = 'grp_default' LIMIT 1").get(),
    );
    if (!seeded) {
      throw new Error("默认分组初始化失败");
    }
    return seeded;
  }
  return group;
}

export function listUserGroups(): UserGroupRow[] {
  return castRows<UserGroupRow>(
    getDb().prepare("SELECT * FROM user_groups ORDER BY created_at ASC LIMIT 200").all(),
  );
}

export function getUserGroup(id: string): UserGroupRow | null {
  return castRow<UserGroupRow>(
    getDb().prepare("SELECT * FROM user_groups WHERE id = ? LIMIT 1").get(id),
  );
}

export function createUserGroup(input: { name: string; monthlyQuota: number }): UserGroupRow {
  const id = createId("grp");
  const createdAt = nowIso();
  getDb()
    .prepare(
      "INSERT INTO user_groups (id, name, monthly_quota, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, input.name, input.monthlyQuota, createdAt, createdAt);

  const group = getUserGroup(id);
  if (!group) {
    throw new Error("分组创建失败");
  }
  return group;
}

export function updateUserGroup(id: string, input: { name?: string; monthlyQuota?: number }): UserGroupRow {
  const existing = getUserGroup(id);
  if (!existing) {
    throw new Error("分组不存在");
  }

  getDb()
    .prepare("UPDATE user_groups SET name = ?, monthly_quota = ?, updated_at = ? WHERE id = ?")
    .run(input.name ?? existing.name, input.monthlyQuota ?? existing.monthly_quota, nowIso(), id);

  const updated = getUserGroup(id);
  if (!updated) {
    throw new Error("分组更新失败");
  }
  return updated;
}

export function createUser(input: CreateUserInput): UserRow {
  const id = createId("usr");
  const createdAt = nowIso();
  getDb()
    .prepare(
      `
      INSERT INTO users (
        id, email, name, password_hash, role, group_id, monthly_quota, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      input.email.toLowerCase(),
      input.name,
      input.passwordHash,
      input.role,
      input.groupId,
      input.monthlyQuota,
      createdAt,
      createdAt,
    );

  const user = getUserById(id);
  if (!user) {
    throw new Error("用户创建失败");
  }
  return user;
}

export function getUserById(id: string): UserRow | null {
  return castRow<UserRow>(getDb().prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(id));
}

export function getUserByEmail(email: string): UserRow | null {
  return castRow<UserRow>(
    getDb().prepare("SELECT * FROM users WHERE email = ? LIMIT 1").get(email.toLowerCase()),
  );
}

export function listUsers(): UserRow[] {
  return castRows<UserRow>(
    getDb().prepare("SELECT * FROM users ORDER BY created_at ASC LIMIT 500").all(),
  );
}

export function updateUser(id: string, input: UpdateUserInput): UserRow {
  const existing = getUserById(id);
  if (!existing) {
    throw new Error("用户不存在");
  }

  getDb()
    .prepare("UPDATE users SET name = ?, role = ?, group_id = ?, monthly_quota = ?, updated_at = ? WHERE id = ?")
    .run(
      input.name ?? existing.name,
      input.role ?? existing.role,
      input.groupId === undefined ? existing.group_id : input.groupId,
      input.monthlyQuota === undefined ? existing.monthly_quota : input.monthlyQuota,
      nowIso(),
      id,
    );

  const updated = getUserById(id);
  if (!updated) {
    throw new Error("用户更新失败");
  }
  return updated;
}

export function createSession(input: { userId: string; tokenHash: string; expiresAt: string }): SessionRow {
  const id = createId("sess");
  const createdAt = nowIso();
  getDb()
    .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, input.userId, input.tokenHash, input.expiresAt, createdAt);

  const session = castRow<SessionRow>(getDb().prepare("SELECT * FROM sessions WHERE id = ? LIMIT 1").get(id));
  if (!session) {
    throw new Error("会话创建失败");
  }
  return session;
}

export function getSessionByTokenHash(tokenHash: string): SessionRow | null {
  return castRow<SessionRow>(
    getDb()
      .prepare("SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ? LIMIT 1")
      .get(tokenHash, nowIso()),
  );
}

export function deleteSessionByTokenHash(tokenHash: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteExpiredSessions(): void {
  getDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
}

export function monthStartIso(date = new Date()): string {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export function getUserMonthImageUsage(userId: string): number {
  const row = castRow<{ count: number | null }>(
    getDb()
      .prepare(
        `
        SELECT COALESCE(SUM(quantity), 0) AS count
        FROM generation_tasks
        WHERE user_id = ? AND created_at >= ? AND status != 'failed'
      `,
      )
      .get(userId, monthStartIso()),
  );
  return row?.count ?? 0;
}

export function getUserQuota(userId: string): { monthlyQuota: number | null; monthUsed: number } {
  const user = getUserById(userId);
  if (!user) {
    return { monthlyQuota: null, monthUsed: 0 };
  }
  const group = user.group_id ? getUserGroup(user.group_id) : null;
  return {
    monthlyQuota: user.monthly_quota ?? group?.monthly_quota ?? null,
    monthUsed: getUserMonthImageUsage(userId),
  };
}

export function getAppSetting(key: AppSettingKey): string | null {
  const row = castRow<{ value: string }>(
    getDb().prepare("SELECT value FROM app_settings WHERE key = ? LIMIT 1").get(key),
  );
  return row?.value ?? null;
}

export function setAppSetting(key: AppSettingKey, value: string): void {
  getDb()
    .prepare(
      `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    )
    .run(key, value, nowIso());
}

export function createOpenAIOAuthSession(input: {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  expiresAt: string;
}): OpenAIOAuthSessionRow {
  const id = createId("oaise");
  const createdAt = nowIso();
  getDb()
    .prepare(
      `
      INSERT INTO openai_oauth_sessions (id, state, code_verifier, redirect_uri, client_id, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(id, input.state, input.codeVerifier, input.redirectUri, input.clientId, input.expiresAt, createdAt);
  const session = getOpenAIOAuthSession(id);
  if (!session) {
    throw new Error("OpenAI OAuth 会话创建失败");
  }
  return session;
}

export function getOpenAIOAuthSession(id: string): OpenAIOAuthSessionRow | null {
  return castRow<OpenAIOAuthSessionRow>(
    getDb()
      .prepare("SELECT * FROM openai_oauth_sessions WHERE id = ? AND expires_at > ? LIMIT 1")
      .get(id, nowIso()),
  );
}

export function getOpenAIOAuthSessionByState(state: string): OpenAIOAuthSessionRow | null {
  return castRow<OpenAIOAuthSessionRow>(
    getDb()
      .prepare("SELECT * FROM openai_oauth_sessions WHERE state = ? AND expires_at > ? LIMIT 1")
      .get(state, nowIso()),
  );
}

export function deleteOpenAIOAuthSession(id: string): void {
  getDb().prepare("DELETE FROM openai_oauth_sessions WHERE id = ?").run(id);
}

export function deleteExpiredOpenAIOAuthSessions(): void {
  getDb().prepare("DELETE FROM openai_oauth_sessions WHERE expires_at <= ?").run(nowIso());
}

export function listOpenAIOAuthAccounts(): OpenAIOAuthAccountRow[] {
  return castRows<OpenAIOAuthAccountRow>(
    getDb().prepare("SELECT * FROM openai_oauth_accounts ORDER BY updated_at DESC LIMIT 50").all(),
  );
}

export function getOpenAIOAuthAccount(id: string): OpenAIOAuthAccountRow | null {
  return castRow<OpenAIOAuthAccountRow>(
    getDb().prepare("SELECT * FROM openai_oauth_accounts WHERE id = ? LIMIT 1").get(id),
  );
}

export function getUsableOpenAIOAuthAccount(): OpenAIOAuthAccountRow | null {
  return castRow<OpenAIOAuthAccountRow>(
    getDb()
      .prepare("SELECT * FROM openai_oauth_accounts WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1")
      .get(),
  );
}

export function upsertOpenAIOAuthAccount(input: {
  email: string | null;
  accountId: string | null;
  userId: string | null;
  organizationId: string | null;
  planType: string | null;
  clientId: string;
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string;
  expiresAt: string;
}): OpenAIOAuthAccountRow {
  const existing = input.accountId
    ? castRow<{ id: string }>(
        getDb().prepare("SELECT id FROM openai_oauth_accounts WHERE account_id = ? LIMIT 1").get(input.accountId),
      )
    : null;
  const id = existing?.id ?? createId("oaia");
  const now = nowIso();
  getDb()
    .prepare(
      `
      INSERT INTO openai_oauth_accounts (
        id, email, account_id, user_id, organization_id, plan_type, client_id,
        access_token_ciphertext, refresh_token_ciphertext, expires_at, status, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        account_id = excluded.account_id,
        user_id = excluded.user_id,
        organization_id = excluded.organization_id,
        plan_type = excluded.plan_type,
        client_id = excluded.client_id,
        access_token_ciphertext = excluded.access_token_ciphertext,
        refresh_token_ciphertext = excluded.refresh_token_ciphertext,
        expires_at = excluded.expires_at,
        status = 'active',
        last_error = NULL,
        updated_at = excluded.updated_at
    `,
    )
    .run(
      id,
      input.email,
      input.accountId,
      input.userId,
      input.organizationId,
      input.planType,
      input.clientId,
      input.accessTokenCiphertext,
      input.refreshTokenCiphertext,
      input.expiresAt,
      now,
      now,
    );

  const account = getOpenAIOAuthAccount(id);
  if (!account) {
    throw new Error("OpenAI OAuth 账号保存失败");
  }
  return account;
}

export function updateOpenAIOAuthAccountTokens(
  id: string,
  input: {
    accessTokenCiphertext: string;
    refreshTokenCiphertext: string;
    expiresAt: string;
    email?: string | null;
    accountId?: string | null;
    userId?: string | null;
    organizationId?: string | null;
    planType?: string | null;
  },
): void {
  getDb()
    .prepare(
      `
      UPDATE openai_oauth_accounts
      SET access_token_ciphertext = ?, refresh_token_ciphertext = ?, expires_at = ?,
        email = COALESCE(?, email), account_id = COALESCE(?, account_id), user_id = COALESCE(?, user_id),
        organization_id = COALESCE(?, organization_id), plan_type = COALESCE(?, plan_type),
        status = 'active', last_error = NULL, updated_at = ?
      WHERE id = ?
    `,
    )
    .run(
      input.accessTokenCiphertext,
      input.refreshTokenCiphertext,
      input.expiresAt,
      input.email ?? null,
      input.accountId ?? null,
      input.userId ?? null,
      input.organizationId ?? null,
      input.planType ?? null,
      nowIso(),
      id,
    );
}

export function updateOpenAIOAuthAccountStatus(
  id: string,
  status: OpenAIOAuthAccountStatus,
  lastError: string | null,
): void {
  getDb()
    .prepare("UPDATE openai_oauth_accounts SET status = ?, last_error = ?, updated_at = ? WHERE id = ?")
    .run(status, lastError?.slice(0, 500) ?? null, nowIso(), id);
}

export function toPublicOpenAIOAuthAccount(row: OpenAIOAuthAccountRow): PublicOpenAIOAuthAccount {
  return {
    id: row.id,
    email: row.email,
    accountId: row.account_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    planType: row.plan_type,
    clientId: row.client_id,
    expiresAt: row.expires_at,
    status: row.status,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getRuntimeImageSettings(): {
  imageProvider: ImageProvider;
  sub2apiApiKey: string;
  sub2apiBaseUrl: string;
  openaiOAuthProxyUrl: string;
  imageModel: string;
  imageConcurrency: number;
} {
  const provider = getAppSetting("image_provider");
  return {
    imageProvider: provider === "openai_oauth" ? "openai_oauth" : "sub2api",
    sub2apiApiKey: getAppSetting("sub2api_api_key") || appConfig.sub2apiApiKey,
    sub2apiBaseUrl: getAppSetting("sub2api_base_url") || appConfig.sub2apiBaseUrl,
    openaiOAuthProxyUrl: normalizeProxyUrl(getAppSetting("openai_oauth_proxy_url")),
    imageModel: getAppSetting("image_model") || appConfig.imageModel,
    imageConcurrency: normalizeImageConcurrency(getAppSetting("image_concurrency") ?? 2, 2),
  };
}

export function getImageConcurrencySetting(): number {
  return getRuntimeImageSettings().imageConcurrency;
}

export function getPromptOptimizerSettings(): {
  model: string;
} {
  return {
    model: getAppSetting("prompt_optimizer_model") || appConfig.promptOptimizerModel,
  };
}

export function getImageRetentionDaysSetting(): number {
  const value = Number(getAppSetting("image_retention_days") ?? 0);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(Math.floor(value), 0), 3650);
}

export function getImageTimeoutStreak(): number {
  const value = Number(getAppSetting("image_timeout_streak") ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function resetImageTimeoutStreak(): void {
  if (getImageTimeoutStreak() !== 0) {
    setAppSetting("image_timeout_streak", "0");
  }
}

export function recordImageTimeoutFailure(): {
  timeoutStreak: number;
  degraded: boolean;
  previousConcurrency: number;
} {
  const timeoutStreak = getImageTimeoutStreak() + 1;
  const previousConcurrency = getImageConcurrencySetting();
  setAppSetting("image_timeout_streak", String(timeoutStreak));

  if (timeoutStreak >= 2 && previousConcurrency > 1) {
    setAppSetting("image_concurrency", "1");
    setAppSetting("image_auto_degraded_at", nowIso());
    return { timeoutStreak, degraded: true, previousConcurrency };
  }

  return { timeoutStreak, degraded: false, previousConcurrency };
}

export function getPublicSiteSettings(): {
  siteTitle: string;
  siteSubtitle: string;
  registrationEnabled: boolean;
} {
  const registration = getRegistrationSettings();
  return {
    siteTitle: getAppSetting("site_title") || "Canvas Realm Studio",
    siteSubtitle: getAppSetting("site_subtitle") || "image-2 workspace",
    registrationEnabled: registration.registrationEnabled || countUsers() === 0,
  };
}

export function getRegistrationSettings(): {
  registrationEnabled: boolean;
  registrationDefaultGroupId: string;
  registrationDefaultQuota: number;
} {
  const defaultGroup = getDefaultGroup();
  const configuredGroupId = getAppSetting("registration_default_group_id");
  const defaultGroupId =
    configuredGroupId && getUserGroup(configuredGroupId) ? configuredGroupId : defaultGroup.id;
  const quota = Number(getAppSetting("registration_default_quota") ?? defaultGroup.monthly_quota);

  return {
    registrationEnabled: getAppSetting("registration_enabled") !== "false",
    registrationDefaultGroupId: defaultGroupId,
    registrationDefaultQuota: Number.isFinite(quota) ? Math.max(0, Math.floor(quota)) : defaultGroup.monthly_quota,
  };
}

export function getPublicAdminSettings(): PublicAdminSettings {
  const settings = getRuntimeImageSettings();
  const promptOptimizer = getPromptOptimizerSettings();
  const site = getPublicSiteSettings();
  const registration = getRegistrationSettings();
  return {
    imageProvider: settings.imageProvider,
    sub2apiApiKeyConfigured: settings.sub2apiApiKey.length > 0,
    sub2apiBaseUrl: settings.sub2apiBaseUrl,
    openaiOAuthProxyConfigured: settings.openaiOAuthProxyUrl.length > 0,
    openaiOAuthProxyDisplay: redactProxyUrl(settings.openaiOAuthProxyUrl),
    imageModel: settings.imageModel,
    imageConcurrency: settings.imageConcurrency,
    imageRetentionDays: getImageRetentionDaysSetting(),
    promptOptimizerModel: promptOptimizer.model,
    siteTitle: site.siteTitle,
    siteSubtitle: site.siteSubtitle,
    registrationEnabled: registration.registrationEnabled,
    registrationDefaultGroupId: registration.registrationDefaultGroupId,
    registrationDefaultQuota: registration.registrationDefaultQuota,
  };
}

function seedTemplates(database: DatabaseSync): void {
  const createdAt = nowIso();
  const statement = database.prepare(`
    INSERT OR IGNORE INTO templates (
      id, owner_user_id, name, category, description, default_prompt, default_negative_prompt,
      default_size, default_reference_strength, default_style_strength,
      source_image_id, template_variables, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateBuiltIn = database.prepare(`
    UPDATE templates
    SET name = ?, category = ?, description = ?, default_prompt = ?,
      default_negative_prompt = ?, default_size = ?, default_reference_strength = ?,
      default_style_strength = ?, source_image_id = ?, template_variables = ?, updated_at = ?
    WHERE id = ? AND owner_user_id IS NULL
  `);

  for (const template of builtInTemplates) {
    const variables = serializeTemplateVariables(template.templateVariables);
    statement.run(
      template.id,
      null,
      template.name,
      template.category,
      template.description,
      template.defaultPrompt,
      template.defaultNegativePrompt,
      template.defaultSize,
      template.defaultReferenceStrength,
      template.defaultStyleStrength,
      template.sourceImageId,
      variables,
      createdAt,
      createdAt,
    );
    updateBuiltIn.run(
      template.name,
      template.category,
      template.description,
      template.defaultPrompt,
      template.defaultNegativePrompt,
      template.defaultSize,
      template.defaultReferenceStrength,
      template.defaultStyleStrength,
      template.sourceImageId,
      variables,
      createdAt,
      template.id,
    );
  }
}

function serializeTemplateVariables(variables: TemplateVariableDefinition[] | undefined): string | null {
  if (!variables || variables.length === 0) {
    return null;
  }
  return JSON.stringify(variables.map((variable) => ({
    key: variable.key,
    label: variable.label,
    type: variable.type,
    required: variable.required,
    placeholder: variable.placeholder,
    defaultValue: variable.defaultValue,
    helperText: variable.helperText,
    options: variable.options,
  })));
}

function parseTemplateVariables(value: string | null): TemplateVariableDefinition[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as TemplateVariableDefinition[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item.key === "string" && typeof item.label === "string")
      .map((item) => ({
        key: item.key,
        label: item.label,
        type: item.type === "textarea" || item.type === "select" ? item.type : "text",
        required: Boolean(item.required),
        placeholder: typeof item.placeholder === "string" ? item.placeholder : null,
        defaultValue: typeof item.defaultValue === "string" ? item.defaultValue : null,
        helperText: typeof item.helperText === "string" ? item.helperText : null,
        options: Array.isArray(item.options)
          ? item.options
              .filter((option) => option && typeof option.label === "string" && typeof option.value === "string")
              .map((option) => ({ label: option.label, value: option.value }))
          : [],
      }));
  } catch {
    return [];
  }
}

function titleFromPrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "新的图片会话";
  }
  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
}

export function createConversation(title: string, userId: string | null): ConversationRow {
  const id = createId("conv");
  const createdAt = nowIso();
  getDb()
    .prepare(
      `
      INSERT INTO conversations (
        id, user_id, title, fixed_prompt_enabled, fixed_prompt, created_at, updated_at
      ) VALUES (?, ?, ?, 0, NULL, ?, ?)
    `,
    )
    .run(id, userId, title, createdAt, createdAt);

  const conversation = getConversation(id);
  if (!conversation) {
    throw new Error("会话创建失败");
  }
  return conversation;
}

export function getConversation(id: string): ConversationRow | null {
  return castRow<ConversationRow>(
    getDb().prepare("SELECT * FROM conversations WHERE id = ? LIMIT 1").get(id),
  );
}

export function updateConversationFixedPrompt(
  id: string,
  input: { enabled: boolean; fixedPrompt: string | null },
): ConversationRow {
  const existing = getConversation(id);
  if (!existing) {
    throw new Error("会话不存在");
  }

  const fixedPrompt = normalizeConversationFixedPrompt(input.fixedPrompt);
  const enabled = input.enabled && Boolean(fixedPrompt);
  getDb()
    .prepare(
      `
      UPDATE conversations
      SET fixed_prompt_enabled = ?, fixed_prompt = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    .run(enabled ? 1 : 0, fixedPrompt, nowIso(), id);

  const updated = getConversation(id);
  if (!updated) {
    throw new Error("会话固定提示词更新失败");
  }
  return updated;
}

export function listConversations(input: { userId: string; isAdmin: boolean; limit?: number }): ConversationRow[] {
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 60);
  if (input.isAdmin) {
    return castRows<ConversationRow>(
      getDb().prepare("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?").all(limit),
    );
  }

  return castRows<ConversationRow>(
    getDb()
      .prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?")
      .all(input.userId, limit),
  );
}

export function touchConversation(id: string): void {
  getDb().prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(nowIso(), id);
}

export function createConversationMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  taskId: string | null;
  imageId: string | null;
}): ConversationMessageRow {
  const id = createId("msg");
  const createdAt = nowIso();
  getDb()
    .prepare(
      `
      INSERT INTO conversation_messages (
        id, conversation_id, role, content, task_id, image_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      input.conversationId,
      input.role,
      input.content,
      input.taskId,
      input.imageId,
      createdAt,
    );
  touchConversation(input.conversationId);

  const message = getConversationMessage(id);
  if (!message) {
    throw new Error("会话消息创建失败");
  }
  return message;
}

export function getConversationMessage(id: string): ConversationMessageRow | null {
  return castRow<ConversationMessageRow>(
    getDb().prepare("SELECT * FROM conversation_messages WHERE id = ? LIMIT 1").get(id),
  );
}

export function listConversationMessages(conversationId: string): ConversationMessageRow[] {
  return castRows<ConversationMessageRow>(
    getDb()
      .prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 200")
      .all(conversationId),
  );
}

export function listConversationTasks(conversationId: string): GenerationTaskRow[] {
  return castRows<GenerationTaskRow>(
    getDb()
      .prepare("SELECT * FROM generation_tasks WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100")
      .all(conversationId),
  );
}

export function deleteConversationWithGeneratedImages(conversationId: string): {
  conversation: ConversationRow;
  images: GeneratedImageRow[];
} {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error("会话不存在");
  }

  const images = castRows<GeneratedImageRow>(
    getDb()
      .prepare(
        `
        SELECT gi.*
        FROM generated_images gi
        INNER JOIN generation_tasks gt ON gt.id = gi.task_id
        WHERE gt.conversation_id = ?
        ORDER BY gi.created_at ASC
        LIMIT 1000
      `,
      )
      .all(conversationId),
  );
  const imageIds = images.map((image) => image.id);
  const database = getDb();

  database.exec("BEGIN IMMEDIATE");
  try {
    if (imageIds.length > 0) {
      const placeholders = imageIds.map(() => "?").join(", ");
      database
        .prepare(`UPDATE templates SET source_image_id = NULL, updated_at = ? WHERE source_image_id IN (${placeholders})`)
        .run(nowIso(), ...imageIds);
    }
    database.prepare("DELETE FROM conversation_messages WHERE conversation_id = ?").run(conversationId);
    database
      .prepare(
        `
        DELETE FROM generated_images
        WHERE task_id IN (SELECT id FROM generation_tasks WHERE conversation_id = ?)
      `,
      )
      .run(conversationId);
    database.prepare("DELETE FROM generation_tasks WHERE conversation_id = ?").run(conversationId);
    database.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return { conversation, images };
}

export function getLatestConversationTask(conversationId: string): GenerationTaskRow | null {
  return castRow<GenerationTaskRow>(
    getDb()
      .prepare("SELECT * FROM generation_tasks WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(conversationId),
  );
}

export function getLatestConversationImage(conversationId: string): GeneratedImageRow | null {
  return castRow<GeneratedImageRow>(
    getDb()
      .prepare(
        `
        SELECT gi.*
        FROM generated_images gi
        INNER JOIN generation_tasks gt ON gt.id = gi.task_id
        WHERE gt.conversation_id = ?
        ORDER BY gi.created_at DESC
        LIMIT 1
      `,
      )
      .get(conversationId),
  );
}

export function getConversationImageMap(conversationId: string): Map<string, GeneratedImageRow> {
  const rows = castRows<GeneratedImageRow>(
    getDb()
      .prepare(
        `
        SELECT gi.*
        FROM generated_images gi
        INNER JOIN generation_tasks gt ON gt.id = gi.task_id
        WHERE gt.conversation_id = ?
        ORDER BY gi.created_at ASC
        LIMIT 200
      `,
      )
      .all(conversationId),
  );
  return new Map(rows.map((image) => [image.id, image]));
}

export function createGenerationTask(input: CreateTaskInput): GenerationTaskRow {
  const database = getDb();
  const id = createId("task");
  const createdAt = nowIso();
  const costEstimate = input.quantity * appConfig.costPerImage;

  try {
    database.exec("BEGIN IMMEDIATE");
    const existingConversation = input.conversationId ? getConversation(input.conversationId) : null;
    const conversation = existingConversation ?? createConversation(titleFromPrompt(input.prompt), input.userId);
    const conversationId = conversation.id;
    const activeFixedPrompt =
      input.applyFixedPrompt === false || conversation.fixed_prompt_enabled !== 1
        ? null
        : conversation.fixed_prompt;
    const composedPrompt = composeConversationPrompt(input.prompt, activeFixedPrompt);
    if (!composedPrompt.finalPrompt) {
      throw new Error("prompt 不能为空");
    }

    database
      .prepare(
        `
        INSERT INTO generation_tasks (
          id, user_id, conversation_id, mode, status, progress_stage, prompt, fixed_prompt, prompt_suffix,
          negative_prompt, size, quantity, requested_concurrency, template_id,
          source_image_id, reference_image_id, reference_image_ids, reference_strength, style_strength, cost_estimate,
          error_message, created_at, started_at, completed_at
        ) VALUES (?, ?, ?, ?, 'queued', 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL)
      `,
      )
      .run(
        id,
        input.userId,
        conversationId,
        input.mode,
        composedPrompt.finalPrompt,
        composedPrompt.fixedPrompt,
        composedPrompt.promptSuffix,
        input.negativePrompt,
        input.size,
        input.quantity,
        input.requestedConcurrency ?? null,
        input.templateId,
        input.sourceImageId,
        input.referenceImageId ?? null,
        JSON.stringify(input.referenceImageIds ?? []),
        input.referenceStrength,
        input.styleStrength,
        costEstimate,
        createdAt,
      );

    createConversationMessage({
      conversationId,
      role: "user",
      content: composedPrompt.messageContent,
      taskId: id,
      imageId: input.sourceImageId,
    });
    touchConversation(conversationId);
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Ignore rollback failures when SQLite has already closed the transaction.
    }
    throw error;
  }

  const task = getGenerationTask(id);
  if (!task) {
    throw new Error("任务创建失败");
  }
  return task;
}

export function listGenerationTasks(input: ListTasksInput): GenerationTaskRow[] {
  const database = getDb();
  const boundedLimit = Math.min(Math.max(input.limit, 1), 50);
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (!input.isAdmin) {
    where.push("user_id = ?");
    params.push(input.userId);
  }

  if (input.statuses.length > 0) {
    const placeholders = input.statuses.map(() => "?").join(", ");
    where.push(`status IN (${placeholders})`);
    params.push(...input.statuses);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return castRows<GenerationTaskRow>(
    database
      .prepare(`SELECT * FROM generation_tasks ${whereSql} ORDER BY created_at DESC LIMIT ?`)
      .all(...params, boundedLimit),
  );
}

export function getGenerationTask(id: string): GenerationTaskRow | null {
  return castRow<GenerationTaskRow>(
    getDb()
      .prepare("SELECT * FROM generation_tasks WHERE id = ? LIMIT 1")
      .get(id),
  );
}

export function getTaskImages(taskId: string): GeneratedImageRow[] {
  return castRows<GeneratedImageRow>(
    getDb()
      .prepare("SELECT * FROM generated_images WHERE task_id = ? ORDER BY created_at ASC LIMIT 20")
      .all(taskId),
  );
}

export function claimNextQueuedTask(): GenerationTaskRow | null {
  return claimQueuedTasks(1)[0] ?? null;
}

export function claimQueuedTasks(limit: number): GenerationTaskRow[] {
  const database = getDb();
  const boundedLimit = normalizeImageConcurrency(limit);
  const startedAt = nowIso();

  try {
    database.exec("BEGIN IMMEDIATE");
    const queued = castRows<{ id: string }>(
      database
        .prepare("SELECT id FROM generation_tasks WHERE status = 'queued' ORDER BY created_at ASC, id ASC LIMIT ?")
        .all(boundedLimit),
    );

    if (queued.length === 0) {
      database.exec("COMMIT");
      return [];
    }

    const ids = queued.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(", ");
    database
      .prepare(
        `
        UPDATE generation_tasks
        SET status = 'processing', progress_stage = 'requesting', started_at = ?, error_message = NULL
        WHERE status = 'queued' AND id IN (${placeholders})
      `,
      )
      .run(startedAt, ...ids);

    database.exec("COMMIT");
    const taskMap = new Map(ids.map((id) => [id, getGenerationTask(id)]));
    return ids.map((id) => taskMap.get(id)).filter((task): task is GenerationTaskRow => Boolean(task));
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Ignore rollback failures when SQLite has already closed the transaction.
    }
    throw error;
  }
}

export function updateTaskProgressStage(taskId: string, stage: TaskProgressStage): void {
  getDb()
    .prepare("UPDATE generation_tasks SET progress_stage = ? WHERE id = ? AND status = 'processing'")
    .run(stage, taskId);
}

export function markTaskSucceeded(taskId: string, imageCount: number): void {
  const completedAt = nowIso();
  const task = getGenerationTask(taskId);
  if (!task) {
    return;
  }

  const result = getDb()
    .prepare(
      "UPDATE generation_tasks SET status = 'succeeded', progress_stage = 'completed', completed_at = ?, error_message = NULL WHERE id = ? AND status = 'processing'",
    )
    .run(completedAt, taskId);

  if (result.changes !== 1) {
    return;
  }

  if (task.conversation_id) {
    const images = getTaskImages(taskId);
    if (images.length > 0) {
      createConversationMessage({
        conversationId: task.conversation_id,
        role: "assistant",
        content: images.length > 1 ? `生成完成，共 ${images.length} 张` : "生成完成",
        taskId,
        imageId: images.length === 1 ? images[0].id : null,
      });
    }
    touchConversation(task.conversation_id);
  }

  upsertUsageDaily({ succeeded: 1, failed: 0, images: imageCount, cost: task.cost_estimate });
}

export function markTaskFailed(taskId: string, message: string): void {
  const task = getGenerationTask(taskId);
  if (!task) {
    return;
  }

  const result = getDb()
    .prepare(
      "UPDATE generation_tasks SET status = 'failed', progress_stage = 'failed', completed_at = ?, error_message = ? WHERE id = ? AND status = 'processing'",
    )
    .run(nowIso(), message.slice(0, 1000), taskId);

  if (result.changes !== 1) {
    return;
  }

  if (task.conversation_id) {
    createConversationMessage({
      conversationId: task.conversation_id,
      role: "assistant",
      content: `生成失败：${message.slice(0, 220)}`,
      taskId,
      imageId: null,
    });
  }

  upsertUsageDaily({ succeeded: 0, failed: 1, images: 0, cost: task.cost_estimate });
}

export const taskStoppedMessage = "用户已停止生成";

export function cancelGenerationTask(taskId: string): GenerationTaskRow | null {
  const task = getGenerationTask(taskId);
  if (!task) {
    return null;
  }

  if (task.status !== "queued" && task.status !== "processing") {
    return task;
  }

  getDb()
    .prepare(
      `
      UPDATE generation_tasks
      SET status = 'failed', progress_stage = 'canceled', completed_at = ?, error_message = ?
      WHERE id = ? AND status IN ('queued', 'processing')
    `,
    )
    .run(nowIso(), taskStoppedMessage, taskId);

  if (task.conversation_id) {
    createConversationMessage({
      conversationId: task.conversation_id,
      role: "assistant",
      content: "已停止生成",
      taskId,
      imageId: null,
    });
  }

  return getGenerationTask(taskId);
}

export function isTaskStopped(taskId: string): boolean {
  const task = getGenerationTask(taskId);
  return task?.status === "failed" && task.error_message === taskStoppedMessage;
}

function upsertUsageDaily(input: { succeeded: number; failed: number; images: number; cost: number }): void {
  const date = localDateKey();
  getDb()
    .prepare(
      `
      INSERT INTO usage_daily (
        date, total_tasks, succeeded_tasks, failed_tasks, total_images, estimated_cost
      ) VALUES (?, 1, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        total_tasks = total_tasks + 1,
        succeeded_tasks = succeeded_tasks + excluded.succeeded_tasks,
        failed_tasks = failed_tasks + excluded.failed_tasks,
        total_images = total_images + excluded.total_images,
        estimated_cost = estimated_cost + excluded.estimated_cost
    `,
    )
    .run(date, input.succeeded, input.failed, input.images, input.cost);
}

export function createGeneratedImage(input: {
  id?: string;
  taskId: string;
  filePath: string;
  width: number;
  height: number;
  prompt: string;
  mode: GenerationMode;
  templateId: string | null;
}): GeneratedImageRow {
  const id = input.id ?? createId("img");
  const createdAt = nowIso();
  getDb()
    .prepare(
      `
      INSERT INTO generated_images (
        id, task_id, file_path, width, height, prompt, mode, template_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      input.taskId,
      input.filePath,
      input.width,
      input.height,
      input.prompt,
      input.mode,
      input.templateId,
      createdAt,
    );

  const image = getGeneratedImage(id);
  if (!image) {
    throw new Error("图片记录创建失败");
  }
  return image;
}

export function getGeneratedImage(id: string): GeneratedImageRow | null {
  return castRow<GeneratedImageRow>(
    getDb()
      .prepare("SELECT * FROM generated_images WHERE id = ? LIMIT 1")
      .get(id),
  );
}

export function getGeneratedImageByFilePath(filePath: string): GeneratedImageRow | null {
  return castRow<GeneratedImageRow>(
    getDb()
      .prepare("SELECT * FROM generated_images WHERE file_path = ? LIMIT 1")
      .get(filePath),
  );
}

export function createSourceImage(input: {
  userId: string | null;
  filePath: string;
  width: number;
  height: number;
  originalName: string | null;
  mimeType: string | null;
}): SourceImageRow {
  const id = createId("src");
  const createdAt = nowIso();
  getDb()
    .prepare(
      `
      INSERT INTO source_images (
        id, user_id, file_path, width, height, original_name, mime_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(id, input.userId, input.filePath, input.width, input.height, input.originalName, input.mimeType, createdAt);

  const source = getSourceImage(id);
  if (!source) {
    throw new Error("参考图记录创建失败");
  }
  return source;
}

export function getSourceImage(id: string): SourceImageRow | null {
  return castRow<SourceImageRow>(
    getDb()
      .prepare("SELECT * FROM source_images WHERE id = ? LIMIT 1")
      .get(id),
  );
}

export function getSourceImageByFilePath(filePath: string): SourceImageRow | null {
  return castRow<SourceImageRow>(
    getDb()
      .prepare("SELECT * FROM source_images WHERE file_path = ? LIMIT 1")
      .get(filePath),
  );
}

export function getImageFilePathById(id: string): string | null {
  const generated = getGeneratedImage(id);
  if (generated) {
    return generated.file_path;
  }

  const source = getSourceImage(id);
  return source?.file_path ?? null;
}

export function listImages(input: ListImagesInput): Array<GeneratedImageRow & { template_name: string | null }> {
  const database = getDb();
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (input.mode) {
    if (input.mode === "image_to_image") {
      where.push("gi.mode IN ('image_to_image', 'edit_image')");
    } else {
      where.push("gi.mode = ?");
      params.push(input.mode);
    }
  }

  if (input.templateId) {
    where.push("gi.template_id = ?");
    params.push(input.templateId);
  }

  if (input.keyword) {
    where.push("gi.prompt LIKE ?");
    params.push(`%${input.keyword}%`);
  }

  if (input.userId && !input.isAdmin) {
    where.push("gt.user_id = ?");
    params.push(input.userId);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const pageSize = Math.min(Math.max(input.pageSize, 1), 60);
  const offset = (Math.max(input.page, 1) - 1) * pageSize;

  return castRows<GeneratedImageRow & { template_name: string | null }>(
    database
    .prepare(
      `
      SELECT gi.*, t.name AS template_name
      FROM generated_images gi
      INNER JOIN generation_tasks gt ON gt.id = gi.task_id
      LEFT JOIN templates t ON t.id = gi.template_id
      ${whereSql}
      ORDER BY gi.created_at DESC
      LIMIT ? OFFSET ?
    `,
    )
      .all(...params, pageSize, offset),
  );
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export function getGeneratedImagesByIds(ids: string[]): GeneratedImageRow[] {
  const safeIds = uniqueIds(ids);
  if (safeIds.length === 0) {
    return [];
  }
  const placeholders = safeIds.map(() => "?").join(", ");
  return castRows<GeneratedImageRow>(
    getDb()
      .prepare(`SELECT * FROM generated_images WHERE id IN (${placeholders}) LIMIT ${safeIds.length}`)
      .all(...safeIds),
  );
}

export function listExpiredGeneratedImages(cutoffIso: string, limit = 200): GeneratedImageRow[] {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 1000);
  return castRows<GeneratedImageRow>(
    getDb()
      .prepare("SELECT * FROM generated_images WHERE created_at < ? ORDER BY created_at ASC LIMIT ?")
      .all(cutoffIso, safeLimit),
  );
}

export function deleteGeneratedImagesByIds(ids: string[]): GeneratedImageRow[] {
  const existing = getGeneratedImagesByIds(ids);
  if (existing.length === 0) {
    return [];
  }

  const imageIds = existing.map((image) => image.id);
  const placeholders = imageIds.map(() => "?").join(", ");
  const database = getDb();
  const timestamp = nowIso();

  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(`UPDATE conversation_messages SET image_id = NULL WHERE image_id IN (${placeholders})`)
      .run(...imageIds);
    database
      .prepare(`UPDATE templates SET source_image_id = NULL, updated_at = ? WHERE source_image_id IN (${placeholders})`)
      .run(timestamp, ...imageIds);
    database
      .prepare(`DELETE FROM generated_images WHERE id IN (${placeholders})`)
      .run(...imageIds);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  return existing;
}

export function listTemplates(input: ListTemplatesInput | TemplateCategory = {}): TemplateRow[] {
  const normalized: ListTemplatesInput = typeof input === "string" ? { category: input } : input;
  const where: string[] = [];
  const params: Array<string | number> = [];
  const scope = normalized.scope ?? "all";

  if (normalized.category) {
    where.push("category = ?");
    params.push(normalized.category);
  }

  if (scope === "platform") {
    where.push("owner_user_id IS NULL");
  } else if (scope === "user") {
    where.push("owner_user_id = ?");
    params.push(normalized.userId ?? "");
  } else if (normalized.userId) {
    where.push("(owner_user_id IS NULL OR owner_user_id = ?)");
    params.push(normalized.userId);
  } else {
    where.push("owner_user_id IS NULL");
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  return castRows<TemplateRow>(
    getDb()
      .prepare(
        `
        SELECT *
        FROM templates
        ${whereSql}
        ORDER BY
          CASE WHEN owner_user_id IS NULL THEN 0 ELSE 1 END,
          CASE category WHEN 'use_case' THEN 1 WHEN 'platform' THEN 2 ELSE 3 END,
          created_at ASC
        LIMIT 300
      `,
      )
      .all(...params),
  );
}

export function getTemplate(id: string): TemplateRow | null {
  return castRow<TemplateRow>(
    getDb()
      .prepare("SELECT * FROM templates WHERE id = ? LIMIT 1")
      .get(id),
  );
}

export function createTemplate(input: CreateTemplateInput): TemplateRow {
  const id = createId("tpl");
  const createdAt = nowIso();

  getDb()
    .prepare(
      `
      INSERT INTO templates (
        id, owner_user_id, name, category, description, default_prompt, default_negative_prompt,
        default_size, default_reference_strength, default_style_strength,
        source_image_id, template_variables, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      input.ownerUserId ?? null,
      input.name,
      input.category,
      input.description,
      input.defaultPrompt,
      input.defaultNegativePrompt,
      input.defaultSize,
      input.defaultReferenceStrength,
      input.defaultStyleStrength,
      input.sourceImageId,
      serializeTemplateVariables(input.templateVariables),
      createdAt,
      createdAt,
    );

  const template = getTemplate(id);
  if (!template) {
    throw new Error("模板创建失败");
  }
  return template;
}

export function updateTemplate(id: string, input: UpdateTemplateInput): TemplateRow {
  const existing = getTemplate(id);
  if (!existing) {
    throw new Error("模板不存在");
  }

  const merged = {
    name: input.name ?? existing.name,
    category: input.category ?? existing.category,
    description: input.description === undefined ? existing.description : input.description,
    defaultPrompt: input.defaultPrompt ?? existing.default_prompt,
    defaultNegativePrompt:
      input.defaultNegativePrompt === undefined ? existing.default_negative_prompt : input.defaultNegativePrompt,
    defaultSize: input.defaultSize ?? existing.default_size,
    defaultReferenceStrength: input.defaultReferenceStrength ?? existing.default_reference_strength,
    defaultStyleStrength: input.defaultStyleStrength ?? existing.default_style_strength,
    sourceImageId: input.sourceImageId === undefined ? existing.source_image_id : input.sourceImageId,
    templateVariables:
      input.templateVariables === undefined ? existing.template_variables : serializeTemplateVariables(input.templateVariables),
  };

  getDb()
    .prepare(
      `
      UPDATE templates
      SET name = ?, category = ?, description = ?, default_prompt = ?,
        default_negative_prompt = ?, default_size = ?, default_reference_strength = ?,
        default_style_strength = ?, source_image_id = ?, template_variables = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    .run(
      merged.name,
      merged.category,
      merged.description,
      merged.defaultPrompt,
      merged.defaultNegativePrompt,
      merged.defaultSize,
      merged.defaultReferenceStrength,
      merged.defaultStyleStrength,
      merged.sourceImageId,
      merged.templateVariables,
      nowIso(),
      id,
    );

  const updated = getTemplate(id);
  if (!updated) {
    throw new Error("模板更新失败");
  }
  return updated;
}

export function deleteTemplate(id: string): TemplateRow {
  const existing = getTemplate(id);
  if (!existing) {
    throw new Error("模板不存在");
  }

  getDb().prepare("DELETE FROM templates WHERE id = ?").run(id);
  return existing;
}

export function getAdminStats(): AdminStats {
  const database = getDb();
  const todayStart = startOfLocalDay();
  const weekStart = startOfLocalWeek();
  const monthStart = monthStartIso();
  const runtimeSettings = getRuntimeImageSettings();
  type StatsRangeRow = {
    totalTasks: number;
    succeededTasks: number | null;
    failedTasks: number | null;
    totalImages: number;
    estimatedCost: number | null;
  };
  const emptyRange: StatsRangeRow = {
    totalTasks: 0,
    succeededTasks: 0,
    failedTasks: 0,
    totalImages: 0,
    estimatedCost: 0,
  };

  const readRange = (start: string) =>
    castRow<StatsRangeRow>(
      database
        .prepare(
          `
        SELECT
          COUNT(*) AS totalTasks,
          SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeededTasks,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedTasks,
          COALESCE((SELECT COUNT(*) FROM generated_images WHERE created_at >= ?), 0) AS totalImages,
          COALESCE(SUM(cost_estimate), 0) AS estimatedCost
        FROM generation_tasks
        WHERE created_at >= ?
      `,
        )
        .get(start, start),
    );

  const today = readRange(todayStart) ?? emptyRange;
  const week = readRange(weekStart) ?? emptyRange;
  const weekTotal = week.totalTasks || 0;
  const weekFailed = week.failedTasks ?? 0;
  const failureRate = weekTotal > 0 ? Number(((weekFailed / weekTotal) * 100).toFixed(1)) : 0;
  const averageDuration = castRow<{ averageSeconds: number | null }>(
    database
      .prepare(
        `
        SELECT AVG((julianday(completed_at) - julianday(started_at)) * 86400) AS averageSeconds
        FROM generation_tasks
        WHERE created_at >= ? AND started_at IS NOT NULL AND completed_at IS NOT NULL
      `,
      )
      .get(weekStart),
  );
  const timeoutRow = castRow<{ count: number | null }>(
    database
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM generation_tasks
        WHERE created_at >= ?
          AND status = 'failed'
          AND (
            error_message LIKE '%超时%'
            OR error_message LIKE '%504%'
            OR error_message LIKE '%524%'
          )
      `,
      )
      .get(weekStart),
  );
  const popularTemplates = castRows<{ templateId: string; name: string; count: number }>(
    database
      .prepare(
        `
      SELECT gt.template_id AS templateId, COALESCE(t.name, '未命名模板') AS name, COUNT(*) AS count
      FROM generation_tasks gt
      LEFT JOIN templates t ON t.id = gt.template_id
      WHERE gt.template_id IS NOT NULL AND gt.created_at >= ?
      GROUP BY gt.template_id, t.name
      ORDER BY count DESC
      LIMIT 8
    `,
      )
      .all(weekStart),
  );
  const topErrors = castRows<{ message: string; count: number }>(
    database
      .prepare(
        `
      SELECT error_message AS message, COUNT(*) AS count
      FROM generation_tasks
      WHERE status = 'failed' AND error_message IS NOT NULL AND created_at >= ?
      GROUP BY error_message
      ORDER BY count DESC
      LIMIT 8
    `,
      )
      .all(weekStart),
  ).map((row) => ({
    message: row.message.length > 160 ? `${row.message.slice(0, 160)}...` : row.message,
    count: row.count,
  }));
  const userSuccessRanking = castRows<{
    userId: string | null;
    name: string | null;
    totalTasks: number;
    succeededTasks: number | null;
  }>(
    database
      .prepare(
        `
      SELECT
        gt.user_id AS userId,
        COALESCE(u.name, '未登录用户') AS name,
        COUNT(*) AS totalTasks,
        SUM(CASE WHEN gt.status = 'succeeded' THEN 1 ELSE 0 END) AS succeededTasks
      FROM generation_tasks gt
      LEFT JOIN users u ON u.id = gt.user_id
      WHERE gt.created_at >= ?
      GROUP BY gt.user_id, u.name
      ORDER BY totalTasks DESC
      LIMIT 8
    `,
      )
      .all(weekStart),
  ).map((row) => ({
    userId: row.userId,
    name: row.name ?? "未登录用户",
    totalTasks: row.totalTasks,
    succeededTasks: row.succeededTasks ?? 0,
    successRate: row.totalTasks > 0 ? Number((((row.succeededTasks ?? 0) / row.totalTasks) * 100).toFixed(1)) : 0,
  }));
  const groupUsage = castRows<{
    groupId: string | null;
    name: string;
    used: number | null;
    quota: number | null;
  }>(
    database
      .prepare(
        `
      SELECT
        ug.id AS groupId,
        COALESCE(ug.name, '未分组') AS name,
        COALESCE(SUM(CASE WHEN gt.status != 'failed' THEN gt.quantity ELSE 0 END), 0) AS used,
        MAX(COALESCE(u.monthly_quota, ug.monthly_quota)) AS quota
      FROM users u
      LEFT JOIN user_groups ug ON ug.id = u.group_id
      LEFT JOIN generation_tasks gt ON gt.user_id = u.id AND gt.created_at >= ?
      GROUP BY ug.id, ug.name
      ORDER BY used DESC
      LIMIT 8
    `,
      )
      .all(monthStart),
  ).map((row) => ({
    groupId: row.groupId,
    name: row.name,
    used: row.used ?? 0,
    quota: row.quota,
  }));

  return {
    today: {
      totalTasks: today.totalTasks,
      succeededTasks: today.succeededTasks ?? 0,
      failedTasks: today.failedTasks ?? 0,
      totalImages: today.totalImages,
      estimatedCost: Number((today.estimatedCost ?? 0).toFixed(2)),
    },
    week: {
      totalTasks: week.totalTasks,
      succeededTasks: week.succeededTasks ?? 0,
      failedTasks: week.failedTasks ?? 0,
      totalImages: week.totalImages,
      estimatedCost: Number((week.estimatedCost ?? 0).toFixed(2)),
    },
    popularTemplates,
    health: {
      provider: runtimeSettings.imageProvider,
      baseUrl: runtimeSettings.imageProvider === "openai_oauth" ? "OpenAI OAuth / Codex Responses" : runtimeSettings.sub2apiBaseUrl,
      imageModel: runtimeSettings.imageModel,
      imageConcurrency: runtimeSettings.imageConcurrency,
      timeoutStreak: getImageTimeoutStreak(),
      autoDegradedAt: getAppSetting("image_auto_degraded_at"),
      averageDurationSeconds:
        averageDuration?.averageSeconds === null || averageDuration?.averageSeconds === undefined
          ? null
          : Number(averageDuration.averageSeconds.toFixed(1)),
      failureRate,
      availabilityRate: weekTotal > 0 ? Number((100 - failureRate).toFixed(1)) : 100,
      weekTimeoutTasks: timeoutRow?.count ?? 0,
    },
    topErrors,
    userSuccessRanking,
    groupUsage,
  };
}

function publicProgressStage(row: GenerationTaskRow): TaskProgressStage {
  if (row.status === "queued") {
    return "queued";
  }
  if (row.status === "succeeded") {
    return "completed";
  }
  if (row.status === "failed") {
    return row.error_message === taskStoppedMessage || row.progress_stage === "canceled" ? "canceled" : "failed";
  }
  if (row.progress_stage === "requesting" || row.progress_stage === "generating" || row.progress_stage === "saving") {
    return row.progress_stage;
  }
  return "generating";
}

export function toPublicTask(row: GenerationTaskRow, images: GeneratedImageRow[] = []): PublicTask {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    mode: row.mode,
    status: row.status,
    progressStage: publicProgressStage(row),
    prompt: row.prompt,
    fixedPrompt: row.fixed_prompt,
    promptSuffix: row.prompt_suffix,
    negativePrompt: row.negative_prompt,
    size: row.size,
    quantity: row.quantity,
    requestedConcurrency: row.requested_concurrency,
    templateId: row.template_id,
    sourceImageId: row.source_image_id,
    referenceImageId: row.reference_image_id,
    referenceImage: row.reference_image_id ? toPublicReferenceImage(row.reference_image_id) : null,
    referenceImages: (() => {
      try {
        const ids: string[] = row.reference_image_ids ? JSON.parse(row.reference_image_ids) : [];
        return ids.map((id) => toPublicReferenceImage(id)).filter((img): img is PublicSourceImage => img !== null);
      } catch {
        return [];
      }
    })(),
    referenceStrength: row.reference_strength,
    styleStrength: row.style_strength,
    costEstimate: row.cost_estimate,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    images: images.map((image) => toPublicImage({ ...image, template_name: null })),
  };
}

function toPublicReferenceImage(id: string): PublicSourceImage | null {
  const source = getSourceImage(id);
  if (source) {
    return toPublicSourceImage(source);
  }
  const generated = getGeneratedImage(id);
  if (!generated) {
    return null;
  }
  return {
    id: generated.id,
    url: imagePublicUrl(generated.file_path),
    width: generated.width,
    height: generated.height,
    originalName: null,
    mimeType: null,
    createdAt: generated.created_at,
  };
}

export function toPublicConversation(
  row: ConversationRow,
  options: {
    messages?: ConversationMessageRow[];
    tasks?: GenerationTaskRow[];
  } = {},
): PublicConversation {
  const latestTask = getLatestConversationTask(row.id);
  const latestImage = getLatestConversationImage(row.id);
  const imageMap = options.messages ? getConversationImageMap(row.id) : new Map<string, GeneratedImageRow>();

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    fixedPromptEnabled: row.fixed_prompt_enabled === 1,
    fixedPrompt: row.fixed_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestTask: latestTask ? toPublicTask(latestTask, getTaskImages(latestTask.id)) : null,
    latestImage: latestImage ? toPublicImage({ ...latestImage, template_name: null }) : null,
    messages: options.messages?.map((message) => toPublicConversationMessage(message, imageMap)),
    tasks: options.tasks?.map((task) => toPublicTask(task, getTaskImages(task.id))),
  };
}

export function toPublicConversationMessage(
  row: ConversationMessageRow,
  imageMap?: Map<string, GeneratedImageRow>,
): PublicConversationMessage {
  const image = row.image_id ? imageMap?.get(row.image_id) ?? getGeneratedImage(row.image_id) : null;
  const sourceImage = !image && row.image_id ? getSourceImage(row.image_id) : null;
  const shouldAttachTaskImages =
    !image && row.role === "assistant" && row.task_id
      ? getGenerationTask(row.task_id)?.status === "succeeded"
      : false;
  const taskImages =
    shouldAttachTaskImages && row.task_id
      ? getTaskImages(row.task_id).map((item) => toPublicImage({ ...item, template_name: null }))
      : [];
  const images = image ? [toPublicImage({ ...image, template_name: null })] : taskImages;
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    taskId: row.task_id,
    imageId: row.image_id,
    image: images[0] ?? null,
    images,
    sourceImage: sourceImage ? toPublicSourceImage(sourceImage) : null,
    createdAt: row.created_at,
  };
}

export function toPublicSourceImage(row: SourceImageRow): PublicSourceImage {
  return {
    id: row.id,
    url: imagePublicUrl(row.file_path),
    width: row.width,
    height: row.height,
    originalName: row.original_name,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  };
}

export function toPublicImage(row: GeneratedImageRow & { template_name?: string | null }): PublicImage {
  return {
    id: row.id,
    taskId: row.task_id,
    url: imagePublicUrl(row.file_path),
    width: row.width,
    height: row.height,
    prompt: row.prompt,
    mode: row.mode,
    templateId: row.template_id,
    templateName: row.template_name ?? null,
    createdAt: row.created_at,
  };
}

export function toPublicTemplate(row: TemplateRow): PublicTemplate {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    scope: row.owner_user_id ? "user" : "platform",
    name: row.name,
    category: row.category,
    description: row.description,
    defaultPrompt: row.default_prompt,
    defaultNegativePrompt: row.default_negative_prompt,
    defaultSize: normalizeImageSizeOption(row.default_size),
    defaultReferenceStrength: row.default_reference_strength,
    defaultStyleStrength: row.default_style_strength,
    sourceImageId: row.source_image_id,
    templateVariables: parseTemplateVariables(row.template_variables),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function imagePublicUrl(filePath: string): string {
  return `${PUBLIC_FILE_PREFIX}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function toPublicUserGroup(row: UserGroupRow): PublicUserGroup {
  return {
    id: row.id,
    name: row.name,
    monthlyQuota: row.monthly_quota,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicUser(row: UserRow): PublicUser {
  const group = row.group_id ? getUserGroup(row.group_id) : null;
  const usage = getUserQuota(row.id);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    groupId: row.group_id,
    groupName: group?.name ?? null,
    quotaOverride: row.monthly_quota,
    monthlyQuota: usage.monthlyQuota,
    monthUsed: usage.monthUsed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
