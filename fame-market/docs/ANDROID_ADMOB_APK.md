# Android APK and AdMob

Fame Plays now has a Capacitor Android shell.

## App identity

- App name: Fame Plays
- Android package id: `com.fameplays.app`
- AdMob Android app id: `ca-app-pub-7412596570813302~6287603522`
- Web build directory: `frontend/dist`
- Developer website for AdMob: `fameplays.com`

## Build a test APK

From `fame-market`:

```bash
npm run build:android
cd android
./gradlew assembleDebug
```

On Windows PowerShell, if Java is not in `PATH`:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
.\gradlew.bat assembleDebug
```

The debug APK is generated at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

This APK is only for manual testing. Google Play requires a signed release AAB.

## app-ads.txt

AdMob asked for this line:

```text
google.com, pub-7412596570813302, DIRECT, f08c47fec0942fa0
```

It is stored in:

```text
frontend/public/app-ads.txt
```

After deploying the frontend, it must be reachable at:

```text
https://www.fameplays.com/app-ads.txt
https://fameplays.com/app-ads.txt
```

In AdMob or Google Play, use `fameplays.com` as the developer website domain.

## Native AdMob ads

The AdMob app id is already configured in:

```text
android/app/src/main/res/values/strings.xml
android/app/src/main/AndroidManifest.xml
```

The publisher id `pub-7412596570813302` and app id `ca-app-pub-7412596570813302~6287603522` are not enough to show native app ads inside the APK.

For the next phase, create the app in AdMob and provide:

- Banner/interstitial/rewarded ad unit ids, format `ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy`

Then we can add the native Capacitor AdMob plugin and place mobile ads without depending only on web ads inside the WebView.
