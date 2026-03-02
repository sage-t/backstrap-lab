PRAGMA foreign_keys = ON;

ALTER TABLE variations ADD COLUMN parent_variation_id INTEGER REFERENCES variations(id) ON DELETE SET NULL;
ALTER TABLE variations ADD COLUMN rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_variations_parent_variation_id ON variations(parent_variation_id);
CREATE INDEX IF NOT EXISTS idx_variations_rating ON variations(rating);
