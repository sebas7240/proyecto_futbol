# Anuncios en la APK

Esta primera version de la APK carga `https://goleafutbol.com` dentro de Capacitor. Eso significa que usa los mismos bloques de anuncios que ya existen en el frontend web:

- Native Banner
- Popunder
- Smartlink
- Social Bar

No se duplicaron scripts de anuncios dentro de la app. Esto evita mostrar dos veces el mismo formato y reduce el riesgo de que la app se vuelva agresiva en movil.

Para una version de Play Store, conviene revisar especialmente Popunder y Social Bar, porque las tiendas suelen ser estrictas con anuncios que abren pantallas externas, redirecciones inesperadas o comportamiento dificil de cerrar.

## Decision actual

Para distribucion manual por APK, se mantiene la publicidad igual que en la web. La ventaja es que cualquier ajuste que hagas en `goleafutbol.com` tambien se refleja en la app sin recompilar.

La APK no debe incluir fragmentos extra de Adsterra ni de otra red dentro de Android. Si se agregan scripts en Android y tambien existen en la web, el usuario podria ver anuncios duplicados.

## Recomendacion por formato

- Native Banner: mantenerlo en bloques concretos de la web.
- Smartlink: usarlo solo como enlace voluntario o boton claro.
- Social Bar: observar retencion en movil; si molesta demasiado, conviene limitar su aparicion desde la web.
- Popunder: valido para APK manual, pero es el formato que mas riesgo tiene si algun dia se intenta publicar en Play Store.

## Checklist antes de publicar una APK

- Abrir la app recien instalada y confirmar que no aparece doble publicidad.
- Probar atras/cerrar despues de un anuncio.
- Verificar que los anuncios no bloqueen el reproductor antes de que el usuario pueda elegir canal.
- Si se distribuye masivamente, revisar metricas de abandono en movil despues de instalar.
