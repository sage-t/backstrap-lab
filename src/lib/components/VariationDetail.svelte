<script lang="ts">
  import type { MeasurementPreferences } from '$lib/measurement';
  import {
    formatIngredientAmount,
    formatVolumeFromMl,
    formatWeightFromGrams
  } from '$lib/measurement';
  import type { DisplayUnit, ScaledIngredient } from '$lib/scaling';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';
  import { toasts } from '$lib/ui/toast';

  let {
    variation,
    scaled,
    recipeCuts,
    variationCuts,
    notes,
    variationIngredients,
    ingredientCatalog,
    canEditVariation,
    canDeleteVariation,
    measurementPrefs
  }: {
    variation: {
      id: number;
      recipeId: number;
      userId: string;
      recipeOwnerUserId: string;
      recipeTitle: string;
      recipeRevisionId: number;
      baseMeatGrams: number;
      baseAnimal: string;
      cookedAt: string;
      meatGrams: number;
      animalOverride: string;
      parentVariationId: number | null;
      rating: number | null;
    };
    scaled: ScaledIngredient[];
    recipeCuts: Array<{ id: number; cut_name: string }>;
    variationCuts: Array<{ id: number; cut_name: string }>;
    notes: Array<{ id: number; note_text: string; rating: number | null; created_at: string }>;
    variationIngredients: Array<{
      id: number;
      ingredientId: number;
      ingredientName: string;
      amountGramsPerBase: number | null;
      amountMlPerBase: number | null;
      displayUnitOverride: DisplayUnit | null;
      sort_order: number;
      defaultDisplayUnit: DisplayUnit;
    }>;
    ingredientCatalog: Array<{ id: number; name: string; default_display_unit: DisplayUnit }>;
    canEditVariation: boolean;
    canDeleteVariation: boolean;
    measurementPrefs: MeasurementPreferences;
  } = $props();

  const scaleFactor = $derived((variation.meatGrams / variation.baseMeatGrams).toFixed(2));
  const meatDisplay = $derived(formatWeightFromGrams(variation.meatGrams, measurementPrefs));
  const baseMeatDisplay = $derived(formatWeightFromGrams(variation.baseMeatGrams, measurementPrefs));
  const copyText = $derived.by(() => {
    const lines = scaled.map((row) => {
      const useKitchenVolume =
        measurementPrefs.volumePreference === 'kitchen_us' &&
        row.displayUnit === 'g' &&
        row.sourceAmountMl !== null;
      const text = useKitchenVolume
        ? formatVolumeFromMl(row.sourceAmountMl ?? 0, measurementPrefs)
        : formatIngredientAmount(row.displayAmount, row.displayUnit, measurementPrefs);
      return `- ${row.ingredientName}: ${text}`;
    });
    return `${variation.recipeTitle} variation (#${variation.id})\\nMeat: ${meatDisplay} (x${scaleFactor} of base)\\n\\n${lines.join('\\n')}`;
  });

  let noteRating = $state<number | null>(null);
  let showDeleteDialog = $state(false);
  let deleteForm: HTMLFormElement | null = null;
  let deleteSubmitter: HTMLButtonElement | null = null;

  const ratingChips = [
    { label: 'Meh', value: 2 },
    { label: 'Good', value: 4 },
    { label: 'Great', value: 5 }
  ];

  async function copyChecklist() {
    try {
      await navigator.clipboard.writeText(copyText);
      toasts.push('Scaled ingredient list copied', 'success');
    } catch {
      toasts.push('Clipboard copy failed', 'error');
    }
  }

  function onNoteKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      const textarea = event.currentTarget as HTMLTextAreaElement;
      textarea.form?.requestSubmit();
    }
  }

  function openDeleteConfirm(event: MouseEvent) {
    event.preventDefault();
    deleteSubmitter = event.currentTarget as HTMLButtonElement;
    deleteForm = deleteSubmitter.form;
    showDeleteDialog = true;
  }
</script>

<section class="card variation-head stack">
  <div class="head-main">
    <h1>{variation.recipeTitle}</h1>
    <p class="muted">Variation #{variation.id} · Recipe revision {variation.recipeRevisionId}</p>
  </div>
  <div class="head-metrics">
    <Badge tone="primary">{meatDisplay} meat</Badge>
    <Badge>x{scaleFactor} scale factor</Badge>
    {#if variation.rating !== null}
      <Badge tone="success">Rating {variation.rating}/5</Badge>
    {/if}
    {#if variation.parentVariationId}
      <Badge>Child of #{variation.parentVariationId}</Badge>
    {/if}
  </div>
  <div class="head-actions">
    <a href={`/recipes/${variation.recipeId}`} class="btn-link">Back to recipe</a>
    <Button on:click={copyChecklist}>Copy ingredients</Button>
    {#if canDeleteVariation}
      <form method="POST" action="?/deleteVariation" class="inline" use:enhanceForm>
        <Button variant="destructive" type="submit" on:click={openDeleteConfirm}>Delete variation</Button>
      </form>
    {/if}
  </div>
</section>

<section class="card stack">
  <header class="section-head">
    <h2>Scaled Ingredients</h2>
    <p class="muted">
      Base: {baseMeatDisplay} {variation.baseAnimal ? `(${variation.baseAnimal})` : ''}
    </p>
  </header>
  {#if scaled.length === 0}
    <p class="muted">No ingredients available for this variation snapshot.</p>
  {:else}
    <ul class="checklist">
      {#each scaled as row}
        <li>
          <label>
            <input type="checkbox" />
            <span class="name">{row.ingredientName}</span>
            <span class="amount">
              {#if measurementPrefs.volumePreference === 'kitchen_us' && row.displayUnit === 'g' && row.sourceAmountMl !== null}
                {formatVolumeFromMl(row.sourceAmountMl, measurementPrefs)}
              {:else}
                {formatIngredientAmount(row.displayAmount, row.displayUnit, measurementPrefs)}
              {/if}
            </span>
            {#if row.warning}
              <Badge tone="warning">{row.warning}</Badge>
            {/if}
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="card stack">
  <header class="section-head">
    <h2>Cook Notes</h2>
    <p class="muted">Use Cmd/Ctrl+Enter to submit fast after each run.</p>
  </header>
  <form method="POST" action="?/addNote" class="stack" use:enhanceForm={{ successMessage: 'Note added', resetOnSuccess: true }}>
    <label>
      Note
      <textarea name="note_text" required on:keydown={onNoteKeydown}></textarea>
    </label>
    <div class="note-row">
      <input type="hidden" name="rating" value={noteRating ?? ''} />
      <div class="chips" role="radiogroup" aria-label="Note sentiment">
        {#each ratingChips as chip}
          <button
            type="button"
            class:active={noteRating === chip.value}
            on:click={() => (noteRating = chip.value)}
          >
            {chip.label}
          </button>
        {/each}
        <button type="button" class="clear" on:click={() => (noteRating = null)}>Clear</button>
      </div>
      <Button variant="primary" type="submit">Add note</Button>
    </div>
  </form>

  <ul class="notes-list">
    {#if notes.length === 0}
      <li class="muted">No notes yet.</li>
    {:else}
      {#each notes as note}
        <li>
          <p>{note.note_text}</p>
          <small class="muted">
            {new Date(note.created_at).toLocaleString()}
            {note.rating ? ` · ${note.rating}/5` : ''}
          </small>
        </li>
      {/each}
    {/if}
  </ul>
</section>

{#if canEditVariation}
  <details class="card stack">
    <summary>Edit variation and overrides</summary>

    <form method="POST" action="?/updateVariation" class="stack" use:enhanceForm={{ successMessage: 'Variation updated' }}>
      <div class="grid-4">
        <label>
          Cooked at
          <input type="date" name="cooked_at" value={variation.cookedAt.slice(0, 10)} required />
        </label>
        <label>
          Meat grams
          <input type="number" name="meat_grams" min="1" value={variation.meatGrams} required />
          <span class="muted small">Shown as {meatDisplay} with current settings.</span>
        </label>
        <label>
          Animal override
          <input name="animal_override" value={variation.animalOverride} />
        </label>
        <label>
          Variation rating (1-5)
          <input type="number" min="1" max="5" name="rating" value={variation.rating ?? ''} />
        </label>
      </div>
      <Button variant="primary" type="submit">Save variation</Button>
    </form>

    <form method="POST" action="?/createChildVariation" class="stack" use:enhanceForm={{ successMessage: 'Child variation created' }}>
      <h3>Create child variation</h3>
      <div class="grid-4">
        <label>
          Cooked at
          <input type="date" name="cooked_at" value={variation.cookedAt.slice(0, 10)} required />
        </label>
        <label>
          Meat grams
          <input type="number" name="meat_grams" min="1" value={variation.meatGrams} required />
          <span class="muted small">Shown as {meatDisplay} with current settings.</span>
        </label>
        <label>
          Animal override
          <input name="animal_override" value={variation.animalOverride} />
        </label>
        <label>
          Rating (optional 1-5)
          <input type="number" min="1" max="5" name="rating" />
        </label>
      </div>
      <Button type="submit">Create child</Button>
    </form>

    <section class="stack">
      <h3>Variation cuts</h3>
      <p class="muted">Recipe cuts: {recipeCuts.map((c) => c.cut_name).join(', ') || 'none'}</p>
      <ul class="inline-list">
        {#each variationCuts as cut}
          <li>
            <Badge>{cut.cut_name}</Badge>
            <form method="POST" action="?/deleteCut" use:enhanceForm={{ successMessage: 'Cut removed' }}>
              <input type="hidden" name="cut_id" value={cut.id} />
              <Button size="sm" type="submit" on:click={openDeleteConfirm}>Remove</Button>
            </form>
          </li>
        {/each}
      </ul>
      <form method="POST" action="?/addCut" class="inline-add" use:enhanceForm={{ successMessage: 'Cut added', resetOnSuccess: true }}>
        <input name="cut_name" required placeholder="Add variation cut" />
        <Button type="submit">Add cut</Button>
      </form>
    </section>

    <section class="stack">
      <h3>Ratio overrides</h3>
      <p class="muted">These apply to this variation only.</p>
      {#if variationIngredients.length === 0}
        <p class="muted">No overrides yet.</p>
      {:else}
        {#each variationIngredients as row}
          <form method="POST" action="?/upsertRatioOverride" class="ratio-row" use:enhanceForm={{ successMessage: 'Override saved' }}>
            <input type="hidden" name="id" value={row.id} />
            <select name="ingredient_id">
              {#each ingredientCatalog as ingredient}
                <option value={ingredient.id} selected={ingredient.id === row.ingredientId}>{ingredient.name}</option>
              {/each}
            </select>
            <select name="ratio_type">
              <option value="g" selected={row.amountGramsPerBase !== null}>grams/base</option>
              <option value="ml" selected={row.amountGramsPerBase === null}>ml/base</option>
            </select>
            <input
              name="amount"
              type="number"
              step="0.01"
              required
              value={row.amountGramsPerBase ?? row.amountMlPerBase ?? ''}
            />
            <select name="display_unit_override">
              <option value="" selected={row.displayUnitOverride === null}>default ({row.defaultDisplayUnit})</option>
              <option value="g" selected={row.displayUnitOverride === 'g'}>g</option>
              <option value="ml" selected={row.displayUnitOverride === 'ml'}>ml</option>
              <option value="tsp" selected={row.displayUnitOverride === 'tsp'}>tsp</option>
              <option value="tbsp" selected={row.displayUnitOverride === 'tbsp'}>tbsp</option>
            </select>
            <input name="sort_order" type="number" value={row.sort_order} />
            <Button size="sm" type="submit">Save</Button>
            <Button
              size="sm"
              type="submit"
              formaction="?/deleteRatioOverride"
              on:click={openDeleteConfirm}
            >
              Delete
            </Button>
          </form>
        {/each}
      {/if}
      <form method="POST" action="?/upsertRatioOverride" class="stack" use:enhanceForm={{ successMessage: 'Override added', resetOnSuccess: true }}>
        <h4>Add override</h4>
        <div class="grid-4">
          <label>
            Existing ingredient
            <select name="ingredient_id">
              <option value="">Create inline below</option>
              {#each ingredientCatalog as ingredient}
                <option value={ingredient.id}>{ingredient.name}</option>
              {/each}
            </select>
          </label>
          <label>
            New ingredient name
            <input name="new_ingredient_name" />
          </label>
          <label>
            New ingredient unit
            <select name="new_ingredient_unit">
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
        <div class="grid-3">
          <select name="ratio_type">
            <option value="g">grams/base</option>
            <option value="ml">ml/base</option>
          </select>
          <input name="amount" type="number" step="0.01" required placeholder="Amount per base" />
          <select name="display_unit_override">
            <option value="">default</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="tsp">tsp</option>
            <option value="tbsp">tbsp</option>
          </select>
        </div>
        <Button type="submit">Add override</Button>
      </form>
    </section>
  </details>
{/if}

<ConfirmDialog
  bind:open={showDeleteDialog}
  title="Confirm delete"
  message="This destructive action cannot be undone."
  confirmLabel="Delete"
  danger={true}
  onConfirm={() => {
    if (deleteForm && deleteSubmitter) deleteForm.requestSubmit(deleteSubmitter);
  }}
/>

<style>
  .variation-head {
    position: sticky;
    top: var(--space-3);
    z-index: 20;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(5px);
  }

  .head-main {
    display: grid;
    gap: var(--space-1);
  }

  .head-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .head-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .inline {
    display: inline;
  }

  .section-head {
    display: grid;
    gap: var(--space-1);
  }

  .checklist {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-2);
  }

  .checklist li {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: #fff;
    padding: var(--space-2) var(--space-3);
  }

  .checklist label {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: var(--space-2);
  }

  .name {
    font-weight: 650;
    color: var(--text);
  }

  .amount {
    font-variant-numeric: tabular-nums;
  }

  .note-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chips button {
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #fff;
    font-size: 0.85rem;
  }

  .chips button.active {
    background: var(--primary-soft);
    border-color: var(--primary);
    color: var(--primary);
    font-weight: 700;
  }

  .chips button.clear {
    color: var(--muted);
  }

  .notes-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }

  .notes-list li {
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: #fff;
    display: grid;
    gap: var(--space-2);
  }

  details summary {
    cursor: pointer;
    font-weight: 700;
  }

  .grid-4 {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .grid-3 {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .inline-list {
    display: grid;
    list-style: none;
    gap: var(--space-2);
    padding: 0;
    margin: 0;
  }

  .inline-list li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .inline-add {
    display: flex;
    gap: var(--space-2);
    align-items: end;
    flex-wrap: wrap;
  }

  .inline-add input {
    flex: 1 1 240px;
  }

  .ratio-row {
    display: grid;
    gap: var(--space-2);
    grid-template-columns: 2fr repeat(4, minmax(90px, 1fr)) auto auto;
    align-items: end;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .small {
    font-size: 0.78rem;
  }

  @media (max-width: 1050px) {
    .grid-4,
    .grid-3,
    .ratio-row {
      grid-template-columns: 1fr;
    }

    .checklist label {
      grid-template-columns: auto 1fr;
    }
  }

  @media (max-width: 900px) {
    .variation-head {
      position: static;
    }
  }
</style>
