<script lang="ts">
  import type { DisplayUnit, ScaledIngredient } from '$lib/scaling';

  let {
    variation,
    scaled,
    recipeCuts,
    variationCuts,
    notes,
    variationIngredients,
    ingredientCatalog,
    canEditVariation,
    canDeleteVariation
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
  } = $props();

  const confirmDelete = (event: SubmitEvent, message: string) => {
    if (!confirm(message)) event.preventDefault();
  };
</script>

<section class="card stack">
  <h1>{variation.recipeTitle} variation</h1>
  <p>
    Base: {variation.baseMeatGrams}g
    {#if variation.baseAnimal}({variation.baseAnimal}){/if}
  </p>
  <p>
    Parent variation: {variation.parentVariationId ?? 'none'} | Rating: {variation.rating ?? '-'}
  </p>
  <p>Recipe revision: {variation.recipeRevisionId}</p>

  {#if canEditVariation}
    <form method="POST" action="?/updateVariation" class="stack">
      <label>
        Cooked at
        <input type="date" name="cooked_at" value={variation.cookedAt.slice(0, 10)} required />
      </label>
      <label>
        Meat grams
        <input type="number" name="meat_grams" min="1" value={variation.meatGrams} required />
      </label>
      <label>
        Animal override
        <input name="animal_override" value={variation.animalOverride} />
      </label>
      <label>
        Variation rating (optional 1-5)
        <input type="number" min="1" max="5" name="rating" value={variation.rating ?? ''} />
      </label>
      <button type="submit" class="primary">Update variation</button>
    </form>
  {:else}
    <p class="warning">You can view this variation, but only its creator or recipe owner can edit it.</p>
  {/if}

  <form method="POST" action="?/createChildVariation" class="stack">
    <h3>Create child variation</h3>
    <label>
      Cooked at
      <input type="date" name="cooked_at" value={variation.cookedAt.slice(0, 10)} required />
    </label>
    <label>
      Meat grams
      <input type="number" name="meat_grams" min="1" value={variation.meatGrams} required />
    </label>
    <label>
      Animal override
      <input name="animal_override" value={variation.animalOverride} />
    </label>
    <label>
      Rating (optional 1-5)
      <input type="number" min="1" max="5" name="rating" />
    </label>
    <button type="submit">Create child variation</button>
  </form>

  {#if canDeleteVariation}
    <form
      method="POST"
      action="?/deleteVariation"
      onsubmit={(event) => confirmDelete(event, 'Delete this variation?')}
    >
      <button type="submit">Delete variation</button>
    </form>
  {/if}
</section>

<section class="card stack">
  <h2>Scaled ingredients</h2>
  <ul>
    {#each scaled as row}
      <li>
        <strong>{row.ingredientName}:</strong> {row.displayAmount} {row.displayUnit}
        {#if row.warning}
          <span class="warning">({row.warning})</span>
        {/if}
      </li>
    {/each}
  </ul>
</section>

{#if canEditVariation}
  <section class="card stack">
    <h2>Ratio overrides for this variation</h2>
    <p class="warning">These override base recipe ratios for this variation only.</p>

    {#if variationIngredients.length === 0}
      <p>No overrides yet.</p>
    {:else}
      {#each variationIngredients as row}
        <form method="POST" action="?/upsertRatioOverride" class="ratio-row">
          <input type="hidden" name="id" value={row.id} />
          <select name="ingredient_id" value={row.ingredientId}>
            {#each ingredientCatalog as ingredient}
              <option value={ingredient.id}>{ingredient.name}</option>
            {/each}
          </select>
          <select name="ratio_type" value={row.amountGramsPerBase !== null ? 'g' : 'ml'}>
            <option value="g">grams/base</option>
            <option value="ml">ml/base</option>
          </select>
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            value={row.amountGramsPerBase ?? row.amountMlPerBase ?? ''}
          />
          <select name="display_unit_override" value={row.displayUnitOverride ?? ''}>
            <option value="">default ({row.defaultDisplayUnit})</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="tsp">tsp</option>
            <option value="tbsp">tbsp</option>
          </select>
          <input name="sort_order" type="number" value={row.sort_order} />
          <button type="submit">Save</button>
          <button
            type="submit"
            formaction="?/deleteRatioOverride"
            onclick={(event) => {
              if (!confirm('Delete this ratio override?')) event.preventDefault();
            }}>Delete</button
          >
        </form>
      {/each}
    {/if}

    <form method="POST" action="?/upsertRatioOverride" class="stack">
      <h3>Add override</h3>
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
        New ingredient name (if creating)
        <input name="new_ingredient_name" />
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
      <div class="ratio-row add">
        <select name="ratio_type">
          <option value="g">grams/base</option>
          <option value="ml">ml/base</option>
        </select>
        <input name="amount" type="number" step="0.01" required />
        <select name="display_unit_override">
          <option value="">default</option>
          <option value="g">g</option>
          <option value="ml">ml</option>
          <option value="tsp">tsp</option>
          <option value="tbsp">tbsp</option>
        </select>
        <input name="sort_order" type="number" value="10" />
        <button type="submit">Add override</button>
      </div>
    </form>
  </section>
{/if}

<section class="card stack">
  <h2>Cuts</h2>
  <p>Recipe cuts: {recipeCuts.map((c) => c.cut_name).join(', ') || 'none'}</p>
  <ul>
    {#each variationCuts as cut}
      <li>
        {cut.cut_name}
        {#if canEditVariation}
          <form
            method="POST"
            action="?/deleteCut"
            style="display:inline"
            onsubmit={(event) => confirmDelete(event, 'Delete this variation cut?')}
          >
            <input type="hidden" name="cut_id" value={cut.id} />
            <button type="submit">remove</button>
          </form>
        {/if}
      </li>
    {/each}
  </ul>
  {#if canEditVariation}
    <form method="POST" action="?/addCut">
      <input name="cut_name" required placeholder="Add variation cut" />
      <button type="submit">Add cut</button>
    </form>
  {/if}
</section>

<section class="card stack">
  <h2>Notes</h2>
  <form method="POST" action="?/addNote" class="stack">
    <label>
      Note
      <textarea name="note_text" required></textarea>
    </label>
    <label>
      Rating (optional 1-5)
      <input type="number" min="1" max="5" name="rating" />
    </label>
    <button class="primary" type="submit">Add note</button>
  </form>

  <ul>
    {#each notes as note}
      <li>
        <p>{note.note_text}</p>
        <small>{note.created_at.slice(0, 10)} {note.rating ? `| rating ${note.rating}/5` : ''}</small>
      </li>
    {/each}
  </ul>
</section>

<style>
  .ratio-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr 0.7fr auto auto;
    gap: 0.5rem;
    align-items: end;
  }

  .ratio-row.add {
    grid-template-columns: 1fr 1fr 1fr 0.7fr auto;
  }

  @media (max-width: 900px) {
    .ratio-row,
    .ratio-row.add {
      grid-template-columns: 1fr;
    }
  }
</style>
