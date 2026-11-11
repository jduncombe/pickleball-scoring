// Sign in: email and password, then a code from an authenticator app.
// The first sign-in sets the authenticator up from a QR code.

import { Link, Stack } from "expo-router";
import { useState } from "react";
import { Linking, Text, View } from "react-native";

import { QrCode } from "../components/QrCode";
import { colors, spacing } from "../components/theme";
import { Button, Card, ErrorText, Field, Screen, text } from "../components/ui";
import { ApiError } from "../core/api/errors";
import type { MfaSetup } from "../core/api/types";
import { useApp } from "../state/AppContext";

type Step = { kind: "password" } | { kind: "code"; mfaToken: string; setup: MfaSetup | null };

export default function LoginScreen() {
  const { api, settings, startSession } = useApp();
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const submitPassword = () =>
    run(async () => {
      const result = await api.login(email, password);
      const setup = result.mfa_setup_required ? await api.mfaSetup(result.mfa_token) : null;
      setPassword("");
      setCode("");
      setStep({ kind: "code", mfaToken: result.mfa_token, setup });
    });

  const submitCode = () =>
    run(async () => {
      if (step.kind !== "code") return;
      try {
        await startSession(await api.mfaVerify(step.mfaToken, code));
      } catch (e) {
        // The MFA token lasts 5 minutes and is single-use; start again once it's gone.
        if (e instanceof ApiError && e.isUnauthorized && /expired|sign in/i.test(e.message)) {
          setStep({ kind: "password" });
        }
        throw e;
      }
    });

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" style={{ color: colors.primary, fontSize: 16, padding: spacing.sm }}>
              Settings
            </Link>
          ),
        }}
      />
      <Text style={text.title}>Pickleball scoring</Text>
      {!settings.apiUrl ? (
        <Card>
          <Text style={text.body}>Set the league server address before signing in.</Text>
          <Link href="/settings" style={{ color: colors.primary, fontSize: 16 }}>
            Open settings
          </Link>
        </Card>
      ) : (
        <Text style={text.muted}>Server: {settings.apiUrl}</Text>
      )}

      {step.kind === "password" ? (
        <View style={{ gap: spacing.md }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={submitPassword}
          />
          <ErrorText error={error} />
          <Button title="Continue" onPress={submitPassword} busy={busy} disabled={!email || !password} />
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {step.setup ? (
            <Card>
              <Text style={text.heading}>Set up your authenticator</Text>
              <Text style={text.body}>
                Scan this code with an authenticator app (Google Authenticator, Microsoft Authenticator,
                1Password, …), then enter the 6-digit code it shows.
              </Text>
              <QrCode dataUri={step.setup.qr_data_uri} />
              <Text style={text.muted} selectable>
                Or enter this key: {step.setup.secret}
              </Text>
              <Button
                title="Open in an authenticator on this device"
                variant="secondary"
                onPress={() => Linking.openURL(step.setup!.otpauth_uri).catch(() => undefined)}
              />
            </Card>
          ) : (
            <Text style={text.body}>Enter the 6-digit code from your authenticator app.</Text>
          )}
          <Field
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={8}
            onSubmitEditing={submitCode}
          />
          <ErrorText error={error} />
          <Button title="Sign in" onPress={submitCode} busy={busy} disabled={code.replace(/\s/g, "").length < 6} />
          <Button title="Back" variant="secondary" onPress={() => setStep({ kind: "password" })} />
        </View>
      )}
    </Screen>
  );
}
