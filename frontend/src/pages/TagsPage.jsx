import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import MediaGrid from "../components/MediaGrid";
import MediaViewer from "../components/MediaViewer";
import { useApp } from "../context/AppContext";
import * as filesAPI from "../lib/api/files";
import * as libraryAPI from "../lib/api/library";

const DEFAULT_COLORS = ["#8ab4f8", "#81c995", "#f6c36d", "#f28b82", "#c58af9", "#78d9ec"];

export default function TagsPage() {
  const { token } = useApp();
  const [tags, setTags] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedTagID, setSelectedTagID] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewerPanel, setViewerPanel] = useState("none");
  const [form, setForm] = useState({
    name: "",
    color: DEFAULT_COLORS[0]
  });

  useEffect(() => {
    loadData();
  }, [token]);

  useEffect(() => {
    if (!tags.length) {
      setSelectedTagID("");
      setSelectedTag(null);
      return;
    }

    if (!selectedTagID || !tags.some((tag) => tag.id === selectedTagID)) {
      setSelectedTagID(tags[0].id);
      return;
    }

    loadTag(selectedTagID);
  }, [selectedTagID, tags]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [tagsResponse, filesResponse] = await Promise.all([
        libraryAPI.listTags(token),
        filesAPI.listFiles(token)
      ]);
      setTags(tagsResponse.tags || []);
      setFiles(filesResponse.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTag(tagID) {
    if (!tagID) {
      return;
    }

    try {
      setDetailLoading(true);
      setError("");
      const response = await libraryAPI.getTag(token, tagID);
      setSelectedTag({
        ...response.tag,
        items: response.items || []
      });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshTags() {
    const response = await libraryAPI.listTags(token);
    setTags(response.tags || []);
  }

  async function handleCreateTag(event) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      const response = await libraryAPI.createTag(token, {
        name: form.name.trim(),
        color: form.color
      });
      setTags((currentValue) => [response.tag, ...currentValue]);
      setSelectedTagID(response.tag.id);
      setForm({
        name: "",
        color: response.tag.color || DEFAULT_COLORS[0]
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAttachFile(fileID) {
    if (!selectedTagID) {
      return;
    }

    try {
      setError("");
      await libraryAPI.addTagToFile(token, fileID, selectedTagID);
      await Promise.all([loadTag(selectedTagID), refreshTags()]);
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function handleDetachSelectedItem() {
    if (!selectedTagID || !selectedItem) {
      return;
    }

    try {
      setError("");
      await libraryAPI.removeTagFromFile(token, selectedItem.id, selectedTagID);
      setSelectedItem(null);
      await Promise.all([loadTag(selectedTagID), refreshTags()]);
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function handleDeleteTag() {
    if (!selectedTagID) {
      return;
    }

    if (!window.confirm("Delete this tag? Tagged media will remain in DRFT.")) {
      return;
    }

    try {
      setError("");
      await libraryAPI.deleteTag(token, selectedTagID);
      setSelectedItem(null);
      setSelectedTag(null);
      setSelectedTagID("");
      await refreshTags();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  const filteredTags = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return tags;
    }

    return tags.filter((tag) => tag.name.toLowerCase().includes(query));
  }, [searchValue, tags]);

  const taggedItemIDs = new Set((selectedTag?.items || []).map((item) => item.id));
  const suggestedFiles = files
    .filter((file) => !taggedItemIDs.has(file.id))
    .slice(0, 18);

  return (
    <AppShell
      title="Tags"
      description="Use personal tags as a flexible second layer of organization. They stay per-user and can be manual now, automatic later."
      searchValue={searchValue}
      onSearchChange={setSearchValue}
    >
      <div className="library-layout">
        <form className="surface form-stack library-form-card" onSubmit={handleCreateTag}>
          <div className="form-header">
            <h2>Create a tag</h2>
            <p>Keep tags personal and lightweight so they can power future filters, albums, and auto-tagging.</p>
          </div>

          <label>
            <span>Name</span>
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm((currentValue) => ({ ...currentValue, name: event.target.value }))
              }
              placeholder="Family"
            />
          </label>

          <label>
            <span>Color</span>
            <select
              value={form.color}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  color: event.target.value
                }))
              }
            >
              {DEFAULT_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>

          <div className="tag-color-row">
            {DEFAULT_COLORS.map((color) => (
              <button
                type="button"
                key={color}
                className={color === form.color ? "tag-swatch tag-swatch-active" : "tag-swatch"}
                style={{ backgroundColor: color }}
                onClick={() =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    color
                  }))
                }
                aria-label={`Choose ${color}`}
              />
            ))}
          </div>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Creating..." : "Create tag"}
          </button>
        </form>

        <section className="surface library-sidebar-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Labels</span>
              <h2>Your tags</h2>
            </div>
            <span className="panel-count">{filteredTags.length} total</span>
          </div>

          {loading ? (
            <div className="empty-state">
              <h2>Loading tags</h2>
              <p>Fetching your personal labels from DRFT.</p>
            </div>
          ) : filteredTags.length ? (
            <div className="collection-list">
              {filteredTags.map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  className={
                    tag.id === selectedTagID
                      ? "collection-card collection-card-active"
                      : "collection-card"
                  }
                  onClick={() => setSelectedTagID(tag.id)}
                >
                  <div className="tag-card-title">
                    <span className="tag-dot" style={{ backgroundColor: tag.color || DEFAULT_COLORS[0] }} />
                    <strong>{tag.name}</strong>
                  </div>
                  <span>{tag.fileCount} files</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No tags yet</h2>
              <p>Create a first label and start grouping media across albums and dates.</p>
            </div>
          )}
        </section>

        <section className="surface library-detail-panel">
          {error ? <div className="form-error">{error}</div> : null}

          {!selectedTagID ? (
            <div className="empty-state">
              <h2>Select a tag</h2>
              <p>Choose a label from the left to see everything attached to it.</p>
            </div>
          ) : detailLoading || !selectedTag ? (
            <div className="empty-state">
              <h2>Loading tag</h2>
              <p>Pulling tagged media into view.</p>
            </div>
          ) : (
            <div className="library-detail-stack">
              <div className="library-detail-header">
                <div>
                  <span className="eyebrow">Tag detail</span>
                  <h2>{selectedTag.name}</h2>
                  <p>Use this tag to cut across albums and dates without duplicating media.</p>
                </div>
                <div className="library-detail-actions">
                  {selectedItem ? (
                    <button type="button" className="ghost-button" onClick={handleDetachSelectedItem}>
                      Remove selected
                    </button>
                  ) : null}
                  <button type="button" className="ghost-button danger-button" onClick={handleDeleteTag}>
                    Delete tag
                  </button>
                </div>
              </div>

              <div className="tag-banner">
                <span className="tag-dot" style={{ backgroundColor: selectedTag.color || DEFAULT_COLORS[0] }} />
                <strong>{selectedTag.fileCount} files carry this tag</strong>
              </div>

              {suggestedFiles.length ? (
                <div className="picker-strip">
                  <div className="picker-strip-header">
                    <strong>Tag from library</strong>
                    <span>{suggestedFiles.length} available</span>
                  </div>
                  <div className="picker-chip-row">
                    {suggestedFiles.map((file) => (
                      <button
                        type="button"
                        key={file.id}
                        className="picker-chip"
                        onClick={() => handleAttachFile(file.id)}
                      >
                        {file.fileName}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedTag.items?.length ? (
                <MediaGrid
                  items={selectedTag.items}
                  onSelect={(item) => {
                    setSelectedItem(item);
                    setViewerPanel("none");
                  }}
                />
              ) : (
                <div className="empty-state">
                  <h2>This tag is empty</h2>
                  <p>Attach it to a few media items and it becomes a powerful cross-cutting filter.</p>
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
