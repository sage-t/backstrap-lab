PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS variation_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variation_id INTEGER NOT NULL REFERENCES variations(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  amount_grams_per_base REAL,
  amount_ml_per_base REAL,
  display_unit_override TEXT CHECK (display_unit_override IS NULL OR display_unit_override IN ('g','ml','tsp','tbsp')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK ((amount_grams_per_base IS NOT NULL) != (amount_ml_per_base IS NOT NULL)),
  UNIQUE (variation_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_variation_ingredients_variation_id
  ON variation_ingredients(variation_id, sort_order, id);
