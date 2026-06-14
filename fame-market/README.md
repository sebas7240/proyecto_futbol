# Fame Market

Juego independiente de popularidad musical. Web, PWA y futura APK comparten el
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
- Canales oficiales verificados para Shakira, Karol G y Bad Bunny.
- Busqueda, filtro latino y favoritos persistentes por usuario.
- Marcadores personales de compra y venta sobre la grafica.
- Onboarding corto para la primera operacion.
- Prueba de concurrencia e idempotencia contra PostgreSQL real.
- Temporadas semanales con congelamiento y cierre automaticos.
- Ranking en vivo, ranking final e historial personal.
- Controles administrativos para procesar el ciclo de temporada.
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
- `FIREBASE_PROJECT_ID`
- `YOUTUBE_API_KEY`
- `ADMIN_SECRET`
- `SEASON_AUTOMATION_ENABLED`
- `SEASON_CYCLE_INTERVAL_MINUTES`
- variables `VITE_FIREBASE_*`

Los archivos `.env` estan ignorados por Git.

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

Canales iniciales registrados:

- `@Shakira`
- `@KarolG`
- `@BadBunnyPR`

## Docker

```bash
docker compose up --build
```

En produccion deben suministrarse contrasenas y secretos reales mediante
variables de entorno.

## Verificacion

```bash
npm run build
npm test
npm audit
```

## Importante

FameCoins, precios y participaciones son ficticios. No representan acciones,
dinero, inversiones ni activos convertibles.
