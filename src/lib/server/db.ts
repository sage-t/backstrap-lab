import type { DisplayUnit, ScaleInputRow } from '$lib/scaling';

export const USER_ID = 'local';

const nowIso = () => new Date().toISOString();

type RecipeCoreInput = {
  title: string;
  description: string;
  tags: string[];
  baseMeatGrams: number;
  baseAnimal: string;
};

export async function queryAll<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all<T>();
  return result.results ?? [];
}

export async function queryFirst<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return (await db.prepare(sql).bind(...params).first<T>()) ?? null;
}

export async function exec(db: D1Database, sql: string, ...params: unknown[]): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run();
}

export async function listRecipes(db: D1Database, q: string) {
  const term = `%${q.toLowerCase()}%`;
  return queryAll<{ id: number; title: string; updated_at: string }>(
    db,
    `SELECT id, title, updated_at
     FROM recipes
     WHERE user_id = ? AND (? = '%%' OR lower(title) LIKE ?)
     ORDER BY updated_at DESC, id DESC`,
    USER_ID,
    term,
    term
  );
}

export async function createRecipe(db: D1Database, input: RecipeCoreInput): Promise<number> {
  const ts = nowIso();
  const run = await exec(
    db,
    `INSERT INTO recipes (user_id, title, description, tags_json, base_meat_grams, base_animal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    USER_ID,
    input.title,
    input.description,
    JSON.stringify(input.tags),
    Math.max(1, Math.round(input.baseMeatGrams)),
    input.baseAnimal || null,
    ts,
    ts
  );
  return Number(run.meta.last_row_id);
}

export async function updateRecipe(db: D1Database, recipeId: number, input: RecipeCoreInput) {
  await exec(
    db,
    `UPDATE recipes
     SET title = ?, description = ?, tags_json = ?, base_meat_grams = ?, base_animal = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    input.title,
    input.description,
    JSON.stringify(input.tags),
    Math.max(1, Math.round(input.baseMeatGrams)),
    input.baseAnimal || null,
    nowIso(),
    recipeId,
    USER_ID
  );
}

export async function getRecipeDetail(db: D1Database, recipeId: number) {
  const recipe = await queryFirst<{
    id: number;
    title: string;
    description: string | null;
    tags_json: string | null;
    base_meat_grams: number;
    base_animal: string | null;
  }>(
    db,
    `SELECT id, title, description, tags_json, base_meat_grams, base_animal
     FROM recipes WHERE id = ? AND user_id = ?`,
    recipeId,
    USER_ID
  );

  if (!recipe) return null;

  const cuts = await queryAll<{ id: number; cut_name: string }>(
    db,
    `SELECT rc.id, rc.cut_name FROM recipe_cuts rc
     JOIN recipes r ON r.id = rc.recipe_id
     WHERE rc.recipe_id = ? AND r.user_id = ?
     ORDER BY rc.id ASC`,
    recipeId,
    USER_ID
  );

  const ingredients = await queryAll<{
    id: number;
    ingredient_id: number;
    name: string;
    amount_grams_per_base: number | null;
    amount_ml_per_base: number | null;
    display_unit_override: DisplayUnit | null;
    sort_order: number;
    default_display_unit: DisplayUnit;
    grams_per_ml: number | null;
    grams_per_tsp: number | null;
  }>(
    db,
    `SELECT ri.id, ri.ingredient_id, i.name,
            ri.amount_grams_per_base, ri.amount_ml_per_base,
            ri.display_unit_override, ri.sort_order,
            i.default_display_unit,
            ic.grams_per_ml, ic.grams_per_tsp
     FROM recipe_ingredients ri
     JOIN recipes r ON r.id = ri.recipe_id
     JOIN ingredients i ON i.id = ri.ingredient_id
     LEFT JOIN ingredient_conversions ic ON ic.ingredient_id = i.id
     WHERE ri.recipe_id = ? AND r.user_id = ? AND i.user_id = ?
     ORDER BY ri.sort_order ASC, ri.id ASC`,
    recipeId,
    USER_ID,
    USER_ID
  );

  const variations = await queryAll<{
    id: number;
    cooked_at: string;
    meat_grams: number;
    animal_override: string | null;
    note_count: number;
  }>(
    db,
    `SELECT v.id, v.cooked_at, v.meat_grams, v.animal_override,
            (SELECT COUNT(*) FROM variation_notes vn WHERE vn.variation_id = v.id) AS note_count
     FROM variations v
     JOIN recipes r ON r.id = v.recipe_id
     WHERE v.recipe_id = ? AND r.user_id = ?
     ORDER BY v.cooked_at DESC, v.id DESC`,
    recipeId,
    USER_ID
  );

  return {
    recipe: {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description ?? '',
      tags: parseTags(recipe.tags_json),
      baseMeatGrams: recipe.base_meat_grams,
      baseAnimal: recipe.base_animal ?? ''
    },
    cuts,
    ingredients,
    variations
  };
}

export async function listIngredients(db: D1Database) {
  return queryAll<{ id: number; name: string; default_display_unit: DisplayUnit }>(
    db,
    `SELECT id, name, default_display_unit
     FROM ingredients
     WHERE user_id = ?
     ORDER BY lower(name) ASC`,
    USER_ID
  );
}

export async function ensureIngredient(db: D1Database, name: string, defaultDisplayUnit: DisplayUnit) {
  const existing = await queryFirst<{ id: number }>(
    db,
    `SELECT id FROM ingredients WHERE user_id = ? AND lower(name) = lower(?)`,
    USER_ID,
    name
  );
  if (existing) return existing.id;

  const run = await exec(
    db,
    `INSERT INTO ingredients (name, default_display_unit, created_at, user_id)
     VALUES (?, ?, ?, ?)`,
    name,
    defaultDisplayUnit,
    nowIso(),
    USER_ID
  );
  return Number(run.meta.last_row_id);
}

export async function addRecipeCut(db: D1Database, recipeId: number, cutName: string) {
  await exec(
    db,
    `INSERT INTO recipe_cuts (recipe_id, cut_name)
     SELECT id, ? FROM recipes WHERE id = ? AND user_id = ?`,
    cutName,
    recipeId,
    USER_ID
  );
}

export async function deleteRecipeCut(db: D1Database, cutId: number, recipeId: number) {
  await exec(
    db,
    `DELETE FROM recipe_cuts
     WHERE id = ? AND recipe_id = ?
     AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = ?)`,
    cutId,
    recipeId,
    USER_ID
  );
}

export async function upsertRecipeIngredient(db: D1Database, input: {
  recipeId: number;
  id?: number;
  ingredientId: number;
  amountGramsPerBase: number | null;
  amountMlPerBase: number | null;
  displayUnitOverride: DisplayUnit | null;
  sortOrder: number;
}) {
  if (input.id) {
    await exec(
      db,
      `UPDATE recipe_ingredients
       SET ingredient_id = ?, amount_grams_per_base = ?, amount_ml_per_base = ?,
           display_unit_override = ?, sort_order = ?
       WHERE id = ? AND recipe_id = ?
       AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = ?)`,
      input.ingredientId,
      input.amountGramsPerBase,
      input.amountMlPerBase,
      input.displayUnitOverride,
      input.sortOrder,
      input.id,
      input.recipeId,
      USER_ID
    );
    return;
  }

  await exec(
    db,
    `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, display_unit_override, sort_order)
     SELECT id, ?, ?, ?, ?, ? FROM recipes WHERE id = ? AND user_id = ?`,
    input.ingredientId,
    input.amountGramsPerBase,
    input.amountMlPerBase,
    input.displayUnitOverride,
    input.sortOrder,
    input.recipeId,
    USER_ID
  );
}

export async function deleteRecipeIngredient(db: D1Database, id: number, recipeId: number) {
  await exec(
    db,
    `DELETE FROM recipe_ingredients
     WHERE id = ? AND recipe_id = ?
     AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = ?)`,
    id,
    recipeId,
    USER_ID
  );
}

export async function createVariation(db: D1Database, input: {
  recipeId: number;
  cookedAt: string;
  meatGrams: number;
  animalOverride: string;
}): Promise<number> {
  const run = await exec(
    db,
    `INSERT INTO variations (recipe_id, user_id, cooked_at, meat_grams, animal_override, created_at)
     SELECT id, ?, ?, ?, ?, ? FROM recipes WHERE id = ? AND user_id = ?`,
    USER_ID,
    input.cookedAt,
    Math.max(1, Math.round(input.meatGrams)),
    input.animalOverride || null,
    nowIso(),
    input.recipeId,
    USER_ID
  );
  return Number(run.meta.last_row_id);
}

export async function getVariationDetail(db: D1Database, variationId: number) {
  const variation = await queryFirst<{
    id: number;
    recipe_id: number;
    recipe_title: string;
    base_meat_grams: number;
    base_animal: string | null;
    cooked_at: string;
    meat_grams: number;
    animal_override: string | null;
  }>(
    db,
    `SELECT v.id, v.recipe_id, r.title AS recipe_title, r.base_meat_grams, r.base_animal,
            v.cooked_at, v.meat_grams, v.animal_override
     FROM variations v
     JOIN recipes r ON r.id = v.recipe_id
     WHERE v.id = ? AND v.user_id = ? AND r.user_id = ?`,
    variationId,
    USER_ID,
    USER_ID
  );

  if (!variation) return null;

  const recipeIngredients = await queryAll<ScaleInputRow & { sort_order: number }>(
    db,
    `SELECT i.id AS ingredientId,
            i.name AS ingredientName,
            ri.amount_grams_per_base AS amountGramsPerBase,
            ri.amount_ml_per_base AS amountMlPerBase,
            i.default_display_unit AS defaultDisplayUnit,
            ri.display_unit_override AS displayUnitOverride,
            ic.grams_per_ml AS gramsPerMl,
            ic.grams_per_tsp AS gramsPerTsp,
            ri.sort_order
     FROM recipe_ingredients ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     JOIN recipes r ON r.id = ri.recipe_id
     LEFT JOIN ingredient_conversions ic ON ic.ingredient_id = i.id
     WHERE ri.recipe_id = ? AND r.user_id = ? AND i.user_id = ?
     ORDER BY ri.sort_order ASC, ri.id ASC`,
    variation.recipe_id,
    USER_ID,
    USER_ID
  );

  const recipeCuts = await queryAll<{ id: number; cut_name: string }>(
    db,
    `SELECT rc.id, rc.cut_name
     FROM recipe_cuts rc
     JOIN recipes r ON r.id = rc.recipe_id
     WHERE rc.recipe_id = ? AND r.user_id = ?
     ORDER BY rc.id ASC`,
    variation.recipe_id,
    USER_ID
  );

  const variationCuts = await queryAll<{ id: number; cut_name: string }>(
    db,
    `SELECT vc.id, vc.cut_name
     FROM variation_cuts vc
     JOIN variations v ON v.id = vc.variation_id
     JOIN recipes r ON r.id = v.recipe_id
     WHERE vc.variation_id = ? AND v.user_id = ? AND r.user_id = ?
     ORDER BY vc.id ASC`,
    variationId,
    USER_ID,
    USER_ID
  );

  const notes = await queryAll<{
    id: number;
    note_text: string;
    rating: number | null;
    created_at: string;
  }>(
    db,
    `SELECT vn.id, vn.note_text, vn.rating, vn.created_at
     FROM variation_notes vn
     JOIN variations v ON v.id = vn.variation_id
     JOIN recipes r ON r.id = v.recipe_id
     WHERE vn.variation_id = ? AND v.user_id = ? AND r.user_id = ?
     ORDER BY vn.created_at DESC, vn.id DESC`,
    variationId,
    USER_ID,
    USER_ID
  );

  return {
    variation: {
      id: variation.id,
      recipeId: variation.recipe_id,
      recipeTitle: variation.recipe_title,
      baseMeatGrams: variation.base_meat_grams,
      baseAnimal: variation.base_animal ?? '',
      cookedAt: variation.cooked_at,
      meatGrams: variation.meat_grams,
      animalOverride: variation.animal_override ?? ''
    },
    recipeIngredients,
    recipeCuts,
    variationCuts,
    notes
  };
}

export async function updateVariation(db: D1Database, variationId: number, input: {
  cookedAt: string;
  meatGrams: number;
  animalOverride: string;
}) {
  await exec(
    db,
    `UPDATE variations
     SET cooked_at = ?, meat_grams = ?, animal_override = ?
     WHERE id = ? AND user_id = ?`,
    input.cookedAt,
    Math.max(1, Math.round(input.meatGrams)),
    input.animalOverride || null,
    variationId,
    USER_ID
  );
}

export async function addVariationCut(db: D1Database, variationId: number, cutName: string) {
  await exec(
    db,
    `INSERT INTO variation_cuts (variation_id, cut_name)
     SELECT id, ? FROM variations WHERE id = ? AND user_id = ?`,
    cutName,
    variationId,
    USER_ID
  );
}

export async function deleteVariationCut(db: D1Database, variationId: number, cutId: number) {
  await exec(
    db,
    `DELETE FROM variation_cuts
     WHERE id = ? AND variation_id = ?
     AND EXISTS (SELECT 1 FROM variations v WHERE v.id = variation_id AND v.user_id = ?)`,
    cutId,
    variationId,
    USER_ID
  );
}

export async function addVariationNote(db: D1Database, variationId: number, noteText: string, rating: number | null) {
  await exec(
    db,
    `INSERT INTO variation_notes (variation_id, user_id, note_text, rating, created_at)
     SELECT id, ?, ?, ?, ? FROM variations WHERE id = ? AND user_id = ?`,
    USER_ID,
    noteText,
    rating,
    nowIso(),
    variationId,
    USER_ID
  );
}

export async function listIngredientsWithConversions(db: D1Database) {
  return queryAll<{
    id: number;
    name: string;
    default_display_unit: DisplayUnit;
    grams_per_ml: number | null;
    grams_per_tsp: number | null;
    source_note: string | null;
  }>(
    db,
    `SELECT i.id, i.name, i.default_display_unit,
            ic.grams_per_ml, ic.grams_per_tsp, ic.source_note
     FROM ingredients i
     LEFT JOIN ingredient_conversions ic ON ic.ingredient_id = i.id
     WHERE i.user_id = ?
     ORDER BY lower(i.name) ASC`,
    USER_ID
  );
}

export async function updateIngredientDisplayUnit(db: D1Database, ingredientId: number, unit: DisplayUnit) {
  await exec(
    db,
    `UPDATE ingredients SET default_display_unit = ? WHERE id = ? AND user_id = ?`,
    unit,
    ingredientId,
    USER_ID
  );
}

export async function upsertIngredientConversion(db: D1Database, input: {
  ingredientId: number;
  gramsPerMl: number | null;
  gramsPerTsp: number | null;
  sourceNote: string;
}) {
  await exec(
    db,
    `INSERT INTO ingredient_conversions (ingredient_id, grams_per_ml, grams_per_tsp, source_note, updated_at)
     SELECT i.id, ?, ?, ?, ?
     FROM ingredients i
     WHERE i.id = ? AND i.user_id = ?
     ON CONFLICT(ingredient_id) DO UPDATE SET
       grams_per_ml = excluded.grams_per_ml,
       grams_per_tsp = excluded.grams_per_tsp,
       source_note = excluded.source_note,
       updated_at = excluded.updated_at`,
    input.gramsPerMl,
    input.gramsPerTsp,
    input.sourceNote || null,
    nowIso(),
    input.ingredientId,
    USER_ID
  );
}

export async function seedDemoData(db: D1Database) {
  const createdAt = nowIso();
  const defaults: Array<{ name: string; unit: DisplayUnit; gramsPerTsp: number }> = [
    { name: 'kosher salt', unit: 'tsp', gramsPerTsp: 5.7 },
    { name: 'black pepper', unit: 'tsp', gramsPerTsp: 2.3 },
    { name: 'garlic powder', unit: 'tsp', gramsPerTsp: 3.1 },
    { name: 'onion powder', unit: 'tsp', gramsPerTsp: 2.4 },
    { name: 'paprika', unit: 'tsp', gramsPerTsp: 2.3 }
  ];

  for (const item of defaults) {
    const ingredientId = await ensureIngredient(db, item.name, item.unit);
    await upsertIngredientConversion(db, {
      ingredientId,
      gramsPerMl: null,
      gramsPerTsp: item.gramsPerTsp,
      sourceNote: 'default seed values'
    });
  }

  const existingSample = await queryFirst<{ id: number }>(
    db,
    `SELECT id FROM recipes WHERE user_id = ? AND title = ?`,
    USER_ID,
    'Basic Venison Backstrap'
  );

  if (existingSample) return;

  const recipeId = await createRecipe(db, {
    title: 'Basic Venison Backstrap',
    description: 'Simple pan-seared backstrap with a dry spice rub.',
    tags: ['venison', 'backstrap', 'sear'],
    baseMeatGrams: 1000,
    baseAnimal: 'venison'
  });

  await addRecipeCut(db, recipeId, 'backstrap');

  const saltId = await ensureIngredient(db, 'kosher salt', 'tsp');
  const pepperId = await ensureIngredient(db, 'black pepper', 'tsp');
  const garlicId = await ensureIngredient(db, 'garlic powder', 'tsp');

  await upsertRecipeIngredient(db, {
    recipeId,
    ingredientId: saltId,
    amountGramsPerBase: 12,
    amountMlPerBase: null,
    displayUnitOverride: 'tsp',
    sortOrder: 1
  });
  await upsertRecipeIngredient(db, {
    recipeId,
    ingredientId: pepperId,
    amountGramsPerBase: 6,
    amountMlPerBase: null,
    displayUnitOverride: 'tsp',
    sortOrder: 2
  });
  await upsertRecipeIngredient(db, {
    recipeId,
    ingredientId: garlicId,
    amountGramsPerBase: 4,
    amountMlPerBase: null,
    displayUnitOverride: 'tsp',
    sortOrder: 3
  });

  const variationId = await createVariation(db, {
    recipeId,
    cookedAt: createdAt.slice(0, 10),
    meatGrams: 1500,
    animalOverride: 'venison'
  });

  await addVariationCut(db, variationId, 'backstrap');
  await addVariationNote(db, variationId, 'Seared hotter than usual; bark was excellent.', 5);
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value).trim()).filter(Boolean);
    }
  } catch {
    return [];
  }
  return [];
}
