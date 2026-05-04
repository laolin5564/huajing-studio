import type { PublicTemplate } from "./types";

export type TemplateVariableValues = Record<string, string>;

const placeholderPattern = /\{([^{}]+)\}/g;
const promptSegmentPattern = /[^。！？!?；;\n]+[。！？!?；;]?|\n+/g;

function splitPromptSegments(prompt: string): string[] {
  return prompt.match(promptSegmentPattern) ?? [prompt];
}

function hasEmptyPlaceholder(segment: string, values: TemplateVariableValues): boolean {
  return Array.from(segment.matchAll(placeholderPattern)).some((match) => {
    const key = match[1]?.trim() ?? "";
    return !values[key]?.trim();
  });
}

function replacePlaceholders(segment: string, values: TemplateVariableValues): string {
  return segment.replace(placeholderPattern, (_match, rawKey: string) => values[rawKey.trim()]?.trim() ?? "");
}

export function defaultValuesForTemplate(template: PublicTemplate): TemplateVariableValues {
  return Object.fromEntries(
    template.templateVariables.map((variable) => [
      variable.key,
      variable.defaultValue ?? variable.options[0]?.value ?? "",
    ]),
  );
}

export function renderTemplatePrompt(template: PublicTemplate, values: TemplateVariableValues): string {
  return splitPromptSegments(template.defaultPrompt)
    .map((segment) => {
      if (!segment.trim()) return segment;
      return hasEmptyPlaceholder(segment, values) ? "" : replacePlaceholders(segment, values);
    })
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
