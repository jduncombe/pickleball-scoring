import { checkScore, isGameOver } from "../scoring/rules";

describe("checkScore (mirrors the API)", () => {
  it.each([
    [11, 7],
    [11, 9],
    [13, 11],
    [0, 11],
    [21, 19],
  ])("accepts %i-%i", (a, b) => {
    const n = Math.max(a, b) >= 21 ? 21 : 11;
    expect(checkScore(a, b, n)).toBeNull();
  });

  it.each([
    [11, 11, ["score_a", "score_b"]],
    [10, 8, ["score_a"]],
    [11, 10, ["score_b"]],
    [14, 10, ["score_a"]],
  ])("rejects %i-%i", (a, b, fields) => {
    expect(checkScore(a, b, 11)?.fields).toEqual(fields);
  });
});

describe("isGameOver", () => {
  it("needs N points and a 2-point lead", () => {
    expect(isGameOver(11, 9, 11)).toBe(true);
    expect(isGameOver(11, 10, 11)).toBe(false);
    expect(isGameOver(10, 0, 11)).toBe(false);
    expect(isGameOver(12, 14, 11)).toBe(true);
  });
});
