"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Edit3, LayoutTemplate, Plus, Save } from "lucide-react";
import clsx from "clsx";
import { imageSizeLabels, sizeOptions } from "@/lib/image-options";
import type { PublicTemplate, TemplateCategory } from "@/lib/types";
import { apiJson, categoryLabels, formatDateTime } from "@/components/client-api";

interface TemplateListResponse {
  templates: PublicTemplate[];
}

interface TemplateResponse {
  template: PublicTemplate;
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
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const visibleTemplates = useMemo(
    () =>
      activeCategory === "all"
        ? templates
        : templates.filter((template) => template.category === activeCategory),
    [activeCategory, templates],
  );

  async function loadTemplates(): Promise<void> {
    const payload = await apiJson<TemplateListResponse>("/api/templates");
    setTemplates(payload.templates);
  }

  useEffect(() => {
    loadTemplates().catch((caught: Error) => setError(caught.message));
  }, []);

  function startCreate(): void {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  function startEdit(template: PublicTemplate): void {
    setEditingId(template.id);
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
        description: form.description || null,
        defaultNegativePrompt: form.defaultNegativePrompt || null,
      });
      const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
      const method = editingId ? "PUT" : "POST";
      const payload = await apiJson<TemplateResponse>(url, { method, body });
      setMessage(editingId ? "模板已更新。" : "模板已创建。");
      await loadTemplates();
      setEditingId(payload.template.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "模板保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>模板管理</h1>
          <p>用途模板、平台模板和公司模板统一维护，工作台选择模板后会自动带出默认参数。</p>
        </div>
        <button className="button" type="button" onClick={startCreate}>
          <Plus size={16} aria-hidden="true" />
          新建模板
        </button>
      </section>

      <section className="template-layout">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>模板库</h2>
              <p>内置模板和公司模板</p>
            </div>
          </div>
          <div className="panel-body">
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
              {visibleTemplates.map((template) => (
                <article className="template-item" key={template.id}>
                  <div className="queue-item-top">
                    <span className="badge">
                      <LayoutTemplate size={13} aria-hidden="true" />
                      {categoryLabels[template.category]}
                    </span>
                    <button className="icon-button" type="button" onClick={() => startEdit(template)} title="编辑模板">
                      <Edit3 size={15} aria-hidden="true" />
                    </button>
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
                  </div>
                  <small>更新于 {formatDateTime(template.updatedAt)}</small>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2>{editingId ? "编辑模板" : "新建模板"}</h2>
              <p>{editingId ? "修改后会影响后续使用" : "默认创建为公司模板"}</p>
            </div>
          </div>
          <form className="panel-body form-stack" onSubmit={handleSubmit}>
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
            <button className="button primary" type="submit" disabled={saving}>
              <Save size={16} aria-hidden="true" />
              {saving ? "保存中" : "保存模板"}
            </button>
            <div className={clsx("toast-line", error && "error")}>{error || message}</div>
          </form>
        </aside>
      </section>
    </>
  );
}
