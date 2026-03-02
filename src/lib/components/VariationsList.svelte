<script lang="ts">
  let {
    variations
  }: {
    variations: Array<{
      id: number;
      cooked_at: string;
      meat_grams: number;
      animal_override: string | null;
      note_count: number;
    }>;
  } = $props();
</script>

<section class="card stack">
  <h2>Variations</h2>
  {#if variations.length === 0}
    <p>No variations yet.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Meat (g)</th>
          <th>Animal</th>
          <th>Notes</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each variations as row}
          <tr>
            <td>{row.cooked_at.slice(0, 10)}</td>
            <td>{row.meat_grams}</td>
            <td>{row.animal_override ?? '-'}</td>
            <td>{row.note_count}</td>
            <td><a href={`/variations/${row.id}`}>Open</a></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    border-bottom: 1px solid var(--line);
    text-align: left;
    padding: 0.4rem;
    font-size: 0.92rem;
  }
</style>
