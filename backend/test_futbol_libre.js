const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

chromium.use(StealthPlugin());

async function testFutbolLibre() {
  console.log("[Test] Iniciando investigacion en futbol-libre.su...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("[Test] Navegando a la home...");
    await page.goto("https://futbol-libre.su/", { waitUntil: "networkidle", timeout: 60000 });

    const channels = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      return links.map(link => ({ text: link.innerText.trim(), href: link.href }))
                  .filter(l => l.text.length > 2 && (l.href.includes("/espn") || l.href.includes("/tnt") || l.href.includes("/fox") || l.href.includes("/tyc") || l.href.includes("/win")));
    });

    console.log("[Test] Canales encontrados:", channels.length);
    if (channels.length > 0) {
      console.log("[Test] Probando:", channels[0].text);
      let found = false;
      page.on("request", req => {
        if (req.url().includes(".m3u8")) {
          console.log("[Test] Capturado:", req.url().substring(0, 60));
          found = true;
        }
      });
      await page.goto(channels[0].href, { waitUntil: "networkidle" });
      await page.waitForTimeout(8000);
      console.log(found ? "[RESULTADO] M3U8 CAPTURADO" : "[RESULTADO] NO SE CAPTURO NADA");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}
testFutbolLibre();
