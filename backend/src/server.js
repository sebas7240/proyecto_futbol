const express = require("express");
const cors = require("cors");
const { getChannels, getStreamUrl } = require("./scraper");

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://goleafutbol.com";
const PROXY_BASE_URL = process.env.PROXY_BASE_URL || "https://api.goleafutbol.com/api";

app.use(cors());
app.use(express.json());

const streamCache = new Map();
const pendingScrapes = new Map();

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
    "Connection": "keep-alive",
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

    if (isVideo) res.set("Cache-Control", "public, max-age=3600"); 
    else if (url.includes(".m3u8")) res.set("Cache-Control", "no-cache, no-store, must-revalidate");

    const response = await fetch(url, { method: "GET", headers: getHeadersForUrl(url) });
    if (!response.ok) return res.status(response.status).send("Origin error");

    res.set("Access-Control-Allow-Origin", "*"); 
    res.set("Content-Type", response.headers.get("content-type") || "application/octet-stream");

    if (url.includes(".m3u8")) {
      let text = await response.text();
      const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
      const origin = new URL(url).origin;
      const rewrite = (match, p1) => {
          let abs = p1.startsWith("http") ? p1 : (p1.startsWith("/") ? origin + p1 : baseUrl + p1);
          return (match.includes("URI=") ? "URI=\"" : "") + PROXY_BASE_URL + "/proxy?p=" + encodeURIComponent(Buffer.from(abs).toString("base64")) + (match.includes("URI=") ? "\"" : "");
      };
      text = text.replace(/^(?!#)(.+)$/gm, (m) => rewrite(m, m.trim()))
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

let channelsCache = null, lastChannelsFetch = 0;
app.get("/api/channels", async (req, res) => {
  try {
    if (!channelsCache || Date.now() - lastChannelsFetch > 600000) { 
      channelsCache = await getChannels(); lastChannelsFetch = Date.now();
    }
    res.json(channelsCache);
  } catch (e) { res.status(500).json({ error: "Channels error" }); }
});

app.get("/api/stream-url", async (req, res) => {
  const { id } = req.query;
  if (streamCache.has(id) && Date.now() - streamCache.get(id).timestamp < 600000) return res.json(streamCache.get(id));
  if (pendingScrapes.has(id)) return res.json(await pendingScrapes.get(id));
  const p = (async () => {
    try {
      const d = await getStreamUrl(id);
      if (d) { 
        streamCache.set(id, { ...d, timestamp: Date.now() }); 
        return d; 
      }
      throw new Error();
    } finally { pendingScrapes.delete(id); }
  })();
  pendingScrapes.set(id, p);
  try { res.json(await p); } catch (e) { res.status(500).send("URL error"); }
});

let agendaCache = null, lastAgendaFetch = 0;
app.get("/api/agenda", async (req, res) => {
  try {
    if (!agendaCache || Date.now() - lastAgendaFetch > 600000) {
      const domain = "https://pelotalibrestv.org";
      const r = await fetch(`${domain}/agenda.json`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000)
      });
      if (!r.ok) throw new Error("Agenda source down");
      const data = await r.json();

      const events = [];
      const today = new Date().toISOString().split("T")[0];

      if (data.dias && data.dias.length > 0) {
          data.dias[0].eventos.forEach(ev => {
              ev.canales.forEach(ch => {
                  try {
                      const b64 = ch.url.split("r=")[1];
                      if (b64) {
                          const decodedUrl = Buffer.from(b64, "base64").toString("utf-8");
                          events.push({
                              title: ev.titulo,
                              time: ev.hora,
                              category: ev.clase || "Deportes",
                              language: "Español",
                              status: "PROXIMO",
                              date: today,
                              channelName: ch.nombre,
                              // Usamos la URL del portal para que el scraper pueda extraer la señal
                              link: domain + ch.url,
                              // Usamos el ID del stream decodificado para facilitar el matching en el frontend
                              channelId: decodedUrl.split("stream=")[1] || decodedUrl
                          });
                      }
                  } catch (e) { }
              });
          });
      }
      agendaCache = events;
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
