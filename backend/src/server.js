const express = require('express');
const cors = require('cors');
const { getChannels, getStreamUrl } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://goleafutbol.com';
const PROXY_BASE_URL = process.env.PROXY_BASE_URL || 'https://api.goleafutbol.com/api';

app.use(cors());
app.use(express.json());

// --- Caching Logic for Streams ---
const streamCache = new Map(); // id -> { url, headers, timestamp }
const pendingScrapes = new Map(); // id -> Promise

// Helper to get spoofed headers based on target URL
function getHeadersForUrl(targetUrl) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
  };

  // Known sources that require specific referers
  if (targetUrl.includes('la14hd.com') || targetUrl.includes('fubohd.com') || targetUrl.includes('cvattv.com') || targetUrl.includes('vproov.com')) {
    headers['Referer'] = 'https://la14hd.com/';
    headers['Origin'] = 'https://la14hd.com';
  } else if (targetUrl.includes('televisionlibre') || targetUrl.includes('futbollibre')) {
    headers['Referer'] = 'https://televisionlibre.net/';
    headers['Origin'] = 'https://televisionlibre.net';
  }

  return headers;
}

// Proxy for video streams
app.get('/api/proxy', async (req, res) => {
  const { p } = req.query; 
  if (!p) return res.status(400).send('Source required');

  try {
    // Decode base64 URL. Replace spaces with + to handle browser auto-decoding of query params
    const normalizedP = p.replace(/ /g, '+');
    const url = Buffer.from(normalizedP, 'base64').toString('utf-8');
    
    // Validate URL
    if (!url.startsWith('http')) {
        return res.status(400).send('Invalid URL');
    }

    // Cache-Control for efficiency
    if (url.includes('.ts') || url.includes('.m4s') || url.includes('.mp4')) {
        res.set('Cache-Control', 'public, max-age=3600'); 
    } else if (url.includes('.m3u8')) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    const fetchOptions = {
      method: 'GET',
      headers: getHeadersForUrl(url)
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        console.error(`[Proxy] Fetch failed for ${url.substring(0, 50)}: ${response.status} ${response.statusText}`);
        return res.status(response.status).send(`Origin error: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.set('Access-Control-Allow-Origin', '*'); 
    res.set('Content-Type', contentType);

    if (url.includes('.m3u8')) {
      const text = await response.text();
      const urlObj = new URL(url);
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const origin = urlObj.origin;

      // Rewrite segment URLs and sub-playlists
      let rewrittenBody = text.replace(/^(?!#)(.+)$/gm, (match) => {
        const line = match.trim();
        if (!line) return line;
        
        try {
          let absoluteUrl;
          if (line.startsWith('http')) {
            absoluteUrl = line;
          } else if (line.startsWith('/')) {
            absoluteUrl = origin + line;
          } else {
            absoluteUrl = baseUrl + line;
          }
          const base64Url = Buffer.from(absoluteUrl).toString('base64');
          return `${PROXY_BASE_URL}/proxy?p=${encodeURIComponent(base64Url)}`;
        } catch (e) { return line; }
      });

      // Rewrite URIs in attributes (like keys or alternative streams)
      rewrittenBody = rewrittenBody.replace(/URI="([^"]+)"/g, (match, p1) => {
        try {
          let absoluteUrl;
          if (p1.startsWith('http')) {
            absoluteUrl = p1;
          } else if (p1.startsWith('/')) {
            absoluteUrl = origin + p1;
          } else {
            absoluteUrl = baseUrl + p1;
          }
          const base64Url = Buffer.from(absoluteUrl).toString('base64');
          return `URI="${PROXY_BASE_URL}/proxy?p=${encodeURIComponent(base64Url)}"`;
        } catch (e) { return match; }
      });

      res.send(rewrittenBody);
    } else {
      // Pipe video segments directly
      if (response.body) {
        // Node 18+ fetch returns a Web Stream
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      }
    }
  } catch (error) {
    console.error('[Proxy Error]:', error.message);
    if (!res.headersSent) res.status(500).send('Stream proxy error');
  }
});

let channelsCache = null;
let lastChannelsFetch = 0;

app.get('/api/channels', async (req, res) => {
  try {
    if (!channelsCache || Date.now() - lastChannelsFetch > 300000) { // 5 min
      channelsCache = await getChannels();
      lastChannelsFetch = Date.now();
    }
    res.json(channelsCache);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

app.get('/api/stream-url', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Channel ID is required' });

  // 1. Check Cache (valid for 3 minutes)
  const cached = streamCache.get(id);
  if (cached && Date.now() - cached.timestamp < 180000) {
    return res.json({ url: cached.url, headers: cached.headers });
  }

  // 2. Avoid duplicate scraping (Queue/Lock)
  if (pendingScrapes.has(id)) {
    console.log(`[API] Waiting for existing scrape of ${id}...`);
    try {
      const result = await pendingScrapes.get(id);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to fetch stream URL' });
    }
  }

  // 3. Start new scrape
  const scrapePromise = (async () => {
    try {
      const data = await getStreamUrl(id);
      if (data && data.url) {
        streamCache.set(id, { ...data, timestamp: Date.now() });
        return data;
      }
      throw new Error('Not found');
    } finally {
      pendingScrapes.delete(id);
    }
  })();

  pendingScrapes.set(id, scrapePromise);

  try {
    const data = await scrapePromise;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stream URL' });
  }
});

app.get('/health', (req, res) => res.send('golea-api ok'));
app.get('/', (req, res) => res.send('Golea API server online'));

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
