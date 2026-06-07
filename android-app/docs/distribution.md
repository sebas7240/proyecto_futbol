# Distribucion de la APK

## Estado actual

La APK release actual esta lista para distribucion manual:

```text
dist/Golea-release.apk
```

Tambien se publica como descarga directa desde el dominio:

```text
https://goleafutbol.com/downloads/Golea-release.apk
```

Version:

```text
versionName: 1.0.5
versionCode: 6
package: com.goleafutbol.app
```

La app carga la web de produccion:

```text
https://goleafutbol.com
```

Esto permite actualizar canales, agenda, anuncios, chat y diseno desde la web sin reconstruir la APK.

## Compilar una nueva release

Desde PowerShell en `android-app/`:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:GRADLE_USER_HOME='H:\golea-gradle-cache'
$env:TEMP='H:\golea-tmp'
$env:TMP='H:\golea-tmp'
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

npm run sync
cd android
.\gradlew assembleRelease --no-daemon
cd ..
Copy-Item 'android\app\build\outputs\apk\release\app-release.apk' 'dist\Golea-release.apk' -Force
```

## Instalar en telefono conectado por USB

Con depuracion USB activa:

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r dist\Golea-release.apk
```

Si la app conserva un estado roto de una version anterior:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell pm clear com.goleafutbol.app
```

## Instalar en ONN TV / Android TV con Downloader by AFTVnews

1. Instala `Downloader by AFTVnews` desde Google Play en el ONN TV.
2. En Android TV, permite instalar apps desconocidas para Downloader:

```text
Settings > Apps > Security & restrictions > Unknown sources > Downloader > Allow
```

3. Abre Downloader.
4. Escribe esta URL directa:

```text
https://goleafutbol.com/downloads/Golea-release.apk
```

5. Descarga el APK.
6. Pulsa `Install`.
7. Abre `Golea`.

## Crear codigo corto para Downloader

Downloader acepta codigos numericos generados por AFTVnews. Para crear uno:

1. Entra a:

```text
https://go.aftvnews.com/
```

2. Pega la URL:

```text
https://goleafutbol.com/downloads/Golea-release.apk
```

3. Resuelve el captcha.
4. Copia el codigo numerico.
5. En Downloader, escribe solo ese codigo.

Nota: los codigos y URLs enviados a AFTVnews son publicos, asi que solo uses enlaces que quieras distribuir.

## Verificar firma

```powershell
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
& "$env:ANDROID_HOME\build-tools\36.1.0\apksigner.bat" verify --verbose --print-certs dist\Golea-release.apk
```

La firma actual debe mostrar:

```text
Verified using v1 scheme: true
Verified using v2 scheme: true
SHA-256: 0d01f75994026cfac64893dd23bb8062c9fa5614f4e6a75c520ab659d9f3ffd4
```

## Subida a Play Store

Para Play Store normalmente se necesita un `.aab`:

```powershell
cd android
.\gradlew bundleRelease --no-daemon
```

Antes de intentar Play Store, revisar anuncios Popunder/Social Bar y politicas de contenido/anuncios. Para distribucion manual, el APK actual es suficiente.

## Versionado

Cada APK publica debe incrementar:

- `versionCode`
- `versionName` si cambia la version visible

Archivo:

```text
android/app/build.gradle
```
