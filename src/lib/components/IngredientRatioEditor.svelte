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

  const GRAMS_PER_LB = 453.59237;
  type QuickAmountUnit = 'g' | 'lb' | 'oz' | 'ml' | 'tsp' | 'tbsp' | 'cup' | 'unit';
  type RatioType = 'g' | 'ml' | 'unit';

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
      amount_units_per_base: number | null;
      display_unit_override: DisplayUnit | null;
      sort_order: number;
      default_display_unit: DisplayUnit;
      grams_per_ml: number | null;
      grams_per_tsp: number | null;
    }>;
    recipeBaseMeatGrams: number;
    measurementPrefs: MeasurementPreferences;
  } = $props();

  let previewMeatInput = $state(0);
  let ingredientQuery = $state('');
  let addAmountUnit = $state<QuickAmountUnit>('g');
  let addAmountUnitInitialized = $state(false);
  let addRatioTypeOverride = $state<'' | RatioType>('');
  let orderedRows = $state<typeof recipeIngredients>([]);
  let showIngredientResults = $state(false);
  let showDeleteDialog = $state(false);
  let reorderFormEl = $state<HTMLFormElement | null>(null);
  let reorderIdsPayload = $state('[]');
  let draggingIngredientId = $state<number | null>(null);
  let deleteTargetForm: HTMLFormElement | null = null;
  let deleteSubmitter: HTMLButtonElement | null = null;
  const useImperialPreviewInput = $derived(measurementPrefs.weightPreference === 'imperial_lb_oz');
  const previewMeatGrams = $derived.by(() => {
    const amount = Number(previewMeatInput) || 0;
    if (useImperialPreviewInput) return Math.max(1, Math.round(amount * GRAMS_PER_LB));
    return Math.max(1, Math.round(amount));
  });

  $effect(() => {
    orderedRows = [...recipeIngredients];
    reorderIdsPayload = JSON.stringify(recipeIngredients.map((row) => row.ingredient_id));
  });

  $effect(() => {
    if (measurementPrefs.weightPreference === 'imperial_lb_oz') {
      previewMeatInput = Number((recipeBaseMeatGrams / GRAMS_PER_LB).toFixed(2));
      return;
    }
    previewMeatInput = recipeBaseMeatGrams;
  });

  $effect(() => {
    if (addAmountUnitInitialized) return;
    addAmountUnit = measurementPrefs.weightPreference === 'imperial_lb_oz' ? 'lb' : 'g';
    addAmountUnitInitialized = true;
  });

  const ingredientByName = $derived.by(() => {
    const map = new Map<string, number>();
    for (const ingredient of ingredients) map.set(ingredient.name.toLowerCase(), ingredient.id);
    return map;
  });

  const matchedIngredientId = $derived.by(() => ingredientByName.get(ingredientQuery.trim().toLowerCase()) ?? 0);
  const ingredientMatches = $derived.by(() => {
    const query = ingredientQuery.trim().toLowerCase();
    if (!query) return [];
    return ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(query)).slice(0, 8);
  });
  const inferredAddRatioType = $derived.by(() => inferRatioTypeFromUnit(addAmountUnit));
  const effectiveAddRatioType = $derived.by(() =>
    addRatioTypeOverride || inferredAddRatioType
  );

  const previewRows = $derived.by(() => {
    const scaled = scaleIngredients({
      baseMeatGrams: Math.max(1, Number(recipeBaseMeatGrams) || 1),
      targetMeatGrams: Math.max(1, Number(previewMeatGrams) || 1),
      rows: orderedRows.map((row) => ({
        ingredientId: row.ingredient_id,
        ingredientName: row.name,
        amountGramsPerBase: row.amount_grams_per_base,
        amountMlPerBase: row.amount_ml_per_base,
        amountUnitsPerBase: row.amount_units_per_base,
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

  function pickIngredient(name: string) {
    ingredientQuery = name;
    showIngredientResults = false;
  }

  function onIngredientBlur() {
    // Let suggestion click fire before hiding results.
    setTimeout(() => {
      showIngredientResults = false;
    }, 100);
  }

  function onDragStart(event: DragEvent, ingredientId: number) {
    draggingIngredientId = ingredientId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(ingredientId));
    }
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  function onDrop(event: DragEvent, targetIngredientId: number) {
    event.preventDefault();
    const draggedFromTransfer = Number(event.dataTransfer?.getData('text/plain') ?? '0');
    const sourceIngredientId =
      draggingIngredientId ?? (Number.isFinite(draggedFromTransfer) ? draggedFromTransfer : 0);
    draggingIngredientId = null;
    if (!sourceIngredientId || sourceIngredientId === targetIngredientId) return;

    const fromIndex = orderedRows.findIndex((row) => row.id === sourceIngredientId);
    const toIndex = orderedRows.findIndex((row) => row.id === targetIngredientId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...orderedRows];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const reordered = next.map((row, index) => ({ ...row, sort_order: index + 1 }));
    orderedRows = reordered;
    const orderedIdsJson = JSON.stringify(reordered.map((row) => row.ingredient_id));
    reorderIdsPayload = orderedIdsJson;
    if (reorderFormEl) {
      const hidden = reorderFormEl.querySelector<HTMLInputElement>('input[name="ordered_ids"]');
      if (hidden) hidden.value = orderedIdsJson;
      reorderFormEl.requestSubmit();
    }
  }

  function inferRatioTypeFromUnit(unit: string): RatioType {
    const normalized = unit.toLowerCase();
    if (normalized === 'g' || normalized === 'lb' || normalized === 'oz') return 'g';
    if (
      normalized === 'ml' ||
      normalized === 'tsp' ||
      normalized === 'tbsp' ||
      normalized === 'cup'
    ) {
      return 'ml';
    }
    return 'unit';
  }
</script>

<section class="card stack">
  <header class="section-head">
    <h2>Ingredient Ratios</h2>
    <p class="muted">
      Use grams/ml/units per base. Quick preview below shows what the blend becomes at different meat weights.
    </p>
    <details class="field-guide">
      <summary>Ingredient Input Help</summary>
      <p><strong>Quick add</strong> auto-detects storage type from unit (mass/volume/unit).</p>
      <p><strong>Ratio type</strong> controls storage (`grams/base`, `ml/base`, or `units/base`).</p>
      <p><strong>Amount unit</strong> is only for entry; values are converted on save.</p>
      <p><strong>units/base</strong> is for count-style items (cloves, pieces) that still scale.</p>
      <p><strong>Display unit override</strong> changes UI display only, not stored ratios.</p>
    </details>
  </header>

  <div class="preview card stack">
    <div class="preview-head">
      <h3>Scale preview</h3>
      <label>
        Meat {useImperialPreviewInput ? 'lbs' : 'grams'}
        <input
          type="number"
          min={useImperialPreviewInput ? 0.01 : 1}
          step={useImperialPreviewInput ? 0.01 : 1}
          bind:value={previewMeatInput}
        />
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
      {#each orderedRows as row (row.id)}
        <form
          method="POST"
          action="?/updateIngredient"
          class={`ingredient-row ${draggingIngredientId === row.id ? 'dragging' : ''}`}
          use:enhanceForm={{ successMessage: 'Ingredient updated' }}
          on:dragover={onDragOver}
          on:drop={(event) => onDrop(event, row.id)}
        >
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
              <option value="ml" selected={row.amount_grams_per_base === null && row.amount_units_per_base === null}>ml/base</option>
              <option value="unit" selected={row.amount_units_per_base !== null}>units/base</option>
            </select>
          </label>

          <label>
            Amount
            <input
              name="amount"
              type="number"
              step="0.01"
              required
              value={row.amount_grams_per_base ?? row.amount_ml_per_base ?? row.amount_units_per_base ?? ''}
            />
          </label>

          <label>
            Amount unit
            <select name="amount_input_unit">
              <option value="g" selected={row.amount_grams_per_base !== null}>g</option>
              <option value="lb">lb</option>
              <option value="oz">oz</option>
              <option value="ml" selected={row.amount_grams_per_base === null && row.amount_units_per_base === null}>ml</option>
              <option value="tsp">tsp</option>
              <option value="tbsp">tbsp</option>
              <option value="cup">cup</option>
              <option value="unit" selected={row.amount_units_per_base !== null}>unit</option>
            </select>
          </label>

          <label>
            Display unit
            <select name="display_unit_override">
              <option value="" selected={row.display_unit_override === null}>default ({row.amount_units_per_base !== null ? 'unit' : row.default_display_unit})</option>
              <option value="g" selected={row.display_unit_override === 'g'}>g</option>
              <option value="ml" selected={row.display_unit_override === 'ml'}>ml</option>
              <option value="tsp" selected={row.display_unit_override === 'tsp'}>tsp</option>
              <option value="tbsp" selected={row.display_unit_override === 'tbsp'}>tbsp</option>
              <option value="unit" selected={row.display_unit_override === 'unit'}>unit</option>
            </select>
          </label>

          <label>
            Order
            <input name="sort_order" type="number" value={row.sort_order} />
          </label>

          <div class="actions">
            <button
              type="button"
              class="drag-handle"
              draggable="true"
              title="Drag to reorder"
              on:dragstart={(event) => onDragStart(event, row.id)}
              on:dragend={() => (draggingIngredientId = null)}
            >
              ⋮⋮
            </button>
            <button type="submit">Save</button>
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
    <form
      method="POST"
      action="?/reorderIngredients"
      bind:this={reorderFormEl}
      class="reorder-form"
      use:enhanceForm={{ successMessage: 'Ingredient order updated' }}
    >
      <input type="hidden" name="ordered_ids" bind:value={reorderIdsPayload} />
    </form>
  {/if}

  <form method="POST" action="?/addIngredient" class="stack add-form" use:enhanceForm={{ successMessage: 'Ingredient ratio added', resetOnSuccess: true }}>
    <input type="hidden" name="recipe_id" value={recipeId} />
    <h3>Add ingredient</h3>

    <section class="add-block stack">
      <div class="add-block-head">
        <h4>1. Ingredient</h4>
        <p class="muted small">Pick an existing ingredient or create a new one.</p>
      </div>
      <div class="grid-ingredient">
        <label>
          Ingredient name
          <input
            bind:value={ingredientQuery}
            placeholder="e.g. kosher salt"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            aria-autocomplete="list"
            required
            on:focus={() => (showIngredientResults = true)}
            on:input={() => (showIngredientResults = true)}
            on:blur={onIngredientBlur}
          />
          {#if showIngredientResults && ingredientMatches.length > 0}
            <ul class="ingredient-results">
              {#each ingredientMatches as ingredient}
                <li>
                  <button
                    type="button"
                    class="ingredient-result-btn"
                    on:mousedown={(event) => event.preventDefault()}
                    on:click={() => pickIngredient(ingredient.name)}
                  >
                    {ingredient.name}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </label>

        {#if matchedIngredientId}
          <div class="existing-ingredient-note">
            <p class="muted small">Existing ingredient selected.</p>
            <p class="muted small">Its saved default unit and densities will be reused.</p>
          </div>
        {:else}
          <label>
            New ingredient default unit
            <select name="new_ingredient_unit">
              <option value="g">g</option>
              <option value="lb">lb (stored as g)</option>
              <option value="oz">oz (stored as g)</option>
              <option value="ml">ml</option>
              <option value="tsp">tsp</option>
              <option value="tbsp">tbsp</option>
              <option value="unit">unit (stored as g)</option>
            </select>
          </label>
        {/if}
      </div>
      {#if ingredientQuery.trim().length > 0}
        <p class="muted small ingredient-match-status">
          {#if matchedIngredientId}
            Using existing ingredient and its saved conversion defaults.
          {:else}
            No exact match found. This will create a new ingredient.
          {/if}
        </p>
      {/if}
    </section>

    <input type="hidden" name="ingredient_id" value={matchedIngredientId || ''} />
    <input type="hidden" name="new_ingredient_name" value={matchedIngredientId ? '' : ingredientQuery} />
    <input type="hidden" name="ratio_type" value={effectiveAddRatioType} />

    <section class="add-block stack">
      <div class="add-block-head">
        <h4>2. Quick amount</h4>
        <p class="muted small">Enter what you have. Ratio type is auto-detected from unit.</p>
      </div>
      <div class="grid-quick-ratio">
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
            <option value="cup">cup</option>
            <option value="unit">unit / item</option>
          </select>
        </label>
      </div>
      <p class="muted small quick-hint">
        Stored as <strong>{effectiveAddRatioType === 'g' ? 'grams/base' : effectiveAddRatioType === 'ml' ? 'ml/base' : 'units/base'}</strong>.
      </p>
      <details class="add-advanced">
        <summary>Advanced options</summary>
        <div class="grid-ratio">
          <label>
            Ratio type override
            <select bind:value={addRatioTypeOverride}>
              <option value="">Auto from unit ({inferredAddRatioType}/base)</option>
              <option value="g">grams/base</option>
              <option value="ml">ml/base</option>
              <option value="unit">units/base</option>
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
              <option value="unit">unit</option>
            </select>
          </label>
        </div>
      </details>
    </section>

    <div class="add-footer">
      <label>
        Sort order
        <input name="sort_order" type="number" value={recipeIngredients.length + 1} />
      </label>
      <Button variant="primary" type="submit">Add ingredient ratio</Button>
    </div>
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

  .field-guide {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--panel-soft);
    padding: var(--space-2) var(--space-3);
    display: grid;
    gap: 4px;
  }

  .field-guide summary {
    cursor: pointer;
    font-weight: 650;
    color: var(--muted);
  }

  .field-guide p {
    margin: 0;
    font-size: 0.83rem;
    color: var(--muted);
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

  .ingredient-row.dragging {
    opacity: 0.75;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-wrap: wrap;
  }

  .drag-handle {
    font-size: 1rem;
    line-height: 1;
    padding: 6px 8px;
    cursor: grab;
    border-style: dashed;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .small {
    font-size: 0.79rem;
  }

  .add-form {
    border-top: 1px solid var(--border);
    padding-top: var(--space-4);
  }

  .add-block {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: linear-gradient(180deg, #ffffff, #fbfcfe);
    padding: var(--space-4);
    gap: var(--space-3);
  }

  .add-block-head {
    display: grid;
    gap: 2px;
  }

  .add-block-head h4 {
    font-size: 0.95rem;
  }

  .grid-ingredient {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: minmax(260px, 2fr) minmax(220px, 1fr);
    align-items: start;
  }

  .existing-ingredient-note {
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    background: var(--panel-soft);
    padding: 10px 12px;
    display: grid;
    gap: 2px;
    min-height: 44px;
    align-content: center;
  }

  .grid-ratio {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
  }

  .grid-quick-ratio {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr);
    align-items: end;
  }

  .quick-hint {
    margin: 0;
  }

  .add-advanced {
    border-top: 1px dashed var(--border);
    padding-top: var(--space-3);
  }

  .add-advanced summary {
    cursor: pointer;
    color: var(--muted);
    font-weight: 650;
    margin-bottom: var(--space-3);
  }

  .add-footer {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .add-footer label {
    width: min(220px, 100%);
  }

  .ingredient-results {
    list-style: none;
    margin: 6px 0 0;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: #fff;
    max-height: 220px;
    overflow: auto;
    box-shadow: var(--shadow-sm);
    display: grid;
    gap: 2px;
  }

  .ingredient-result-btn {
    width: 100%;
    border: 0;
    border-radius: 6px;
    background: transparent;
    text-align: left;
    padding: 7px 8px;
    font-weight: 500;
  }

  .ingredient-result-btn:hover {
    background: var(--panel-soft);
    border-color: transparent;
  }

  .ingredient-match-status {
    margin-top: calc(var(--space-1) * -1);
  }

  .reorder-form {
    display: none;
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
    .grid-ingredient,
    .grid-ratio,
    .grid-quick-ratio {
      grid-template-columns: 1fr;
    }

    .ingredient-row {
      grid-template-columns: 1fr;
    }

    .add-footer {
      align-items: stretch;
    }

    .add-footer :global(.ui-btn) {
      width: 100%;
    }
  }
</style>
