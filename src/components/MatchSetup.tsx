// Before the first serve: singles or doubles, players' names and starting
// courts, and which side serves first.

import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { Match } from "../core/api/types";
import { playersFromDisplayName, type Format, type GameSetup, type PlayerIndex, type Side } from "../core/scoring/engine";
import { colors, radius, sideColor, spacing } from "./theme";
import { Button, Card, text } from "./ui";

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choice}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onPress={() => onChange(o.value)}
          style={[styles.choiceItem, o.value === value && styles.choiceSelected]}
        >
          <Text style={[styles.choiceText, o.value === value && { color: colors.primaryText }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MatchSetup({
  match,
  pointsToWin,
  onStart,
}: {
  match: Match;
  pointsToWin: number;
  onStart: (setup: GameSetup) => void;
}) {
  const teamNames: Record<Side, string> = { A: match.team_a.display_name, B: match.team_b.display_name };
  const [format, setFormat] = useState<Format>("doubles");
  const [players, setPlayers] = useState<Record<Format, Record<Side, string[]>>>({
    doubles: {
      A: playersFromDisplayName(teamNames.A, "doubles"),
      B: playersFromDisplayName(teamNames.B, "doubles"),
    },
    singles: { A: [teamNames.A], B: [teamNames.B] },
  });
  const [firstServer, setFirstServer] = useState<Side>("A");
  const [startingRight, setStartingRight] = useState<Record<Side, PlayerIndex>>({ A: 0, B: 0 });

  const names = players[format];
  const setName = (side: Side, index: number, name: string) =>
    setPlayers((p) => {
      const sideNames = [...p[format][side]];
      sideNames[index] = name;
      return { ...p, [format]: { ...p[format], [side]: sideNames } };
    });

  const ready = (["A", "B"] as const).every((s) => names[s].every((n) => n.trim()));

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={text.title}>
        {teamNames.A} vs {teamNames.B}
      </Text>
      <Text style={text.muted}>
        Week {match.week}, round {match.round} · game to {pointsToWin}, win by 2
      </Text>

      <Choice
        options={[
          { value: "doubles", label: "Doubles" },
          { value: "singles", label: "Singles" },
        ]}
        value={format}
        onChange={setFormat}
      />

      {(["A", "B"] as const).map((side) => (
        <Card key={side} style={{ borderLeftWidth: 6, borderLeftColor: sideColor(side) }}>
          <Text style={text.heading}>{teamNames[side]}</Text>
          {format === "doubles" ? (
            <>
              {([startingRight[side], startingRight[side] === 0 ? 1 : 0] as PlayerIndex[]).map((index, i) => (
                <View key={index} style={styles.playerRow}>
                  <Text style={styles.position}>{i === 0 ? "Right court" : "Left court"}</Text>
                  <TextInput
                    style={styles.input}
                    value={names[side][index]}
                    onChangeText={(n) => setName(side, index, n)}
                    aria-label={`${teamNames[side]} player in the ${i === 0 ? "right" : "left"} court`}
                  />
                </View>
              ))}
              <Button
                title="Swap courts"
                variant="secondary"
                onPress={() => setStartingRight((r) => ({ ...r, [side]: r[side] === 0 ? 1 : 0 }))}
              />
            </>
          ) : (
            <TextInput
              style={styles.input}
              value={names[side][0]}
              onChangeText={(n) => setName(side, 0, n)}
              aria-label={`${teamNames[side]} player`}
            />
          )}
        </Card>
      ))}

      <Text style={text.heading}>Serves first</Text>
      <Choice
        options={[
          { value: "A", label: teamNames.A },
          { value: "B", label: teamNames.B },
        ]}
        value={firstServer}
        onChange={setFirstServer}
      />
      {format === "doubles" ? (
        <Text style={text.muted}>
          The player in the right court serves first. Only one player serves before the first side out (0-0-2).
        </Text>
      ) : null}

      <Button
        title="Start game"
        disabled={!ready}
        onPress={() =>
          onStart({
            format,
            pointsToWin,
            firstServer,
            startingRight,
            teams: {
              A: { name: teamNames.A, players: names.A.map((n) => n.trim()) },
              B: { name: teamNames.B, players: names.B.map((n) => n.trim()) },
            },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  choiceItem: {
    flexGrow: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { fontSize: 16, fontWeight: "600", color: colors.text },
  playerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  position: { width: 96, color: colors.muted, fontSize: 14 },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
