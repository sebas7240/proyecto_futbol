const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const needle = require('needle');

chromium.use(StealthPlugin());

let browser;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    console.log('[Scraper] Launching browser...');
    browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

async function getChannels() {
  console.log('[Scraper] getChannels() started');
  try {
    const response = await needle('get', 'https://la14hd.com/status.json', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
    });
    
    const data = response.body;
    let allChannels = [];
    
    for (const category in data) {
        data[category].forEach(item => {
            allChannels.push({
                id: item.Link,
                name: item.Canal,
                category: category, // Keep category separate
                status: item.Estado,
                logo: ''
            });
        });
    }

    // Filter only active channels if preferred, or show all
    const activeChannels = allChannels.filter(c => c.status === 'Activo');
    console.log(`[Scraper] Found ${activeChannels.length} active channels out of ${allChannels.length}`);
    return activeChannels;
  } catch (err) {
    console.error('[Scraper Error] getChannels:', err.message);
    throw err;
  }
}

async function getStreamUrl(channelUrl) {
  console.log(`[Scraper] getStreamUrl(${channelUrl}) started`);
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  let m3u8s = [];

  try {
    // Intercept requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('.m3u8')) {
        console.log(`[Scraper] Detected m3u8: ${url.substring(0, 60)}...`);
        m3u8s.push({
          url: url,
          headers: request.headers()
        });
      }
    });

    console.log(`[Scraper] Navigating to ${channelUrl}...`);
    await page.goto(channelUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Sometimes we need to click a play button or wait for an iframe
    await page.waitForTimeout(3000);

    // Wait for m3u8 (max 15 seconds)
    console.log('[Scraper] Waiting for m3u8 signals...');
    for (let i = 0; i < 30; i++) {
      if (m3u8s.length > 0) {
        const hasMaster = m3u8s.some(m => m.url.toLowerCase().includes('master'));
        if (hasMaster && m3u8s.length > 1) break; 
      }
      await page.waitForTimeout(500);
    }

    if (m3u8s.length > 0) {
        console.log(`[Scraper] Found ${m3u8s.length} m3u8 signals`);
        const master = m3u8s.find(m => m.url.toLowerCase().includes('master'));
        const index = m3u8s.find(m => m.url.toLowerCase().includes('index'));
        const playlist = m3u8s.find(m => m.url.toLowerCase().includes('playlist'));
        
        const selected = master || index || playlist || m3u8s[m3u8s.length - 1];
        console.log(`[Scraper] Selected: ${selected.url.substring(0, 60)}...`);
        return selected;
    } else {
        console.warn('[Scraper] Signal NOT found after timeout');
    }

    return null;
  } catch (err) {
    console.error(`[Scraper Error] getStreamUrl:`, err.message);
    throw err;
  } finally {
    await page.close();
    await context.close();
  }
}

module.exports = { getChannels, getStreamUrl };
