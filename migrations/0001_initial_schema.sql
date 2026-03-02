PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags_json TEXT,
  base_meat_grams INTEGER NOT NULL DEFAULT 1000,
  base_animal TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipes_user_updated ON recipes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes(title);

CREATE TABLE IF NOT EXISTS recipe_cuts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  cut_name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_cuts_recipe_id ON recipe_cuts(recipe_id);

CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT 'local',
  name TEXT NOT NULL,
  default_display_unit TEXT NOT NULL DEFAULT 'g' CHECK (default_display_unit IN ('g','ml','tsp','tbsp')),
  created_at TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ingredients_user_name ON ingredients(user_id, name);

CREATE TABLE IF NOT EXISTS ingredient_conversions (
  ingredient_id INTEGER PRIMARY KEY REFERENCES ingredients(id) ON DELETE CASCADE,
  grams_per_ml REAL,
  grams_per_tsp REAL,
  source_note TEXT,
  updated_at TEXT NOT NULL,
  CHECK (grams_per_ml IS NULL OR grams_per_ml > 0),
  CHECK (grams_per_tsp IS NULL OR grams_per_tsp > 0)
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  amount_grams_per_base REAL,
  amount_ml_per_base REAL,
  display_unit_override TEXT CHECK (display_unit_override IS NULL OR display_unit_override IN ('g','ml','tsp','tbsp')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK ((amount_grams_per_base IS NOT NULL) != (amount_ml_per_base IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id, sort_order, id);

CREATE TABLE IF NOT EXISTS variations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  cooked_at TEXT NOT NULL,
  meat_grams INTEGER NOT NULL CHECK (meat_grams > 0),
  animal_override TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_variations_recipe_cooked ON variations(recipe_id, cooked_at DESC);
CREATE INDEX IF NOT EXISTS idx_variations_user_recipe ON variations(user_id, recipe_id);

CREATE TABLE IF NOT EXISTS variation_cuts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variation_id INTEGER NOT NULL REFERENCES variations(id) ON DELETE CASCADE,
  cut_name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_variation_cuts_variation_id ON variation_cuts(variation_id);

CREATE TABLE IF NOT EXISTS variation_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variation_id INTEGER NOT NULL REFERENCES variations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  note_text TEXT NOT NULL,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_variation_notes_variation_id ON variation_notes(variation_id, created_at DESC);
