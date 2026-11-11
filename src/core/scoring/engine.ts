// Rally-by-rally pickleball scoring (traditional side-out scoring).
//
// The umpire taps which side won each rally; this works out the score, who
// serves next, from which court, and the server number, and ends the game at
// "first to N, win by 2". Every function is pure and every state is plain
// JSON, so a game can be saved, restored and undone on any platform.
//
// Doubles rules modelled:
// - Only the serving side scores. When it wins a rally it scores a point and
//   its two players swap courts; the same player serves again.
// - When the serving side loses a rally, its second server serves (from
//   wherever they're standing); after the second server, it's a side out and
//   the receiving side's player in the right court serves as server 1.
// - At the start of the game only one server serves before the first side
//   out ("0-0-2").
// Singles: every lost serve is a side out, and the server serves from the
// right court when their score is even, the left when it's odd.

import { isGameOver } from "./rules";

/** "A" is the match's team_a and "B" its team_b, whichever end they play from. */
export type Side = "A" | "B";
export type Format = "doubles" | "singles";
/** A court half, from the point of view of the team standing in it (facing the net). */
export type CourtSide = "right" | "left";
export type PlayerIndex = 0 | 1;

export interface TeamSetup {
  name: string;
  /** One name for singles, two for doubles. */
  players: string[];
}

export interface GameSetup {
  format: Format;
  pointsToWin: number;
  teams: Record<Side, TeamSetup>;
  /** The side that serves first. */
  firstServer: Side;
  /** Doubles: which player of each team starts in the right court. Default player 0. */
  startingRight?: Partial<Record<Side, PlayerIndex>>;
}

export interface GameState {
  format: Format;
  pointsToWin: number;
  teams: Record<Side, TeamSetup>;
  score: Record<Side, number>;
  serving: Side;
  /** Doubles: 1 or 2 (2 at the very start). Always 1 in singles. */
  serverNumber: 1 | 2;
  /** Index of the serving player within the serving team. */
  server: PlayerIndex;
  /** Doubles: index of the player in each team's right court. */
  right: Record<Side, PlayerIndex>;
  rallies: number;
  /** Set when the game is over. */
  winner: Side | null;
}

/** A game plus the states before each rally, for undo. */
export interface Scorer {
  game: GameState;
  history: GameState[];
}

export const other = (side: Side): Side => (side === "A" ? "B" : "A");
const partner = (index: PlayerIndex): PlayerIndex => (index === 0 ? 1 : 0);

/**
 * Player names for a team from its API display name. The league API names
 * teams without a team name after their players ("Alex & Sam", or
 * "Alex, Sam & Jo"); otherwise players are numbered.
 */
export function playersFromDisplayName(displayName: string, format: Format): string[] {
  if (format === "singles") return [displayName];
  const parts = displayName.split(/\s*(?:,|&)\s*/).filter(Boolean);
  if (parts.length === 2) return parts;
  return [`${displayName} 1`, `${displayName} 2`];
}

export function newGame(setup: GameSetup): Scorer {
  const expected = setup.format === "doubles" ? 2 : 1;
  for (const side of ["A", "B"] as const) {
    if (setup.teams[side].players.length !== expected) {
      throw new Error(`${setup.format} needs ${expected} player name(s) for side ${side}`);
    }
  }
  const right: Record<Side, PlayerIndex> = {
    A: setup.startingRight?.A ?? 0,
    B: setup.startingRight?.B ?? 0,
  };
  const game: GameState = {
    format: setup.format,
    pointsToWin: setup.pointsToWin,
    teams: setup.teams,
    score: { A: 0, B: 0 },
    serving: setup.firstServer,
    serverNumber: setup.format === "doubles" ? 2 : 1,
    server: setup.format === "doubles" ? right[setup.firstServer] : 0,
    right,
    rallies: 0,
    winner: null,
  };
  return { game, history: [] };
}

/** Apply one rally won by `winner`. No-op once the game is over. */
export function rally(game: GameState, winner: Side): GameState {
  if (game.winner) return game;
  const next: GameState = {
    ...game,
    score: { ...game.score },
    right: { ...game.right },
    rallies: game.rallies + 1,
  };

  if (winner === game.serving) {
    next.score[winner] += 1;
    if (game.format === "doubles") {
      // The serving pair swap courts; the server serves again from the other side.
      next.right[winner] = partner(game.right[winner]);
    }
    if (isGameOver(next.score.A, next.score.B, game.pointsToWin)) {
      next.winner = next.score.A > next.score.B ? "A" : "B";
    }
    return next;
  }

  if (game.format === "doubles" && game.serverNumber === 1) {
    next.serverNumber = 2;
    next.server = partner(game.server);
    return next;
  }

  // Side out.
  const receiving = other(game.serving);
  next.serving = receiving;
  next.serverNumber = 1;
  next.server = game.format === "doubles" ? game.right[receiving] : 0;
  return next;
}

export function recordRally(scorer: Scorer, winner: Side): Scorer {
  if (scorer.game.winner) return scorer;
  return { game: rally(scorer.game, winner), history: [...scorer.history, scorer.game] };
}

export function canUndo(scorer: Scorer): boolean {
  return scorer.history.length > 0;
}

export function undo(scorer: Scorer): Scorer {
  if (!canUndo(scorer)) return scorer;
  return { game: scorer.history[scorer.history.length - 1], history: scorer.history.slice(0, -1) };
}

/** The court each player of a side stands in. */
export function courtOf(game: GameState, side: Side, player: PlayerIndex): CourtSide {
  if (game.format === "singles") {
    // The receiver stands diagonally opposite, i.e. in the same-named court.
    return game.score[game.serving] % 2 === 0 ? "right" : "left";
  }
  return game.right[side] === player ? "right" : "left";
}

/** The name of the player standing in a court half (null for the empty half in singles). */
export function playerIn(game: GameState, side: Side, court: CourtSide): string | null {
  const players = game.teams[side].players;
  if (game.format === "singles") return courtOf(game, side, 0) === court ? players[0] : null;
  const index = court === "right" ? game.right[side] : partner(game.right[side]);
  return players[index];
}

export interface ServerInfo {
  side: Side;
  name: string;
  court: CourtSide;
  serverNumber: 1 | 2;
}

export function serverInfo(game: GameState): ServerInfo {
  return {
    side: game.serving,
    name: game.teams[game.serving].players[game.server],
    court: courtOf(game, game.serving, game.server),
    serverNumber: game.serverNumber,
  };
}

/** The score as the referee calls it: serving score, receiving score, (server number). */
export function scoreCall(game: GameState): string {
  const serving = game.score[game.serving];
  const receiving = game.score[other(game.serving)];
  return game.format === "doubles" ? `${serving}-${receiving}-${game.serverNumber}` : `${serving}-${receiving}`;
}

/** True if the next point won by `side` would win the game. */
export function isGamePoint(game: GameState, side: Side): boolean {
  if (game.winner || game.serving !== side) return false;
  const score = { ...game.score, [side]: game.score[side] + 1 };
  return isGameOver(score.A, score.B, game.pointsToWin);
}
