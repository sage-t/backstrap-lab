<script lang="ts">
  import type { MeasurementPreferences } from '$lib/measurement';
  import {
    formatIngredientAmount,
    formatVolumeFromMl,
    formatWeightFromGrams,
    shouldPreferKitchenVolumeForGrams
  } from '$lib/measurement';
  import { scaleIngredients, type DisplayUnit } from '$lib/scaling';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';

  let {
    ingredients,
    recipeId,
    recipeIngredients,
    recipeBaseMeatGrams,
    measurementPrefs
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
      grams_per_ml: number | null;
      grams_per_tsp: number | null;
    }>;
    recipeBaseMeatGrams: number;
    measurementPrefs: MeasurementPreferences;
  } = $props();

  let previewMeatGrams = $state(0);
  let ingredientQuery = $state('');
  let showDeleteDialog = $state(false);
  let deleteTargetForm: HTMLFormElement | null = null;
  let deleteSubmitter: HTMLButtonElement | null = null;

  $effect(() => {
    previewMeatGrams = recipeBaseMeatGrams;
  });

  const ingredientByName = $derived.by(() => {
    const map = new Map<string, number>();
    for (const ingredient of ingredients) map.set(ingredient.name.toLowerCase(), ingredient.id);
    return map;
  });

  const matchedIngredientId = $derived.by(() => ingredientByName.get(ingredientQuery.trim().toLowerCase()) ?? 0);

  const previewRows = $derived.by(() => {
    const scaled = scaleIngredients({
      baseMeatGrams: Math.max(1, Number(recipeBaseMeatGrams) || 1),
      targetMeatGrams: Math.max(1, Number(previewMeatGrams) || 1),
      rows: recipeIngredients.map((row) => ({
        ingredientId: row.ingredient_id,
        ingredientName: row.name,
        amountGramsPerBase: row.amount_grams_per_base,
        amountMlPerBase: row.amount_ml_per_base,
        defaultDisplayUnit: row.default_display_unit,
        displayUnitOverride: row.display_unit_override,
        gramsPerMl: row.grams_per_ml,
        gramsPerTsp: row.grams_per_tsp
      }))
    });

    return scaled.map((row) => {
      const useKitchenVolume =
        row.displayUnit === 'g' &&
        shouldPreferKitchenVolumeForGrams(row.sourceAmountGrams, measurementPrefs) &&
        row.sourceAmountMl !== null;
      return {
        name: row.ingredientName,
        text: useKitchenVolume
          ? formatVolumeFromMl(row.sourceAmountMl ?? 0, measurementPrefs)
          : formatIngredientAmount(row.displayAmount, row.displayUnit, measurementPrefs),
        warning: row.warning
      };
    });
  });

  function openDeleteConfirm(event: MouseEvent) {
    event.preventDefault();
    deleteSubmitter = event.currentTarget as HTMLButtonElement;
    deleteTargetForm = deleteSubmitter.form;
    showDeleteDialog = true;
  }

  function setSortOrder(event: MouseEvent, nextOrder: number) {
    const submitter = event.currentTarget as HTMLButtonElement;
    const formEl = submitter.form;
    if (!formEl) return;
    const input = formEl.querySelector<HTMLInputElement>('input[name=\"sort_order\"]');
    if (input) input.value = String(nextOrder);
  }
</script>

<section class="card stack">
  <header class="section-head">
    <h2>Ingredient Ratios</h2>
    <p class="muted">
      Use grams/ml per base. Quick preview below shows what the blend becomes at different meat weights.
    </p>
  </header>

  <div class="preview card stack">
    <div class="preview-head">
      <h3>Scale preview</h3>
      <label>
        Meat grams
        <input type="number" min="1" bind:value={previewMeatGrams} />
        <span class="muted small">Displayed as {formatWeightFromGrams(previewMeatGrams, measurementPrefs)}</span>
      </label>
    </div>
    <ul class="preview-list">
      {#if previewRows.length === 0}
        <li class="muted">Add ingredient ratios to see live scaling preview.</li>
      {:else}
        {#each previewRows as row}
          <li>
            <span>{row.name}</span>
            <strong>{row.text}</strong>
            {#if row.warning}
              <Badge tone="warning">{row.warning}</Badge>
            {/if}
          </li>
        {/each}
      {/if}
    </ul>
  </div>

  {#if recipeIngredients.length === 0}
    <section class="empty-state">
      <h3>No ingredient ratios yet</h3>
      <p class="muted">Start with salt, pepper, and garlic to establish your base concentration profile.</p>
    </section>
  {:else}
    <div class="ratio-grid">
      {#each recipeIngredients as row, index}
        <form method="POST" action="?/updateIngredient" class="ingredient-row" use:enhanceForm={{ successMessage: 'Ingredient updated' }}>
          <input type="hidden" name="recipe_id" value={recipeId} />
          <input type="hidden" name="id" value={row.id} />

          <label>
            Ingredient
            <select name="ingredient_id">
              {#each ingredients as ingredient}
                <option value={ingredient.id} selected={ingredient.id === row.ingredient_id}>{ingredient.name}</option>
              {/each}
            </select>
          </label>

          <label>
            Ratio type
            <select name="ratio_type">
              <option value="g" selected={row.amount_grams_per_base !== null}>grams/base</option>
              <option value="ml" selected={row.amount_grams_per_base === null}>ml/base</option>
            </select>
          </label>

          <label>
            Amount
            <input
              name="amount"
              type="number"
              step="0.01"
              required
              value={row.amount_grams_per_base ?? row.amount_ml_per_base ?? ''}
            />
          </label>

          <label>
            Amount unit
            <select name="amount_input_unit">
              <option value="g" selected={row.amount_grams_per_base !== null}>g</option>
              <option value="lb">lb</option>
              <option value="oz">oz</option>
              <option value="ml" selected={row.amount_grams_per_base === null}>ml</option>
              <option value="tsp">tsp</option>
              <option value="tbsp">tbsp</option>
            </select>
          </label>

          <label>
            Display unit
            <select name="display_unit_override">
              <option value="" selected={row.display_unit_override === null}>default ({row.default_display_unit})</option>
              <option value="g" selected={row.display_unit_override === 'g'}>g</option>
              <option value="ml" selected={row.display_unit_override === 'ml'}>ml</option>
              <option value="tsp" selected={row.display_unit_override === 'tsp'}>tsp</option>
              <option value="tbsp" selected={row.display_unit_override === 'tbsp'}>tbsp</option>
            </select>
          </label>

          <label>
            Order
            <input name="sort_order" type="number" value={row.sort_order} />
          </label>

          <div class="actions">
            <button type="submit">Save</button>
            <button
              type="submit"
              formaction="?/updateIngredient"
              disabled={index === 0}
              on:click={(event) => {
                const prev = recipeIngredients[index - 1];
                if (prev) setSortOrder(event, prev.sort_order - 1);
              }}
            >
              ↑
            </button>
            <button
              type="submit"
              formaction="?/updateIngredient"
              disabled={index === recipeIngredients.length - 1}
              on:click={(event) => {
                const next = recipeIngredients[index + 1];
                if (next) setSortOrder(event, next.sort_order + 1);
              }}
            >
              ↓
            </button>
            <button
              type="submit"
              formaction="?/deleteIngredient"
              on:click={openDeleteConfirm}
            >
              Delete
            </button>
          </div>
        </form>
      {/each}
    </div>
  {/if}

  <form method="POST" action="?/addIngredient" class="stack add-form" use:enhanceForm={{ successMessage: 'Ingredient ratio added', resetOnSuccess: true }}>
    <input type="hidden" name="recipe_id" value={recipeId} />
    <h3>Add ingredient</h3>

    <label>
      Ingredient (type to search existing or create new)
      <input
        list="ingredient-options"
        bind:value={ingredientQuery}
        placeholder="e.g. kosher salt"
        required
      />
      <datalist id="ingredient-options">
        {#each ingredients as ingredient}
          <option value={ingredient.name}></option>
        {/each}
      </datalist>
      {#if matchedIngredientId}
        <span class="muted small">Will use existing ingredient</span>
      {:else}
        <span class="muted small">Will create new ingredient</span>
      {/if}
    </label>

    <input type="hidden" name="ingredient_id" value={matchedIngredientId || ''} />
    <input type="hidden" name="new_ingredient_name" value={matchedIngredientId ? '' : ingredientQuery} />

    <div class="grid-4">
      <label>
        New ingredient default unit
        <select name="new_ingredient_unit">
          <option value="g">g</option>
          <option value="lb">lb (stored as g)</option>
          <option value="oz">oz (stored as g)</option>
          <option value="ml">ml</option>
          <option value="tsp">tsp</option>
          <option value="tbsp">tbsp</option>
        </select>
      </label>

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
        Amount unit
        <select name="amount_input_unit">
          <option value="g">g</option>
          <option value="lb">lb</option>
          <option value="oz">oz</option>
          <option value="ml">ml</option>
          <option value="tsp">tsp</option>
          <option value="tbsp">tbsp</option>
        </select>
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
    </div>

    <label>
      Sort order
      <input name="sort_order" type="number" value={recipeIngredients.length + 1} />
    </label>

    <Button variant="primary" type="submit">Add ingredient ratio</Button>
  </form>
</section>

<ConfirmDialog
  bind:open={showDeleteDialog}
  title="Delete ingredient ratio?"
  message="This ratio row will be removed from the recipe."
  confirmLabel="Delete"
  danger={true}
  onConfirm={() => {
    if (deleteTargetForm && deleteSubmitter) deleteTargetForm.requestSubmit(deleteSubmitter);
  }}
/>

<style>
  .section-head {
    display: grid;
    gap: var(--space-2);
  }

  .preview {
    background: linear-gradient(145deg, #fbfffd, #f9fbff);
    border-style: dashed;
  }

  .preview-head {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    align-items: end;
  }

  .preview-list {
    display: grid;
    gap: var(--space-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .preview-list li {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px dashed var(--border);
    padding-bottom: 6px;
  }

  .ratio-grid {
    display: grid;
    gap: var(--space-3);
  }

  .ingredient-row {
    display: grid;
    gap: var(--space-2);
    grid-template-columns: 2fr repeat(5, minmax(90px, 1fr)) auto;
    align-items: end;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: #fff;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
  }

  .grid-4 {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .small {
    font-size: 0.79rem;
  }

  .add-form {
    border-top: 1px solid var(--border);
    padding-top: var(--space-4);
  }

  .empty-state {
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--panel-soft);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-2);
  }

  @media (max-width: 1150px) {
    .ingredient-row {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 900px) {
    .grid-4 {
      grid-template-columns: 1fr;
    }

    .ingredient-row {
      grid-template-columns: 1fr;
    }
  }
</style>
