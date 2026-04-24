import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { VideoView, useVideoPlayer } from "expo-video";
import AuthenticatedImage from "./AuthenticatedImage";
import { buildAuthenticatedMediaURL } from "../lib/config";

function formatTakenAt(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function fileExtensionFor(item) {
  const mime = item?.mimeType || "";

  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/quicktime") return "mov";

  return item?.mediaType === "video" ? "mp4" : "jpg";
}

function ViewerSlide({ active, item, token }) {
  const mediaPath =
    item.mediaType === "video"
      ? item.downloadUrl
      : item.downloadUrl || item.previewUrl;

  useEffect(() => {
    if (!active || !mediaPath) {
      return;
    }

    console.info("[DRFT media] opening viewer source", {
      mediaType: item.mediaType,
      mediaPath
    });
  }, [active, item.mediaType, mediaPath]);

  const mediaSource = useMemo(
    () => ({
      uri: buildAuthenticatedMediaURL(mediaPath, token)
    }),
    [mediaPath, token]
  );

  const player = useVideoPlayer(active && item.mediaType === "video" ? mediaSource : null, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.play();
  });

  if (!active) {
    return <View style={styles.slide} />;
  }

  if (item.mediaType === "video") {
    return (
      <View style={styles.slide}>
        <VideoView
          player={player}
          style={styles.viewerMedia}
          contentFit="contain"
          nativeControls
          surfaceType="textureView"
        />
      </View>
    );
  }

  return (
    <View style={styles.slide}>
      <AuthenticatedImage
        allowDownloadFallback
        downloadPath={item.downloadUrl}
        previewPath={item.previewUrl}
        resizeMode="contain"
        style={styles.viewerMedia}
        token={token}
      />
    </View>
  );
}

export default function MediaViewerModal({
  items,
  onClose,
  onDelete,
  selectedIndex,
  token,
  visible
}) {
  const flatListRef = useRef(null);
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(selectedIndex || 0);
  const [showInfo, setShowInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setCurrentIndex(selectedIndex || 0);
    setShowInfo(false);
  }, [selectedIndex, visible]);

  useEffect(() => {
    if (!visible || !flatListRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        animated: false,
        index: selectedIndex || 0
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedIndex, visible]);

  const currentItem = items?.[currentIndex];

  async function handleSave() {
    if (!currentItem || saving) {
      return;
    }

    try {
      setSaving(true);
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow photo access to save this file locally.");
        return;
      }

      const filename = `${currentItem.fileName || "drft-media"}.${fileExtensionFor(currentItem)}`;
      const destination = new File(Paths.cache, filename);
      const remoteURL = buildAuthenticatedMediaURL(
        currentItem.downloadUrl || currentItem.previewUrl,
        token
      );

      const downloaded = await File.downloadFileAsync(remoteURL, destination);
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
      Alert.alert("Saved", "This media has been added to your local library.");
    } catch (error) {
      Alert.alert("Save failed", "DRFT could not save this media to the device.");
    } finally {
      setSaving(false);
    }
  }

  function handleDeletePress() {
    if (!currentItem || deleting) {
      return;
    }

    Alert.alert(
      "Delete media?",
      "This will remove the selected file from DRFT and its previews. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              const shouldClose = await onDelete?.(currentItem, currentIndex);
              if (shouldClose) {
                onClose();
              }
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  }

  if (!visible || !currentItem) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.counter}>
              {currentIndex + 1} / {items.length}
            </Text>
            <Text style={styles.title}>{currentItem.fileName}</Text>
            <Text style={styles.subtitle}>{formatTakenAt(currentItem.takenAt)}</Text>
          </View>

          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={selectedIndex || 0}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index
          })}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View style={{ width, height }}>
              <ViewerSlide active={currentIndex === index} item={item} token={token} />
            </View>
          )}
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(
              event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width
            );
            setCurrentIndex(nextIndex);
          }}
        />

        <View style={styles.actionBar}>
          <Pressable style={styles.actionButton} onPress={handleSave} disabled={saving}>
            <Text style={styles.actionText}>{saving ? "Saving..." : "Save local"}</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setShowInfo((value) => !value)}>
            <Text style={styles.actionText}>{showInfo ? "Hide info" : "More info"}</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={handleDeletePress} disabled={deleting}>
            <Text style={styles.deleteText}>{deleting ? "Deleting..." : "Delete"}</Text>
          </Pressable>
        </View>

        {showInfo ? (
          <View style={styles.infoPanel}>
            <Text style={styles.infoLine}>Type: {currentItem.mediaType}</Text>
            <Text style={styles.infoLine}>Taken: {formatTakenAt(currentItem.takenAt)}</Text>
            {currentItem.widthPx && currentItem.heightPx ? (
              <Text style={styles.infoLine}>
                Size: {currentItem.widthPx} x {currentItem.heightPx}
              </Text>
            ) : null}
            <Text style={styles.infoLine}>Mime: {currentItem.mimeType}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#0d0f13"
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 42,
    paddingBottom: 10,
    backgroundColor: "rgba(13, 15, 19, 0.72)"
  },
  headerCopy: {
    flex: 1,
    paddingRight: 16
  },
  counter: {
    color: "#8ab4f8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4
  },
  title: {
    color: "#f1f3f4",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4
  },
  subtitle: {
    color: "#aeb4bb",
    fontSize: 13,
    marginTop: 4
  },
  closeButton: {
    backgroundColor: "rgba(39, 42, 46, 0.95)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  closeText: {
    color: "#f1f3f4",
    fontWeight: "600"
  },
  slide: {
    width: "100%",
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  viewerMedia: {
    width: "100%",
    height: "100%"
  },
  actionBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    zIndex: 3,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  actionButton: {
    flex: 1,
    backgroundColor: "rgba(39, 42, 46, 0.95)",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center"
  },
  actionText: {
    color: "#f1f3f4",
    fontSize: 14,
    fontWeight: "600"
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "rgba(93, 31, 35, 0.96)",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center"
  },
  deleteText: {
    color: "#ffd9d6",
    fontSize: 14,
    fontWeight: "700"
  },
  infoPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 88,
    zIndex: 3,
    backgroundColor: "rgba(25, 28, 34, 0.95)",
    borderRadius: 18,
    padding: 14,
    gap: 6
  },
  infoLine: {
    color: "#d7dbe0",
    fontSize: 14
  }
});
