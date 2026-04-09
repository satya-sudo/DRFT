import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

const NAV_ITEMS = [
  { id: "all", label: "Everything" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "albums", label: "Albums" },
  { id: "tags", label: "Tags" },
  { id: "settings", label: "Settings" }
];

export default function AppSidebar({
  activeSection,
  apiBaseUrl,
  onChangeSection,
  onClose,
  onLogout,
  onChangeServer,
  visible,
  user
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.drawer}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>DRFT</Text>
            <Text style={styles.tagline}>Private media cloud</Text>
          </View>

          <View style={styles.navGroup}>
            {NAV_ITEMS.slice(0, 3).map((item) => (
              <Pressable
                key={item.id}
                style={[
                  styles.navItem,
                  activeSection === item.id ? styles.navItemActive : null
                ]}
                onPress={() => {
                  onChangeSection(item.id);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.navItemText,
                    activeSection === item.id ? styles.navItemTextActive : null
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.navGroup}>
            {NAV_ITEMS.slice(3).map((item) => (
              <Pressable
                key={item.id}
                style={[
                  styles.navItem,
                  activeSection === item.id ? styles.navItemActive : null
                ]}
                onPress={() => {
                  onChangeSection(item.id);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.navItemText,
                    activeSection === item.id ? styles.navItemTextActive : null
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.footer}>
            <View style={styles.serverCard}>
              <Text style={styles.serverLabel}>Connected server</Text>
              <Text style={styles.serverValue}>{apiBaseUrl || "Not set"}</Text>
            </View>

            <View style={styles.userCard}>
              <Text style={styles.userName}>{user?.name || "DRFT user"}</Text>
              <Text style={styles.userEmail}>{user?.email || "Signed in"}</Text>
            </View>

            <Pressable style={styles.actionButton} onPress={onChangeServer}>
              <Text style={styles.actionButtonText}>Change server</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={onLogout}>
              <Text style={styles.actionButtonText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
        <Pressable style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flexDirection: "row"
  },
  backdrop: {
    flex: 1
  },
  drawer: {
    width: 286,
    backgroundColor: "#1f2023",
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 20,
    borderRightWidth: 1,
    borderRightColor: "#2a2c30"
  },
  header: {
    gap: 4,
    marginBottom: 28
  },
  wordmark: {
    color: "#f1f3f4",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  tagline: {
    color: "#8b9198",
    fontSize: 14,
    lineHeight: 20
  },
  navGroup: {
    gap: 8
  },
  divider: {
    height: 1,
    backgroundColor: "#2a2c30",
    marginVertical: 14
  },
  navItem: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  navItemActive: {
    backgroundColor: "#344055"
  },
  navItemText: {
    color: "#c4c8ce",
    fontSize: 16,
    fontWeight: "600"
  },
  navItemTextActive: {
    color: "#f1f3f4"
  },
  footer: {
    marginTop: "auto",
    gap: 12
  },
  serverCard: {
    backgroundColor: "#24262a",
    borderRadius: 18,
    padding: 14,
    gap: 8
  },
  serverLabel: {
    color: "#8ab4f8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  serverValue: {
    color: "#f1f3f4",
    fontSize: 13,
    lineHeight: 18
  },
  userCard: {
    backgroundColor: "#24262a",
    borderRadius: 18,
    padding: 14,
    gap: 4
  },
  userName: {
    color: "#f1f3f4",
    fontSize: 15,
    fontWeight: "700"
  },
  userEmail: {
    color: "#aeb4bb",
    fontSize: 13
  },
  actionButton: {
    borderRadius: 18,
    backgroundColor: "#2a2c30",
    paddingVertical: 13,
    alignItems: "center"
  },
  actionButtonText: {
    color: "#f1f3f4",
    fontSize: 15,
    fontWeight: "600"
  }
});
