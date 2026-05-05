"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, ShieldCheck, Users } from "lucide-react";
import type { PublicUserGroup } from "@/lib/types";
import { apiJson } from "@/components/client-api";
import { AdminShell } from "./AdminShell";

interface GroupsResponse {
  groups: PublicUserGroup[];
}

interface GroupResponse {
  group: PublicUserGroup;
}

export function AdminGroupsClient() {
  const [groups, setGroups] = useState<PublicUserGroup[]>([]);
  const [newName, setNewName] = useState("");
  const [newQuota, setNewQuota] = useState(100);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totals = useMemo(
    () =>
      groups.reduce(
        (acc, group) => ({
          groups: acc.groups + 1,
          members: acc.members + (group.memberCount ?? 0),
          activeMembers: acc.activeMembers + (group.activeMemberCount ?? 0),
          used: acc.used + (group.monthUsed ?? 0),
        }),
        { groups: 0, members: 0, activeMembers: 0, used: 0 },
      ),
    [groups],
  );

  async function loadGroups(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const payload = await apiJson<GroupsResponse>("/api/admin/groups");
      setGroups(payload.groups);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分组加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGroups();
  }, []);

  function updateGroupLocal(id: string, patch: Partial<PublicUserGroup>): void {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...patch } : group)));
  }

  async function saveGroup(group: PublicUserGroup): Promise<void> {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = await apiJson<GroupResponse>(`/api/admin/groups/${group.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: group.name,
          monthlyQuota: group.monthlyQuota,
        }),
      });
      updateGroupLocal(group.id, payload.group);
      setMessage("分组策略已保存。");
      await loadGroups();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分组保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function createGroup(): Promise<void> {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiJson<GroupResponse>("/api/admin/groups", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          monthlyQuota: newQuota,
        }),
      });
      setNewName("");
      setNewQuota(100);
      setMessage("分组已创建。");
      await loadGroups();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分组创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      active="groups"
      title="分组与额度"
      description="把分组当作运营策略管理：成员数、可用成员、本月消耗和默认额度一眼可见。"
      actions={
        <button className="button" type="button" onClick={loadGroups} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "刷新中" : "刷新"}
        </button>
      }
    >
      {error ? <div className="toast-line error">{error}</div> : null}
      {message ? <div className="toast-line">{message}</div> : null}

      <section className="admin-metric-strip" aria-label="分组概览">
        <Metric label="分组数" value={totals.groups} />
        <Metric label="成员数" value={totals.members} />
        <Metric label="可用成员" value={totals.activeMembers} />
        <Metric label="本月消耗" value={totals.used} />
      </section>

      <section className="panel admin-ops-panel">
        <div className="admin-table-wrap">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>分组</th>
                <th>成员</th>
                <th>本月消耗</th>
                <th>每月额度</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td>
                    <input className="table-input strong" value={group.name} onChange={(event) => updateGroupLocal(group.id, { name: event.target.value })} />
                  </td>
                  <td>
                    <div className="table-stack">
                      <strong>{group.activeMemberCount ?? 0}/{group.memberCount ?? 0}</strong>
                      <small>可用 / 全部</small>
                    </div>
                  </td>
                  <td>
                    <strong>{group.monthUsed ?? 0}</strong>
                  </td>
                  <td>
                    <input className="table-input" type="number" min={0} value={group.monthlyQuota} onChange={(event) => updateGroupLocal(group.id, { monthlyQuota: Number(event.target.value) })} />
                  </td>
                  <td>{new Date(group.createdAt).toLocaleDateString("zh-CN")}</td>
                  <td>
                    <button className="button" type="button" onClick={() => saveGroup(group)} disabled={saving}>
                      <Save size={16} aria-hidden="true" />
                      保存策略
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="admin-create-row">
                <td>
                  <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="新分组名称" />
                </td>
                <td colSpan={2}>
                  <span className="badge">
                    <Users size={13} aria-hidden="true" />
                    新分组
                  </span>
                </td>
                <td>
                  <input type="number" min={0} value={newQuota} onChange={(event) => setNewQuota(Number(event.target.value))} />
                </td>
                <td />
                <td>
                  <button className="button primary" type="button" onClick={createGroup} disabled={saving || !newName.trim()}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    创建分组
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
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
