import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { appConfig, PUBLIC_FILE_PREFIX } from "./config";
import { normalizeImageSizeOption } from "./image-options";
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
  PublicOpenAIOAuthAccount,
  PublicTemplate,
  PublicUser,
  PublicUserGroup,
  SessionRow,
  SourceImageRow,
  TaskStatus,
  TemplateCategory,
  TemplateRow,
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
  templateId: string | null;
  sourceImageId: string | null;
  referenceStrength: number;
  styleStrength: number;
}

export interface CreateTemplateInput {
  name: string;
  category: TemplateCategory;
  description: string | null;
  defaultPrompt: string;
  defaultNegativePrompt: string | null;
  defaultSize: string;
  defaultReferenceStrength: number;
  defaultStyleStrength: number;
  sourceImageId: string | null;
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
  | "image_model"
  | "image_concurrency"
  | "site_title"
  | "site_subtitle"
  | "registration_enabled"
  | "registration_default_group_id"
  | "registration_default_quota";

const builtInTemplates: Array<CreateTemplateInput & { id: string }> = [
  {
    id: "tpl_use_product_scene",
    name: "商品场景图",
    category: "use_case",
    description: "适合电商商品主图、详情页素材和场景氛围图。",
    defaultPrompt:
      "一张简约高级的商品场景图，主体清晰，白色背景，柔和自然光，真实摄影质感，留白充足",
    defaultNegativePrompt: "低清晰度，模糊，变形，多余文字，杂乱背景",
    defaultSize: "ecommerce_main_1_1",
    defaultReferenceStrength: 0.65,
    defaultStyleStrength: 0.7,
    sourceImageId: null,
  },
  {
    id: "tpl_use_campaign_poster",
    name: "活动海报",
    category: "use_case",
    description: "适合活动、促销、品牌传播的简洁海报底图。",
    defaultPrompt:
      "一张现代极简活动海报，清爽构图，视觉中心明确，高级商业质感，适合叠加中文标题",
    defaultNegativePrompt: "廉价促销风，文字乱码，低质感，过度装饰",
    defaultSize: "poster_2_3",
    defaultReferenceStrength: 0.55,
    defaultStyleStrength: 0.75,
    sourceImageId: null,
  },
  {
    id: "tpl_use_avatar",
    name: "品牌头像",
    category: "use_case",
    description: "适合品牌账号、人物头像和社媒形象。",
    defaultPrompt:
      "一个干净现代的品牌头像，中心构图，柔和光影，细节清晰，社交媒体头像风格",
    defaultNegativePrompt: "夸张表情，低清晰度，比例错误，复杂背景",
    defaultSize: "ecommerce_main_1_1",
    defaultReferenceStrength: 0.6,
    defaultStyleStrength: 0.7,
    sourceImageId: null,
  },
  {
    id: "tpl_platform_xhs_cover",
    name: "小红书封面",
    category: "platform",
    description: "适合小红书笔记首图和种草封面。",
    defaultPrompt:
      "一张小红书封面图，明亮干净，主体突出，生活方式质感，构图适合叠加醒目标题",
    defaultNegativePrompt: "字体乱码，拥挤，低质感，过暗，过度锐化",
    defaultSize: "xhs_cover_3_4",
    defaultReferenceStrength: 0.6,
    defaultStyleStrength: 0.72,
    sourceImageId: null,
  },
  {
    id: "tpl_platform_wechat_header",
    name: "公众号头图",
    category: "platform",
    description: "适合公众号文章头图和品牌内容封面。",
    defaultPrompt:
      "一张公众号文章头图，横版构图，克制科技感，留白充分，适合叠加文章标题",
    defaultNegativePrompt: "密集文字，画面拥挤，低清晰度，强烈眩光",
    defaultSize: "wechat_cover_235_1",
    defaultReferenceStrength: 0.55,
    defaultStyleStrength: 0.68,
    sourceImageId: null,
  },
  {
    id: "tpl_platform_douyin_cover",
    name: "抖音封面",
    category: "platform",
    description: "适合短视频封面和竖版广告素材。",
    defaultPrompt:
      "一张竖版短视频封面，主体强烈，背景干净，冲击力强但不杂乱，适合叠加标题",
    defaultNegativePrompt: "杂乱背景，低清晰度，变形，文字乱码",
    defaultSize: "douyin_cover_9_16",
    defaultReferenceStrength: 0.58,
    defaultStyleStrength: 0.76,
    sourceImageId: null,
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
      prompt TEXT NOT NULL,
      negative_prompt TEXT,
      size TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity IN (1, 2, 4)),
      template_id TEXT,
      source_image_id TEXT,
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
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('use_case', 'platform', 'company')),
      description TEXT,
      default_prompt TEXT NOT NULL,
      default_negative_prompt TEXT,
      default_size TEXT NOT NULL,
      default_reference_strength REAL NOT NULL DEFAULT 0.6,
      default_style_strength REAL NOT NULL DEFAULT 0.7,
      source_image_id TEXT,
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
  ensureColumn(database, "source_images", "user_id", "TEXT");
  ensureColumn(database, "conversations", "user_id", "TEXT");
  ensureColumn(database, "users", "monthly_quota", "INTEGER");
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_generation_tasks_user
      ON generation_tasks (user_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_generation_tasks_conversation
      ON generation_tasks (conversation_id, created_at);
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
  imageModel: string;
  imageConcurrency: number;
} {
  const concurrency = Number(getAppSetting("image_concurrency") ?? 2);
  const provider = getAppSetting("image_provider");
  return {
    imageProvider: provider === "openai_oauth" ? "openai_oauth" : "sub2api",
    sub2apiApiKey: getAppSetting("sub2api_api_key") || appConfig.sub2apiApiKey,
    sub2apiBaseUrl: getAppSetting("sub2api_base_url") || appConfig.sub2apiBaseUrl,
    imageModel: getAppSetting("image_model") || appConfig.imageModel,
    imageConcurrency: Number.isFinite(concurrency) ? Math.min(Math.max(Math.floor(concurrency), 1), 8) : 2,
  };
}

export function getImageConcurrencySetting(): number {
  return getRuntimeImageSettings().imageConcurrency;
}

export function getPublicSiteSettings(): {
  siteTitle: string;
  siteSubtitle: string;
  registrationEnabled: boolean;
} {
  const registration = getRegistrationSettings();
  return {
    siteTitle: getAppSetting("site_title") || "画境工坊",
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
  const site = getPublicSiteSettings();
  const registration = getRegistrationSettings();
  return {
    imageProvider: settings.imageProvider,
    sub2apiApiKeyConfigured: settings.sub2apiApiKey.length > 0,
    sub2apiBaseUrl: settings.sub2apiBaseUrl,
    imageModel: settings.imageModel,
    imageConcurrency: settings.imageConcurrency,
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
      id, name, category, description, default_prompt, default_negative_prompt,
      default_size, default_reference_strength, default_style_strength,
      source_image_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const template of builtInTemplates) {
    statement.run(
      template.id,
      template.name,
      template.category,
      template.description,
      template.defaultPrompt,
      template.defaultNegativePrompt,
      template.defaultSize,
      template.defaultReferenceStrength,
      template.defaultStyleStrength,
      template.sourceImageId,
      createdAt,
      createdAt,
    );
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
    .prepare("INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
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
  const existingConversation = input.conversationId ? getConversation(input.conversationId) : null;
  const conversation = existingConversation ?? createConversation(titleFromPrompt(input.prompt), input.userId);
  const conversationId = conversation.id;

  database
    .prepare(
      `
      INSERT INTO generation_tasks (
        id, user_id, conversation_id, mode, status, prompt, negative_prompt, size, quantity, template_id,
        source_image_id, reference_strength, style_strength, cost_estimate,
        error_message, created_at, started_at, completed_at
      ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL)
    `,
    )
    .run(
      id,
      input.userId,
      conversationId,
      input.mode,
      input.prompt,
      input.negativePrompt,
      input.size,
      input.quantity,
      input.templateId,
      input.sourceImageId,
      input.referenceStrength,
      input.styleStrength,
      costEstimate,
      createdAt,
    );

  createConversationMessage({
    conversationId,
    role: "user",
    content: input.prompt,
    taskId: id,
    imageId: input.sourceImageId,
  });
  touchConversation(conversationId);

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
  const database = getDb();
  const queued = castRow<{ id: string }>(
    database
    .prepare("SELECT id FROM generation_tasks WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1")
      .get(),
  );

  if (!queued) {
    return null;
  }

  const result = database
    .prepare(
      "UPDATE generation_tasks SET status = 'processing', started_at = ?, error_message = NULL WHERE id = ? AND status = 'queued'",
    )
    .run(nowIso(), queued.id);

  if (result.changes !== 1) {
    return null;
  }

  return getGenerationTask(queued.id);
}

export function markTaskSucceeded(taskId: string, imageCount: number): void {
  const completedAt = nowIso();
  const task = getGenerationTask(taskId);
  if (!task) {
    return;
  }

  getDb()
    .prepare(
      "UPDATE generation_tasks SET status = 'succeeded', completed_at = ?, error_message = NULL WHERE id = ?",
    )
    .run(completedAt, taskId);

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

  getDb()
    .prepare(
      "UPDATE generation_tasks SET status = 'failed', completed_at = ?, error_message = ? WHERE id = ?",
    )
    .run(nowIso(), message.slice(0, 1000), taskId);

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
      SET status = 'failed', completed_at = ?, error_message = ?
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
    where.push("gi.mode = ?");
    params.push(input.mode);
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

export function listTemplates(category?: TemplateCategory): TemplateRow[] {
  if (category) {
    return castRows<TemplateRow>(
      getDb()
        .prepare("SELECT * FROM templates WHERE category = ? ORDER BY created_at ASC LIMIT 200")
        .all(category),
    );
  }

  return castRows<TemplateRow>(
    getDb()
      .prepare(
        "SELECT * FROM templates ORDER BY CASE category WHEN 'use_case' THEN 1 WHEN 'platform' THEN 2 ELSE 3 END, created_at ASC LIMIT 200",
      )
      .all(),
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
        id, name, category, description, default_prompt, default_negative_prompt,
        default_size, default_reference_strength, default_style_strength,
        source_image_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      input.name,
      input.category,
      input.description,
      input.defaultPrompt,
      input.defaultNegativePrompt,
      input.defaultSize,
      input.defaultReferenceStrength,
      input.defaultStyleStrength,
      input.sourceImageId,
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
  };

  getDb()
    .prepare(
      `
      UPDATE templates
      SET name = ?, category = ?, description = ?, default_prompt = ?,
        default_negative_prompt = ?, default_size = ?, default_reference_strength = ?,
        default_style_strength = ?, source_image_id = ?, updated_at = ?
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
      nowIso(),
      id,
    );

  const updated = getTemplate(id);
  if (!updated) {
    throw new Error("模板更新失败");
  }
  return updated;
}

export function getAdminStats(): AdminStats {
  const database = getDb();
  const todayStart = startOfLocalDay();
  const weekStart = startOfLocalWeek();
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
  };
}

export function toPublicTask(row: GenerationTaskRow, images: GeneratedImageRow[] = []): PublicTask {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    mode: row.mode,
    status: row.status,
    prompt: row.prompt,
    negativePrompt: row.negative_prompt,
    size: row.size,
    quantity: row.quantity,
    templateId: row.template_id,
    sourceImageId: row.source_image_id,
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
    name: row.name,
    category: row.category,
    description: row.description,
    defaultPrompt: row.default_prompt,
    defaultNegativePrompt: row.default_negative_prompt,
    defaultSize: normalizeImageSizeOption(row.default_size),
    defaultReferenceStrength: row.default_reference_strength,
    defaultStyleStrength: row.default_style_strength,
    sourceImageId: row.source_image_id,
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
