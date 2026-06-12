# Polla Predictions - Plan de Desarrollo

## Vision

Crear una plataforma independiente de predicciones deportivas, sin transmisiones ni contenido protegido, donde los usuarios participen con creditos virtuales, compitan en rankings y puedan optar a premios mensuales mediante wallet Solana.

El MVP debe ser simple, justo y facil de entender: entrar, iniciar sesion, elegir un partido, hacer una prediccion, ver puntos y ranking.

## Principios del Proyecto

- Mantener este modulo aislado dentro de `proyecto_futbol`, sin afectar la web principal.
- Usar datos deportivos legales mediante API o fuentes permitidas.
- Guardar partidos, predicciones, usuarios y resultados en base de datos propia.
- No depender del scraping como base principal del producto.
- Priorizar experiencia movil, retencion diaria y reglas claras.
- Evitar dinero real dentro de la app en la primera etapa; usar creditos virtuales.

## Estado Actual

### Hecho

- Backend Express basico.
- Frontend React + Vite.
- Login con Firebase/Google iniciado.
- Endpoints iniciales de usuarios, partidos, predicciones, ranking y resultados.
- Campo de wallet Solana en perfil.
- Datos simulados de partidos como respaldo.
- Sincronizacion manual de partidos desde TheSportsDB hacia Firestore.
- Vista admin interna para sincronizar partidos y liquidar marcador exacto.
- Rediseño publico inicial con marca Golea Predictions, tabs moviles, ranking, historial y tarjetas de partido con escudos.
- Admin separado de la vista publica en `/admin`.
- Login Google reforzado con fallback por redireccion y diagnostico de dominios no autorizados.
- Registro de predicciones reforzado: partidos abiertos, descuento de creditos, historial inmediato y mensajes claros si el backend no responde.
- Scraper experimental de resultados.

### Problemas Detectados

- El frontend no compila por resolucion de tipos de Firebase.
- `nodemon` no esta instalado aunque el script `npm run dev` lo usa.
- Falta programar la sincronizacion automatica de partidos y resultados.
- La API publica ya usa Firebase en la experiencia principal; queda pendiente borrar codigo legacy no montado si no se reutiliza.
- Los partidos sincronizados aun no se liquidan automaticamente desde resultados reales.
- Falta pulir creditos diarios y recompensas recurrentes.
- Algunos endpoints publicos deben seguir revisandose antes de produccion.
- El frontend usa marcador exacto con ganador local/empate/visitante.
- El CSS tiene selectores erroneos con doble punto.
- El proyecto se versionara dentro del repo principal `sebas7240/proyecto_futbol`.

## Fase 0 - Base Tecnica

Objetivo: dejar el proyecto compilando, versionado y listo para desarrollo serio.

- [x] Revisar estado actual del codigo.
- [x] Actualizar este plan.
- [x] Corregir build del frontend.
- [x] Corregir script de desarrollo del backend.
- [x] Limpiar `.gitignore` para no subir `node_modules`, `dist`, logs ni `.env`.
- [x] Agregar `polla-predictions/` al repo principal sin secretos ni dependencias generadas.
- [x] Primer commit limpio del modulo dentro de `proyecto_futbol`.

Criterio de terminado:

- `npm run build` funciona en frontend.
- `npm start` funciona en backend.
- El repo queda listo para push sin secretos ni dependencias generadas.

## Fase 1 - MVP Jugable

Objetivo: que un usuario pueda jugar una polla basica de forma real.

- [x] Elegir un solo sistema de autenticacion. Recomendado: Firebase Auth.
- [x] Crear persistencia real inicial con Firestore para usuarios, predicciones y ranking.
- [ ] Crear modelo de datos:
  - usuarios
  - partidos
  - mercados
  - predicciones
  - resultados
  - rankings
  - creditos diarios
- [x] Reemplazar textarea por prediccion de marcador exacto:
  - ganador local
  - empate
  - ganador visitante
- [x] Validar que el ganador elegido coincida con el marcador.
- [ ] Bloquear predicciones cuando el partido inicia.
- [x] Limitar predicciones por usuario por dia.
- [x] Descontar creditos virtuales por prediccion.
- [x] Mostrar historial de predicciones del usuario.
- [x] Mostrar ranking general basico.
- [x] Rediseñar la vista publica para que sea responsive y llamativa.
- [x] Separar el admin interno de la experiencia publica.
- [x] Reforzar login con Google para popup bloqueado/cerrado y dominios no autorizados.
- [x] Confirmar registro de prediccion exacta, descuento de creditos e historial inmediato.

Criterio de terminado:

- Un usuario inicia sesion, predice, gasta creditos y aparece en ranking.

## Fase 2 - Datos Deportivos Reales

Objetivo: sincronizar partidos y resultados sin depender de carga manual.

- [x] Integrar TheSportsDB como primera fuente.
- [x] Guardar partidos localmente desde la API externa.
- [x] Crear vista admin interna para sincronizar partidos.
- [x] Crear tarea programada opcional para sincronizar proximos partidos.
- [x] Crear tarea programada opcional para actualizar resultados sincronizados.
- [ ] Relacionar resultado final con predicciones.
- [ ] Calcular automaticamente:
  - marcador exacto
  - ganador derivado del marcador
- [x] Crear motor de liquidacion de puntos por marcador exacto.
- [x] Registrar auditoria de liquidaciones en Firestore.
- [x] Crear vista admin interna para liquidacion manual.
- [x] Conectar liquidacion automatica opcional desde resultados sincronizados.
- [x] Preparar sincronizacion automatica opcional por variables de entorno.
- [x] Preparar liquidacion opcional de partidos finalizados sincronizados.

Criterio de terminado:

- El sistema crea partidos automaticamente y liquida predicciones al terminar.

## Fase 3 - Retencion y Comunidad

Objetivo: hacer que los usuarios vuelvan diariamente.

- [ ] Creditos virtuales diarios.
- [ ] Rachas por ingreso diario.
- [ ] Mejorar estado vacio y onboarding para usuarios nuevos.
- [ ] Mostrar tarjetas de logro o progreso diario.
- [ ] Misiones diarias:
  - hacer 3 predicciones
  - acertar un ganador
  - acertar mas/menos goles
- [ ] Ranking semanal.
- [ ] Ranking mensual.
- [ ] Perfil publico sencillo.
- [ ] Compartir posicion en ranking.
- [ ] Integracion con Telegram o comunidad.

Criterio de terminado:

- El usuario tiene razones claras para volver cada dia.

## Fase 4 - Premios y Monetizacion

Objetivo: validar premios sin crear riesgos innecesarios.

- [ ] Validar legalmente el modelo de premios.
- [ ] Definir reglas publicas del concurso.
- [ ] Solicitar wallet Solana solo a usuarios elegibles.
- [ ] Registrar ganadores mensuales.
- [ ] Preparar pagos manuales en USDT/Solana.
- [ ] Agregar seccion de patrocinadores o anuncios controlados.

Criterio de terminado:

- Hay un flujo transparente de ranking, ganador y pago manual verificable.

## Fase 5 - Escala

Objetivo: preparar el producto para crecimiento.

- [ ] Separar ambientes local/staging/produccion.
- [ ] Agregar logs y monitoreo.
- [ ] Agregar rate limits.
- [ ] Agregar validacion fuerte de inputs.
- [ ] Agregar backups de base de datos.
- [ ] Deploy backend en VPS o plataforma serverless.
- [ ] Deploy frontend en Cloudflare Pages.
- [ ] Preparar PWA o app movil si el MVP funciona.

## Recomendacion Actual

La prioridad no es agregar muchos mercados avanzados. La prioridad es terminar un MVP divertido y confiable con pocos mercados, ranking claro y creditos diarios.

Mercados avanzados como tarjetas, corners, primer goleador o asistencias deben esperar hasta tener una API premium y usuarios activos.
