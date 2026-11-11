import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { Button, ErrorText, Field, Screen, text } from "../components/ui";
import { ApiClient, normaliseBaseUrl } from "../core/api/client";
import { useApp } from "../state/AppContext";

export default function SettingsScreen() {
  const { settings, updateSettings, user, signOut } = useApp();
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [deviceName, setDeviceName] = useState(settings.deviceName);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function testConnection() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      await new ApiClient({ baseUrl: apiUrl }).health();
      setStatus(`Connected to ${normaliseBaseUrl(apiUrl)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const serverChanged = normaliseBaseUrl(apiUrl) !== settings.apiUrl;
    // A session belongs to the server that issued it.
    if (serverChanged && user) await signOut();
    await updateSettings({ apiUrl, deviceName });
    if (router.canGoBack()) router.back();
  }

  return (
    <Screen>
      <Field
        label="League server address"
        value={apiUrl}
        onChangeText={setApiUrl}
        placeholder="https://league.example.com/api"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={text.muted}>
        The API's address. Behind the league website it's usually the site address followed by /api. For an API
        running on your computer, use http://10.0.2.2:8000 from the Android emulator.
      </Text>
      <Button title="Test connection" variant="secondary" onPress={testConnection} busy={busy} disabled={!apiUrl} />
      {status ? <Text style={text.body}>{status}</Text> : null}
      <ErrorText error={error} />

      <Field
        label="Device name"
        value={deviceName}
        onChangeText={setDeviceName}
        placeholder="e.g. Court 3 tablet"
        maxLength={80}
      />
      <Text style={text.muted}>Shown to anyone else who tries to claim this tablet's court.</Text>

      <Button title="Save" onPress={save} />
      {user ? (
        <>
          <Text style={text.muted}>
            Signed in as {user.name} ({user.email})
          </Text>
          <Button title="Sign out" variant="danger" onPress={() => void signOut()} />
        </>
      ) : null}
    </Screen>
  );
}
