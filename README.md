# Fame Plays

Fame Plays is a fictional entertainment game about culture, public attention,
and fan strategy. Players use fictional FameCoins inside seasons; FameCoins are
not real money, securities, crypto assets, or financial instruments.

The active application lives in `fame-market/`.

## Project Layout

- `fame-market/` - Backend, frontend, chat worker, operations, docs, and deploy
  configuration for Fame Plays.
- `.github/workflows/fame-market-*.yml` - CI and production deploy workflows.

Legacy projects, IPTV experiments, scraping scripts, and previous Golea assets
were intentionally removed from this branch to keep Fame Plays isolated.

## Common Commands

```bash
cd fame-market
npm ci
npm run build
npm test
```
