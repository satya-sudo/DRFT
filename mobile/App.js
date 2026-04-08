import { SafeAreaView, StatusBar, StyleSheet, View } from "react-native";
import { Text } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { AppProvider, useApp } from "./src/context/AppContext";
import LoginScreen from "./src/screens/LoginScreen";
import ServerSetupScreen from "./src/screens/ServerSetupScreen";
import TimelineScreen from "./src/screens/TimelineScreen";

function AppNavigator() {
  const { apiBaseUrl, booting, token, user } = useApp();

  if (booting) {
    return (
      <View style={styles.bootScreen}>
        <Text style={styles.bootWordmark}>DRFT</Text>
        <Text style={styles.bootText}>Loading your library...</Text>
      </View>
    );
  }

  if (!apiBaseUrl) {
    return <ServerSetupScreen />;
  }

  return token || user ? <TimelineScreen /> : <LoginScreen />;
}

export default function App() {
  return (
    <AppProvider>
      <SafeAreaView style={styles.app}>
        <StatusBar barStyle="light-content" />
        <ExpoStatusBar style="light" />
        <AppNavigator />
      </SafeAreaView>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: "#181818"
  },
  bootScreen: {
    flex: 1,
    backgroundColor: "#181818",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  bootWordmark: {
    color: "#f1f3f4",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 1.6
  },
  bootText: {
    color: "#aeb4bb",
    fontSize: 15
  }
});
