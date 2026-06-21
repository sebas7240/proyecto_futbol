# Fame Plays

Juego independiente sobre la economia de la atencion. Web, PWA y futura APK comparten el
mismo frontend, API, autenticacion y portafolio.

## Estado actual

- Mercado responsive con tres artistas iniciales.
- Grafica ficticia de precio.
- Firebase Auth con Google.
- PostgreSQL real con migraciones automaticas.
- Cotizaciones de 15 segundos.
- Compras y ventas transaccionales.
- Ledger, posiciones, operaciones e historial persistentes.
- Proteccion por idempotencia.
- Panel admin para canales oficiales de YouTube.
- Sincronizacion de playlist, videos y estadisticas publicas.
- Indice Automatico de Atencion basado inicialmente en Wikimedia Pageviews.
- Senales relativas de 7 dias contra 21 dias en modo sombra.
- Reconstruccion idempotente de 30 ventanas historicas reales por figura.
- Evaluacion de cobertura, dispersion y cambios de direccion sin tocar precios.
- Canales oficiales verificados para Shakira, Karol G y Bad Bunny.
- Busqueda, filtros por categoria, intereses y favoritos persistentes.
- Marcadores personales de compra y venta sobre la grafica.
- Onboarding corto para la primera operacion.
- Prueba de concurrencia e idempotencia contra PostgreSQL real.
- Temporadas semanales con congelamiento y cierre automaticos.
- Ranking en vivo, ranking final e historial personal.
- Insignias semanales de mejor novato y descubridor temprano.
- Historial detallado de operaciones separado por temporada.
- Revision antifraude del top con alertas y aprobacion administrativa.
- Limite transaccional de 60 operaciones por 24 horas y pausa de 5 segundos.
- Rate limits compartidos en PostgreSQL para trading y administracion.
- Cloudflare Turnstile en la cotizacion previa a cada operacion.
- Congelamiento administrativo de usuarios y artistas con auditoria.
- Controles administrativos para procesar el ciclo de temporada.
- Health checks, metricas Prometheus y estado operativo en administracion.
- Backups cifrados con restauracion automatica de prueba y salida opcional a R2.
- Staging aislado con validacion previa de dominios, Firebase y base de datos.
- Reglas y privacidad publicas con consentimiento versionado para operar.
- Aviso de no afiliacion, politica publica de derechos y canal de correccion.
- Avatares abstractos para toda imagen sin licencia verificada.
- Registro administrativo de fuente, licencia, atribucion y revision.
- Bandeja administrativa de solicitudes de imagen, marca o retiro.
- Alias publicos `/api/entities` y `/api/entities/:slug` para avanzar hacia
  figuras genericas sin romper compatibilidad.
- Categorias `musica`, `creadores`, `cine-tv`, `deportes` y `otros` con
  intereses personales guardados por usuario.
- Catalogo mixto inicial de 29 figuras con una fuente Wikimedia validada por
  figura para el indice de atencion en modo sombra.
- Perfiles estrategicos visibles (`stable`, `balanced`, `volatile`,
  `underdog`) con nivel de riesgo y nota explicativa.
- Chat social por figura en Cloudflare Durable Objects, con emojis, reportes,
  moderacion admin y notas de voz cortas.
- Fuentes genericas `entity_sources` y contenido reciente `content_items` con
  compatibilidad hacia los videos existentes de YouTube.
- Eventos externos `external_events` para contexto excepcional revisado, sin
  aplicacion automatica de precio.
- Monitor externo en Cloudflare Workers con estado en KV y alertas Telegram.
- PWA instalable.
- Docker Compose preparado para produccion.

La primera sincronizacion real contiene 30 videos oficiales. Los registros
demostrativos se eliminan automaticamente cuando un artista recibe datos reales.

## Desarrollo local

```bash
cd fame-market
npm install
npm run db:start
npm run dev
```

- Mercado: `http://localhost:5174`
- Administracion: `http://localhost:5174/admin`
- API: `http://localhost:4020/api/status`
- PostgreSQL aislado: `127.0.0.1:5434`

El PostgreSQL local vive en `.local-postgres/` y no modifica el servicio global
instalado en Windows.

Para detenerlo:

```bash
npm run db:stop
```

## Variables

Backend: copiar `.env.example` a `backend/.env`.

Frontend: copiar `frontend/.env.example` a `frontend/.env`.

Variables importantes:

- `DATABASE_URL`
- `DEPLOYMENT_ENV`
- `PUBLIC_SITE_URL`
- `FIREBASE_PROJECT_ID`
- `YOUTUBE_API_KEY`
- `ATTENTION_SYNC_ENABLED`
- `ATTENTION_SYNC_INTERVAL_MINUTES`
- `ATTENTION_USER_AGENT`
- `ADMIN_SECRET`
- `MONITORING_SECRET`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_ALLOWED_HOSTNAMES`
- `TURNSTILE_SESSION_TTL_SECONDS`
- `CONSENT_REQUIRED`
- `RIGHTS_IP_HASH_SALT`
- `VITE_PUBLIC_SITE_URL`
- `VITE_RIGHTS_CONTACT_EMAIL`
- `VITE_CHAT_WS_URL`
- `VITE_CHAT_VOICE_ENABLED`
- `CHAT_WORKER_ADMIN_URL`
- `CHAT_ADMIN_SECRET`
- `BACKUP_ENCRYPTION_PASSWORD`
- `SEASON_AUTOMATION_ENABLED`
- `SEASON_CYCLE_INTERVAL_MINUTES`
- `VITE_TURNSTILE_SITE_KEY`
- variables `VITE_FIREBASE_*`

Los archivos `.env` estan ignorados por Git.

## Chat social

El chat de texto se ejecuta fuera del VPS mediante Cloudflare Durable Objects y
WebSockets. Cada figura usa una sala propia, por ejemplo `entity:karol-g`.

Controles incluidos:

- Maximo 160 caracteres por mensaje.
- Emojis rapidos desde el compositor.
- Notas de voz de 1 a 10 segundos.
- Ultimos 120 mensajes por sala.
- Rate limit de 8 segundos por usuario.
- Bloqueo basico de links e invitaciones externas.
- Presencia simple para saber cuantas personas estan en la sala.
- Reportes de usuarios y auto-ocultamiento al tercer reporte.
- Moderacion desde `/admin`: ocultar mensajes, silenciar, bloquear y reactivar.

Desarrollo local:

```bash
npx wrangler dev --config chat-worker/wrangler.jsonc
```

Despliegue:

```bash
npx wrangler deploy --config chat-worker/wrangler.jsonc
```

Configura la URL resultante en Cloudflare Pages como `VITE_CHAT_WS_URL`. El
backend necesita `CHAT_WORKER_ADMIN_URL` y `CHAT_ADMIN_SECRET` para operar la
moderacion sin exponer el secreto en el navegador. Configura el mismo secreto
en el Worker con:

```bash
npx wrangler secret put CHAT_ADMIN_SECRET --config chat-worker/wrangler.jsonc
```

Las notas de voz no usan llamada en vivo ni WebRTC. El audio chat en vivo queda
aplazado hasta completar TURN, moderacion y pruebas en movil/app.

## Cloudflare Turnstile

1. Crear un widget administrado en Cloudflare Turnstile.
2. Autorizar el dominio definitivo y `localhost` durante desarrollo.
3. Configurar la clave publica como `VITE_TURNSTILE_SITE_KEY` en Pages.
4. Configurar la clave secreta como `TURNSTILE_SECRET_KEY` solo en el backend.
5. Definir `TURNSTILE_ALLOWED_HOSTNAMES=fameplays.com`.
6. Mantener `TURNSTILE_SESSION_TTL_SECONDS=1800` para una validacion cada 30
   minutos por usuario y sesion.

El frontend solicita un token en la primera cotizacion. El backend lo valida
con Siteverify, comprueba la accion `trade_quote` y el hostname, consume el
token una sola vez y devuelve un pase HMAC temporal ligado al UID. Durante su
vigencia las siguientes cotizaciones usan ese pase sin mostrar otro desafio.
Si la clave secreta no esta configurada, la proteccion queda desactivada para
no bloquear el desarrollo local.

## YouTube

1. Activar YouTube Data API v3 en Google Cloud.
2. Crear una API key restringida a esa API.
3. Guardarla como `YOUTUBE_API_KEY` en `backend/.env`.
4. Reiniciar el backend.
5. Abrir `/admin`.
6. Introducir `ADMIN_SECRET`.
7. Registrar los canales por `@handle` y sincronizar.

La API obtiene metadatos y contadores publicos. No descarga videos ni guarda
comentarios individuales. YouTube no se utiliza para crear el precio ficticio.
Cada sincronizacion tambien escribe en `entity_sources`, `content_items` y
`content_snapshots`, que son las tablas genericas para futuras fuentes como
creadores, cine, deportes o eventos externos.
La ficha publica consume `GET /api/entities/:slug/sources` para mostrar fuentes
verificadas y su estado.

Canales iniciales registrados:

- `@Shakira`
- `@KarolG`
- `@BadBunnyPR`

## Indice Automatico de Atencion

La primera fuente es Wikimedia Analytics. Para cada figura se consultan 28 dias
de pageviews y se compara el promedio de los 7 dias recientes contra los 21
anteriores. El resultado se normaliza, aplica una zona neutral y propone como
maximo `+/-0,15%` con una sola fuente.

La implementacion actual siempre trabaja en modo `shadow`: guarda
observaciones, senales y el ajuste propuesto, pero `applied_delta_bps` permanece
en cero y el precio no cambia.

Cada sincronizacion recupera suficiente historial para reconstruir hasta 30
ventanas diarias completas. El panel marca `evaluationReady` cuando existen 30
ventanas y la fuente esta sana, pero `activationReady` permanece siempre en
`false` hasta completar revision humana y permisos.

Para ejecutar una sincronizacion desde administracion:

```text
POST /api/admin/attention/sync
GET  /api/admin/attention
GET  /api/artists/:slug/attention
```

La tarea automatica se habilita con `ATTENTION_SYNC_ENABLED=true`. El intervalo
predeterminado es de seis horas, aunque Wikimedia solo generara una nueva
ventana util cuando aparezca un nuevo dia de datos.

Documentacion:

- [Operacion del indice](docs/ATTENTION_INDEX_OPERATIONS.md)
- [Solicitud de metricas derivadas de YouTube](docs/YOUTUBE_DERIVED_METRICS_APPLICATION.md)
- [Catalogo inicial y fuentes](docs/CATALOG_SOURCES.md)
- [Revision marca/legal de lanzamiento](docs/LEGAL_LAUNCH_REVIEW.md)
- [Marca, dominio y derechos](docs/BRAND_DOMAIN_AND_RIGHTS.md)
- Pagina publica: `/metodologia`
- Pagina publica: `/derechos`

Los datos de YouTube visibles no afectan precios. Una futura metrica derivada
de YouTube usara solamente YouTube API Data y permanecera separada de Wikimedia

## Pulso de noticias

El backend consulta GDELT DOC 2.0 para descubrir titulares publicos recientes
por figura. Guarda solamente el titular, metadatos y enlace al medio original;
no copia el contenido del articulo. La senal combina recencia, diversidad de
dominios y un lexico conservador en espanol, ingles y portugues.

La configuracion recomendada para iniciar es:

```text
NEWS_SYNC_ENABLED=true
NEWS_SYNC_INTERVAL_MINUTES=120
NEWS_SIGNAL_MODE=shadow
NEWS_PRICE_IMPACT_ENABLED=false
NEWS_MAX_SIGNAL_BPS=250
NEWS_MAX_DAILY_BPS=400
NEWS_TOTAL_PRICE_BAND_BPS=800
```

En modo sombra la web muestra el pulso, pero no cambia precios. Para evitar una
activacion accidental, el impacto exige simultaneamente
`NEWS_SIGNAL_MODE=applied` y `NEWS_PRICE_IMPACT_ENABLED=true`. Tambien requiere
dos medios independientes y confianza minima de 0,55. El impacto cambia segun
el perfil estable, equilibrado, volatil o underdog; se limita a 250 puntos base
por senal, 400 diarios y una banda total de 800 puntos base. Los temas sensibles
se detienen para revision humana.
salvo autorizacion escrita expresa.

La solicitud de metricas derivadas queda aplazada hasta que el nombre y dominio
definitivos esten publicados. No bloquea el modo sombra de Wikimedia.

## Eventos externos

`external_events` permite registrar contexto excepcional con fuente, revision y
estado publico. La API publica solo devuelve eventos `approved` y `public`.
Aunque un evento pueda tener una propuesta de impacto en puntos base, por ahora
`appliedDeltaBps` permanece en cero y no modifica precios.

Las integraciones directas con redes sociales como Instagram, X/Twitter o
TikTok quedan aplazadas hasta confirmar permisos y terminos. Por ahora se
prefieren fuentes oficiales, APIs permitidas y eventos revisados manualmente.

Endpoints:

```text
GET   /api/entities/:slug/external-events
GET   /api/admin/external-events
POST  /api/admin/artists/:artistId/external-events
PATCH /api/admin/external-events/:eventId
```

## Derechos de imagen y marcas

La API no entrega una fotografia de figura publica salvo que su registro este
marcado como `owned`, `licensed` o `provider_authorized`. En cualquier otro
estado el frontend muestra iniciales abstractas.

`/derechos` contiene el aviso de no afiliacion y el formulario de correccion o
retiro. `/admin` permite revisar esas solicitudes y documentar la fuente,
licencia y atribucion de cada imagen. Esto reduce riesgo, pero no sustituye una
revision juridica antes de premios o monetizacion a gran escala.

## Docker

```bash
docker compose up --build
```

En produccion deben suministrarse contrasenas y secretos reales mediante
variables de entorno.

La guia [DEPLOYMENT.md](DEPLOYMENT.md) contiene el orden seguro para desplegar
staging, activar consentimiento, configurar R2 y publicar el monitor externo.

## Backups y restauracion

El backup de produccion es cifrado, genera SHA-256 y solo se considera correcto
despues de restaurarlo por completo en una base temporal:

```bash
docker compose --profile ops run --rm backup
```

`BACKUP_ENCRYPTION_PASSWORD` es obligatorio salvo que se habilite
deliberadamente `ALLOW_UNENCRYPTED_BACKUP=true`. La retencion local se controla
con `BACKUP_RETENTION_DAYS`.

Para conservar otra copia en Cloudflare R2 o almacenamiento S3 compatible,
primero activa R2 en el dashboard de Cloudflare. Si `wrangler r2 bucket list`
responde `Please enable R2`, el bucket aun no puede crearse por CLI.

Luego configura:

```text
BACKUP_S3_URI=s3://fame-plays-backups/production
AWS_ENDPOINT_URL_S3=https://ACCOUNT_ID.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=auto
```

El ejemplo [ops/fame-market-backup.cron.example](ops/fame-market-backup.cron.example)
programa una copia diaria. Antes de restaurar produccion, se recomienda probar
en una base nueva:

```bash
docker compose exec postgres createdb -U fame_market fame_market_restore_test
docker compose --profile ops run --rm \
  --entrypoint restore-postgres \
  -e RESTORE_FILE=/backups/fame-market-FECHA.dump.enc \
  -e TARGET_DATABASE=fame_market_restore_test \
  -e CONFIRM_RESTORE=RESTORE_FAME_MARKET \
  backup
```

En Windows, `npm run backup:local` crea y restaura una copia de prueba de la
base local. Esa copia es de desarrollo y no esta cifrada.

## Monitoreo

- `GET /api/health/live`: confirma que el proceso responde.
- `GET /api/health/ready`: valida PostgreSQL, migraciones y temporada activa.
- `GET /api/metrics`: metricas Prometheus protegidas con
  `x-monitoring-secret`.
- `/admin`: muestra tamano de la base y ultima ejecucion de backup, YouTube y
  ciclo de temporada.

Ejemplo de consulta protegida:

```bash
curl -H "x-monitoring-secret: $MONITORING_SECRET" \
  https://api.fameplays.com/api/metrics
```

El Worker de `ops/monitor-worker` consulta ambos endpoints cada cinco minutos,
revisa las metricas operativas y guarda el ultimo estado en KV. Avisa por
Telegram despues de dos fallos consecutivos si `TELEGRAM_BOT_TOKEN` y
`TELEGRAM_CHAT_ID` estan configurados; si faltan, el monitor sigue guardando
estado y registra que omitio la notificacion.

## Verificacion

```bash
npm run build
npm test
npm audit
npm run backup:local
npm run monitor:check
```

## Seguridad competitiva

Al cerrar una temporada, el top 10 queda pendiente de revision. El sistema
genera alertas por rendimiento inusual, exceso de operaciones, actividad muy
rapida y concentracion repetitiva en un solo artista.

El panel `/admin` permite:

- Aprobar o marcar un resultado.
- Guardar una nota interna.
- Congelar o reactivar una cuenta.
- Congelar o reactivar un artista.

Las acciones administrativas quedan registradas en `audit_logs`. Las alertas no
eliminan operaciones ni modifican balances automaticamente.

## Importante

FameCoins, precios y participaciones son ficticios. No representan acciones,
dinero, inversiones ni activos convertibles.

