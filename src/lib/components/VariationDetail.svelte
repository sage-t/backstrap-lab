<script lang="ts">
  import type { ScaledIngredient } from '$lib/scaling';

  let {
    variation,
    scaled,
    recipeCuts,
    variationCuts,
    notes
  }: {
    variation: {
      id: number;
      recipeId: number;
      recipeTitle: string;
      baseMeatGrams: number;
      baseAnimal: string;
      cookedAt: string;
      meatGrams: number;
      animalOverride: string;
    };
    scaled: ScaledIngredient[];
    recipeCuts: Array<{ id: number; cut_name: string }>;
    variationCuts: Array<{ id: number; cut_name: string }>;
    notes: Array<{ id: number; note_text: string; rating: number | null; created_at: string }>;
  } = $props();
</script>

<section class="card stack">
  <h1>{variation.recipeTitle} variation</h1>
  <p>
    Base: {variation.baseMeatGrams}g
    {#if variation.baseAnimal}({variation.baseAnimal}){/if}
  </p>

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
    <button type="submit" class="primary">Update variation</button>
  </form>
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

<section class="card stack">
  <h2>Cuts</h2>
  <p>Recipe cuts: {recipeCuts.map((c) => c.cut_name).join(', ') || 'none'}</p>
  <ul>
    {#each variationCuts as cut}
      <li>
        {cut.cut_name}
        <form method="POST" action="?/deleteCut" style="display:inline">
          <input type="hidden" name="cut_id" value={cut.id} />
          <button type="submit">remove</button>
        </form>
      </li>
    {/each}
  </ul>
  <form method="POST" action="?/addCut">
    <input name="cut_name" required placeholder="Add variation cut" />
    <button type="submit">Add cut</button>
  </form>
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
