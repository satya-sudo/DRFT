package media

import (
	"fmt"
	"image"
	"image/jpeg"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"
)

const thumbnailMaxDimension = 480

func generateThumbnail(root, sourcePath, fileID string) (string, error) {
	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return "", fmt.Errorf("open thumbnail source: %w", err)
	}
	defer sourceFile.Close()

	img, _, err := image.Decode(sourceFile)
	if err != nil {
		return "", fmt.Errorf("decode thumbnail source: %w", err)
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= 0 || height <= 0 {
		return "", fmt.Errorf("invalid image dimensions")
	}

	targetWidth, targetHeight := fitWithin(width, height, thumbnailMaxDimension)
	if targetWidth == width && targetHeight == height {
		targetWidth, targetHeight = fitWithin(width, height, 960)
	}

	thumb := resizeNearest(img, targetWidth, targetHeight)
	thumbnailKey := buildThumbnailKey(fileID)
	fullPath := filepath.Join(root, thumbnailKey)

	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return "", fmt.Errorf("create thumbnail directory: %w", err)
	}

	outputFile, err := os.Create(fullPath)
	if err != nil {
		return "", fmt.Errorf("create thumbnail file: %w", err)
	}
	defer outputFile.Close()

	if err := jpeg.Encode(outputFile, thumb, &jpeg.Options{Quality: 82}); err != nil {
		return "", fmt.Errorf("encode thumbnail: %w", err)
	}

	return thumbnailKey, nil
}

func buildThumbnailKey(fileID string) string {
	normalized := strings.ReplaceAll(fileID, "-", "")
	return filepath.ToSlash(filepath.Join("thumbnails", normalized[:2], normalized[:4], fileID+".jpg"))
}

func fitWithin(width, height, maxDimension int) (int, int) {
	if width <= maxDimension && height <= maxDimension {
		return width, height
	}

	if width >= height {
		return maxDimension, max(1, height*maxDimension/width)
	}

	return max(1, width*maxDimension/height), maxDimension
}

func resizeNearest(source image.Image, targetWidth, targetHeight int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	sourceBounds := source.Bounds()
	sourceWidth := sourceBounds.Dx()
	sourceHeight := sourceBounds.Dy()

	for y := 0; y < targetHeight; y++ {
		srcY := sourceBounds.Min.Y + y*sourceHeight/targetHeight
		for x := 0; x < targetWidth; x++ {
			srcX := sourceBounds.Min.X + x*sourceWidth/targetWidth
			dst.Set(x, y, source.At(srcX, srcY))
		}
	}

	return dst
}

