/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  ListChecks,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import type { AwesomeCaseItem } from "@/lib/awesome-case-library";
import { imageSizeLabels } from "@/lib/image-options";
import type { CurrentUser, PublicTemplate, TemplateCategory, TemplateScope } from "@/lib/types";
import {
  inspirationScenes,
  templateInspirations,
  type InspirationScene,
  type PromptBreakdown,
  type TemplateInspiration,
} from "@/lib/template-inspirations";
import { apiJson } from "@/components/client-api";

interface TemplateResponse {
  template: PublicTemplate;
}

interface MeResponse {
  user: CurrentUser | null;
}

interface InspirationCasesResponse {
  repository: string;
  categories: string[];
  styles: string[];
  scenes: string[];
  totalCases: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  cases: AwesomeCaseItem[];
}

const upstreamCategoryLabels: Record<string, string> = {
  "Architecture & Spaces": "建筑与空间",
  "Brand & Logos": "品牌视觉",
  "Characters & People": "人物与角色",
  "Charts & Infographics": "信息图",
  "Documents & Publishing": "文档出版",
  "History & Classical Themes": "历史古风",
  "Illustration & Art": "插画艺术",
  "Other Use Cases": "其他场景",
  "Photography & Realism": "人像摄影",
  "Posters & Typography": "封面海报",
  "Products & E-commerce": "电商商品图",
  "Scenes & Storytelling": "叙事场景",
  "UI & Interfaces": "UI 截图",
};

const upstreamTagLabels: Record<string, string> = {
  "3D": "3D",
  Architecture: "建筑",
  Brand: "品牌",
  Character: "角色",
  Characters: "人物",
  Charts: "图表",
  Classical: "古典",
  Commerce: "商业",
  Creative: "创意",
  Documents: "文档",
  Education: "教育",
  Fashion: "时尚",
  Food: "食品饮品",
  History: "历史",
  Illustration: "插画",
  Infographic: "信息图",
  Photography: "摄影",
  Poster: "海报",
  Product: "产品",
  Products: "商品",
  Realistic: "写实",
  Scenes: "场景",
  Social: "社媒",
  Story: "叙事",
  Tech: "科技",
  Travel: "旅行",
  UI: "UI",
};

function upstreamLabel(value: string): string {
  return upstreamCategoryLabels[value] ?? upstreamTagLabels[value] ?? value;
}

function breakdownRows(breakdown: PromptBreakdown): Array<{ label: string; value: string }> {
  return [
    { label: "画面类型", value: breakdown.imageType },
    { label: "主体", value: breakdown.subject },
    { label: "场景", value: breakdown.scene },
    { label: "构图", value: breakdown.composition },
    { label: "光影", value: breakdown.lighting },
    { label: "材质", value: breakdown.material },
    { label: "文案", value: breakdown.copywriting },
    { label: "比例", value: breakdown.ratio },
  ];
}

function caseDefaultSize(caseItem: AwesomeCaseItem): string {
  if (caseItem.category === "Products & E-commerce") {
    return "ecommerce_main_1_1";
  }
  if (caseItem.category === "Posters & Typography") {
    return "poster_2_3";
  }
  if (caseItem.category === "UI & Interfaces" || caseItem.scenes.includes("Social")) {
    return "douyin_cover_9_16";
  }
  if (caseItem.category === "Photography & Realism" || caseItem.category === "Characters & People") {
    return "douyin_cover_9_16";
  }
  if (caseItem.category === "Charts & Infographics" || caseItem.category === "Documents & Publishing") {
    return "poster_2_3";
  }
  return "auto";
}

function caseTemplateCategory(caseItem: AwesomeCaseItem): TemplateCategory {
  if (caseItem.category === "Products & E-commerce" || caseItem.category === "Brand & Logos") {
    return "company";
  }
  if (caseItem.category === "UI & Interfaces" || caseItem.category === "Posters & Typography") {
    return "platform";
  }
  return "use_case";
}

export function CasesClient() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeScope, setActiveScope] = useState<TemplateScope>("user");
  const [activeTab, setActiveTab] = useState<"effects" | "inspirations">("effects");
  const [activeInspirationScene, setActiveInspirationScene] = useState<InspirationScene | "all">("all");
  const [caseLibrary, setCaseLibrary] = useState<InspirationCasesResponse | null>(null);
  const [caseQuery, setCaseQuery] = useState("");
  const [caseCategory, setCaseCategory] = useState("all");
  const [caseStyle, setCaseStyle] = useState("all");
  const [caseScene, setCaseScene] = useState("all");
  const [casePage, setCasePage] = useState(1);
  const [caseLoading, setCaseLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleInspirations = useMemo(
    () =>
      activeInspirationScene === "all"
        ? templateInspirations
        : templateInspirations.filter((inspiration) => inspiration.sceneCategory === activeInspirationScene),
    [activeInspirationScene],
  );
  const canCreateInActiveScope = activeScope === "user" || currentUser?.role === "admin";

  const loadCaseLibrary = useCallback(async (nextPage: number): Promise<void> => {
    setCaseLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "12",
      });
      if (caseQuery.trim()) {
        params.set("q", caseQuery.trim());
      }
      if (caseCategory !== "all") {
        params.set("category", caseCategory);
      }
      if (caseStyle !== "all") {
        params.set("style", caseStyle);
      }
      if (caseScene !== "all") {
        params.set("scene", caseScene);
      }
      const payload = await apiJson<InspirationCasesResponse>(`/api/inspiration-cases?${params.toString()}`);
      setCaseLibrary(payload);
      setCasePage(payload.page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "案例库加载失败");
    } finally {
      setCaseLoading(false);
    }
  }, [caseCategory, caseQuery, caseScene, caseStyle]);

  useEffect(() => {
    apiJson<MeResponse>("/api/auth/me")
      .then((payload) => {
        setCurrentUser(payload.user);
        setActiveScope(payload.user?.role === "admin" ? "platform" : "user");
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCaseLibrary(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [loadCaseLibrary]);

  async function createTemplateFromInspiration(inspiration: TemplateInspiration): Promise<void> {
    if (activeScope === "platform" && currentUser?.role !== "admin") {
      setError("只有管理员可以导入平台模板。");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = await apiJson<TemplateResponse>("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          scope: activeScope,
          name: inspiration.draft.name,
          category: inspiration.category,
          description: `${inspiration.draft.description} 来源：${inspiration.sourceName}`,
          defaultPrompt: inspiration.draft.defaultPrompt,
          defaultNegativePrompt: inspiration.draft.defaultNegativePrompt,
          defaultSize: inspiration.defaultSize,
          defaultReferenceStrength: inspiration.draft.defaultReferenceStrength,
          defaultStyleStrength: inspiration.draft.defaultStyleStrength,
          sourceImageId: null,
          templateVariables: inspiration.draft.templateVariables,
        }),
      });
      setMessage(`已导入「${payload.template.name}」，可在工作台直接使用。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入模板失败");
    } finally {
      setSaving(false);
    }
  }

  async function createTemplateFromCase(caseItem: AwesomeCaseItem): Promise<void> {
    if (activeScope === "platform" && currentUser?.role !== "admin") {
      setError("只有管理员可以导入平台模板。");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = await apiJson<TemplateResponse>("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          scope: activeScope,
          name: caseItem.title.slice(0, 80),
          category: caseTemplateCategory(caseItem),
          description: `从 awesome-gpt-image-2 案例 #${caseItem.id} 导入，已转写为中文生产提示词。建议商业使用前替换为自有示例图。`,
          defaultPrompt: caseItem.promptZh,
          defaultNegativePrompt: null,
          defaultSize: caseDefaultSize(caseItem),
          defaultReferenceStrength: 0.58,
          defaultStyleStrength: 0.72,
          sourceImageId: null,
          templateVariables: [],
        }),
      });
      setMessage(`已导入案例 #${caseItem.id}「${payload.template.name}」。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导入案例失败");
    } finally {
      setSaving(false);
    }
  }

  async function copyCasePrompt(caseItem: AwesomeCaseItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(caseItem.promptZh);
      setMessage(`已复制案例 #${caseItem.id} 的中文提示词。`);
      setError("");
    } catch {
      setError("复制失败，请手动选中文本复制。");
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>案例中心</h1>
          <p>先看效果，再理解方法，最后一键沉淀成可复用模板。</p>
        </div>
        <div className="template-toolbar compact">
          <button
            className={clsx("button", activeScope === "platform" && "subtle")}
            type="button"
            disabled={currentUser?.role !== "admin"}
            onClick={() => setActiveScope("platform")}
          >
            导入为平台模板
          </button>
          <button
            className={clsx("button", activeScope === "user" && "subtle")}
            type="button"
            onClick={() => setActiveScope("user")}
          >
            导入为用户模板
          </button>
        </div>
      </section>

      <section className="panel case-center-tabs">
        <div className="panel-body">
          <div className="segmented two">
            <button className={clsx(activeTab === "effects" && "active")} type="button" onClick={() => setActiveTab("effects")}>
              效果库
            </button>
            <button className={clsx(activeTab === "inspirations" && "active")} type="button" onClick={() => setActiveTab("inspirations")}>
              灵感库
            </button>
          </div>
          <div className={clsx("toast-line", error && "error")} role="status" aria-live="polite">
            {error || message}
          </div>
        </div>
      </section>

      {activeTab === "effects" ? (
        <section className="panel source-case-panel">
          <div className="panel-header">
            <div>
              <h2>完整案例效果库</h2>
              <p>同步 awesome-gpt-image-2 的全量案例。默认显示中文生产提示词，原文保留用于溯源。</p>
            </div>
            <span className="badge">
              <ImageIcon size={13} aria-hidden="true" />
              {caseLibrary ? `${caseLibrary.totalCases} 个案例` : "加载中"}
            </span>
          </div>
          <div className="panel-body source-case-body">
            <div className="case-filter-grid">
              <label className="field case-search-field" htmlFor="caseSearch">
                <span>搜索案例</span>
                <div className="input-with-icon">
                  <Search size={16} aria-hidden="true" />
                  <input
                    id="caseSearch"
                    className="input"
                    value={caseQuery}
                    onChange={(event) => setCaseQuery(event.target.value)}
                    placeholder="搜索标题、提示词、来源..."
                  />
                </div>
              </label>
              <label className="field" htmlFor="caseCategory">
                <span>分类</span>
                <select id="caseCategory" className="select" value={caseCategory} onChange={(event) => setCaseCategory(event.target.value)}>
                  <option value="all">全部分类</option>
                  {caseLibrary?.categories.map((item) => (
                    <option key={item} value={item}>{upstreamLabel(item)}</option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor="caseStyle">
                <span>风格</span>
                <select id="caseStyle" className="select" value={caseStyle} onChange={(event) => setCaseStyle(event.target.value)}>
                  <option value="all">全部风格</option>
                  {caseLibrary?.styles.map((item) => (
                    <option key={item} value={item}>{upstreamLabel(item)}</option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor="caseScene">
                <span>场景</span>
                <select id="caseScene" className="select" value={caseScene} onChange={(event) => setCaseScene(event.target.value)}>
                  <option value="all">全部场景</option>
                  {caseLibrary?.scenes.map((item) => (
                    <option key={item} value={item}>{upstreamLabel(item)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="case-result-bar">
              <span>{caseLoading ? "正在加载案例..." : `匹配 ${caseLibrary?.filteredCount ?? 0} / ${caseLibrary?.totalCases ?? 0} 个案例`}</span>
              <span>源图只作效果预览；批量生成自有示例图后可替换。</span>
            </div>

            <div className="source-case-grid">
              {caseLibrary?.cases.map((caseItem) => (
                <article className="source-case-card" key={caseItem.id}>
                  <a className="source-case-image" href={caseItem.githubUrl} target="_blank" rel="noreferrer">
                    <img src={caseItem.imageUrl} alt={caseItem.imageAlt} loading="lazy" />
                    <span>源项目效果图</span>
                  </a>
                  <div className="source-case-content">
                    <div className="queue-item-top">
                      <span className="badge">#{caseItem.id}</span>
                      <span className="badge">{upstreamLabel(caseItem.category)}</span>
                    </div>
                    <h3>{caseItem.title}</h3>
                    <p>{caseItem.promptPreviewZh}</p>
                    <div className="case-tag-row">
                      {[...caseItem.styles, ...caseItem.scenes].slice(0, 5).map((tag) => (
                        <span key={`${caseItem.id}-${tag}`}>{upstreamLabel(tag)}</span>
                      ))}
                    </div>
                    <details className="prompt-breakdown compact">
                      <summary>
                        <ListChecks size={14} aria-hidden="true" />
                        查看中文提示词
                      </summary>
                      <p className="case-prompt-text">{caseItem.promptZh}</p>
                    </details>
                    <details className="prompt-breakdown compact">
                      <summary>
                        <ExternalLink size={14} aria-hidden="true" />
                        原始英文提示词
                      </summary>
                      <p className="case-prompt-text">{caseItem.prompt}</p>
                    </details>
                    <div className="card-actions">
                      <button className="button subtle" type="button" disabled={saving || !canCreateInActiveScope} onClick={() => void createTemplateFromCase(caseItem)}>
                        <Plus size={15} aria-hidden="true" />
                        导入模板
                      </button>
                      <button className="button" type="button" onClick={() => void copyCasePrompt(caseItem)}>
                        <Copy size={15} aria-hidden="true" />
                        复制中文
                      </button>
                      <a className="button" href={caseItem.githubUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} aria-hidden="true" />
                        来源
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="case-pagination">
              <button className="button" type="button" disabled={caseLoading || casePage <= 1} onClick={() => void loadCaseLibrary(casePage - 1)}>
                <ChevronLeft size={15} aria-hidden="true" />
                上一页
              </button>
              <span>
                第 {casePage} / {Math.max(1, Math.ceil((caseLibrary?.filteredCount ?? 0) / (caseLibrary?.pageSize ?? 12)))} 页
              </span>
              <button
                className="button"
                type="button"
                disabled={caseLoading || casePage >= Math.ceil((caseLibrary?.filteredCount ?? 0) / (caseLibrary?.pageSize ?? 12))}
                onClick={() => void loadCaseLibrary(casePage + 1)}
              >
                下一页
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="panel inspiration-panel">
          <div className="panel-header">
            <div>
              <h2>案例灵感库</h2>
              <p>精选场景方法论，重点看效果方向、提示词拆解和反向避坑。</p>
            </div>
            <span className="badge">
              <Sparkles size={13} aria-hidden="true" />
              提示词工程
            </span>
          </div>
          <div className="panel-body inspiration-body">
            <div className="inspiration-tabs" aria-label="案例场景">
              <button className={clsx("scene-pill", activeInspirationScene === "all" && "active")} type="button" onClick={() => setActiveInspirationScene("all")}>
                全部
              </button>
              {inspirationScenes.map((scene) => (
                <button className={clsx("scene-pill", activeInspirationScene === scene && "active")} type="button" key={scene} onClick={() => setActiveInspirationScene(scene)}>
                  {scene}
                </button>
              ))}
            </div>
            <div className="inspiration-grid">
              {visibleInspirations.map((inspiration) => (
                <article className="inspiration-card" key={inspiration.id}>
                  <div className="queue-item-top">
                    <span className="badge">{inspiration.sceneCategory}</span>
                    <span className="badge">{imageSizeLabels[inspiration.defaultSize as keyof typeof imageSizeLabels] ?? inspiration.defaultSize}</span>
                  </div>
                  <h3>{inspiration.title}</h3>
                  <p>{inspiration.description}</p>
                  <div className="effect-direction">
                    <strong>效果方向</strong>
                    <span>{inspiration.effectDirection}</span>
                  </div>
                  <details className="prompt-breakdown">
                    <summary>
                      <ListChecks size={14} aria-hidden="true" />
                      提示词拆解器
                    </summary>
                    <div className="breakdown-grid">
                      {breakdownRows(inspiration.breakdown).map((row) => (
                        <div className="breakdown-row" key={`${inspiration.id}-${row.label}`}>
                          <span>{row.label}</span>
                          <strong>{row.value}</strong>
                        </div>
                      ))}
                      <div className="breakdown-row wide">
                        <span>反向避坑</span>
                        <strong>{inspiration.breakdown.pitfalls.join(" / ")}</strong>
                      </div>
                    </div>
                  </details>
                  <small>{inspiration.insight}</small>
                  <div className="card-actions">
                    <button className="button subtle" type="button" onClick={() => void createTemplateFromInspiration(inspiration)} disabled={saving || !canCreateInActiveScope}>
                      <Plus size={15} aria-hidden="true" />
                      导入模板
                    </button>
                    <a className="button" href={inspiration.sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={15} aria-hidden="true" />
                      来源
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
