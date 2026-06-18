# Attention Index Operations

## Current safety state

- Mode: `shadow`
- Active provider: Wikimedia Pageviews
- Algorithm: `wikimedia-7d-vs-21d-v1`
- Target: 30 consecutive daily windows per figure
- Maximum proposal from one source: 15 basis points (`0.15%`)
- Applied price impact: always zero

## Synchronization

The scheduler can run every six hours. Wikimedia normally publishes one useful
new daily observation per day, so repeated runs update existing observations
and remain idempotent.

```text
ATTENTION_SYNC_ENABLED=true
ATTENTION_SYNC_INTERVAL_MINUTES=360
ATTENTION_USER_AGENT=FamePlays/0.1 (https://fameplays.com; contact: SUPPORT_EMAIL)
```

Admin endpoints:

```text
POST /api/admin/attention/sync
GET  /api/admin/attention
GET  /api/artists/:slug/attention
```

## Evaluation gate

The system may mark an artist as `evaluationReady` after:

- 30 daily windows exist.
- The source has no current error.
- The source synchronized during the last 48 hours.

This does not activate prices. `activationReady` remains false until:

- Human review confirms acceptable stability.
- Public methodology and legal text are deployed.
- A production rollback/freeze procedure is tested.
- The provider license permits the intended use.
- YouTube-specific written approval exists before using YouTube-derived data.

## Daily review

Check:

- Source freshness.
- Missing calendar windows.
- Maximum absolute proposed change.
- Standard deviation and direction changes.
- Sudden mapping changes or renamed articles.
- Whether a news event created a temporary spike that should remain capped.

Never convert a provider error or missing observation into a negative signal.

## Provider isolation

Each provider must have:

- Its own adapter.
- Its own stored observations.
- Its own algorithm version.
- Its own license notes and retention policy.

YouTube-derived metrics must use only YouTube API Data and remain isolated from
Wikimedia or other external data unless written permission explicitly allows
combination.
