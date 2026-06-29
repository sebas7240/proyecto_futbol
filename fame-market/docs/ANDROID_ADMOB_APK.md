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

If AdMob says it cannot verify an Android app named `Mustique`, but the file above returns HTTP 200, the usual cause is not the file content. It means the app registered in AdMob or Google Play does not match this Fame Plays Android package/developer website.

For this APK, the current package is:

```text
com.fameplays.app
```

Use one consistent identity before submitting to Google Play:

1. Recommended: create/use the AdMob and Play Console app as Fame Plays with package `com.fameplays.app` and developer website `https://fameplays.com`.
2. Alternative: if Play Console already permanently uses another package such as `org.FameplayLtd.MustiqueApp`, change the Capacitor/Android package before the first public Play release. Do not do this casually: package names cannot be changed after the app is published.

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

## Android Google login

The Android APK uses native Firebase Authentication through:

```text
@capacitor-firebase/authentication
```

For Google login to work inside the APK, Firebase Console must have an Android app registered with:

```text
Package name: com.fameplays.app
```

Then download the Firebase Android config file and place it here:

```text
android/app/google-services.json
```

Also add the SHA-1/SHA-256 fingerprints from the signing key used to build the APK in Firebase Console. Debug APKs and Play Store release builds use different fingerprints.

Current local debug APK fingerprints:

```text
SHA1: 8A:53:61:AA:F7:D2:F9:CD:B2:43:33:56:DE:84:30:F6:09:D9:AA:F2
SHA-256: F7:8A:27:BD:75:AB:96:AE:F8:6F:55:3C:45:1C:A7:E7:65:7A:F6:90:AA:EC:0D:57:2F:A3:38:26:AA:8E:BF:92
```

After adding the Android app in Firebase, place the downloaded file at:

```text
android/app/google-services.json
```

Then rebuild the APK.
