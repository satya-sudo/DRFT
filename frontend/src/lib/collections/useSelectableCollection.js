import { useEffect, useMemo, useState } from "react";
import * as filesAPI from "../api/files";

export function useSelectableCollection({
  token,
  listCollections,
  getCollection,
  searchMatcher
}) {
  const [collections, setCollections] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedCollectionID, setSelectedCollectionID] = useState("");
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewerPanel, setViewerPanel] = useState("none");

  useEffect(() => {
    loadData();
  }, [token]);

  useEffect(() => {
    if (!collections.length) {
      setSelectedCollectionID("");
      setSelectedCollection(null);
      return;
    }

    if (
      !selectedCollectionID ||
      !collections.some((collection) => collection.id === selectedCollectionID)
    ) {
      setSelectedCollectionID(collections[0].id);
      return;
    }

    loadCollection(selectedCollectionID);
  }, [collections, selectedCollectionID]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [collectionsResponse, filesResponse] = await Promise.all([
        listCollections(token),
        filesAPI.listFiles(token)
      ]);
      setCollections(collectionsResponse || []);
      setFiles(filesResponse.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCollection(collectionID) {
    if (!collectionID) {
      return;
    }

    try {
      setDetailLoading(true);
      setError("");
      const response = await getCollection(token, collectionID);
      setSelectedCollection(response);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshCollections() {
    const response = await listCollections(token);
    setCollections(response || []);
  }

  const filteredCollections = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return collections;
    }

    return collections.filter((collection) => searchMatcher(collection, query));
  }, [collections, searchMatcher, searchValue]);

  return {
    collections,
    detailLoading,
    error,
    files,
    filteredCollections,
    loading,
    refreshCollections,
    searchValue,
    selectedCollection,
    selectedCollectionID,
    selectedItem,
    setCollections,
    setError,
    setSearchValue,
    setSelectedCollection,
    setSelectedCollectionID,
    setSelectedItem,
    setViewerPanel,
    viewerPanel
  };
}
