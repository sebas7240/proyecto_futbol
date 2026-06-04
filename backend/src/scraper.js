const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const needle = require("needle");

chromium.use(StealthPlugin());

let browser;

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

async function getChannelsFromLa14() {
  try {
    const response = await needle("get", "https://la14hd.com/status.json", {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }
    });
    const data = response.body;
    let channels = [];
    for (const category in data) {
        data[category].forEach(item => {
            if (item.Estado === "Activo") {
                channels.push({
                    id: item.Link,
                    name: item.Canal,
                    category: category,
                    source: "la14"
                });
            }
        });
    }
    return channels;
  } catch (err) {
    console.error("[Scraper] Error en Fuente A:", err.message);
    return [];
  }
}

async function getChannelsFromFutbolLibre() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto("https://futbol-libre.su/", { waitUntil: "networkidle", timeout: 30000 });
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
  const [sourceA, sourceB, sourceC] = await Promise.all([
    getChannelsFromLa14(),
    getChannelsFromFutbolLibre(),
    getChannelsFromRojaDirecta()
  ]);

  const masterMap = new Map();
  [...sourceA, ...sourceB, ...sourceC].forEach(ch => {
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
  console.log("[Scraper] Obteniendo se�al para: " + channelUrl);
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  let m3u8s = [];

  try {
    page.on("request", request => {
      if (request.url().includes(".m3u8")) {
        m3u8s.push({ url: request.url(), headers: request.headers() });
      }
    });

    await page.goto(channelUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(5000);

    if (m3u8s.length > 0) {
        const master = m3u8s.find(m => m.url.includes("master"));
        const index = m3u8s.find(m => m.url.includes("index"));
        return master || index || m3u8s[m3u8s.length - 1];
    }
    return null;
  } catch (err) {
    console.error("[Scraper Error] getStreamUrl:", err.message);
    throw err;
  } finally {
    await page.close();
    await context.close();
  }
}

module.exports = { getChannels, getStreamUrl };
