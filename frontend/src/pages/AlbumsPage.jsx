import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import MediaGrid from "../components/MediaGrid";
import MediaViewer from "../components/MediaViewer";
import { useApp } from "../context/AppContext";
import * as filesAPI from "../lib/api/files";
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
  const [albums, setAlbums] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedAlbumID, setSelectedAlbumID] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewerPanel, setViewerPanel] = useState("none");
  const [form, setForm] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    loadData();
  }, [token]);

  useEffect(() => {
    if (!albums.length) {
      setSelectedAlbumID("");
      setSelectedAlbum(null);
      return;
    }

    if (!selectedAlbumID || !albums.some((album) => album.id === selectedAlbumID)) {
      setSelectedAlbumID(albums[0].id);
      return;
    }

    loadAlbum(selectedAlbumID);
  }, [albums, selectedAlbumID]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [albumsResponse, filesResponse] = await Promise.all([
        libraryAPI.listAlbums(token),
        filesAPI.listFiles(token)
      ]);
      setAlbums(albumsResponse.albums || []);
      setFiles(filesResponse.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAlbum(albumID) {
    if (!albumID) {
      return;
    }

    try {
      setDetailLoading(true);
      setError("");
      const response = await libraryAPI.getAlbum(token, albumID);
      setSelectedAlbum({
        ...response.album,
        items: response.items || []
      });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setDetailLoading(false);
    }
  }

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
      await Promise.all([loadAlbum(selectedAlbumID), refreshAlbums()]);
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
      await Promise.all([loadAlbum(selectedAlbumID), refreshAlbums()]);
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

  async function refreshAlbums() {
    const response = await libraryAPI.listAlbums(token);
    setAlbums(response.albums || []);
  }

  const filteredAlbums = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return albums;
    }

    return albums.filter((album) => {
      const haystack = `${album.name} ${album.description || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [albums, searchValue]);

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

        <section className="surface library-sidebar-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Collections</span>
              <h2>Your albums</h2>
            </div>
            <span className="panel-count">{filteredAlbums.length} total</span>
          </div>

          {loading ? (
            <div className="empty-state">
              <h2>Loading albums</h2>
              <p>Fetching your saved collections from DRFT.</p>
            </div>
          ) : filteredAlbums.length ? (
            <div className="collection-list">
              {filteredAlbums.map((album) => (
                <button
                  type="button"
                  key={album.id}
                  className={
                    album.id === selectedAlbumID
                      ? "collection-card collection-card-active"
                      : "collection-card"
                  }
                  onClick={() => setSelectedAlbumID(album.id)}
                >
                  <strong>{album.name}</strong>
                  <span>{album.fileCount} items</span>
                  {album.description ? <p>{album.description}</p> : null}
                  <small>Updated {formatRelativeDate(album.updatedAt)}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No albums yet</h2>
              <p>Create your first collection to start curating groups of media.</p>
            </div>
          )}
        </section>

        <section className="surface library-detail-panel">
          {error ? <div className="form-error">{error}</div> : null}

          {!selectedAlbumID ? (
            <div className="empty-state">
              <h2>Select an album</h2>
              <p>Choose a collection from the left to browse it and add media.</p>
            </div>
          ) : detailLoading || !selectedAlbum ? (
            <div className="empty-state">
              <h2>Loading album</h2>
              <p>Pulling the current album contents into view.</p>
            </div>
          ) : (
            <div className="library-detail-stack">
              <div className="library-detail-header">
                <div>
                  <span className="eyebrow">Album detail</span>
                  <h2>{selectedAlbum.name}</h2>
                  <p>{selectedAlbum.description || "A lightweight collection inside DRFT."}</p>
                </div>
                <div className="library-detail-actions">
                  {selectedItem ? (
                    <button type="button" className="ghost-button" onClick={handleRemoveSelectedItem}>
                      Remove selected
                    </button>
                  ) : null}
                  <button type="button" className="ghost-button danger-button" onClick={handleDeleteAlbum}>
                    Delete album
                  </button>
                </div>
              </div>

              {suggestedFiles.length ? (
                <div className="picker-strip">
                  <div className="picker-strip-header">
                    <strong>Add from library</strong>
                    <span>{suggestedFiles.length} available</span>
                  </div>
                  <div className="picker-chip-row">
                    {suggestedFiles.map((file) => (
                      <button
                        type="button"
                        key={file.id}
                        className="picker-chip"
                        onClick={() => handleAddFile(file.id)}
                      >
                        {file.fileName}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedAlbum.items?.length ? (
                <MediaGrid
                  items={selectedAlbum.items}
                  onSelect={(item) => {
                    setSelectedItem(item);
                    setViewerPanel("none");
                  }}
                />
              ) : (
                <div className="empty-state">
                  <h2>This album is empty</h2>
                  <p>Add a few items from your library to start shaping the collection.</p>
                </div>
              )}
            </div>
          )}
        </section>
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
