import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "./config";
import { ratioForOption } from "./image-options";

const supportedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function assertSupportedImage(type: string | null): void {
  if (!type || !supportedImageMimeTypes.has(type)) {
    throw new Error("仅支持 PNG、JPG、WEBP 图片");
  }
}

export function assertSupportedImageBytes(bytes: Uint8Array, mimeType: string | null): void {
  assertSupportedImage(mimeType);

  if (mimeType === "image/png" && bytes.length >= 8) {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (pngSignature.every((byte, index) => bytes[index] === byte)) {
      return;
    }
  }

  if (mimeType === "image/jpeg" && bytes.length >= 3) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return;
    }
  }

  if (mimeType === "image/webp" && bytes.length >= 12) {
    const riff = String.fromCharCode(...bytes.slice(0, 4));
    const webp = String.fromCharCode(...bytes.slice(8, 12));
    if (riff === "RIFF" && webp === "WEBP") {
      return;
    }
  }

  throw new Error("图片内容与文件类型不匹配");
}

export function extensionForMime(type: string | null): string {
  if (type === "image/jpeg") {
    return "jpg";
  }
  if (type === "image/webp") {
    return "webp";
  }
  return "png";
}

export function mimeFromFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  return "image/png";
}

export function parseSize(size: string): { width: number; height: number } {
  return ratioForOption(size);
}

export function datedPathParts(date = new Date()): string[] {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
}

export async function saveGeneratedImageFile(input: {
  taskId: string;
  imageId: string;
  bytes: Uint8Array;
  mimeType: string | null;
}): Promise<string> {
  const extension = extensionForMime(input.mimeType);
  const relativePath = path.posix.join(
    ...datedPathParts(),
    input.taskId,
    `${input.imageId}.${extension}`,
  );
  await writeStorageFile(relativePath, input.bytes);
  return relativePath;
}

export async function saveSourceImageFile(input: {
  sourceId: string;
  fileName: string;
  bytes: Uint8Array;
  mimeType: string | null;
}): Promise<string> {
  assertSupportedImage(input.mimeType);
  const extension = extensionForMime(input.mimeType);
  const relativePath = path.posix.join(
    "source",
    ...datedPathParts(),
    `${input.sourceId}.${extension}`,
  );
  await writeStorageFile(relativePath, input.bytes);
  return relativePath;
}

export async function readStorageFile(relativePath: string): Promise<{
  bytes: Uint8Array;
  mimeType: string;
}> {
  const absolutePath = resolveStoragePath(relativePath);
  const bytes = await readFile(absolutePath);
  return { bytes: new Uint8Array(bytes), mimeType: mimeFromFileName(relativePath) };
}

export function resolveStoragePath(relativePath: string): string {
  if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
    throw new Error("图片路径不合法");
  }

  const absolutePath = path.resolve(appConfig.imageStorageDir, relativePath);
  const root = path.resolve(appConfig.imageStorageDir);
  if (!absolutePath.startsWith(`${root}${path.sep}`) && absolutePath !== root) {
    throw new Error("图片路径不合法");
  }
  return absolutePath;
}

async function writeStorageFile(relativePath: string, bytes: Uint8Array): Promise<void> {
  const absolutePath = resolveStoragePath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);
}
