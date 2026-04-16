import { useState } from "react";
import AppShell from "../components/AppShell";
import CollectionDetailPanel from "../components/CollectionDetailPanel";
import CollectionListPanel from "../components/CollectionListPanel";
import MediaViewer from "../components/MediaViewer";
import { useApp } from "../context/AppContext";
import { useSelectableCollection } from "../lib/collections/useSelectableCollection";
import * as libraryAPI from "../lib/api/library";

const DEFAULT_COLORS = ["#8ab4f8", "#81c995", "#f6c36d", "#f28b82", "#c58af9", "#78d9ec"];

export default function TagsPage() {
  const { token } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    color: DEFAULT_COLORS[0]
  });
  const {
    detailLoading,
    error,
    files,
    filteredCollections: filteredTags,
    loading,
    refreshCollections: refreshTags,
    searchValue,
    selectedCollection: selectedTag,
    selectedCollectionID: selectedTagID,
    selectedItem,
    setCollections: setTags,
    setError,
    setSearchValue,
    setSelectedCollection: setSelectedTag,
    setSelectedCollectionID: setSelectedTagID,
    setSelectedItem,
    setViewerPanel,
    viewerPanel
  } = useSelectableCollection({
    token,
    listCollections: async (sessionToken) => {
      const response = await libraryAPI.listTags(sessionToken);
      return response.tags || [];
    },
    getCollection: async (sessionToken, tagID) => {
      const response = await libraryAPI.getTag(sessionToken, tagID);
      return {
        ...response.tag,
        items: response.items || []
      };
    },
    searchMatcher: (tag, query) => tag.name.toLowerCase().includes(query)
  });

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
      await refreshTags();
      const response = await libraryAPI.getTag(token, selectedTagID);
      setSelectedTag({
        ...response.tag,
        items: response.items || []
      });
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
      await refreshTags();
      const response = await libraryAPI.getTag(token, selectedTagID);
      setSelectedTag({
        ...response.tag,
        items: response.items || []
      });
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

        <CollectionListPanel
          eyebrow="Labels"
          title="Your tags"
          countLabel={`${filteredTags.length} total`}
          loading={loading}
          loadingTitle="Loading tags"
          loadingDescription="Fetching your personal labels from DRFT."
          emptyTitle="No tags yet"
          emptyDescription="Create a first label and start grouping media across albums and dates."
          items={filteredTags}
          selectedID={selectedTagID}
          onSelect={setSelectedTagID}
          renderItem={(tag) => (
            <>
              <div className="tag-card-title">
                <span
                  className="tag-dot"
                  style={{ backgroundColor: tag.color || DEFAULT_COLORS[0] }}
                />
                <strong>{tag.name}</strong>
              </div>
              <span>{tag.fileCount} files</span>
            </>
          )}
        />

        <CollectionDetailPanel
          error={error}
          emptySelectionTitle="Select a tag"
          emptySelectionDescription="Choose a label from the left to see everything attached to it."
          loading={detailLoading}
          loadingTitle="Loading tag"
          loadingDescription="Pulling tagged media into view."
          selectedID={selectedTagID}
          collection={selectedTag}
          headerEyebrow="Tag detail"
          headerTitle={selectedTag?.name || ""}
          headerDescription="Use this tag to cut across albums and dates without duplicating media."
          headerActions={
            <>
              {selectedItem ? (
                <button type="button" className="ghost-button" onClick={handleDetachSelectedItem}>
                  Remove selected
                </button>
              ) : null}
              <button type="button" className="ghost-button danger-button" onClick={handleDeleteTag}>
                Delete tag
              </button>
            </>
          }
          helperBanner={
            selectedTag ? (
              <div className="tag-banner">
                <span
                  className="tag-dot"
                  style={{ backgroundColor: selectedTag.color || DEFAULT_COLORS[0] }}
                />
                <strong>{selectedTag.fileCount} files carry this tag</strong>
              </div>
            ) : null
          }
          pickerTitle="Tag from library"
          pickerCount={`${suggestedFiles.length} available`}
          pickerItems={suggestedFiles}
          onPick={handleAttachFile}
          emptyCollectionTitle="This tag is empty"
          emptyCollectionDescription="Attach it to a few media items and it becomes a powerful cross-cutting filter."
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
