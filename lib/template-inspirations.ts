import type { TemplateCategory, TemplateVariableDefinition } from "./types";

export const inspirationScenes = [
  "电商商品图",
  "封面海报",
  "小红书图文",
  "公众号封面",
  "信息图",
  "品牌视觉",
  "人像摄影",
  "直播截图",
  "UI 截图",
] as const;

export type InspirationScene = (typeof inspirationScenes)[number];

export interface PromptBreakdown {
  imageType: string;
  subject: string;
  scene: string;
  composition: string;
  lighting: string;
  material: string;
  copywriting: string;
  ratio: string;
  pitfalls: string[];
}

export interface TemplateInspiration {
  id: string;
  sceneCategory: InspirationScene;
  title: string;
  sourceName: string;
  sourceUrl: string;
  category: TemplateCategory;
  defaultSize: string;
  description: string;
  effectDirection: string;
  insight: string;
  breakdown: PromptBreakdown;
  draft: {
    name: string;
    description: string;
    defaultPrompt: string;
    defaultNegativePrompt: string;
    defaultReferenceStrength: number;
    defaultStyleStrength: number;
    templateVariables: TemplateVariableDefinition[];
  };
}

function textVariable(
  key: string,
  label: string,
  options: Partial<TemplateVariableDefinition> = {},
): TemplateVariableDefinition {
  return {
    key,
    label,
    type: options.type ?? "text",
    required: options.required ?? false,
    placeholder: options.placeholder ?? null,
    defaultValue: options.defaultValue ?? null,
    helperText: options.helperText ?? null,
    options: options.options ?? [],
  };
}

const commonNoTextPitfall = "不要生成无意义乱码、密集小字或抢主体的装饰文字";

export const templateInspirations: TemplateInspiration[] = [
  {
    id: "awesome-gpt-image-2-ecommerce-hero",
    sceneCategory: "电商商品图",
    title: "商品英雄主图",
    sourceName: "awesome-gpt-image-2 / Products & E-commerce",
    sourceUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/templates.md#%E5%95%86%E5%93%81%E4%B8%8E%E7%94%B5%E5%95%86",
    category: "platform",
    defaultSize: "ecommerce_main_1_1",
    description: "适合主图、货架图和商品场景图，优先控制产品占比、边缘完整、材质和阴影。",
    effectDirection: "干净棚拍、强主体、可直接进电商货架的商业产品图。",
    insight: "先锁产品轮廓和材质，再补卖点与场景，能显著减少产品变形和背景杂乱。",
    breakdown: {
      imageType: "电商主图 / 商品英雄图",
      subject: "单个商品作为唯一视觉中心",
      scene: "纯白棚拍、浅灰展台或轻生活方式场景",
      composition: "产品占画面 70%-80%，四周保留安全边距，真实接触阴影",
      lighting: "大面积柔光 + 侧向轮廓光，突出边缘和高级感",
      material: "按商品指定金属、玻璃、织物、塑料、皮革等可见纹理",
      copywriting: "默认无文字；需要时只保留 1-2 个卖点标签",
      ratio: "1:1 优先，也可扩展 3:4 商品竖图",
      pitfalls: ["产品边缘缺失", "背景道具抢主体", "廉价促销贴满画面", commonNoTextPitfall],
    },
    draft: {
      name: "商品英雄主图",
      description: "从 awesome-gpt-image-2 电商案例提炼：主图/商品图通用生产模板。",
      defaultPrompt:
        "生成一张电商商品英雄图。产品名称：{产品名称}。核心卖点：{核心卖点}。场景类型：{场景类型}。镜头角度：{镜头角度}。材质细节：{材质细节}。灯光方案：{灯光方案}。构图要求：产品是唯一视觉中心，占画面 70%-80%，轮廓完整，边缘清晰，真实接触阴影，四周留出电商裁切安全边距。输出要求：高清商业摄影质感，干净可信，可直接用于电商货架浏览。",
      defaultNegativePrompt: "产品变形，边缘缺失，杂乱背景，低清晰度，文字乱码，廉价促销风，主体过小",
      defaultReferenceStrength: 0.72,
      defaultStyleStrength: 0.64,
      templateVariables: [
        textVariable("产品名称", "产品名称", { required: true, placeholder: "例如：桌面空气净化器" }),
        textVariable("核心卖点", "核心卖点", { type: "textarea", placeholder: "例如：低噪音、可视化滤芯、金属质感" }),
        textVariable("场景类型", "场景类型", {
          type: "select",
          defaultValue: "纯色棚拍",
          options: [
            { label: "纯色棚拍", value: "纯色棚拍" },
            { label: "生活方式场景", value: "生活方式场景" },
            { label: "高级展台空间", value: "高级展台空间" },
          ],
        }),
        textVariable("镜头角度", "镜头角度", { placeholder: "例如：正面、3/4 角度、局部特写" }),
        textVariable("材质细节", "材质细节", { placeholder: "例如：磨砂金属、透明亚克力、织物纹理" }),
        textVariable("灯光方案", "灯光方案", { placeholder: "例如：柔光棚拍、侧光、轮廓光" }),
      ],
    },
  },
  {
    id: "awesome-gpt-image-2-campaign-poster",
    sceneCategory: "封面海报",
    title: "活动 Campaign 海报",
    sourceName: "awesome-gpt-image-2 / Posters & Typography",
    sourceUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/templates.md#%E6%B5%B7%E6%8A%A5%E4%B8%8E%E6%8E%92%E7%89%88",
    category: "use_case",
    defaultSize: "poster_2_3",
    description: "适合活动海报、品牌主题海报和视觉主张图，让标题和主体成为同一个构图系统。",
    effectDirection: "标题醒目、主体强、适合社媒传播和活动预热的完成稿。",
    insight: "海报最怕背景图加字；要先定义标题、主体和视觉隐喻之间的关系。",
    breakdown: {
      imageType: "活动海报 / 商业 Campaign",
      subject: "人物、产品或符号化主体",
      scene: "品牌化场景、运动空间、城市背景或抽象舞台",
      composition: "单主视觉、对角构图、三联画或标题主导式构图",
      lighting: "强对比商业光、舞台光或电影感轮廓光",
      material: "纸张颗粒、反光地面、金属道具、布料或烟雾质感",
      copywriting: "主标题必须明确；副标题只保留短句",
      ratio: "2:3 或 4:5 竖版传播优先",
      pitfalls: ["标题不可读", "多方案拼贴", "主体和标题互相抢焦点", commonNoTextPitfall],
    },
    draft: {
      name: "活动 Campaign 海报",
      description: "从 awesome-gpt-image-2 海报案例提炼：活动/产品/品牌传播海报模板。",
      defaultPrompt:
        "设计一张活动 Campaign 海报。活动主题：{活动主题}。主标题：{主标题}。副标题：{副标题}。主视觉主体：{主视觉主体}。视觉隐喻：{视觉隐喻}。版式结构：{版式结构}。色彩系统：{色彩系统}。构图要求：主体和标题形成一个整体视觉结构，标题巨大清晰，主视觉与文字发生遮挡、穿插、承托或投影关系，画面层级强，留白聪明。输出要求：单张完成海报，高级商业视觉，适合社媒传播。",
      defaultNegativePrompt: "标题乱码，默认字效，杂乱拼贴，moodboard，多方案展示，廉价促销风",
      defaultReferenceStrength: 0.5,
      defaultStyleStrength: 0.82,
      templateVariables: [
        textVariable("活动主题", "活动主题", { required: true, placeholder: "例如：夏日新品发布会" }),
        textVariable("主标题", "主标题", { required: true, placeholder: "例如：SUMMER DROP" }),
        textVariable("副标题", "副标题", { placeholder: "例如：限时发布 / 轻盈登场" }),
        textVariable("主视觉主体", "主视觉主体", { placeholder: "例如：模特、运动鞋、饮品、抽象光束" }),
        textVariable("视觉隐喻", "视觉隐喻", { placeholder: "例如：光束穿过字形、人物从标题中走出" }),
        textVariable("版式结构", "版式结构", {
          type: "select",
          defaultValue: "单主视觉强海报",
          options: [
            { label: "单主视觉强海报", value: "单主视觉强海报" },
            { label: "对角构图", value: "对角构图" },
            { label: "标题主导构图", value: "标题主导构图" },
          ],
        }),
        textVariable("色彩系统", "色彩系统", { placeholder: "例如：石墨黑、银灰、冷蓝强调色" }),
      ],
    },
  },
  {
    id: "awesome-gpt-image-2-xhs-card",
    sceneCategory: "小红书图文",
    title: "小红书首图卡片",
    sourceName: "awesome-gpt-image-2 / Social cover cases",
    sourceUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/gallery-part-2.md#case-235",
    category: "platform",
    defaultSize: "xhs_cover_3_4",
    description: "适合小红书首图、知识卡片和种草封面，强调标题点击点、统一配色和留白。",
    effectDirection: "信息流里能停住手指的图文首图，干净但有明确点击理由。",
    insight: "先锁首图卖点，再控制标题字数和图文区域，避免变成密集 PPT。",
    breakdown: {
      imageType: "小红书图文首图 / 知识卡片",
      subject: "大标题 + 1 个情绪化或功能性配图元素",
      scene: "生活方式、小清新桌面、知识卡片或轻插画场景",
      composition: "标题在上方或居中，图像元素辅助理解，边缘留安全区",
      lighting: "柔和自然光或轻柔棚拍光",
      material: "纸张、贴纸、轻插画、实物小道具、浅色背景纹理",
      copywriting: "大标题 6-14 字，副标题一行以内",
      ratio: "3:4 竖版首图",
      pitfalls: ["字太多", "标题贴边", "元素过度可爱导致低端", commonNoTextPitfall],
    },
    draft: {
      name: "小红书首图卡片",
      description: "从 awesome-gpt-image-2 社媒案例提炼：小红书首图/知识卡片模板。",
      defaultPrompt:
        "生成一张小红书图文首图，3:4 竖版。内容主题：{内容主题}。大标题：{大标题}。副标题：{副标题}。配图元素：{配图元素}。配色风格：{配色风格}。视觉语气：{视觉语气}。构图要求：标题醒目但不贴边，主体与标题互不遮挡，留白舒服，信息层级清晰。输出要求：新媒体运营审美，干净高级，适合信息流点击，中文文字少而可读。",
      defaultNegativePrompt: "文字乱码，标题贴边，排版拥挤，低质感，过度花哨，廉价营销感",
      defaultReferenceStrength: 0.6,
      defaultStyleStrength: 0.72,
      templateVariables: [
        textVariable("内容主题", "内容主题", { required: true, placeholder: "例如：睡前放松方法" }),
        textVariable("大标题", "大标题", { placeholder: "例如：8 个助眠小习惯" }),
        textVariable("副标题", "副标题", { placeholder: "例如：失眠党建议收藏" }),
        textVariable("配图元素", "配图元素", { placeholder: "例如：枕头、月亮、香薰、书本" }),
        textVariable("配色风格", "配色风格", { placeholder: "例如：奶油白、浅米色、浅焦糖" }),
        textVariable("视觉语气", "视觉语气", { placeholder: "例如：温柔、松弛、理性、干货感" }),
      ],
    },
  },
  {
    id: "awesome-gpt-image-2-wechat-header",
    sceneCategory: "公众号封面",
    title: "公众号横版首图",
    sourceName: "awesome-gpt-image-2 / Editorial cover case",
    sourceUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/gallery-part-2.md#case-175",
    category: "platform",
    defaultSize: "wechat_cover_235_1",
    description: "适合公众号文章首图、横版专栏封面、知识流封面，强调标题安全区和编辑感。",
    effectDirection: "横版高级封面，适合信息流裁切后仍保留主题和阅读欲。",
    insight: "公众号封面不是塞文字，而是预留标题区、主视觉区和裁切安全区。",
    breakdown: {
      imageType: "公众号横版封面 / 文章首图",
      subject: "文章主题对应的抽象视觉、产品轮廓或人物剪影",
      scene: "办公空间、科技展台、抽象光影、城市/自然隐喻",
      composition: "2.35:1 横版，不对称布局，一侧主视觉，一侧标题安全区",
      lighting: "克制柔光、渐变光束或高级展厅光",
      material: "玻璃、纸张、屏幕、金属、轻雾、浅色空间",
      copywriting: "标题可留空，若生成文字只保留主标题和极短副标题",
      ratio: "2.35:1 横版",
      pitfalls: ["标题区不干净", "主体贴边", "内容像 PPT 封面", commonNoTextPitfall],
    },
    draft: {
      name: "公众号横版首图",
      description: "从 awesome-gpt-image-2 封面案例提炼：公众号/横版封面图模板。",
      defaultPrompt:
        "生成一张公众号文章首图，横版构图，比例约 2.35:1。文章主题：{文章主题}。标题文案：{标题文案}。主视觉：{主视觉}。品牌风格：{品牌风格}。背景风格：{背景风格}。构图要求：不对称编辑式布局，主视觉靠左或靠右，另一侧留出干净标题安全区，强留白，边缘留足裁切安全边距。输出要求：专业、克制、高级信息流封面感，文字少而清晰。",
      defaultNegativePrompt: "密集文字，低清晰度，廉价模板感，画面拥挤，标题贴边，无意义小字",
      defaultReferenceStrength: 0.55,
      defaultStyleStrength: 0.68,
      templateVariables: [
        textVariable("文章主题", "文章主题", { required: true, placeholder: "例如：AI 图片工作流升级指南" }),
        textVariable("标题文案", "标题文案", { placeholder: "可留空，后期手动加字" }),
        textVariable("主视觉", "主视觉", { placeholder: "例如：抽象光束、产品轮廓、办公桌面" }),
        textVariable("品牌风格", "品牌风格", { placeholder: "例如：理性科技、克制商业、知识感" }),
        textVariable("背景风格", "背景风格", { placeholder: "例如：浅灰空间、极简展台、柔和光影" }),
      ],
    },
  },
  {
    id: "awesome-gpt-image-2-infographic",
    sceneCategory: "信息图",
    title: "结构化信息图",
    sourceName: "awesome-gpt-image-2 / Charts & Infographics",
    sourceUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/templates.md#%E5%9B%BE%E8%A1%A8%E4%B8%8E%E4%BF%A1%E6%81%AF%E5%8F%AF%E8%A7%86%E5%8C%96",
    category: "use_case",
    defaultSize: "poster_2_3",
    description: "适合知识图谱、流程图、报告封面和产品解释图，把信息拆成模块而不是堆正文。",
    effectDirection: "标题清楚、模块明确、适合讲概念和解释复杂流程的信息图。",
    insight: "信息图要先定模块数量和图表类型，文案越克制越稳定。",
    breakdown: {
      imageType: "信息图 / 流程图 / 解释型图表",
      subject: "一个主题 + 3-5 个结构化模块",
      scene: "报告式白底、科技知识卡片、科普插画或工程蓝图",
      composition: "标题区 + 模块区 + 箭头/编号/图标系统",
      lighting: "以平面设计为主，可用轻微纸张或屏幕质感",
      material: "细线图标、浅色网格、纸张纹理、低饱和色块",
      copywriting: "短标题 + 1 句说明，不放长段正文",
      ratio: "2:3 竖版或 16:9 横版",
      pitfalls: ["模块太多", "正文过长", "箭头关系混乱", commonNoTextPitfall],
    },
    draft: {
      name: "结构化信息图",
      description: "从 awesome-gpt-image-2 信息可视化案例提炼：信息图/流程图模板。",
      defaultPrompt:
        "生成一张结构化信息图。主题：{主题}。目标读者：{目标读者}。图表类型：{图表类型}。模块数量：{模块数量}。模块内容：{模块内容}。视觉风格：{视觉风格}。构图要求：顶部标题区清晰，中部按模块排布，每个模块包含图标、短标题和 1 句说明，模块之间用箭头、编号或色块建立阅读顺序。输出要求：中文可读，信息层级清楚，适合知识传播和报告展示。",
      defaultNegativePrompt: "信息拥挤，正文过长，箭头混乱，低清晰度，文字乱码，装饰过多",
      defaultReferenceStrength: 0.45,
      defaultStyleStrength: 0.7,
      templateVariables: [
        textVariable("主题", "主题", { required: true, placeholder: "例如：AI 生图工作流" }),
        textVariable("目标读者", "目标读者", { placeholder: "例如：运营团队、设计师、管理层" }),
        textVariable("图表类型", "图表类型", {
          type: "select",
          defaultValue: "流程图",
          options: [
            { label: "流程图", value: "流程图" },
            { label: "对比图", value: "对比图" },
            { label: "关系图", value: "关系图" },
            { label: "时间线", value: "时间线" },
          ],
        }),
        textVariable("模块数量", "模块数量", { defaultValue: "4 个模块", placeholder: "例如：3 个模块 / 5 个模块" }),
        textVariable("模块内容", "模块内容", { type: "textarea", placeholder: "例如：输入、处理、审核、输出" }),
        textVariable("视觉风格", "视觉风格", { placeholder: "例如：专业报告、科普插画、科技白皮书" }),
      ],
    },
  },
  {
    id: "awesome-gpt-image-2-brand-system",
    sceneCategory: "品牌视觉",
    title: "品牌视觉方向板",
    sourceName: "awesome-gpt-image-2 / Brand & Logos",
    sourceUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/templates.md#%E5%93%81%E7%89%8C%E4%B8%8E%E6%A0%87%E5%BF%97",
    category: "company",
    defaultSize: "banner_16_9",
    description: "适合品牌提案、Logo 方向、配色和触点展示，让品牌系统一次成型。",
    effectDirection: "像品牌代理公司提案页一样，展示 Logo、颜色、字体和应用触点。",
    insight: "品牌图不要只画 Logo，要同时给出视觉系统和落地触点，才有复用价值。",
    breakdown: {
      imageType: "品牌视觉方案 / Identity board",
      subject: "品牌名、品牌关键词、Logo 方向和应用触点",
      scene: "品牌提案板、包装展示、名片、App 图标、社媒模板",
      composition: "主 Logo 区 + 色彩系统 + 字体气质 + 3-5 个应用场景",
      lighting: "干净商业棚拍或平面设计展示光",
      material: "纸张、包装、屏幕、金属烫印、织物或卡片质感",
      copywriting: "品牌名必须准确，可保留短 slogan",
      ratio: "16:9 提案页或 1:1 品牌板",
      pitfalls: ["Logo 变形", "品牌名错字", "触点太多导致凌乱", commonNoTextPitfall],
    },
    draft: {
      name: "品牌视觉方向板",
      description: "从 awesome-gpt-image-2 品牌案例提炼：品牌识别/视觉方向模板。",
      defaultPrompt:
        "为品牌生成一张品牌视觉方向板。品牌名称：{品牌名称}。行业：{行业}。品牌关键词：{品牌关键词}。目标受众：{目标受众}。Logo 方向：{Logo 方向}。应用触点：{应用触点}。视觉风格：{视觉风格}。构图要求：画面包含主 Logo 区、配色系统、字体气质、辅助图形和 3-5 个应用触点示意，整体风格统一，像专业品牌提案页。输出要求：品牌名准确，视觉高级，信息层级清晰。",
      defaultNegativePrompt: "品牌名错字，Logo 变形，视觉不统一，应用触点杂乱，低端模板感，文字乱码",
      defaultReferenceStrength: 0.48,
      defaultStyleStrength: 0.76,
      templateVariables: [
        textVariable("品牌名称", "品牌名称", { required: true, placeholder: "例如：Canvas Realm" }),
        textVariable("行业", "行业", { placeholder: "例如：AI 设计工具、咖啡品牌、户外装备" }),
        textVariable("品牌关键词", "品牌关键词", { placeholder: "例如：克制、可信、先进、温暖" }),
        textVariable("目标受众", "目标受众", { placeholder: "例如：独立设计师、小型品牌主、运营团队" }),
        textVariable("Logo 方向", "Logo 方向", {
          type: "select",
          defaultValue: "现代字标",
          options: [
            { label: "现代字标", value: "现代字标" },
            { label: "几何图形", value: "几何图形" },
            { label: "图形 + 字标", value: "图形 + 字标" },
          ],
        }),
        textVariable("应用触点", "应用触点", { placeholder: "例如：名片、App 图标、包装、社媒模板" }),
        textVariable("视觉风格", "视觉风格", { placeholder: "例如：极简科技、轻奢商业、亲和手作" }),
      ],
    },
  },
  {
    id: "awesome-gpt-image-2-portrait",
    sceneCategory: "人像摄影",
    title: "商业人像摄影",
    sourceName: "awesome-gpt-image-2 / Photography & Realism",
    sourceUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/templates.md#%E6%91%84%E5%BD%B1%E4%B8%8E%E5%86%99%E5%AE%9E",
    category: "use_case",
    defaultSize: "douyin_cover_9_16",
    description: "适合人物写真、商务头像、生活方式大片，强调身份保留、镜头语言和真实质感。",
    effectDirection: "真实商业摄影，不像 AI 磨皮海报，适合头像、封面和品牌人像。",
    insight: "人像最重要的是身份锚点、姿态、镜头、光线和皮肤质感，而不是堆风格词。",
    breakdown: {
      imageType: "商业人像 / 生活方式摄影",
      subject: "一个明确人物，保留五官、发型、服装或气质锚点",
      scene: "室内自然光、街头纪实、棚拍背景、品牌生活方式空间",
      composition: "半身或 3/4 身，眼神方向、姿态和留白明确",
      lighting: "窗边自然光、柔光箱、逆光、电影感侧光",
      material: "真实皮肤、布料纹理、发丝、背景景深和镜头颗粒",
      copywriting: "通常不加字；做封面时只保留短标题",
      ratio: "9:16 竖版或 3:4 人像",
      pitfalls: ["五官漂移", "皮肤塑料感", "手部变形", "背景假棚拍"],
    },
    draft: {
      name: "商业人像摄影",
      description: "从 awesome-gpt-image-2 摄影案例提炼：人像/头像/生活方式摄影模板。",
      defaultPrompt:
        "生成一张商业人像摄影图。人物身份：{人物身份}。需要保留的特征：{需要保留的特征}。服装造型：{服装造型}。拍摄场景：{拍摄场景}。姿态表情：{姿态表情}。镜头语言：{镜头语言}。光影风格：{光影风格}。构图要求：人物是视觉中心，五官自然，皮肤质感真实，背景有轻微景深，画面高级克制。输出要求：真实商业摄影质感，不要过度磨皮，不要卡通化。",
      defaultNegativePrompt: "五官漂移，塑料皮肤，手部变形，过度磨皮，低清晰度，假背景，卡通感",
      defaultReferenceStrength: 0.82,
      defaultStyleStrength: 0.52,
      templateVariables: [
        textVariable("人物身份", "人物身份", { required: true, placeholder: "例如：40 岁女性创业者" }),
        textVariable("需要保留的特征", "需要保留的特征", { placeholder: "例如：发型、脸型、眼镜、服装轮廓" }),
        textVariable("服装造型", "服装造型", { placeholder: "例如：白色衬衫、深色西装、轻运动风" }),
        textVariable("拍摄场景", "拍摄场景", { placeholder: "例如：窗边办公室、街头咖啡馆、灰色棚拍" }),
        textVariable("姿态表情", "姿态表情", { placeholder: "例如：自然微笑、凝视镜头、侧身站姿" }),
        textVariable("镜头语言", "镜头语言", { placeholder: "例如：85mm 半身肖像、浅景深、轻微胶片颗粒" }),
        textVariable("光影风格", "光影风格", { placeholder: "例如：窗边自然光、柔光箱、电影感侧光" }),
      ],
    },
  },
  {
    id: "awesome-gpt-image-2-livestream",
    sceneCategory: "直播截图",
    title: "直播间真实截图",
    sourceName: "awesome-gpt-image-2 / Livestream scene case",
    sourceUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/gallery-part-2.md#case-330",
    category: "use_case",
    defaultSize: "douyin_cover_9_16",
    description: "适合直播间效果预览、带货场景图、主播画面模拟，强调屏幕截图真实感。",
    effectDirection: "像真实平台直播截图，而不是普通棚拍海报。",
    insight: "直播截图要同时控制主播、商品、房间、弹幕 UI 和手机屏幕质感。",
    breakdown: {
      imageType: "竖版直播截图 / 带货直播间",
      subject: "主播 + 主推商品 + 直播 UI 层",
      scene: "家居直播间、服装直播间、美妆台、户外夜景或品牌展间",
      composition: "主播居中或偏侧，商品前景展示，顶部/底部有平台 UI 区",
      lighting: "真实直播补光、屏幕反光、环境灯带或窗边光",
      material: "手机截图质感、弹幕标签、商品包装、桌面道具、背景灯",
      copywriting: "弹幕和按钮短而可信，不塞长文",
      ratio: "9:16 竖版手机屏幕",
      pitfalls: ["UI 假按钮太多", "弹幕乱码", "商品被遮挡", "主播表情僵硬"],
    },
    draft: {
      name: "直播间真实截图",
      description: "从 awesome-gpt-image-2 直播场景案例提炼：直播截图/带货场景模板。",
      defaultPrompt:
        "生成一张真实手机直播截图，9:16 竖版。直播类型：{直播类型}。主播形象：{主播形象}。主推商品：{主推商品}。直播场景：{直播场景}。平台 UI：{平台 UI}。画面氛围：{画面氛围}。构图要求：主播、商品和直播界面都清晰，UI 层像真实平台截图但不过度拥挤，商品不要被弹幕遮挡。输出要求：真实直播截图质感，有手机屏幕感和轻微压缩质感。",
      defaultNegativePrompt: "弹幕乱码，UI 过多，商品被遮挡，主播表情僵硬，低清晰度，廉价棚拍感",
      defaultReferenceStrength: 0.62,
      defaultStyleStrength: 0.7,
      templateVariables: [
        textVariable("直播类型", "直播类型", { required: true, placeholder: "例如：服装带货、美妆试色、家居好物" }),
        textVariable("主播形象", "主播形象", { placeholder: "例如：亲和女性主播、专业男主播、户外达人" }),
        textVariable("主推商品", "主推商品", { placeholder: "例如：羊毛外套、口红套装、咖啡机" }),
        textVariable("直播场景", "直播场景", { placeholder: "例如：温暖衣帽间、白色美妆台、品牌展间" }),
        textVariable("平台 UI", "平台 UI", { placeholder: "例如：少量弹幕、购物袋按钮、热度标签" }),
        textVariable("画面氛围", "画面氛围", { placeholder: "例如：真实热闹、干净专业、夜间氛围" }),
      ],
    },
  },
  {
    id: "awesome-gpt-image-2-ui-screenshot",
    sceneCategory: "UI 截图",
    title: "产品 UI 截图",
    sourceName: "awesome-gpt-image-2 / UI & Interfaces",
    sourceUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/docs/templates.md#ui%E4%B8%8E%E7%95%8C%E9%9D%A2",
    category: "use_case",
    defaultSize: "douyin_cover_9_16",
    description: "适合 App、Web、SaaS、仪表盘和落地页效果图，强调真实界面截图质感。",
    effectDirection: "像真实产品截图，不是装饰性 UI 概念图。",
    insight: "UI 图要先定义平台、信息层级、布局结构和可读文字，少用泛泛的“科技感”。",
    breakdown: {
      imageType: "App / Web / Dashboard UI 截图",
      subject: "一个产品界面和核心功能流程",
      scene: "手机屏幕、浏览器页面、SaaS 工作台或仪表盘",
      composition: "导航、内容区、卡片、图表和操作按钮层级清楚",
      lighting: "界面截图本身为主，可用轻微设备阴影或屏幕反光",
      material: "玻璃态、白底卡片、数据图表、图标系统、设备边框",
      copywriting: "关键 UI 文案必须短、清晰、可读",
      ratio: "9:16 App、16:9 Web 或自动",
      pitfalls: ["按钮文字乱码", "导航结构不真实", "元素尺寸失衡", "营销页装饰过重"],
    },
    draft: {
      name: "产品 UI 截图",
      description: "从 awesome-gpt-image-2 UI 案例提炼：App/Web/SaaS 界面截图模板。",
      defaultPrompt:
        "生成一张高保真产品 UI 截图。产品类型：{产品类型}。平台：{平台}。核心功能：{核心功能}。页面结构：{页面结构}。视觉风格：{视觉风格}。主色和强调色：{主色和强调色}。关键界面文案：{关键界面文案}。构图要求：导航、内容区、卡片、图表和按钮层级清晰，像真实可上线产品截图。输出要求：文字清晰可读，交互元素尺寸合理，界面不拥挤。",
      defaultNegativePrompt: "文字乱码，按钮错位，导航不真实，元素拥挤，低保真线框图，过度装饰",
      defaultReferenceStrength: 0.4,
      defaultStyleStrength: 0.74,
      templateVariables: [
        textVariable("产品类型", "产品类型", { required: true, placeholder: "例如：AI 图片工作台、健身 App、CRM 系统" }),
        textVariable("平台", "平台", {
          type: "select",
          defaultValue: "Web",
          options: [
            { label: "Web", value: "Web" },
            { label: "iOS", value: "iOS" },
            { label: "Android", value: "Android" },
            { label: "Dashboard", value: "Dashboard" },
          ],
        }),
        textVariable("核心功能", "核心功能", { placeholder: "例如：任务队列、数据看板、内容发布" }),
        textVariable("页面结构", "页面结构", { placeholder: "例如：顶部导航 + 双栏工作区 + 右侧历史列表" }),
        textVariable("视觉风格", "视觉风格", { placeholder: "例如：Linear 风、Apple 风、企业级 SaaS" }),
        textVariable("主色和强调色", "主色和强调色", { placeholder: "例如：白底、墨绿按钮、浅灰分割线" }),
        textVariable("关键界面文案", "关键界面文案", { type: "textarea", placeholder: "例如：首页、生成、历史记录、保存模板" }),
      ],
    },
  },
];
