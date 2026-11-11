// The court this device has claimed: wait for the organiser to put a match on
// it, score the match rally by rally, and send the final score.

import { useKeepAwake } from "expo-keep-awake";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";

import { MatchSetup } from "../../../components/MatchSetup";
import { Scoreboard } from "../../../components/Scoreboard";
import { colors, spacing } from "../../../components/theme";
import { Button, Card, ErrorText, Loading, Screen, text } from "../../../components/ui";
import { canUndo, type Side } from "../../../core/scoring/engine";
import { useApp } from "../../../state/AppContext";
import { useCourtSession } from "../../../state/useCourtSession";

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}

export default function CourtScreen() {
  useKeepAwake();
  const params = useLocalSearchParams<{ leagueId: string; court: string }>();
  const leagueId = Number(params.leagueId);
  const court = Number(params.court);
  const { settings } = useApp();
  const session = useCourtSession(leagueId, court);
  const [leftSide, setLeftSide] = useState<Side>("A");
  const [actionError, setActionError] = useState<string | null>(null);

  const { courtMatch, match, saved, submit } = session;
  const title = courtMatch ? `${courtMatch.league_name} · Court ${court}` : `Court ${court}`;

  const releaseCourt = () =>
    confirm(
      "Release this court?",
      saved ? "The game being scored on this device will be discarded." : "Another device will be able to claim it.",
      "Release",
      async () => {
        try {
          await session.release();
          router.dismissTo("/");
        } catch (e) {
          setActionError(e instanceof Error ? e.message : String(e));
        }
      },
    );

  const header = (
    <Stack.Screen
      options={{
        title,
        headerRight: () => (
          <Pressable onPress={releaseCourt} role="button" style={{ padding: spacing.sm }}>
            <Text style={{ color: colors.danger, fontSize: 16 }}>Release court</Text>
          </Pressable>
        ),
      }}
    />
  );

  if (!session.loaded || (!courtMatch && !session.pollError)) {
    return (
      <>
        {header}
        <Loading label="Checking the court…" />
      </>
    );
  }

  const banner = (
    <>
      {session.pollError ? <ErrorText error={`Offline: ${session.pollError}`} /> : null}
      <ErrorText error={actionError} />
      {courtMatch && !session.ownsClaim ? (
        <Card style={{ borderColor: colors.warning, borderWidth: 2 }}>
          <Text style={text.body}>
            {session.claim
              ? `This court is now claimed by ${session.claim.device_name ?? session.claim.claimed_by?.name ?? "another device"}.`
              : "This device no longer holds the claim for this court (the organiser may have released it)."}
          </Text>
          {!session.claim ? (
            <Button
              title="Claim it again"
              variant="secondary"
              onPress={() =>
                session.reclaim(settings.deviceName).catch((e) => setActionError(e instanceof Error ? e.message : String(e)))
              }
            />
          ) : null}
        </Card>
      ) : null}
    </>
  );

  // A finished game being sent (or waiting to be sent).
  if (saved?.pendingSubmit) {
    const { score, teams } = saved.scorer.game;
    return (
      <Screen>
        {header}
        {banner}
        <Text style={text.title}>
          {teams.A.name} {score.A} – {score.B} {teams.B.name}
        </Text>
        {submit.kind === "sending" ? <Loading label="Sending the score…" /> : null}
        {submit.kind === "error" ? (
          <>
            <ErrorText error={submit.message} />
            <Button title="Try again" onPress={() => void session.retrySend()} />
            <Button title="Back to scoring" variant="secondary" onPress={() => void session.reopen()} />
          </>
        ) : null}
      </Screen>
    );
  }

  if (saved && session.staleGame) {
    return (
      <Screen>
        {header}
        {banner}
        <Card style={{ borderColor: colors.warning, borderWidth: 2 }}>
          <Text style={text.heading}>This match is no longer on this court</Text>
          <Text style={text.body}>
            The organiser has moved it, returned it to the schedule or recorded its score elsewhere. The score on this
            device was {saved.scorer.game.teams.A.name} {saved.scorer.game.score.A} –{" "}
            {saved.scorer.game.score.B} {saved.scorer.game.teams.B.name}.
          </Text>
          <Button title="Discard it" variant="danger" onPress={() => void session.discard()} />
        </Card>
      </Screen>
    );
  }

  if (saved) {
    const { game } = saved.scorer;
    return (
      <View style={{ flex: 1 }}>
        {header}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>{banner}</View>
        {game.winner ? (
          <View style={{ padding: spacing.md, gap: spacing.md }}>
            <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
              <Text style={text.title}>
                {game.teams[game.winner].name} win {Math.max(game.score.A, game.score.B)}–
                {Math.min(game.score.A, game.score.B)}
              </Text>
              <Text style={text.muted}>Check the score with the players, then send it.</Text>
              {submit.kind === "error" ? <ErrorText error={submit.message} /> : null}
              <Button title="Confirm and send score" onPress={() => void session.confirmResult()} />
            </Card>
          </View>
        ) : null}
        <Scoreboard
          game={game}
          leftSide={leftSide}
          canUndo={canUndo(saved.scorer)}
          onRally={(side) => void session.rallyWon(side)}
          onUndo={() => void session.undoRally()}
          onSwapEnds={() => setLeftSide((s) => (s === "A" ? "B" : "A"))}
        />
      </View>
    );
  }

  return (
    <Screen>
      {header}
      {banner}
      {submit.kind === "sent" ? (
        <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
          <Text style={text.heading}>{submit.message}</Text>
        </Card>
      ) : null}
      {match && courtMatch ? (
        session.ownsClaim ? (
          <MatchSetup
            key={match.id}
            match={match}
            pointsToWin={courtMatch.points_to_win}
            onStart={(setup) => void session.startGame(setup)}
          />
        ) : null
      ) : (
        <Card>
          <Text style={text.heading}>Waiting for a match</Text>
          <Text style={text.body}>
            The organiser starts matches on courts from the league's live view. This screen updates by itself when
            one is put on court {court}.
          </Text>
        </Card>
      )}
    </Screen>
  );
}
