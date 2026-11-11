// A top-down court: one side's half on the left of the screen, the other's on
// the right, net in the middle. Shows who stands where, who serves (yellow)
// and who receives (outlined).
//
// A team at the left end faces right, so its right-hand court is at the
// bottom of the screen; a team at the right end faces left, so its
// right-hand court is at the top.

import { StyleSheet, Text, View } from "react-native";

import { other, playerIn, serverInfo, type CourtSide, type GameState, type Side } from "../core/scoring/engine";
import { colors, sideColor } from "./theme";

function Box({ game, side, court }: { game: GameState; side: Side; court: CourtSide }) {
  const server = serverInfo(game);
  const name = playerIn(game, side, court);
  const isServer = !game.winner && side === server.side && court === server.court;
  const isReceiver = !game.winner && side === other(server.side) && court === server.court;
  return (
    <View
      style={[
        styles.box,
        { borderColor: sideColor(side) },
        isServer && { backgroundColor: colors.serve },
        isReceiver && styles.receiver,
      ]}
      aria-label={`${name ?? "empty"}, ${side === "A" ? game.teams.A.name : game.teams.B.name} ${court} court${isServer ? ", serving" : ""}${isReceiver ? ", receiving" : ""}`}
    >
      <Text style={[styles.name, !name && { color: colors.muted }]} numberOfLines={2}>
        {isServer ? "● " : ""}
        {name ?? ""}
      </Text>
      <Text style={styles.courtLabel}>{court}</Text>
    </View>
  );
}

export function CourtDiagram({ game, leftSide }: { game: GameState; leftSide: Side }) {
  const rightSide = other(leftSide);
  return (
    <View style={styles.court}>
      <View style={styles.half}>
        <Box game={game} side={leftSide} court="left" />
        <Box game={game} side={leftSide} court="right" />
      </View>
      <View style={styles.net} />
      <View style={styles.half}>
        <Box game={game} side={rightSide} court="right" />
        <Box game={game} side={rightSide} court="left" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  court: {
    flexDirection: "row",
    backgroundColor: "#2F7D5B",
    borderRadius: 8,
    padding: 6,
    // Wider than tall, like a court seen from the side line.
    aspectRatio: 1.6,
    width: "100%",
  },
  half: { flex: 1, gap: 6 },
  net: { width: 6, backgroundColor: "#F8FAFC", marginHorizontal: 6, borderRadius: 3 },
  box: {
    flex: 1,
    borderWidth: 3,
    borderRadius: 6,
    backgroundColor: "#E8F5EE",
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  receiver: { borderStyle: "dashed", borderWidth: 4, backgroundColor: "#FFFFFF" },
  name: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  courtLabel: { fontSize: 11, color: colors.muted, textTransform: "uppercase" },
});
