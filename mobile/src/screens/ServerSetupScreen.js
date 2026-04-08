import { useMemo, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../context/AppContext";
import { getSuggestedApiBaseUrl } from "../lib/config";

function normalizeDisplayValue(value) {
  return (value || "").trim();
}

function ensureScheme(value) {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `http://${value}`;
}

export default function ServerSetupScreen() {
  const { configureServer } = useApp();
  const [input, setInput] = useState(getSuggestedApiBaseUrl());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const normalizedExample = useMemo(() => ensureScheme(normalizeDisplayValue(input)), [input]);

  async function handleConnect() {
    const value = ensureScheme(normalizeDisplayValue(input));

    if (!value) {
      setError("Enter the DRFT server host and port, for example 192.168.1.109:8080.");
      setSuccess("");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      await configureServer(value);
      setSuccess("Connected to DRFT. You can sign in now.");
    } catch (connectError) {
      setError(
        connectError.network
          ? "Could not reach that DRFT server. Check the host, port, Wi-Fi, and that the backend is running."
          : connectError.message
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>DRFT MOBILE</Text>
        <Text style={styles.title}>Connect to your server</Text>
        <Text style={styles.description}>
          Enter the DRFT host and port this phone should use. We will test the connection before showing the login screen.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="192.168.1.109:8080"
          placeholderTextColor="#7f858d"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={input}
          onChangeText={setInput}
        />

        <Text style={styles.helper}>
          Example: {normalizedExample || getSuggestedApiBaseUrl() || "http://192.168.1.109:8080"}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Pressable style={styles.button} onPress={handleConnect} disabled={submitting}>
          <Text style={styles.buttonText}>
            {submitting ? "Checking server..." : "Use this server"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#181818",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: (StatusBar.currentHeight || 0) + 20
  },
  card: {
    backgroundColor: "#202124",
    borderRadius: 24,
    padding: 20,
    gap: 14
  },
  eyebrow: {
    color: "#8ab4f8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8
  },
  title: {
    color: "#f1f3f4",
    fontSize: 28,
    fontWeight: "700"
  },
  description: {
    color: "#aeb4bb",
    fontSize: 15,
    lineHeight: 22
  },
  input: {
    backgroundColor: "#2b2c2f",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f1f3f4"
  },
  helper: {
    color: "#7f858d",
    fontSize: 13
  },
  error: {
    color: "#f28b82"
  },
  success: {
    color: "#81c995"
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8ab4f8",
    borderRadius: 999,
    paddingVertical: 14
  },
  buttonText: {
    color: "#111318",
    fontSize: 16,
    fontWeight: "700"
  }
});
