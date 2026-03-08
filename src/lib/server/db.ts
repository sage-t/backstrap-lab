import type { DisplayUnit, ScaleInputRow } from '$lib/scaling';
import {
  DEFAULT_MEASUREMENT_PREFERENCES,
  isVolumePreference,
  isWeightPreference,
  normalizeMeasurementPreferences,
  type MeasurementPreferences,
  type VolumePreference,
  type WeightPreference
} from '$lib/measurement';

export const DEV_USER_ID = 'local-dev';

const nowIso = () => new Date().toISOString();
const normalizeUserId = (userId?: string | null): string | null => {
  const value = userId?.trim().toLowerCase();
  return value ? value : null;
};
const asActor = (userId?: string | null): string => normalizeUserId(userId) ?? DEV_USER_ID;

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

export async function getUserMeasurementSettings(
  db: D1Database,
  actorUserId?: string | null
): Promise<MeasurementPreferences> {
  const actor = asActor(actorUserId);
  try {
    const row = await queryFirst<{
      weight_preference: string;
      volume_preference: string;
    }>(
      db,
      `SELECT weight_preference, volume_preference
       FROM user_settings
       WHERE user_id = ?`,
      actor
    );

    return normalizeMeasurementPreferences(
      row
        ? {
            weightPreference: isWeightPreference(row.weight_preference)
              ? row.weight_preference
              : DEFAULT_MEASUREMENT_PREFERENCES.weightPreference,
            volumePreference: isVolumePreference(row.volume_preference)
              ? row.volume_preference
              : DEFAULT_MEASUREMENT_PREFERENCES.volumePreference
          }
        : DEFAULT_MEASUREMENT_PREFERENCES
    );
  } catch {
    // Graceful fallback when migrations are not yet applied.
    return DEFAULT_MEASUREMENT_PREFERENCES;
  }
}

export async function upsertUserMeasurementSettings(
  db: D1Database,
  settings: {
    weightPreference: WeightPreference;
    volumePreference: VolumePreference;
  },
  actorUserId?: string | null
) {
  const actor = asActor(actorUserId);
  const normalized = normalizeMeasurementPreferences(settings) as {
    weightPreference: WeightPreference;
    volumePreference: VolumePreference;
  };
  await exec(
    db,
    `INSERT INTO user_settings (user_id, weight_preference, volume_preference, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       weight_preference = excluded.weight_preference,
       volume_preference = excluded.volume_preference,
       updated_at = excluded.updated_at`,
    actor,
    normalized.weightPreference,
    normalized.volumePreference,
    nowIso()
  );
}

export async function listRecipes(db: D1Database, q: string) {
  const term = `%${q.toLowerCase()}%`;
  return queryAll<{
    id: number;
    title: string;
    updated_at: string;
    last_cooked_at: string | null;
    variation_count: number;
  }>(
    db,
    `SELECT r.id,
            r.title,
            r.updated_at,
            (
              SELECT MAX(v.cooked_at)
              FROM variations v
              WHERE v.recipe_id = r.id
            ) AS last_cooked_at,
            (
              SELECT COUNT(*)
              FROM variations v
              WHERE v.recipe_id = r.id
            ) AS variation_count
     FROM recipes r
     WHERE (? = '%%' OR lower(title) LIKE ?)
     ORDER BY updated_at DESC, id DESC`,
    term,
    term
  );
}

async function getCurrentRevisionSnapshot(
  db: D1Database,
  recipeId: number,
  actorUserId?: string | null,
  requireOwner = false
): Promise<{
  recipeId: number;
  revisionId: number;
  title: string;
  description: string;
  tagsJson: string;
  baseMeatGrams: number;
  baseAnimal: string | null;
} | null> {
  const actor = asActor(actorUserId);
  return queryFirst<{
    recipeId: number;
    revisionId: number;
    title: string;
    description: string | null;
    tagsJson: string | null;
    baseMeatGrams: number;
    baseAnimal: string | null;
  }>(
    db,
    `SELECT r.id AS recipeId,
            rr.id AS revisionId,
            rr.title AS title,
            rr.description AS description,
            rr.tags_json AS tagsJson,
            rr.base_meat_grams AS baseMeatGrams,
            rr.base_animal AS baseAnimal
     FROM recipes r
     JOIN recipe_revisions rr ON rr.id = r.current_revision_id
     WHERE r.id = ?
       AND (? = 0 OR r.user_id = ?)`,
    recipeId,
    requireOwner ? 1 : 0,
    actor
  ).then((row) =>
    row
      ? {
          recipeId: row.recipeId,
          revisionId: row.revisionId,
          title: row.title,
          description: row.description ?? '',
          tagsJson: row.tagsJson ?? '[]',
          baseMeatGrams: row.baseMeatGrams,
          baseAnimal: row.baseAnimal
        }
      : null
  );
}

async function forkCurrentRevision(db: D1Database, recipeId: number, actorUserId?: string | null): Promise<number> {
  const actor = asActor(actorUserId);
  const current = await getCurrentRevisionSnapshot(db, recipeId, actor, true);
  if (!current) throw new Error('Recipe current revision not found');
  const ts = nowIso();

  const created = await exec(
    db,
    `INSERT INTO recipe_revisions (recipe_id, user_id, title, description, tags_json, base_meat_grams, base_animal, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    recipeId,
    actor,
    current.title,
    current.description,
    current.tagsJson,
    current.baseMeatGrams,
    current.baseAnimal,
    ts
  );
  const newRevisionId = Number(created.meta.last_row_id);

  await exec(
    db,
    `INSERT INTO recipe_revision_cuts (recipe_revision_id, cut_name)
     SELECT ?, cut_name
     FROM recipe_revision_cuts
     WHERE recipe_revision_id = ?`,
    newRevisionId,
    current.revisionId
  );

  await exec(
    db,
    `INSERT INTO recipe_revision_ingredients
      (recipe_revision_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, amount_units_per_base, display_unit_override, sort_order)
     SELECT ?, ingredient_id, amount_grams_per_base, amount_ml_per_base, amount_units_per_base, display_unit_override, sort_order
     FROM recipe_revision_ingredients
     WHERE recipe_revision_id = ?`,
    newRevisionId,
    current.revisionId
  );

  await exec(
    db,
    `UPDATE recipes
     SET current_revision_id = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    newRevisionId,
    ts,
    recipeId,
    actor
  );

  return newRevisionId;
}

export async function createRecipe(
  db: D1Database,
  input: RecipeCoreInput,
  actorUserId?: string | null
): Promise<number> {
  const actor = asActor(actorUserId);
  const ts = nowIso();
  const recipeRun = await exec(
    db,
    `INSERT INTO recipes (user_id, title, description, tags_json, base_meat_grams, base_animal, created_at, updated_at, current_revision_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    actor,
    input.title,
    input.description,
    JSON.stringify(input.tags),
    Math.max(1, Math.round(input.baseMeatGrams)),
    input.baseAnimal || null,
    ts,
    ts
  );
  const recipeId = Number(recipeRun.meta.last_row_id);

  const revisionRun = await exec(
    db,
    `INSERT INTO recipe_revisions (recipe_id, user_id, title, description, tags_json, base_meat_grams, base_animal, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    recipeId,
    actor,
    input.title,
    input.description,
    JSON.stringify(input.tags),
    Math.max(1, Math.round(input.baseMeatGrams)),
    input.baseAnimal || null,
    ts
  );
  const revisionId = Number(revisionRun.meta.last_row_id);

  await exec(
    db,
    `UPDATE recipes
     SET current_revision_id = ?
     WHERE id = ? AND user_id = ?`,
    revisionId,
    recipeId,
    actor
  );

  return recipeId;
}

export async function updateRecipe(
  db: D1Database,
  recipeId: number,
  input: RecipeCoreInput,
  actorUserId?: string | null
) {
  const actor = asActor(actorUserId);
  const current = await getCurrentRevisionSnapshot(db, recipeId, actor, true);
  if (!current) return;
  const revisionId = await forkCurrentRevision(db, recipeId, actor);
  const nextBase = Math.max(1, Math.round(input.baseMeatGrams));
  const previousBase = Math.max(1, Math.round(current.baseMeatGrams));
  if (nextBase !== previousBase) {
    const factor = nextBase / previousBase;
    await exec(
      db,
      `UPDATE recipe_revision_ingredients
       SET
         amount_grams_per_base = CASE WHEN amount_grams_per_base IS NULL THEN NULL ELSE amount_grams_per_base * ? END,
         amount_ml_per_base = CASE WHEN amount_ml_per_base IS NULL THEN NULL ELSE amount_ml_per_base * ? END,
         amount_units_per_base = CASE WHEN amount_units_per_base IS NULL THEN NULL ELSE amount_units_per_base * ? END
       WHERE recipe_revision_id = ?`,
      factor,
      factor,
      factor,
      revisionId
    );
  }

  await exec(
    db,
    `UPDATE recipe_revisions
     SET title = ?, description = ?, tags_json = ?, base_meat_grams = ?, base_animal = ?
     WHERE id = ?`,
    input.title,
    input.description,
    JSON.stringify(input.tags),
    nextBase,
    input.baseAnimal || null,
    revisionId
  );

  await exec(
    db,
    `UPDATE recipes
     SET title = ?, description = ?, tags_json = ?, base_meat_grams = ?, base_animal = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    input.title,
    input.description,
    JSON.stringify(input.tags),
    nextBase,
    input.baseAnimal || null,
    nowIso(),
    recipeId,
    actor
  );
}

export async function deleteRecipe(
  db: D1Database,
  recipeId: number,
  actorUserId?: string | null
): Promise<boolean> {
  const actor = asActor(actorUserId);
  const result = await exec(db, `DELETE FROM recipes WHERE id = ? AND user_id = ?`, recipeId, actor);
  return (result.meta.changes ?? 0) > 0;
}

export async function getRecipeDetail(db: D1Database, recipeId: number, viewerUserId?: string | null) {
  const viewer = normalizeUserId(viewerUserId);
  const recipe = await queryFirst<{
    id: number;
    owner_user_id: string;
    revision_id: number;
    title: string;
    description: string | null;
    tags_json: string | null;
    base_meat_grams: number;
    base_animal: string | null;
  }>(
    db,
    `SELECT r.id, r.user_id AS owner_user_id, rr.id AS revision_id, rr.title, rr.description, rr.tags_json, rr.base_meat_grams, rr.base_animal
     FROM recipes r
     JOIN recipe_revisions rr ON rr.id = r.current_revision_id
     WHERE r.id = ?`,
    recipeId
  );

  if (!recipe) return null;

  const cuts = await queryAll<{ id: number; cut_name: string }>(
    db,
    `SELECT rc.id, rc.cut_name FROM recipe_revision_cuts rc
     WHERE rc.recipe_revision_id = ?
     ORDER BY rc.id ASC`,
    recipe.revision_id
  );

  const ingredients = await queryAll<{
    id: number;
    ingredient_id: number;
    name: string;
    amount_grams_per_base: number | null;
    amount_ml_per_base: number | null;
    amount_units_per_base: number | null;
    display_unit_override: DisplayUnit | null;
    sort_order: number;
    default_display_unit: DisplayUnit;
    grams_per_ml: number | null;
    grams_per_tsp: number | null;
  }>(
    db,
    `SELECT ri.id, ri.ingredient_id, i.name,
            ri.amount_grams_per_base, ri.amount_ml_per_base, ri.amount_units_per_base,
            ri.display_unit_override, ri.sort_order,
            i.default_display_unit,
            ic.grams_per_ml, ic.grams_per_tsp
     FROM recipe_revision_ingredients ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     LEFT JOIN ingredient_conversions ic ON ic.ingredient_id = i.id
     WHERE ri.recipe_revision_id = ?
     ORDER BY ri.sort_order ASC, ri.id ASC`,
    recipe.revision_id
  );

  const variations = await queryAll<{
    id: number;
    cooked_at: string;
    meat_grams: number;
    animal_override: string | null;
    parent_variation_id: number | null;
    rating: number | null;
    note_count: number;
  }>(
    db,
    `SELECT v.id, v.cooked_at, v.meat_grams, v.animal_override, v.parent_variation_id, v.rating,
            (SELECT COUNT(*) FROM variation_notes vn WHERE vn.variation_id = v.id) AS note_count
     FROM variations v
     JOIN recipes r ON r.id = v.recipe_id
     WHERE v.recipe_id = ?
     ORDER BY v.cooked_at DESC, v.id DESC`,
    recipeId
  );

  const ratingSummary = await queryFirst<{ avg_rating: number | null; rating_count: number }>(
    db,
    `SELECT AVG(rr.rating) AS avg_rating, COUNT(*) AS rating_count
     FROM recipe_ratings rr
     WHERE rr.recipe_id = ?`,
    recipeId
  );

  const myRating = viewer
    ? await queryFirst<{ rating: number | null }>(
        db,
        `SELECT rating
         FROM recipe_ratings
         WHERE recipe_id = ? AND user_id = ?`,
        recipeId,
        viewer
      )
    : null;

  return {
    recipe: {
      id: recipe.id,
      ownerUserId: recipe.owner_user_id,
      revisionId: recipe.revision_id,
      title: recipe.title,
      description: recipe.description ?? '',
      tags: parseTags(recipe.tags_json),
      baseMeatGrams: recipe.base_meat_grams,
      baseAnimal: recipe.base_animal ?? ''
    },
    rating: {
      average: ratingSummary?.avg_rating ?? null,
      count: ratingSummary?.rating_count ?? 0,
      myRating: myRating?.rating ?? null
    },
    cuts,
    ingredients,
    variations
  };
}

export async function setRecipeRating(
  db: D1Database,
  recipeId: number,
  rating: number,
  actorUserId?: string | null
) {
  const actor = asActor(actorUserId);
  const clamped = Math.min(5, Math.max(1, Math.round(rating)));
  await exec(
    db,
    `INSERT INTO recipe_ratings (recipe_id, user_id, rating, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(recipe_id, user_id) DO UPDATE SET
       rating = excluded.rating,
       updated_at = excluded.updated_at`,
    recipeId,
    actor,
    clamped,
    nowIso()
  );
}

export async function listIngredients(db: D1Database) {
  return queryAll<{ id: number; name: string; default_display_unit: DisplayUnit }>(
    db,
    `SELECT id, name, default_display_unit
     FROM ingredients
     ORDER BY lower(name) ASC`,
  );
}

export async function ensureIngredient(
  db: D1Database,
  name: string,
  defaultDisplayUnit: DisplayUnit,
  actorUserId?: string | null
) {
  const actor = asActor(actorUserId);
  const existing = await queryFirst<{ id: number }>(
    db,
    `SELECT id FROM ingredients WHERE lower(name) = lower(?) ORDER BY id ASC LIMIT 1`,
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
    actor
  );
  return Number(run.meta.last_row_id);
}

export async function addRecipeCut(
  db: D1Database,
  recipeId: number,
  cutName: string,
  actorUserId?: string | null
) {
  const revisionId = await forkCurrentRevision(db, recipeId, actorUserId);
  await exec(
    db,
    `INSERT INTO recipe_revision_cuts (recipe_revision_id, cut_name)
     VALUES (?, ?)`,
    revisionId,
    cutName,
  );
}

export async function deleteRecipeCut(
  db: D1Database,
  cutId: number,
  recipeId: number,
  actorUserId?: string | null
) {
  const revisionId = await forkCurrentRevision(db, recipeId, actorUserId);
  await exec(
    db,
    `DELETE FROM recipe_revision_cuts
     WHERE id = ? AND recipe_revision_id = ?`,
    cutId,
    revisionId
  );
}

export async function upsertRecipeIngredient(db: D1Database, input: {
  recipeId: number;
  id?: number;
  ingredientId: number;
  amountGramsPerBase: number | null;
  amountMlPerBase: number | null;
  amountUnitsPerBase: number | null;
  displayUnitOverride: DisplayUnit | null;
  sortOrder: number;
}, actorUserId?: string | null) {
  const revisionId = await forkCurrentRevision(db, input.recipeId, actorUserId);
  if (input.id) {
    await exec(
      db,
      `UPDATE recipe_revision_ingredients
       SET ingredient_id = ?, amount_grams_per_base = ?, amount_ml_per_base = ?, amount_units_per_base = ?,
           display_unit_override = ?, sort_order = ?
       WHERE id = ? AND recipe_revision_id = ?`,
      input.ingredientId,
      input.amountGramsPerBase,
      input.amountMlPerBase,
      input.amountUnitsPerBase,
      input.displayUnitOverride,
      input.sortOrder,
      input.id,
      revisionId
    );
    return;
  }

  await exec(
    db,
    `INSERT INTO recipe_revision_ingredients (recipe_revision_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, amount_units_per_base, display_unit_override, sort_order)
     SELECT ?, i.id, ?, ?, ?, ?, ?
     FROM ingredients i
     WHERE i.id = ?`,
    revisionId,
    input.amountGramsPerBase,
    input.amountMlPerBase,
    input.amountUnitsPerBase,
    input.displayUnitOverride,
    input.sortOrder,
    input.ingredientId
  );
}

export async function deleteRecipeIngredient(
  db: D1Database,
  id: number,
  recipeId: number,
  actorUserId?: string | null
) {
  const revisionId = await forkCurrentRevision(db, recipeId, actorUserId);
  await exec(
    db,
    `DELETE FROM recipe_revision_ingredients
     WHERE id = ? AND recipe_revision_id = ?`,
    id,
    revisionId
  );
}

export async function reorderRecipeIngredients(
  db: D1Database,
  recipeId: number,
  orderedIds: number[],
  actorUserId?: string | null
) {
  const revisionId = await forkCurrentRevision(db, recipeId, actorUserId);
  if (orderedIds.length === 0) return;

  const currentRows = await queryAll<{ id: number }>(
    db,
    `SELECT id
     FROM recipe_revision_ingredients
     WHERE recipe_revision_id = ?
     ORDER BY sort_order ASC, id ASC`,
    revisionId
  );
  const currentIds = currentRows.map((row) => row.id);
  const currentIdSet = new Set(currentIds);
  const dedupedRequested = Array.from(
    new Set(
      orderedIds
        .map((id) => Math.trunc(Number(id)))
        .filter((id) => Number.isFinite(id) && id > 0 && currentIdSet.has(id))
    )
  );
  const remainingIds = currentIds.filter((id) => !dedupedRequested.includes(id));
  const finalOrder = [...dedupedRequested, ...remainingIds];

  for (let index = 0; index < finalOrder.length; index += 1) {
    await exec(
      db,
      `UPDATE recipe_revision_ingredients
       SET sort_order = ?
       WHERE id = ? AND recipe_revision_id = ?`,
      index + 1,
      finalOrder[index],
      revisionId
    );
  }
}

export async function createVariation(db: D1Database, input: {
  recipeId: number;
  cookedAt: string;
  meatGrams: number;
  animalOverride: string;
  parentVariationId?: number | null;
  rating?: number | null;
  recipeRevisionId?: number | null;
  actorUserId?: string | null;
}): Promise<number> {
  const actor = asActor(input.actorUserId);
  const parentVariationId = input.parentVariationId ?? null;
  const rating =
    input.rating === null || input.rating === undefined
      ? null
      : Math.min(5, Math.max(1, Math.round(input.rating)));

  const recipeRow = await queryFirst<{ current_revision_id: number | null }>(
    db,
    `SELECT current_revision_id FROM recipes WHERE id = ?`,
    input.recipeId
  );
  if (!recipeRow?.current_revision_id) {
    throw new Error('Recipe has no active revision');
  }

  let resolvedRevisionId = input.recipeRevisionId ?? recipeRow.current_revision_id;

  if (parentVariationId) {
    const parent = await queryFirst<{ recipe_revision_id: number | null; recipe_id: number }>(
      db,
      `SELECT recipe_id, recipe_revision_id
       FROM variations
       WHERE id = ?`,
      parentVariationId
    );
    if (!parent || parent.recipe_id !== input.recipeId || !parent.recipe_revision_id) {
      throw new Error('Invalid parent variation for this recipe');
    }
    if (input.recipeRevisionId == null) {
      resolvedRevisionId = parent.recipe_revision_id;
    }
  }

  const revisionBelongs = await queryFirst<{ ok: number }>(
    db,
    `SELECT 1 AS ok
     FROM recipe_revisions
     WHERE id = ? AND recipe_id = ?`,
    resolvedRevisionId,
    input.recipeId
  );
  if (!revisionBelongs) throw new Error('Invalid recipe revision selected for variation');

  const run = await exec(
    db,
    `INSERT INTO variations (recipe_id, recipe_revision_id, user_id, cooked_at, meat_grams, animal_override, parent_variation_id, rating, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.recipeId,
    resolvedRevisionId,
    actor,
    input.cookedAt,
    Math.max(1, Math.round(input.meatGrams)),
    input.animalOverride || null,
    parentVariationId,
    rating,
    nowIso()
  );
  if ((run.meta.changes ?? 0) < 1) throw new Error('Failed to create variation');
  return Number(run.meta.last_row_id);
}

export async function deleteVariation(
  db: D1Database,
  variationId: number,
  actorUserId?: string | null,
  recipeId?: number
): Promise<boolean> {
  const actor = asActor(actorUserId);
  if (recipeId) {
    const result = await exec(
      db,
      `DELETE FROM variations
       WHERE id = ? AND recipe_id = ?
         AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = ?)`,
      variationId,
      recipeId,
      actor
    );
    return (result.meta.changes ?? 0) > 0;
  }

  const result = await exec(
    db,
    `DELETE FROM variations
     WHERE id = ?
       AND EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = ?)`,
    variationId,
    actor
  );
  return (result.meta.changes ?? 0) > 0;
}

export async function getVariationDetail(db: D1Database, variationId: number) {
  const variation = await queryFirst<{
    id: number;
    recipe_id: number;
    user_id: string;
    recipe_owner_user_id: string;
    recipe_title: string;
    recipe_revision_id: number;
    base_meat_grams: number;
    base_animal: string | null;
    cooked_at: string;
    meat_grams: number;
    animal_override: string | null;
    parent_variation_id: number | null;
    rating: number | null;
  }>(
    db,
    `SELECT v.id, v.recipe_id, v.user_id, r.user_id AS recipe_owner_user_id,
            rr.title AS recipe_title, v.recipe_revision_id, rr.base_meat_grams, rr.base_animal,
            v.cooked_at, v.meat_grams, v.animal_override, v.parent_variation_id, v.rating
     FROM variations v
     JOIN recipes r ON r.id = v.recipe_id
     JOIN recipe_revisions rr ON rr.id = v.recipe_revision_id
     WHERE v.id = ?`,
    variationId
  );

  if (!variation) return null;

  const recipeIngredients = await queryAll<ScaleInputRow & { sort_order: number }>(
    db,
    `SELECT i.id AS ingredientId,
            i.name AS ingredientName,
            ri.amount_grams_per_base AS amountGramsPerBase,
            ri.amount_ml_per_base AS amountMlPerBase,
            ri.amount_units_per_base AS amountUnitsPerBase,
            i.default_display_unit AS defaultDisplayUnit,
            ri.display_unit_override AS displayUnitOverride,
            ic.grams_per_ml AS gramsPerMl,
            ic.grams_per_tsp AS gramsPerTsp,
            ri.sort_order
     FROM recipe_revision_ingredients ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     LEFT JOIN ingredient_conversions ic ON ic.ingredient_id = i.id
     WHERE ri.recipe_revision_id = ?
     ORDER BY ri.sort_order ASC, ri.id ASC`,
    variation.recipe_revision_id
  );

  const variationIngredients = await queryAll<
    ScaleInputRow & { id: number; sort_order: number; ingredientId: number; ingredientName: string }
  >(
    db,
    `SELECT vi.id,
            vi.sort_order,
            i.id AS ingredientId,
            i.name AS ingredientName,
            vi.amount_grams_per_base AS amountGramsPerBase,
            vi.amount_ml_per_base AS amountMlPerBase,
            vi.amount_units_per_base AS amountUnitsPerBase,
            i.default_display_unit AS defaultDisplayUnit,
            vi.display_unit_override AS displayUnitOverride,
            ic.grams_per_ml AS gramsPerMl,
            ic.grams_per_tsp AS gramsPerTsp
     FROM variation_ingredients vi
     JOIN variations v ON v.id = vi.variation_id
     JOIN ingredients i ON i.id = vi.ingredient_id
     LEFT JOIN ingredient_conversions ic ON ic.ingredient_id = i.id
     WHERE vi.variation_id = ?
     ORDER BY vi.sort_order ASC, vi.id ASC`,
    variationId
  );

  const mergedIngredientRows = mergeIngredientRows(recipeIngredients, variationIngredients);

  const recipeCuts = await queryAll<{ id: number; cut_name: string }>(
    db,
    `SELECT rc.id, rc.cut_name
     FROM recipe_revision_cuts rc
     WHERE rc.recipe_revision_id = ?
     ORDER BY rc.id ASC`,
    variation.recipe_revision_id
  );

  const variationCuts = await queryAll<{ id: number; cut_name: string }>(
    db,
    `SELECT vc.id, vc.cut_name
     FROM variation_cuts vc
     JOIN variations v ON v.id = vc.variation_id
     WHERE vc.variation_id = ?
     ORDER BY vc.id ASC`,
    variationId
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
     WHERE vn.variation_id = ?
     ORDER BY vn.created_at DESC, vn.id DESC`,
    variationId
  );

  return {
    variation: {
      id: variation.id,
      recipeId: variation.recipe_id,
      userId: variation.user_id,
      recipeOwnerUserId: variation.recipe_owner_user_id,
      recipeTitle: variation.recipe_title,
      recipeRevisionId: variation.recipe_revision_id,
      baseMeatGrams: variation.base_meat_grams,
      baseAnimal: variation.base_animal ?? '',
      cookedAt: variation.cooked_at,
      meatGrams: variation.meat_grams,
      animalOverride: variation.animal_override ?? '',
      parentVariationId: variation.parent_variation_id,
      rating: variation.rating
    },
    scaledIngredientRows: mergedIngredientRows,
    recipeIngredients,
    variationIngredients,
    recipeCuts,
    variationCuts,
    notes
  };
}

export async function updateVariation(db: D1Database, variationId: number, input: {
  cookedAt: string;
  meatGrams: number;
  animalOverride: string;
  rating: number | null;
}, actorUserId?: string | null) {
  const actor = asActor(actorUserId);
  const rating =
    input.rating === null || input.rating === undefined
      ? null
      : Math.min(5, Math.max(1, Math.round(input.rating)));
  await exec(
    db,
    `UPDATE variations
     SET cooked_at = ?, meat_grams = ?, animal_override = ?, rating = ?
     WHERE id = ?
       AND (
         user_id = ?
         OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = ?)
       )`,
    input.cookedAt,
    Math.max(1, Math.round(input.meatGrams)),
    input.animalOverride || null,
    rating,
    variationId,
    actor,
    actor
  );
}

export async function addVariationCut(
  db: D1Database,
  variationId: number,
  cutName: string,
  actorUserId?: string | null
) {
  const actor = asActor(actorUserId);
  await exec(
    db,
    `INSERT INTO variation_cuts (variation_id, cut_name)
     SELECT v.id, ?
     FROM variations v
     WHERE v.id = ?
       AND (
         v.user_id = ?
         OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = v.recipe_id AND r.user_id = ?)
       )`,
    cutName,
    variationId,
    actor,
    actor
  );
}

export async function deleteVariationCut(
  db: D1Database,
  variationId: number,
  cutId: number,
  actorUserId?: string | null
) {
  const actor = asActor(actorUserId);
  await exec(
    db,
    `DELETE FROM variation_cuts
     WHERE id = ? AND variation_id = ?
     AND EXISTS (
       SELECT 1 FROM variations v
       WHERE v.id = variation_id
         AND (
           v.user_id = ?
           OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = v.recipe_id AND r.user_id = ?)
         )
     )`,
    cutId,
    variationId,
    actor,
    actor
  );
}

export async function addVariationNote(
  db: D1Database,
  variationId: number,
  noteText: string,
  rating: number | null,
  actorUserId?: string | null
) {
  const actor = asActor(actorUserId);
  await exec(
    db,
    `INSERT INTO variation_notes (variation_id, user_id, note_text, rating, created_at)
     SELECT id, ?, ?, ?, ? FROM variations WHERE id = ?`,
    actor,
    noteText,
    rating,
    nowIso(),
    variationId
  );
}

export async function upsertVariationIngredient(db: D1Database, input: {
  variationId: number;
  id?: number;
  ingredientId: number;
  amountGramsPerBase: number | null;
  amountMlPerBase: number | null;
  amountUnitsPerBase: number | null;
  displayUnitOverride: DisplayUnit | null;
  sortOrder: number;
}, actorUserId?: string | null) {
  const actor = asActor(actorUserId);
  if (input.id) {
    await exec(
      db,
      `UPDATE variation_ingredients
       SET ingredient_id = ?, amount_grams_per_base = ?, amount_ml_per_base = ?, amount_units_per_base = ?, display_unit_override = ?, sort_order = ?
       WHERE id = ? AND variation_id = ?
         AND EXISTS (
           SELECT 1 FROM variations v
           WHERE v.id = variation_id
             AND (
               v.user_id = ?
               OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = v.recipe_id AND r.user_id = ?)
             )
         )`,
      input.ingredientId,
      input.amountGramsPerBase,
      input.amountMlPerBase,
      input.amountUnitsPerBase,
      input.displayUnitOverride,
      input.sortOrder,
      input.id,
      input.variationId,
      actor,
      actor
    );
    return;
  }

  await exec(
    db,
    `INSERT INTO variation_ingredients (variation_id, ingredient_id, amount_grams_per_base, amount_ml_per_base, amount_units_per_base, display_unit_override, sort_order)
     SELECT v.id, ?, ?, ?, ?, ?, ?
     FROM variations v
     JOIN ingredients i ON i.id = ?
     WHERE v.id = ? AND i.id = ?
       AND (
         v.user_id = ?
         OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = v.recipe_id AND r.user_id = ?)
       )
     ON CONFLICT(variation_id, ingredient_id) DO UPDATE SET
       amount_grams_per_base = excluded.amount_grams_per_base,
       amount_ml_per_base = excluded.amount_ml_per_base,
       amount_units_per_base = excluded.amount_units_per_base,
       display_unit_override = excluded.display_unit_override,
       sort_order = excluded.sort_order`,
    input.ingredientId,
    input.amountGramsPerBase,
    input.amountMlPerBase,
    input.amountUnitsPerBase,
    input.displayUnitOverride,
    input.sortOrder,
    input.ingredientId,
    input.variationId,
    input.ingredientId,
    actor,
    actor
  );
}

export async function deleteVariationIngredient(
  db: D1Database,
  variationId: number,
  id: number,
  actorUserId?: string | null
) {
  const actor = asActor(actorUserId);
  await exec(
    db,
    `DELETE FROM variation_ingredients
     WHERE id = ? AND variation_id = ?
       AND EXISTS (
         SELECT 1 FROM variations v
         WHERE v.id = variation_id
           AND (
             v.user_id = ?
             OR EXISTS (SELECT 1 FROM recipes r WHERE r.id = v.recipe_id AND r.user_id = ?)
           )
       )`,
    id,
    variationId,
    actor,
    actor
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
    volume_ratio_uses: number;
    total_ratio_uses: number;
  }>(
    db,
    `SELECT i.id, i.name, i.default_display_unit,
            ic.grams_per_ml, ic.grams_per_tsp, ic.source_note,
            COALESCE(vu.volume_ratio_uses, 0) AS volume_ratio_uses,
            COALESCE(vu.total_ratio_uses, 0) AS total_ratio_uses
     FROM ingredients i
     LEFT JOIN ingredient_conversions ic ON ic.ingredient_id = i.id
     LEFT JOIN (
       SELECT ingredient_id,
              COUNT(*) AS total_ratio_uses,
              SUM(CASE WHEN amount_ml_per_base IS NOT NULL THEN 1 ELSE 0 END) AS volume_ratio_uses
       FROM (
         SELECT ingredient_id, amount_ml_per_base
         FROM recipe_revision_ingredients
         UNION ALL
         SELECT ingredient_id, amount_ml_per_base
         FROM variation_ingredients
       )
       GROUP BY ingredient_id
     ) vu ON vu.ingredient_id = i.id
     ORDER BY lower(i.name) ASC`
  );
}

export async function updateIngredientDisplayUnit(db: D1Database, ingredientId: number, unit: DisplayUnit) {
  await exec(db, `UPDATE ingredients SET default_display_unit = ? WHERE id = ?`, unit, ingredientId);
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
     WHERE i.id = ?
     ON CONFLICT(ingredient_id) DO UPDATE SET
       grams_per_ml = excluded.grams_per_ml,
       grams_per_tsp = excluded.grams_per_tsp,
       source_note = excluded.source_note,
       updated_at = excluded.updated_at`,
    input.gramsPerMl,
    input.gramsPerTsp,
    input.sourceNote || null,
    nowIso(),
    input.ingredientId
  );
}

export async function seedDemoData(db: D1Database, actorUserId?: string | null) {
  const actor = asActor(actorUserId);
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
    `SELECT id FROM recipes WHERE title = ? LIMIT 1`,
    'Basic Venison Backstrap'
  );

  if (existingSample) return;

  const recipeId = await createRecipe(db, {
    title: 'Basic Venison Backstrap',
    description: 'Simple pan-seared backstrap with a dry spice rub.',
    tags: ['venison', 'backstrap', 'sear'],
    baseMeatGrams: 1000,
    baseAnimal: 'venison'
  }, actor);

  await addRecipeCut(db, recipeId, 'backstrap', actor);

  const saltId = await ensureIngredient(db, 'kosher salt', 'tsp');
  const pepperId = await ensureIngredient(db, 'black pepper', 'tsp');
  const garlicId = await ensureIngredient(db, 'garlic powder', 'tsp');

  await upsertRecipeIngredient(db, {
    recipeId,
    ingredientId: saltId,
    amountGramsPerBase: 12,
    amountMlPerBase: null,
    amountUnitsPerBase: null,
    displayUnitOverride: 'tsp',
    sortOrder: 1
  }, actor);
  await upsertRecipeIngredient(db, {
    recipeId,
    ingredientId: pepperId,
    amountGramsPerBase: 6,
    amountMlPerBase: null,
    amountUnitsPerBase: null,
    displayUnitOverride: 'tsp',
    sortOrder: 2
  }, actor);
  await upsertRecipeIngredient(db, {
    recipeId,
    ingredientId: garlicId,
    amountGramsPerBase: 4,
    amountMlPerBase: null,
    amountUnitsPerBase: null,
    displayUnitOverride: 'tsp',
    sortOrder: 3
  }, actor);

  const variationId = await createVariation(db, {
    recipeId,
    cookedAt: createdAt.slice(0, 10),
    meatGrams: 1500,
    animalOverride: 'venison',
    actorUserId: actor
  });

  await addVariationCut(db, variationId, 'backstrap', actor);
  await addVariationNote(db, variationId, 'Seared hotter than usual; bark was excellent.', 5, actor);
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

function mergeIngredientRows(
  recipeRows: ScaleInputRow[],
  variationRows: Array<ScaleInputRow & { ingredientId: number; ingredientName: string; sort_order: number }>
): ScaleInputRow[] {
  const byIngredient = new Map<number, ScaleInputRow>();
  for (const row of recipeRows) byIngredient.set(row.ingredientId, row);

  for (const override of variationRows) {
    const base = byIngredient.get(override.ingredientId);
    byIngredient.set(override.ingredientId, {
      ingredientId: override.ingredientId,
      ingredientName: override.ingredientName,
      amountGramsPerBase: override.amountGramsPerBase,
      amountMlPerBase: override.amountMlPerBase,
      amountUnitsPerBase: override.amountUnitsPerBase,
      defaultDisplayUnit: override.defaultDisplayUnit,
      displayUnitOverride: override.displayUnitOverride ?? base?.displayUnitOverride ?? null,
      gramsPerMl: override.gramsPerMl,
      gramsPerTsp: override.gramsPerTsp
    });
  }

  const variationOrder = new Map<number, number>();
  variationRows.forEach((row, idx) => variationOrder.set(row.ingredientId, row.sort_order ?? idx + 1));
  const recipeOrder = new Map<number, number>();
  recipeRows.forEach((row, idx) => recipeOrder.set(row.ingredientId, idx + 1));

  return Array.from(byIngredient.values()).sort((a, b) => {
    const aOrder = variationOrder.get(a.ingredientId) ?? recipeOrder.get(a.ingredientId) ?? 9999;
    const bOrder = variationOrder.get(b.ingredientId) ?? recipeOrder.get(b.ingredientId) ?? 9999;
    return aOrder - bOrder || a.ingredientName.localeCompare(b.ingredientName);
  });
}
