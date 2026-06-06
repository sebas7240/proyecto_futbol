const express = require("express");
const cors = require("cors");
const { getChannels, getStreamUrl, getAgendaEventsFromPelotaLibre } = require("./scraper");

const app = express();
const PORT = process.env.PORT || 3001;
const PROXY_BASE_URL = process.env.PROXY_BASE_URL || "https://api.goleafutbol.com/api";

app.use(cors());
app.use(express.json());

const streamCache = new Map();
const pendingScrapes = new Map();
const LIST_CACHE_TTL_MS = 300000;

const FULL_PROXY_DOMAINS = [
  "la14hd.com", "fubohd.com", "cvattv.com", "vproov.com",
  "televisionlibre.net", "futbollibre.net", "flow.com.ar", "directv.com.ar",
  "pelotalibrestv.org", "skylivefu.com", "skylivehd.com", "envivoslatam.org"
];

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
  }

  return headers;
}

app.get("/api/proxy", async (req, res) => {
  const { p } = req.query;
  if (!p) return res.status(400).send("Source required");

  try {
    const url = Buffer.from(p.replace(/ /g, "+"), "base64").toString("utf-8");
    if (!url.startsWith("http")) return res.status(400).send("Invalid URL");

    const domain = new URL(url).hostname;
    const isVideo = url.includes(".ts") || url.includes(".m4s") || url.includes(".mp4");
    const needsFullProxy = FULL_PROXY_DOMAINS.some(d => domain.includes(d));

    if (isVideo && !needsFullProxy) return res.redirect(url);

    const response = await fetch(url, { method: "GET", headers: getHeadersForUrl(url) });
    if (!response.ok) return res.status(response.status).send("Origin error");

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const isPlaylist = url.includes(".m3u8") || /mpegurl|vnd\.apple\.mpegurl/i.test(contentType);

    if (isVideo) res.set("Cache-Control", "public, max-age=3600");
    else if (isPlaylist) res.set("Cache-Control", "no-cache, no-store, must-revalidate");

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", contentType);

    if (isPlaylist) {
      let text = await response.text();
      const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
      const origin = new URL(url).origin;
      const rewrite = (match, p1) => {
        const abs = p1.startsWith("http") ? p1 : (p1.startsWith("/") ? origin + p1 : baseUrl + p1);
        return (match.includes("URI=") ? "URI=\"" : "") + PROXY_BASE_URL + "/proxy?p=" + encodeURIComponent(Buffer.from(abs).toString("base64")) + (match.includes("URI=") ? "\"" : "");
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
    if (!res.headersSent) res.status(500).send("Proxy error");
  }
});

let channelsCache = null;
let lastChannelsFetch = 0;
app.get("/api/channels", async (req, res) => {
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

app.get("/api/stream-url", async (req, res) => {
  const { id } = req.query;

  if (streamCache.has(id) && Date.now() - streamCache.get(id).timestamp < 600000) {
    return res.json(streamCache.get(id));
  }
  if (pendingScrapes.has(id)) return res.json(await pendingScrapes.get(id));

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
    res.json(await pending);
  } catch (e) {
    res.status(500).send("URL error");
  }
});

let agendaCache = null;
let lastAgendaFetch = 0;
app.get("/api/agenda", async (req, res) => {
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
