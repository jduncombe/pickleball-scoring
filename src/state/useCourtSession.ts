// Everything the court screen does, separated from how it looks: follow the
// court's match, score it rally by rally (saved after every rally so nothing
// is lost if the app closes), and send the final score, retrying when the
// connection comes back.

import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../core/api/errors";
import type { CourtMatch } from "../core/api/types";
import { newGame, recordRally, undo, type GameSetup, type Scorer, type Side } from "../core/scoring/engine";
import { checkScore } from "../core/scoring/rules";
import { clearGame, loadGame, removeClaimedCourt, saveGame, type SavedGame } from "../core/storage";
import { COURT_POLL_MS } from "../platform/config";
import { appStore } from "../platform/storage";
import { useApp } from "./AppContext";

export type SubmitState = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; message: string } | { kind: "error"; message: string };

export function useCourtSession(leagueId: number, court: number) {
  const { api, user } = useApp();
  const [courtMatch, setCourtMatch] = useState<CourtMatch | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedGame | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const savedRef = useRef<SavedGame | null>(null);
  savedRef.current = saved;
  const sendingRef = useRef(false);

  useEffect(() => {
    loadGame(appStore, leagueId, court).then((game) => {
      setSaved(game);
      setLoaded(true);
    });
  }, [leagueId, court]);

  const persist = useCallback(
    async (game: SavedGame | null) => {
      setSaved(game);
      savedRef.current = game;
      if (game) await saveGame(appStore, game);
      else await clearGame(appStore, leagueId, court);
    },
    [leagueId, court],
  );

  /** Did an earlier attempt get through even though we never heard back? */
  const alreadyRecorded = useCallback(
    async (game: SavedGame) => {
      try {
        const { matches } = await api.matches(leagueId, { status: "completed" });
        const match = matches.find((m) => m.id === game.matchId);
        return !!match && match.score_a === game.scorer.game.score.A && match.score_b === game.scorer.game.score.B;
      } catch {
        return false;
      }
    },
    [api, leagueId],
  );

  const send = useCallback(async () => {
    const game = savedRef.current;
    if (!game || sendingRef.current) return;
    sendingRef.current = true;
    setSubmit({ kind: "sending" });
    const { A, B } = game.scorer.game.score;
    try {
      await api.recordResult(game.matchId, { score_a: A, score_b: B });
      await persist(null);
      setSubmit({ kind: "sent", message: `Score sent: ${A}-${B}` });
    } catch (e) {
      if (e instanceof ApiError && e.isConflict && (await alreadyRecorded(game))) {
        await persist(null);
        setSubmit({ kind: "sent", message: `Score sent: ${A}-${B}` });
      } else {
        const message = e instanceof Error ? e.message : String(e);
        setSubmit({
          kind: "error",
          message:
            e instanceof ApiError && e.isNetworkError
              ? `${message}. The score is saved on this device and will be sent when the connection is back.`
              : message,
        });
      }
    } finally {
      sendingRef.current = false;
    }
  }, [api, persist, alreadyRecorded]);

  const poll = useCallback(async () => {
    try {
      const result = await api.courtMatch(leagueId, court);
      setCourtMatch(result);
      setPollError(null);
      // Connected again: send a score that's waiting.
      if (savedRef.current?.pendingSubmit && !sendingRef.current) void send();
    } catch (e) {
      setPollError(e instanceof Error ? e.message : String(e));
    }
  }, [api, leagueId, court, send]);

  useFocusEffect(
    useCallback(() => {
      void poll();
      const timer = setInterval(() => void poll(), COURT_POLL_MS);
      return () => clearInterval(timer);
    }, [poll]),
  );

  const update = useCallback(
    async (change: (scorer: Scorer) => Scorer) => {
      const game = savedRef.current;
      if (!game || game.pendingSubmit) return;
      await persist({ ...game, scorer: change(game.scorer) });
    },
    [persist],
  );

  const startGame = useCallback(
    async (setup: GameSetup) => {
      const match = courtMatch?.match;
      if (!match) return;
      setSubmit({ kind: "idle" });
      await persist({
        version: 1,
        leagueId,
        court,
        matchId: match.id,
        scorer: newGame(setup),
        pendingSubmit: false,
        updatedAt: new Date().toISOString(),
      });
    },
    [courtMatch, leagueId, court, persist],
  );

  const rallyWon = useCallback((side: Side) => update((s) => recordRally(s, side)), [update]);
  const undoRally = useCallback(() => update(undo), [update]);

  const confirmResult = useCallback(async () => {
    const game = savedRef.current;
    if (!game) return;
    const { score, pointsToWin } = game.scorer.game;
    const problem = checkScore(score.A, score.B, pointsToWin);
    if (problem) {
      setSubmit({ kind: "error", message: problem.message });
      return;
    }
    await persist({ ...game, pendingSubmit: true });
    await send();
  }, [persist, send]);

  /** Go back to scoring a confirmed game that couldn't be sent (e.g. to correct it). */
  const reopen = useCallback(async () => {
    const game = savedRef.current;
    if (!game) return;
    setSubmit({ kind: "idle" });
    await persist({ ...game, pendingSubmit: false });
  }, [persist]);

  const discard = useCallback(async () => {
    setSubmit({ kind: "idle" });
    await persist(null);
  }, [persist]);

  const release = useCallback(async () => {
    await api.releaseCourt(leagueId, court);
    await removeClaimedCourt(appStore, leagueId, court);
    await clearGame(appStore, leagueId, court);
  }, [api, leagueId, court]);

  const reclaim = useCallback(
    async (deviceName: string) => {
      await api.claimCourt(leagueId, court, deviceName);
      await poll();
    },
    [api, leagueId, court, poll],
  );

  const match = courtMatch?.match ?? null;
  const claim = courtMatch?.claim ?? null;
  return {
    loaded,
    courtMatch,
    match,
    pollError,
    saved,
    submit,
    /** This signed-in account holds the court's claim. */
    ownsClaim: !!claim && claim.claimed_by?.id === user?.id,
    claim,
    /** The saved game is for a match that's no longer on this court (moved or scored elsewhere). */
    staleGame: !!saved && !!courtMatch && !saved.pendingSubmit && match?.id !== saved.matchId,
    startGame,
    rallyWon,
    undoRally,
    confirmResult,
    retrySend: send,
    reopen,
    discard,
    release,
    reclaim,
    refresh: poll,
  };
}
