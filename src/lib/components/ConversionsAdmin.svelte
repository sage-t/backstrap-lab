<script lang="ts">
  let {
    rows
  }: {
    rows: Array<{
      id: number;
      name: string;
      default_display_unit: string;
      grams_per_ml: number | null;
      grams_per_tsp: number | null;
      source_note: string | null;
    }>;
  } = $props();
</script>

<section class="card stack">
  <h1>Ingredient density conversions</h1>
  {#each rows as row}
    <form method="POST" action="?/update" class="grid">
      <input type="hidden" name="ingredient_id" value={row.id} />
      <h3>{row.name}</h3>
      <label>
        grams/ml
        <input name="grams_per_ml" type="number" step="0.0001" value={row.grams_per_ml ?? ''} />
      </label>
      <label>
        grams/tsp
        <input name="grams_per_tsp" type="number" step="0.0001" value={row.grams_per_tsp ?? ''} />
      </label>
      <label>
        Source note
        <input name="source_note" value={row.source_note ?? ''} />
      </label>
      <button type="submit">Save</button>
    </form>
  {/each}
</section>

<style>
  .grid {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr 1fr 1fr 1fr auto;
    align-items: end;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--line);
  }

  h3 {
    margin: 0;
    grid-column: 1 / -1;
  }

  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
