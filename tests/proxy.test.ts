import { describe, expect, test } from "bun:test";
import { normalizeProxyUrl, redactProxyUrl } from "@/lib/proxy";

describe("proxy URL helpers", () => {
  test("accepts HTTP and SOCKS proxy URLs", () => {
    expect(normalizeProxyUrl(" http://127.0.0.1:7890 ")).toBe("http://127.0.0.1:7890/");
    expect(normalizeProxyUrl("socks5://127.0.0.1:7890")).toBe("socks5://127.0.0.1:7890");
    expect(normalizeProxyUrl("socket5://127.0.0.1:7890")).toBe("socks5://127.0.0.1:7890");
    expect(normalizeProxyUrl("socks5h://proxy.example.com:1080")).toBe("socks5h://proxy.example.com:1080");
  });

  test("redacts proxy passwords", () => {
    expect(redactProxyUrl("http://user:secret@proxy.example.com:7890")).toBe(
      "http://user:******@proxy.example.com:7890/",
    );
  });

  test("rejects unsupported protocols", () => {
    let message = "";
    try {
      normalizeProxyUrl("ftp://proxy.example.com:21");
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }

    expect(message).toContain("仅支持");
  });
});
