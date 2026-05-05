"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { AdminUserListSummary, AdminUserPagination, CurrentUser, PublicUser, PublicUserGroup } from "@/lib/types";
import { apiJson } from "@/components/client-api";
import { AdminShell } from "./AdminShell";

interface GroupsResponse {
  groups: PublicUserGroup[];
}

interface UsersResponse {
  users: PublicUser[];
  pagination: AdminUserPagination;
  summary: AdminUserListSummary;
}

interface UserResponse {
  user: PublicUser;
}

interface MeResponse {
  user: CurrentUser | null;
}

const emptySummary: AdminUserListSummary = { total: 0, active: 0, disabled: 0, admin: 0, member: 0 };
const emptyPagination: AdminUserPagination = { page: 1, pageSize: 50, total: 0, totalPages: 1 };

export function AdminUsersClient() {
  const [groups, setGroups] = useState<PublicUserGroup[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [pagination, setPagination] = useState<AdminUserPagination>(emptyPagination);
  const [summary, setSummary] = useState<AdminUserListSummary>(emptySummary);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [status, setStatus] = useState<"all" | PublicUser["status"]>("all");
  const [role, setRole] = useState<"all" | PublicUser["role"]>("all");
  const [groupId, setGroupId] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [batchGroupId, setBatchGroupId] = useState("");
  const [batchQuota, setBatchQuota] = useState(100);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "member" as PublicUser["role"],
    groupId: "",
    monthlyQuota: 100,
  });

  const selectedUsers = useMemo(() => users.filter((user) => selectedIds.has(user.id)), [selectedIds, users]);
  const allPageSelected = users.length > 0 && users.every((user) => selectedIds.has(user.id));

  async function loadGroups(): Promise<void> {
    const payload = await apiJson<GroupsResponse>("/api/admin/groups");
    setGroups(payload.groups);
    setBatchGroupId((current) => current || payload.groups[0]?.id || "");
    setNewUser((current) => ({ ...current, groupId: current.groupId || payload.groups[0]?.id || "" }));
  }

  async function loadCurrentUser(): Promise<void> {
    const payload = await apiJson<MeResponse>("/api/auth/me");
    setCurrentUser(payload.user);
  }

  async function loadUsers(nextPage = pagination.page): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
        sort,
        direction,
      });
      if (submittedQuery.trim()) params.set("q", submittedQuery.trim());
      if (status !== "all") params.set("status", status);
      if (role !== "all") params.set("role", role);
      if (groupId !== "all") params.set("groupId", groupId);

      const payload = await apiJson<UsersResponse>(`/api/admin/users?${params.toString()}`);
      setUsers(payload.users);
      setPagination(payload.pagination);
      setSummary(payload.summary);
      setSelectedIds(new Set());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "账号加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGroups().catch((caught: Error) => setError(caught.message));
    void loadCurrentUser().catch(() => undefined);
  }, []);

  useEffect(() => {
    void loadUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, role, groupId, sort, direction, pageSize, submittedQuery]);

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSubmittedQuery(query);
  }

  function updateUserLocal(id: string, patch: Partial<PublicUser>): void {
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  }

  async function saveUser(user: PublicUser): Promise<void> {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = await apiJson<UserResponse>(`/api/admin/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: user.name,
          role: user.role,
          status: user.status,
          groupId: user.groupId,
          monthlyQuota: user.quotaOverride ?? user.monthlyQuota ?? 0,
        }),
      });
      updateUserLocal(user.id, payload.user);
      setMessage("账号已保存。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "账号保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function setUserStatus(user: PublicUser, nextStatus: PublicUser["status"]): Promise<void> {
    if (nextStatus === "disabled" && !window.confirm(`确定禁用账号「${user.name}」吗？`)) {
      return;
    }
    await saveUser({ ...user, status: nextStatus });
  }

  async function deleteUserAccount(user: PublicUser): Promise<void> {
    if (!window.confirm(`确定删除账号「${user.name}」吗？历史图片会保留为已删除用户记录。`)) {
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiJson(`/api/admin/users/${user.id}`, { method: "DELETE" });
      setMessage("账号已删除。");
      await loadUsers(pagination.page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "账号删除失败");
    } finally {
      setSaving(false);
    }
  }

  async function createUser(): Promise<void> {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiJson<UserResponse>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(newUser),
      });
      setShowCreate(false);
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "member",
        groupId: groups[0]?.id || "",
        monthlyQuota: 100,
      });
      setMessage("账号已创建。");
      await loadUsers(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "账号创建失败");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(id: string): void {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function togglePageSelection(): void {
    setSelectedIds((current) => {
      if (allPageSelected) {
        return new Set([...current].filter((id) => !users.some((user) => user.id === id)));
      }
      const next = new Set(current);
      users.forEach((user) => next.add(user.id));
      return next;
    });
  }

  async function batchUpdate(patch: Partial<Pick<PublicUser, "status" | "groupId" | "quotaOverride" | "monthlyQuota">>, label: string): Promise<void> {
    if (selectedUsers.length === 0) return;
    if (!window.confirm(`确定对 ${selectedUsers.length} 个账号执行「${label}」吗？`)) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await Promise.all(
        selectedUsers.map((user) =>
          apiJson<UserResponse>(`/api/admin/users/${user.id}`, {
            method: "PUT",
            body: JSON.stringify({
              name: user.name,
              role: user.role,
              status: patch.status ?? user.status,
              groupId: patch.groupId === undefined ? user.groupId : patch.groupId,
              monthlyQuota: patch.monthlyQuota ?? patch.quotaOverride ?? user.quotaOverride ?? user.monthlyQuota ?? 0,
            }),
          }),
        ),
      );
      setMessage(`已完成批量操作：${label}。`);
      await loadUsers(pagination.page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `批量${label}失败`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      active="users"
      title="账号管理"
      description="为几百到几万个用户准备的分页、筛选、批量运营工作台。"
      actions={
        <>
          <button className="button" type="button" onClick={() => loadUsers(pagination.page)} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />
            {loading ? "刷新中" : "刷新"}
          </button>
          <button className="button primary" type="button" onClick={() => setShowCreate(true)}>
            <UserPlus size={16} aria-hidden="true" />
            新增账号
          </button>
        </>
      }
    >
      {error ? <div className="toast-line error">{error}</div> : null}
      {message ? <div className="toast-line">{message}</div> : null}

      <section className="admin-metric-strip" aria-label="账号概览">
        <Metric label="全部账号" value={summary.total} />
        <Metric label="可用账号" value={summary.active} />
        <Metric label="已禁用" value={summary.disabled} />
        <Metric label="管理员" value={summary.admin} />
        <Metric label="普通成员" value={summary.member} />
      </section>

      <section className="panel admin-ops-panel">
        <form className="admin-filter-bar" onSubmit={submitSearch}>
          <div className="admin-search-field">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、邮箱或分组" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">全部状态</option>
            <option value="active">可用账号</option>
            <option value="disabled">已禁用</option>
          </select>
          <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="all">全部角色</option>
            <option value="admin">管理员</option>
            <option value="member">成员</option>
          </select>
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="all">全部分组</option>
            <option value="__none">无分组</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          <select value={`${sort}:${direction}`} onChange={(event) => {
            const [nextSort, nextDirection] = event.target.value.split(":");
            setSort(nextSort);
            setDirection(nextDirection === "asc" ? "asc" : "desc");
          }}>
            <option value="createdAt:desc">注册时间倒序</option>
            <option value="createdAt:asc">注册时间正序</option>
            <option value="updatedAt:desc">最近更新</option>
            <option value="name:asc">名称 A-Z</option>
            <option value="email:asc">邮箱 A-Z</option>
          </select>
          <button className="button primary" type="submit">
            <Search size={16} aria-hidden="true" />
            查询
          </button>
        </form>

        {selectedUsers.length > 0 ? (
          <div className="admin-bulk-bar">
            <span className="badge">{selectedUsers.length} 个账号已选中</span>
            <button className="button" type="button" onClick={() => batchUpdate({ status: "active" }, "启用")} disabled={saving}>
              <UserCheck size={16} aria-hidden="true" />
              批量启用
            </button>
            <button className="button" type="button" onClick={() => batchUpdate({ status: "disabled" }, "禁用")} disabled={saving}>
              <UserX size={16} aria-hidden="true" />
              批量禁用
            </button>
            <select value={batchGroupId} onChange={(event) => setBatchGroupId(event.target.value)}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <button className="button" type="button" onClick={() => batchUpdate({ groupId: batchGroupId }, "移动分组")} disabled={saving || !batchGroupId}>
              移动分组
            </button>
            <input type="number" min={0} value={batchQuota} onChange={(event) => setBatchQuota(Number(event.target.value))} />
            <button className="button" type="button" onClick={() => batchUpdate({ monthlyQuota: batchQuota, quotaOverride: batchQuota }, "设置额度")} disabled={saving}>
              设置额度
            </button>
          </div>
        ) : null}

        <div className="admin-table-wrap">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} aria-label="选择当前页账号" />
                </th>
                <th>用户</th>
                <th>角色 / 状态</th>
                <th>分组</th>
                <th>额度</th>
                <th>注册时间</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = currentUser?.id === user.id;
                return (
                  <tr key={user.id} className={clsx(user.status === "disabled" && "is-muted")}>
                    <td>
                      <input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleSelected(user.id)} aria-label={`选择 ${user.name}`} />
                    </td>
                    <td>
                      <div className="admin-user-cell">
                        <span className="admin-user-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
                        <div>
                          <input className="table-input strong" value={user.name} onChange={(event) => updateUserLocal(user.id, { name: event.target.value })} />
                          <small>{user.email}</small>
                          {isSelf ? <span className="badge success">当前账号</span> : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="table-stack">
                        <select className="table-select" value={user.role} disabled={isSelf} onChange={(event) => updateUserLocal(user.id, { role: event.target.value as PublicUser["role"] })}>
                          <option value="member">成员</option>
                          <option value="admin">管理员</option>
                        </select>
                        <span className={clsx("badge", user.status === "active" ? "success" : "danger")}>
                          {user.status === "active" ? <CheckCircle2 size={13} aria-hidden="true" /> : <Ban size={13} aria-hidden="true" />}
                          {user.status === "active" ? "可用" : "已禁用"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <select className="table-select" value={user.groupId ?? ""} onChange={(event) => updateUserLocal(user.id, { groupId: event.target.value || null })}>
                        <option value="">无分组</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="quota-cell">
                        <strong>{user.monthUsed}/{user.monthlyQuota ?? "不限"}</strong>
                        <input
                          className="table-input"
                          type="number"
                          min={0}
                          value={user.monthlyQuota ?? 0}
                          onChange={(event) =>
                            updateUserLocal(user.id, {
                              quotaOverride: Number(event.target.value),
                              monthlyQuota: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString("zh-CN")}</td>
                    <td>{new Date(user.updatedAt).toLocaleDateString("zh-CN")}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-button" type="button" onClick={() => saveUser(user)} disabled={saving} title="保存">
                          <Save size={16} aria-hidden="true" />
                        </button>
                        <button className="icon-button" type="button" onClick={() => setUserStatus(user, user.status === "active" ? "disabled" : "active")} disabled={saving || isSelf} title={user.status === "active" ? "禁用" : "启用"}>
                          {user.status === "active" ? <UserX size={16} aria-hidden="true" /> : <UserCheck size={16} aria-hidden="true" />}
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => deleteUserAccount(user)} disabled={saving || isSelf} title="删除">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 ? <div className="empty-state">没有匹配账号</div> : null}
        </div>

        <div className="admin-pagination">
          <span>共 {pagination.total} 个账号，第 {pagination.page} / {pagination.totalPages} 页</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={20}>20 / 页</option>
            <option value={50}>50 / 页</option>
            <option value={100}>100 / 页</option>
          </select>
          <button className="button" type="button" onClick={() => loadUsers(pagination.page - 1)} disabled={loading || pagination.page <= 1}>
            <ChevronLeft size={16} aria-hidden="true" />
            上一页
          </button>
          <button className="button" type="button" onClick={() => loadUsers(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages}>
            下一页
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {showCreate ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="createUserTitle">
            <div className="panel-header">
              <div>
                <h2 id="createUserTitle">新增账号</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setShowCreate(false)} aria-label="关闭">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="panel-body admin-modal-grid">
              <label>
                名称
                <input value={newUser.name} onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))} placeholder="成员名称" />
              </label>
              <label>
                邮箱
                <input type="email" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" />
              </label>
              <label>
                初始密码
                <input type="password" value={newUser.password} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} placeholder="至少 8 位" autoComplete="new-password" />
              </label>
              <label>
                角色
                <select value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value as PublicUser["role"] }))}>
                  <option value="member">成员</option>
                  <option value="admin">管理员</option>
                </select>
              </label>
              <label>
                分组
                <select value={newUser.groupId} onChange={(event) => setNewUser((current) => ({ ...current, groupId: event.target.value }))}>
                  <option value="">无分组</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </label>
              <label>
                额度
                <input type="number" min={0} value={newUser.monthlyQuota} onChange={(event) => setNewUser((current) => ({ ...current, monthlyQuota: Number(event.target.value) }))} />
              </label>
              <button className="button primary admin-modal-submit" type="button" onClick={createUser} disabled={saving || !newUser.name.trim() || !newUser.email.trim() || newUser.password.length < 8}>
                <UserPlus size={16} aria-hidden="true" />
                创建账号
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
