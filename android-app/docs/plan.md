# Plan de desarrollo APK Golea

## Objetivo

Crear una APK Android paralela a la web actual, sin modificar el frontend ni el backend existentes.

## Fase 1: APK contenedora

Estado: completada.

- Crear `android-app/`.
- Usar Capacitor como capa Android.
- Cargar `https://goleafutbol.com` como experiencia principal.
- Mantener anuncios actuales sin duplicarlos.
- Soportar telefonos Android y TV Box/Android TV basico.

## Fase 2: Experiencia movil

Estado: completada como primera iteracion release.

- Icono y splash propios.
- Barra de estado y pantalla completa mas pulidas.
- Manejo claro del boton atras.
- Mensaje local cuando no hay conexion.
- Pruebas en telefono Android real.

## Fase 3: Experiencia TV

Estado: primera iteracion completada.

- Navegacion por control remoto.
- Estados de foco visibles.
- Botones mas grandes.
- Preferencia por orientacion horizontal en TV.
- Pruebas en TV Box o Android TV.

## Fase 4: Anuncios para app

Estado: completada para distribucion manual.

- La APK carga `https://goleafutbol.com`, por lo que usa los anuncios existentes de la web.
- No se agregaron scripts de anuncios dentro de Android para evitar duplicados.
- Popunder, Social Bar, Native Banner y Smartlink quedan controlados desde el frontend web.
- Para Play Store queda pendiente revisar politicas, porque formatos tipo Popunder/Social Bar pueden ser sensibles.

## Fase 5: Distribucion

Estado: completada para APK manual.

- APK debug para pruebas privadas.
- APK release firmada para distribucion manual.
- Version actual: `1.0.1` (`versionCode` 2).
- APK final local: `dist/Golea-release.apk`.
- AAB queda como siguiente paso solo si se decide subir a Play Store.
