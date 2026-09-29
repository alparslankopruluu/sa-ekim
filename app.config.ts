import fs from 'node:fs';
import path from 'node:path';

import { type ConfigPlugin, withAndroidManifest, withAppBuildGradle, withPodfile } from 'expo/config-plugins';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One config for both store apps (iOS + Android).
 *
 * Backend modes (EXPO_PUBLIC_BACKEND_MODE):
 *   mock     — default; no keys, no Firebase files, everything simulated locally.
 *   emulator — Firebase Local Emulator Suite (functions call real fal only if FAL_KEY is set there).
 *   live     — real Firebase project; requires GoogleService-Info.plist / google-services.json.
 * Only PUBLIC values ever reach this file (security checklist S2).
 */

type BackendMode = 'mock' | 'emulator' | 'live';

const APP_NAME = 'Belto';
const BUNDLE_ID = process.env.BELTO_BUNDLE_ID ?? 'com.techtactoe.belto';
const VERSION = '1.0.0';
const BUILD_NUMBER = 3;

const rawMode = process.env.EXPO_PUBLIC_BACKEND_MODE ?? 'mock';
const backendMode: BackendMode = rawMode === 'live' || rawMode === 'emulator' ? rawMode : 'mock';

const iosFirebaseFile = process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist';
const androidFirebaseFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
const hasIosFirebase = fs.existsSync(path.resolve(__dirname, iosFirebaseFile));
const hasAndroidFirebase = fs.existsSync(path.resolve(__dirname, androidFirebaseFile));
const firebaseNative = backendMode !== 'mock';

if (firebaseNative && (!hasIosFirebase || !hasAndroidFirebase)) {
  throw new Error(
    `EXPO_PUBLIC_BACKEND_MODE=${backendMode} needs ${iosFirebaseFile} and ${androidFirebaseFile}. ` +
      'Download them from the Firebase console (they are gitignored) or use EXPO_PUBLIC_BACKEND_MODE=mock.',
  );
}

// RNFirebase v26 resolves the Firebase iOS SDK via SPM, which refuses static
// linkage (pod install fails). Its pods are autolinked in every backend mode, so
// the CocoaPods opt-out has to be set even when the Firebase plugins are off.
// Same flag the RNFirebase plugin writes for `ios.disableSPM` (not importable).
const RNFB_DISABLE_SPM = '$RNFirebaseDisableSPM = true';
const withFirebaseCocoaPods: ConfigPlugin = (cfg) =>
  withPodfile(cfg, (podfile) => {
    const src = podfile.modResults.contents;
    if (!src.includes(RNFB_DISABLE_SPM)) {
      podfile.modResults.contents = src.replace(
        /^(\s*prepare_react_native_project!.*)$/m,
        `$1\n${RNFB_DISABLE_SPM}`,
      );
    }
    return podfile;
  });

// Release builds sign with the Play upload key when the build passes it as Gradle
// properties (ORG_GRADLE_PROJECT_BELTO_UPLOAD_*); nothing secret lives in the repo.
const withUploadSigning: ConfigPlugin = (cfg) =>
  withAppBuildGradle(cfg, (gradle) => {
    const src = gradle.modResults.contents;
    if (src.includes('BELTO_UPLOAD_STORE_FILE')) return gradle;
    gradle.modResults.contents = src
      // `locales` also emits the iOS-only Info.plist keys as Android strings; they are
      // harmless extras, so don't let lintVital fail the release on them.
      .replace(/android \{\n/, "android {\n    lint {\n        disable 'ExtraTranslation'\n    }\n")
      .replace(
        /signingConfigs \{\n/,
        `signingConfigs {
        if (project.hasProperty('BELTO_UPLOAD_STORE_FILE')) {
            upload {
                storeFile file(BELTO_UPLOAD_STORE_FILE)
                storePassword BELTO_UPLOAD_PASSWORD
                keyAlias BELTO_UPLOAD_KEY_ALIAS
                keyPassword BELTO_UPLOAD_PASSWORD
            }
        }
`,
      )
      .replace(
        /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig project.hasProperty('BELTO_UPLOAD_STORE_FILE') ? signingConfigs.upload : signingConfigs.debug",
      );
    return gradle;
  });

// expo-notifications and RNFirebase Messaging both declare the default FCM
// channel; keep ours ("renders") instead of failing the manifest merge.
const FCM_CHANNEL_META = 'com.google.firebase.messaging.default_notification_channel_id';
const withFcmChannelOverride: ConfigPlugin = (cfg) =>
  withAndroidManifest(cfg, (manifest) => {
    const root = manifest.modResults.manifest;
    root.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    for (const app of root.application ?? []) {
      for (const meta of app['meta-data'] ?? []) {
        if (meta.$['android:name'] === FCM_CHANNEL_META) {
          (meta.$ as Record<string, string>)['tools:replace'] = 'android:value';
        }
      }
    }
    return manifest;
  });

const firebasePlugins: ExpoConfig['plugins'] = firebaseNative
  ? [
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-firebase/crashlytics',
      '@react-native-firebase/perf',
      '@react-native-firebase/messaging',
      '@react-native-firebase/app-check',
    ]
  : [];

const NATIVE_LOCALES = ['en', 'tr', 'ar', 'ja', 'zh-Hans', 'ru', 'es', 'pt-BR', 'de', 'ko'] as const;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'belto',
  scheme: 'belto',
  version: VERSION,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#07060D',
  locales: Object.fromEntries(
    NATIVE_LOCALES.map((locale) => [locale, `./src/translations/native/${locale}.json`]),
  ),
  ios: {
    bundleIdentifier: BUNDLE_ID,
    buildNumber: String(BUILD_NUMBER),
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    appleTeamId: 'UYDAF6RY67',
    // Release App Check uses App Attest (DeviceCheck fallback); registered in both Firebase projects.
    ...(firebaseNative
      ? { entitlements: { 'com.apple.developer.devicecheck.appattest-environment': 'production' } }
      : {}),
    // Bundled whenever present, even in mock mode: the autolinked RNFB Crashlytics
    // build phase fails without GOOGLE_APP_ID in the app bundle.
    ...(hasIosFirebase ? { googleServicesFile: iosFirebaseFile } : {}),
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      NSCameraUsageDescription: 'Belto uses the camera so you can take the photo that will sing.',
      NSPhotoLibraryUsageDescription: 'Belto opens your photos so you can pick the one that will sing.',
      NSPhotoLibraryAddUsageDescription: 'Belto saves your finished singing videos to your photo library.',
      NSMicrophoneUsageDescription: 'Belto records your voice only when you choose to make a photo say your words.',
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
      ],
    },
  },
  android: {
    package: BUNDLE_ID,
    versionCode: BUILD_NUMBER,
    adaptiveIcon: {
      backgroundColor: '#07060D',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    ...(hasAndroidFirebase ? { googleServicesFile: androidFirebaseFile } : {}),
    permissions: ['android.permission.RECORD_AUDIO', 'android.permission.POST_NOTIFICATIONS'],
    // No location; no ad ID (Firebase Analytics adds it, Belto does no tracking); no broad
    // media reads (Play photo/video policy — photos come from the system picker and saving
    // is write-only, which needs no permission on Android 13+); no overlay window.
    blockedPermissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'com.google.android.gms.permission.AD_ID',
      'android.permission.ACCESS_ADSERVICES_AD_ID',
      'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  web: {
    favicon: './assets/images/favicon.png',
    bundler: 'metro',
    output: 'single',
  },
  plugins: [
    // Registered first so its manifest mod runs after expo-notifications' (mods run in reverse).
    withFcmChannelOverride,
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#07060D',
        image: './assets/images/splash-icon.png',
        imageWidth: 148,
      },
    ],
    [
      'expo-font',
      {
        fonts: ['./assets/fonts/Unbounded-Black.ttf', './assets/fonts/Unbounded-Bold.ttf'],
      },
    ],
    ['expo-localization', { supportsRTL: true }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Belto opens your photos so you can pick the one that will sing.',
        cameraPermission: 'Belto uses the camera so you can take the photo that will sing.',
        microphonePermission: false,
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Belto records your voice only when you choose to make a photo say your words.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: 'Belto opens your photos so you can pick the one that will sing.',
        savePhotosPermission: 'Belto saves your finished singing videos to your photo library.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#FF2E88',
        defaultChannel: 'renders',
      },
    ],
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    'expo-web-browser',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '16.4',
          // Unconditional: the RNFirebase pods autolink in mock mode too, and their
          // Swift pods need module maps (static frameworks) to compile.
          useFrameworks: 'static',
          buildReactNativeFromSource: true,
        },
        android: {
          minSdkVersion: 26,
        },
      },
    ],
    withFirebaseCocoaPods,
    withUploadSigning,
    ...firebasePlugins,
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    backendMode,
    firebaseRegion: 'us-central1',
    legal: {
      privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://belto-prod.web.app/privacy/',
      termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://belto-prod.web.app/terms/',
      supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'techtactoeappstudio@gmail.com',
    },
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? undefined,
    },
  },
});
