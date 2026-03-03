<script lang="ts">
  import Badge from '$lib/ui/Badge.svelte';
  import Button from '$lib/ui/Button.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';

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
      volume_ratio_uses: number;
    }>;
  } = $props();

  const hasWarning = (row: { grams_per_ml: number | null; grams_per_tsp: number | null; volume_ratio_uses: number }) =>
    row.volume_ratio_uses > 0 && row.grams_per_ml === null && row.grams_per_tsp === null;
</script>

<section class="card stack">
  <header class="header">
    <h1>Ingredient Density Conversions</h1>
    <p class="muted">
      Set either grams per tsp or grams per ml. If either value exists, unit conversions can be computed.
    </p>
  </header>

  {#if rows.length === 0}
    <section class="empty-state">
      <h3>No ingredients found</h3>
      <p class="muted">Create ingredients first, then return here to set density values.</p>
    </section>
  {:else}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Default unit</th>
            <th>g/tsp</th>
            <th>g/ml</th>
            <th>Source note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr class:warn={hasWarning(row)}>
              <td>
                <div class="name-cell">
                  <strong>{row.name}</strong>
                  {#if hasWarning(row)}
                    <Badge tone="warning">Missing density ({row.volume_ratio_uses} volume ratio use{row.volume_ratio_uses === 1 ? '' : 's'})</Badge>
                  {/if}
                </div>
              </td>
              <td>{row.default_display_unit}</td>
              <td colspan="4">
                <form method="POST" action="?/update" class="row-form" use:enhanceForm={{ successMessage: 'Conversion saved' }}>
                  <input type="hidden" name="ingredient_id" value={row.id} />
                  <label>
                    <span class="visually-hidden">grams per tsp</span>
                    <input
                      name="grams_per_tsp"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={row.grams_per_tsp ?? ''}
                      placeholder="e.g. 2.4"
                    />
                  </label>
                  <label>
                    <span class="visually-hidden">grams per ml</span>
                    <input
                      name="grams_per_ml"
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={row.grams_per_ml ?? ''}
                      placeholder="e.g. 0.48"
                    />
                  </label>
                  <label>
                    <span class="visually-hidden">source note</span>
                    <input name="source_note" value={row.source_note ?? ''} placeholder="Label source or estimate" />
                  </label>
                  <Button type="submit" size="sm">Save</Button>
                </form>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <aside class="helper card">
    <p><strong>Examples</strong></p>
    <p class="muted">
      Common ranges: black pepper ~2.2 g/tsp, paprika ~2.3 g/tsp, kosher salt ~5.7 g/tsp.
    </p>
  </aside>
</section>

<style>
  .header {
    display: grid;
    gap: var(--space-2);
  }

  .table-wrap {
    overflow-x: auto;
  }

  .row-form {
    display: grid;
    grid-template-columns: 120px 120px minmax(220px, 1fr) auto;
    gap: var(--space-2);
    align-items: center;
  }

  .name-cell {
    display: grid;
    gap: var(--space-2);
  }

  tr.warn td {
    background: #fffbeb;
  }

  .empty-state {
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--panel-soft);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-2);
  }

  .helper {
    background: linear-gradient(145deg, #f8fbff, #f9fffd);
    padding: var(--space-3);
    border-radius: var(--radius-md);
  }

  @media (max-width: 900px) {
    .row-form {
      grid-template-columns: 1fr;
    }
  }
</style>
