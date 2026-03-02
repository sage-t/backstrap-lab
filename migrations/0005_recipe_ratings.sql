PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS recipe_ratings (
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (recipe_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ratings_recipe_id ON recipe_ratings(recipe_id);
