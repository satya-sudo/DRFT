import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useApp } from "../context/AppContext";
import * as filesApi from "../lib/api/files";
import AuthenticatedImage from "../components/AuthenticatedImage";
import AppSidebar from "../components/AppSidebar";
import MediaViewerModal from "../components/MediaViewerModal";
import VideoPreviewTile from "../components/VideoPreviewTile";

function formatDateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

function groupItems(items) {
  const grouped = items.reduce((accumulator, item) => {
    const key = item.takenAt.slice(0, 10);
    if (!accumulator[key]) {
      accumulator[key] = [];
    }

    accumulator[key].push(item);
    return accumulator;
  }, {});

  return Object.entries(grouped).sort((left, right) => right[0].localeCompare(left[0]));
}

function chunkItems(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getTileHeight(item, tileWidth) {
  if (item.widthPx && item.heightPx && item.widthPx > 0 && item.heightPx > 0) {
    const rawHeight = Math.round((tileWidth * item.heightPx) / item.widthPx);
    return Math.max(96, Math.min(rawHeight, 220));
  }

  return item.mediaType === "video" ? 160 : 126;
}

export default function TimelineScreen() {
  const { logout, token, user, apiBaseUrl, clearServerConfig } = useApp();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("all");

  useEffect(() => {
    loadFiles(true);
  }, [token]);

  async function loadFiles(isInitial = false) {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError("");
      const response = await filesApi.listFiles(token);
      setItems(response.items);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handlePickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Media library permission is required for upload.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 1
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    try {
      setUploading(true);
      setError("");

      for (const asset of result.assets) {
        setUploadLabel(asset.fileName || asset.uri.split("/").pop() || "Uploading");
        await filesApi.uploadAssetWithProgress(token, asset);
      }

      await loadFiles(true);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
      setUploadLabel("");
    }
  }

  async function handleChangeServer() {
    setSidebarOpen(false);
    await clearServerConfig();
  }

  async function handleDeleteItem(itemToDelete, currentIndex) {
    try {
      await filesApi.deleteFile(token, itemToDelete.id);
      const nextItems = items.filter((item) => item.id !== itemToDelete.id);
      setItems(nextItems);
      if (!nextItems.length) {
        setSelectedItem(null);
        return true;
      }

      const nextFilteredItems =
        activeSection === "image"
          ? nextItems.filter((item) => item.mediaType === "image")
          : activeSection === "video"
            ? nextItems.filter((item) => item.mediaType === "video")
            : nextItems;
      const nextIndex = Math.min(currentIndex, nextFilteredItems.length - 1);
      setSelectedItem(nextFilteredItems[nextIndex] || null);
      return false;
    } catch (deleteError) {
      setError(deleteError.message);
      return false;
    }
  }

  const filteredItems = useMemo(() => {
    if (activeSection === "image") {
      return items.filter((item) => item.mediaType === "image");
    }

    if (activeSection === "video") {
      return items.filter((item) => item.mediaType === "video");
    }

    return items;
  }, [activeSection, items]);

  const columnCount = width >= 520 ? 4 : 3;
  const tileGap = 4;
  const tileWidth = Math.floor((width - 16 * 2 - tileGap * (columnCount - 1)) / columnCount);
  const groupedItems = useMemo(
    () =>
      groupItems(filteredItems).map(([dateKey, group]) => ({
        title: formatDateLabel(dateKey),
        data: chunkItems(group, columnCount)
      })),
    [columnCount, filteredItems]
  );
  const imageCount = items.filter((item) => item.mediaType === "image").length;
  const videoCount = items.filter((item) => item.mediaType === "video").length;

  function renderHeader() {
    const title =
      activeSection === "image"
        ? "Images"
        : activeSection === "video"
          ? "Videos"
          : "Everything";
    const subtitle =
      activeSection === "settings"
        ? "Control your mobile connection and session"
        : uploading
          ? uploadLabel || "Uploading into DRFT"
          : `${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"} in this view`;

    return (
      <View style={styles.topbar}>
        <Pressable style={styles.iconButton} onPress={() => setSidebarOpen(true)}>
          <Text style={styles.iconButtonText}>≡</Text>
        </Pressable>

        <View style={styles.topbarCopy}>
          <Text style={styles.eyebrow}>DRFT MOBILE</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {activeSection !== "settings" ? (
          <Pressable style={styles.primaryButton} onPress={handlePickMedia}>
            <Text style={styles.primaryButtonText}>{uploading ? "Uploading..." : "Upload"}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderSettings() {
    return (
      <View style={styles.settingsStack}>
        <View style={styles.settingsCard}>
          <Text style={styles.settingsEyebrow}>Account</Text>
          <Text style={styles.settingsTitle}>{user?.name || "DRFT user"}</Text>
          <Text style={styles.settingsText}>{user?.email || "Signed in to DRFT"}</Text>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsEyebrow}>Library</Text>
          <Text style={styles.settingsText}>{items.length} total files</Text>
          <Text style={styles.settingsText}>{imageCount} images</Text>
          <Text style={styles.settingsText}>{videoCount} videos</Text>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsEyebrow}>Server</Text>
          <Text style={styles.serverValue}>{apiBaseUrl}</Text>
          <View style={styles.settingsActions}>
            <Pressable style={styles.secondaryButton} onPress={handleChangeServer}>
              <Text style={styles.secondaryButtonText}>Change server</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={logout}>
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Loading your library...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppSidebar
        activeSection={activeSection}
        apiBaseUrl={apiBaseUrl}
        onChangeSection={setActiveSection}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
        onChangeServer={handleChangeServer}
        visible={sidebarOpen}
        user={user}
      />

      {renderHeader()}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {activeSection === "settings" ? renderSettings() : null}

      {activeSection === "settings" ? null : (
        <SectionList
          sections={groupedItems}
          keyExtractor={(item, index) =>
            `${item.map((entry) => entry.id).join("-")}-${index}`
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFiles(false)}
              tintColor="#8ab4f8"
            />
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item: row }) => (
            <View style={styles.gridRow}>
              {row.map((entry) => {
                const tileHeight = getTileHeight(entry, tileWidth);

                return (
                  <Pressable
                    key={entry.id}
                    style={[styles.card, { width: tileWidth, height: tileHeight }]}
                    onPress={() => setSelectedItem(entry)}
                  >
                    {entry.mediaType === "video" ? (
                      <VideoPreviewTile item={entry} token={token} />
                    ) : (
                      <AuthenticatedImage
                        downloadPath={entry.downloadUrl}
                        previewPath={entry.previewUrl}
                        style={styles.image}
                        token={token}
                      />
                    )}
                  </Pressable>
                );
              })}

              {row.length < columnCount ? (
                Array.from({ length: columnCount - row.length }).map((_, index) => (
                  <View key={`spacer-${index}`} style={{ width: tileWidth, height: 1 }} />
                ))
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No media yet</Text>
              <Text style={styles.emptyText}>
                Upload from your phone to start your DRFT timeline.
              </Text>
            </View>
          }
        />
      )}
      <MediaViewerModal
        items={filteredItems}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDeleteItem}
        selectedIndex={selectedItem ? filteredItems.findIndex((item) => item.id === selectedItem.id) : 0}
        token={token}
        visible={Boolean(selectedItem)}
      />
    </View>
  );
}

const statusBarOffset = (StatusBar.currentHeight || 0) + 10;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#181818",
    paddingTop: statusBarOffset,
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#181818",
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: {
    color: "#aeb4bb",
    fontSize: 15
  },
  topbar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 14
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#26282d",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  iconButtonText: {
    color: "#f1f3f4",
    fontSize: 20,
    fontWeight: "700"
  },
  topbarCopy: {
    flex: 1,
    gap: 4
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
    fontWeight: "800"
  },
  subtitle: {
    color: "#aeb4bb",
    fontSize: 13,
    lineHeight: 18
  },
  primaryButton: {
    backgroundColor: "#8ab4f8",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 2
  },
  primaryButtonText: {
    color: "#111318",
    fontSize: 15,
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#2b2c2f",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: "#f1f3f4",
    fontWeight: "600"
  },
  error: {
    color: "#f28b82",
    marginBottom: 12
  },
  listContent: {
    paddingBottom: 28
  },
  sectionHeader: {
    marginBottom: 8,
    marginTop: 10
  },
  sectionTitle: {
    color: "#f1f3f4",
    fontSize: 20,
    fontWeight: "800"
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#232427"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  emptyState: {
    backgroundColor: "#202124",
    borderRadius: 22,
    padding: 20,
    gap: 8,
    marginTop: 24
  },
  emptyTitle: {
    color: "#f1f3f4",
    fontSize: 22,
    fontWeight: "700"
  },
  emptyText: {
    color: "#aeb4bb",
    fontSize: 15,
    lineHeight: 22
  },
  settingsStack: {
    gap: 14
  },
  settingsCard: {
    backgroundColor: "#202124",
    borderRadius: 22,
    padding: 18,
    gap: 8
  },
  settingsEyebrow: {
    color: "#8ab4f8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  settingsTitle: {
    color: "#f1f3f4",
    fontSize: 22,
    fontWeight: "800"
  },
  settingsText: {
    color: "#c2c6cc",
    fontSize: 15,
    lineHeight: 21
  },
  serverValue: {
    color: "#f1f3f4",
    fontSize: 15,
    lineHeight: 22
  },
  settingsActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6
  }
});
