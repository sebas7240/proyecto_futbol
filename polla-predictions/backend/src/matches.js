import { Router } from 'express';
import { matches } from './store.js';
import { requireAdmin } from './adminMiddleware.js';
import { listStoredMatches } from './dataStore.js';
import { syncSportsDbMatches } from './sportsSyncService.js';

export const matchRouter = Router();

const SYNC_TTL_MS = 10 * 60 * 1000;
const syncStateByDate = new Map();

function getTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.MATCH_TIMEZONE || 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function normalizeDate(value) {
  if (typeof value !== 'string' || value === '' || value === 'today') {
    return getTodayDate();
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getTodayDate();
}

function getKickoffDate(match) {
  if (match?.rawTimestamp) {
    const normalizedTimestamp = /z$/i.test(match.rawTimestamp)
      ? match.rawTimestamp
      : `${match.rawTimestamp}Z`;
    const timestampDate = new Date(normalizedTimestamp);
    if (!Number.isNaN(timestampDate.getTime())) return timestampDate;
  }

  if (!match?.date) return null;

  const value = `${match.date}T${match.time || '00:00'}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPredictionOpen(match) {
  if (!match) return false;
  if (match.status !== 'SCHEDULED') return false;

  const kickoff = getKickoffDate(match);
  return !kickoff || kickoff.getTime() > Date.now();
}

function filterMatches(matches, { date, league }) {
  return matches
    .filter((match) => match.date === date)
    .filter(isPredictionOpen)
    .filter((match) => !league || league === 'Todas' || match.league === league)
    .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));
}

async function syncIfNeeded(date, storedMatches, force = false) {
  if (process.env.MATCH_AUTO_SYNC === 'false') return storedMatches;

  const now = Date.now();
  const state = syncStateByDate.get(date);
  const hasDateMatches = storedMatches.some((match) => match.date === date);
  const shouldSync = force || !hasDateMatches || !state || now - state.syncedAt > SYNC_TTL_MS;

  if (!shouldSync) return storedMatches;

  const pending = state?.pending || syncSportsDbMatches({ settleFinished: false });
  syncStateByDate.set(date, { syncedAt: now, pending });

  try {
    const result = await pending;
    syncStateByDate.set(date, { syncedAt: Date.now(), pending: null });
    return result.matches;
  } catch (error) {
    syncStateByDate.delete(date);
    throw error;
  }
}

matchRouter.get('/', async (req, res) => {
  try {
    const date = normalizeDate(req.query.date);
    const league = typeof req.query.league === 'string' ? req.query.league : '';
    const forceSync = req.query.refresh === '1';
    const storedMatches = await listStoredMatches(500);
    const syncedMatches = await syncIfNeeded(date, storedMatches, forceSync);
    const sourceMatches = syncedMatches.length > 0 ? syncedMatches : matches;
    res.json(filterMatches(sourceMatches, { date, league }));
  } catch (error) {
    console.error('[Matches] Error loading stored matches:', error);
    const date = normalizeDate(req.query.date);
    res.json(filterMatches(matches, { date }));
  }
});

matchRouter.post('/sync/thesportsdb', requireAdmin, async (req, res) => {
  try {
    const settleFinished = req.body?.settleFinished === true;
    const result = await syncSportsDbMatches({ settleFinished });
    res.json(result);
  } catch (error) {
    console.error('[Matches] TheSportsDB sync error:', error);
    res.status(502).json({ error: 'No se pudo sincronizar TheSportsDB.' });
  }
});
