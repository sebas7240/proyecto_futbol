# Polla Predictions MVP

Modulo experimental dentro de `proyecto_futbol` para crear una plataforma de predicciones deportivas con:

- login con Firebase/Google
- agenda de partidos
- prediccion de ganador y marcador exacto
- creditos virtuales
- ranking semanal/mensual
- wallet Solana para posibles premios manuales

## Estructura

- `backend/`: API Express con usuarios, partidos, predicciones, ranking y resultados.
- `frontend/`: aplicacion React + Vite.
- `PLAN.md`: roadmap y estado del desarrollo.

## Objetivo

Validar una experiencia jugable sin afectar la web principal. La primera version debe permitir iniciar sesion, elegir un partido, predecir ganador y marcador exacto, gastar creditos y aparecer en ranking cuando el sistema liquide resultados.

## Como arrancar

1. Ir a `polla-predictions/backend` y ejecutar `npm install`.
2. Ir a `polla-predictions/frontend` y ejecutar `npm install`.
3. Crear `polla-predictions/backend/.env` con `FIREBASE_SERVICE_ACCOUNT_BASE64`.
4. Crear `polla-predictions/frontend/.env` con las variables de Firebase.
5. Ejecutar backend: `npm run dev`.
6. Ejecutar frontend: `npm run dev`.

## Estado

El frontend compila y el backend tiene reglas MVP basicas: maximo 5 predicciones por dia, costo de 20 creditos, ganador + marcador exacto, persistencia inicial en Firestore y motor de liquidacion manual.

## Liquidacion manual

Mientras se integra una API deportiva real, un administrador puede liquidar un partido manualmente:

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
