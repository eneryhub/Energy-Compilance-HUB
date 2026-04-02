-- database/migrations/003_add_photo_evidence.sql

CREATE TABLE photo_evidence (
    id SERIAL PRIMARY KEY,
    permit_id INTEGER REFERENCES permits(id) ON DELETE CASCADE,
    cloudinary_url TEXT NOT NULL,
    public_id VARCHAR(200) NOT NULL,
    metadata JSONB,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    verified_by VARCHAR(100)
);

CREATE INDEX idx_photos_permit ON photo_evidence(permit_id);