"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  DollarSign,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import clsx from "clsx";
import type { AdminStats, ImageProvider, PublicAdminSettings, PublicOpenAIOAuthAccount, PublicUser, PublicUserGroup } from "@/lib/types";
import { apiJson } from "@/components/client-api";

interface StatsResponse {
  stats: AdminStats;
}

interface SettingsResponse {
  settings: PublicAdminSettings;
}

interface GroupsResponse {
  groups: PublicUserGroup[];
}

interface GroupResponse {
  group: PublicUserGroup;
}

interface UsersResponse {
  users: PublicUser[];
}

interface OpenAIOAuthAccountsResponse {
  accounts: PublicOpenAIOAuthAccount[];
}

interface OpenAIOAuthStartResponse {
  authUrl: string;
  sessionId: string;
  redirectUri: string;
  expiresAt: string;
  experimental: boolean;
}

interface OpenAIOAuthAccountResponse {
  account: PublicOpenAIOAuthAccount;
}

interface UserResponse {
  user: PublicUser;
}

export function AdminClient() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [settings, setSettings] = useState<PublicAdminSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [imageProvider, setImageProvider] = useState<ImageProvider>("sub2api");
  const [baseUrl, setBaseUrl] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [imageConcurrency, setImageConcurrency] = useState(2);
  const [siteTitle, setSiteTitle] = useState("");
  const [siteSubtitle, setSiteSubtitle] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationDefaultGroupId, setRegistrationDefaultGroupId] = useState("");
  const [registrationDefaultQuota, setRegistrationDefaultQuota] = useState(100);
  const [groups, setGroups] = useState<PublicUserGroup[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [openAIAccounts, setOpenAIAccounts] = useState<PublicOpenAIOAuthAccount[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupQuota, setNewGroupQuota] = useState(100);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<PublicUser["role"]>("member");
  const [newUserGroupId, setNewUserGroupId] = useState("");
  const [newUserQuota, setNewUserQuota] = useState(100);
  const [error, setError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [openAIMessage, setOpenAIMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [accountsSaving, setAccountsSaving] = useState(false);
  const [openAISaving, setOpenAISaving] = useState(false);

  async function loadStats(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const payload = await apiJson<StatsResponse>("/api/admin/stats");
      setStats(payload.stats);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "统计加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings(): Promise<void> {
    const payload = await apiJson<SettingsResponse>("/api/admin/settings");
    setSettings(payload.settings);
    setImageProvider(payload.settings.imageProvider);
    setBaseUrl(payload.settings.sub2apiBaseUrl);
    setImageModel(payload.settings.imageModel);
    setImageConcurrency(payload.settings.imageConcurrency);
    setSiteTitle(payload.settings.siteTitle);
    setSiteSubtitle(payload.settings.siteSubtitle);
    setRegistrationEnabled(payload.settings.registrationEnabled);
    setRegistrationDefaultGroupId(payload.settings.registrationDefaultGroupId);
    setRegistrationDefaultQuota(payload.settings.registrationDefaultQuota);
    setNewUserGroupId((current) => current || payload.settings.registrationDefaultGroupId);
    setNewUserQuota(payload.settings.registrationDefaultQuota);
  }

  async function loadAccounts(): Promise<void> {
    const [groupsPayload, usersPayload, openAIPayload] = await Promise.all([
      apiJson<GroupsResponse>("/api/admin/groups"),
      apiJson<UsersResponse>("/api/admin/users"),
      apiJson<OpenAIOAuthAccountsResponse>("/api/admin/openai-accounts"),
    ]);
    setGroups(groupsPayload.groups);
    setUsers(usersPayload.users);
    setOpenAIAccounts(openAIPayload.accounts);
  }

  async function connectOpenAIAccount(): Promise<void> {
    setOpenAISaving(true);
    setOpenAIMessage("");
    setError("");
    try {
      const payload = await apiJson<OpenAIOAuthStartResponse>("/api/admin/openai-accounts", {
        method: "POST",
        body: JSON.stringify({}),
      });
      window.open(payload.authUrl, "_blank", "noopener,noreferrer");
      setOpenAIMessage("已打开 OpenAI 授权页。授权完成后回到这里刷新账号列表。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "OpenAI 授权发起失败");
    } finally {
      setOpenAISaving(false);
    }
  }

  async function setOpenAIAccountStatus(account: PublicOpenAIOAuthAccount, status: "active" | "disabled"): Promise<void> {
    setOpenAISaving(true);
    setOpenAIMessage("");
    setError("");
    try {
      const payload = await apiJson<OpenAIOAuthAccountResponse>(`/api/admin/openai-accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOpenAIAccounts((current) => current.map((item) => (item.id === payload.account.id ? payload.account : item)));
      setOpenAIMessage(status === "active" ? "OpenAI 账号已启用。" : "OpenAI 账号已禁用。更新 provider 后 Worker 会停止使用它。 ");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "OpenAI 账号状态更新失败");
    } finally {
      setOpenAISaving(false);
    }
  }

  async function saveSettings(): Promise<void> {
    setSettingsSaving(true);
    setSettingsMessage("");
    setError("");

    try {
      const body: {
        imageProvider?: ImageProvider;
        sub2apiApiKey?: string;
        sub2apiBaseUrl?: string;
        imageModel?: string;
        imageConcurrency?: number;
        siteTitle?: string;
        siteSubtitle?: string;
        registrationEnabled?: boolean;
        registrationDefaultGroupId?: string;
        registrationDefaultQuota?: number;
      } = {
        imageProvider,
        sub2apiBaseUrl: baseUrl,
        imageModel,
        imageConcurrency,
        siteTitle,
        siteSubtitle,
        registrationEnabled,
        registrationDefaultGroupId,
        registrationDefaultQuota,
      };

      if (apiKey.trim()) {
        body.sub2apiApiKey = apiKey.trim();
      }

      const payload = await apiJson<SettingsResponse>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setSettings(payload.settings);
      setImageProvider(payload.settings.imageProvider);
      setImageConcurrency(payload.settings.imageConcurrency);
      setSiteTitle(payload.settings.siteTitle);
      setSiteSubtitle(payload.settings.siteSubtitle);
      setRegistrationEnabled(payload.settings.registrationEnabled);
      setRegistrationDefaultGroupId(payload.settings.registrationDefaultGroupId);
      setRegistrationDefaultQuota(payload.settings.registrationDefaultQuota);
      setApiKey("");
      setSettingsMessage("配置已保存，后续生成任务会使用新的服务端配置。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "配置保存失败");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function createGroup(): Promise<void> {
    setAccountsSaving(true);
    setAccountMessage("");
    setError("");
    try {
      const payload = await apiJson<GroupResponse>("/api/admin/groups", {
        method: "POST",
        body: JSON.stringify({
          name: newGroupName,
          monthlyQuota: newGroupQuota,
        }),
      });
      setGroups((current) => [...current, payload.group]);
      setNewGroupName("");
      setNewGroupQuota(100);
      setAccountMessage("分组已创建。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分组创建失败");
    } finally {
      setAccountsSaving(false);
    }
  }

  async function saveGroup(group: PublicUserGroup): Promise<void> {
    setAccountsSaving(true);
    setAccountMessage("");
    setError("");
    try {
      const payload = await apiJson<GroupResponse>(`/api/admin/groups/${group.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: group.name,
          monthlyQuota: group.monthlyQuota,
        }),
      });
      setGroups((current) => current.map((item) => (item.id === payload.group.id ? payload.group : item)));
      setAccountMessage("分组已保存。");
      await loadAccounts();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分组保存失败");
    } finally {
      setAccountsSaving(false);
    }
  }

  async function saveUser(user: PublicUser): Promise<void> {
    setAccountsSaving(true);
    setAccountMessage("");
    setError("");
    try {
      const payload = await apiJson<UserResponse>(`/api/admin/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: user.name,
          role: user.role,
          groupId: user.groupId,
          monthlyQuota: user.quotaOverride ?? user.monthlyQuota ?? 0,
        }),
      });
      setUsers((current) => current.map((item) => (item.id === payload.user.id ? payload.user : item)));
      setAccountMessage("账号已保存。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "账号保存失败");
    } finally {
      setAccountsSaving(false);
    }
  }

  async function createUser(): Promise<void> {
    setAccountsSaving(true);
    setAccountMessage("");
    setError("");
    try {
      const payload = await apiJson<UserResponse>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName,
          password: newUserPassword,
          role: newUserRole,
          groupId: newUserGroupId || null,
          monthlyQuota: newUserQuota,
        }),
      });
      setUsers((current) => [...current, payload.user]);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setNewUserRole("member");
      setNewUserQuota(registrationDefaultQuota);
      setAccountMessage("账号已创建。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "账号创建失败");
    } finally {
      setAccountsSaving(false);
    }
  }

  useEffect(() => {
    loadStats().catch((caught: Error) => setError(caught.message));
    loadSettings().catch((caught: Error) => setError(caught.message));
    loadAccounts().catch((caught: Error) => setError(caught.message));
    const timer = window.setInterval(() => {
      loadStats().catch((caught: Error) => setError(caught.message));
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>管理员后台</h1>
          <p>配置站点、模型服务、账号分组和生成额度，同时查看生成使用情况。</p>
        </div>
        <button className="button" type="button" onClick={loadStats} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "刷新中" : "刷新"}
        </button>
      </section>

      <div className={clsx("toast-line", error && "error")}>{error}</div>

      {stats ? (
        <>
          <section className="stats-grid">
            <StatCard label="今日生成次数" value={stats.today.totalTasks} icon={<BarChart3 size={18} />} />
            <StatCard label="本周生成次数" value={stats.week.totalTasks} icon={<TrendingUp size={18} />} />
            <StatCard label="成功 / 失败" value={`${stats.week.succeededTasks} / ${stats.week.failedTasks}`} icon={<BarChart3 size={18} />} />
            <StatCard label="本周预估成本" value={`$${stats.week.estimatedCost.toFixed(2)}`} icon={<DollarSign size={18} />} />
          </section>

          <section className="panel" style={{ marginTop: "1rem" }}>
            <div className="panel-header">
              <div>
                <h2>账号与分组</h2>
                <p>按分组设置每月生成图片次数，管理员可调整账号角色和所属分组。</p>
              </div>
              <span className="badge">
                <Users size={13} aria-hidden="true" />
                {users.length} 个账号
              </span>
            </div>
            <div className="panel-body form-stack">
              <div className="admin-subsection">
                <div className="section-title-row">
                  <strong>分组限额</strong>
                  <span className="badge">按月统计</span>
                </div>
                <div className="admin-grid admin-grid-groups">
                  <div className="admin-grid-head">分组</div>
                  <div className="admin-grid-head">每月次数</div>
                  <div className="admin-grid-head">操作</div>
                  {groups.map((group) => (
                    <div className="admin-grid-row" key={group.id}>
                      <input
                        className="input"
                        value={group.name}
                        onChange={(event) =>
                          setGroups((current) =>
                            current.map((item) =>
                              item.id === group.id ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={group.monthlyQuota}
                        onChange={(event) =>
                          setGroups((current) =>
                            current.map((item) =>
                              item.id === group.id
                                ? { ...item, monthlyQuota: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                      />
                      <button
                        className="button"
                        type="button"
                        onClick={() => saveGroup(group)}
                        disabled={accountsSaving}
                      >
                        <Save size={16} aria-hidden="true" />
                        保存
                      </button>
                    </div>
                  ))}
                  <div className="admin-grid-row new-row">
                    <input
                      className="input"
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                      placeholder="新分组名称"
                    />
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={newGroupQuota}
                      onChange={(event) => setNewGroupQuota(Number(event.target.value))}
                    />
                    <button
                      className="button primary"
                      type="button"
                      onClick={createGroup}
                      disabled={accountsSaving || !newGroupName.trim()}
                    >
                      <ShieldCheck size={16} aria-hidden="true" />
                      新建
                    </button>
                  </div>
                </div>
              </div>

              <div className="admin-subsection">
                <div className="section-title-row">
                  <strong>账号管理</strong>
                  <span className="badge">已用 / 限额</span>
                </div>
                <details className="admin-create-user-details">
                  <summary>
                    <UserPlus size={16} aria-hidden="true" />
                    新增账号
                  </summary>
                  <div className="admin-create-user">
                    <div className="field">
                      <label htmlFor="newUserName">名称</label>
                      <input
                        id="newUserName"
                        className="input"
                        value={newUserName}
                        onChange={(event) => setNewUserName(event.target.value)}
                        placeholder="成员名称"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="newUserEmail">邮箱</label>
                      <input
                        id="newUserEmail"
                        className="input"
                        type="email"
                        value={newUserEmail}
                        onChange={(event) => setNewUserEmail(event.target.value)}
                        placeholder="name@example.com"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="newUserPassword">初始密码</label>
                      <input
                        id="newUserPassword"
                        className="input"
                        type="password"
                        value={newUserPassword}
                        onChange={(event) => setNewUserPassword(event.target.value)}
                        placeholder="至少 8 位"
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="newUserRole">角色</label>
                      <select
                        id="newUserRole"
                        className="select"
                        value={newUserRole}
                        onChange={(event) => setNewUserRole(event.target.value as PublicUser["role"])}
                      >
                        <option value="member">成员</option>
                        <option value="admin">管理员</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="newUserGroup">分组</label>
                      <select
                        id="newUserGroup"
                        className="select"
                        value={newUserGroupId}
                        onChange={(event) => setNewUserGroupId(event.target.value)}
                      >
                        <option value="">无分组</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="newUserQuota">额度</label>
                      <input
                        id="newUserQuota"
                        className="input"
                        type="number"
                        min={0}
                        value={newUserQuota}
                        onChange={(event) => setNewUserQuota(Number(event.target.value))}
                      />
                    </div>
                    <button
                      className="button primary"
                      type="button"
                      onClick={createUser}
                      disabled={accountsSaving || !newUserName.trim() || !newUserEmail.trim() || newUserPassword.length < 8}
                    >
                      <UserPlus size={16} aria-hidden="true" />
                      创建
                    </button>
                  </div>
                </details>
                <div className="admin-grid admin-grid-users">
                  <div className="admin-grid-head">账号</div>
                  <div className="admin-grid-head">角色</div>
                  <div className="admin-grid-head">分组</div>
                  <div className="admin-grid-head">账号额度</div>
                  <div className="admin-grid-head">用量</div>
                  <div className="admin-grid-head">操作</div>
                  {users.map((user) => (
                    <div className="admin-grid-row" key={user.id}>
                      <div className="field compact-field">
                        <input
                          className="input"
                          value={user.name}
                          onChange={(event) =>
                            setUsers((current) =>
                              current.map((item) =>
                                item.id === user.id ? { ...item, name: event.target.value } : item,
                              ),
                            )
                          }
                        />
                        <small>{user.email}</small>
                      </div>
                      <select
                        className="select"
                        value={user.role}
                        onChange={(event) =>
                          setUsers((current) =>
                            current.map((item) =>
                              item.id === user.id
                                ? { ...item, role: event.target.value as PublicUser["role"] }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="member">成员</option>
                        <option value="admin">管理员</option>
                      </select>
                      <select
                        className="select"
                        value={user.groupId ?? ""}
                        onChange={(event) =>
                          setUsers((current) =>
                            current.map((item) =>
                              item.id === user.id ? { ...item, groupId: event.target.value || null } : item,
                            ),
                          )
                        }
                      >
                        <option value="">无分组</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={user.monthlyQuota ?? 0}
                        onChange={(event) =>
                          setUsers((current) =>
                            current.map((item) =>
                              item.id === user.id
                                ? {
                                    ...item,
                                    quotaOverride: Number(event.target.value),
                                    monthlyQuota: Number(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <span className="badge">
                        {user.monthUsed}/{user.monthlyQuota ?? "不限"}
                      </span>
                      <button
                        className="button"
                        type="button"
                        onClick={() => saveUser(user)}
                        disabled={accountsSaving}
                      >
                        <Save size={16} aria-hidden="true" />
                        保存
                      </button>
                    </div>
                  ))}
                </div>
                <div className="toast-line">{accountMessage}</div>
              </div>
            </div>
          </section>

          <section className="panel" style={{ marginTop: "1rem" }}>
            <div className="panel-header">
              <div>
                <h2>站点与模型配置</h2>
                <p>站点注册策略和模型服务端参数集中管理，密钥不会在页面或接口响应中回显。</p>
              </div>
              <span className={clsx("badge", settings?.sub2apiApiKeyConfigured ? "success" : "danger")}>
                <KeyRound size={13} aria-hidden="true" />
                {settings?.sub2apiApiKeyConfigured ? "API Key 已配置" : "API Key 未配置"}
              </span>
            </div>
            <div className="panel-body form-stack">
              <div className="field-row">
                <div className="field">
                  <label htmlFor="siteTitle">站点标题</label>
                  <input
                    id="siteTitle"
                    className="input"
                    value={siteTitle}
                    onChange={(event) => setSiteTitle(event.target.value)}
                    placeholder="画境工坊"
                  />
                </div>
                <div className="field">
                  <label htmlFor="siteSubtitle">站点副标题</label>
                  <input
                    id="siteSubtitle"
                    className="input"
                    value={siteSubtitle}
                    onChange={(event) => setSiteSubtitle(event.target.value)}
                    placeholder="image-2 workspace"
                  />
                </div>
              </div>
              <div className="field-row">
                <label className="switch-row" htmlFor="registrationEnabled">
                  <input
                    id="registrationEnabled"
                    type="checkbox"
                    checked={registrationEnabled}
                    onChange={(event) => setRegistrationEnabled(event.target.checked)}
                  />
                  <span>
                    <strong>开放注册</strong>
                    <small>关闭后只能由管理员在后台创建账号</small>
                  </span>
                </label>
                <div className="field">
                  <label htmlFor="registrationDefaultGroup">注册默认分组</label>
                  <select
                    id="registrationDefaultGroup"
                    className="select"
                    value={registrationDefaultGroupId}
                    onChange={(event) => setRegistrationDefaultGroupId(event.target.value)}
                  >
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="registrationDefaultQuota">注册默认额度</label>
                <input
                  id="registrationDefaultQuota"
                  className="input"
                  type="number"
                  min={0}
                  value={registrationDefaultQuota}
                  onChange={(event) => setRegistrationDefaultQuota(Number(event.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="imageProvider">图片接口模式</label>
                <select
                  id="imageProvider"
                  className="select"
                  value={imageProvider}
                  onChange={(event) => setImageProvider(event.target.value as ImageProvider)}
                >
                  <option value="sub2api">sub2api / OpenAI-compatible API Key</option>
                  <option value="openai_oauth">内置 OpenAI OAuth（实验性）</option>
                </select>
                <small>OAuth 模式会优先使用下方已连接且启用的 OpenAI 账号；真实图片接口兼容性仍需在账号环境验证。</small>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="sub2apiBaseUrl">Base URL</label>
                  <input
                    id="sub2apiBaseUrl"
                    className="input"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="https://s2a.laolin.ai/v1"
                  />
                </div>
                <div className="field">
                  <label htmlFor="imageModel">模型</label>
                  <input
                    id="imageModel"
                    className="input"
                    value={imageModel}
                    onChange={(event) => setImageModel(event.target.value)}
                    placeholder="gpt-image-2"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="imageConcurrency">并发请求数</label>
                <input
                  id="imageConcurrency"
                  className="input"
                  type="number"
                  min={1}
                  max={8}
                  value={imageConcurrency}
                  onChange={(event) => setImageConcurrency(Number(event.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="sub2apiApiKey">API Key</label>
                <input
                  id="sub2apiApiKey"
                  className="input"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={settings?.sub2apiApiKeyConfigured ? "留空表示不修改现有密钥" : "填写后保存"}
                  autoComplete="off"
                />
              </div>
              <button className="button primary" type="button" onClick={saveSettings} disabled={settingsSaving}>
                <Save size={16} aria-hidden="true" />
                {settingsSaving ? "保存中" : "保存配置"}
              </button>
              <div className="toast-line">{settingsMessage}</div>
            </div>
          </section>

          <section className="panel" style={{ marginTop: "1rem" }}>
            <div className="panel-header">
              <div>
                <h2>OpenAI 账号连接</h2>
                <p>内置 OAuth 账号连接器第一版。token 仅服务端保存并加密，不会回显到页面。</p>
              </div>
              <span className="badge">实验性</span>
            </div>
            <div className="panel-body form-stack">
              <div className="section-title-row">
                <strong>已连接账号</strong>
                <button className="button" type="button" onClick={loadAccounts} disabled={openAISaving}>
                  <RefreshCw size={16} aria-hidden="true" />
                  刷新账号
                </button>
              </div>
              {openAIAccounts.length > 0 ? (
                <div className="admin-grid admin-grid-groups">
                  <div className="admin-grid-head">账号</div>
                  <div className="admin-grid-head">状态</div>
                  <div className="admin-grid-head">操作</div>
                  {openAIAccounts.map((account) => (
                    <div className="admin-grid-row" key={account.id}>
                      <div className="field compact-field">
                        <strong>{account.email ?? account.accountId ?? "OpenAI 账号"}</strong>
                        <small>
                          {account.planType ?? "未知套餐"} · token 到期 {new Date(account.expiresAt).toLocaleString()}
                        </small>
                        {account.lastError ? <small>错误：{account.lastError}</small> : null}
                      </div>
                      <span className={clsx("badge", account.status === "active" ? "success" : "danger")}>
                        {account.status === "active" ? "可用" : account.status === "disabled" ? "已禁用" : "异常"}
                      </span>
                      <button
                        className="button"
                        type="button"
                        onClick={() => setOpenAIAccountStatus(account, account.status === "active" ? "disabled" : "active")}
                        disabled={openAISaving}
                      >
                        {account.status === "active" ? "禁用" : "启用"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span>还没有连接 OpenAI 账号</span>
                </div>
              )}
              <button className="button primary" type="button" onClick={connectOpenAIAccount} disabled={openAISaving}>
                <KeyRound size={16} aria-hidden="true" />
                {openAISaving ? "处理中" : "连接 OpenAI 账号"}
              </button>
              <small>
                说明：该流程参考 Codex CLI OAuth + PKCE。若部署在服务器上，请设置固定回调地址并确保
                OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY 已配置。
              </small>
              <div className="toast-line">{openAIMessage}</div>
            </div>
          </section>

          <section className="panel" style={{ marginTop: "1rem" }}>
            <div className="panel-header">
              <div>
                <h2>热门模板</h2>
                <p>按本周任务使用次数排序</p>
              </div>
            </div>
            <div className="panel-body popular-list">
              {stats.popularTemplates.length > 0 ? (
                stats.popularTemplates.map((template) => (
                  <div className="popular-row" key={template.templateId}>
                    <strong>{template.name}</strong>
                    <span className="badge">{template.count} 次</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <span>暂无模板使用数据</span>
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="empty-state">
          <span>统计加载中</span>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <article className="stat-card">
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </article>
  );
}
