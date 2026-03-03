<script lang="ts">
  import Badge from '$lib/ui/Badge.svelte';
  import Button from '$lib/ui/Button.svelte';
  import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';

  let {
    variations,
    allowDelete = false
  }: {
    variations: Array<{
      id: number;
      cooked_at: string;
      meat_grams: number;
      animal_override: string | null;
      parent_variation_id: number | null;
      rating: number | null;
      note_count: number;
    }>;
    allowDelete?: boolean;
  } = $props();

  let showDeleteDialog = $state(false);
  let deleteForm: HTMLFormElement | null = null;
  let deleteSubmitter: HTMLButtonElement | null = null;

  const openDeleteConfirm = (event: MouseEvent) => {
    event.preventDefault();
    deleteSubmitter = event.currentTarget as HTMLButtonElement;
    deleteForm = deleteSubmitter.form;
    showDeleteDialog = true;
  };
</script>

<section class="card stack">
  <header class="section-head">
    <h2>Variations</h2>
    <p class="muted">Log each cook as a branch and compare outcomes over time.</p>
  </header>

  {#if variations.length === 0}
    <section class="empty-state">
      <h3>No variations yet</h3>
      <p class="muted">Create your first run to see scaled ingredients and collect tasting notes.</p>
    </section>
  {:else}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Meat</th>
            <th>Animal</th>
            <th>Rating</th>
            <th>Parent</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each variations as row}
            <tr>
              <td>{row.cooked_at.slice(0, 10)}</td>
              <td>{row.meat_grams}g</td>
              <td>{row.animal_override ?? '-'}</td>
              <td>
                {#if row.rating === null}
                  <span class="muted">-</span>
                {:else}
                  <Badge tone="primary">{row.rating}/5</Badge>
                {/if}
              </td>
              <td>{row.parent_variation_id ?? '-'}</td>
              <td>{row.note_count}</td>
              <td class="actions">
                <a href={`/variations/${row.id}`} class="btn-link">Open</a>
                {#if allowDelete}
                  <form method="POST" action="?/deleteVariation" class="inline" use:enhanceForm={{ successMessage: 'Variation deleted' }}>
                    <input type="hidden" name="variation_id" value={row.id} />
                    <Button size="sm" variant="destructive" type="submit" on:click={openDeleteConfirm}>Delete</Button>
                  </form>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<ConfirmDialog
  bind:open={showDeleteDialog}
  title="Delete variation?"
  message="This removes the variation, notes, cuts, and overrides."
  confirmLabel="Delete variation"
  danger={true}
  onConfirm={() => {
    if (deleteForm && deleteSubmitter) deleteForm.requestSubmit(deleteSubmitter);
  }}
/>

<style>
  .section-head {
    display: grid;
    gap: var(--space-2);
  }

  .empty-state {
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--panel-soft);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-2);
  }

  .table-wrap {
    overflow-x: auto;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .inline {
    display: inline;
  }
</style>
