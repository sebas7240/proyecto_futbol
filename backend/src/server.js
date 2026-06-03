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

// Proxy for video streams
app.get('/api/proxy', async (req, res) => {
  const { p } = req.query; 
  if (!p) return res.status(400).send('Source required');

  try {
    const url = Buffer.from(p, 'base64').toString('utf-8');
    
    // IMPORTANT: Cache-Control headers for Cloudflare/Browsers
    if (url.includes('.ts') || url.includes('.m4s') || url.includes('.mp4')) {
        // Video segments are immutable and can be cached for a long time
        res.set('Cache-Control', 'public, max-age=3600'); 
    } else if (url.includes('.m3u8')) {
        // Playlists change frequently, cache for only a few seconds
        res.set('Cache-Control', 'public, max-age=2');
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Referer': 'https://la14hd.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'Origin': 'https://la14hd.com'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    res.set('Access-Control-Allow-Origin', '*'); 
    res.set('Content-Type', contentType);
    res.status(response.status);

    if (url.includes('.m3u8')) {
      const arrayBuffer = await response.arrayBuffer();
      const body = Buffer.from(arrayBuffer);
      let content = body.toString('utf8');
      const urlObj = new URL(url);
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const origin = urlObj.origin;

      const rewrittenBody = content.replace(/^(?!#)(.+)$/gm, (match) => {
        const line = match.trim();
        if (!line) return line;
        let fullUrl;
        try {
          if (line.startsWith('http')) fullUrl = line;
          else if (line.startsWith('/')) fullUrl = origin + line;
          else fullUrl = baseUrl + line;
          return `${PROXY_BASE_URL}/proxy?p=${Buffer.from(fullUrl).toString('base64')}`;
        } catch (e) { return line; }
      }).replace(/URI="([^"]+)"/g, (match, p1) => {
        let fullUrl;
        try {
          if (p1.startsWith('http')) fullUrl = p1;
          else if (p1.startsWith('/')) fullUrl = origin + p1;
          else fullUrl = baseUrl + p1;
          return `URI="${PROXY_BASE_URL}/proxy?p=${Buffer.from(fullUrl).toString('base64')}"`;
        } catch (e) { return match; }
      });
      res.send(rewrittenBody);
    } else {
      // Stream segments directly for efficiency
      if (response.body) {
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
    if (!res.headersSent) res.status(500).send('Stream error');
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
