const ALLOWED_ORIGINS = [
  "https://goleafutbol.com",
  "https://www.goleafutbol.com",
  "https://golea.pages.dev"
];

const ALLOWED_PROXY_DOMAINS = [
  "la14hd.com", "fubohd.com", "cvattv.com", "vproov.com",
  "televisionlibre.net", "futbollibre.net", "flow.com.ar", "directv.com.ar",
  "pelotalibrestv.org", "skylivefu.com", "skylivehd.com", "envivoslatam.org",
  "noveopartidos.xyz", "streamhdhx.com", "ksdjugfsddeports.com",
  "la18hd.com", "fubo18.com"
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "https:" && (
      ALLOWED_ORIGINS.includes(origin) ||
      hostname === "golea.pages.dev" ||
      hostname.endsWith(".golea.pages.dev")
    );
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) && origin ? origin : "https://goleafutbol.com",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, CF-Cache-Status, X-Golea-Edge, X-Golea-Origin-Cache",
    "Vary": "Origin"
  };
}

function textResponse(request, body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(request),
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToString(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return decoder.decode(bytes);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function createSignedProxyToken(targetUrl, secret, ttlMs) {
  const bucket = Math.floor(Date.now() / ttlMs);
  const expiresAt = (bucket + 1) * ttlMs + 60_000;
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({ u: targetUrl, e: expiresAt })));
  const signature = await signPayload(payload, secret);
  return `${payload}.${signature}`;
}

async function verifyToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("Invalid token");

  const expected = await signPayload(parts[0], secret);
  if (!constantTimeEqual(expected, parts[1])) throw new Error("Invalid token");

  const payload = JSON.parse(base64UrlDecodeToString(parts[0]));
  if (!payload.u || !payload.e || Date.now() > Number(payload.e)) throw new Error("Expired token");
  return assertSafeProxyUrl(payload.u);
}

function hostnameMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isAllowedProxyHost(hostname) {
  const normalized = hostname.toLowerCase();
  return ALLOWED_PROXY_DOMAINS.some(domain => hostnameMatches(normalized, domain));
}

function assertSafeProxyUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
  if (!isAllowedProxyHost(parsed.hostname)) throw new Error("Domain not allowed");
  return parsed.href;
}

function isVideoUrl(url) {
  return /\.(ts|m4s|mp4)(\?|$)/i.test(url);
}

function isPlaylistUrl(url) {
  return /\.m3u8(\?|$)/i.test(url);
}

function getProxyPathForUrl(targetUrl) {
  return isVideoUrl(targetUrl) ? "/segment" : isPlaylistUrl(targetUrl) ? "/manifest" : "/asset";
}

function getHeadersForUrl(targetUrl, request) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
  };

  const range = request.headers.get("Range");
  if (range) headers.Range = range;

  if (targetUrl.includes("la14hd.com") || targetUrl.includes("fubohd.com") || targetUrl.includes("cvattv.com") || targetUrl.includes("vproov.com")) {
    headers.Referer = "https://la14hd.com/";
    headers.Origin = "https://la14hd.com";
  } else if (targetUrl.includes("televisionlibre") || targetUrl.includes("futbollibre")) {
    headers.Referer = "https://televisionlibre.net/";
    headers.Origin = "https://televisionlibre.net";
  } else if (targetUrl.includes("pelotalibrestv.org") || targetUrl.includes("skylivefu.com") || targetUrl.includes("skylivehd.com") || targetUrl.includes("envivoslatam.org")) {
    headers.Referer = "https://skylivefu.com/";
    headers.Origin = "https://skylivefu.com";
  } else if (targetUrl.includes("noveopartidos.xyz")) {
    headers.Referer = "https://noveopartidos.xyz/";
    headers.Origin = "https://noveopartidos.xyz";
  } else if (targetUrl.includes("la18hd.com") || targetUrl.includes("fubo18.com")) {
    headers.Referer = "https://la18hd.com/";
    headers.Origin = "https://la18hd.com";
  }

  return headers;
}

function responseWithCors(request, originResponse, extraHeaders = {}) {
  const headers = new Headers(originResponse.headers);
  headers.delete("set-cookie");
  headers.delete("content-security-policy");
  headers.delete("x-frame-options");

  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value) headers.set(key, value);
  }

  return new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers
  });
}

async function fetchManifest(request, targetUrl, env) {
  const response = await fetch(targetUrl, {
    headers: getHeadersForUrl(targetUrl, request),
    cache: "no-store"
  });

  if (!response.ok) {
    return textResponse(request, "Origin error", response.status);
  }

  const contentType = response.headers.get("content-type") || "application/vnd.apple.mpegurl";
  const text = await response.text();
  const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
  const origin = new URL(targetUrl).origin;
  const videoTtl = Number(env.EDGE_VIDEO_TOKEN_TTL_MS || 21600000);
  const manifestTtl = Number(env.EDGE_MANIFEST_TOKEN_TTL_MS || 900000);

  const rewrite = async (match, pathValue) => {
    const absolute = pathValue.startsWith("http")
      ? pathValue
      : pathValue.startsWith("/")
        ? origin + pathValue
        : baseUrl + pathValue;
    const safeUrl = assertSafeProxyUrl(absolute);
    const token = await createSignedProxyToken(safeUrl, env.PROXY_TOKEN_SECRET, isVideoUrl(safeUrl) ? videoTtl : manifestTtl);
    const proxyUrl = `${new URL(request.url).origin}${getProxyPathForUrl(safeUrl)}?token=${token}`;
    return match.includes("URI=") ? `URI="${proxyUrl}"` : proxyUrl;
  };

  const rewrittenLines = await Promise.all(text.split(/\r?\n/).map(async line => {
    if (!line || line.startsWith("#")) return line;
    return rewrite(line, line.trim());
  }));

  let rewritten = rewrittenLines.join("\n");
  const uriMatches = [...rewritten.matchAll(/URI="([^"]+)"/g)];
  for (const match of uriMatches) {
    rewritten = rewritten.replace(match[0], await rewrite(match[0], match[1]));
  }

  return textResponse(request, rewritten, 200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "X-Golea-Edge": "manifest"
  });
}

async function fetchSegment(request, targetUrl, env) {
  const ttlSeconds = Math.floor(Number(env.EDGE_VIDEO_TOKEN_TTL_MS || 21600000) / 1000);
  const originResponse = await fetch(targetUrl, {
    headers: getHeadersForUrl(targetUrl, request),
    cf: {
      cacheEverything: true,
      cacheTtlByStatus: {
        "200-299": ttlSeconds,
        "404": 5,
        "500-599": 0
      }
    }
  });

  return responseWithCors(request, originResponse, {
    "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
    "CDN-Cache-Control": `public, max-age=${ttlSeconds}`,
    "X-Golea-Edge": "segment",
    "X-Golea-Origin-Cache": originResponse.headers.get("CF-Cache-Status") || "unknown"
  });
}

async function fetchAsset(request, targetUrl) {
  const originResponse = await fetch(targetUrl, {
    headers: getHeadersForUrl(targetUrl, request),
    cache: "no-store"
  });

  return responseWithCors(request, originResponse, {
    "Cache-Control": "no-store",
    "X-Golea-Edge": "asset"
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return textResponse(request, "", 204);
    if (request.method !== "GET") return textResponse(request, "Method not allowed", 405);
    if (!isAllowedOrigin(request.headers.get("Origin"))) return textResponse(request, "Forbidden origin", 403);

    const url = new URL(request.url);
    if (url.pathname === "/health") return textResponse(request, "golea-edge ok", 200, { "Cache-Control": "no-store" });
    if (!env.PROXY_TOKEN_SECRET) return textResponse(request, "Worker not configured", 500);

    try {
      const targetUrl = await verifyToken(url.searchParams.get("token"), env.PROXY_TOKEN_SECRET);

      if (url.pathname === "/manifest") return fetchManifest(request, targetUrl, env);
      if (url.pathname === "/segment") return fetchSegment(request, targetUrl, env);
      if (url.pathname === "/asset") return fetchAsset(request, targetUrl);

      return textResponse(request, "Not found", 404);
    } catch (error) {
      const forbidden = error.message === "Domain not allowed" || error.message === "Invalid protocol";
      return textResponse(request, forbidden ? "Forbidden" : "Proxy error", forbidden ? 403 : 500);
    }
  }
};
