# Fame Plays - Plan de producto y desarrollo

## 1. Vision refinada

Crear un juego social sobre la economia de la atencion donde todos los
jugadores reciben la misma cantidad de monedas ficticias al comenzar una
temporada y compran o venden participaciones ficticias de figuras publicas.

El universo puede mezclar:

- Artistas musicales.
- Creadores de contenido e influencers.
- Streamers.
- Actores, actrices y personalidades de cine o television.
- Otras categorias futuras cuya popularidad pueda medirse con fuentes
  confiables y reglas comparables.

El objetivo no es ganar dinero real ni invertir. El objetivo es detectar antes
que otros que figura ganara atencion, hacer crecer un portafolio ficticio y
subir en el ranking.

Propuesta de valor:

> No inviertes dinero. Inviertes intuicion sobre quien capturara la atencion.

Nombre definitivo para web y app: `Fame Plays`.

## 2. Enfoque inicial

La beta tendra un catalogo mixto, pequeno y administrado. No se agregaran
cientos de figuras sin datos consistentes solo para aparentar variedad.

Categorias iniciales recomendadas:

- `musica`: cantantes, grupos y productores con actividad publica verificable.
- `creadores`: influencers, youtubers y streamers.
- `cine-tv`: actores, actrices, presentadores y otras figuras audiovisuales.
- `deportes`: deportistas y figuras competitivas con eventos verificables.
- `otros`: categoria temporal para pruebas antes de crear una vertical propia.

Perfiles estrategicos visibles:

- `stable`: figuras consolidadas, movimientos esperados mas defensivos.
- `balanced`: figuras con actividad frecuente y riesgo medio.
- `volatile`: figuras con gran sensibilidad a lanzamientos, memes o noticias
  verificadas.
- `underdog`: figuras en crecimiento que pueden ser interesantes para
  jugadores que buscan descubrir temprano.

Estos perfiles ayudan a jugar y comparar, pero no otorgan ventaja matematica
por si mismos. La formula de precio seguira dependiendo de operaciones y
senales aprobadas, no de etiquetas subjetivas.

Cada figura tendra:

- Nombre informativo, avatar abstracto o imagen con licencia verificada, pais,
  categoria y subcategoria.
- Profesion o especialidad visible.
- Perfil estrategico, nivel de riesgo y nota corta para orientar al usuario.
- Uno o varios perfiles o canales oficiales.
- Precio ficticio actual.
- Cambio de precio de 24 horas y de la temporada.
- Contenido o eventos publicos recientes, cuando la fuente lo permita.
- Estadisticas publicas mostradas con su fuente y hora de actualizacion.
- Historial de precio.
- Cantidad de jugadores que lo tienen en su portafolio.
- Explicacion de los ultimos movimientos externos aplicados al precio.

El MVP comenzara con 20 a 30 figuras seleccionadas por el administrador. La
mezcla exacta dependera de la calidad de las fuentes disponibles; no es
obligatorio repartir el mismo numero por categoria.

Los usuarios podran:

- Filtrar por categoria, subcategoria, pais, tendencia y favoritos.
- Buscar por nombre, simbolo, profesion o tema.
- Elegir intereses durante el onboarding para ordenar su mercado.
- Mantener una lista personal de seguimiento.

Los intereses solo personalizan la presentacion. No cambian precios, capital ni
reglas del ranking. Los usuarios no podran crear figuras durante la beta.

## 3. Decision importante sobre fuentes externas

YouTube sigue siendo una fuente util porque funciona tanto para musicos como
para creadores y algunas figuras de cine o television. Sin embargo, no todas
las categorias tendran un canal oficial relevante y ninguna fuente debe ser un
requisito universal del mercado.

Las politicas de YouTube limitan la creacion de metricas derivadas. Desde el 1
de junio de 2026 existen permisos adicionales para desarrolladores auditados
que los soliciten expresamente, pero no deben asumirse por defecto. Por esa
razon, Fame Plays no usara automaticamente vistas, likes o comentarios para
mover precios sin contar antes con permiso documentado.

Modelo recomendado para el MVP:

1. La demanda interna de compra y venta sigue siendo el motor dominante.
2. Un `Mercado Vivo` genera ticks automaticos para evitar activos congelados.
3. Un `Indice Automatico de Atencion` genera variaciones externas pequenas.
4. Wikimedia Pageviews sera la primera fuente universal para musica,
   creadores y cine/TV.
5. Cada senal se compara contra el historial de la misma figura. Nunca se
   comparan volumenes brutos entre figuras diferentes.
6. La primera implementacion se ejecuta en modo sombra y no modifica precios.
7. YouTube se incorporara al indice cuando se apruebe la solicitud de metricas
   derivadas. Twitch y GDELT se incorporaran como adaptadores especializados.
8. El control manual queda reservado para corregir identidades, congelar una
   fuente o detener una automatizacion defectuosa; no sera el oraculo diario.

Spotify no sera una dependencia central. En 2026 su modo de desarrollo esta
limitado a pruebas pequenas y el acceso ampliado exige requisitos que el
proyecto aun no cumple. Puede evaluarse mas adelante como integracion opcional,
pero el producto no dependera de ella para funcionar.

Esto conserva la esencia del juego: el jugador analiza senales publicas,
contenido y eventos, y decide comprar antes que los demas.

Referencias:

- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/v3/docs/playlistItems/list
- https://developers.google.com/youtube/v3/docs/videos/batchGetStats
- https://developers.google.com/youtube/terms/developer-policies
- https://developers.google.com/youtube/terms/derived-metrics-policy
- https://support.google.com/youtube/contact/yt_api_form
- https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html
- https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- https://developers.google.com/search/blog/2025/07/trends-api
- https://dev.twitch.tv/docs/api/reference
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide

## 4. Ciclo principal del jugador

1. Inicia sesion con Google.
2. Recibe 10.000 FameCoins al comenzar la temporada semanal.
3. Explora figuras segun sus intereses y revisa datos, eventos y contenido
   publico.
4. Compra participaciones de la figura que cree que aumentara su demanda.
5. Vende cuando considera que llego a su mejor precio.
6. Consulta el valor de su portafolio y su rendimiento porcentual.
7. Compite en el ranking semanal.
8. Al terminar la semana se congela el mercado, se publican resultados y todos
   comienzan una nueva temporada con el mismo capital.

## 5. Motor de precio hibrido

### Principio

El sistema actuara como contraparte automatica. No sera necesario esperar a que
otro usuario quiera vender para poder comprar.

Cada compra empuja el precio ligeramente hacia arriba y cada venta lo empuja
hacia abajo. El impacto depende de la cantidad negociada y de la liquidez de la
figura.

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

### Indice Automatico de Atencion

El precio no dependera exclusivamente de compras y ventas, pero las senales
externas tendran una influencia pequena para conservar la habilidad del
jugador y evitar movimientos arbitrarios.

Formula conceptual:

```text
precio_final =
  limitar_banda_diaria(
    precio_AMM * exp(impacto_externo_pendiente)
  )
```

Primera formula determinista:

```text
crecimiento = log((promedio_ultimos_7_dias + 1) /
                  (promedio_21_dias_anteriores + 1))

senal = tanh(crecimiento / escala)
```

Reglas iniciales:

- El AMM y la demanda interna siguen siendo el componente principal.
- Se usa una ventana de 28 dias: 7 recientes y 21 de referencia.
- Existe una zona neutral para ignorar ruido pequeno.
- La primera fuente aislada puede proponer como maximo `+/-0,15%` diario.
- Dos o mas fuentes compatibles, cuyas licencias permitan combinacion, podran
  proponer hasta `+/-0,60%` diario. YouTube queda excluido de esta mezcla salvo
  autorizacion escrita expresa.
- El limite externo inicial aplicado sera `+/-0,60%` por figura al dia.
- La banda total diaria, incluyendo operaciones, sigue limitada al 12%.
- El resultado se calcula una vez por nueva ventana de datos y es idempotente.
- Una fuente ausente, atrasada o con error pierde peso; nunca se interpreta
  automaticamente como una senal negativa.
- Cada proveedor genera una senal aislada conforme a su propia licencia.
- YouTube no se mezclara con Wikimedia u otras fuentes salvo que una
  autorizacion escrita permita expresamente esa combinacion.
- Para aplicar precios se elegira una fuente primaria autorizada por figura;
  otras fuentes pueden mostrarse como contexto sin combinarse.
- Cada senal conserva observaciones, formula, desglose, fuente y hora.
- Los primeros 30 dias se ejecutan en modo sombra sin modificar precios.

Fuentes por etapas:

- Wikimedia Pageviews: base universal y gratuita.
- YouTube: musica y creadores, sujeto a aprobacion de metricas derivadas.
- Twitch: espectadores en directo para streamers.
- GDELT: velocidad de menciones en noticias, con peso bajo y cache.
- Google Trends: fuente opcional cuando se obtenga acceso a su API alpha.

No se aplicara sentimiento automatico en la primera version. Una noticia
negativa tambien puede aumentar la atencion, y el producto mide atencion, no
reputacion moral.

### Mercado Vivo

Para que la beta se sienta jugable incluso con pocos usuarios o figuras con
poca cobertura noticiosa, cada activo tendra un estado automatico:

- `bull`: sesgo alcista por varias horas.
- `bear`: sesgo bajista por varias horas.
- `sideways`: movimiento lateral con ruido pequeno.
- `volatile`: rango amplio y direccion menos estable.
- `viral`: pulso fuerte y poco frecuente, siempre limitado.

El estado se recalcula por ventanas de horas y usa memoria, perfil de
volatilidad, riesgo, hype, holders y noticias recientes. Cada tick queda
guardado como `source_type=market`, separado de `trade`, `news`, `season` y
`external_event`.

Reglas iniciales:

- Ticks automaticos cada 15 minutos en produccion.
- Limite por tick: hasta 0,90% solo en estados fuertes.
- Banda total recomendada del mercado vivo: +/-10% frente al ancla de precio.
- Si el precio toca banda, el sistema deja de empujar en esa direccion.
- Las noticias pueden inclinar el siguiente estado, pero no sustituyen el
  limite ni la auditoria del precio.

### Explicabilidad

La ficha de cada figura mostrara por separado:

- Movimiento por operaciones del mercado.
- Movimiento externo acumulado del dia.
- Fuentes y ventanas que justifican ese movimiento.
- Limite restante dentro de la banda diaria.
- Estado `sombra`, `aplicado`, `omitido` o `detenido`.

Asi el usuario entiende por que cambio el precio y puede distinguir demanda de
noticias o actividad externa.

### Controles de estabilidad

- Precio inicial: 100 FameCoins.
- Maximo 20% del portafolio en una sola figura.
- Maximo de variacion por figura: 12% diario durante la beta.
- Maximo de operaciones por usuario: 60 al dia.
- Pausa minima entre operaciones: 5 segundos.
- Sin ventas en corto.
- Sin apalancamiento.
- Sin transferencias de monedas entre usuarios.
- Comision ficticia de 0,25% para frenar compra y venta repetitiva.
- Todas las categorias comienzan con el mismo precio base; la liquidez se
  calibra por comportamiento del mercado, no por fama subjetiva.
- El administrador puede congelar una figura o un evento ante actividad
  sospechosa.

Los valores se ajustaran despues de observar una beta con usuarios reales.

## 6. Fuentes y contenido por categoria

Cada figura podra tener adaptadores de fuente independientes. Una figura puede
existir y operar aunque no tenga YouTube, siempre que el administrador pueda
verificar su identidad y sus eventos.

Fuentes iniciales:

- Wikimedia Analytics para medir variacion relativa de atencion.
- YouTube oficial para contenido visible y, con aprobacion, senales derivadas.
- Twitch para streamers con canal oficial.
- GDELT para volumen de noticias con consultas espaciadas y cacheadas.
- Google Trends cuando el proyecto reciba acceso oficial.
- Comunicados y perfiles oficiales como contexto visible, no como ajuste
  manual cotidiano.

Matriz inicial de eventos:

- Musica: lanzamiento, gira, colaboracion, premio o cancelacion oficial.
- Creadores: estreno relevante, proyecto anunciado, premio o hito permitido.
- Cine/TV: casting confirmado, estreno, renovacion, nominacion o premio.

No se usaran rumores, vida privada, acusaciones no verificadas ni volumen
bruto entre figuras distintas. Toda senal cuantitativa se comparara contra el
historial de la misma figura para no favorecer automaticamente a quien ya es
mas famoso.

El administrador registrara los IDs y URLs oficiales. Para YouTube, el sistema
obtendra la playlist de subidas y consultara contenido reciente.

Reglas recomendadas:

- Mostrar los ultimos 5 videos elegibles.
- Separar Shorts de videos musicales normales.
- Excluir transmisiones en vivo, trailers repetidos y reuploads cuando no sean
  relevantes.
- Permitir que el administrador marque un video como elegible o no elegible.
- Empezar con un canal oficial principal por figura.
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

No es necesario descargar videos ni comentarios individuales. En cine y
television puede mostrarse una cronologia de proyectos o eventos aprobados en
lugar de una lista de videos.

## 7. Estrategia de cuota de YouTube

No se usara `search.list` de forma recurrente.

Proceso:

1. Resolver manualmente el canal oficial una sola vez.
2. Obtener y guardar el ID de su playlist de subidas.
3. Consultar esa playlist cada 4 o 6 horas para detectar videos nuevos.
4. Consultar estadisticas de videos en lotes.
5. Actualizar los datos visibles cada 30 o 60 minutos.

Con 30 figuras y 5 videos por figura, el consumo esperado queda muy por
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

- Mejor novato: jugador mejor clasificado entre quienes disputan su primera
  temporada.
- Mejor rendimiento diario.
- Portafolio mas constante.
- Mayor racha de participacion.
- Descubridor temprano: jugador que realizo primero una compra de la figura que
  termino la temporada por encima de su precio de apertura. Si descubre varios,
  gana quien acumule mas descubrimientos y luego mejor posicion.
- Mejor por categoria: rendimiento mas alto entre portafolios elegibles con
  actividad suficiente en musica, creadores o cine/TV.

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
- Pagar, ver anuncios o invitar personas no puede aumentar el capital de una
  temporada clasificada ni multiplicar su rendimiento.
- Ningun plan premium puede recibir datos externos antes que los jugadores
  gratuitos.
- Una figura patrocinada debe estar identificada y el patrocinio no puede
  alterar precio, liquidez, ranking ni eventos.
- Si existen premios reales o patrocinados, se requiere una revision legal de
  las reglas del concurso antes del lanzamiento publico.

### Identidad, imagen y marcas

El uso de nombres de figuras publicas no se tratara como una autorizacion
general. Que un nombre no este protegido por copyright no elimina los riesgos
de marca, falsa afiliacion, derecho de imagen, competencia desleal o normas
locales.

Reglas obligatorias:

- Los nombres se usan para identificacion informativa y estadistica.
- Ninguna pantalla puede sugerir que una figura patrocina, administra o aprueba
  Fame Plays.
- El nombre y dominio de la plataforma deben ser originales y neutrales; no
  pueden contener el nombre, apodo, ticker o marca de una figura incluida.
- No se usaran logos, portadas, fotografias tomadas de buscadores ni material
  promocional sin una licencia o permiso verificable.
- Por defecto se muestran avatares abstractos de iniciales.
- Una caricatura o imagen de IA reconocible no se considera automaticamente
  segura y requiere la misma revision de semejanza y autorizacion.
- Toda imagen visible necesita estado, fuente, licencia, atribucion, fecha de
  revision y nota interna.
- Los datos publicos conservan los terminos y limites de su proveedor.
- Existira un formulario publico de correccion, retiro, marca o imagen, con
  bandeja administrativa y auditoria de la decision.
- Antes de premios, publicidad a gran escala o expansion internacional se
  realizara revision profesional en las jurisdicciones aplicables.

El aviso visible sera:

> Simulador independiente. Los nombres identifican figuras publicas con fines
> informativos. Fame Plays no esta afiliado, patrocinado ni aprobado por ellas
> o sus marcas.

Este enfoque reduce riesgo, pero el plan no afirmara que el producto es
“100% legal” ni sustituye asesoria juridica.

### Monetizacion justa

Ideas aceptadas para una fase posterior:

- Publicidad moderada.
- Suscripcion sin anuncios y con herramientas de analisis personal.
- Alertas personalizadas, estadisticas avanzadas y cosmeticos.
- Patrocinios de temporadas o categorias, claramente identificados.
- Contenido de YouTube que explique movimientos y resuma temporadas.

Ideas que no se implementaran en temporadas clasificadas:

- Vender FameCoins, vidas o reloads para recuperar una mala temporada.
- Multiplicadores de rendimiento.
- Acceso anticipado a noticias o senales.
- Mercados VIP con ventaja competitiva.
- Anuncios recompensados que aumenten el saldo del ranking.

Estas mecanicas podrian existir solo en un modo de practica separado que no
entregue posiciones, premios ni insignias competitivas.

### Referidos cualificados

El sistema de referidos es util, pero solo premiara usuarios reales:

- El invitado cuenta cuando completa al menos tres operaciones validas y tiene
  actividad en dos dias distintos.
- Un referido solo puede asociarse una vez y no puede autorreferirse.
- Se aplicaran controles de cuentas relacionadas y abuso.
- La recompensa sera una insignia, cosmetico, logro o funcion social.
- No se otorgara capital adicional ni ventaja matematica en el ranking.

### Premios por hitos

Los primeros premios pueden desbloquearse al alcanzar hitos de usuarios activos
verificados, por ejemplo 100, 500 o 1.000. El valor debe depender de ingresos
realmente recibidos o de un patrocinador, no de una promesa fija sin respaldo.

Definicion inicial de usuario activo para un hito:

- Cuenta autenticada y aceptacion vigente de reglas.
- Al menos tres operaciones validas.
- Actividad en dos dias distintos de la temporada.
- Sin alertas de abuso abiertas.

La interfaz puede mostrar una barra de progreso, pero el hito queda sujeto a
revision antifraude. En la primera version, el pago de cualquier premio sera
manual y solo se pedira una billetera al ganador aprobado. No se necesita una
billetera Web3, token ni contrato inteligente para participar.

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
- Preferencias de categorias y filtros persistentes por usuario.
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
- Marcas visuales distintas para operaciones y eventos externos.
- Panel breve que explique el origen de cada cambio de precio.
- Aviso visible de que el precio es ficticio y pertenece al juego.

### Backend

- Node.js.
- TypeScript.
- Express para mantener coherencia con los proyectos actuales.
- Zod para validacion de entradas y variables de entorno.
- `node-postgres` con SQL versionado y transacciones explicitas.
- PostgreSQL.
- Dominio generico basado en `market_entities`, no en artistas musicales.
- Adaptadores de fuentes para que cada categoria use proveedores distintos.
- Motor de eventos externos separado del motor transaccional.
- Tareas programadas separadas para sincronizacion y cierre de temporadas.
- Logs estructurados con Pino.

### Infraestructura

- Frontend en Cloudflare Pages.
- API en un contenedor Docker independiente en Hetzner.
- PostgreSQL en contenedor privado con volumen persistente.
- Caddy como proxy HTTPS.
- Cloudflare delante de la API para WAF y rate limit.
- Chat social en Cloudflare Durable Objects con WebSockets, aislado del VPS.
- Backups diarios cifrados de PostgreSQL.
- Dominio y rutas separados de Golea y Polla Predictions.
- Nombre y dominio definitivos sujetos a busqueda de marcas, redes sociales,
  tiendas de aplicaciones y riesgo de confusion.
- URLs configurables mediante variables de entorno para evitar acoplar el
  producto al dominio provisional.

Estructura objetivo:

- `app.fameplays.com`
- `api.fameplays.com`

No se modificara ni detendra ningun servicio existente para desarrollar este
modulo.

## 11. Modelo de datos objetivo

El codigo actual usa `artists` y `artist_id`. Antes de ampliar el catalogo se
realizara una migracion controlada hacia nombres genericos. Como solo existen
tres figuras y la beta publica aun no comenzo, hacerlo ahora reduce deuda
tecnica y evita condicionales por categoria en todo el sistema.

La migracion conservara IDs, balances, operaciones e historial. Durante una
version se podran mantener aliases de API para no romper clientes en pruebas.

### users

- id
- firebase_uid
- display_name
- avatar_url
- status
- created_at
- last_login_at

### market_entities

- id
- slug
- symbol
- name
- entity_type
- category
- subcategory
- country
- profession
- description
- image_url
- official_url
- status
- initial_price
- current_price
- opening_price
- daily_anchor_price
- liquidity
- external_impact_today_bps
- created_at

### entity_sources

- id
- entity_id
- provider
- source_type
- external_id
- source_url
- display_name
- is_primary
- usage_mode
- license_notes
- last_synced_at

### content_items

- id
- entity_id
- source_id
- external_id
- content_type
- title
- thumbnail_url
- published_at
- duration_seconds
- source_url
- eligibility_status
- last_synced_at

### content_snapshots

- id
- content_item_id
- view_count
- like_count
- comment_count
- captured_at

Los campos concretos pueden variar por proveedor. Los datos se conservaran y
actualizaran de acuerdo con la licencia y politica de cada fuente.

### external_events

- id
- entity_id
- source_id
- event_type
- direction
- magnitude_bps
- confidence
- headline
- explanation
- source_url
- occurred_at
- status
- approved_by
- approved_at
- applied_at
- created_at

Estados: `draft`, `approved`, `rejected`, `applied`, `cancelled`.

Los eventos manuales quedan como mecanismo excepcional de correccion y
seguridad. El flujo normal se modela con las tablas siguientes.

### attention_sources

- id
- entity_id
- provider
- external_id
- source_url
- weight_bps
- enabled
- metadata
- last_synced_at
- last_error

### attention_observations

- id
- source_id
- metric_name
- observed_at
- metric_value
- metadata
- captured_at

### attention_signals

- id
- entity_id
- window_ends_on
- algorithm_version
- normalized_score
- proposed_delta_bps
- applied_delta_bps
- confidence
- source_count
- mode
- breakdown
- created_at

### user_interests

- user_id
- category
- weight
- created_at
- updated_at

### referrals

- id
- referrer_user_id
- referred_user_id
- code
- status
- qualified_at
- reward_type
- rewarded_at

Solo se implementara despues de validar las reglas antiabuso.

### daily_position_rewards

- id
- wallet_id
- reward_date
- total_value
- position_count
- created_at

Regla inicial implementada: una vez por dia Colombia, si el usuario tiene
posiciones activas, recibe hasta 0,25% del saldo inicial de temporada, con tope
normal de 25 FameCoins de valor total. Se reparte proporcionalmente entre las
posiciones existentes, no mueve precio, no cobra comision y respeta el limite
del 20% por figura. No se marca como usado si el usuario aun no tiene
posiciones.

### daily_position_reward_items

- id
- reward_id
- artist_id
- quantity
- price
- market_value
- created_at

### growth_milestones

- id
- target_active_users
- verified_active_users
- reward_description
- funding_status
- status
- reached_at
- reviewed_at

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
- entity_id
- quantity
- average_cost
- realized_pnl

### trades

- id
- user_id
- season_id
- entity_id
- side
- quantity
- average_price
- fee
- idempotency_key
- created_at

### price_ticks

- id
- entity_id
- season_id
- price
- buy_volume
- sell_volume
- origin
- external_event_id
- external_delta_bps
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

- `GET /entities?category=&subcategory=&country=&sort=`
- `GET /entities/:slug`
- `GET /entities/:slug/history`
- `GET /entities/:slug/content`
- `GET /entities/:slug/events`
- `GET /categories`
- `GET /seasons/current`
- `GET /rankings/current`
- `GET /growth/milestones/current`

Durante la migracion, `/artists` puede responder como alias temporal de
`/entities?category=musica`.

Usuario autenticado:

- `GET /me`
- `GET /me/portfolio`
- `GET /me/trades`
- `GET /me/season-history`
- `GET /me/season-history/:seasonId/trades`
- `GET /me/favorites`
- `GET /me/interests`
- `PUT /me/interests`
- `PUT /me/favorites/:entityId`
- `DELETE /me/favorites/:entityId`
- `GET /me/referral`
- `POST /trades/quote`
- `POST /trades`

Admin:

- `POST /admin/entities`
- `PATCH /admin/entities/:id`
- `POST /admin/entities/:id/sources`
- `POST /admin/youtube/sync`
- `PATCH /admin/content/:id/eligibility`
- `POST /admin/external-events`
- `PATCH /admin/external-events/:id/review`
- `POST /admin/external-events/:id/apply`
- `POST /admin/seasons`
- `POST /admin/seasons/:id/freeze`
- `POST /admin/seasons/:id/close`
- `POST /admin/seasons/cycle`
- `GET /admin/security/alerts`
- `PATCH /admin/rankings/:seasonId/:userId/review`
- `PATCH /admin/users/:userId/status`
- `PATCH /admin/entities/:entityId/status`

## 13. Integridad y seguridad

- Todas las compras se ejecutan en una transaccion de PostgreSQL.
- El cliente nunca puede modificar balances o posiciones directamente.
- Cada orden utiliza una clave de idempotencia para evitar cobros duplicados.
- Se bloquea la fila de wallet y de la figura durante la operacion.
- Firebase ID Token se verifica en el backend.
- Rate limit persistente por usuario e IP para trading y administracion.
- Cloudflare Turnstile o Firebase App Check en acciones sensibles.
- Auditoria inmutable de operaciones administrativas.
- Todo evento externo requiere idempotencia, fuente, aprobacion y auditoria.
- La suma diaria de impactos externos se valida dentro de la misma transaccion
  que actualiza el precio.
- La IA nunca tiene credenciales para aplicar eventos directamente.
- Las cuentas administrativas no son elegibles para rankings ni premios.
- Todos los jugadores reciben un evento aplicado al mismo tiempo.
- Deteccion de multicuentas y patrones repetitivos.
- Validacion manual del top antes de entregar premios.
- Clave de YouTube y credenciales de base de datos fuera de Git.

## 14. Experiencia visual

La primera pantalla debe ser el mercado, no una landing promocional.

### Movil

- Saldo y ranking visibles arriba.
- Tabs inferiores: Mercado, Portafolio, Ranking y Perfil.
- Tarjetas compactas de figuras con categoria visible.
- Selector horizontal de intereses: Musica, Creadores y Cine/TV.
- Compra y venta en un panel inferior.
- Graficas legibles y sin tablas anchas.

### Escritorio

- Mercado central.
- Portafolio resumido en columna lateral.
- Ranking y movimientos recientes visibles sin saturar.
- Filtros combinables por categoria, subcategoria, pais, tendencia y favoritos.
- Vista opcional de mercado por categorias sin separar rankings.

Estados necesarios:

- Cargando.
- Sin datos.
- Mercado cerrado.
- Figura congelada.
- Fuente externa atrasada o no disponible.
- Evento externo pendiente de revision.
- Orden en proceso.
- Orden completada.
- Orden rechazada con causa clara.
- Fuente de contenido temporalmente no disponible.

## 15. Fases de desarrollo

### Fase 0 - Validacion tecnica y reglas

- [x] Elegir nombre y dominio neutrales para beta: `Fame Plays` y
      `fameplays.com`.
- [ ] Completar busqueda de marcas y riesgo de confusion con evidencia
      fechada.
- [x] Elegir las primeras 20 a 30 figuras y su mezcla de categorias.
- [x] Verificar al menos una fuente util por figura.
- [x] Activar YouTube Data API y crear una API key permitida para esa API.
- [x] Implementar consulta de canales, playlist de subidas y estadisticas.
- [x] Definir reglas publicas del juego.
- [x] Publicar aviso de no afiliacion y politica de derechos.
- [x] Ocultar por defecto imagenes sin licencia verificada.
- [x] Crear registro administrativo de fuente, licencia y atribucion.
- [x] Crear formulario y bandeja de correccion o retiro.
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
- [x] Preparar configuracion reproducible de staging aislado.
- [x] Desplegar produccion en `fameplays.com` con backend aislado y Firebase
      propio.
- [x] Desplegar staging con API, frontend, Firebase y Turnstile aislados.

Criterio:

- Un administrador crea figuras y un usuario puede iniciar sesion.

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

- Cada figura con YouTube muestra correctamente su contenido y estadisticas.

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
- [x] Construir primera ficha de figura sobre el modelo inicial de artistas.
- [x] Mostrar perfil estrategico y riesgo para diferenciar estilos de juego.
- [x] Construir primer resumen de portafolio.
- [x] Construir flujo inicial de cotizacion, compra y venta.
- [x] Agregar favoritos persistentes, filtros y busqueda responsive.
- [x] Agregar grafica de precio inicial.
- [x] Agregar marcadores personales de compra y venta en la grafica.
- [x] Agregar velas japonesas, temporalidades y herramientas basicas.
- [x] Agregar regla interactiva para medir variacion porcentual.
- [x] Crear onboarding corto.
- [x] Agregar chat de texto por figura con WebSockets y Durable Objects.
- [x] Agregar emojis rapidos, reportes y moderacion admin del chat.
- [x] Agregar notas de voz de 1 a 10 segundos sin cargar el VPS.
- [x] Mantener audio en vivo como beta cerrada sin activarlo por defecto.

Criterio:

- Un usuario nuevo entiende y completa su primera compra en menos de dos
  minutos y puede comentar una figura sin afectar el motor de trading.

### Fase 5 - Temporadas y rankings

- [x] Automatizar apertura, congelamiento y cierre.
- [x] Calcular y congelar valor final y rendimiento.
- [x] Crear ranking semanal en vivo e historico.
- [x] Agregar mejor novato y descubridor temprano.
- [x] Reiniciar capital con una wallet nueva sin borrar el historial.
- [x] Agregar revision anti-fraude del top.

Criterio:

- Una temporada completa puede ejecutarse sin ajustes manuales de balances.

### Fase 6 - Seguridad y administracion

- [x] Rate limits.
- [x] Turnstile con pase HMAC de 30 minutos ligado al usuario.
- [x] Alertas de operaciones sospechosas.
- [x] Congelar usuario o figura.
- [x] Auditoria de acciones admin.
- [x] Backups y restauracion probada.
- [x] Monitoreo de API, base de datos y sincronizacion de YouTube.

Criterio:

- El sistema resiste abuso basico y puede recuperarse de un fallo.

### Fase 7 - Generalizacion e indice automatico

- [ ] Migrar `artists` a `market_entities` conservando IDs e historial.
- [ ] Migrar referencias `artist_id` a `entity_id`.
- [x] Crear categorias `musica`, `creadores`, `cine-tv`, `deportes` y
      `otros` sobre el catalogo actual.
- [x] Crear aliases compatibles `/entities` sin romper `/artists`.
- [ ] Generalizar definitivamente tablas, tipos internos y panel admin.
- [x] Crear adaptadores `entity_sources` y contenido generico compatible con
      YouTube.
- [x] Agregar filtros por categoria, busqueda ampliada e intereses.
- [x] Guardar intereses personales sin afectar reglas del mercado.
- [x] Crear tablas de fuentes, observaciones y senales de atencion.
- [x] Implementar adaptador de Wikimedia Pageviews.
- [x] Calcular la primera senal relativa con ventana 7 contra 21 dias.
- [x] Ejecutar Wikimedia en modo sombra sin modificar precios.
- [x] Crear sincronizacion manual y tarea programada opcional.
- [x] Exponer desglose y estado para administracion.
- [x] Reconstruir 30 ventanas historicas reales por figura en modo sombra.
- [x] Medir cobertura, dispersion, cambios de direccion y limites.
- [ ] Mantener el modo sombra activo durante 30 dias de produccion.
- [ ] Completar revision humana de falsos positivos y umbrales.
- [x] Preparar formulario, metodologia, privacidad y evidencias requeridas por
      YouTube.
- [x] Desplegar el dominio publico con HTTPS.
- [ ] Enviar la solicitud de metricas derivadas a YouTube.
- [x] Agregar adaptador GDELT para titulares publicos, cola con rate limit y
      reintentos ante respuestas 429.
- [ ] Evaluar y autorizar adaptadores de senal para YouTube y Twitch antes de
      permitir metricas derivadas o impacto en precio.
- [x] Crear `external_events` solo para correcciones excepcionales.
- [x] Aplicar automaticamente senales GDELT aprobadas con algoritmo v2,
      perfiles de volatilidad, 250 bps por senal, 400 bps diarios y circuit
      breaker total de 800 bps.
- [x] Implementar `Mercado Vivo` con estados por figura, ticks cada 15 minutos,
      hype, memoria y bandas para que todos los activos tengan movimiento.
- [x] Actualizar reglas y privacidad para el indice externo en modo sombra.
- [x] Crear la pagina publica de metodologia y aislamiento de proveedores.
- [x] Mostrar en la ficha publica fuentes verificadas y estado de cada fuente.
- [x] Publicar en produccion metodologia, fuentes y estado de cada fuente.
- [ ] Mostrar en la grafica y ficha que parte vino de operaciones y que parte de
      senales externas.
- [x] Mantener aliases temporales para clientes que aun consuman `/artists`.

Criterio:

- Musicos, creadores y actores pueden convivir en el mismo mercado y una senal
  externa nunca puede aplicarse sin fuente, limite, idempotencia y auditoria.

### Fase 8 - Beta cerrada

- [x] Redactar reglas y politica de privacidad.
- [x] Exigir consentimiento versionado antes de operar.
- [x] Implementar politica de nombres, imagenes y marcas.
- [ ] Obtener revision juridica local antes de habilitar premios o monetizacion
      a gran escala.
- [ ] Probar con 20 a 50 usuarios.
- [ ] Medir retencion diaria y semanal.
- [ ] Medir cantidad de operaciones por jugador.
- [ ] Medir uso del chat por figura y su impacto en retencion.
- [ ] Medir uso de notas de voz y reportes para ajustar limites.
- [ ] Medir uso y retencion por categoria.
- [ ] Ajustar liquidez, limites, comision e impacto externo.
- [ ] Comprobar que los usuarios entienden los dos origenes del precio.
- [ ] Recoger comentarios de usabilidad movil.
- [x] Publicar reglas y politica en los dominios definitivos.

Criterio:

- Los usuarios entienden por que cambia el precio y regresan durante la semana.

### Fase 9 - Activacion y expansion del indice

Solo se implementara si existe un proveedor o permiso que autorice crear
metricas derivadas.

Proceso:

1. Mantener un adaptador y contrato de uso por proveedor.
2. Guardar la observacion original y su hora.
3. Calcular cada senal contra el historial de la misma figura.
4. Ejecutar toda fuente nueva en modo sombra.
5. Comparar falsos positivos y estabilidad durante al menos 30 dias.
6. Exigir al menos dos fuentes independientes y confianza de 0,55 para todo
   movimiento automatico de noticias.
7. Permitir aplicacion solo a reglas deterministas, versionadas y aprobadas.
8. Poder detener una fuente sin detener el mercado.
9. Mantener cualquier metrica derivada de YouTube aislada de fuentes externas,
   salvo permiso escrito que autorice la combinacion.

```text
impacto_noticias = limite(
  senal_compuesta * confianza * perfil_volatilidad,
  -2.50%,
  +2.50%
)
limite_diario_noticias = +/-4.00%
circuit_breaker_total = +/-8.00%
```

No se construira sobre YouTube API sin el permiso adicional aplicable, ni
sobre Spotify como dependencia necesaria mientras el proyecto no cumpla sus
requisitos de acceso.

La solicitud de metricas derivadas de YouTube queda preparada pero aplazada.
No es un bloqueo para la beta: Wikimedia continuara en modo sombra y YouTube
seguira limitado a contenido y estadisticas permitidas, sin mover precios.

### Fase 10 - Crecimiento y premios sostenibles

- [ ] Crear codigos de referido unicos.
- [ ] Calificar referidos por actividad real y controles antiabuso.
- [ ] Entregar solo recompensas cosmeticas o sociales.
- [ ] Definir y medir usuarios activos verificados.
- [ ] Crear hitos de 100, 500 y 1.000 usuarios activos.
- [ ] Mostrar barra de progreso sujeta a revision.
- [ ] Registrar fuente de financiacion y estado del premio.
- [ ] Mantener pago manual al ganador aprobado durante la primera etapa.
- [ ] Evaluar publicidad moderada y suscripcion sin ventajas competitivas.
- [ ] Preparar estrategia editorial de YouTube: movimientos semanales,
      explicaciones del mercado y resumen transparente de temporadas.
- [ ] Evaluar audio chat por salas con TURN, moderacion y limites antes de
      abrirlo al publico.

Criterio:

- El crecimiento puede financiar premios sin prometer dinero no recibido ni
  romper la igualdad competitiva.

## 16. Pruebas imprescindibles

- El saldo nunca puede ser negativo.
- Un usuario nunca puede vender mas de lo que posee.
- Repetir una misma solicitud no duplica una compra.
- Una operacion concurrente conserva balance y posicion correctos.
- El cierre de temporada usa un precio congelado.
- Una figura pausada no acepta operaciones.
- El ranking se calcula con el mismo capital inicial.
- La caida de YouTube no detiene el mercado.
- La sincronizacion no duplica videos.
- Las estadisticas visibles indican su hora de actualizacion.
- Una ventana de atencion repetida no crea dos ajustes.
- Ninguna senal supera el limite individual o diario.
- Una senal en modo sombra no modifica precios.
- Una fuente caida pierde peso y no genera una caida artificial.
- Una figura con menos de 28 dias validos no genera ajuste.
- La suma de operaciones y eventos respeta la banda diaria.
- El historial distingue `trade`, `external_event` y `season`.
- Cambiar intereses del usuario no altera saldo, precios ni ranking.
- Un referido no se califica antes de cumplir todos los requisitos.

## 17. MVP que recomiendo construir

La primera version publica debe incluir solo:

- 20 a 30 figuras curadas de musica, creadores y cine/TV.
- Login con Google.
- 10.000 FameCoins por temporada.
- Compra y venta ficticia.
- Bonus diario pequeno en posiciones existentes para mejorar retencion.
- Precio dominado por demanda interna.
- Indice Automatico de Atencion con impacto pequeno, limitado y explicable.
- Wikimedia como base universal y 30 dias iniciales en modo sombra.
- Filtros por categoria e intereses personales.
- Contenido y estadisticas de YouTube donde exista canal oficial.
- Cronologia de eventos para figuras sin canal relevante.
- Portafolio.
- Historial de operaciones.
- Ranking semanal.
- Panel admin.
- Diseno responsive.

Dejaria para despues:

- Llamadas de audio en vivo; las notas de voz cortas ya estan implementadas.
- Clanes.
- Batallas.
- Cajas diarias.
- Referidos.
- Monedas de pago.
- App nativa.
- Activacion de precios externos antes de completar el modo sombra.
- Spotify como fuente obligatoria.
- Pagos automaticos o contratos inteligentes.
- Ventajas competitivas por anuncios, referidos o suscripciones.

## 18. Estado y siguiente paso

La primera vertical tecnica ya incluye:

1. Tres artistas iniciales sobre el modelo que sera generalizado.
2. PostgreSQL real con migraciones.
3. Firebase Auth real.
4. Compra, venta, ledger y precios persistentes.
5. PWA responsive y panel admin de YouTube.
6. Veinticuatro canales oficiales registrados y mas de 240 contenidos reales
   sincronizados.
7. Busqueda, filtro latino y favoritos persistentes por usuario.
8. Marcadores personales de compra y venta en la grafica.
9. Onboarding para la primera operacion.
10. Prueba de concurrencia e idempotencia contra PostgreSQL real.
11. Ciclo semanal automatico con congelamiento y cierre.
12. Ranking en vivo, ranking final e historial personal.
13. Controles admin para congelar, cerrar o procesar el ciclo.
14. Insignias de mejor novato y descubridor temprano.
15. Historial detallado de operaciones por temporada.
16. Revision antifraude del top con alertas y notas administrativas.
17. Limites atomicos de 60 operaciones diarias y 5 segundos entre operaciones.
18. Rate limits persistentes para cotizaciones, ejecuciones y administracion.
19. Congelamiento de usuarios y figuras con auditoria.
20. Turnstile validado en servidor al iniciar la sesion antifraude y pase HMAC
    de 30 minutos para cotizaciones posteriores del mismo usuario.
21. Backups cifrados, checksum y restauracion automatica de prueba.
22. Copia externa opcional compatible con Cloudflare R2.
23. Health checks, metricas Prometheus y panel de estado operativo.
24. Staging aislado con validaciones que impiden reutilizar produccion.
25. Reglas, privacidad y consentimiento versionado persistente.
26. Monitor externo en Cloudflare Workers con KV y alertas Telegram.
27. Guia reproducible para Pages preview, backups R2 y activacion de beta.
28. Tablas de fuentes, observaciones y senales del indice de atencion.
29. Adaptador Wikimedia con calculo diario 7 contra 21 dias.
30. Modo sombra idempotente y observable sin impacto en precios.
31. Reconstruccion de 30 ventanas reales con evaluacion de estabilidad.
32. Pagina publica de metodologia y textos legales actualizados.
33. Paquete de solicitud de metricas derivadas de YouTube.
34. Avatares abstractos cuando una imagen no tiene uso verificado.
35. Registro de licencia, fuente, atribucion y revision por figura.
36. Pagina publica de derechos con formulario de correccion o retiro.
37. Bandeja administrativa y auditoria de solicitudes de derechos.
38. Produccion desplegada en `fameplays.com` con backend aislado,
    `api.fameplays.com` y Firebase propio.
39. Estado publico del Indice Automatico de Atencion publicado en
    `/metodologia` desde `/api/attention/status`.
40. Catalogo mixto inicial de 29 figuras con categorias, perfiles de riesgo,
    avatares abstractos y fuentes Wikimedia verificadas tecnicamente.
41. Checklist de revision marca/legal para `fameplays.com` y documento de
    fuentes del catalogo.
42. Monitor externo ajustado para produccion sin depender de Telegram mientras
    no esten configurados sus secretos.
43. Backups externos cifrados en Cloudflare R2 y restauracion verificada.
44. Staging aislado publicado con API, frontend, Firebase y Turnstile propios.
45. Chat de produccion conectado a Pages con notas de voz de 1 a 10 segundos.
46. Grafica con velas, temporalidades, dibujos y medicion porcentual.
47. Pulso de noticias multilingue basado en GDELT, con deduplicacion,
    diversidad de medios, decaimiento temporal y sentimiento conservador.
48. Noticias sensibles enviadas a revision sin impacto automatico y senales
    horarias idempotentes. El motor v4 usa perfiles de volatilidad, aliases de
    figuras, minimos configurables, limite de 250 bps por senal, 400 bps
    diarios y circuit breaker total de 800 bps.
49. Vista publica de titulares enlazados a su fuente; modo sombra validado y
    motor GDELT v2 activado en produccion con impacto real auditable.
50. Notas de voz compatibles con MIME que incluye parametros de codec y
    grabacion limitada a 32 kbps para evitar rechazos por tamano.
51. Notas de voz y Pulso de noticias integrados en `main`, Worker y VPS.
52. Despliegues automaticos de API y Worker mediante GitHub Actions, con
    health check y registro persistente del resultado en la incidencia #4.
53. Motor GDELT protegido con cola global, separacion de solicitudes y
    reintentos para reducir bloqueos HTTP 429.
54. Motor de noticias v2 en produccion con movimientos diferenciados por
    perfil de volatilidad y limites de 2,5%, 4% y 8%.
55. Mercado Vivo con estados `bull`, `bear`, `sideways`, `volatile` y `viral`
    para generar ticks automaticos auditables `source_type=market` en todas
    las figuras activas.
56. Admin con filtros transversales, resets auditados de actividad de temporada,
    temporada completa y pulso GDELT.
57. Radio colombiana curada con categorias, buscador, favoritos, resolucion de
    streams verificados via Radio Browser y fallback a sitio oficial.
58. Bonus diario automatico de posiciones: hasta 25 FameCoins de valor en
    participaciones fraccionarias existentes, auditado y sin mover precio.

Siguiente bloque recomendado:

1. Observar el Mercado Vivo durante 24 a 48 horas y calibrar volatilidad, hype,
   bandas y frecuencia antes de compartir la beta ampliamente.
2. Mostrar en la grafica y cronologia si cada movimiento provino de compra,
   venta, noticia, temporada o evento externo.
3. Instrumentar analitica de beta para retencion, operaciones, chat, voz y
   categorias sin guardar contenido sensible.
4. Validar notas de voz WebM desde Android, iOS y navegador de escritorio.
5. Probar la beta cerrada con 20 a 50 usuarios y recoger observaciones de UX
   movil y comprension del origen del precio.
6. Observar el motor de noticias v2 y calibrar falsos positivos, amplitud por
   perfil, liquidez y rendimiento de los jugadores antes del lanzamiento.
7. Mantener Wikimedia en modo sombra durante 30 dias y revisar falsos
   positivos y aprobar umbrales antes de aplicar senales.
8. Completar busqueda de marcas, revision juridica local e imagenes con
   evidencia fechada.
9. Migrar internamente `artists`/`artist_id` a
   `market_entities`/`entity_id` con aliases y pruebas de compatibilidad.
10. Evaluar adaptadores adicionales por categoria y el permiso de metricas
   derivadas de YouTube; Twitch permanece pendiente de autorizacion tecnica.
11. Dejar referidos, premios, monetizacion y audio en vivo para despues de la
    beta y la revision juridica.
