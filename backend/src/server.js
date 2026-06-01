const express = require('express');
const cors = require('cors');
const { getChannels, getStreamUrl } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Proxy for video streams with basic protection
app.get('/api/proxy', async (req, res) => {
  const { p } = req.query; // Use 'p' for protected/obfuscated url
  if (!p) return res.status(400).send('Source required');

  // Basic protection: Check referer to ensure it comes from our frontend
  const referer = req.headers.referer || '';
  if (!referer.includes('localhost:3000') && process.env.NODE_ENV === 'production') {
      return res.status(403).send('Access denied');
  }

  try {
    // Decode the obfuscated URL (simple base64)
    const url = Buffer.from(p, 'base64').toString('utf-8');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Referer': 'https://la14hd.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    
    // Set headers
    res.set('Access-Control-Allow-Origin', 'http://localhost:3000'); // Restrict CORS
    res.set('Content-Type', contentType);
    res.status(response.status);

    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    if (url.includes('.m3u8')) {
      let content = body.toString('utf8');
      const urlObj = new URL(url);
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const origin = urlObj.origin;

      // Rewrite manifest links with obfuscated URLs
      const rewrittenBody = content.replace(/^(?!#)(.+)$/gm, (match) => {
        const line = match.trim();
        if (!line) return line;
        
        let fullUrl;
        try {
          if (line.startsWith('http')) {
            fullUrl = line;
          } else if (line.startsWith('/')) {
            fullUrl = origin + line;
          } else {
            fullUrl = baseUrl + line;
          }
          const protectedUrl = Buffer.from(fullUrl).toString('base64');
          return `http://localhost:${PORT}/api/proxy?p=${protectedUrl}`;
        } catch (e) {
          return line;
        }
      }).replace(/URI="([^"]+)"/g, (match, p1) => {
        let fullUrl;
        try {
          if (p1.startsWith('http')) {
            fullUrl = p1;
          } else if (p1.startsWith('/')) {
            fullUrl = origin + p1;
          } else {
            fullUrl = baseUrl + p1;
          }
          const protectedUrl = Buffer.from(fullUrl).toString('base64');
          return `URI="http://localhost:${PORT}/api/proxy?p=${protectedUrl}"`;
        } catch (e) {
          return match;
        }
      });

      res.send(rewrittenBody);
    } else {
      res.send(body);
    }
  } catch (error) {
    console.error(`[Proxy Error]:`, error.message);
    if (!res.headersSent) res.status(500).send('Stream error');
  }
});

let channelsCache = null;
let lastFetch = 0;

app.get('/api/channels', async (req, res) => {
  console.log('[API] GET /api/channels');
  try {
    if (!channelsCache || Date.now() - lastFetch > 600000) { // Cache 10 min
      console.log('[API] Fetching channels from scraper...');
      channelsCache = await getChannels();
      lastFetch = Date.now();
      console.log(`[API] Found ${channelsCache.length} channels`);
    }
    res.json(channelsCache);
  } catch (error) {
    console.error('[API Error] Fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

app.get('/api/stream-url', async (req, res) => {
  const { id } = req.query;
  console.log(`[API] GET /api/stream-url?id=${id}`);
  if (!id) return res.status(400).json({ error: 'Channel ID is required' });

  try {
    const data = await getStreamUrl(id);
    if (data && data.url) {
      console.log(`[API] Found stream URL: ${data.url}`);
      // Log headers for debugging as requested
      console.log(`[API] Captured Headers:`, JSON.stringify(data.headers, null, 2));
      res.json(data);
    } else {
      console.log('[API] Stream URL not found');
      res.status(404).json({ error: 'Stream URL not found' });
    }
  } catch (error) {
    console.error('[API Error] Fetching stream URL:', error);
    res.status(500).json({ error: 'Failed to fetch stream URL' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
