# One More Crypt for Android

A single full-screen WebView that plays https://onemorecrypt.com, so every update to the site
reaches the app at once. Package `com.onemorecrypt.app`.

Build (JDK 17 and an Android SDK with platform 35):

    echo "sdk.dir=/path/to/android-sdk" > local.properties
    ./gradlew bundleRelease assembleRelease

Then sign `app/build/outputs/bundle/release/app-release.aab` with the upload key (kept out of
this repo) using `jarsigner`, and the APK with `zipalign` + `apksigner`. Raise `versionCode`
and `versionName` in app/build.gradle (and BuildConfigVersion.java) for every upload.
