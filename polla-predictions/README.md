# Polla Predictions MVP

Modulo experimental dentro de `proyecto_futbol` para crear una plataforma de predicciones deportivas con:

- login con Firebase/Google
- agenda de partidos
- mercados de prediccion estructurados
- creditos virtuales
- ranking semanal/mensual
- wallet Solana para posibles premios manuales

## Estructura

- `backend/`: API Express con usuarios, partidos, predicciones, ranking y resultados.
- `frontend/`: aplicacion React + Vite.
- `PLAN.md`: roadmap y estado del desarrollo.

## Objetivo

Validar una experiencia jugable sin afectar la web principal. La primera version debe permitir iniciar sesion, elegir un partido, hacer una prediccion, gastar creditos y aparecer en ranking.

## Como arrancar

1. Ir a `polla-predictions/backend` y ejecutar `npm install`.
2. Ir a `polla-predictions/frontend` y ejecutar `npm install`.
3. Crear `polla-predictions/backend/.env` con `FIREBASE_SERVICE_ACCOUNT_BASE64`.
4. Crear `polla-predictions/frontend/.env` con las variables de Firebase.
5. Ejecutar backend: `npm run dev`.
6. Ejecutar frontend: `npm run dev`.

## Estado

El frontend compila y el backend tiene reglas MVP basicas: maximo 5 predicciones por dia, costo de 20 creditos y mercados estructurados.
