"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import type { PublicAdminSettings, PublicUserGroup } from "@/lib/types";
import { apiJson } from "@/components/client-api";
import { AdminShell } from "./AdminShell";

interface SettingsResponse {
  settings: PublicAdminSettings;
}

interface GroupsResponse {
  groups: PublicUserGroup[];
}

export function AdminSettingsClient() {
  const [groups, setGroups] = useState<PublicUserGroup[]>([]);
  const [siteTitle, setSiteTitle] = useState("");
  const [siteSubtitle, setSiteSubtitle] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationDefaultGroupId, setRegistrationDefaultGroupId] = useState("");
  const [imageRetentionDays, setImageRetentionDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSettings(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const [settingsPayload, groupsPayload] = await Promise.all([
        apiJson<SettingsResponse>("/api/admin/settings"),
        apiJson<GroupsResponse>("/api/admin/groups"),
      ]);
      const settings = settingsPayload.settings;
      setGroups(groupsPayload.groups);
      setSiteTitle(settings.siteTitle);
      setSiteSubtitle(settings.siteSubtitle);
      setRegistrationEnabled(settings.registrationEnabled);
      setRegistrationDefaultGroupId(settings.registrationDefaultGroupId || groupsPayload.groups[0]?.id || "");
      setImageRetentionDays(settings.imageRetentionDays);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "站点设置加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function saveSettings(): Promise<void> {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiJson<SettingsResponse>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          siteTitle,
          siteSubtitle,
          registrationEnabled,
          registrationDefaultGroupId,
          imageRetentionDays,
        }),
      });
      setMessage("站点设置已保存。");
      await loadSettings();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "站点设置保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      active="settings"
      title="站点设置"
      description="管理站点品牌、开放注册、注册默认分组和图片自动清理周期。"
      actions={
        <>
          <button className="button" type="button" onClick={loadSettings} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />
            刷新
          </button>
          <button className="button primary" type="button" onClick={saveSettings} disabled={saving}>
            <Save size={16} aria-hidden="true" />
            保存设置
          </button>
        </>
      }
    >
      {error ? <div className="toast-line error">{error}</div> : null}
      {message ? <div className="toast-line">{message}</div> : null}

      <section className="panel admin-ops-panel">
        <div className="panel-body form-stack">
          <div className="field-row">
            <div className="field">
              <label>站点标题</label>
              <input className="input" value={siteTitle} onChange={(event) => setSiteTitle(event.target.value)} />
            </div>
            <div className="field">
              <label>站点副标题</label>
              <input className="input" value={siteSubtitle} onChange={(event) => setSiteSubtitle(event.target.value)} />
            </div>
          </div>
          <label className="switch-row admin-setting-switch">
            <input type="checkbox" checked={registrationEnabled} onChange={(event) => setRegistrationEnabled(event.target.checked)} />
            <span>
              <strong>开放注册</strong>
              <small>关闭后只能由管理员在账号管理页创建账号。</small>
            </span>
          </label>
          <div className="admin-settings-policy-row">
            <div className="field admin-settings-policy-field">
              <label>注册默认分组</label>
              <select className="select" value={registrationDefaultGroupId} onChange={(event) => setRegistrationDefaultGroupId(event.target.value)}>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              <span className="field-hint">新注册账号会加入该分组，生成额度跟随分组额度；账号额度保持为空，除非管理员单独覆盖。</span>
            </div>
            <div className="field admin-settings-policy-field">
              <label>图片自动删除天数</label>
              <input className="input" type="number" min={0} max={3650} value={imageRetentionDays} onChange={(event) => setImageRetentionDays(Number(event.target.value))} />
              <span className="field-hint">填写 0 表示不自动删除历史图片。</span>
            </div>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
