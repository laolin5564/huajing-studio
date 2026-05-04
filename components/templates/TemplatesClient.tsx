"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Edit3,
  LayoutTemplate,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import clsx from "clsx";
import { imageSizeLabels, sizeOptions } from "@/lib/image-options";
import type { CurrentUser, PublicTemplate, TemplateCategory, TemplateScope } from "@/lib/types";
import { apiJson, categoryLabels, formatDateTime } from "@/components/client-api";

interface TemplateListResponse {
  templates: PublicTemplate[];
}

interface TemplateResponse {
  template: PublicTemplate;
}

interface MeResponse {
  user: CurrentUser | null;
}

const categoryOptions: TemplateCategory[] = ["use_case", "platform", "company"];

const emptyForm = {
  name: "",
  category: "company" as TemplateCategory,
  description: "",
  defaultPrompt: "",
  defaultNegativePrompt: "",
  defaultSize: "auto",
  defaultReferenceStrength: 0.6,
  defaultStyleStrength: 0.7,
  sourceImageId: null as string | null,
};

export function TemplatesClient() {
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeScope, setActiveScope] = useState<TemplateScope>("platform");
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visibleTemplates = useMemo(() => {
    const scoped = templates.filter((template) => template.scope === activeScope);
    return activeCategory === "all"
      ? scoped
      : scoped.filter((template) => template.category === activeCategory);
  }, [activeCategory, activeScope, templates]);

  const canCreateInActiveScope = activeScope === "user" || currentUser?.role === "admin";

  async function loadTemplates(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const payload = await apiJson<TemplateListResponse>("/api/templates");
      setTemplates(payload.templates);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "模板加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      loadTemplates(),
      apiJson<MeResponse>("/api/auth/me").then((payload) => {
        setCurrentUser(payload.user);
        if (payload.user?.role !== "admin") {
          setActiveScope("user");
        }
      }),
    ])
      .catch((caught: Error) => setError(caught.message));
  }, []);

  function startCreate(scope: TemplateScope = activeScope): void {
    setActiveScope(scope);
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  function startEdit(template: PublicTemplate): void {
    setEditingId(template.id);
    setActiveScope(template.scope);
    setForm({
      name: template.name,
      category: template.category,
      description: template.description ?? "",
      defaultPrompt: template.defaultPrompt,
      defaultNegativePrompt: template.defaultNegativePrompt ?? "",
      defaultSize: template.defaultSize,
      defaultReferenceStrength: template.defaultReferenceStrength,
      defaultStyleStrength: template.defaultStyleStrength,
      sourceImageId: template.sourceImageId,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const body = JSON.stringify({
        ...form,
        scope: editingId ? undefined : activeScope,
        description: form.description || null,
        defaultNegativePrompt: form.defaultNegativePrompt || null,
      });
      const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
      const method = editingId ? "PUT" : "POST";
      const payload = await apiJson<TemplateResponse>(url, { method, body });
      setMessage(editingId ? "模板已更新。" : "模板已创建。");
      await loadTemplates();
      setEditingId(payload.template.id);
      setActiveScope(payload.template.scope);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "模板保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrentTemplate(template: PublicTemplate): Promise<void> {
    const ok = window.confirm(`确定删除模板「${template.name}」吗？`);
    if (!ok) {
      return;
    }
    setError("");
    setMessage("");
    try {
      await apiJson(`/api/templates/${template.id}`, { method: "DELETE" });
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      if (editingId === template.id) {
        startCreate(template.scope);
      }
      setMessage("模板已删除。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "模板删除失败");
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>模板管理</h1>
          <p>平台模板由管理员维护，用户模板由账号自己保存和管理，工作台会同时读取可用模板。</p>
        </div>
        <button className="button" type="button" onClick={() => startCreate(activeScope)} disabled={!canCreateInActiveScope}>
          <Plus size={16} aria-hidden="true" />
          {activeScope === "platform" ? "新建平台模板" : "新建用户模板"}
        </button>
      </section>

      <section className="template-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>模板库</h2>
              <p>{activeScope === "platform" ? "管理员维护的公共模板" : "当前账号保存的个人模板"}</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="template-toolbar">
              <button
                className={clsx("button", activeScope === "platform" && "subtle")}
                type="button"
                onClick={() => {
                  setActiveScope("platform");
                  setEditingId(null);
                }}
              >
                <ShieldCheck size={15} aria-hidden="true" />
                平台模板
              </button>
              <button
                className={clsx("button", activeScope === "user" && "subtle")}
                type="button"
                onClick={() => {
                  setActiveScope("user");
                  setEditingId(null);
                }}
              >
                <UserRound size={15} aria-hidden="true" />
                用户模板
              </button>
            </div>
            <div className="template-toolbar">
              <button
                className={clsx("button", activeCategory === "all" && "subtle")}
                type="button"
                onClick={() => setActiveCategory("all")}
              >
                全部
              </button>
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  className={clsx("button", activeCategory === category && "subtle")}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                >
                  {categoryLabels[category]}
                </button>
              ))}
            </div>

            <div className="template-list">
              {loading ? (
                <div className="empty-state" aria-busy="true">
                  <div>
                    <strong>正在加载模板</strong>
                    <span>请稍候，正在读取模板库。</span>
                  </div>
                </div>
              ) : visibleTemplates.length > 0 ? visibleTemplates.map((template) => (
                <article className="template-item" key={template.id}>
                  <div className="queue-item-top">
                    <span className="badge">
                      <LayoutTemplate size={13} aria-hidden="true" />
                      {categoryLabels[template.category]}
                    </span>
                    <div className="template-item-actions">
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => startEdit(template)}
                        title="编辑模板"
                        disabled={template.scope === "platform" && currentUser?.role !== "admin"}
                      >
                        <Edit3 size={15} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        onClick={() => deleteCurrentTemplate(template)}
                        title="删除模板"
                        disabled={template.scope === "platform" && currentUser?.role !== "admin"}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <h3>{template.name}</h3>
                  <p>{template.description || "暂无说明"}</p>
                  <p>{template.defaultPrompt}</p>
                  <div className="card-actions">
                    <span className="badge">
                      {imageSizeLabels[template.defaultSize as keyof typeof imageSizeLabels] ?? template.defaultSize}
                    </span>
                    <span className="badge">参考 {template.defaultReferenceStrength.toFixed(2)}</span>
                    <span className="badge">风格 {template.defaultStyleStrength.toFixed(2)}</span>
                    <span className="badge">{template.scope === "platform" ? "平台" : "用户"}</span>
                  </div>
                  <small>更新于 {formatDateTime(template.updatedAt)}</small>
                </article>
              )) : (
                <div className="empty-state">
                  <div>
                    <strong>{activeCategory === "all" ? "暂无模板" : `暂无${categoryLabels[activeCategory]}模板`}</strong>
                    <span>{canCreateInActiveScope ? "可以新建一个模板。" : "平台模板只能由管理员维护。"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2>{editingId ? "编辑模板" : "新建模板"}</h2>
              <p>{activeScope === "platform" ? "平台模板对所有用户可见" : "用户模板只归当前账号使用"}</p>
            </div>
          </div>
          <form className="panel-body form-stack" onSubmit={handleSubmit}>
            <div className="field">
              <label>模板板块</label>
              <div className="segmented two">
                <button
                  className={clsx(activeScope === "platform" && "active")}
                  type="button"
                  onClick={() => startCreate("platform")}
                  disabled={editingId !== null || currentUser?.role !== "admin"}
                >
                  平台模板
                </button>
                <button
                  className={clsx(activeScope === "user" && "active")}
                  type="button"
                  onClick={() => startCreate("user")}
                  disabled={editingId !== null}
                >
                  用户模板
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="templateName">名称</label>
              <input
                id="templateName"
                className="input"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="templateCategory">分类</label>
              <select
                id="templateCategory"
                className="select"
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value as TemplateCategory }))
                }
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="templateDescription">说明</label>
              <input
                id="templateDescription"
                className="input"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="templatePrompt">默认 prompt</label>
              <textarea
                id="templatePrompt"
                className="textarea"
                value={form.defaultPrompt}
                onChange={(event) => setForm((current) => ({ ...current, defaultPrompt: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="templateNegative">默认负面词</label>
              <textarea
                id="templateNegative"
                className="textarea"
                value={form.defaultNegativePrompt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultNegativePrompt: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="templateSize">默认尺寸</label>
              <select
                id="templateSize"
                className="select"
                value={form.defaultSize}
                onChange={(event) => setForm((current) => ({ ...current, defaultSize: event.target.value }))}
              >
                {sizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {imageSizeLabels[size]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="templateReference">参考强度 {form.defaultReferenceStrength.toFixed(2)}</label>
              <input
                id="templateReference"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={form.defaultReferenceStrength}
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultReferenceStrength: Number(event.target.value) }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="templateStyle">风格强度 {form.defaultStyleStrength.toFixed(2)}</label>
              <input
                id="templateStyle"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={form.defaultStyleStrength}
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultStyleStrength: Number(event.target.value) }))
                }
              />
            </div>
            <button className="button primary" type="submit" disabled={saving || (!canCreateInActiveScope && !editingId)}>
              <Save size={16} aria-hidden="true" />
              {saving ? "保存中" : "保存模板"}
            </button>
            <div className={clsx("toast-line", error && "error")} role="status" aria-live="polite">{error || message}</div>
          </form>
        </aside>
      </section>
    </>
  );
}
