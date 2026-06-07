# APK release firmada

La release usa un keystore local y un archivo `signing.properties`.

Estos archivos no deben subirse a Git:

```text
keystore/golea-release.jks
signing.properties
```

## Compilar release

Desde `android-app/`:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:GRADLE_USER_HOME='H:\golea-gradle-cache'
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

cd android
.\gradlew assembleRelease --no-daemon
```

APK esperado:

```text
android/app/build/outputs/apk/release/app-release.apk
```

La copia comoda queda en:

```text
dist/Golea-release.apk
```

## Importante

Guarda una copia segura del keystore y de `signing.properties`. Si pierdes esa llave, no podras actualizar la misma app instalada con futuras versiones firmadas con otra llave.

## Firma actual

La primera release se firmo con:

```text
CN=Golea Futbol, OU=Golea, O=Golea, L=Bogota, ST=Bogota, C=CO
SHA-256: 0d01f75994026cfac64893dd23bb8062c9fa5614f4e6a75c520ab659d9f3ffd4
```
