CREATE TABLE IF NOT EXISTS file_enrichment (
    file_id UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_status TEXT NOT NULL DEFAULT 'pending' CHECK (overall_status IN ('pending', 'processing', 'completed', 'failed')),
    face_status TEXT NOT NULL DEFAULT 'pending' CHECK (face_status IN ('pending', 'processing', 'completed', 'failed')),
    place_status TEXT NOT NULL DEFAULT 'pending' CHECK (place_status IN ('pending', 'processing', 'completed', 'failed')),
    last_error TEXT NOT NULL DEFAULT '',
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_enrichment_user_status
    ON file_enrichment (user_id, overall_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS enrichment_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL DEFAULT 'full' CHECK (job_type IN ('full', 'face', 'place')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry_wait')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_error TEXT NOT NULL DEFAULT '',
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status_available
    ON enrichment_jobs (status, available_at ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_user_status
    ON enrichment_jobs (user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrichment_jobs_active_file_job
    ON enrichment_jobs (file_id, job_type)
    WHERE status IN ('pending', 'processing', 'retry_wait');

CREATE TABLE IF NOT EXISTS places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT '',
    locality TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    source TEXT NOT NULL DEFAULT 'exif_gps' CHECK (source IN ('exif_gps')),
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_user_status_updated
    ON places (user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS file_place_suggestions (
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    confidence REAL,
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (file_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_file_place_suggestions_place_id
    ON file_place_suggestions (place_id);

CREATE TABLE IF NOT EXISTS face_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    confidence REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_detections_user_file
    ON face_detections (user_id, file_id, created_at DESC);

CREATE TABLE IF NOT EXISTS person_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'hidden')),
    cover_face_detection_id UUID NULL REFERENCES face_detections(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_clusters_user_status_updated
    ON person_clusters (user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS person_cluster_members (
    cluster_id UUID NOT NULL REFERENCES person_clusters(id) ON DELETE CASCADE,
    face_detection_id UUID NOT NULL REFERENCES face_detections(id) ON DELETE CASCADE,
    distance_score REAL,
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (cluster_id, face_detection_id)
);
