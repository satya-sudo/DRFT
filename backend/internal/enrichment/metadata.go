package enrichment

import (
	"fmt"
	"os"

	"github.com/rwcarlsen/goexif/exif"
)

type imageMetadata struct {
	Latitude  *float64
	Longitude *float64
}

func extractImageMetadata(path string) (imageMetadata, error) {
	file, err := os.Open(path)
	if err != nil {
		return imageMetadata{}, fmt.Errorf("open image metadata file: %w", err)
	}
	defer file.Close()

	x, err := exif.Decode(file)
	if err != nil {
		return imageMetadata{}, nil
	}

	latitude, longitude, err := x.LatLong()
	if err != nil {
		return imageMetadata{}, nil
	}

	return imageMetadata{
		Latitude:  &latitude,
		Longitude: &longitude,
	}, nil
}
