const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");
const { getChannels, getStreamUrl, getAgendaEventsFromPelotaLibre } = require("./scraper");

const app = express();
const PORT = process.env.PORT || 3001;
const PROXY_BASE_URL = process.env.PROXY_BASE_URL || "https://api.goleafutbol.com/api";
const EDGE_PROXY_BASE_URL = (process.env.EDGE_PROXY_BASE_URL || "").replace(/\/+$/, "");

const ALLOWED_ORIGINS = [
  "https://goleafutbol.com",
  "https://www.goleafutbol.com",
  "https://golea.pages.dev"
];
const TOKEN_TTL_MS = 15 * 60 * 1000;
const VIDEO_TOKEN_TTL_MS = Number(process.env.VIDEO_TOKEN_TTL_MS || 6 * 60 * 60 * 1000);
const DNS_CACHE_TTL_MS = 60 * 1000;
const PROXY_TOKEN_SECRET = process.env.PROXY_TOKEN_SECRET || crypto.randomBytes(32).toString("hex");

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

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  maxAge: 86400
}));
app.use((req, res, next) => {
  if (!isAllowedOrigin(req.headers.origin)) return res.status(403).json({ error: "Forbidden origin" });
  next();
});
app.use(express.json());
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  next();
});

const streamCache = new Map();
const pendingScrapes = new Map();
const proxyTokens = new Map();
const rateBuckets = new Map();
const dnsCache = new Map();
const LIST_CACHE_TTL_MS = 300000;

const ALLOWED_PROXY_DOMAINS = [
  "la14hd.com", "fubohd.com", "cvattv.com", "vproov.com",
  "televisionlibre.net", "futbollibre.net", "flow.com.ar", "directv.com.ar",
  "pelotalibrestv.org", "skylivefu.com", "skylivehd.com", "envivoslatam.org",
  "noveopartidos.xyz", "streamhdhx.com", "ksdjugfsddeports.com",
  "la18hd.com", "fubo18.com"
];

const FULL_PROXY_DOMAINS = [
  "la14hd.com", "fubohd.com", "cvattv.com", "vproov.com",
  "televisionlibre.net", "futbollibre.net", "flow.com.ar", "directv.com.ar",
  "pelotalibrestv.org", "skylivefu.com", "skylivehd.com", "envivoslatam.org",
  "noveopartidos.xyz", "la18hd.com", "fubo18.com"
];

function getClientIp(req) {
  return (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .toString()
    .split(",")[0]
    .trim();
}

function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = `${req.path}:${getClientIp(req)}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    rateBuckets.set(key, bucket);

    if (bucket.count > max) {
      res.set("Retry-After", Math.ceil((bucket.resetAt - now) / 1000).toString());
      return res.status(429).json({ error: "Too many requests" });
    }

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    if (now > bucket.resetAt) rateBuckets.delete(key);
  }
  for (const [token, item] of proxyTokens.entries()) {
    if (now > item.expiresAt) proxyTokens.delete(token);
  }
  for (const [host, item] of dnsCache.entries()) {
    if (now > item.expiresAt) dnsCache.delete(host);
  }
}, 60_000).unref();

function hostnameMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isAllowedProxyHost(hostname) {
  const normalized = hostname.toLowerCase();
  return ALLOWED_PROXY_DOMAINS.some(domain => hostnameMatches(normalized, domain));
}

function isPrivateIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const parts = address.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 0
    );
  }
  if (family === 6) {
    const value = address.toLowerCase();
    return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
  }
  return true;
}

async function assertSafeProxyUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
  if (!isAllowedProxyHost(parsed.hostname)) throw new Error("Domain not allowed");

  const cached = dnsCache.get(parsed.hostname);
  const records = cached && cached.expiresAt > Date.now()
    ? cached.records
    : await dns.lookup(parsed.hostname, { all: true });

  dnsCache.set(parsed.hostname, { records, expiresAt: Date.now() + DNS_CACHE_TTL_MS });

  if (records.some(record => isPrivateIp(record.address))) {
    throw new Error("Private IP blocked");
  }

  return parsed.href;
}

function isVideoUrl(url) {
  return /\.(ts|m4s|mp4)(\?|$)/i.test(url);
}

function isPlaylistUrl(url) {
  return /\.m3u8(\?|$)/i.test(url);
}

function getProxyTtlForUrl(url) {
  return isVideoUrl(url) ? VIDEO_TOKEN_TTL_MS : TOKEN_TTL_MS;
}

function createSignedProxyToken(targetUrl, ttlMs = getProxyTtlForUrl(targetUrl)) {
  const bucket = Math.floor(Date.now() / ttlMs);
  const expiresAt = (bucket + 1) * ttlMs + 60_000;
  const payload = Buffer.from(JSON.stringify({ u: targetUrl, e: expiresAt })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", PROXY_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function createProxyToken(targetUrl, ttlMs = getProxyTtlForUrl(targetUrl)) {
  const bucket = Math.floor(Date.now() / ttlMs);
  const token = crypto
    .createHmac("sha256", PROXY_TOKEN_SECRET)
    .update(`${bucket}:${targetUrl}`)
    .digest("base64url")
    .slice(0, 32);

  proxyTokens.set(token, {
    url: targetUrl,
    expiresAt: (bucket + 1) * ttlMs + 60_000
  });
  return token;
}

function getProxyPathForUrl(targetUrl) {
  return isVideoUrl(targetUrl)
    ? "/segment"
    : isPlaylistUrl(targetUrl)
      ? "/manifest"
      : "/asset";
}

function createProxyUrl(targetUrl, ttlMs = getProxyTtlForUrl(targetUrl)) {
  if (EDGE_PROXY_BASE_URL) {
    return `${EDGE_PROXY_BASE_URL}${getProxyPathForUrl(targetUrl)}?token=${createSignedProxyToken(targetUrl, ttlMs)}`;
  }

  const path = isVideoUrl(targetUrl)
    ? "/proxy/segment"
    : isPlaylistUrl(targetUrl)
      ? "/proxy/manifest"
      : "/proxy";

  return `${PROXY_BASE_URL}${path}?s=${createProxyToken(targetUrl, ttlMs)}`;
}

async function resolveProxyTarget(req) {
  const { p, s } = req.query;

  if (s) {
    const item = proxyTokens.get(String(s));
    if (!item || Date.now() > item.expiresAt) {
      proxyTokens.delete(String(s));
      throw new Error("Expired token");
    }
    return await assertSafeProxyUrl(item.url);
  }

  if (!p) throw new Error("Source required");
  const decoded = Buffer.from(String(p).replace(/ /g, "+"), "base64").toString("utf-8");
  return await assertSafeProxyUrl(decoded);
}

function setProxyCors(req, res) {
  const origin = req.headers.origin;
  res.set("Access-Control-Allow-Origin", isAllowedOrigin(origin) && origin ? origin : "https://goleafutbol.com");
  res.set("Vary", "Origin");
}

function getHeadersForUrl(targetUrl) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Connection": "keep-alive"
  };

  if (targetUrl.includes("la14hd.com") || targetUrl.includes("fubohd.com") || targetUrl.includes("cvattv.com") || targetUrl.includes("vproov.com")) {
    headers["Referer"] = "https://la14hd.com/";
    headers["Origin"] = "https://la14hd.com";
  } else if (targetUrl.includes("televisionlibre") || targetUrl.includes("futbollibre")) {
    headers["Referer"] = "https://televisionlibre.net/";
    headers["Origin"] = "https://televisionlibre.net";
  } else if (targetUrl.includes("pelotalibrestv.org") || targetUrl.includes("skylivefu.com") || targetUrl.includes("skylivehd.com") || targetUrl.includes("envivoslatam.org")) {
    headers["Referer"] = "https://skylivefu.com/";
    headers["Origin"] = "https://skylivefu.com";
  } else if (targetUrl.includes("noveopartidos.xyz")) {
    headers["Referer"] = "https://noveopartidos.xyz/";
    headers["Origin"] = "https://noveopartidos.xyz";
  } else if (targetUrl.includes("la18hd.com") || targetUrl.includes("fubo18.com")) {
    headers["Referer"] = "https://la18hd.com/";
    headers["Origin"] = "https://la18hd.com";
  }

  return headers;
}

async function handleProxyRequest(req, res, expectedType = "auto") {
  try {
    const url = await resolveProxyTarget(req);

    const domain = new URL(url).hostname;
    const isVideo = isVideoUrl(url);
    const needsFullProxy = FULL_PROXY_DOMAINS.some(d => domain.includes(d));

    if (expectedType === "segment" && !isVideo) {
      return res.status(400).send("Invalid segment URL");
    }

    if (isVideo && !needsFullProxy) return res.redirect(url);

    const response = await fetch(url, { method: "GET", headers: getHeadersForUrl(url) });
    if (!response.ok) return res.status(response.status).send("Origin error");

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const isPlaylist = isPlaylistUrl(url) || /mpegurl|vnd\.apple\.mpegurl/i.test(contentType);

    if (expectedType === "manifest" && !isPlaylist) {
      return res.status(400).send("Invalid manifest URL");
    }

    if (isVideo) {
      const ttlSeconds = Math.floor(VIDEO_TOKEN_TTL_MS / 1000);
      res.set("Cache-Control", `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
      res.set("CDN-Cache-Control", `public, max-age=${ttlSeconds}`);
    } else if (isPlaylist) {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("CDN-Cache-Control", "no-store");
    }

    setProxyCors(req, res);
    res.set("Content-Type", contentType);
    res.set("X-Golea-Proxy-Type", isVideo ? "segment" : isPlaylist ? "manifest" : "asset");

    if (isPlaylist) {
      let text = await response.text();
      const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
      const origin = new URL(url).origin;
      const rewrite = (match, p1) => {
        const abs = p1.startsWith("http") ? p1 : (p1.startsWith("/") ? origin + p1 : baseUrl + p1);
        return (match.includes("URI=") ? "URI=\"" : "") + createProxyUrl(abs) + (match.includes("URI=") ? "\"" : "");
      };
      text = text.replace(/^(?!#)(.+)$/gm, m => rewrite(m, m.trim()))
        .replace(/URI="([^"]+)"/g, (m, p1) => rewrite(m, p1));
      res.send(text);
    } else {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      const message = error.message === "Domain not allowed" || error.message === "Private IP blocked" ? "Forbidden" : "Proxy error";
      res.status(message === "Forbidden" ? 403 : 500).send(message);
    }
  }
}

const proxyRateLimit = rateLimit({ windowMs: 60_000, max: 1200 });
app.get("/api/proxy", proxyRateLimit, (req, res) => handleProxyRequest(req, res, "auto"));
app.get("/api/proxy/manifest", proxyRateLimit, (req, res) => handleProxyRequest(req, res, "manifest"));
app.get("/api/proxy/segment", proxyRateLimit, (req, res) => handleProxyRequest(req, res, "segment"));

let channelsCache = null;
let lastChannelsFetch = 0;
app.get("/api/channels", rateLimit({ windowMs: 60_000, max: 120 }), async (req, res) => {
  try {
    if (!channelsCache || Date.now() - lastChannelsFetch > LIST_CACHE_TTL_MS) {
      channelsCache = await getChannels();
      lastChannelsFetch = Date.now();
    }
    res.json(channelsCache);
  } catch (e) {
    console.error("[Channels] Error:", e.message);
    res.status(500).json({ error: "Channels error" });
  }
});

app.get("/api/stream-url", rateLimit({ windowMs: 60_000, max: 90 }), async (req, res) => {
  const { id } = req.query;

  if (streamCache.has(id) && Date.now() - streamCache.get(id).timestamp < 600000) {
    const cached = streamCache.get(id);
    return res.json({
      proxyUrl: createProxyUrl(cached.url),
      proxied: true,
      expiresInMs: TOKEN_TTL_MS
    });
  }
  if (pendingScrapes.has(id)) {
    const data = await pendingScrapes.get(id);
    return res.json({
      proxyUrl: createProxyUrl(data.url),
      proxied: true,
      expiresInMs: TOKEN_TTL_MS
    });
  }

  const pending = (async () => {
    try {
      const data = await getStreamUrl(id);
      if (data) {
        streamCache.set(id, { ...data, timestamp: Date.now() });
        return data;
      }
      throw new Error("Stream not found");
    } finally {
      pendingScrapes.delete(id);
    }
  })();

  pendingScrapes.set(id, pending);

  try {
    const data = await pending;
    res.json({
      proxyUrl: createProxyUrl(data.url),
      proxied: true,
      expiresInMs: TOKEN_TTL_MS
    });
  } catch (e) {
    res.status(500).send("URL error");
  }
});

let agendaCache = null;
let lastAgendaFetch = 0;
app.get("/api/agenda", rateLimit({ windowMs: 60_000, max: 120 }), async (req, res) => {
  try {
    if (!agendaCache || Date.now() - lastAgendaFetch > LIST_CACHE_TTL_MS) {
      agendaCache = await getAgendaEventsFromPelotaLibre();
      lastAgendaFetch = Date.now();
    }
    res.json(agendaCache || []);
  } catch (e) {
    console.error("[Agenda] Error:", e.message);
    res.json([]);
  }
});

app.get("/health", (req, res) => res.send("golea-api ok"));
app.get("/", (req, res) => res.send("Golea API online"));
app.listen(PORT, () => console.log("Running on " + PORT));
