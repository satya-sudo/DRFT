package enrichment

import (
	"context"
	"fmt"
	"path/filepath"
)

type PipelineProcessor struct {
	store       *Store
	storageRoot string
}

func NewPipelineProcessor(store *Store, storageRoot string) *PipelineProcessor {
	return &PipelineProcessor{
		store:       store,
		storageRoot: storageRoot,
	}
}

func (p *PipelineProcessor) Process(ctx context.Context, job Job) error {
	file, err := p.store.GetFileForJob(ctx, job.FileID)
	if err != nil {
		return err
	}

	if file.MediaType != "image" {
		return nil
	}

	metadata, err := extractImageMetadata(filepath.Join(p.storageRoot, file.StorageKey))
	if err != nil {
		return fmt.Errorf("extract image metadata: %w", err)
	}

	if metadata.Latitude == nil || metadata.Longitude == nil {
		return nil
	}

	if err := p.store.UpsertPlaceSuggestion(ctx, file.UserID, file.ID, *metadata.Latitude, *metadata.Longitude); err != nil {
		return fmt.Errorf("upsert place suggestion: %w", err)
	}

	return nil
}
