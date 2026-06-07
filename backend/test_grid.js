const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

chromium.use(StealthPlugin());

async function getGrid() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto("https://pelotalibrestv.org/", { waitUntil: "networkidle" });
    const grid = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("a")).filter(a => a.href.includes("/en-vivo/"));
      return items.map(a => {
        let name = a.innerText.trim();
        if (name.toUpperCase() === "VER CANAL" || name === "") {
          // Intentar buscar un título en el mismo contenedor
          const container = a.closest("div.bg-white, div.bg-slate-800, div.rounded-xl, div.p-5");
          if (container) {
            const title = container.querySelector("h1, h2, h3, h4, p.font-bold, p.text-xl");
            if (title) name = title.innerText.trim();
          }
        }
        // Si sigue siendo Ver Canal, usar el slug de la URL
        if (name.toUpperCase() === "VER CANAL" || name === "") {
            name = a.href.split("/").filter(Boolean).pop().replace(/-/g, " ").toUpperCase();
        }
        return { text: name, href: a.href };
      });
    });
    console.log(JSON.stringify(grid.filter(g => g.text.length > 2)));
  } catch (err) {
    console.error(err.message);
  } finally {
    await browser.close();
  }
}

getGrid();
