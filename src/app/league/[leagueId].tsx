// Pick one of a league's free courts and claim it for this device.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../components/theme";
import { Card, ErrorText, text } from "../../components/ui";
import { addClaimedCourt } from "../../core/storage";
import { appStore } from "../../platform/storage";
import { useApp } from "../../state/AppContext";
import { useLoader } from "../../state/useLoader";

export default function CourtsScreen() {
  const leagueId = Number(useLocalSearchParams<{ leagueId: string }>().leagueId);
  const { api, settings } = useApp();
  const [claiming, setClaiming] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const { data, error, loading, reload } = useLoader(async () => {
    const [leagues, courts] = await Promise.all([api.leagues(), api.freeCourts(leagueId)]);
    return { league: leagues.find((l) => l.id === leagueId) ?? null, courts };
  });

  async function claim(court: number) {
    if (!data?.league) return;
    setClaiming(court);
    setClaimError(null);
    try {
      await api.claimCourt(leagueId, court, settings.deviceName);
      await addClaimedCourt(appStore, {
        leagueId,
        leagueName: data.league.name,
        court,
        pointsToWin: data.league.points_to_win,
      });
      router.replace(`/court/${leagueId}/${court}`);
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : String(e));
      void reload();
    } finally {
      setClaiming(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom", "left", "right"]}>
      <Stack.Screen options={{ title: data?.league?.name ?? "Choose a court" }} />
      <FlatList
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, maxWidth: 720, width: "100%", alignSelf: "center" }}
        data={data?.courts ?? []}
        keyExtractor={(c) => String(c.court)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm }}>
            <Text style={text.body}>
              Choose the court this device is at. Claiming it stops other scoring apps from using it.
            </Text>
            <ErrorText error={error ?? claimError} />
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : <Text style={text.muted}>Every court has been claimed by another device.</Text>
        }
        renderItem={({ item }) => (
          <Card onPress={claiming ? undefined : () => claim(item.court)}>
            <Text style={text.heading}>{claiming === item.court ? `Claiming court ${item.court}…` : `Court ${item.court}`}</Text>
            <Text style={[text.muted, item.in_use && { color: colors.warning }]}>
              {item.in_use ? "A match is being played here now" : "Free"}
            </Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
