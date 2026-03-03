PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  weight_preference TEXT NOT NULL DEFAULT 'metric_g'
    CHECK (weight_preference IN ('metric_g', 'imperial_lb_oz')),
  volume_preference TEXT NOT NULL DEFAULT 'metric_ml'
    CHECK (volume_preference IN ('metric_ml', 'kitchen_us')),
  updated_at TEXT NOT NULL
);
