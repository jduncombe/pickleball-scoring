// The only place that knows which native storage modules back the core's
// KeyValueStore. Android and iOS share this code; the web build falls back to
// localStorage for secrets because SecureStore isn't available there.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { KeyValueStore } from "../core/storage";

/** General app data: settings and games in progress. */
export const appStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

// SecureStore keys may only contain letters, numbers, ".", "-" and "_".
const secureKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

/** Secrets (the access token): Android Keystore / iOS Keychain. */
export const secretStore: KeyValueStore =
  Platform.OS === "web"
    ? {
        getItem: async (key) => globalThis.localStorage?.getItem(key) ?? null,
        setItem: async (key, value) => globalThis.localStorage?.setItem(key, value),
        removeItem: async (key) => globalThis.localStorage?.removeItem(key),
      }
    : {
        getItem: (key) => SecureStore.getItemAsync(secureKey(key)),
        setItem: (key, value) => SecureStore.setItemAsync(secureKey(key), value),
        removeItem: (key) => SecureStore.deleteItemAsync(secureKey(key)),
      };
