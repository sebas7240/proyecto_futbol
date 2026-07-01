# Despliegue de Fame Plays

Fame Plays debe mantenerse aislado de Golea. Usa contenedores, puertos,
dominios, bases y volumenes propios.

## Despliegue automatico con GitHub Actions

El repositorio incluye tres workflows aislados:

- `Fame Plays CI`: compila y prueba cambios antes del despliegue.
- `Deploy Fame Plays Chat Worker`: publica el Worker con Wrangler.
- `Deploy Fame Plays API`: actualiza el checkout existente del VPS y levanta
  solamente el Compose ubicado en `fame-market`.

En GitHub abre `Settings > Environments`, crea
`fame-plays-production` y agrega estos secretos al entorno:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
VPS_HOST
VPS_USER
VPS_SSH_PRIVATE_KEY
VPS_KNOWN_HOSTS
VPS_DEPLOY_PATH
```

El token de Cloudflare debe quedar limitado a la cuenta correcta y permitir
editar Workers Scripts. `VPS_SSH_PRIVATE_KEY` contiene la llave privada
OpenSSH completa, mientras `VPS_KNOWN_HOSTS` contiene la clave publica del
servidor previamente verificada. Nunca guardes estos valores en archivos del
repositorio.

`VPS_DEPLOY_PATH` es la carpeta del checkout que contiene `.git` y
`fame-market`, no la carpeta `fame-market` directamente. El workflow se detiene
si encuentra cambios versionados en el servidor y nunca usa `git reset`.

La primera ejecucion se hace manualmente desde `Actions > nombre del workflow
> Run workflow`. Despues, los cambios relevantes fusionados en `main` se
despliegan automaticamente. Cloudflare Pages conserva su integracion Git
actual y no necesita otro workflow.

## 1. Staging

1. Copia `.env.staging.example` como `.env.staging`.
2. Copia `frontend/.env.staging.example` como `frontend/.env.staging`.
3. Completa todos los secretos y usa dominios distintos de produccion.
4. Valida antes de levantar servicios:

```bash
npm run staging:validate
npm run build:staging
npm run staging:up
```

Staging usa:

- API local: `127.0.0.1:4021`
- PostgreSQL local: `127.0.0.1:5435`
- Base y volumen propios con nombre `fame_market_staging`

Ejemplo de bloque adicional en Caddy:

```caddy
staging-api.fameplays.com {
  reverse_proxy 127.0.0.1:4021
}
```

Agrega el bloque sin reemplazar las rutas existentes de Golea. En Cloudflare,
crea el registro DNS `staging-api` con proxy naranja y autoriza
el dominio de staging elegido en Firebase Auth y Turnstile.

Para un preview de Cloudflare Pages usa una rama de staging y:

- Root directory: `fame-market`
- Build command: `npm ci && npm run build:staging`
- Build output: `frontend/dist`
- Variables: las definidas en `frontend/.env.staging.example`

Los preview deployments de Pages no modifican el dominio de produccion.

## 2. Produccion en fameplays.com

Fame Plays usa un proyecto de Cloudflare Pages independiente llamado
`fameplays`. No reutilices el proyecto Pages ni los dominios de Golea.

Frontend:

```bash
VITE_APP_ENV=production \
VITE_API_BASE=https://api.fameplays.com/api \
VITE_PUBLIC_SITE_URL=https://fameplays.com \
VITE_CHAT_WS_URL=https://fame-plays-chat.sebas7240.workers.dev \
npm run build

npx wrangler pages deploy frontend/dist --project-name fameplays --branch main
```

En Cloudflare Pages, conecta los custom domains `fameplays.com` y
`www.fameplays.com` desde el proyecto `fameplays`.

Backend:

1. Copia `.env.production.example` como `.env` en el servidor.
2. Completa secretos reales: Firebase, emails administradores, monitoreo,
   Turnstile, chat, salts y PostgreSQL.
3. Levanta el backend con Docker Compose sin tocar los contenedores de Golea:

Para iniciar el Pulso de noticias con impacto real auditado, agrega al `.env`:

```text
NEWS_SYNC_ENABLED=true
NEWS_SYNC_INTERVAL_MINUTES=120
NEWS_SYNC_CONCURRENCY=3
NEWS_GDELT_MIN_INTERVAL_MS=6000
NEWS_SIGNAL_MODE=applied
NEWS_PRICE_IMPACT_ENABLED=true
NEWS_MAX_SIGNAL_BPS=250
NEWS_MAX_DAILY_BPS=400
NEWS_TOTAL_PRICE_BAND_BPS=800
```

Para que todos los activos tengan movimiento aunque GDELT no encuentre
titulares recientes, activa tambien el Mercado Vivo:

```text
MARKET_MAKER_ENABLED=true
MARKET_MAKER_INTERVAL_MINUTES=15
MARKET_MAKER_MIN_TICK_MINUTES=10
MARKET_MAKER_PRICE_BAND_BPS=1000
MARKET_MAKER_MAX_TICK_BPS=90
MARKET_MAKER_MIN_EFFECTIVE_MOVE_BPS=2
```

`AUTO_MIGRATE=true` aplica las migraciones pendientes durante el arranque,
incluyendo `014_news_pulse.sql` y `016_live_market_maker.sql`.

```bash
docker compose --env-file .env up --build -d
```

Bloque Caddy recomendado para la API:

```caddy
api.fameplays.com {
  reverse_proxy 127.0.0.1:4020
}
```

Agrega ese bloque sin reemplazar los bloques existentes de Golea. En
Cloudflare DNS, `api` debe apuntar al VPS y estar proxied si quieres WAF,
TLS y cache/rate limits desde Cloudflare.

## 3. Activacion de consentimiento

El despliegue debe hacerse en este orden para no bloquear clientes antiguos:

1. Desplegar backend y ejecutar la migracion `006_beta_consent.sql`.
2. Desplegar el frontend con las paginas `/reglas`, `/privacidad` y
   `/metodologia`.
3. Comprobar login, lectura de portafolio y aceptacion.
4. Activar `CONSENT_REQUIRED=true` en backend.

Cada nueva version de reglas o privacidad requiere cambiar su fecha en
`backend/src/consent.ts`. El usuario debera aceptar nuevamente antes de operar.

## 4. Marca, dominio y derechos

Antes de conectar el dominio definitivo:

1. Completar la lista de `docs/BRAND_DOMAIN_AND_RIGHTS.md`.
2. Evitar nombres de figuras, marcas o plataformas dentro del dominio.
3. Configurar el nuevo dominio en Pages, Firebase Auth, Turnstile, CORS y
   `PUBLIC_SITE_URL`.
4. Configurar `VITE_RIGHTS_CONTACT_EMAIL` y un
   `RIGHTS_IP_HASH_SALT` aleatorio en produccion.
5. Verificar `/reglas`, `/privacidad`, `/metodologia` y `/derechos`.
6. Mantener toda imagen en `unverified` hasta registrar su fuente y permiso.

## 5. YouTube derived metrics

El formulario queda aplazado. Cuando se retome:

1. Confirmar que el nuevo dominio definitivo resuelve por DNS y usa HTTPS.
2. Verificar publicamente `/`, `/reglas`, `/privacidad` y `/metodologia`.
3. Capturar las evidencias descritas en
   `docs/YOUTUBE_DERIVED_METRICS_APPLICATION.md`.
4. Completar los datos legales y el numero del proyecto de Google Cloud.
5. Mantener cualquier senal de YouTube fuera del precio hasta recibir
   aprobacion escrita.

La tarea de Wikimedia puede activarse de forma independiente:

```text
ATTENTION_SYNC_ENABLED=true
ATTENTION_SYNC_INTERVAL_MINUTES=360
ATTENTION_USER_AGENT=FamePlays/0.1 (https://fameplays.com; contact: SOPORTE)
```

## 6. Backups externos en Cloudflare R2

Crear un bucket privado:

```bash
npx wrangler r2 bucket create fame-plays-backups --location wnam
```

Si Wrangler responde `Please enable R2 through the Cloudflare Dashboard`, entra
al dashboard de Cloudflare, activa R2 para la cuenta y repite el comando.

En Cloudflare crea un token R2 limitado a lectura y escritura de objetos en
ese bucket. Configura en el servidor:

```text
BACKUP_S3_URI=s3://fame-plays-backups/production
AWS_ENDPOINT_URL_S3=https://ACCOUNT_ID.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=auto
BACKUP_ENCRYPTION_PASSWORD=...
```

Prueba una copia manual:

```bash
docker compose --profile ops run --rm backup
```

La ejecucion solo se marca exitosa despues de verificar checksum, restaurar en
una base temporal y, si R2 esta configurado, subir el archivo cifrado y su
checksum. Nunca subas la contrasena de cifrado al mismo bucket.

## 7. Monitor externo

El Worker de `ops/monitor-worker` corre cada cinco minutos sin usar el VPS para
su propia supervision. Comprueba:

- `/health/live`
- `/health/ready`
- conexion de PostgreSQL mediante `/metrics`
- backup exitoso en las ultimas 36 horas, cuando `CHECK_BACKUPS=true`
- sincronizacion de YouTube dentro de las ultimas 2 horas, cuando
  `CHECK_YOUTUBE_SYNC=true`
- sincronizacion del indice de atencion dentro de las ultimas 12 horas, cuando
  `CHECK_ATTENTION_SYNC=true`

Instalacion y verificacion:

```bash
cd ops/monitor-worker
npm ci
npm run check
npm test
npm run dry-run
```

Configura los secretos de produccion:

```bash
npx wrangler secret put MONITORING_SECRET
npm run deploy
```

`MONITORING_SECRET` debe ser exactamente el del backend. Telegram es opcional:
si quieres alertas por chat, configura tambien `TELEGRAM_BOT_TOKEN` y
`TELEGRAM_CHAT_ID`; si no existen, el monitor no falla y solo guarda estado.
Para staging repite los secretos necesarios con `--env staging` y ejecuta
`npm run deploy:staging`.

Wrangler aprovisiona el KV declarado en `wrangler.jsonc` al desplegarlo. El
Worker espera dos fallos consecutivos antes de avisar y envia otro mensaje
cuando el servicio se recupera.

## 8. Chat social

El chat social se despliega como Worker independiente para no consumir recursos
del VPS:

```bash
npx wrangler deploy --config chat-worker/wrangler.jsonc
```

Despues de desplegar, agrega la URL en Cloudflare Pages:

```text
VITE_CHAT_WS_URL=https://fame-plays-chat.sebas7240.workers.dev
VITE_CHAT_VOICE_ENABLED=false
```

Configura el secreto de moderacion en el Worker:

```bash
npx wrangler secret put CHAT_ADMIN_SECRET --config chat-worker/wrangler.jsonc
```

Y en el backend:

```text
CHAT_WORKER_ADMIN_URL=https://fame-plays-chat.sebas7240.workers.dev
CHAT_ADMIN_SECRET=EL_MISMO_SECRETO_DEL_WORKER
```

La version activa usa notas de voz de 5 a 10 segundos, no llamada de audio en
vivo. Para abrir audio en vivo hacen falta TURN, reglas de moderacion, boton de
silenciar/reportar y pruebas especificas en WebView Android.

## 9. Lista previa a beta

- Staging no comparte base, volumen, puerto ni dominio con produccion.
- Login, Turnstile y consentimiento funcionan desde el dominio de staging.
- Se completo una restauracion de prueba desde R2.
- Telegram recibio una alerta de prueba y una recuperacion.
- Los secretos no aparecen en Git ni en logs.
- Produccion conserva `CONSENT_REQUIRED=false` hasta publicar frontend y
  migracion.
- El indice de atencion tiene 30 ventanas por figura, pero
  `activationReady=false`.
- Privacidad y metodologia separan claramente los datos de YouTube del indice
  de Wikimedia.
- Las imagenes no verificadas se muestran como avatares abstractos.
- El formulario de derechos crea una solicitud visible en administracion.
- El nombre y dominio definitivos pasaron una busqueda de marcas documentada.
- El chat social funciona en una sala de prueba y no bloquea trading si el
  Worker esta caido.
- Las acciones de moderacion del chat funcionan desde `/admin` sin exponer
  `CHAT_ADMIN_SECRET` en el frontend.
