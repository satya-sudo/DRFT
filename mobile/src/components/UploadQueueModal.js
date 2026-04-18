import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function formatBytes(value) {
  if (!value || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** index;
  return `${scaled >= 10 || index === 0 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[index]}`;
}

export default function UploadQueueModal({ onClose, onRetry, queue, visible }) {
  const activeCount = queue.filter((entry) => entry.status === "uploading" || entry.status === "retrying").length;
  const totalBytes = queue.reduce((sum, entry) => sum + (entry.sizeBytes || 0), 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Uploads</Text>
              <Text style={styles.title}>Transfer queue</Text>
            </View>
            <Text style={styles.meta}>
              {activeCount} active • {formatBytes(totalBytes)}
            </Text>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {queue.length ? (
              queue.map((entry) => (
                <View key={entry.id} style={styles.item}>
                  <View style={styles.itemHeader}>
                    <Text numberOfLines={1} style={styles.itemName}>
                      {entry.name}
                    </Text>
                    <Text style={styles.itemPercent}>{Math.round(entry.progress || 0)}%</Text>
                  </View>
                  <Text style={styles.itemMeta}>
                    {entry.status === "retrying"
                      ? entry.error
                      : entry.status === "error"
                        ? entry.error || "Upload failed"
                        : entry.status === "done"
                          ? "Uploaded to DRFT"
                          : `${formatBytes(entry.sizeBytes)} in progress`}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressBar,
                        entry.status === "error"
                          ? styles.progressBarError
                          : entry.status === "done"
                            ? styles.progressBarDone
                            : null,
                        { width: `${Math.max(6, Math.min(100, entry.progress || 0))}%` }
                      ]}
                    />
                  </View>
                  {entry.status === "error" ? (
                    <Pressable style={styles.retryButton} onPress={() => onRetry?.(entry.id)}>
                      <Text style={styles.retryButtonText}>Retry upload</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No active uploads</Text>
                <Text style={styles.emptyText}>Start a transfer and DRFT will track it here.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    backgroundColor: "rgba(0, 0, 0, 0.45)"
  },
  backdrop: {
    flex: 1
  },
  sheet: {
    position: "absolute",
    top: 92,
    right: 16,
    left: 16,
    maxHeight: 420,
    backgroundColor: "#222428",
    borderWidth: 1,
    borderColor: "#2f3237",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12
  },
  header: {
    gap: 8,
    marginBottom: 12
  },
  eyebrow: {
    color: "#8ab4f8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  title: {
    color: "#f1f3f4",
    fontSize: 28,
    fontWeight: "800"
  },
  meta: {
    color: "#aeb4bb",
    fontSize: 15,
    fontWeight: "500"
  },
  list: {
    maxHeight: 300
  },
  listContent: {
    gap: 14,
    paddingBottom: 6
  },
  item: {
    gap: 8
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  itemName: {
    flex: 1,
    color: "#f1f3f4",
    fontSize: 20,
    fontWeight: "700"
  },
  itemPercent: {
    color: "#c4c8ce",
    fontSize: 15,
    fontWeight: "700"
  },
  itemMeta: {
    color: "#aeb4bb",
    fontSize: 15,
    lineHeight: 21
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#2f3237",
    overflow: "hidden"
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#8ab4f8"
  },
  progressBarDone: {
    backgroundColor: "#81c995"
  },
  progressBarError: {
    backgroundColor: "#f28b82"
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#312224",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  retryButtonText: {
    color: "#f28b82",
    fontSize: 13,
    fontWeight: "700"
  },
  emptyState: {
    borderRadius: 18,
    backgroundColor: "#26282d",
    padding: 18,
    gap: 6
  },
  emptyTitle: {
    color: "#f1f3f4",
    fontSize: 18,
    fontWeight: "700"
  },
  emptyText: {
    color: "#aeb4bb",
    fontSize: 15,
    lineHeight: 21
  }
});
