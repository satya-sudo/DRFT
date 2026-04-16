package media

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

const sniffBufferSize = 512

type bufferedUpload struct {
	Reader     io.Reader
	SniffBytes []byte
	MIMEType   string
}

func prepareUpload(source io.Reader) (bufferedUpload, error) {
	buffer := make([]byte, sniffBufferSize)
	readBytes, err := io.ReadFull(source, buffer)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return bufferedUpload{}, fmt.Errorf("read upload sniff buffer: %w", err)
	}

	sniffBytes := append([]byte(nil), buffer[:readBytes]...)
	return bufferedUpload{
		Reader:     io.MultiReader(bytes.NewReader(sniffBytes), source),
		SniffBytes: sniffBytes,
		MIMEType:   http.DetectContentType(sniffBytes),
	}, nil
}

func writeFile(root, storageKey string, source io.Reader) (string, int64, error) {
	fullPath := filepath.Join(root, storageKey)

	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return "", 0, fmt.Errorf("create media directory: %w", err)
	}

	destination, err := os.Create(fullPath)
	if err != nil {
		return "", 0, fmt.Errorf("create media file: %w", err)
	}
	defer destination.Close()

	written, err := io.Copy(destination, source)
	if err != nil {
		return "", 0, fmt.Errorf("write media file: %w", err)
	}

	return fullPath, written, nil
}

func computeSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open file for checksum: %w", err)
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("hash file: %w", err)
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

func removeFileIfExists(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	return nil
}

func buildStorageKey(id, extension string) string {
	trimmedExt := strings.TrimPrefix(strings.ToLower(extension), ".")
	if trimmedExt == "" {
		return filepath.ToSlash(filepath.Join(id[:2], id[2:4], id))
	}

	return filepath.ToSlash(filepath.Join(id[:2], id[2:4], id+"."+trimmedExt))
}

type storageStats struct {
	DrftUsedBytes  int64
	AvailableBytes int64
	TotalBytes     int64
}

func readStorageStats(root string) (storageStats, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return storageStats{}, fmt.Errorf("prepare storage root: %w", err)
	}

	usedBytes, err := directorySize(root)
	if err != nil {
		return storageStats{}, err
	}

	var fsStats syscall.Statfs_t
	if err := syscall.Statfs(root, &fsStats); err != nil {
		return storageStats{}, fmt.Errorf("read filesystem stats: %w", err)
	}

	blockSize := int64(fsStats.Bsize)
	return storageStats{
		DrftUsedBytes:  usedBytes,
		AvailableBytes: int64(fsStats.Bavail) * blockSize,
		TotalBytes:     int64(fsStats.Blocks) * blockSize,
	}, nil
}

func directorySize(root string) (int64, error) {
	var total int64

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		total += info.Size()
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("measure storage usage: %w", err)
	}

	return total, nil
}
