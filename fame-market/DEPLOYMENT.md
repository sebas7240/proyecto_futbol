# Despliegue de Fame Market

Fame Market debe mantenerse aislado de Golea. Usa contenedores, puertos,
dominios, bases y volumenes propios.

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
staging-api.goleafutbol.com {
  reverse_proxy 127.0.0.1:4021
}
```

Agrega el bloque sin reemplazar las rutas existentes de Golea. En Cloudflare,
crea el registro DNS `staging-api` con proxy naranja y autoriza
`staging-fama.goleafutbol.com` en Firebase Auth y Turnstile.

Para un preview de Cloudflare Pages usa una rama de staging y:

- Root directory: `fame-market`
- Build command: `npm ci && npm run build:staging`
- Build output: `frontend/dist`
- Variables: las definidas en `frontend/.env.staging.example`

Los preview deployments de Pages no modifican el dominio de produccion.

## 2. Activacion de consentimiento

El despliegue debe hacerse en este orden para no bloquear clientes antiguos:

1. Desplegar backend y ejecutar la migracion `006_beta_consent.sql`.
2. Desplegar el frontend con las paginas `/reglas`, `/privacidad` y
   `/metodologia`.
3. Comprobar login, lectura de portafolio y aceptacion.
4. Activar `CONSENT_REQUIRED=true` en backend.

Cada nueva version de reglas o privacidad requiere cambiar su fecha en
`backend/src/consent.ts`. El usuario debera aceptar nuevamente antes de operar.

## 3. YouTube derived metrics

Antes de enviar la solicitud:

1. Confirmar que `fama.goleafutbol.com` resuelve por DNS y usa HTTPS.
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
ATTENTION_USER_AGENT=FameMarket/0.1 (https://fama.goleafutbol.com; contact: SOPORTE)
```

## 4. Backups externos en Cloudflare R2

Crear un bucket privado:

```bash
npx wrangler r2 bucket create fame-market-backups --location wnam
```

En Cloudflare crea un token R2 limitado a lectura y escritura de objetos en
ese bucket. Configura en el servidor:

```text
BACKUP_S3_URI=s3://fame-market-backups/production
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

## 5. Monitor externo

El Worker de `ops/monitor-worker` corre cada cinco minutos sin usar el VPS para
su propia supervision. Comprueba:

- `/health/live`
- `/health/ready`
- conexion de PostgreSQL mediante `/metrics`
- backup exitoso en las ultimas 36 horas
- sincronizacion de YouTube dentro de las ultimas 2 horas

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
npx wrangler secret put TELEGRAM_BOT_TOKEN --env=""
npx wrangler secret put TELEGRAM_CHAT_ID --env=""
npx wrangler secret put MONITORING_SECRET --env=""
npm run deploy
```

`MONITORING_SECRET` debe ser exactamente el del backend. Para staging repite
los tres comandos con `--env staging` y ejecuta `npm run deploy:staging`.

Wrangler aprovisiona el KV declarado en `wrangler.jsonc` al desplegarlo. El
Worker espera dos fallos consecutivos antes de avisar y envia otro mensaje
cuando el servicio se recupera.

## 6. Lista previa a beta

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
