import { useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { useApp } from "../context/AppContext";

export default function LoginScreen() {
  const { apiBaseUrl, clearServerConfig, login } = useApp();
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      setSubmitting(true);
      setError("");
      await login(form);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>DRFT MOBILE</Text>
        <Text style={styles.title}>Sign in to your library</Text>
        <Text style={styles.description}>
          This first mobile milestone focuses on login, timeline browsing, media viewing, and upload.
        </Text>
        <Text style={styles.serverLabel}>Server: {apiBaseUrl}</Text>

        <TextInput
          style={styles.input}
          placeholder="you@drft.local"
          placeholderTextColor="#7f858d"
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          onChangeText={(value) => setForm((current) => ({ ...current, email: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#7f858d"
          secureTextEntry
          value={form.password}
          onChangeText={(value) => setForm((current) => ({ ...current, password: value }))}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleLogin} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Signing in..." : "Enter DRFT"}</Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={clearServerConfig}>
          <Text style={styles.linkText}>Change server</Text>
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
  serverLabel: {
    color: "#7f858d",
    fontSize: 13
  },
  input: {
    backgroundColor: "#2b2c2f",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f1f3f4"
  },
  error: {
    color: "#f28b82"
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
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 4
  },
  linkText: {
    color: "#8ab4f8",
    fontSize: 14,
    fontWeight: "600"
  }
});
