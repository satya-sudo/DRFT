import { useState } from "react";
import AppShell from "../components/AppShell";
import CollectionDetailPanel from "../components/CollectionDetailPanel";
import CollectionListPanel from "../components/CollectionListPanel";
import MediaViewer from "../components/MediaViewer";
import { useApp } from "../context/AppContext";
import { useSelectableCollection } from "../lib/collections/useSelectableCollection";
import * as libraryAPI from "../lib/api/library";

function formatRelativeDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export default function AlbumsPage() {
  const { token } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: ""
  });
  const {
    detailLoading,
    error,
    files,
    filteredCollections: filteredAlbums,
    loading,
    refreshCollections: refreshAlbums,
    searchValue,
    selectedCollection: selectedAlbum,
    selectedCollectionID: selectedAlbumID,
    selectedItem,
    setCollections: setAlbums,
    setError,
    setSearchValue,
    setSelectedCollection: setSelectedAlbum,
    setSelectedCollectionID: setSelectedAlbumID,
    setSelectedItem,
    setViewerPanel,
    viewerPanel
  } = useSelectableCollection({
    token,
    listCollections: async (sessionToken) => {
      const response = await libraryAPI.listAlbums(sessionToken);
      return response.albums || [];
    },
    getCollection: async (sessionToken, albumID) => {
      const response = await libraryAPI.getAlbum(sessionToken, albumID);
      return {
        ...response.album,
        items: response.items || []
      };
    },
    searchMatcher: (album, query) => {
      const haystack = `${album.name} ${album.description || ""}`.toLowerCase();
      return haystack.includes(query);
    }
  });

  async function handleCreateAlbum(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      const response = await libraryAPI.createAlbum(token, {
        name: form.name.trim(),
        description: form.description.trim()
      });
      setAlbums((currentValue) => [response.album, ...currentValue]);
      setSelectedAlbumID(response.album.id);
      setForm({
        name: "",
        description: ""
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddFile(fileID) {
    if (!selectedAlbumID) {
      return;
    }

    try {
      setError("");
      await libraryAPI.addFilesToAlbum(token, selectedAlbumID, [fileID]);
      await refreshAlbums();
      const response = await libraryAPI.getAlbum(token, selectedAlbumID);
      setSelectedAlbum({
        ...response.album,
        items: response.items || []
      });
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function handleRemoveSelectedItem() {
    if (!selectedAlbumID || !selectedItem) {
      return;
    }

    try {
      setError("");
      await libraryAPI.removeFileFromAlbum(token, selectedAlbumID, selectedItem.id);
      setSelectedItem(null);
      await refreshAlbums();
      const response = await libraryAPI.getAlbum(token, selectedAlbumID);
      setSelectedAlbum({
        ...response.album,
        items: response.items || []
      });
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function handleDeleteAlbum() {
    if (!selectedAlbumID) {
      return;
    }

    if (!window.confirm("Delete this album? The media will stay in DRFT.")) {
      return;
    }

    try {
      setError("");
      await libraryAPI.deleteAlbum(token, selectedAlbumID);
      setSelectedItem(null);
      setSelectedAlbum(null);
      setSelectedAlbumID("");
      await refreshAlbums();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  const selectedItemIDs = new Set((selectedAlbum?.items || []).map((item) => item.id));
  const suggestedFiles = files
    .filter((file) => !selectedItemIDs.has(file.id))
    .slice(0, 18);

  return (
    <AppShell
      title="Albums"
      description="Group moments into intentional collections. Albums stay lightweight and only reference media already stored in DRFT."
      searchValue={searchValue}
      onSearchChange={setSearchValue}
    >
      <div className="library-layout">
        <form className="surface form-stack library-form-card" onSubmit={handleCreateAlbum}>
          <div className="form-header">
            <h2>Create an album</h2>
            <p>Name a collection, give it a little context, and start adding media from your library.</p>
          </div>

          <label>
            <span>Name</span>
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm((currentValue) => ({ ...currentValue, name: event.target.value }))
              }
              placeholder="Road trip"
            />
          </label>

          <label>
            <span>Description</span>
            <input
              value={form.description}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  description: event.target.value
                }))
              }
              placeholder="A few lines about what belongs here"
            />
          </label>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Creating..." : "Create album"}
          </button>
        </form>

        <CollectionListPanel
          eyebrow="Collections"
          title="Your albums"
          countLabel={`${filteredAlbums.length} total`}
          loading={loading}
          loadingTitle="Loading albums"
          loadingDescription="Fetching your saved collections from DRFT."
          emptyTitle="No albums yet"
          emptyDescription="Create your first collection to start curating groups of media."
          items={filteredAlbums}
          selectedID={selectedAlbumID}
          onSelect={setSelectedAlbumID}
          renderItem={(album) => (
            <>
              <strong>{album.name}</strong>
              <span>{album.fileCount} items</span>
              {album.description ? <p>{album.description}</p> : null}
              <small>Updated {formatRelativeDate(album.updatedAt)}</small>
            </>
          )}
        />

        <CollectionDetailPanel
          error={error}
          emptySelectionTitle="Select an album"
          emptySelectionDescription="Choose a collection from the left to browse it and add media."
          loading={detailLoading}
          loadingTitle="Loading album"
          loadingDescription="Pulling the current album contents into view."
          selectedID={selectedAlbumID}
          collection={selectedAlbum}
          headerEyebrow="Album detail"
          headerTitle={selectedAlbum?.name || ""}
          headerDescription={selectedAlbum?.description || "A lightweight collection inside DRFT."}
          headerActions={
            <>
              {selectedItem ? (
                <button type="button" className="ghost-button" onClick={handleRemoveSelectedItem}>
                  Remove selected
                </button>
              ) : null}
              <button type="button" className="ghost-button danger-button" onClick={handleDeleteAlbum}>
                Delete album
              </button>
            </>
          }
          pickerTitle="Add from library"
          pickerCount={`${suggestedFiles.length} available`}
          pickerItems={suggestedFiles}
          onPick={handleAddFile}
          emptyCollectionTitle="This album is empty"
          emptyCollectionDescription="Add a few items from your library to start shaping the collection."
          onSelectItem={(item) => {
            setSelectedItem(item);
            setViewerPanel("none");
          }}
        />
      </div>

      <MediaViewer
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        pendingDelete={viewerPanel}
        onToggleInfo={() =>
          setViewerPanel((currentValue) => (currentValue === "info" ? "none" : "info"))
        }
      />
    </AppShell>
  );
}
