import { z } from "zod";
import { sizeOptions } from "./image-options";
import { generationModes, imageProviders, taskStatuses, templateCategories, userRoles } from "./types";

const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value && value.trim() !== "" ? value.trim() : null));

export const createGenerationTaskSchema = z
  .object({
    mode: z.enum(generationModes),
    prompt: z.string().trim().min(1, "prompt 不能为空").max(8000, "prompt 过长"),
    negativePrompt: nullableString,
    size: z.enum(sizeOptions).default("auto"),
    quantity: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
    templateId: nullableString,
    sourceImageId: nullableString,
    conversationId: nullableString,
    referenceStrength: z.coerce.number().min(0).max(1).default(0.6),
    styleStrength: z.coerce.number().min(0).max(1).default(0.7),
  })
  .superRefine((value, ctx) => {
    if (value.mode !== "text_to_image" && !value.sourceImageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "图生图和改图需要上传或选择参考图",
        path: ["sourceImageId"],
      });
    }
  });

export const listTasksQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }
      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is (typeof taskStatuses)[number] =>
          taskStatuses.includes(item as (typeof taskStatuses)[number]),
        );
    }),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const listImagesQuerySchema = z.object({
  mode: z
    .string()
    .optional()
    .transform((value) =>
      generationModes.includes(value as (typeof generationModes)[number])
        ? (value as (typeof generationModes)[number])
        : null,
    ),
  templateId: nullableString,
  keyword: nullableString,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(30),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, "模板名称不能为空").max(80),
  category: z.enum(templateCategories).default("company"),
  description: nullableString,
  defaultPrompt: z.string().trim().min(1, "默认 prompt 不能为空").max(8000),
  defaultNegativePrompt: nullableString,
  defaultSize: z.enum(sizeOptions).default("auto"),
  defaultReferenceStrength: z.coerce.number().min(0).max(1).default(0.6),
  defaultStyleStrength: z.coerce.number().min(0).max(1).default(0.7),
  sourceImageId: nullableString,
});

export const updateTemplateSchema = createTemplateSchema.partial().extend({
  name: z.string().trim().min(1).max(80).optional(),
  defaultPrompt: z.string().trim().min(1).max(8000).optional(),
});

export const createTemplateFromImageSchema = z.object({
  imageId: z.string().trim().min(1),
  name: z.string().trim().min(1, "模板名称不能为空").max(80),
  category: z.enum(templateCategories).default("company"),
  description: nullableString,
});

export const updateAdminSettingsSchema = z.object({
  imageProvider: z.enum(imageProviders).optional(),
  sub2apiApiKey: z.string().trim().min(1).max(500).optional(),
  sub2apiBaseUrl: z.string().trim().url().max(300).optional(),
  openaiOAuthProxyUrl: z.union([z.string().trim().max(500), z.null()]).optional(),
  imageModel: z.string().trim().min(1).max(100).optional(),
  imageConcurrency: z.coerce.number().int().min(1).max(8).optional(),
  siteTitle: z.string().trim().min(1).max(80).optional(),
  siteSubtitle: z.string().trim().min(1).max(120).optional(),
  registrationEnabled: z.boolean().optional(),
  registrationDefaultGroupId: z.string().trim().min(1).optional(),
  registrationDefaultQuota: z.coerce.number().int().min(0).max(100000).optional(),
});

export const openAIOAuthExchangeSchema = z.object({
  sessionId: z.string().trim().min(1),
  code: z.string().trim().min(1),
  state: z.string().trim().min(1),
});

export const openAIOAuthStatusSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export const continueConversationSchema = z.object({
  prompt: z.string().trim().min(1, "请输入修改描述").max(8000),
  negativePrompt: nullableString,
  sourceImageId: nullableString,
  referenceImageId: nullableString,
  size: z.enum(sizeOptions).default("auto"),
  quantity: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
  referenceStrength: z.coerce.number().min(0).max(1).default(0.65),
  styleStrength: z.coerce.number().min(0).max(1).default(0.7),
});

export const registerSchema = z.object({
  email: z.string().trim().email("邮箱格式不正确").max(160).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1, "名称不能为空").max(60),
  password: z.string().min(8, "密码至少 8 位").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email("邮箱格式不正确").max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(1, "请输入密码").max(200),
});

export const upsertUserGroupSchema = z.object({
  name: z.string().trim().min(1, "分组名称不能为空").max(60),
  monthlyQuota: z.coerce.number().int().min(0).max(100000),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  role: z.enum(userRoles).optional(),
  groupId: nullableString,
  monthlyQuota: z.coerce.number().int().min(0).max(100000).nullable().optional(),
});

export const createAdminUserSchema = z.object({
  email: z.string().trim().email("邮箱格式不正确").max(160).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1, "名称不能为空").max(60),
  password: z.string().min(8, "密码至少 8 位").max(200),
  role: z.enum(userRoles).default("member"),
  groupId: nullableString,
  monthlyQuota: z.coerce.number().int().min(0).max(100000),
});
