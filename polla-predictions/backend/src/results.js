import { Router } from 'express';
import https from 'https';

export const resultRouter = Router();

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedResults = null;
let cacheExpires = 0;

resultRouter.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedResults && now < cacheExpires) {
      return res.json(cachedResults);
    }

    const html = await fetchHtml('https://www.resultados-futbol.com/livescore');
    const results = parseResultsFromHtml(html);

    cachedResults = results;
    cacheExpires = now + CACHE_TTL_MS;

    res.json(results);
  } catch (error) {
    console.error('[Results] Error fetching results:', error);
    res.status(500).json({ error: 'No se pudieron cargar los resultados.' });
  }
});

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Unexpected status code ${res.statusCode}`));
            return;
          }

          let body = '';
          res.on('data', (chunk) => {
            body += chunk.toString('utf8');
          });

          res.on('end', () => {
            resolve(body);
          });
        }
      )
      .on('error', reject);
  });
}

function parseResultsFromHtml(html) {
  const results = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRe.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    if (!/class="team-home"/.test(rowHtml)) continue;

    const scriptMatch = rowHtml.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!scriptMatch) continue;

    try {
      const jsonld = JSON.parse(scriptMatch[1].trim());
      if (jsonld['@type'] !== 'SportsEvent') continue;
      if (!Array.isArray(jsonld.competitor) || jsonld.competitor.length < 2) continue;

      const [homeCompetitor, awayCompetitor] = jsonld.competitor;
      const home = homeCompetitor.name || '';
      const away = awayCompetitor.name || '';
      const homeScore = Number.parseInt(homeCompetitor.score ?? '0', 10) || 0;
      const awayScore = Number.parseInt(awayCompetitor.score ?? '0', 10) || 0;
      const startDate = jsonld.startDate || null;
      const league = jsonld.organizer?.name || null;
      const statusRaw = String(jsonld.eventStatus || '').toLowerCase();
      const status = statusRaw.includes('completed')
        ? 'FINISHED'
        : statusRaw.includes('inprogress') || statusRaw.includes('active')
        ? 'LIVE'
        : 'SCHEDULED';

      const hrefMatch = rowHtml.match(/href=["']([^"']*\/partido\/[^"']*)["']/i);
      const rawId = hrefMatch ? hrefMatch[1] : `${home}-${away}-${startDate || ''}`;
      const id = rawId
        .replace(/^\//, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();

      results.push({
        id,
        home,
        away,
        homeScore,
        awayScore,
        status,
        date: startDate,
        league,
        source: 'resultados-futbol.com'
      });
    } catch (error) {
      continue;
    }
  }

  return results.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });
}
