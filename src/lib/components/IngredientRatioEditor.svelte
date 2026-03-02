<script lang="ts">
  import type { DisplayUnit } from '$lib/scaling';

  let {
    ingredients,
    recipeId,
    recipeIngredients
  }: {
    ingredients: Array<{ id: number; name: string; default_display_unit: DisplayUnit }>;
    recipeId: number;
    recipeIngredients: Array<{
      id: number;
      ingredient_id: number;
      name: string;
      amount_grams_per_base: number | null;
      amount_ml_per_base: number | null;
      display_unit_override: DisplayUnit | null;
      sort_order: number;
      default_display_unit: DisplayUnit;
    }>;
  } = $props();
</script>

<section class="card stack">
  <h2>Ingredient ratios</h2>

  {#each recipeIngredients as row}
    <form method="POST" action="?/updateIngredient" class="ingredient-row">
      <input type="hidden" name="recipe_id" value={recipeId} />
      <input type="hidden" name="id" value={row.id} />

      <select name="ingredient_id" value={row.ingredient_id}>
        {#each ingredients as ingredient}
          <option value={ingredient.id}>{ingredient.name}</option>
        {/each}
      </select>

      <select name="ratio_type" value={row.amount_grams_per_base !== null ? 'g' : 'ml'}>
        <option value="g">grams/base</option>
        <option value="ml">ml/base</option>
      </select>

      <input
        name="amount"
        type="number"
        step="0.01"
        required
        value={row.amount_grams_per_base ?? row.amount_ml_per_base ?? ''}
      />

      <label>
        display
        <select name="display_unit_override" value={row.display_unit_override ?? ''}>
          <option value="">default ({row.default_display_unit})</option>
          <option value="g">g</option>
          <option value="ml">ml</option>
          <option value="tsp">tsp</option>
          <option value="tbsp">tbsp</option>
        </select>
      </label>

      <input name="sort_order" type="number" value={row.sort_order} />

      <button type="submit">Update</button>
      <button type="submit" formaction="?/deleteIngredient">Delete</button>
    </form>
  {/each}

  <form method="POST" action="?/addIngredient" class="stack">
    <input type="hidden" name="recipe_id" value={recipeId} />
    <h3>Add ingredient</h3>

    <label>
      Existing ingredient
      <select name="ingredient_id">
        <option value="">Create inline below</option>
        {#each ingredients as ingredient}
          <option value={ingredient.id}>{ingredient.name}</option>
        {/each}
      </select>
    </label>

    <label>
      New ingredient name (if creating)
      <input name="new_ingredient_name" placeholder="juniper" />
    </label>

    <label>
      New ingredient default unit
      <select name="new_ingredient_unit">
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="tsp">tsp</option>
        <option value="tbsp">tbsp</option>
      </select>
    </label>

    <div class="grid-4">
      <label>
        Ratio type
        <select name="ratio_type">
          <option value="g">grams/base</option>
          <option value="ml">ml/base</option>
        </select>
      </label>
      <label>
        Amount per base
        <input name="amount" type="number" step="0.01" required />
      </label>
      <label>
        Display unit override
        <select name="display_unit_override">
          <option value="">default</option>
          <option value="g">g</option>
          <option value="ml">ml</option>
          <option value="tsp">tsp</option>
          <option value="tbsp">tbsp</option>
        </select>
      </label>
      <label>
        Sort order
        <input name="sort_order" type="number" value="10" />
      </label>
    </div>

    <button class="primary" type="submit">Add ingredient ratio</button>
  </form>
</section>

<style>
  .ingredient-row {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 2fr 1fr 1fr 1fr 0.7fr auto auto;
    align-items: end;
  }

  .grid-4 {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @media (max-width: 900px) {
    .ingredient-row,
    .grid-4 {
      grid-template-columns: 1fr;
    }
  }
</style>
