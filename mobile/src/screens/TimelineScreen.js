import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useApp } from "../context/AppContext";
import AppSidebar from "../components/AppSidebar";
import AuthenticatedImage from "../components/AuthenticatedImage";
import MediaViewerModal from "../components/MediaViewerModal";
import UploadQueueModal from "../components/UploadQueueModal";
import VideoPreviewTile from "../components/VideoPreviewTile";
import * as filesApi from "../lib/api/files";
import * as libraryApi from "../lib/api/library";

const TAG_COLORS = ["#8ab4f8", "#81c995", "#f6c36d", "#f28b82", "#c58af9", "#78d9ec"];

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

function formatAlbumDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

const MediaTile = memo(
  function MediaTile({ entry, tileHeight, tileWidth, token, onPress }) {
    return (
      <Pressable
        style={[styles.card, { width: tileWidth, height: tileHeight }]}
        onPress={() => onPress(entry)}
      >
        {entry.mediaType === "video" ? (
          <VideoPreviewTile item={entry} token={token} />
        ) : (
          <AuthenticatedImage
            allowDownloadFallback={!entry.previewUrl}
            downloadPath={entry.downloadUrl}
            previewPath={entry.previewUrl}
            style={styles.image}
            token={token}
          />
        )}
      </Pressable>
    );
  },
  (previous, next) =>
    previous.entry.id === next.entry.id &&
    previous.entry.previewUrl === next.entry.previewUrl &&
    previous.entry.downloadUrl === next.entry.downloadUrl &&
    previous.entry.mediaType === next.entry.mediaType &&
    previous.tileHeight === next.tileHeight &&
    previous.tileWidth === next.tileWidth &&
    previous.token === next.token
);

const GridRow = memo(
  function GridRow({
    columnCount,
    onPressItem,
    row,
    tileWidth,
    token
  }) {
    return (
      <View style={styles.gridRow}>
        {row.map((entry) => {
          const tileHeight = getTileHeight(entry, tileWidth);

          return (
            <MediaTile
              key={entry.id}
              entry={entry}
              tileHeight={tileHeight}
              tileWidth={tileWidth}
              token={token}
              onPress={onPressItem}
            />
          );
        })}

        {row.length < columnCount
          ? Array.from({ length: columnCount - row.length }).map((_, index) => (
              <View key={`spacer-${index}`} style={{ width: tileWidth, height: 1 }} />
            ))
          : null}
      </View>
    );
  },
  (previous, next) =>
    previous.columnCount === next.columnCount &&
    previous.tileWidth === next.tileWidth &&
    previous.token === next.token &&
    previous.row.length === next.row.length &&
    previous.row.every((entry, index) => entry.id === next.row[index]?.id)
);

export default function TimelineScreen() {
  const {
    logout,
    token,
    user,
    apiBaseUrl,
    openServerSetup,
    serverInfo,
    enqueueAssets,
    retryUpload,
    uploadQueue,
    uploadQueueOpen,
    setUploadQueueOpen,
    uploadActivityKey
  } = useApp();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedAlbumID, setSelectedAlbumID] = useState("");
  const [selectedTagID, setSelectedTagID] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [albumForm, setAlbumForm] = useState({ name: "", description: "" });
  const [tagForm, setTagForm] = useState({ name: "", color: TAG_COLORS[0] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [storageStats, setStorageStats] = useState(null);
  const [filePagination, setFilePagination] = useState({
    limit: 24,
    offset: 0,
    hasMore: true
  });
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("all");
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    initializeScreen();
  }, [token]);

  useEffect(() => {
    if (!token || uploadActivityKey === 0) {
      return;
    }

    loadFiles(true, { reset: true }).catch(() => {});
    loadStorageStats().catch(() => {});
    loadCollections({ silent: true }).catch(() => {});

    if (selectedAlbumID) {
      loadAlbumDetail(selectedAlbumID, { silent: true });
    }

    if (selectedTagID) {
      loadTagDetail(selectedTagID, { silent: true });
    }
  }, [token, uploadActivityKey]);

  useEffect(() => {
    if (albums.length && (!selectedAlbumID || !albums.some((album) => album.id === selectedAlbumID))) {
      setSelectedAlbumID(albums[0].id);
      return;
    }

    if (!albums.length) {
      setSelectedAlbumID("");
      setSelectedAlbum(null);
    }
  }, [albums, selectedAlbumID]);

  useEffect(() => {
    if (tags.length && (!selectedTagID || !tags.some((tag) => tag.id === selectedTagID))) {
      setSelectedTagID(tags[0].id);
      return;
    }

    if (!tags.length) {
      setSelectedTagID("");
      setSelectedTag(null);
    }
  }, [selectedTagID, tags]);

  useEffect(() => {
    if ((activeSection === "albums" || selectedAlbum) && selectedAlbumID) {
      loadAlbumDetail(selectedAlbumID, { silent: activeSection !== "albums" });
    }
  }, [activeSection, selectedAlbumID, token]);

  useEffect(() => {
    if ((activeSection === "tags" || selectedTag) && selectedTagID) {
      loadTagDetail(selectedTagID, { silent: activeSection !== "tags" });
    }
  }, [activeSection, selectedTagID, token]);

  async function initializeScreen() {
    try {
      setLoading(true);
      setError("");
      await Promise.all([loadFiles(true, { reset: true }), loadStorageStats()]);
      loadCollections({ silent: true }).catch(() => {});
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles(isInitial = false, options = {}) {
    const reset = Boolean(options.reset);

    try {
      if (!isInitial) {
        if (reset) {
          setRefreshing(true);
        } else {
          if (!filePagination.hasMore || loadingMoreRef.current) {
            return;
          }
          loadingMoreRef.current = true;
          setLoadingMore(true);
          setLoadMoreError("");
        }
      }
      if (reset || isInitial || !items.length) {
        setError("");
      }
      const requestOffset = reset ? 0 : filePagination.offset;
      const response = await filesApi.listFiles(token, {
        limit: filePagination.limit,
        offset: requestOffset
      });

      setItems((currentValue) => {
        if (reset) {
          return response.items || [];
        }

        const seen = new Set(currentValue.map((item) => item.id));
        const nextItems = [...currentValue];
        (response.items || []).forEach((item) => {
          if (!seen.has(item.id)) {
            nextItems.push(item);
          }
        });
        return nextItems;
      });
      setFilePagination({
        limit: response.pagination?.limit || filePagination.limit,
        offset: response.pagination?.nextOffset || requestOffset,
        hasMore: Boolean(response.pagination?.hasMore)
      });
      if (!reset) {
        setLoadMoreError("");
      }
    } catch (loadError) {
      if (reset || isInitial || !items.length) {
        setError(loadError.message);
      } else {
        setLoadMoreError(loadError.message);
        console.warn("[DRFT mobile] load more failed", loadError.message);
      }
      throw loadError;
    } finally {
      if (!isInitial) {
        if (reset) {
          setRefreshing(false);
        } else {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    }
  }

  async function loadCollections(options = {}) {
    const silent = Boolean(options.silent);
    try {
      const [albumsResponse, tagsResponse] = await Promise.all([
        libraryApi.listAlbums(token),
        libraryApi.listTags(token)
      ]);
      setAlbums(albumsResponse.albums || []);
      setTags(tagsResponse.tags || []);
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message);
      } else {
        console.warn("[DRFT mobile] collections refresh failed", loadError.message);
      }
      throw loadError;
    }
  }

  async function loadStorageStats() {
    try {
      const response = await filesApi.getStorageStats(token);
      setStorageStats(response);
    } catch (loadError) {
      throw loadError;
    }
  }

  async function loadAlbumDetail(albumID, options = {}) {
    const silent = Boolean(options.silent);
    try {
      const response = await libraryApi.getAlbum(token, albumID);
      setSelectedAlbum({
        ...response.album,
        items: response.items || []
      });
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message);
      } else {
        console.warn("[DRFT mobile] album detail failed", loadError.message);
      }
    }
  }

  async function loadTagDetail(tagID, options = {}) {
    const silent = Boolean(options.silent);
    try {
      const response = await libraryApi.getTag(token, tagID);
      setSelectedTag({
        ...response.tag,
        items: response.items || []
      });
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message);
      } else {
        console.warn("[DRFT mobile] tag detail failed", loadError.message);
      }
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
      mediaTypes: ["images", "videos"],
      quality: 1
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    try {
      setError("");
      setUploadQueueOpen(true);
      enqueueAssets(result.assets).catch((uploadError) => {
        setError(uploadError.message);
      });
    } catch (uploadError) {
      setError(uploadError.message);
    }
  }

  async function handleChangeServer() {
    setSidebarOpen(false);
    openServerSetup();
  }

  async function handleDeleteItem(itemToDelete) {
    try {
      await filesApi.deleteFile(token, itemToDelete.id);
      setSelectedItem(null);
      await Promise.all([loadFiles(true, { reset: true }), loadCollections(), loadStorageStats()]);
      if (selectedAlbumID) {
        await loadAlbumDetail(selectedAlbumID);
      }
      if (selectedTagID) {
        await loadTagDetail(selectedTagID);
      }
      return true;
    } catch (deleteError) {
      setError(deleteError.message);
      return false;
    }
  }

  async function handleCreateAlbum() {
    if (!albumForm.name.trim()) {
      setError("Album name is required.");
      return;
    }

    try {
      setError("");
      const response = await libraryApi.createAlbum(token, {
        name: albumForm.name.trim(),
        description: albumForm.description.trim()
      });
      setAlbumForm({ name: "", description: "" });
      await loadCollections();
      setSelectedAlbumID(response.album.id);
      setActiveSection("albums");
    } catch (createError) {
      setError(createError.message);
    }
  }

  async function handleCreateTag() {
    if (!tagForm.name.trim()) {
      setError("Tag name is required.");
      return;
    }

    try {
      setError("");
      const response = await libraryApi.createTag(token, {
        name: tagForm.name.trim(),
        color: tagForm.color
      });
      setTagForm({ name: "", color: tagForm.color });
      await loadCollections();
      setSelectedTagID(response.tag.id);
      setActiveSection("tags");
    } catch (createError) {
      setError(createError.message);
    }
  }

  async function handleAddToSelectedAlbum(fileID) {
    if (!selectedAlbumID) {
      return;
    }

    try {
      setError("");
      await libraryApi.addFilesToAlbum(token, selectedAlbumID, [fileID]);
      await Promise.all([loadCollections(), loadAlbumDetail(selectedAlbumID)]);
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function handleAddToSelectedTag(fileID) {
    if (!selectedTagID) {
      return;
    }

    try {
      setError("");
      await libraryApi.addTagToFile(token, fileID, selectedTagID);
      await Promise.all([loadCollections(), loadTagDetail(selectedTagID)]);
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function handleRemoveFromSelectedAlbum() {
    if (!selectedAlbumID || !selectedItem) {
      return;
    }

    try {
      setError("");
      await libraryApi.removeFileFromAlbum(token, selectedAlbumID, selectedItem.id);
      setSelectedItem(null);
      await Promise.all([loadCollections(), loadAlbumDetail(selectedAlbumID)]);
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function handleRemoveFromSelectedTag() {
    if (!selectedTagID || !selectedItem) {
      return;
    }

    try {
      setError("");
      await libraryApi.removeTagFromFile(token, selectedItem.id, selectedTagID);
      setSelectedItem(null);
      await Promise.all([loadCollections(), loadTagDetail(selectedTagID)]);
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  function handleDeleteAlbum() {
    if (!selectedAlbumID) {
      return;
    }

    Alert.alert(
      "Delete album?",
      "The album will be removed, but the media stays in DRFT.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await libraryApi.deleteAlbum(token, selectedAlbumID);
              setSelectedAlbum(null);
              setSelectedAlbumID("");
              await loadCollections();
            } catch (deleteError) {
              setError(deleteError.message);
            }
          }
        }
      ]
    );
  }

  function handleDeleteTag() {
    if (!selectedTagID) {
      return;
    }

    Alert.alert(
      "Delete tag?",
      "This removes the tag, but your media stays in DRFT.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await libraryApi.deleteTag(token, selectedTagID);
              setSelectedTag(null);
              setSelectedTagID("");
              await loadCollections();
            } catch (deleteError) {
              setError(deleteError.message);
            }
          }
        }
      ]
    );
  }

  const selectedCollectionItems = activeSection === "albums"
    ? selectedAlbum?.items || []
    : activeSection === "tags"
      ? selectedTag?.items || []
      : [];

  const filteredItems = useMemo(() => {
    if (activeSection === "image") {
      return items.filter((item) => item.mediaType === "image");
    }

    if (activeSection === "video") {
      return items.filter((item) => item.mediaType === "video");
    }

    if (activeSection === "albums" || activeSection === "tags") {
      return selectedCollectionItems;
    }

    return items;
  }, [activeSection, items, selectedCollectionItems]);

  const viewerItems = filteredItems;
  const totalCount = storageStats?.totalItems ?? items.length;
  const imageCount = storageStats?.imageItems ?? items.filter((item) => item.mediaType === "image").length;
  const videoCount = storageStats?.videoItems ?? items.filter((item) => item.mediaType === "video").length;
  const columnCount = width >= 520 ? 4 : 3;
  const tileGap = 4;
  const tileWidth = Math.floor((width - 16 * 2 - tileGap * (columnCount - 1)) / columnCount);
  const groupedItems = useMemo(
    () =>
      groupItems(filteredItems).map(([dateKey, group]) => ({
        title: formatDateLabel(dateKey),
        data: chunkItems(group, columnCount).map((row, rowIndex) => ({
          id: `${dateKey}-${rowIndex}-${row.map((entry) => entry.id).join("-")}`,
          items: row
        }))
      })),
    [columnCount, filteredItems]
  );
  const selectedItemIDs = new Set(selectedCollectionItems.map((item) => item.id));
  const suggestedFiles = items.filter((item) => !selectedItemIDs.has(item.id)).slice(0, 15);
  const activeUploadCount = uploadQueue.filter(
    (entry) => entry.status === "uploading" || entry.status === "retrying"
  ).length;
  const totalQueuedCount = uploadQueue.length;
  const uploadSubtitle = activeUploadCount > 0
    ? `${activeUploadCount} active upload${activeUploadCount === 1 ? "" : "s"}`
    : totalQueuedCount > 0
      ? `${totalQueuedCount} recent transfer${totalQueuedCount === 1 ? "" : "s"}`
      : "";

  function renderMediaCollection(emptyTitle, emptyText) {
    if (!groupedItems.length) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      );
    }

    return (
      <View style={styles.collectionSections}>
        {groupedItems.map((section) => (
          <View key={section.title} style={styles.collectionSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.data.map((row) => (
              <GridRow
                key={row.id}
                columnCount={columnCount}
                onPressItem={setSelectedItem}
                row={row.items}
                tileWidth={tileWidth}
                token={token}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }

  function renderHeader() {
    const titleMap = {
      all: "All",
      image: "Images",
      video: "Videos",
      albums: "Albums",
      tags: "Tags",
      settings: "Settings"
    };

    let subtitle = `${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"} in this view`;
    if (activeSection === "settings") {
      subtitle = "Control your mobile connection and session";
    } else if (activeSection === "all") {
      subtitle = `${totalCount} item${totalCount === 1 ? "" : "s"} in your library`;
    } else if (activeSection === "image") {
      subtitle = `${imageCount} image${imageCount === 1 ? "" : "s"} in your library`;
    } else if (activeSection === "video") {
      subtitle = `${videoCount} video${videoCount === 1 ? "" : "s"} in your library`;
    } else if (activeSection === "albums") {
      subtitle = selectedAlbum
        ? `${selectedAlbum.fileCount} item${selectedAlbum.fileCount === 1 ? "" : "s"} in ${selectedAlbum.name}`
        : "Build intentional collections from your library";
    } else if (activeSection === "tags") {
      subtitle = selectedTag
        ? `${selectedTag.fileCount} file${selectedTag.fileCount === 1 ? "" : "s"} tagged ${selectedTag.name}`
        : "Use personal labels across albums and dates";
    } else if (uploadSubtitle) {
      subtitle = uploadSubtitle;
    }

    return (
      <View style={styles.topbar}>
        <Pressable style={styles.iconButton} onPress={() => setSidebarOpen(true)}>
          <Text style={styles.iconButtonText}>≡</Text>
        </Pressable>

        <View style={styles.topbarCopy}>
          <Text style={styles.eyebrow}>DRFT MOBILE</Text>
          <Text style={styles.title}>{titleMap[activeSection]}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.topbarActions}>
          <Pressable
            style={styles.secondaryHeaderButton}
            onPress={() => setUploadQueueOpen(true)}
          >
            <Text style={styles.secondaryHeaderButtonText}>
              Queue{totalQueuedCount ? ` ${totalQueuedCount}` : ""}
            </Text>
          </Pressable>

          {activeSection !== "settings" ? (
            <Pressable style={styles.primaryButton} onPress={handlePickMedia}>
              <Text style={styles.primaryButtonText}>Upload</Text>
            </Pressable>
          ) : null}
        </View>
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
          <Text style={styles.settingsText}>{totalCount} total files</Text>
          <Text style={styles.settingsText}>{imageCount} images</Text>
          <Text style={styles.settingsText}>{videoCount} videos</Text>
          <Text style={styles.settingsText}>{albums.length} albums</Text>
          <Text style={styles.settingsText}>{tags.length} tags</Text>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsEyebrow}>Server</Text>
          <Text style={styles.serverValue}>{apiBaseUrl}</Text>
          <Text style={styles.settingsText}>
            {serverInfo?.version
              ? `Backend ${serverInfo.version}${serverInfo?.env ? ` • ${serverInfo.env}` : ""}`
              : "Server details unavailable"}
          </Text>
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

  function renderAlbums() {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.collectionFormCard}>
          <Text style={styles.settingsEyebrow}>Create album</Text>
          <Text style={styles.collectionFormTitle}>Keep moments together</Text>
          <TextInput
            style={styles.input}
            placeholder="Album name"
            placeholderTextColor="#7f858c"
            value={albumForm.name}
            onChangeText={(value) => setAlbumForm((currentValue) => ({ ...currentValue, name: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Description"
            placeholderTextColor="#7f858c"
            value={albumForm.description}
            onChangeText={(value) =>
              setAlbumForm((currentValue) => ({
                ...currentValue,
                description: value
              }))
            }
          />
          <Pressable style={styles.secondaryButton} onPress={handleCreateAlbum}>
            <Text style={styles.secondaryButtonText}>Create album</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRail}>
          {albums.map((album) => (
            <Pressable
              key={album.id}
              style={[
                styles.collectionCard,
                selectedAlbumID === album.id ? styles.collectionCardActive : null
              ]}
              onPress={() => setSelectedAlbumID(album.id)}
            >
              <Text style={styles.collectionCardTitle}>{album.name}</Text>
              <Text style={styles.collectionCardMeta}>{album.fileCount} items</Text>
              <Text style={styles.collectionCardMeta}>{formatAlbumDate(album.updatedAt)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {selectedAlbum ? (
          <View style={styles.collectionDetailCard}>
            <View style={styles.collectionDetailHeader}>
              <View style={styles.collectionDetailCopy}>
                <Text style={styles.settingsEyebrow}>Album detail</Text>
                <Text style={styles.collectionDetailTitle}>{selectedAlbum.name}</Text>
                <Text style={styles.collectionDetailText}>
                  {selectedAlbum.description || "A focused collection inside DRFT."}
                </Text>
              </View>
              <View style={styles.collectionActionRow}>
                {selectedItem ? (
                  <Pressable style={styles.secondaryButton} onPress={handleRemoveFromSelectedAlbum}>
                    <Text style={styles.secondaryButtonText}>Remove selected</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.warnButton} onPress={handleDeleteAlbum}>
                  <Text style={styles.warnButtonText}>Delete album</Text>
                </Pressable>
              </View>
            </View>

            {suggestedFiles.length ? (
              <View style={styles.addStrip}>
                <Text style={styles.addStripTitle}>Add from library</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {suggestedFiles.map((file) => (
                    <Pressable
                      key={file.id}
                      style={styles.pill}
                      onPress={() => handleAddToSelectedAlbum(file.id)}
                    >
                      <Text style={styles.pillText}>{file.fileName}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {renderMediaCollection(
              "This album is empty",
              "Add a few files from your library to start shaping it."
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No album selected</Text>
            <Text style={styles.emptyText}>Choose an album above or create a new one.</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderTags() {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.collectionFormCard}>
          <Text style={styles.settingsEyebrow}>Create tag</Text>
          <Text style={styles.collectionFormTitle}>Label across dates and albums</Text>
          <TextInput
            style={styles.input}
            placeholder="Tag name"
            placeholderTextColor="#7f858c"
            value={tagForm.name}
            onChangeText={(value) => setTagForm((currentValue) => ({ ...currentValue, name: value }))}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
            {TAG_COLORS.map((color) => (
              <Pressable
                key={color}
                style={[
                  styles.colorDot,
                  { backgroundColor: color },
                  tagForm.color === color ? styles.colorDotActive : null
                ]}
                onPress={() => setTagForm((currentValue) => ({ ...currentValue, color }))}
              />
            ))}
          </ScrollView>
          <Pressable style={styles.secondaryButton} onPress={handleCreateTag}>
            <Text style={styles.secondaryButtonText}>Create tag</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRail}>
          {tags.map((tag) => (
            <Pressable
              key={tag.id}
              style={[
                styles.collectionCard,
                selectedTagID === tag.id ? styles.collectionCardActive : null
              ]}
              onPress={() => setSelectedTagID(tag.id)}
            >
              <View style={styles.tagHeader}>
                <View style={[styles.inlineTagDot, { backgroundColor: tag.color || TAG_COLORS[0] }]} />
                <Text style={styles.collectionCardTitle}>{tag.name}</Text>
              </View>
              <Text style={styles.collectionCardMeta}>{tag.fileCount} files</Text>
            </Pressable>
          ))}
        </ScrollView>

        {selectedTag ? (
          <View style={styles.collectionDetailCard}>
            <View style={styles.collectionDetailHeader}>
              <View style={styles.collectionDetailCopy}>
                <Text style={styles.settingsEyebrow}>Tag detail</Text>
                <View style={styles.tagHeader}>
                  <View style={[styles.inlineTagDot, { backgroundColor: selectedTag.color || TAG_COLORS[0] }]} />
                  <Text style={styles.collectionDetailTitle}>{selectedTag.name}</Text>
                </View>
                <Text style={styles.collectionDetailText}>
                  Personal labels that can cut across your whole DRFT library.
                </Text>
              </View>
              <View style={styles.collectionActionRow}>
                {selectedItem ? (
                  <Pressable style={styles.secondaryButton} onPress={handleRemoveFromSelectedTag}>
                    <Text style={styles.secondaryButtonText}>Remove selected</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.warnButton} onPress={handleDeleteTag}>
                  <Text style={styles.warnButtonText}>Delete tag</Text>
                </Pressable>
              </View>
            </View>

            {suggestedFiles.length ? (
              <View style={styles.addStrip}>
                <Text style={styles.addStripTitle}>Tag from library</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {suggestedFiles.map((file) => (
                    <Pressable
                      key={file.id}
                      style={styles.pill}
                      onPress={() => handleAddToSelectedTag(file.id)}
                    >
                      <Text style={styles.pillText}>{file.fileName}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {renderMediaCollection(
              "This tag is empty",
              "Attach it to files from your library to make it useful."
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No tag selected</Text>
            <Text style={styles.emptyText}>Choose a tag above or create a new one.</Text>
          </View>
        )}
      </ScrollView>
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
        serverInfo={serverInfo}
        visible={sidebarOpen}
        user={user}
      />

      {renderHeader()}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {activeSection === "settings" ? renderSettings() : null}

      {activeSection === "albums" ? renderAlbums() : null}
      {activeSection === "tags" ? renderTags() : null}

      {["all", "image", "video"].includes(activeSection) ? (
        <SectionList
          sections={groupedItems}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                Promise.all([loadFiles(false, { reset: true }), loadStorageStats()]).catch(() => {})
              }
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
            <GridRow
              columnCount={columnCount}
              onPressItem={setSelectedItem}
              row={row.items}
              tileWidth={tileWidth}
              token={token}
            />
          )}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No media yet</Text>
              <Text style={styles.emptyText}>
                Upload from your phone to start your DRFT timeline.
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.feedFooter}>
              {loadingMore ? (
                <Text style={styles.feedFooterText}>Loading more media...</Text>
              ) : null}
              {!loadingMore && loadMoreError ? (
                <>
                  <Text style={styles.feedFooterError}>{loadMoreError}</Text>
                  <Pressable
                    style={styles.loadMoreButton}
                    onPress={() => loadFiles(false, { reset: false }).catch(() => {})}
                  >
                    <Text style={styles.loadMoreButtonText}>Try again</Text>
                  </Pressable>
                </>
              ) : null}
              {!loadingMore && !loadMoreError && filePagination.hasMore ? (
                <Pressable
                  style={styles.loadMoreButton}
                  onPress={() => loadFiles(false, { reset: false }).catch(() => {})}
                >
                  <Text style={styles.loadMoreButtonText}>Load more</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      ) : null}

      <UploadQueueModal
        visible={uploadQueueOpen}
        queue={uploadQueue}
        onRetry={retryUpload}
        onClose={() => setUploadQueueOpen(false)}
      />

      <MediaViewerModal
        items={viewerItems}
        onClose={() => setSelectedItem(null)}
        onDelete={handleDeleteItem}
        selectedIndex={selectedItem ? viewerItems.findIndex((item) => item.id === selectedItem.id) : 0}
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
  topbarActions: {
    alignItems: "flex-end",
    gap: 8,
    marginTop: 2
  },
  secondaryHeaderButton: {
    backgroundColor: "#26282d",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  secondaryHeaderButtonText: {
    color: "#f1f3f4",
    fontSize: 14,
    fontWeight: "700"
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
  warnButton: {
    backgroundColor: "#312224",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  warnButtonText: {
    color: "#f28b82",
    fontWeight: "700"
  },
  error: {
    color: "#f28b82",
    marginBottom: 12
  },
  listContent: {
    paddingBottom: 28
  },
  feedFooter: {
    paddingTop: 8,
    paddingBottom: 22,
    alignItems: "center",
    gap: 10
  },
  feedFooterText: {
    color: "#aeb4bb",
    fontSize: 14
  },
  feedFooterError: {
    color: "#f28b82",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18
  },
  loadMoreButton: {
    borderRadius: 999,
    backgroundColor: "#2a3445",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  loadMoreButtonText: {
    color: "#f1f3f4",
    fontSize: 14,
    fontWeight: "700"
  },
  scrollContent: {
    paddingBottom: 28,
    gap: 16
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
  },
  collectionFormCard: {
    backgroundColor: "#202124",
    borderRadius: 22,
    padding: 18,
    gap: 10
  },
  collectionFormTitle: {
    color: "#f1f3f4",
    fontSize: 22,
    fontWeight: "800"
  },
  input: {
    backgroundColor: "#2a2c30",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#f1f3f4"
  },
  collectionRail: {
    gap: 10,
    paddingRight: 12
  },
  collectionCard: {
    width: 170,
    borderRadius: 20,
    backgroundColor: "#202124",
    padding: 14,
    gap: 6
  },
  collectionCardActive: {
    backgroundColor: "#344055"
  },
  collectionCardTitle: {
    color: "#f1f3f4",
    fontSize: 17,
    fontWeight: "700"
  },
  collectionCardMeta: {
    color: "#aeb4bb",
    fontSize: 13
  },
  collectionDetailCard: {
    backgroundColor: "#202124",
    borderRadius: 22,
    padding: 18,
    gap: 14
  },
  collectionDetailHeader: {
    gap: 14
  },
  collectionDetailCopy: {
    gap: 6
  },
  collectionDetailTitle: {
    color: "#f1f3f4",
    fontSize: 24,
    fontWeight: "800"
  },
  collectionDetailText: {
    color: "#aeb4bb",
    fontSize: 15,
    lineHeight: 22
  },
  collectionActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  addStrip: {
    gap: 10
  },
  addStripTitle: {
    color: "#f1f3f4",
    fontSize: 15,
    fontWeight: "700"
  },
  pillRow: {
    gap: 10,
    paddingRight: 12
  },
  pill: {
    backgroundColor: "#2a2c30",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  pillText: {
    color: "#f1f3f4",
    fontSize: 13,
    fontWeight: "600"
  },
  collectionSections: {
    gap: 6
  },
  collectionSection: {
    gap: 2
  },
  colorRow: {
    gap: 10,
    paddingRight: 12
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "transparent"
  },
  colorDotActive: {
    borderColor: "#f1f3f4"
  },
  tagHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  inlineTagDot: {
    width: 12,
    height: 12,
    borderRadius: 999
  }
});
