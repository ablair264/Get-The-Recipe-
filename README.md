# Recipe Parser (React Native)

React Native version of the web Recipe Parser. It lets you:

- Authenticate with Supabase (email/password)
- Parse recipes from a URL via your existing Netlify function
- View and save recipes to your Supabase-backed recipe book
- Toggle US ↔ UK units for ingredients

## Prerequisites

- Node.js 18+
- Expo CLI (optional): `npm i -g expo-cli` or use `npx expo`
- A deployed Netlify site exposing `/.netlify/functions/parse-recipe`
- Supabase project with the same schema as the web app

## Setup

1) Copy environment variables

```
cp .env.example .env
```

2) Edit `.env` with your values

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_API_BASE_URL=https://your-site.netlify.app
```

3) Install dependencies

```
npm install
```

4) Start the app

```
npx expo start
```

Then press `i` for iOS simulator, `a` for Android, or scan the QR code with Expo Go.

## Native builds

**Android**
- Install Android Studio (or the standalone command line tools) and create an emulator or connect a physical device with USB debugging enabled.
- Run `npx expo run:android` to generate the Gradle project (creates the `android/` folder) and install the app.
- Open `android/` in Android Studio for debugging, Logcat, or manual Gradle tasks (`./gradlew assembleRelease`).
- For store-ready builds use EAS: `eas build -p android --profile production` (or `preview`/`development` per `eas.json`).

**iOS**
- Run `npx expo run:ios` to use the native workspace in Xcode.
- Build archives with Xcode or via `eas build -p ios --profile production`.

## Notes

- Google/OAuth login is not wired here (mobile requires deep linking). Email/password works.
- Ensure your Netlify function is accessible at `${EXPO_PUBLIC_API_BASE_URL}/.netlify/functions/parse-recipe`.
- The measurement conversion logic is shared with the web app.

