# Revision de marca y legal para beta

Estado: paquete interno preparado. No equivale a asesoria juridica ni a una
autorizacion profesional.

## Decision actual

- Marca del producto: `Fame Plays`.
- Dominio: `fameplays.com`.
- API: `api.fameplays.com`.
- Producto: juego gratuito con monedas ficticias, temporadas y ranking.
- No hay dinero real, valores financieros reales ni propiedad sobre artistas.

## Riesgos principales

1. Confusion de marca con juegos, plataformas de entretenimiento, apuestas,
   mercados financieros o productos llamados de forma similar.
2. Derecho de imagen o publicidad de figuras publicas.
3. Uso de fotos, logos, nombres artisticos o marcas registradas sin permiso.
4. Reglas de concursos, premios, publicidad y proteccion al consumidor si se
   monetiza o se entregan premios reales.
5. Cumplimiento de politicas de API, especialmente YouTube si se solicitan
   metricas derivadas.

## Checklist de busqueda de marca

Guardar captura o PDF con fecha para cada busqueda:

- SIC Colombia: `Fame Plays`, `Fameplays`, variantes foneticas y visuales.
- USPTO: `Fame Plays`, `Fameplays`, clases relacionadas con software, juegos,
  entretenimiento y servicios online.
- EUIPO: mismas variantes.
- Google Play y App Store.
- Google/Bing: resultados de juegos, casinos, fantasy markets, apps y redes.
- Dominios y redes sociales: disponibilidad y posibles conflictos.

Resultado interno actual: pendiente de revision por el dueno del proyecto.

## Reglas de uso de figuras

- Usar nombres solo con finalidad informativa dentro del juego.
- Mantener visible que no existe afiliacion, patrocinio ni aprobacion.
- No usar fotos oficiales, logos, portadas o material de redes sin licencia.
- Publicar avatares abstractos cuando `image_usage_status` no sea aprobado.
- Ofrecer formulario de correccion, retiro, marca e imagen en `/derechos`.

## Textos minimos que deben permanecer visibles

- Footer o paginas legales:
  `Fame Plays es un juego de entretenimiento con monedas ficticias. No esta
  afiliado, patrocinado ni aprobado por ninguna figura, plataforma o marca
  mencionada.`

- Pantalla de reglas:
  `Las participaciones no son valores financieros, no representan propiedad
  real y no pueden canjearse por dinero.`

- Metodologia:
  `Las senales externas se calculan internamente y se muestran con fuente,
  version y modo. YouTube no se usa para precio hasta contar con aprobacion
  escrita aplicable.`

## Gate antes de beta publica

- Busqueda de marca guardada con evidencia fechada.
- `RIGHTS_CONTACT_EMAIL` configurado.
- `RIGHTS_IP_HASH_SALT` configurado y no versionado.
- `/reglas`, `/privacidad`, `/metodologia` y `/derechos` accesibles por HTTPS.
- Catalogo sin imagenes reales no verificadas.
- Politica de premios revisada antes de cualquier recompensa real.
- Si hay publicidad, revisar cumplimiento de plataforma, edad, privacidad y
  paises objetivo.

## Gate antes de premios o monetizacion fuerte

Antes de activar premios, suscripciones, patrocinios o campanas pagadas grandes,
se recomienda revision juridica local sobre:

- uso informativo de nombres de figuras publicas;
- derecho de imagen y publicidad;
- reglas de concurso;
- proteccion al consumidor;
- privacidad y transferencia internacional de datos;
- terminos de APIs y plataformas de anuncios.
