# pickleball-scoring

An app for Android and iOS tablets that lets umpires and scorers keep the serve and
points of a pickleball match, rally by rally, and send the final score to
[jduncombe/pickleball-league](https://github.com/jduncombe/pickleball-league).

Built with [Expo](https://expo.dev) (React Native + TypeScript): one codebase for
Android, iOS and, for development, the web. Android is the first target.

## What it does

1. **Sign in** as an umpire (or an organiser or admin) with email, password and a code
   from an authenticator app. The first sign-in shows a QR code to set the authenticator up.
2. **Pick a league** being played, then **claim a court**, so no other device can score it.
   The device remembers its courts, so it goes straight back to them after a restart.
3. **Wait for a match.** The court screen checks every 5 seconds for the match the organiser
   puts on the court from the league's live view.
4. **Set the match up:** doubles or singles, players' names (taken from the team names in
   the league), who starts in the right court, and who serves first.
5. **Score it.** Tap the side that won each rally. The app works out the score call
   (e.g. `4-2-1`), who serves from which court, second server and side outs, and ends the
   game at "first to N, win by 2" (N is the league's points to win: 11, 15 or 21).
   **Undo** steps back a rally at a time; **Switch ends** flips the display when teams change ends.
6. **Confirm and send** the final score. If the connection drops, the score is kept on the
   device and sent when the court screen can reach the server again.
7. **Release the court** when you're done (e.g. at the end of the night).

The game is saved on the device after every rally, so closing the app, a crash or a flat
battery doesn't lose the score. The screen stays awake while a court is open.

### Scoring rules

Traditional side-out scoring:

- Only the serving side scores. When it wins a rally its players swap courts and the same
  player serves again.
- Doubles: when the serving side loses a rally, its second server serves; after the second
  server, it's a side out and the receiving side's right-court player serves. The first
  service turn of the game has only one server (`0-0-2`).
- Singles: every lost rally on serve is a side out; the server serves from the right when
  their score is even, the left when it's odd.
- Final scores are checked with the same rules as the league API before they're sent.

## How the code is organised

The code is split so that as much as possible is shared, and nothing platform-specific
leaks into the logic:

```
src/
├── core/                # Plain TypeScript: no React Native or Expo imports
│   ├── scoring/
│   │   ├── engine.ts    # Rally-by-rally scoring state machine (pure functions, JSON state)
│   │   └── rules.ts     # Final-score rules, mirroring the league API
│   ├── api/
│   │   ├── client.ts    # Typed client for /auth/* and /scoring/* (standard fetch only)
│   │   ├── errors.ts    # FastAPI error bodies → readable ApiError
│   │   └── types.ts     # API payloads (mirrors api/app/schemas.py)
│   ├── storage.ts       # Saved games and claimed courts over a KeyValueStore interface
│   └── __tests__/       # Jest tests for all of the above
├── platform/            # The only native-module glue
│   ├── storage.ts       # KeyValueStore on AsyncStorage; tokens in SecureStore (Keystore/Keychain)
│   └── config.ts        # Default server address, poll interval
├── state/               # React state: session & settings, the court screen's logic
├── components/          # Shared UI (scoreboard, court diagram, match setup, form controls)
└── app/                 # Screens, as Expo Router routes
    ├── login.tsx, settings.tsx
    ├── index.tsx                    # Your courts and leagues being played
    ├── league/[leagueId].tsx        # Claim a court
    └── court/[leagueId]/[court].tsx # Wait for a match, score it, send it
```

- `src/core` is the reusable heart: the same engine and API client can be used by another
  app (a React web app, a watch app, a Node script) without change.
- Every screen and component is shared between Android and iOS. The few platform
  differences (secure storage on the web, confirm dialogs, rendering the QR code) are
  handled with `Platform.OS` in one place each.
- The UI adapts to the screen: side by side in landscape (tablets), stacked in portrait.

## Getting started

Requires Node 20+.

```bash
npm install
npm start            # Expo dev server; press "a" for an Android emulator/device, "w" for a browser
npm test             # unit tests (scoring engine, rules, API client, storage)
npm run typecheck
```

On first launch, open **Settings** and enter the league server's address:

| Where the API runs | Address |
| --- | --- |
| Deployed behind the league website (CloudFront) | `https://<your-site>/api` |
| `docker compose up` on your computer, Android emulator | `http://10.0.2.2:8000` |
| `docker compose up` on your computer, real device on the same Wi-Fi | `http://<computer's LAN IP>:8000` |

You can also bake a default in at build time with `EXPO_PUBLIC_API_URL`
(or `expo.extra.apiUrl` in `app.json`).

Umpire accounts are created by a league admin on the **Users** page of the league website,
or with `python -m app.cli create-user --role umpire …` (see the league repo's README).

To try the app in a browser (`npm run web`), add the dev server's origin to the API's
`CORS_ORIGINS`, e.g. `CORS_ORIGINS=http://localhost:8081`. Native apps aren't affected by CORS.

> Plain `http://` addresses are fine for local development builds. Release builds should
> use an `https://` server, as Android and iOS block cleartext traffic by default.

## Building for Android

The app uses [Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/):
the `android/` and `ios/` folders are generated from `app.json` and aren't committed.

**Installable APK for test tablets (EAS, in the cloud):**

```bash
npx eas-cli@latest login
npm run android:apk        # eas build --platform android --profile preview
```

**Play Store bundle:** `npx eas-cli@latest build --platform android --profile production`.

**Locally** (needs Android Studio / the Android SDK and JDK 17):

```bash
npx expo run:android --variant release
```

**CI:** every push runs the tests and builds a release APK (signed with the debug key, for
sideloading); download it from the workflow run's `pickleball-scoring-apk` artifact.

The Android package name is `com.jduncombe.pickleballscoring` (set in `app.json`).

## iOS

The same code runs on iOS (`npm start`, then `i` for the simulator on a Mac). Builds use
EAS as for Android: `npx eas-cli@latest build --platform ios`, which needs an Apple
Developer account. The bundle identifier is `com.jduncombe.pickleballscoring`.

## League API endpoints used

| Endpoint | Used for |
| --- | --- |
| `POST /auth/login`, `/auth/mfa/setup`, `/auth/mfa/verify` (with `"client": "app"`) | Sign-in; the access token is kept in SecureStore |
| `POST /auth/logout` | Sign out |
| `GET /health` | **Test connection** in Settings |
| `GET /scoring/leagues` | Leagues being played |
| `GET /scoring/leagues/{id}/courts` | Free courts |
| `POST` / `DELETE /scoring/leagues/{id}/courts/{court}/claim` | Claim / release a court |
| `GET /scoring/leagues/{id}/courts/{court}/match` | The match on the court (polled) |
| `GET /scoring/leagues/{id}/matches?status=completed` | Checking whether a resent score already got through |
| `PUT /scoring/matches/{id}/result` | Sending the final score |

The API records final scores only; serve order and rally history stay on the device.

## Possible next steps

- Rally scoring and best-of-3 matches, if the league adds them.
- Timeouts and end changes (e.g. at 6 in a game to 11).
- Player names per position from the API, if it exposes team players to umpires.
