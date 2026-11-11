import Constants from "expo-constants";

/**
 * The league API address the app starts with, from EXPO_PUBLIC_API_URL at
 * build time or `expo.extra.apiUrl` in app.json. Users can change it in Settings.
 */
export const DEFAULT_API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "";

/** How often the court screen checks for its match, in milliseconds. */
export const COURT_POLL_MS = 5000;
