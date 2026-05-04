import casesData from "../data/external/awesome-gpt-image-2-cases.json";

const upstreamRepo = "https://github.com/freestylefly/awesome-gpt-image-2";
const upstreamRawImageBase = "https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main/data";

export interface AwesomeCaseItem {
  id: number;
  title: string;
  imageUrl: string;
  imageAlt: string;
  sourceLabel: string;
  sourceUrl: string | null;
  prompt: string;
  promptZh: string;
  promptPreview: string;
  promptPreviewZh: string;
  category: string;
  styles: string[];
  scenes: string[];
  featured: boolean;
  githubUrl: string;
}

export interface AwesomeCaseLibrary {
  repository: string;
  totalCases: number;
  categories: string[];
  styles: string[];
  scenes: string[];
  cases: AwesomeCaseItem[];
}

export interface ListAwesomeCasesInput {
  query?: string | null;
  category?: string | null;
  style?: string | null;
  scene?: string | null;
  page?: number;
  pageSize?: number;
}

export interface ListAwesomeCasesResult {
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

interface RawAwesomeCaseItem {
  id: number;
  title: string;
  image: string;
  imageAlt: string;
  sourceLabel: string;
  sourceUrl?: string | null;
  prompt: string;
  promptPreview: string;
  category: string;
  styles: string[];
  scenes: string[];
  featured?: boolean;
  githubUrl: string;
}

interface RawAwesomeCaseLibrary {
  repository: string;
  totalCases: number;
  categories: string[];
  styles: string[];
  scenes: string[];
  cases: RawAwesomeCaseItem[];
}

function normalizeRemoteImageUrl(value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `${upstreamRawImageBase}${value.startsWith("/") ? value : `/${value}`}`;
}

const categoryPromptLabels: Record<string, string> = {
  "Architecture & Spaces": "建筑空间效果图",
  "Brand & Logos": "品牌视觉图",
  "Characters & People": "人物角色图",
  "Charts & Infographics": "信息图",
  "Documents & Publishing": "文档出版物设计图",
  "History & Classical Themes": "历史古风主题图",
  "Illustration & Art": "插画艺术图",
  "Other Use Cases": "创意应用图",
  "Photography & Realism": "写实摄影图",
  "Posters & Typography": "海报排版图",
  "Products & E-commerce": "电商商品图",
  "Scenes & Storytelling": "叙事场景图",
  "UI & Interfaces": "UI 界面截图",
};

const stylePromptLabels: Record<string, string> = {
  "3D": "3D 质感",
  Architecture: "建筑空间",
  Brand: "品牌感",
  Character: "人物角色",
  Characters: "人物角色",
  Charts: "图表信息",
  Classical: "古典气质",
  Documents: "文档出版",
  History: "历史感",
  Illustration: "插画感",
  Infographic: "信息图",
  "Other Use Cases": "创意应用",
  Photography: "摄影感",
  Poster: "海报感",
  Product: "产品感",
  Products: "商品感",
  Realistic: "真实写实",
  Scenes: "场景叙事",
  UI: "界面设计",
};

const scenePromptLabels: Record<string, string> = {
  Commerce: "商业转化",
  Creative: "创意表达",
  Education: "教育讲解",
  Fashion: "时尚穿搭",
  Food: "食品饮品",
  History: "历史文化",
  Social: "社媒传播",
  Story: "故事叙事",
  Tech: "科技产品",
  Travel: "旅行生活",
};

function joinChineseLabels(values: string[], labels: Record<string, string>): string {
  return values.map((value) => labels[value] ?? value).join("、") || "通用";
}

function inferChinesePrompt(item: RawAwesomeCaseItem): string {
  const imageType = categoryPromptLabels[item.category] ?? "AI 图片";
  const styles = joinChineseLabels(item.styles, stylePromptLabels);
  const scenes = joinChineseLabels(item.scenes, scenePromptLabels);

  return [
    `生成一张「${item.title}」风格的${imageType}。`,
    `画面方向：参考案例 #${item.id} 的视觉结构、镜头语言、构图层次和完成度，但不要直接复刻原图。`,
    `风格关键词：${styles}。`,
    `适用场景：${scenes}。`,
    "画面要求：主体明确，构图稳定，光影自然，材质和细节清晰，整体具备可直接用于内容生产的商业完成度。",
    "输出要求：高清、干净、真实可信；如果需要文字，只保留短标题或关键标签，避免乱码、低清晰度、主体变形、过度装饰和版权/IP 指向。",
  ].join("");
}

function preview(value: string): string {
  return value.length > 120 ? `${value.slice(0, 120)}...` : value;
}

const rawCasesData = casesData as RawAwesomeCaseLibrary;

export const awesomeCaseLibrary: AwesomeCaseLibrary = {
  repository: rawCasesData.repository || upstreamRepo,
  totalCases: rawCasesData.totalCases,
  categories: rawCasesData.categories,
  styles: rawCasesData.styles,
  scenes: rawCasesData.scenes,
  cases: rawCasesData.cases.map((item) => ({
    id: item.id,
    title: item.title,
    imageUrl: normalizeRemoteImageUrl(item.image),
    imageAlt: item.imageAlt || item.title,
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl ?? null,
    prompt: item.prompt,
    promptZh: inferChinesePrompt(item),
    promptPreview: item.promptPreview,
    promptPreviewZh: preview(inferChinesePrompt(item)),
    category: item.category,
    styles: item.styles,
    scenes: item.scenes,
    featured: item.featured ?? false,
    githubUrl: item.githubUrl,
  })),
};

export function listAwesomeCases(input: ListAwesomeCasesInput = {}): ListAwesomeCasesResult {
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const pageSize = Math.min(60, Math.max(6, Math.trunc(input.pageSize ?? 12)));
  const query = input.query?.trim().toLowerCase() ?? "";
  const category = input.category?.trim() ?? "";
  const style = input.style?.trim() ?? "";
  const scene = input.scene?.trim() ?? "";

  const filtered = awesomeCaseLibrary.cases.filter((item) => {
    const matchesQuery =
      !query ||
      `${item.id} ${item.title} ${item.category} ${item.prompt} ${item.sourceLabel} ${item.styles.join(" ")} ${item.scenes.join(" ")}`
        .toLowerCase()
        .includes(query);
    const matchesCategory = !category || category === "all" || item.category === category;
    const matchesStyle = !style || style === "all" || item.styles.includes(style);
    const matchesScene = !scene || scene === "all" || item.scenes.includes(scene);
    return matchesQuery && matchesCategory && matchesStyle && matchesScene;
  });

  const start = (page - 1) * pageSize;

  return {
    repository: awesomeCaseLibrary.repository,
    categories: awesomeCaseLibrary.categories,
    styles: awesomeCaseLibrary.styles,
    scenes: awesomeCaseLibrary.scenes,
    totalCases: awesomeCaseLibrary.totalCases,
    filteredCount: filtered.length,
    page,
    pageSize,
    cases: filtered.slice(start, start + pageSize),
  };
}

export function awesomeCaseToTemplateDraft(caseItem: AwesomeCaseItem): {
  name: string;
  description: string;
  defaultPrompt: string;
  defaultNegativePrompt: string | null;
} {
  return {
    name: caseItem.title.slice(0, 80),
    description: `从 awesome-gpt-image-2 案例 #${caseItem.id} 导入。建议仅作结构参考，商业使用前请改写并替换为自有示例图。`,
    defaultPrompt: caseItem.promptZh,
    defaultNegativePrompt: null,
  };
}
