import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { colors } from "../components/theme";
import { Loading } from "../components/ui";
import { AppProvider, useApp } from "../state/AppContext";

function RootStack() {
  const { ready, user } = useApp();
  if (!ready) return <Loading />;
  const signedIn = !!user;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ title: "Leagues" }} />
        <Stack.Screen name="league/[leagueId]" options={{ title: "Choose a court" }} />
        <Stack.Screen name="court/[leagueId]/[court]" options={{ title: "Court" }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
      </Stack.Protected>
      <Stack.Screen name="settings" options={{ title: "Settings", presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <RootStack />
      </AppProvider>
    </SafeAreaProvider>
  );
}
