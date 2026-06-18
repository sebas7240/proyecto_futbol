# Fame Plays Chat Worker

Chat en tiempo real para la capa social de Fame Plays. Usa Cloudflare
Durable Objects y WebSockets para mantener salas por figura sin cargar el VPS.
Incluye mensajes, emojis, reportes, notas de voz cortas y moderacion admin.

## Desarrollo

Desde `fame-market`:

```bash
npx wrangler dev --config chat-worker/wrangler.jsonc
```

El frontend debe recibir la URL publica o local mediante:

```text
VITE_CHAT_WS_URL=http://localhost:8787
VITE_CHAT_VOICE_ENABLED=false
```

## Produccion

```bash
npx wrangler deploy --config chat-worker/wrangler.jsonc
```

Despues configura en Cloudflare Pages:

```text
VITE_CHAT_WS_URL=https://fame-plays-chat.sebas7240.workers.dev
VITE_CHAT_VOICE_ENABLED=false
```

Configura el secreto de moderacion:

```bash
npx wrangler secret put CHAT_ADMIN_SECRET --config chat-worker/wrangler.jsonc
```

El backend debe usar la misma clave en `CHAT_ADMIN_SECRET` y apuntar al Worker
con `CHAT_WORKER_ADMIN_URL`. Las notas de voz se guardan como mensajes de 5 a
10 segundos; no usan WebRTC ni llamadas en vivo.
