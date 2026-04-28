import nodeFetch, { type RequestInit as NodeFetchRequestInit } from "node-fetch";
import { ProxyAgent } from "proxy-agent";

const supportedProxyProtocols = new Set([
  "http:",
  "https:",
  "socks:",
  "socks4:",
  "socks4a:",
  "socks5:",
  "socks5h:",
  "socket5:",
]);
const proxyAgents = new Map<string, ProxyAgent>();

export function normalizeProxyUrl(raw?: string | null): string {
  const value = raw?.trim() ?? "";
  if (!value) {
    return "";
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("代理地址格式不正确，请填写完整 URL，例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:7890");
  }

  if (!supportedProxyProtocols.has(url.protocol.toLowerCase())) {
    throw new Error("代理地址仅支持 HTTP、HTTPS、SOCKS4、SOCKS5、SOCKS5H");
  }
  if (!url.hostname) {
    throw new Error("代理地址缺少主机名");
  }
  if (url.protocol.toLowerCase() === "socket5:") {
    url.protocol = "socks5:";
  }

  return url.toString();
}

export function redactProxyUrl(raw?: string | null): string | null {
  const normalized = normalizeProxyUrl(raw);
  if (!normalized) {
    return null;
  }

  const url = new URL(normalized);
  if (url.password) {
    url.password = "******";
  }
  return url.toString();
}

export async function fetchWithOptionalProxy(
  url: string,
  init: RequestInit,
  proxyUrl?: string | null,
): Promise<Response> {
  const normalized = normalizeProxyUrl(proxyUrl);
  if (!normalized) {
    return fetch(url, init);
  }

  const nodeFetchInit: NodeFetchRequestInit = {
    method: init.method,
    headers: init.headers as NodeFetchRequestInit["headers"],
    body: init.body as NodeFetchRequestInit["body"],
    signal: init.signal as NodeFetchRequestInit["signal"],
    agent: getProxyAgent(normalized),
  };

  return (await nodeFetch(url, nodeFetchInit)) as unknown as Response;
}

function getProxyAgent(proxyUrl: string): ProxyAgent {
  const cached = proxyAgents.get(proxyUrl);
  if (cached) {
    return cached;
  }

  const agent = new ProxyAgent({ getProxyForUrl: () => proxyUrl });
  proxyAgents.set(proxyUrl, agent);
  return agent;
}
