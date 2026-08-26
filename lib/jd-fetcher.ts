import dns from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;

// Blocks SSRF: refuses to fetch a URL whose host resolves to a loopback,
// private (RFC1918), link-local (includes 169.254.169.254 cloud metadata),
// or otherwise non-public address. Re-checked on every redirect hop, since a
// public URL can 302 to an internal one.
async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL scheme: ${url.protocol}`);
  }

  const hostname = url.hostname;
  const addresses = isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true })).map((a) => a.address);

  for (const address of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error(`Refusing to fetch a non-public address: ${address}`);
    }
  }
}

function isPrivateOrReservedIp(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    return (
      a === 127 || // loopback
      a === 10 || // private
      a === 0 || // "this network"
      (a === 169 && b === 254) || // link-local incl. cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) // private
    );
  }
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" || // loopback
    normalized.startsWith("fe80:") || // link-local
    normalized.startsWith("fc") || // unique local
    normalized.startsWith("fd") // unique local
  );
}

export async function fetchJD(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  let response: globalThis.Response | null = null;
  for (let redirects = 0; ; redirects++) {
    await assertPublicHttpUrl(url);

    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PrepSignals/1.0; +https://prepsignals.app)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Redirect with no Location header`);
      if (redirects >= MAX_REDIRECTS) throw new Error("Too many redirects");
      url = new URL(location, url);
      continue;
    }
    break;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text();

  if (contentType.includes("application/json")) {
    return rawText.slice(0, 8000);
  }

  const stripped = stripHTML(rawText);
  return stripped.slice(0, 8000);
}

function stripHTML(html: string): string {
  // Remove script and style blocks entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "");

  // Replace common block elements with newlines
  text = text.replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, "\n");

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Collapse whitespace
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return text;
}
