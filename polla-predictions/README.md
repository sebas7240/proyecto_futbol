# Polla Predictions MVP

Modulo experimental dentro de `proyecto_futbol` para crear una plataforma de predicciones deportivas con:

- login con Firebase/Google
- agenda de partidos
- prediccion de ganador y marcador exacto
- creditos virtuales
- ranking semanal/mensual
- wallet Solana para posibles premios manuales
- vista publica responsive con ranking, historial personal y tarjetas de partidos

## Estructura

- `backend/`: API Express con usuarios, partidos, predicciones, ranking y resultados.
- `frontend/`: aplicacion React + Vite.
- `PLAN.md`: roadmap y estado del desarrollo.

## Objetivo

Validar una experiencia jugable sin afectar la web principal. La primera version debe permitir iniciar sesion, elegir un partido, predecir ganador y marcador exacto, gastar creditos y aparecer en ranking cuando el sistema liquide resultados.

## Como arrancar

1. Ir a `polla-predictions/backend` y ejecutar `npm install`.
2. Ir a `polla-predictions/frontend` y ejecutar `npm install`.
3. Crear `polla-predictions/backend/.env` con `FIREBASE_SERVICE_ACCOUNT_BASE64`, `ADMIN_SECRET` y, opcionalmente, `THESPORTSDB_API_KEY`.
4. Crear `polla-predictions/frontend/.env` con las variables de Firebase.
5. Ejecutar backend: `npm run dev`.
6. Ejecutar frontend: `npm run dev`.

## Estado

El frontend compila y el backend tiene reglas MVP basicas: maximo 5 predicciones por dia, costo de 20 creditos, ganador + marcador exacto, persistencia inicial en Firestore, ranking visible, historial personal, motor de liquidacion manual y sincronizacion inicial de partidos desde TheSportsDB.

## Experiencia publica

La pantalla principal esta pensada como una web/app deportiva:

- hero con marca `Golea Predictions`
- partido destacado
- estadisticas del usuario
- tabs para jugar, ranking, mis jugadas y resultados
- vista movil con navegacion inferior
- tarjetas con escudos cuando la API los entrega

## Admin interno

El admin interno vive separado de la vista publica en:

```txt
/admin
```

Incluye dos tareas protegidas por `ADMIN_SECRET`:

- sincronizar proximos partidos desde TheSportsDB
- liquidar un partido con marcador final exacto

La clave admin no se guarda en el navegador; se escribe solo cuando se necesita operar.

## Sincronizacion de partidos

La sincronizacion usa la API v1 gratis de TheSportsDB. Por defecto:

```env
THESPORTSDB_API_KEY=123
THESPORTSDB_LEAGUE_IDS=4429,4328,4335
THESPORTSDB_SYNC_DAYS=3
AUTO_SYNC_ENABLED=false
AUTO_SYNC_INTERVAL_MINUTES=60
AUTO_SETTLE_SYNCED_RESULTS=false
```

Endpoint manual:

```bash
curl -X POST http://localhost:4000/api/matches/sync/thesportsdb \
  -H "x-admin-secret: TU_ADMIN_SECRET"
```

Los partidos se guardan en Firestore en `polla_matches`. Si no hay partidos sincronizados, el backend conserva los partidos demo como respaldo.

La sincronizacion combina proximos partidos por liga con agenda diaria de futbol para los proximos dias. Con el plan gratis conviene mantener `THESPORTSDB_SYNC_DAYS` bajo para respetar el limite de solicitudes.

Si `AUTO_SYNC_ENABLED=true`, el backend ejecuta sincronizacion en segundo plano cada `AUTO_SYNC_INTERVAL_MINUTES`. Si ademas `AUTO_SETTLE_SYNCED_RESULTS=true`, intenta liquidar partidos sincronizados que ya tengan marcador final.

## Liquidacion manual

Mientras no tengamos liquidacion automatica por API, un administrador puede liquidar un partido manualmente:

```bash
curl -X POST http://localhost:4000/api/results/settle \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_ADMIN_SECRET" \
  -d "{\"matchId\":\"match-001\",\"homeScore\":2,\"awayScore\":1}"
```

El motor:

- guarda el resultado final en Firestore
- revisa predicciones pendientes del partido
- marca cada prediccion como `WON` o `LOST`
- suma puntos solo si el marcador exacto coincide
- evita volver a sumar puntos si el partido ya fue liquidado
