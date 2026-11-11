// Home: courts this device is scoring, and the leagues being played.

import { Link, router, Stack } from "expo-router";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../components/theme";
import { Card, ErrorText, text } from "../components/ui";
import { loadClaimedCourts } from "../core/storage";
import { appStore } from "../platform/storage";
import { useApp } from "../state/AppContext";
import { useLoader } from "../state/useLoader";

export default function LeaguesScreen() {
  const { api, user } = useApp();
  const { data, error, loading, reload } = useLoader(async () => {
    const [leagues, claimed] = await Promise.all([api.leagues(), loadClaimedCourts(appStore)]);
    return { leagues, claimed };
  });

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom", "left", "right"]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" style={{ color: colors.primary, fontSize: 16, padding: spacing.sm }}>
              Settings
            </Link>
          ),
        }}
      />
      <FlatList
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, maxWidth: 720, width: "100%", alignSelf: "center" }}
        data={data?.leagues ?? []}
        keyExtractor={(league) => String(league.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            {user ? <Text style={text.muted}>Signed in as {user.name}</Text> : null}
            <ErrorText error={error} />
            {data?.claimed.length ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={text.heading}>Your courts</Text>
                {data.claimed.map((c) => (
                  <Card
                    key={`${c.leagueId}-${c.court}`}
                    onPress={() => router.push(`/court/${c.leagueId}/${c.court}`)}
                    style={{ borderColor: colors.primary, borderWidth: 2 }}
                  >
                    <Text style={text.heading}>Court {c.court}</Text>
                    <Text style={text.muted}>{c.leagueName} · tap to carry on scoring</Text>
                  </Card>
                ))}
              </View>
            ) : null}
            <Text style={text.heading}>Leagues being played</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : <Text style={text.muted}>No leagues are being played right now. Pull down to refresh.</Text>
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push({ pathname: "/league/[leagueId]", params: { leagueId: item.id } })}>
            <Text style={text.heading}>{item.name}</Text>
            <Text style={text.muted}>
              Week {item.current_week} · {item.num_courts} court{item.num_courts === 1 ? "" : "s"} · games to{" "}
              {item.points_to_win}
            </Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
