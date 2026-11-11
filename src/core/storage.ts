// Platform-neutral persistence. The app passes an implementation backed by
// AsyncStorage (or SecureStore for secrets); tests use the in-memory one.

import type { Scorer } from "./scoring/engine";

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
  };
}

export async function readJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  const raw = await store.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): Promise<void> {
  return store.setItem(key, JSON.stringify(value));
}

// --- A game in progress on a court ----------------------------------------------

/**
 * Everything needed to carry on scoring after the app is closed, crashes or
 * loses its connection: the rally-by-rally state, and a final score still
 * waiting to be sent.
 */
export interface SavedGame {
  version: 1;
  leagueId: number;
  court: number;
  matchId: number;
  scorer: Scorer;
  /** Set once the game is finished and confirmed; cleared when the API accepts it. */
  pendingSubmit: boolean;
  updatedAt: string;
}

export const savedGameKey = (leagueId: number, court: number) => `game:${leagueId}:${court}`;

export async function loadGame(store: KeyValueStore, leagueId: number, court: number): Promise<SavedGame | null> {
  const saved = await readJson<SavedGame>(store, savedGameKey(leagueId, court));
  return saved?.version === 1 ? saved : null;
}

export function saveGame(store: KeyValueStore, game: Omit<SavedGame, "version" | "updatedAt">): Promise<void> {
  const saved: SavedGame = { ...game, version: 1, updatedAt: new Date().toISOString() };
  return writeJson(store, savedGameKey(game.leagueId, game.court), saved);
}

export function clearGame(store: KeyValueStore, leagueId: number, court: number): Promise<void> {
  return store.removeItem(savedGameKey(leagueId, court));
}

// --- Courts this device has claimed ------------------------------------------------

/** A court claimed from this device, so the app can return to it after a restart. */
export interface ClaimedCourt {
  leagueId: number;
  leagueName: string;
  court: number;
  pointsToWin: number;
}

const CLAIMS_KEY = "claimed-courts";

export async function loadClaimedCourts(store: KeyValueStore): Promise<ClaimedCourt[]> {
  return (await readJson<ClaimedCourt[]>(store, CLAIMS_KEY)) ?? [];
}

export async function addClaimedCourt(store: KeyValueStore, claim: ClaimedCourt): Promise<void> {
  const claims = (await loadClaimedCourts(store)).filter(
    (c) => !(c.leagueId === claim.leagueId && c.court === claim.court),
  );
  await writeJson(store, CLAIMS_KEY, [...claims, claim]);
}

export async function removeClaimedCourt(store: KeyValueStore, leagueId: number, court: number): Promise<void> {
  const claims = await loadClaimedCourts(store);
  await writeJson(
    store,
    CLAIMS_KEY,
    claims.filter((c) => !(c.leagueId === leagueId && c.court === court)),
  );
}
