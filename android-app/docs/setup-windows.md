# Preparar Windows para compilar APK

El proyecto ya esta creado. En esta maquina el primer bloqueo detectado fue:

```text
JAVA_HOME is not set and no 'java' command could be found in your PATH.
```

## Instalar herramientas

1. Instala Android Studio desde el sitio oficial de Android Developers.
2. Abre Android Studio y deja que instale el Android SDK.
3. En Android Studio, entra a `Tools > SDK Manager`.
4. Instala una plataforma Android reciente.
5. Reabre PowerShell.

Capacitor recomienda Android Studio para gestionar proyectos Android. Tambien indica que con Android Studio instalado no deberia ser necesario instalar un JDK separado en la mayoria de casos.

## Probar entorno

Desde `android-app/`:

```powershell
npm run doctor
npm run build:debug
```

Si sigue saliendo error de Java, configura `JAVA_HOME` apuntando al JDK incluido con Android Studio.

Una ubicacion comun puede ser:

```text
C:\Program Files\Android\Android Studio\jbr
```

Luego agrega al `Path`:

```text
%JAVA_HOME%\bin
```

## Generar APK

Cuando Java/Android SDK funcionen:

```powershell
cd android-app
npm run sync
npm run build:debug
```

APK esperado:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```
