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
  promptPreview: string;
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
    promptPreview: item.promptPreview,
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
    defaultPrompt: caseItem.prompt,
    defaultNegativePrompt: null,
  };
}
