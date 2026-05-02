"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";
import {
  ClipboardPaste,
  Copy,
  Download,
  ImagePlus,
  Layers,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";
import clsx from "clsx";
import { imageSizeLabels, normalizeImageSizeOption, sizeFromDimensions, sizeOptions } from "@/lib/image-options";
import type { ImageSizeOption } from "@/lib/image-options";
import type {
  GenerationMode,
  PublicConversation,
  PublicConversationMessage,
  PublicImage,
  PublicSourceImage,
  PublicTask,
  PublicTemplate,
} from "@/lib/types";
import { apiJson, copyTextToClipboard, formatDateTime, modeLabels, statusLabels } from "@/components/client-api";

const modes: GenerationMode[] = ["text_to_image", "image_to_image", "edit_image"];
const quantityOptions = [1, 2, 4] as const;

interface ConversationListResponse {
  conversations: PublicConversation[];
}

interface ConversationResponse {
  conversation: PublicConversation;
}

interface TemplateListResponse {
  templates: PublicTemplate[];
}

interface CreateTaskResponse {
  taskId: string;
  conversationId: string;
  status: string;
}

const defaultPromptByMode: Record<GenerationMode, string> = {
  text_to_image: "一张简约高级的公司产品宣传海报，白色背景，柔和自然光，科技感，留白充足",
  image_to_image: "保留主体特征，生成更高级干净的商业摄影场景，光线自然，质感清晰",
  edit_image: "保留主体，把背景改成简约高级的办公场景，光线自然，画面干净",
};

export function WorkbenchClient() {
  const [mode, setMode] = useState<GenerationMode>("text_to_image");
  const [prompt, setPrompt] = useState(defaultPromptByMode.text_to_image);
  const [negativePrompt, setNegativePrompt] = useState("低清晰度，模糊，变形，多余文字");
  const [size, setSize] = useState<ImageSizeOption>("auto");
  const [quantity, setQuantity] = useState<(typeof quantityOptions)[number]>(1);
  const [templateId, setTemplateId] = useState("");
  const [referenceStrength, setReferenceStrength] = useState(0.6);
  const [styleStrength, setStyleStrength] = useState(0.7);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceImageIds, setSourceImageIds] = useState<string[]>([]);
  const [sourcePreviews, setSourcePreviews] = useState<string[]>([]);
  const [isDraggingSourceImage, setIsDraggingSourceImage] = useState(false);
  const [conversations, setConversations] = useState<PublicConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<PublicConversation | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatSourceFiles, setChatSourceFiles] = useState<File[]>([]);
  const [chatSourceImageIds, setChatSourceImageIds] = useState<string[]>([]);
  const [chatSourcePreviews, setChatSourcePreviews] = useState<string[]>([]);
  const [isDraggingChatSourceImage, setIsDraggingChatSourceImage] = useState(false);
  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [cancelingTaskId, setCancelingTaskId] = useState<string | null>(null);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templateId, templates],
  );

  const refreshConversations = useCallback(async () => {
    const payload = await apiJson<ConversationListResponse>("/api/conversations?limit=24");
    setConversations(payload.conversations);
    setActiveConversationId((current) => current ?? payload.conversations[0]?.id ?? null);
  }, []);

  const refreshActiveConversation = useCallback(async (conversationId: string | null = activeConversationId) => {
    if (!conversationId) {
      setActiveConversation(null);
      return;
    }

    const payload = await apiJson<ConversationResponse>(`/api/conversations/${conversationId}`);
    setActiveConversation(payload.conversation);
  }, [activeConversationId]);

  useEffect(() => {
    apiJson<TemplateListResponse>("/api/templates")
      .then((payload) => setTemplates(payload.templates))
      .catch((caught: Error) => setError(caught.message));
    refreshConversations().catch((caught: Error) => setError(caught.message));
  }, [refreshConversations]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshConversations().catch((caught: Error) => setError(caught.message));
      refreshActiveConversation().catch((caught: Error) => setError(caught.message));
    }, 2800);
    return () => window.clearInterval(timer);
  }, [refreshActiveConversation, refreshConversations]);

  useEffect(() => {
    refreshActiveConversation().catch((caught: Error) => setError(caught.message));
  }, [refreshActiveConversation]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextMode = params.get("mode");
    const nextSourceImageId = params.get("sourceImageId");
    if (nextMode && modes.includes(nextMode as GenerationMode)) {
      setMode(nextMode as GenerationMode);
      setPrompt(defaultPromptByMode[nextMode as GenerationMode]);
    }
    if (nextSourceImageId) {
      setSourceImageIds([nextSourceImageId]);
      setSourcePreviews([]);
    }
  }, []);

  function switchMode(nextMode: GenerationMode): void {
    setMode(nextMode);
    setPrompt((current) => (current === defaultPromptByMode[mode] ? defaultPromptByMode[nextMode] : current));
    setError("");
  }

  function applyTemplate(nextTemplateId: string): void {
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);
    if (!template) {
      return;
    }
    setPrompt(template.defaultPrompt);
    setNegativePrompt(template.defaultNegativePrompt ?? "");
    setSize(normalizeImageSizeOption(template.defaultSize));
    setReferenceStrength(template.defaultReferenceStrength);
    setStyleStrength(template.defaultStyleStrength);
    if (template.sourceImageId) {
      setSourceImageIds([template.sourceImageId]);
      setSourcePreviews([]);
    }
  }

  function isSupportedImageFile(file: File): boolean {
    return ["image/png", "image/jpeg", "image/webp"].includes(file.type);
  }

  function handleFilesChange(files: FileList | File[] | null): void {
    if (!files) return;
    const validFiles = Array.from(files).filter((f) => isSupportedImageFile(f));
    if (validFiles.length === 0) {
      setError("仅支持 PNG、JPG 或 WEBP 图片");
      return;
    }
    setError("");
    const remaining = 4 - sourceFiles.length;
    const toAdd = validFiles.slice(0, remaining);
    if (validFiles.length > remaining) {
      setError(`最多上传 4 张参考图，已添加 ${remaining} 张`);
    }
    setSourceFiles((prev) => [...prev, ...toAdd]);
    setSourceImageIds([]);
    setSourcePreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
  }

  function removeSourceFile(index: number): void {
    setSourceFiles((prev) => prev.filter((_, i) => i !== index));
    setSourcePreviews((prev) => {
      const url = prev[index];
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    setSourceImageIds((prev) => prev.filter((_, i) => i !== index));
  }

  function handleChatSourceFilesChange(files: FileList | File[] | null): void {
    if (!files) return;
    const validFiles = Array.from(files).filter((f) => isSupportedImageFile(f));
    if (validFiles.length === 0) {
      setError("仅支持 PNG、JPG 或 WEBP 图片");
      return;
    }
    setError("");
    const remaining = 4 - chatSourceFiles.length;
    const toAdd = validFiles.slice(0, remaining);
    setChatSourceFiles((prev) => [...prev, ...toAdd]);
    setChatSourceImageIds([]);
    setChatSourcePreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
    if (toAdd.length > 0) {
      setMessage("已添加会话参考图，本次继续改图会优先使用它。");
    }
  }

  function clearChatSourceImage(): void {
    chatSourcePreviews.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
    setChatSourceFiles([]);
    setChatSourceImageIds([]);
    setChatSourcePreviews([]);
  }

  function getValidImageFiles(files: FileList | File[] | null): File[] {
    if (!files) return [];
    return Array.from(files).filter((file) => file.type.startsWith("image/"));
  }

  function handleSourceDrop(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    setIsDraggingSourceImage(false);
    const files = getValidImageFiles(event.dataTransfer.files);
    if (files.length === 0) {
      setError("请拖入 PNG、JPG 或 WEBP 图片");
      return;
    }
    handleFilesChange(files);
  }

  function handleSourceDragOver(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingSourceImage(true);
  }

  function handleChatSourceDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDraggingChatSourceImage(false);
    const files = getValidImageFiles(event.dataTransfer.files);
    if (files.length === 0) {
      setError("请拖入 PNG、JPG 或 WEBP 图片");
      return;
    }
    handleChatSourceFilesChange(files);
  }

  function handleChatSourceDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingChatSourceImage(true);
  }

  function handleChatSourcePaste(event: ClipboardEvent<HTMLDivElement>): void {
    const files = getValidImageFiles(event.clipboardData.files);
    if (files.length === 0) return;
    event.preventDefault();
    handleChatSourceFilesChange(files);
  }

  async function handlePasteImage(): Promise<void> {
    if (!navigator.clipboard?.read) {
      setError("当前浏览器不支持读取剪贴板图片，请使用拖拽或选择文件上传");
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) {
          continue;
        }
        const blob = await item.getType(imageType);
        const extension = imageType.split("/")[1] || "png";
        const file = new File([blob], `clipboard-image-${Date.now()}.${extension}`, { type: imageType });
        handleFilesChange([file]);
        setMessage("已从剪贴板读取图片");
        return;
      }
      setError("剪贴板里没有图片");
    } catch {
      setError("读取剪贴板失败，请确认浏览器权限，或改用拖拽/选择文件上传");
    }
  }

  async function handlePasteChatSourceImage(): Promise<void> {
    if (!navigator.clipboard?.read) {
      setError("当前浏览器不支持读取剪贴板图片，请使用拖拽或选择文件上传");
      return;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) {
          continue;
        }
        const blob = await item.getType(imageType);
        const extension = imageType.split("/")[1] || "png";
        const file = new File([blob], `chat-reference-${Date.now()}.${extension}`, { type: imageType });
        handleChatSourceFilesChange([file]);
        return;
      }
      setError("剪贴板里没有图片");
    } catch {
      setError("读取剪贴板失败，请确认浏览器权限，或改用拖拽/选择文件上传");
    }
  }

  useEffect(() => {
    return () => {
      sourcePreviews.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [sourcePreviews]);

  useEffect(() => {
    return () => {
      chatSourcePreviews.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [chatSourcePreviews]);

  async function uploadImageFile(file: File): Promise<{ imageId: string; url: string }> {
    const formData = new FormData();
    formData.append("image", file);
    return apiJson<{ imageId: string; url: string }>("/api/source-images", {
      method: "POST",
      body: formData,
    });
  }

  async function uploadSourceIfNeeded(): Promise<{ primaryId: string | null; allIds: string[] }> {
    if (mode === "text_to_image") {
      return { primaryId: null, allIds: [] };
    }
    if (sourceImageIds.length > 0) {
      return { primaryId: sourceImageIds[0] ?? null, allIds: sourceImageIds };
    }
    if (sourceFiles.length === 0) {
      throw new Error("请先上传参考图");
    }
    const uploadedIds = await Promise.all(
      sourceFiles.map(async (file) => {
        const payload = await uploadImageFile(file);
        return payload.imageId;
      }),
    );
    setSourceImageIds(uploadedIds);
    return { primaryId: uploadedIds[0] ?? null, allIds: uploadedIds };
  }

  async function uploadChatSourceIfNeeded(): Promise<{ primaryId: string | null; allIds: string[] }> {
    if (chatSourceImageIds.length > 0) {
      return { primaryId: chatSourceImageIds[0] ?? null, allIds: chatSourceImageIds };
    }
    if (chatSourceFiles.length === 0) {
      return { primaryId: null, allIds: [] };
    }
    const uploadedIds = await Promise.all(
      chatSourceFiles.map(async (file) => {
        const payload = await uploadImageFile(file);
        return payload.imageId;
      }),
    );
    setChatSourceImageIds(uploadedIds);
    setChatSourcePreviews(uploadedIds.map((id) => `/api/files/${id}`));
    return { primaryId: uploadedIds[0] ?? null, allIds: uploadedIds };
  }

  async function submitTask(): Promise<void> {
    if (!prompt.trim()) {
      setError("请输入 prompt 后再生成");
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const { primaryId: resolvedSourceImageId, allIds: resolvedAllIds } = await uploadSourceIfNeeded();
      const created = await apiJson<CreateTaskResponse>("/api/generation-tasks", {
        method: "POST",
        body: JSON.stringify({
          mode,
          prompt,
          negativePrompt,
          size,
          quantity,
          templateId: templateId || null,
          sourceImageId: resolvedSourceImageId,
          sourceImageIds: resolvedAllIds.length > 1 ? resolvedAllIds : undefined,
          referenceStrength,
          styleStrength,
        }),
      });

      setActiveConversationId(created.conversationId);
      setSelectedImageId(null);
      setMessage("会话已创建，任务会在当前对话里持续更新。");
      await refreshConversations();
      await refreshActiveConversation(created.conversationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt(value: string): Promise<void> {
    try {
      await copyTextToClipboard(value);
      setMessage("prompt 已复制。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "复制失败，请手动复制。");
    }
  }

  async function regenerateFromImage(image: PublicImage): Promise<void> {
    setBusy(true);
    setError("");
    setSelectedImageId(image.id);
    try {
      await apiJson("/api/generation-tasks", {
        method: "POST",
        body: JSON.stringify({
          mode: image.mode,
          prompt: image.prompt,
          negativePrompt,
          size: sizeFromDimensions(image.width, image.height),
          quantity: 1,
          templateId: image.templateId,
          sourceImageId: image.mode === "text_to_image" ? null : image.id,
          conversationId: activeConversationId,
          referenceStrength,
          styleStrength,
        }),
      });
      setMessage("已基于历史参数再次提交。");
      await refreshConversations();
      await refreshActiveConversation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "再生成失败");
    } finally {
      setBusy(false);
    }
  }

  async function retryTask(task: PublicTask): Promise<void> {
    setRetryingTaskId(task.id);
    setError("");
    setMessage("");
    if (task.sourceImageId) {
      setSelectedImageId(task.sourceImageId);
    }

    try {
      const created = await apiJson<CreateTaskResponse>("/api/generation-tasks", {
        method: "POST",
        body: JSON.stringify({
          mode: task.mode,
          prompt: task.prompt,
          negativePrompt: task.negativePrompt,
          size: task.size,
          quantity: task.quantity,
          templateId: task.templateId,
          sourceImageId: task.sourceImageId,
          conversationId: task.conversationId ?? activeConversationId,
          referenceStrength: task.referenceStrength,
          styleStrength: task.styleStrength,
        }),
      });
      setActiveConversationId(created.conversationId);
      setMessage("已重新提交这个生成任务。");
      await refreshConversations();
      await refreshActiveConversation(created.conversationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "重试失败");
    } finally {
      setRetryingTaskId(null);
    }
  }

  function editWithImage(image: PublicImage): void {
    setMode("edit_image");
    setSourceImageIds([image.id]);
    setSelectedImageId(image.id);
    setSourcePreviews([image.url]);
    setPrompt("保留主体，把背景改成简约高级的办公场景，光线自然，画面干净");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveImageAsTemplate(image: PublicImage): Promise<void> {
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
          description: "从历史图片保存的公司模板",
        }),
      });
      const payload = await apiJson<TemplateListResponse>("/api/templates");
      setTemplates(payload.templates);
      setMessage("已保存为公司模板。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存模板失败");
    }
  }

  async function continueConversation(): Promise<void> {
    if (!activeConversationId) {
      setError("请先创建或打开一个会话");
      return;
    }

    if (!chatPrompt.trim()) {
      setError("请输入要继续修改的描述");
      return;
    }

    setChatBusy(true);
    setError("");
    setMessage("");

    try {
      const { primaryId: chatPrimaryId, allIds: chatAllIds } = await uploadChatSourceIfNeeded();
      await apiJson<CreateTaskResponse>(`/api/conversations/${activeConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          prompt: chatPrompt,
          negativePrompt,
          sourceImageId: selectedImageId,
          referenceImageId: chatPrimaryId,
          referenceImageIds: chatAllIds.length > 1 ? chatAllIds : undefined,
          size,
          quantity: 1,
          referenceStrength,
          styleStrength,
        }),
      });
      setChatPrompt("");
      clearChatSourceImage();
      setMessage("已在当前会话里提交新的改图任务。");
      await refreshConversations();
      await refreshActiveConversation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "继续会话失败");
    } finally {
      setChatBusy(false);
    }
  }

  async function cancelTask(task: PublicTask): Promise<void> {
    setCancelingTaskId(task.id);
    setError("");
    setMessage("");
    try {
      await apiJson(`/api/generation-tasks/${task.id}/cancel`, {
        method: "POST",
      });
      setMessage("已停止当前生成任务。");
      await refreshConversations();
      await refreshActiveConversation(task.conversationId ?? activeConversationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "停止任务失败");
    } finally {
      setCancelingTaskId(null);
    }
  }

  function openConversation(conversationId: string): void {
    setActiveConversationId(conversationId);
    setSelectedImageId(null);
    clearChatSourceImage();
    setError("");
    setMessage("");
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>生成工作台</h1>
          <p>文生图、图生图、改图和任务队列在一个工作流里完成，生成结果会自动进入历史记录。</p>
        </div>
      </section>

      <section className="workbench-layout">
        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2>参数</h2>
              <p>选择模式、模板和生成参数</p>
            </div>
          </div>
          <div className="panel-body form-stack">
            <div className="mode-tabs" role="tablist" aria-label="生成模式">
              {modes.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  className={clsx(mode === item && "active")}
                  onClick={() => switchMode(item)}
                >
                  {item === "text_to_image" ? <Sparkles size={16} /> : null}
                  {item === "image_to_image" ? <ImagePlus size={16} /> : null}
                  {item === "edit_image" ? <Pencil size={16} /> : null}
                  {modeLabels[item]}
                </button>
              ))}
            </div>

            <div className="field">
              <label htmlFor="template">模板</label>
              <select
                id="template"
                className="select"
                value={templateId}
                onChange={(event) => applyTemplate(event.target.value)}
              >
                <option value="">不使用模板</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate ? <span className="badge">{selectedTemplate.description || "模板参数已填入"}</span> : null}

            <div className="field">
              <label htmlFor="prompt">Prompt</label>
              <textarea
                id="prompt"
                className="textarea"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </div>

            {mode !== "text_to_image" ? (
              <div className="field">
                <span className="field-label">参考图</span>
                <button
                  className={clsx("upload-target", isDraggingSourceImage && "dragging")}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleSourceDrop}
                  onDragOver={handleSourceDragOver}
                  onDragEnter={handleSourceDragOver}
                  onDragLeave={() => setIsDraggingSourceImage(false)}
                >
                  {sourcePreviews.length > 0 ? (
                    <div className="source-preview-grid">
                      {sourcePreviews.map((preview, idx) => (
                        <div key={idx} className="source-preview-inline">
                          <img className="upload-preview" src={preview} alt={`参考图 ${idx + 1}`} />
                          <button className="icon-button ghost" type="button" onClick={() => removeSourceFile(idx)}>
                            <X size={12} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <Upload size={20} aria-hidden="true" />
                      <span>点击、拖拽或粘贴 PNG / JPG / WEBP（最多4张）</span>
                    </>
                  )}
                </button>
                <div className="upload-actions">
                  <button className="button subtle" type="button" onClick={handlePasteImage}>
                    粘贴剪贴板图片
                  </button>
                  <span>也可以直接把图片拖到上方区域</span>
                </div>
                <input
                  ref={fileInputRef}
                  className="input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => handleFilesChange(event.target.files)}
                />
              </div>
            ) : null}

            <div className="field-row">
              <div className="field">
                <label htmlFor="size">尺寸</label>
                <select
                  id="size"
                  className="select"
                  value={size}
                  onChange={(event) => setSize(event.target.value as ImageSizeOption)}
                >
                  {sizeOptions.map((item) => (
                    <option key={item} value={item}>
                      {imageSizeLabels[item]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="field-label">数量</span>
                <div className="segmented">
                  {quantityOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={clsx(quantity === item && "active")}
                      onClick={() => setQuantity(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <details className="advanced">
              <summary>高级参数</summary>
              <div className="advanced-fields">
                <div className="field">
                  <label htmlFor="negative">负面提示词</label>
                  <textarea
                    id="negative"
                    className="textarea"
                    value={negativePrompt}
                    onChange={(event) => setNegativePrompt(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="referenceStrength">参考强度 {referenceStrength.toFixed(2)}</label>
                  <input
                    id="referenceStrength"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={referenceStrength}
                    onChange={(event) => setReferenceStrength(Number(event.target.value))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="styleStrength">风格强度 {styleStrength.toFixed(2)}</label>
                  <input
                    id="styleStrength"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={styleStrength}
                    onChange={(event) => setStyleStrength(Number(event.target.value))}
                  />
                </div>
              </div>
            </details>

            <button
              className="button primary sidebar-generate-button"
              type="button"
              onClick={submitTask}
              disabled={busy}
            >
              <Send size={16} aria-hidden="true" />
              {busy ? "提交中" : "生成"}
            </button>

            <div className={clsx("toast-line", error && "error")}>{error || message}</div>
          </div>
        </aside>

        <section className="panel results-panel conversation-panel">
          <div className="panel-header">
            <div>
              <h2>{activeConversation?.title ?? "会话窗口"}</h2>
              <p>生成结果和后续改图都在当前上下文里连续进行</p>
            </div>
            <button
              className="icon-button ghost"
              type="button"
              onClick={() => refreshActiveConversation()}
              aria-label="刷新会话"
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="panel-body conversation-body">
            {activeConversation ? (
              <ConversationWindow
                conversation={activeConversation}
                chatPrompt={chatPrompt}
                chatBusy={chatBusy}
                canContinue={Boolean(activeConversation.latestImage)}
                selectedImageId={selectedImageId}
                chatSourcePreviews={chatSourcePreviews}
                isDraggingChatSourceImage={isDraggingChatSourceImage}
                cancelingTaskId={cancelingTaskId}
                retryingTaskId={retryingTaskId}
                onChatPromptChange={setChatPrompt}
                onChatSourceFilesChange={handleChatSourceFilesChange}
                onChatSourceDrop={handleChatSourceDrop}
                onChatSourceDragOver={handleChatSourceDragOver}
                onChatSourceDragLeave={() => setIsDraggingChatSourceImage(false)}
                onChatSourcePaste={handleChatSourcePaste}
                onPasteChatSourceImage={handlePasteChatSourceImage}
                onClearChatSourceImage={clearChatSourceImage}
                onContinue={continueConversation}
                onSelectImage={(image) => setSelectedImageId(image.id)}
                onCancelTask={cancelTask}
                onRetryTask={retryTask}
                onCopy={copyPrompt}
                onRegenerate={regenerateFromImage}
                onEdit={editWithImage}
                onSaveTemplate={saveImageAsTemplate}
              />
            ) : (
              <div className="empty-state">
                <div>
                  <strong>还没有打开会话</strong>
                  <span>点击生成后会自动创建会话，也可以从右侧会话列表打开。</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="panel queue-panel">
          <div className="panel-header">
            <div>
              <h2>会话列表</h2>
              <p>点击进入上下文对话</p>
            </div>
            <button className="icon-button ghost" type="button" onClick={refreshConversations} aria-label="刷新会话列表">
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="panel-body queue-list">
            {conversations.length > 0 ? (
              conversations.map((conversation) => {
                const task = conversation.latestTask;
                return (
                <button
                  className={clsx("queue-item conversation-list-item", activeConversationId === conversation.id && "active")}
                  key={conversation.id}
                  type="button"
                  onClick={() => openConversation(conversation.id)}
                >
                  <div className="queue-item-top">
                    <span className="badge">
                      <Layers size={13} aria-hidden="true" />
                      {task ? modeLabels[task.mode] : "会话"}
                    </span>
                    {task ? (
                      <span className={clsx("badge", task.status === "succeeded" && "success", task.status === "failed" && "danger", task.status === "processing" && "warning")}>
                        <span className={clsx("status-dot", task.status)} />
                        {statusLabels[task.status]}
                      </span>
                    ) : null}
                  </div>
                  <strong>{conversation.title}</strong>
                  <div className="queue-prompt">{task?.prompt ?? "新的图片会话"}</div>
                  <small>{formatDateTime(conversation.updatedAt)}</small>
                  {task?.errorMessage ? <small className="toast-line error">{compactErrorMessage(task.errorMessage)}</small> : null}
                </button>
                );
              })
            ) : (
              <div className="empty-state">
                <span>暂无会话</span>
              </div>
            )}
          </div>
        </aside>
      </section>
    </>
  );
}

function ConversationWindow({
  conversation,
  chatPrompt,
  chatBusy,
  canContinue,
  selectedImageId,
  chatSourcePreviews,
  isDraggingChatSourceImage,
  cancelingTaskId,
  retryingTaskId,
  onChatPromptChange,
  onChatSourceFilesChange,
  onChatSourceDrop,
  onChatSourceDragOver,
  onChatSourceDragLeave,
  onChatSourcePaste,
  onPasteChatSourceImage,
  onClearChatSourceImage,
  onContinue,
  onSelectImage,
  onCancelTask,
  onRetryTask,
  onCopy,
  onRegenerate,
  onEdit,
  onSaveTemplate,
}: {
  conversation: PublicConversation;
  chatPrompt: string;
  chatBusy: boolean;
  canContinue: boolean;
  selectedImageId: string | null;
  chatSourcePreviews: string[];
  isDraggingChatSourceImage: boolean;
  cancelingTaskId: string | null;
  retryingTaskId: string | null;
  onChatPromptChange: (value: string) => void;
  onChatSourceFilesChange: (files: FileList | File[] | null) => void;
  onChatSourceDrop: (event: DragEvent<HTMLDivElement>) => void;
  onChatSourceDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onChatSourceDragLeave: () => void;
  onChatSourcePaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onPasteChatSourceImage: () => Promise<void>;
  onClearChatSourceImage: () => void;
  onContinue: () => Promise<void>;
  onSelectImage: (image: PublicImage) => void;
  onCancelTask: (task: PublicTask) => Promise<void>;
  onRetryTask: (task: PublicTask) => Promise<void>;
  onCopy: (prompt: string) => Promise<void>;
  onRegenerate: (image: PublicImage) => Promise<void>;
  onEdit: (image: PublicImage) => void;
  onSaveTemplate: (image: PublicImage) => Promise<void>;
}) {
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const taskMap = useMemo(
    () => new Map((conversation.tasks ?? []).map((task) => [task.id, task])),
    [conversation.tasks],
  );
  const messages = conversation.messages ?? [];

  return (
    <div className="conversation-window">
      <div className="conversation-thread">
        {messages.length > 0 ? (
          messages.map((item) => {
            const task = item.taskId ? taskMap.get(item.taskId) : null;
            return (
              <ConversationMessageItem
                key={item.id}
                message={item}
                task={task ?? null}
                selectedImageId={selectedImageId}
                cancelingTaskId={cancelingTaskId}
                retryingTaskId={retryingTaskId}
                onSelectImage={onSelectImage}
                onCancelTask={onCancelTask}
                onRetryTask={onRetryTask}
                onCopy={onCopy}
                onRegenerate={onRegenerate}
                onEdit={onEdit}
                onSaveTemplate={onSaveTemplate}
              />
            );
          })
        ) : (
          <div className="empty-state">
            <div>
              <strong>会话准备好了</strong>
              <span>第一条生成任务提交后，消息和结果会出现在这里。</span>
            </div>
          </div>
        )}
      </div>

      <div
        className={clsx("chat-composer", isDraggingChatSourceImage && "dragging")}
        onDrop={onChatSourceDrop}
        onDragOver={onChatSourceDragOver}
        onDragEnter={onChatSourceDragOver}
        onDragLeave={onChatSourceDragLeave}
        onPaste={onChatSourcePaste}
      >
        <div className="chat-reference-strip">
          {chatSourcePreviews.length > 0 ? (
            <div className="source-preview-grid">
              {chatSourcePreviews.map((preview, idx) => (
                <div key={idx} className="chat-reference-preview">
                  <img src={preview} alt={`参考图 ${idx + 1}`} />
                  {chatSourcePreviews.length === 1 && <span>额外参考图</span>}
                </div>
              ))}
              <button className="icon-button ghost" type="button" onClick={onClearChatSourceImage} aria-label="移除参考图">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              className="button subtle chat-upload-button"
              type="button"
              onClick={() => chatFileInputRef.current?.click()}
              disabled={!canContinue || chatBusy}
            >
              <Upload size={15} aria-hidden="true" />
              添加参考图
            </button>
          )}
          <button
            className="icon-button"
            type="button"
            onClick={onPasteChatSourceImage}
            disabled={!canContinue || chatBusy}
            title="粘贴参考图"
          >
            <ClipboardPaste size={15} aria-hidden="true" />
          </button>
          <small>{selectedImageId ? "主图：当前选中的生成结果" : "主图：当前会话最新生成结果"}</small>
          <input
            ref={chatFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              onChatSourceFilesChange(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </div>
        <textarea
          className="textarea"
          value={chatPrompt}
          onChange={(event) => onChatPromptChange(event.target.value)}
          placeholder={canContinue ? "继续描述你想怎么改这张图..." : "等待当前会话先生成一张图片"}
          disabled={!canContinue || chatBusy}
        />
        <button className="button primary" type="button" onClick={onContinue} disabled={!canContinue || chatBusy}>
          <Send size={16} aria-hidden="true" />
          {chatBusy ? "提交中" : "继续改图"}
        </button>
      </div>
    </div>
  );
}

function ConversationMessageItem({
  message,
  task,
  selectedImageId,
  cancelingTaskId,
  retryingTaskId,
  onSelectImage,
  onCancelTask,
  onRetryTask,
  onCopy,
  onRegenerate,
  onEdit,
  onSaveTemplate,
}: {
  message: PublicConversationMessage;
  task: PublicTask | null;
  selectedImageId: string | null;
  cancelingTaskId: string | null;
  retryingTaskId: string | null;
  onSelectImage: (image: PublicImage) => void;
  onCancelTask: (task: PublicTask) => Promise<void>;
  onRetryTask: (task: PublicTask) => Promise<void>;
  onCopy: (prompt: string) => Promise<void>;
  onRegenerate: (image: PublicImage) => Promise<void>;
  onEdit: (image: PublicImage) => void;
  onSaveTemplate: (image: PublicImage) => Promise<void>;
}) {
  const isUser = message.role === "user";
  const images = message.images?.length ? message.images : message.image ? [message.image] : [];
  const canStopTask = task?.status === "queued" || task?.status === "processing";
  const canRetryTask = !isUser && task?.status === "failed" && task.errorMessage !== "用户已停止生成";
  const shouldShowTaskError =
    task?.errorMessage &&
    !isUser &&
    !message.content.startsWith("生成失败：") &&
    task.errorMessage !== "用户已停止生成";
  const [expandedImage, setExpandedImage] = useState<PublicImage | null>(null);

  function openImage(image: PublicImage): void {
    onSelectImage(image);
    setExpandedImage(image);
  }

  return (
    <article className={clsx("message-row", isUser ? "user" : "assistant")}>
      <div className={clsx("message-bubble", images.length > 1 && "multi-image-message")}>
        <div className="message-meta">
          <span>{isUser ? "你" : "image-2"}</span>
          {task ? (
            <div className="message-meta-actions">
              <span className={clsx("badge", task.status === "succeeded" && "success", task.status === "failed" && "danger", task.status === "processing" && "warning")}>
                <span className={clsx("status-dot", task.status)} />
                {statusLabels[task.status]}
              </span>
              {canStopTask ? (
                <button
                  className="button subtle stop-task-button"
                  type="button"
                  onClick={() => onCancelTask(task)}
                  disabled={cancelingTaskId === task.id}
                >
                  <Square size={13} aria-hidden="true" />
                  {cancelingTaskId === task.id ? "停止中" : "停止"}
                </button>
              ) : null}
              {canRetryTask ? (
                <button
                  className="button subtle retry-task-button"
                  type="button"
                  onClick={() => onRetryTask(task)}
                  disabled={retryingTaskId === task.id}
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  {retryingTaskId === task.id ? "重试中" : "重试"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <p>{displayMessageContent(message.content)}</p>
        {isUser && task ? <SourceReferencePreviewList images={task.referenceImages.length > 0 ? task.referenceImages : task.referenceImage ? [task.referenceImage] : []} /> : null}
        {isUser && message.sourceImage ? <SourceReferencePreview image={message.sourceImage} /> : null}
        {shouldShowTaskError ? <small className="toast-line error">{compactErrorMessage(task.errorMessage)}</small> : null}
        {images.length > 1 ? (
          <div className="message-image-grid">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                selected={selectedImageId === image.id}
                onOpen={openImage}
                onCopy={onCopy}
                onRegenerate={onRegenerate}
                onEdit={onEdit}
                onSaveTemplate={onSaveTemplate}
              />
            ))}
          </div>
        ) : images[0] ? (
          <ImageCard
            image={images[0]}
            selected={selectedImageId === images[0].id}
            onOpen={openImage}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            onEdit={onEdit}
            onSaveTemplate={onSaveTemplate}
          />
        ) : null}
        {expandedImage ? <ImageLightbox image={expandedImage} onClose={() => setExpandedImage(null)} /> : null}
      </div>
    </article>
  );
}

function ImageCard({
  image,
  selected = false,
  onOpen,
  onCopy,
  onRegenerate,
  onEdit,
  onSaveTemplate,
}: {
  image: PublicImage;
  selected?: boolean;
  onOpen?: (image: PublicImage) => void;
  onCopy: (prompt: string) => Promise<void>;
  onRegenerate: (image: PublicImage) => Promise<void>;
  onEdit: (image: PublicImage) => void;
  onSaveTemplate: (image: PublicImage) => Promise<void>;
}) {
  const ratioClass = image.height > image.width ? "tall" : image.width > image.height ? "wide" : "";

  return (
    <article className="image-card">
      <button
        className={clsx("image-frame-button", selected && "selected")}
        type="button"
        onClick={() => onOpen?.(image)}
      >
        <div className={clsx("image-frame", ratioClass)}>
          <img src={image.url} alt={image.prompt} />
        </div>
        {selected ? <span className="selected-image-badge">当前参考</span> : null}
      </button>
      <div className="image-card-body">
        <div className="image-prompt">{image.prompt}</div>
        <div className="card-actions">
          <a className="icon-button" href={image.url} download title="下载">
            <Download size={15} aria-hidden="true" />
          </a>
          <button className="icon-button" type="button" onClick={() => onCopy(image.prompt)} title="复制 prompt">
            <Copy size={15} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => onRegenerate(image)} title="再生成">
            <RefreshCw size={15} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => onEdit(image)} title="用这张图改图">
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => onSaveTemplate(image)} title="保存为模板">
            <Save size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

function SourceReferencePreviewList({ images }: { images: PublicSourceImage[] }) {
  if (images.length === 0) return null;
  if (images.length === 1) return <SourceReferencePreview image={images[0]} />;
  return (
    <div className="message-reference-grid" aria-label={`参考图 ${images.length} 张`}>
      {images.map((image, index) => (
        <SourceReferencePreview key={`${image.id}-${index}`} image={image} label={`参考图 ${index + 1}`} />
      ))}
    </div>
  );
}

function SourceReferencePreview({ image, label = "参考图" }: { image: PublicSourceImage; label?: string }) {
  return (
    <div className="message-reference-card">
      <img src={image.url} alt={image.originalName ?? label} />
      <div>
        <span>{label}</span>
        <small>{image.originalName ?? image.mimeType ?? "上传图片"}</small>
      </div>
    </div>
  );
}

function ImageLightbox({ image, onClose }: { image: PublicImage; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="image-lightbox-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="image-lightbox" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button ghost image-lightbox-close" type="button" onClick={onClose} aria-label="关闭大图">
          <X size={18} aria-hidden="true" />
        </button>
        <img src={image.url} alt={image.prompt} />
      </div>
    </div>
  );
}

function displayMessageContent(content: string): string {
  if (!content.startsWith("生成失败：")) {
    return content;
  }

  return `生成失败：${compactErrorMessage(content.replace(/^生成失败：\s*/, ""))}`;
}

function compactErrorMessage(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  if (value.includes("524") || /timeout occurred/i.test(value)) {
    return "模型接口超时（524）：上游生成服务响应太慢，请稍后重试，或在管理员后台降低并发请求数。";
  }

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}
