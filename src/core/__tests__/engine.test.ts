import {
  canUndo,
  courtOf,
  isGamePoint,
  newGame,
  playerIn,
  playersFromDisplayName,
  recordRally,
  scoreCall,
  serverInfo,
  undo,
  type GameSetup,
  type Scorer,
  type Side,
} from "../scoring/engine";

const doubles: GameSetup = {
  format: "doubles",
  pointsToWin: 11,
  firstServer: "A",
  teams: {
    A: { name: "Alex & Sam", players: ["Alex", "Sam"] },
    B: { name: "Jo & Kim", players: ["Jo", "Kim"] },
  },
};

const singles: GameSetup = {
  format: "singles",
  pointsToWin: 11,
  firstServer: "A",
  teams: { A: { name: "Alex", players: ["Alex"] }, B: { name: "Jo", players: ["Jo"] } },
};

const play = (scorer: Scorer, rallies: string) =>
  [...rallies].reduce((s, side) => recordRally(s, side as Side), scorer);

describe("doubles side-out scoring", () => {
  it("starts at 0-0-2 with the right-court player serving", () => {
    const { game } = newGame(doubles);
    expect(scoreCall(game)).toBe("0-0-2");
    expect(serverInfo(game)).toEqual({ side: "A", name: "Alex", court: "right", serverNumber: 2 });
  });

  it("honours who starts in the right court", () => {
    const { game } = newGame({ ...doubles, startingRight: { A: 1, B: 1 } });
    expect(serverInfo(game).name).toBe("Sam");
    expect(playerIn(game, "B", "right")).toBe("Kim");
  });

  it("scores only for the serving side, and the servers swap courts", () => {
    const s = play(newGame(doubles), "A");
    expect(scoreCall(s.game)).toBe("1-0-2");
    expect(serverInfo(s.game)).toMatchObject({ name: "Alex", court: "left" });
    expect(playerIn(s.game, "A", "right")).toBe("Sam");
    // Receivers don't move.
    expect(playerIn(s.game, "B", "right")).toBe("Jo");
  });

  it("goes straight to a side out after the first fault of the game", () => {
    const s = play(newGame(doubles), "B");
    expect(s.game.score).toEqual({ A: 0, B: 0 });
    expect(scoreCall(s.game)).toBe("0-0-1");
    expect(serverInfo(s.game)).toEqual({ side: "B", name: "Jo", court: "right", serverNumber: 1 });
  });

  it("passes to the second server, then sides out", () => {
    // B gets the serve, scores once (Jo moves to the left), then faults.
    let s = play(newGame(doubles), "BBA");
    expect(scoreCall(s.game)).toBe("1-0-2");
    // Second server is Jo's partner Kim, serving from where Kim stands (right).
    expect(serverInfo(s.game)).toEqual({ side: "B", name: "Kim", court: "right", serverNumber: 2 });
    s = play(s, "A");
    expect(scoreCall(s.game)).toBe("0-1-1");
    // A's right-court player serves first after a side out.
    expect(serverInfo(s.game)).toMatchObject({ side: "A", name: "Alex", court: "right" });
  });

  it("ends the game at 11 when ahead by 2", () => {
    const s = play(newGame(doubles), "A".repeat(11));
    expect(s.game.score).toEqual({ A: 11, B: 0 });
    expect(s.game.winner).toBe("A");
    // Further taps do nothing.
    expect(recordRally(s, "B")).toBe(s);
  });

  it("plays on past 11 until someone leads by 2", () => {
    // A to 10-0 then B's serve... build 10-10 manually through side outs.
    let s = newGame({ ...doubles, pointsToWin: 3 });
    s = play(s, "AA"); // A 2-0
    s = play(s, "B"); // side out (first-server exception)
    s = play(s, "BB"); // B 2-2
    s = play(s, "AA"); // A's second server... then side out to A
    expect(s.game.serving).toBe("A");
    s = play(s, "A"); // 3-2: not over (win by 2)
    expect(s.game.score).toEqual({ A: 3, B: 2 });
    expect(s.game.winner).toBeNull();
    expect(isGamePoint(s.game, "A")).toBe(true);
    s = play(s, "A");
    expect(s.game.winner).toBe("A");
  });

  it("undoes rally by rally", () => {
    const start = newGame(doubles);
    expect(canUndo(start)).toBe(false);
    const s = play(start, "ABA");
    const back = undo(undo(undo(s)));
    expect(back.game).toEqual(start.game);
    expect(canUndo(back)).toBe(false);
  });

  it("is plain JSON, so it survives being saved", () => {
    const s = play(newGame(doubles), "AABAB");
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe("singles", () => {
  it("sides out on every lost serve and serves from the court matching the score", () => {
    let s = newGame(singles);
    expect(scoreCall(s.game)).toBe("0-0");
    expect(serverInfo(s.game).court).toBe("right");
    s = play(s, "A");
    expect(serverInfo(s.game).court).toBe("left");
    expect(courtOf(s.game, "B", 0)).toBe("left");
    expect(playerIn(s.game, "B", "right")).toBeNull();
    s = play(s, "B");
    expect(scoreCall(s.game)).toBe("0-1");
    expect(serverInfo(s.game)).toEqual({ side: "B", name: "Jo", court: "right", serverNumber: 1 });
  });
});

describe("playersFromDisplayName", () => {
  it("splits the API's player-named teams", () => {
    expect(playersFromDisplayName("Alex & Sam", "doubles")).toEqual(["Alex", "Sam"]);
  });
  it("numbers players of named teams", () => {
    expect(playersFromDisplayName("Smashers", "doubles")).toEqual(["Smashers 1", "Smashers 2"]);
    expect(playersFromDisplayName("Alex, Sam & Jo", "doubles")).toEqual([
      "Alex, Sam & Jo 1",
      "Alex, Sam & Jo 2",
    ]);
  });
  it("uses the whole name in singles", () => {
    expect(playersFromDisplayName("Alex & Sam", "singles")).toEqual(["Alex & Sam"]);
  });
});

describe("newGame", () => {
  it("rejects the wrong number of players", () => {
    expect(() => newGame({ ...doubles, format: "singles" })).toThrow();
  });
});
