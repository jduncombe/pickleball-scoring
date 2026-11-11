// The scoring screen: the score call, the court, and one big button per side
// to say who won the rally.

import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { isGamePoint, other, scoreCall, serverInfo, type GameState, type Side } from "../core/scoring/engine";
import { CourtDiagram } from "./CourtDiagram";
import { colors, radius, sideColor, spacing } from "./theme";
import { Button } from "./ui";

function rallyOutcome(game: GameState, side: Side): string {
  if (side === game.serving) return isGamePoint(game, side) ? "Point · game" : "Point";
  if (game.format === "doubles" && game.serverNumber === 1) return "Second server";
  return "Side out";
}

function RallyButton({ game, side, onPress }: { game: GameState; side: Side; onPress: () => void }) {
  const serving = game.serving === side;
  return (
    <Pressable
      role="button"
      aria-label={`${game.teams[side].name} won the rally: ${rallyOutcome(game, side)}`}
      onPress={onPress}
      disabled={!!game.winner}
      style={({ pressed }) => [
        styles.rally,
        { backgroundColor: sideColor(side) },
        pressed && { opacity: 0.75 },
        !!game.winner && { opacity: 0.4 },
      ]}
    >
      <Text style={styles.teamName} numberOfLines={2}>
        {serving ? "● " : ""}
        {game.teams[side].name}
      </Text>
      <Text style={styles.score}>{game.score[side]}</Text>
      <Text style={styles.rallyHint}>Won the rally → {rallyOutcome(game, side)}</Text>
    </Pressable>
  );
}

export function Scoreboard({
  game,
  leftSide,
  canUndo,
  onRally,
  onUndo,
  onSwapEnds,
}: {
  game: GameState;
  leftSide: Side;
  canUndo: boolean;
  onRally: (side: Side) => void;
  onUndo: () => void;
  onSwapEnds: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const wide = width > height;
  const server = serverInfo(game);

  return (
    <View style={styles.container}>
      <View style={styles.callRow}>
        <Text style={styles.call} aria-label={`Score ${scoreCall(game).split("-").join(" ")}`}>
          {scoreCall(game)}
        </Text>
        <Text style={styles.serverText}>
          {game.winner
            ? "Game over"
            : `${server.name} serves from the ${server.court}${game.format === "doubles" ? ` · server ${server.serverNumber}` : ""}`}
        </Text>
      </View>

      <View style={[styles.main, { flexDirection: wide ? "row" : "column" }]}>
        {wide ? <RallyButton game={game} side={leftSide} onPress={() => onRally(leftSide)} /> : null}
        <View style={{ flex: wide ? 1.4 : undefined, justifyContent: "center" }}>
          <CourtDiagram game={game} leftSide={leftSide} />
        </View>
        {wide ? <RallyButton game={game} side={other(leftSide)} onPress={() => onRally(other(leftSide))} /> : null}
        {!wide ? (
          <View style={{ flexDirection: "row", gap: spacing.md, flex: 1 }}>
            <RallyButton game={game} side={leftSide} onPress={() => onRally(leftSide)} />
            <RallyButton game={game} side={other(leftSide)} onPress={() => onRally(other(leftSide))} />
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button title="Undo last rally" variant="secondary" onPress={onUndo} disabled={!canUndo} style={{ flex: 1 }} />
        <Button title="Switch ends" variant="secondary" onPress={onSwapEnds} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, gap: spacing.md },
  callRow: { alignItems: "center" },
  call: { fontSize: 56, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  serverText: { fontSize: 18, color: colors.muted },
  main: { flex: 1, gap: spacing.md },
  rally: {
    flex: 1,
    borderRadius: radius,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
  },
  teamName: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  score: { color: "#fff", fontSize: 84, fontWeight: "800", fontVariant: ["tabular-nums"] },
  rallyHint: { color: "#fff", fontSize: 15, opacity: 0.9, textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.md },
});
