import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalDateTime, mergeProviderMatches } from '../src/matchUtils.js';

test('converts UTC kickoff to Bogota date and time', () => {
  const local = getLocalDateTime('2026-06-14T01:00:00Z', 'America/Bogota');
  assert.deepEqual(local, {
    date: '2026-06-13',
    time: '20:00',
    rawTimestamp: '2026-06-14T01:00:00.000Z'
  });
});

test('deduplicates World Cup fixtures by kickoff and keeps higher priority provider', () => {
  const matches = mergeProviderMatches([
    [{
      source: 'openligadb',
      home: 'Deutschland',
      away: 'Curaçao',
      league: 'WM 2026 USA',
      leagueCode: 'wm2026',
      date: '2026-06-14',
      time: '12:00',
      rawTimestamp: '2026-06-14T17:00:00.000Z',
      homeBadge: 'openliga-home.png',
      awayBadge: null,
      providerRefs: { openligadb: '1' }
    }],
    [{
      source: 'api-football',
      home: 'Germany',
      away: 'Curaçao',
      league: 'FIFA World Cup',
      date: '2026-06-14',
      time: '12:00',
      rawTimestamp: '2026-06-14T17:00:00.000Z',
      homeBadge: null,
      awayBadge: 'api-away.png',
      providerRefs: { 'api-football': '2' }
    }]
  ]);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].source, 'api-football');
  assert.equal(matches[0].home, 'Germany');
  assert.equal(matches[0].homeBadge, 'openliga-home.png');
  assert.equal(matches[0].awayBadge, 'api-away.png');
  assert.deepEqual(matches[0].providerRefs, {
    openligadb: '1',
    'api-football': '2'
  });
});
