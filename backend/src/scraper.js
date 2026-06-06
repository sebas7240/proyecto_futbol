const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const needle = require("needle");

chromium.use(StealthPlugin());

let browser;
const PELOTA_DOMAIN = "https://pelotalibrestv.org";

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    console.log("[Scraper] Lanzando navegador...");
    browser = await chromium.launch({ 
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
  }
  return browser;
}

async function getChannelsFromPelotaLibre() {
  try {
    let channels = [];

    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        await page.goto(`${PELOTA_DOMAIN}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
        const staticChannels = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("a"));
            return links
                .filter(l => l.href.includes("/en-vivo/"))
                .map(l => ({
                    id: l.href,
                    name: l.innerText.trim() || l.href.split("/").pop().replace(/-/g, " ").toUpperCase(),
                    category: "Deportes",
                    source: "pelotalibre"
                }))
                .filter(ch => ch.name.length > 2 && !ch.name.includes("Ver Canal"));
        });
        channels = [...staticChannels];
        await page.close();
    } catch (e) { console.error("[Scraper] Error en PelotaLibre Home:", e.message); }

    try {
        const agendaEvents = await getAgendaEventsFromPelotaLibre();
        channels.push(...agendaEvents.map(event => ({
            id: event.link,
            name: `${event.channelName} - ${event.title}`.toUpperCase(),
            category: "Agenda",
            source: "pelotalibre_agenda"
        })));
    } catch (e) { console.error("[Scraper] Error en PelotaLibre Agenda:", e.message); }

    return channels;
  } catch (err) {
    console.error("[Scraper] Error general PelotaLibre:", err.message);
    return [];
  }
}

async function getAgendaEventsFromPelotaLibre() {
  const response = await needle("get", `${PELOTA_DOMAIN}/agenda.json`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    open_timeout: 5000,
    response_timeout: 5000
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Agenda source status ${response.statusCode}`);
  }

  const data = response.body;
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
              language: "Espa\u00f1ol",
              status: "PROXIMO",
              date: today,
              channelName: ch.nombre,
              link: PELOTA_DOMAIN + ch.url,
              channelId: decodedUrl.split("stream=")[1] || decodedUrl
            });
          }
        } catch (e) {
          console.error("[Agenda] Evento ignorado:", e.message);
        }
      });
    });
  }

  return events;
}

async function getChannelsFromFutbolLibre() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto("https://futbol-libre.su/", { waitUntil: "domcontentloaded", timeout: 30000 });
    const channels = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      return links
        .map(link => ({ text: link.innerText.trim(), href: link.href }))
        .filter(l => l.text.length > 2 && (
            l.href.includes("/espn") || l.href.includes("/tnt") || l.href.includes("/fox") || l.href.includes("/tyc") || l.href.includes("/win") || l.href.includes("/dsports")
        ))
        .map(l => ({
            id: l.href,
            name: l.text,
            category: "Deportes",
            source: "futbollibre"
        }));
    });
    return channels;
  } catch (err) {
    console.error("[Scraper] Error en Fuente B:", err.message);
    return [];
  } finally {
    await page.close();
  }
}

async function getChannelsFromRojaDirecta() {
  try {
    const url = "https://rojadirectatv.net/";
    const response = await needle("get", url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }
    });
    const html = response.body.toString();
    const links = html.match(/href=["'](en-vivo\/.*?)["']/g);
    if (!links) return [];

    return links
        .map(l => {
            const path = l.replace(/href=["']|["']/g, "");
            const name = path.replace("en-vivo/", "").replace(/-/g, " ").toUpperCase();
            return {
                id: url + path,
                name: name,
                category: "Deportes",
                source: "rojadirecta"
            };
        });
  } catch (err) {
    console.error("[Scraper] Error en Fuente C:", err.message);
    return [];
  }
}

async function getChannels() {
  console.log("[Scraper] Actualizando lista de canales...");
  const sourceA = await getChannelsFromPelotaLibre();

  const masterMap = new Map();
  sourceA.forEach(ch => {
    const normalizedName = ch.name.toUpperCase().replace(" HD", "").replace(" PREMIUM", "").trim();
    if (!masterMap.has(normalizedName)) {
      masterMap.set(normalizedName, { ...ch, name: normalizedName, backups: [] });
    } else {
      if (!masterMap.get(normalizedName).backups.includes(ch.id) && masterMap.get(normalizedName).id !== ch.id) {
        masterMap.get(normalizedName).backups.push(ch.id);
      }
    }
  });

  return Array.from(masterMap.values()).map(ch => ({
    id: ch.id,
    name: ch.name,
    category: ch.category,
    logo: "",
    backups: ch.backups
  }));
}

async function getStreamUrl(channelUrl) {
  console.log("[Scraper] Obteniendo señal para: " + channelUrl);
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();
  let m3u8s = [];

  try {
    page.on("request", request => {
      if (request.url().includes(".m3u8")) {
        m3u8s.push({ url: request.url(), headers: request.headers() });
      }
    });

    // IMPORTANTE: Si la URL es de skylivefu, no cargará fuera de pelotalibre.
    // Intentamos cargarla, pero si falla, el usuario tiene razón: hay que navegar vía pelotalibrestv.org
    await page.goto(channelUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(10000);

    if (m3u8s.length > 0) {
        const master = m3u8s.find(m => m.url.includes("master") || m.url.includes("index.m3u8"));
        return master || m3u8s[m3u8s.length - 1];
    }
    return null;
  } catch (err) {
    console.error("[Scraper Error] getStreamUrl:", err.message);
    return null;
  } finally {
    await page.close();
    await context.close();
  }
}

module.exports = { getChannels, getStreamUrl, getAgendaEventsFromPelotaLibre };
