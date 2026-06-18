# Fame Plays Monitor

Cloudflare Worker programado que supervisa la API desde fuera del VPS y envia
alertas a Telegram.

## Comandos

```bash
npm ci
npm run types
npm run check
npm test
npm run dry-run
```

Para desarrollo local, copia `.dev.vars.example` como `.dev.vars` y ejecuta:

```bash
npm run dev
```

## Secretos

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `MONITORING_SECRET`

El ultimo estado se guarda en KV. `GET /` devuelve ese estado sin cache y el
cron ejecuta una comprobacion cada cinco minutos.
