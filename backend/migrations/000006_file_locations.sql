CREATE TABLE IF NOT EXISTS file_locations (
    file_id UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    source TEXT NOT NULL DEFAULT 'exif_gps' CHECK (source IN ('exif_gps')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_locations_user_updated
    ON file_locations (user_id, updated_at DESC);
