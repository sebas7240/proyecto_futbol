# Fame Plays - Play Store Release

## Android package

- App name: Fame Plays
- Package name: com.fameplays.app
- Release artifact for Google Play: android/app/build/outputs/bundle/release/app-release.aab
- Debug APK for manual testing only: android/app/build/outputs/apk/debug/app-debug.apk

Google Play accepts Android App Bundles for new apps. Do not upload `app-debug.apk` to production.

## Local signing files

These files are intentionally ignored by Git and must stay private:

- android/fameplays-upload-key.jks
- android/play-release.properties
- android/upload_certificate.pem

Keep a backup of the `.jks` and `play-release.properties`. If the upload key is lost, future updates can be blocked until Google resets it.

## Build commands

From `fame-market`:

```powershell
npm run build:android
cd android
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\SEBASTIAN\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
.\gradlew.bat bundleRelease
```

## Play Console checklist

- Create app as "Fame Plays".
- Select package `com.fameplays.app`.
- Upload `app-release.aab`.
- Set developer website to `https://www.fameplays.com`.
- Privacy policy URL: `https://www.fameplays.com/privacidad`.
- Verify app-ads.txt at `https://fameplays.com/app-ads.txt`.
- Complete Data safety: login/account, wallet address for prize contact if user saves it, user-generated chat/voice notes, diagnostics/error reports.
- Complete Content rating and Target audience.
- Declare ads because the app includes AdMob/AdSense configuration.
- Explain that FameCoins are fictitious, there are no deposits, and prizes are manual promotional rewards.
