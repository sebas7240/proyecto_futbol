# Golea Android App

Proyecto paralelo para generar una APK Android de Golea sin modificar `frontend/`, `backend/`, `chat-worker` ni `edge-worker`.

## Enfoque actual

La app usa Capacitor y carga la web de produccion:

```text
https://goleafutbol.com
```

Ventajas:

- No duplica el frontend.
- Hereda los anuncios ya configurados en la web.
- Hereda Cloudflare, Worker Edge Proxy, chat y backend actual.
- Permite actualizar la experiencia sin recompilar la APK.

## Requisitos para compilar

En esta maquina ya hay Node/npm, pero falta Java/Android SDK. Para generar APK instala:

- Android Studio
- Android SDK Platform Tools
- JDK compatible con Android Gradle Plugin

Despues abre una terminal en `android-app/` y ejecuta:

```powershell
npm install
npx cap add android
npm run sync
npm run open
```

En Android Studio:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

## Comandos utiles

```powershell
npm run doctor
npm run sync
npm run open
npm run build:debug
```

El APK debug quedaria normalmente en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Si falla por Java o Android SDK, mira:

```text
docs/setup-windows.md
```

## Notas

Para Android TV o TV Box, la primera version puede funcionar si el WebView del dispositivo esta actualizado. La siguiente fase seria adaptar navegacion por control remoto, foco visual y una interfaz mas grande para televisores.

## Anuncios

La app no agrega nuevos scripts de anuncios. Carga la web real, por lo que usa los anuncios que ya existen en `goleafutbol.com`. Esta decision evita duplicar formatos y mantiene la APK alineada con lo que ya esta funcionando.

Detalles en:

```text
docs/ads.md
docs/plan.md
docs/distribution.md
```
