import { StyleSheet, Text, View } from "react-native";

export default function VideoPreviewTile() {
  return (
    <View style={styles.container}>
      <View style={styles.playBadge}>
        <Text style={styles.playBadgeText}>▶</Text>
      </View>
      <Text style={styles.title}>Video</Text>
      <Text style={styles.subtitle}>Open to play in viewer</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#232427",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  playBadge: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: "#344055",
    alignItems: "center",
    justifyContent: "center"
  },
  playBadgeText: {
    color: "#f1f3f4",
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 2
  },
  title: {
    color: "#f1f3f4",
    fontSize: 16,
    fontWeight: "700"
  },
  subtitle: {
    color: "#aeb4bb",
    fontSize: 13,
    fontWeight: "500"
  }
});
