import { newGame } from "../scoring/engine";
import {
  addClaimedCourt,
  clearGame,
  loadClaimedCourts,
  loadGame,
  memoryStore,
  removeClaimedCourt,
  saveGame,
} from "../storage";

const scorer = newGame({
  format: "singles",
  pointsToWin: 11,
  firstServer: "A",
  teams: { A: { name: "A", players: ["A"] }, B: { name: "B", players: ["B"] } },
});

it("saves, restores and clears a game per court", async () => {
  const store = memoryStore();
  await saveGame(store, { leagueId: 1, court: 2, matchId: 9, scorer, pendingSubmit: false });
  const loaded = await loadGame(store, 1, 2);
  expect(loaded).toMatchObject({ version: 1, matchId: 9, scorer });
  expect(await loadGame(store, 1, 3)).toBeNull();
  await clearGame(store, 1, 2);
  expect(await loadGame(store, 1, 2)).toBeNull();
});

it("ignores corrupt data", async () => {
  expect(await loadGame(memoryStore({ "game:1:1": "{nope" }), 1, 1)).toBeNull();
});

it("remembers claimed courts without duplicates", async () => {
  const store = memoryStore();
  const claim = { leagueId: 1, leagueName: "Autumn", court: 2, pointsToWin: 11 };
  await addClaimedCourt(store, claim);
  await addClaimedCourt(store, claim);
  expect(await loadClaimedCourts(store)).toEqual([claim]);
  await removeClaimedCourt(store, 1, 2);
  expect(await loadClaimedCourts(store)).toEqual([]);
});
