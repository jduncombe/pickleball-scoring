// App-wide state: settings (server address, device name), the signed-in
// session, and an API client wired to both.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ApiClient, normaliseBaseUrl } from "../core/api/client";
import type { Session, User } from "../core/api/types";
import { readJson, writeJson } from "../core/storage";
import { DEFAULT_API_URL } from "../platform/config";
import { appStore, secretStore } from "../platform/storage";

export interface Settings {
  apiUrl: string;
  /** Shown to anyone else who tries to claim this device's court. */
  deviceName: string;
}

interface StoredSession {
  token: string;
  user: User;
  expiresAt: string;
}

interface AppState {
  ready: boolean;
  settings: Settings;
  updateSettings: (settings: Settings) => Promise<void>;
  user: User | null;
  api: ApiClient;
  /** Save the session returned by POST /auth/mfa/verify. */
  startSession: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
}

const SETTINGS_KEY = "settings";
const SESSION_KEY = "session";

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>({ apiUrl: DEFAULT_API_URL, deviceName: "" });
  const [session, setSession] = useState<StoredSession | null>(null);
  // The client reads the token through a ref so it never sees a stale one.
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = session?.token ?? null;

  useEffect(() => {
    (async () => {
      const [savedSettings, savedSession] = await Promise.all([
        readJson<Settings>(appStore, SETTINGS_KEY),
        readJson<StoredSession>(secretStore, SESSION_KEY),
      ]);
      if (savedSettings) setSettings({ apiUrl: savedSettings.apiUrl || DEFAULT_API_URL, deviceName: savedSettings.deviceName ?? "" });
      if (savedSession && new Date(savedSession.expiresAt) > new Date()) setSession(savedSession);
      setReady(true);
    })();
  }, []);

  const clearSession = useCallback(async () => {
    setSession(null);
    await secretStore.removeItem(SESSION_KEY);
  }, []);

  const api = useMemo(
    () =>
      new ApiClient({
        baseUrl: settings.apiUrl,
        getToken: () => tokenRef.current,
        onUnauthorized: () => void clearSession(),
      }),
    [settings.apiUrl, clearSession],
  );

  const updateSettings = useCallback(async (next: Settings) => {
    const cleaned = { apiUrl: normaliseBaseUrl(next.apiUrl), deviceName: next.deviceName.trim() };
    setSettings(cleaned);
    await writeJson(appStore, SETTINGS_KEY, cleaned);
  }, []);

  const startSession = useCallback(async (s: Session) => {
    if (!s.access_token) throw new Error("The server didn't return an access token");
    const stored = { token: s.access_token, user: s.user, expiresAt: s.expires_at };
    tokenRef.current = stored.token;
    setSession(stored);
    await writeJson(secretStore, SESSION_KEY, stored);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Signed out locally either way; the token expires on its own.
    }
    await clearSession();
  }, [api, clearSession]);

  const value = useMemo<AppState>(
    () => ({ ready, settings, updateSettings, user: session?.user ?? null, api, startSession, signOut }),
    [ready, settings, updateSettings, session, api, startSession, signOut],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
