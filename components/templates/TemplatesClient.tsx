"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Edit3,
  LayoutTemplate,
  Plus,
  Save,
  ScanText,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import clsx from "clsx";
import { imageSizeLabels, sizeOptions } from "@/lib/image-options";
import type {
  CurrentUser,
  PublicTemplate,
  TemplateCategory,
  TemplateScope,
  TemplateVariableDefinition,
  TemplateVariableOption,
  TemplateVariableType,
} from "@/lib/types";
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
const templateVariableTypeLabels: Record<TemplateVariableType, string> = {
  text: "短文本",
  textarea: "长文本",
  select: "下拉选项",
};

interface TemplateForm {
  name: string;
  category: TemplateCategory;
  description: string;
  defaultPrompt: string;
  defaultNegativePrompt: string;
  defaultSize: string;
  defaultReferenceStrength: number;
  defaultStyleStrength: number;
  sourceImageId: string | null;
  templateVariables: TemplateVariableDefinition[];
}

const emptyForm: TemplateForm = {
  name: "",
  category: "company",
  description: "",
  defaultPrompt: "",
  defaultNegativePrompt: "",
  defaultSize: "auto",
  defaultReferenceStrength: 0.6,
  defaultStyleStrength: 0.7,
  sourceImageId: null,
  templateVariables: [],
};

function templateVariableFromKey(key: string): TemplateVariableDefinition {
  return {
    key,
    label: key,
    type: "text",
    required: false,
    placeholder: null,
    defaultValue: null,
    helperText: null,
    options: [],
  };
}

function extractPromptVariableKeys(prompt: string): string[] {
  return Array.from(prompt.matchAll(/\{([^{}]+)\}/g), (match) => match[1]?.trim() ?? "")
    .filter(Boolean)
    .filter((key, index, keys) => keys.indexOf(key) === index);
}

function formatVariableOptions(options: TemplateVariableOption[]): string {
  return options.map((option) => option.label === option.value ? option.value : `${option.label}=${option.value}`).join("\n");
}

function parseVariableOptions(value: string): TemplateVariableOption[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        return { label: line, value: line };
      }
      const label = line.slice(0, separatorIndex).trim();
      const optionValue = line.slice(separatorIndex + 1).trim();
      return { label: label || optionValue, value: optionValue || label };
    })
    .filter((option) => option.label && option.value);
}

function normalizeTemplateVariables(variables: TemplateVariableDefinition[]): TemplateVariableDefinition[] {
  return variables
    .map((variable) => {
      const key = variable.key.trim();
      const label = variable.label.trim() || key;
      return {
        ...variable,
        key,
        label,
        placeholder: variable.placeholder?.trim() || null,
        defaultValue: variable.defaultValue?.trim() || null,
        helperText: variable.helperText?.trim() || null,
        options: variable.options
          .map((option) => ({ label: option.label.trim(), value: option.value.trim() }))
          .filter((option) => option.label && option.value),
      };
    })
    .filter((variable) => variable.key && variable.label);
}

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
      templateVariables: template.templateVariables,
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
        templateVariables: normalizeTemplateVariables(form.templateVariables),
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

  function addTemplateVariable(): void {
    setForm((current) => {
      const keys = new Set(current.templateVariables.map((variable) => variable.key));
      const promptKey = extractPromptVariableKeys(current.defaultPrompt).find((key) => !keys.has(key));
      const fallbackKey = `变量${current.templateVariables.length + 1}`;
      const key = promptKey ?? fallbackKey;
      return {
        ...current,
        templateVariables: [...current.templateVariables, templateVariableFromKey(key)],
      };
    });
  }

  function syncTemplateVariablesFromPrompt(): void {
    const keys = new Set(form.templateVariables.map((variable) => variable.key));
    const nextVariables = extractPromptVariableKeys(form.defaultPrompt)
      .filter((key) => !keys.has(key))
      .map(templateVariableFromKey);
    if (nextVariables.length === 0) {
      setMessage("没有发现新的 Prompt 占位符。");
      return;
    }
    setMessage(`已添加 ${nextVariables.length} 个变量。`);
    setError("");
    setForm((current) => {
      const currentKeys = new Set(current.templateVariables.map((variable) => variable.key));
      return {
        ...current,
        templateVariables: [
          ...current.templateVariables,
          ...nextVariables.filter((variable) => !currentKeys.has(variable.key)),
        ],
      };
    });
  }

  function updateTemplateVariable(index: number, patch: Partial<TemplateVariableDefinition>): void {
    setForm((current) => ({
      ...current,
      templateVariables: current.templateVariables.map((variable, variableIndex) =>
        variableIndex === index ? { ...variable, ...patch } : variable,
      ),
    }));
  }

  function removeTemplateVariable(index: number): void {
    setForm((current) => ({
      ...current,
      templateVariables: current.templateVariables.filter((_, variableIndex) => variableIndex !== index),
    }));
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
                    {template.templateVariables.length > 0 ? (
                      <span className="badge">变量 {template.templateVariables.length}</span>
                    ) : null}
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
            <section className="template-variable-editor">
              <div className="template-variable-editor-header">
                <div>
                  <strong>模板变量</strong>
                  <span>工作台会按这里的字段生成“填写生产参数”表单</span>
                </div>
                <div className="template-variable-editor-actions">
                  <button className="button subtle" type="button" onClick={syncTemplateVariablesFromPrompt}>
                    <ScanText size={15} aria-hidden="true" />
                    识别占位符
                  </button>
                  <button className="button" type="button" onClick={addTemplateVariable}>
                    <Plus size={15} aria-hidden="true" />
                    添加变量
                  </button>
                </div>
              </div>
              {form.templateVariables.length > 0 ? (
                <div className="template-variable-list">
                  {form.templateVariables.map((variable, index) => (
                    <div className="template-variable-item" key={`${variable.key}-${index}`}>
                      <div className="template-variable-item-head">
                        <span className="badge">变量 {index + 1}</span>
                        <button
                          className="icon-button danger"
                          type="button"
                          onClick={() => removeTemplateVariable(index)}
                          title="删除变量"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="field-row">
                        <div className="field">
                          <label htmlFor={`templateVariableKey-${index}`}>占位符 key</label>
                          <input
                            id={`templateVariableKey-${index}`}
                            className="input"
                            value={variable.key}
                            placeholder="例如：产品名称"
                            onChange={(event) => updateTemplateVariable(index, { key: event.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`templateVariableLabel-${index}`}>表单名称</label>
                          <input
                            id={`templateVariableLabel-${index}`}
                            className="input"
                            value={variable.label}
                            placeholder="例如：产品名称"
                            onChange={(event) => updateTemplateVariable(index, { label: event.target.value })}
                          />
                        </div>
                      </div>
                      <div className="field-row">
                        <div className="field">
                          <label htmlFor={`templateVariableType-${index}`}>输入类型</label>
                          <select
                            id={`templateVariableType-${index}`}
                            className="select"
                            value={variable.type}
                            onChange={(event) =>
                              updateTemplateVariable(index, { type: event.target.value as TemplateVariableType })
                            }
                          >
                            {Object.entries(templateVariableTypeLabels).map(([type, label]) => (
                              <option key={type} value={type}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="switch-row template-variable-required">
                          <input
                            type="checkbox"
                            checked={variable.required}
                            onChange={(event) => updateTemplateVariable(index, { required: event.target.checked })}
                          />
                          <span>
                            <strong>必填</strong>
                            <small>为空时工作台会提示补充</small>
                          </span>
                        </label>
                      </div>
                      <div className="field-row">
                        <div className="field">
                          <label htmlFor={`templateVariablePlaceholder-${index}`}>输入提示</label>
                          <input
                            id={`templateVariablePlaceholder-${index}`}
                            className="input"
                            value={variable.placeholder ?? ""}
                            placeholder="例如：桌面空气净化器"
                            onChange={(event) => updateTemplateVariable(index, { placeholder: event.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`templateVariableDefault-${index}`}>默认值</label>
                          <input
                            id={`templateVariableDefault-${index}`}
                            className="input"
                            value={variable.defaultValue ?? ""}
                            placeholder="可留空"
                            onChange={(event) => updateTemplateVariable(index, { defaultValue: event.target.value })}
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor={`templateVariableHelper-${index}`}>说明文字</label>
                        <input
                          id={`templateVariableHelper-${index}`}
                          className="input"
                          value={variable.helperText ?? ""}
                          placeholder="可留空，显示在字段下方"
                          onChange={(event) => updateTemplateVariable(index, { helperText: event.target.value })}
                        />
                      </div>
                      {variable.type === "select" ? (
                        <div className="field">
                          <label htmlFor={`templateVariableOptions-${index}`}>下拉选项</label>
                          <textarea
                            id={`templateVariableOptions-${index}`}
                            className="textarea compact-textarea"
                            value={formatVariableOptions(variable.options)}
                            placeholder={"每行一个，例如：\n白底=白底\n家居台面=家居台面"}
                            onChange={(event) =>
                              updateTemplateVariable(index, { options: parseVariableOptions(event.target.value) })
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <div>
                    <strong>暂无模板变量</strong>
                    <span>在默认 prompt 里写入 {`{产品名称}`} 后，可点击“识别占位符”自动生成字段。</span>
                  </div>
                </div>
              )}
            </section>
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
