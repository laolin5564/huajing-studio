import { describe, expect, test } from "bun:test";
import {
  buildOpenAIAuthorizationUrl,
  openAIOAuthImageGenerationScope,
  refreshOpenAIOAuthToken,
} from "@/lib/openai-oauth";

describe("OpenAI OAuth scopes", () => {
  test("authorization URL uses Codex client allowed scopes", () => {
    const url = buildOpenAIAuthorizationUrl({
      state: "state",
      codeChallenge: "challenge",
      redirectUri: "http://localhost:1455/auth/callback",
    });

    const scopes = new URL(url).searchParams.get("scope")?.split(" ") ?? [];
    expect(scopes).toContain("offline_access");
    expect(scopes.includes(openAIOAuthImageGenerationScope)).toBe(false);
  });

  test("refresh request preserves Codex client allowed scopes", async () => {
    const originalFetch = globalThis.fetch;
    let body = "";
    globalThis.fetch = (async (_url, init) => {
      body = String(init?.body ?? "");
      return new Response(JSON.stringify({ access_token: "fake-access" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      await refreshOpenAIOAuthToken({ refreshToken: "fake-refresh" });
    } finally {
      globalThis.fetch = originalFetch;
    }

    const scopes = new URLSearchParams(body).get("scope")?.split(" ") ?? [];
    expect(scopes).toContain("email");
    expect(scopes.includes(openAIOAuthImageGenerationScope)).toBe(false);
  });
});
