package media

import (
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"strings"
	"time"

	"github.com/rwcarlsen/goexif/exif"
)

type extractedMetadata struct {
	TakenAt    *time.Time
	WidthPX    *int
	HeightPX   *int
	DurationMS *int64
}

func extractMetadata(path, mediaType string) (extractedMetadata, error) {
	switch mediaType {
	case "image":
		return extractImageMetadata(path)
	case "video":
		return extractedMetadata{}, nil
	default:
		return extractedMetadata{}, nil
	}
}

func extractImageMetadata(path string) (extractedMetadata, error) {
	file, err := os.Open(path)
	if err != nil {
		return extractedMetadata{}, fmt.Errorf("open image metadata file: %w", err)
	}
	defer file.Close()

	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return extractedMetadata{}, fmt.Errorf("decode image config: %w", err)
	}

	width := config.Width
	height := config.Height

	metadata := extractedMetadata{
		WidthPX:  &width,
		HeightPX: &height,
	}

	_, err = file.Seek(0, 0)
	if err != nil {
		return metadata, nil
	}

	x, err := exif.Decode(file)
	if err != nil {
		return metadata, nil
	}

	if takenAt, err := x.DateTime(); err == nil {
		utc := takenAt.UTC()
		metadata.TakenAt = &utc
		return metadata, nil
	}

	for _, tagName := range []exif.FieldName{exif.DateTimeOriginal, exif.DateTimeDigitized, exif.DateTime} {
		tag, err := x.Get(tagName)
		if err != nil {
			continue
		}

		value, err := tag.StringVal()
		if err != nil {
			continue
		}

		parsed, err := time.Parse("2006:01:02 15:04:05", strings.TrimSpace(value))
		if err == nil {
			utc := parsed.UTC()
			metadata.TakenAt = &utc
			break
		}
	}

	return metadata, nil
}

