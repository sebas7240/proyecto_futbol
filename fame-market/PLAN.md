# Fame Market - Plan de producto y desarrollo

## 1. Vision refinada

Crear un juego social de popularidad musical donde todos los jugadores reciben
la misma cantidad de monedas ficticias al comenzar una temporada y compran o
venden participaciones ficticias de artistas.

El objetivo no es ganar dinero real ni invertir. El objetivo es detectar antes
que otros que artista ganara atencion, hacer crecer un portafolio ficticio y
subir en el ranking.

Propuesta de valor:

> No inviertes dinero. Inviertes intuicion musical.

Nombre provisional: `Fame Market`.

## 2. Enfoque inicial

La primera version se enfocara exclusivamente en artistas musicales.

Cada artista tendra:

- Nombre, fotografia, pais y genero.
- Uno o varios canales oficiales de YouTube.
- Precio ficticio actual.
- Cambio de precio de 24 horas y de la temporada.
- Ultimos videos elegibles.
- Estadisticas publicas actuales de esos videos.
- Historial de precio.
- Cantidad de jugadores que lo tienen en su portafolio.

El MVP comenzara con 20 a 30 artistas seleccionados por el administrador. No se
permitira que los usuarios creen artistas durante la primera version.

## 3. Decision importante sobre YouTube

Tecnologicamente es posible consultar canales, videos, vistas, likes y
comentarios con YouTube Data API.

Sin embargo, las politicas actuales de YouTube API prohiben usar sus datos para
crear un score o metrica derivada. Por esa razon, el MVP no debe calcular
automaticamente el precio mezclando vistas y comentarios obtenidos de la API.

Modelo recomendado para el MVP:

1. YouTube muestra informacion publica actualizada para ayudar al jugador a
   tomar decisiones.
2. El precio ficticio se mueve por la demanda interna de compra y venta.
3. Los datos de YouTube se muestran sin alterarlos, con atribucion clara.
4. En una fase futura se podra agregar movimiento externo automatico usando un
   proveedor de datos cuya licencia permita crear indices derivados.

Esto conserva la esencia del juego: el jugador analiza si las vistas y
comentarios estan creciendo y decide comprar antes que los demas.

Referencias:

- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/playlistItems/list
- https://developers.google.com/youtube/v3/docs/videos/batchGetStats
- https://developers.google.com/youtube/terms/developer-policies

## 4. Ciclo principal del jugador

1. Inicia sesion con Google.
2. Recibe 10.000 FameCoins al comenzar la temporada semanal.
3. Revisa artistas, ultimos videos y datos publicos de YouTube.
4. Compra participaciones del artista que cree que aumentara su demanda.
5. Vende cuando considera que llego a su mejor precio.
6. Consulta el valor de su portafolio y su rendimiento porcentual.
7. Compite en el ranking semanal.
8. Al terminar la semana se congela el mercado, se publican resultados y todos
   comienzan una nueva temporada con el mismo capital.

## 5. Motor de precio del MVP

### Principio

El sistema actuara como contraparte automatica. No sera necesario esperar a que
otro usuario quiera vender para poder comprar.

Cada compra empuja el precio ligeramente hacia arriba y cada venta lo empuja
hacia abajo. El impacto depende de la cantidad negociada y de la liquidez del
artista.

Formula conceptual:

```text
nuevo_precio = precio_actual * exp(direccion * cantidad / liquidez)
```

Donde:

- `direccion` es `1` para compra y `-1` para venta.
- `cantidad` es el numero de participaciones.
- `liquidez` controla cuanto puede mover el precio una operacion.

La implementacion calculara el precio promedio de ejecucion para evitar que una
orden grande compre todas las participaciones al precio inicial.

### Controles de estabilidad

- Precio inicial: 100 FameCoins.
- Maximo 20% del portafolio en un solo artista.
- Maximo de variacion por artista: 12% diario durante la beta.
- Maximo de operaciones por usuario: 60 al dia.
- Pausa minima entre operaciones: 5 segundos.
- Sin ventas en corto.
- Sin apalancamiento.
- Sin transferencias de monedas entre usuarios.
- Comision ficticia de 0,25% para frenar compra y venta repetitiva.
- El administrador puede congelar un artista ante actividad sospechosa.

Los valores se ajustaran despues de observar una beta con usuarios reales.

## 6. Uso correcto de los ultimos videos

El administrador registrara el ID del canal oficial. El sistema obtendra su
playlist de subidas y consultara los videos recientes.

Reglas recomendadas:

- Mostrar los ultimos 5 videos elegibles.
- Separar Shorts de videos musicales normales.
- Excluir transmisiones en vivo, trailers repetidos y reuploads cuando no sean
  relevantes.
- Permitir que el administrador marque un video como elegible o no elegible.
- Empezar con un canal oficial principal por artista.
- Agregar canales VEVO o secundarios en una fase posterior.

Datos mostrados:

- Titulo.
- Miniatura.
- Fecha de publicacion.
- Vistas actuales.
- Likes actuales.
- Comentarios actuales.
- Enlace al video original.
- Fecha y hora de la ultima actualizacion.

No es necesario descargar videos ni comentarios individuales.

## 7. Estrategia de cuota de YouTube

No se usara `search.list` de forma recurrente.

Proceso:

1. Resolver manualmente el canal oficial una sola vez.
2. Obtener y guardar el ID de su playlist de subidas.
3. Consultar esa playlist cada 4 o 6 horas para detectar videos nuevos.
4. Consultar estadisticas de videos en lotes.
5. Actualizar los datos visibles cada 30 o 60 minutos.

Con 30 artistas y 5 videos por artista, el consumo esperado queda muy por
debajo de la cuota diaria predeterminada, siempre que se usen llamadas por lote.

La clave de YouTube permanecera solo en el backend.

## 8. Rankings y temporadas

### Ranking principal

El ranking semanal se calculara por rendimiento porcentual:

```text
rendimiento = ((valor_final - capital_inicial) / capital_inicial) * 100
```

El valor del portafolio incluye:

- FameCoins disponibles.
- Valor actual de todas las participaciones.

### Requisitos para clasificar

- Minimo 3 operaciones validas.
- Actividad en al menos 2 dias de la semana.
- Cuenta validada.
- No presentar alertas de abuso.

### Rankings secundarios

- Mejor novato.
- Mejor rendimiento diario.
- Portafolio mas constante.
- Mayor racha de participacion.
- Descubridor temprano: mayor rendimiento obtenido en una posicion abierta
  antes de una subida importante del mercado interno.

### Cierre

- Domingo 22:00: se bloquean nuevas compras.
- Domingo 22:30: se bloquean ventas y se congela el precio.
- Domingo 23:00: se calcula el ranking.
- El top queda pendiente de revision anti-fraude antes de entregar premios.

Los horarios se guardaran en UTC y se mostraran en la zona del usuario.

## 9. Reglas de producto

- FameCoins y participaciones no tienen valor monetario.
- FameCoins no se compran con dinero real en el MVP.
- No se permiten retiros, conversion a cripto ni intercambio entre usuarios.
- Cada temporada entrega el mismo capital inicial a todos.
- No debe presentarse como inversion, accion real o rentabilidad financiera.
- La interfaz usara terminos como juego, popularidad, portafolio ficticio,
  temporada, puntos y ranking.
- Si existen premios reales o patrocinados, se requiere una revision legal de
  las reglas del concurso antes del lanzamiento publico.

## 10. Arquitectura recomendada

El proyecto vivira aislado en `fame-market/` dentro del repositorio actual.

### Frontend

- React.
- TypeScript.
- Vite.
- React Router.
- TanStack Query para estado de servidor y cache.
- Lightweight Charts para graficas de precio con atribucion a TradingView.
- Firebase Auth para login con Google.
- CSS propio con variables de diseno; enfoque mobile-first.
- PWA desde la primera beta.
- Capacitor para generar Android desde el mismo frontend cuando la beta web
  quede estable.

### Una sola experiencia para web y app

- Web, PWA y APK consumiran la misma API.
- El frontend React sera compartido; solo las integraciones nativas viviran
  detras de adaptadores de Capacitor.
- Balance, posiciones, operaciones y graficas vendran siempre del backend.
- El dispositivo solo guardara preferencias, cache de lectura y sesion.
- Una operacion hecha en la web aparecera en la APK al refrescar la cuenta.
- La primera APK no tendra una logica de mercado propia ni una base de datos
  separada.

### Graficas

- Linea o area como vista predeterminada en movil.
- Velas y volumen como vista avanzada posterior.
- Rangos: 1 hora, 24 horas, 7 dias y temporada.
- Marcadores de compra y venta del usuario sobre la grafica.
- Precio promedio de entrada visible.
- Rendimiento realizado y no realizado separado.
- Actualizacion incremental sin reconstruir toda la grafica.
- Aviso visible de que el precio es ficticio y pertenece al juego.

### Backend

- Node.js.
- TypeScript.
- Express para mantener coherencia con los proyectos actuales.
- Zod para validacion de entradas y variables de entorno.
- `node-postgres` con SQL versionado y transacciones explicitas.
- PostgreSQL.
- Tareas programadas separadas para sincronizacion y cierre de temporadas.
- Logs estructurados con Pino.

### Infraestructura

- Frontend en Cloudflare Pages.
- API en un contenedor Docker independiente en Hetzner.
- PostgreSQL en contenedor privado con volumen persistente.
- Caddy como proxy HTTPS.
- Cloudflare delante de la API para WAF y rate limit.
- Backups diarios cifrados de PostgreSQL.
- Dominio y rutas separados de Golea y Polla Predictions.

Ejemplo:

- `fama.goleafutbol.com`
- `api.goleafutbol.com/fama`

No se modificara ni detendra ningun servicio existente para desarrollar este
modulo.

## 11. Modelo de datos inicial

### users

- id
- firebase_uid
- display_name
- avatar_url
- status
- created_at
- last_login_at

### artists

- id
- slug
- name
- country
- genre
- image_url
- status
- initial_price
- current_price
- liquidity
- created_at

### artist_channels

- id
- artist_id
- youtube_channel_id
- uploads_playlist_id
- channel_title
- is_primary
- last_synced_at

### videos

- id
- artist_id
- youtube_video_id
- title
- thumbnail_url
- published_at
- duration_seconds
- video_type
- eligibility_status
- last_synced_at

### video_snapshots

- id
- video_id
- view_count
- like_count
- comment_count
- captured_at

Se conservaran y actualizaran de acuerdo con las politicas de YouTube.

### seasons

- id
- name
- starts_at
- trading_closes_at
- ends_at
- starting_balance
- status

### wallets

- id
- user_id
- season_id
- available_balance
- portfolio_value
- version

### positions

- id
- user_id
- season_id
- artist_id
- quantity
- average_cost
- realized_pnl

### trades

- id
- user_id
- season_id
- artist_id
- side
- quantity
- average_price
- fee
- idempotency_key
- created_at

### price_ticks

- id
- artist_id
- season_id
- price
- buy_volume
- sell_volume
- created_at

### ledger_entries

- id
- wallet_id
- trade_id
- type
- amount
- balance_after
- created_at

### rankings

- id
- season_id
- user_id
- final_value
- return_percent
- rank
- review_status

### audit_logs

- id
- actor_id
- action
- entity_type
- entity_id
- metadata
- created_at

## 12. API inicial

Publica:

- `GET /artists`
- `GET /artists/:slug`
- `GET /artists/:slug/history`
- `GET /artists/:slug/videos`
- `GET /seasons/current`
- `GET /rankings/current`

Usuario autenticado:

- `GET /me`
- `GET /me/portfolio`
- `GET /me/trades`
- `GET /me/favorites`
- `PUT /me/favorites/:artistId`
- `DELETE /me/favorites/:artistId`
- `POST /trades/quote`
- `POST /trades`

Admin:

- `POST /admin/artists`
- `PATCH /admin/artists/:id`
- `POST /admin/artists/:id/channels`
- `POST /admin/youtube/sync`
- `PATCH /admin/videos/:id/eligibility`
- `POST /admin/seasons`
- `POST /admin/seasons/:id/freeze`
- `POST /admin/seasons/:id/close`
- `GET /admin/security/alerts`

## 13. Integridad y seguridad

- Todas las compras se ejecutan en una transaccion de PostgreSQL.
- El cliente nunca puede modificar balances o posiciones directamente.
- Cada orden utiliza una clave de idempotencia para evitar cobros duplicados.
- Se bloquea la fila de wallet y del artista durante la operacion.
- Firebase ID Token se verifica en el backend.
- Rate limit por usuario e IP.
- Cloudflare Turnstile o Firebase App Check en acciones sensibles.
- Auditoria inmutable de operaciones administrativas.
- Deteccion de multicuentas y patrones repetitivos.
- Validacion manual del top antes de entregar premios.
- Clave de YouTube y credenciales de base de datos fuera de Git.

## 14. Experiencia visual

La primera pantalla debe ser el mercado, no una landing promocional.

### Movil

- Saldo y ranking visibles arriba.
- Tabs inferiores: Mercado, Portafolio, Ranking y Perfil.
- Tarjetas compactas de artistas.
- Compra y venta en un panel inferior.
- Graficas legibles y sin tablas anchas.

### Escritorio

- Mercado central.
- Portafolio resumido en columna lateral.
- Ranking y movimientos recientes visibles sin saturar.
- Filtros por pais, genero, tendencia y favoritos.

Estados necesarios:

- Cargando.
- Sin datos.
- Mercado cerrado.
- Artista congelado.
- Orden en proceso.
- Orden completada.
- Orden rechazada con causa clara.
- YouTube temporalmente no disponible.

## 15. Fases de desarrollo

### Fase 0 - Validacion tecnica y reglas

- [ ] Confirmar nombre y dominio.
- [ ] Elegir los primeros 20 a 30 artistas.
- [x] Activar YouTube Data API y crear una API key permitida para esa API.
- [x] Implementar consulta de canales, playlist de subidas y estadisticas.
- [ ] Definir reglas publicas del juego.
- [ ] Confirmar el uso permitido de datos antes de automatizar cualquier metrica
      derivada.

Criterio:

- Podemos obtener y actualizar legalmente los datos que mostraremos.

### Fase 1 - Base del proyecto

- [x] Crear `frontend`, `backend` y configuracion Docker inicial.
- [x] Crear PostgreSQL, migraciones SQL y clúster local aislado.
- [x] Configurar Firebase Auth en frontend y verificacion de tokens en backend.
- [x] Crear prototipo local de usuarios, artistas, temporadas y mercado.
- [x] Preparar la misma interfaz para web/PWA y futura APK con Capacitor.
- [x] Agregar pruebas y configuracion local.
- [ ] Preparar staging y produccion.

Criterio:

- Un administrador crea artistas y un usuario puede iniciar sesion.

### Fase 2 - Integracion de YouTube

- [x] Crear vista admin para registrar canales oficiales por ID o `@handle`.
- [x] Obtener playlist de subidas.
- [x] Detectar videos recientes.
- [x] Consultar estadisticas por lote.
- [x] Guardar snapshots permitidos.
- [x] Mostrar estadisticas con atribucion.
- [x] Manejar contadores ausentes, directos activos y videos no disponibles.
- [x] Crear sincronizacion manual y tarea programada opcional.
- [x] Eliminar snapshots con mas de 30 dias.
- [x] Configurar una API key de YouTube autorizada y ejecutar la primera
      sincronizacion real.

Criterio:

- Cada artista muestra correctamente sus ultimos videos y estadisticas actuales.

### Fase 3 - Mercado ficticio

- [x] Implementar prototipo en memoria de wallets por temporada.
- [x] Implementar cotizacion previa con vencimiento.
- [x] Implementar compra y venta atomica con transacciones PostgreSQL.
- [x] Implementar impacto de precio y comision.
- [x] Implementar limites iniciales de posicion y operacion.
- [x] Migrar ledger, posiciones, operaciones e historial de precio a PostgreSQL.
- [x] Probar operaciones duplicadas mediante idempotencia.
- [x] Probar idempotencia concurrente con varias conexiones PostgreSQL.

Criterio:

- Dos usuarios pueden operar simultaneamente sin balances negativos ni
  duplicados.

### Fase 4 - Experiencia jugable

- [x] Construir primera vista responsive del mercado.
- [x] Construir primera ficha del artista.
- [x] Construir primer resumen de portafolio.
- [x] Construir flujo inicial de cotizacion, compra y venta.
- [x] Agregar favoritos persistentes, filtros y busqueda responsive.
- [x] Agregar grafica de precio inicial.
- [x] Agregar marcadores personales de compra y venta en la grafica.
- [x] Crear onboarding corto.

Criterio:

- Un usuario nuevo entiende y completa su primera compra en menos de dos
  minutos.

### Fase 5 - Temporadas y rankings

- [ ] Automatizar apertura, congelamiento y cierre.
- [ ] Calcular valor final y rendimiento.
- [ ] Crear ranking semanal.
- [ ] Agregar mejor novato y descubridor temprano.
- [ ] Reiniciar capital sin borrar el historial.
- [ ] Agregar revision anti-fraude del top.

Criterio:

- Una temporada completa puede ejecutarse sin ajustes manuales de balances.

### Fase 6 - Seguridad y administracion

- [ ] Rate limits.
- [ ] Turnstile o App Check.
- [ ] Alertas de operaciones sospechosas.
- [ ] Congelar usuario o artista.
- [ ] Auditoria de acciones admin.
- [ ] Backups y restauracion probada.
- [ ] Monitoreo de API, base de datos y sincronizacion de YouTube.

Criterio:

- El sistema resiste abuso basico y puede recuperarse de un fallo.

### Fase 7 - Beta cerrada

- [ ] Probar con 20 a 50 usuarios.
- [ ] Medir retencion diaria y semanal.
- [ ] Medir cantidad de operaciones por jugador.
- [ ] Ajustar liquidez, limites y comision.
- [ ] Recoger comentarios de usabilidad movil.
- [ ] Publicar reglas y politica de privacidad.

Criterio:

- Los usuarios entienden por que cambia el precio y regresan durante la semana.

### Fase 8 - Movimiento externo condicionado

Solo se implementara si existe un proveedor o permiso que autorice crear
metricas derivadas.

Posible formula futura:

```text
momentum =
  65% velocidad relativa de vistas +
  25% velocidad relativa de comentarios +
  10% frescura del lanzamiento
```

La velocidad debe compararse contra el rendimiento historico del mismo artista,
no contra totales globales. Luego se normaliza y se limita el ajuste diario.

Ejemplo conceptual:

```text
cambio_externo = limite(2.5% * tanh(momentum), -6%, 6%)
```

Este ajuste se aplicaria en una hora fija y quedaria registrado en auditoria.
No se construira sobre YouTube Data API mientras sus politicas no lo permitan.

## 16. Pruebas imprescindibles

- El saldo nunca puede ser negativo.
- Un usuario nunca puede vender mas de lo que posee.
- Repetir una misma solicitud no duplica una compra.
- Una operacion concurrente conserva balance y posicion correctos.
- El cierre de temporada usa un precio congelado.
- Un artista pausado no acepta operaciones.
- El ranking se calcula con el mismo capital inicial.
- La caida de YouTube no detiene el mercado.
- La sincronizacion no duplica videos.
- Las estadisticas visibles indican su hora de actualizacion.

## 17. MVP que recomiendo construir

La primera version publica debe incluir solo:

- 20 a 30 artistas.
- Login con Google.
- 10.000 FameCoins por temporada.
- Compra y venta ficticia.
- Precio impulsado por demanda interna.
- Ultimos 5 videos y estadisticas publicas de YouTube.
- Portafolio.
- Historial de operaciones.
- Ranking semanal.
- Panel admin.
- Diseno responsive.

Dejaria para despues:

- Comentarios internos.
- Clanes.
- Batallas.
- Cajas diarias.
- Referidos.
- Monedas de pago.
- App nativa.
- Precio externo automatizado.

## 18. Estado y siguiente paso

La primera vertical tecnica ya incluye:

1. Tres artistas iniciales.
2. PostgreSQL real con migraciones.
3. Firebase Auth real.
4. Compra, venta, ledger y precios persistentes.
5. PWA responsive y panel admin de YouTube.
6. Tres canales oficiales registrados y 30 videos reales sincronizados.
7. Busqueda, filtro latino y favoritos persistentes por usuario.
8. Marcadores personales de compra y venta en la grafica.
9. Onboarding para la primera operacion.
10. Prueba de concurrencia e idempotencia contra PostgreSQL real.

Siguiente bloque recomendado:

1. Automatizar apertura, congelamiento y cierre de temporadas.
2. Calcular el valor final de cada portafolio.
3. Crear el ranking semanal.
4. Mostrar historial de operaciones y rendimiento por temporada.
