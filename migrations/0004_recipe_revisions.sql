PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS recipe_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags_json TEXT,
  base_meat_grams INTEGER NOT NULL,
  base_animal TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_revisions_recipe_id ON recipe_revisions(recipe_id, id DESC);

CREATE TABLE IF NOT EXISTS recipe_revision_cuts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_revision_id INTEGER NOT NULL REFERENCES recipe_revisions(id) ON DELETE CASCADE,
  cut_name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_revision_cuts_revision_id ON recipe_revision_cuts(recipe_revision_id);

CREATE TABLE IF NOT EXISTS recipe_revision_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_revision_id INTEGER NOT NULL REFERENCES recipe_revisions(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  amount_grams_per_base REAL,
  amount_ml_per_base REAL,
  display_unit_override TEXT CHECK (display_unit_override IS NULL OR display_unit_override IN ('g','ml','tsp','tbsp')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK ((amount_grams_per_base IS NOT NULL) != (amount_ml_per_base IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_recipe_revision_ingredients_revision_id
  ON recipe_revision_ingredients(recipe_revision_id, sort_order, id);

ALTER TABLE recipes ADD COLUMN current_revision_id INTEGER REFERENCES recipe_revisions(id) ON DELETE SET NULL;
ALTER TABLE variations ADD COLUMN recipe_revision_id INTEGER REFERENCES recipe_revisions(id) ON DELETE SET NULL;

-- Backfill one initial revision per existing recipe
INSERT INTO recipe_revisions (
  recipe_id, user_id, title, description, tags_json, base_meat_grams, base_animal, created_at
)
SELECT r.id, r.user_id, r.title, r.description, r.tags_json, r.base_meat_grams, r.base_animal, r.created_at
FROM recipes r
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_revisions rr WHERE rr.recipe_id = r.id
);

UPDATE recipes
SET current_revision_id = (
  SELECT rr.id
  FROM recipe_revisions rr
  WHERE rr.recipe_id = recipes.id
  ORDER BY rr.id DESC
  LIMIT 1
)
WHERE current_revision_id IS NULL;

INSERT INTO recipe_revision_cuts (recipe_revision_id, cut_name)
SELECT r.current_revision_id, rc.cut_name
FROM recipe_cuts rc
JOIN recipes r ON r.id = rc.recipe_id
WHERE r.current_revision_id IS NOT NULL;

INSERT INTO recipe_revision_ingredients (
  recipe_revision_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, display_unit_override, sort_order
)
SELECT r.current_revision_id, ri.ingredient_id, ri.amount_grams_per_base, ri.amount_ml_per_base, ri.display_unit_override, ri.sort_order
FROM recipe_ingredients ri
JOIN recipes r ON r.id = ri.recipe_id
WHERE r.current_revision_id IS NOT NULL;

UPDATE variations
SET recipe_revision_id = (
  SELECT r.current_revision_id
  FROM recipes r
  WHERE r.id = variations.recipe_id
)
WHERE recipe_revision_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_variations_recipe_revision_id ON variations(recipe_revision_id);
