PRAGMA foreign_keys = ON;

ALTER TABLE recipe_ingredients RENAME TO recipe_ingredients_old;
CREATE TABLE recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  amount_grams_per_base REAL,
  amount_ml_per_base REAL,
  amount_units_per_base REAL,
  display_unit_override TEXT CHECK (display_unit_override IS NULL OR display_unit_override IN ('g','ml','tsp','tbsp','unit')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (CASE WHEN amount_grams_per_base IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN amount_ml_per_base IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN amount_units_per_base IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);
INSERT INTO recipe_ingredients (
  id, recipe_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, amount_units_per_base, display_unit_override, sort_order
)
SELECT
  id, recipe_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, NULL, display_unit_override, sort_order
FROM recipe_ingredients_old;
DROP TABLE recipe_ingredients_old;
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id, sort_order, id);

ALTER TABLE variation_ingredients RENAME TO variation_ingredients_old;
CREATE TABLE variation_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variation_id INTEGER NOT NULL REFERENCES variations(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  amount_grams_per_base REAL,
  amount_ml_per_base REAL,
  amount_units_per_base REAL,
  display_unit_override TEXT CHECK (display_unit_override IS NULL OR display_unit_override IN ('g','ml','tsp','tbsp','unit')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (CASE WHEN amount_grams_per_base IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN amount_ml_per_base IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN amount_units_per_base IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  UNIQUE (variation_id, ingredient_id)
);
INSERT INTO variation_ingredients (
  id, variation_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, amount_units_per_base, display_unit_override, sort_order
)
SELECT
  id, variation_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, NULL, display_unit_override, sort_order
FROM variation_ingredients_old;
DROP TABLE variation_ingredients_old;
CREATE INDEX IF NOT EXISTS idx_variation_ingredients_variation_id
  ON variation_ingredients(variation_id, sort_order, id);

ALTER TABLE recipe_revision_ingredients RENAME TO recipe_revision_ingredients_old;
CREATE TABLE recipe_revision_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_revision_id INTEGER NOT NULL REFERENCES recipe_revisions(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  amount_grams_per_base REAL,
  amount_ml_per_base REAL,
  amount_units_per_base REAL,
  display_unit_override TEXT CHECK (display_unit_override IS NULL OR display_unit_override IN ('g','ml','tsp','tbsp','unit')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (CASE WHEN amount_grams_per_base IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN amount_ml_per_base IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN amount_units_per_base IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);
INSERT INTO recipe_revision_ingredients (
  id, recipe_revision_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, amount_units_per_base, display_unit_override, sort_order
)
SELECT
  id, recipe_revision_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, NULL, display_unit_override, sort_order
FROM recipe_revision_ingredients_old;
DROP TABLE recipe_revision_ingredients_old;
CREATE INDEX IF NOT EXISTS idx_recipe_revision_ingredients_revision_id
  ON recipe_revision_ingredients(recipe_revision_id, sort_order, id);
