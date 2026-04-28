// Backward-compatible facade kept for older imports.
// The implementation lives in image-provider.ts so all providers share the same
// timeout, download-size, MIME, and SSRF safeguards.
export { callImageModel } from "./image-provider";
export type { MaterializedImage } from "./image-provider";
