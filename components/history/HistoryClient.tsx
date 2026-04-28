"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Download, Pencil, RefreshCw, Save, Search } from "lucide-react";
import clsx from "clsx";
import { sizeFromDimensions } from "@/lib/image-options";
import type { GenerationMode, PublicImage, PublicTemplate } from "@/lib/types";
import { apiJson, categoryLabels, formatDateTime, modeLabels } from "@/components/client-api";

interface ImageListResponse {
  images: PublicImage[];
}

interface TemplateListResponse {
  templates: PublicTemplate[];
}

const allModes = ["", "text_to_image", "image_to_image", "edit_image"] as const;

export function HistoryClient() {
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState<(typeof allModes)[number]>("");
  const [templateId, setTemplateId] = useState("");
  const [images, setImages] = useState<PublicImage[]>([]);
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const templateMap = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  );

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ pageSize: "30" });
      if (keyword.trim()) {
        params.set("keyword", keyword.trim());
      }
      if (mode) {
        params.set("mode", mode);
      }
      if (templateId) {
        params.set("templateId", templateId);
      }

      const payload = await apiJson<ImageListResponse>(`/api/images?${params.toString()}`);
      setImages(payload.images);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "历史记录加载失败");
    } finally {
      setLoading(false);
    }
  }, [keyword, mode, templateId]);

  useEffect(() => {
    apiJson<TemplateListResponse>("/api/templates")
      .then((payload) => setTemplates(payload.templates))
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    loadImages().catch((caught: Error) => setError(caught.message));
  }, [loadImages]);

  async function copyPrompt(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setMessage("prompt 已复制。");
  }

  async function regenerate(image: PublicImage): Promise<void> {
    try {
      await apiJson("/api/generation-tasks", {
        method: "POST",
        body: JSON.stringify({
          mode: image.mode,
          prompt: image.prompt,
          negativePrompt: null,
          size: sizeFromDimensions(image.width, image.height),
          quantity: 1,
          templateId: image.templateId,
          sourceImageId: image.mode === "text_to_image" ? null : image.id,
          referenceStrength: 0.6,
          styleStrength: 0.7,
        }),
      });
      setMessage("已提交再生成任务。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "再生成失败");
    }
  }

  async function saveTemplate(image: PublicImage): Promise<void> {
    const name = window.prompt("模板名称", image.templateName ? `${image.templateName} 副本` : "历史图片模板");
    if (!name) {
      return;
    }

    try {
      await apiJson("/api/templates/from-image", {
        method: "POST",
        body: JSON.stringify({
          imageId: image.id,
          name,
          category: "company",
          description: "从历史记录保存的模板",
        }),
      });
      const payload = await apiJson<TemplateListResponse>("/api/templates");
      setTemplates(payload.templates);
      setMessage("模板已保存。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存模板失败");
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>历史记录</h1>
          <p>默认按生成时间倒序展示，可按模式、模板和 prompt 关键词筛选。</p>
        </div>
        <button className="button" type="button" onClick={loadImages} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "刷新中" : "刷新"}
        </button>
      </section>

      <section className="history-toolbar">
        <div className="field">
          <label htmlFor="keyword">关键词</label>
          <input
            id="keyword"
            className="input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索 prompt"
          />
        </div>
        <div className="field">
          <label htmlFor="modeFilter">模式</label>
          <select id="modeFilter" className="select" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            {allModes.map((item) => (
              <option key={item || "all"} value={item}>
                {item ? modeLabels[item as GenerationMode] : "全部模式"}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="templateFilter">模板</label>
          <select id="templateFilter" className="select" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">全部模板</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        <button className="button primary" type="button" onClick={loadImages}>
          <Search size={16} aria-hidden="true" />
          筛选
        </button>
      </section>

      <div className={clsx("toast-line", error && "error")}>{error || message}</div>

      {images.length > 0 ? (
        <section className="image-grid">
          {images.map((image) => (
            <article className="image-card" key={image.id}>
              <div className={clsx("image-frame", image.height > image.width && "tall", image.width > image.height && "wide")}>
                <img src={image.url} alt={image.prompt} />
              </div>
              <div className="image-card-body">
                <div>
                  <span className="badge">{modeLabels[image.mode]}</span>
                  {image.templateId ? (
                    <span className="badge">{templateMap.get(image.templateId)?.name || image.templateName}</span>
                  ) : null}
                </div>
                <div className="image-prompt">{image.prompt}</div>
                <small>{formatDateTime(image.createdAt)}</small>
                {image.templateId ? <small>{categoryLabels[templateMap.get(image.templateId)?.category ?? "company"]}</small> : null}
                <div className="card-actions">
                  <a className="icon-button" href={image.url} download title="下载">
                    <Download size={15} aria-hidden="true" />
                  </a>
                  <button className="icon-button" type="button" onClick={() => copyPrompt(image.prompt)} title="复制 prompt">
                    <Copy size={15} aria-hidden="true" />
                  </button>
                  <button className="icon-button" type="button" onClick={() => regenerate(image)} title="再生成">
                    <RefreshCw size={15} aria-hidden="true" />
                  </button>
                  <Link className="icon-button" href={`/?mode=edit_image&sourceImageId=${image.id}`} title="用这张图改图">
                    <Pencil size={15} aria-hidden="true" />
                  </Link>
                  <button className="icon-button" type="button" onClick={() => saveTemplate(image)} title="保存为模板">
                    <Save size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <div>
            <strong>暂无历史图片</strong>
            <span>生成成功后的图片会自动进入这里。</span>
          </div>
        </div>
      )}
    </>
  );
}
