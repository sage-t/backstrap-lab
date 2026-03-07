<script lang="ts">
  import Button from '$lib/ui/Button.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';

  let { data, form } = $props();
</script>

<section class="card stack">
  <header class="stack">
    <h1>Ingredients</h1>
    <p class="muted">Create ingredient names once, then reuse them across recipes and variation overrides.</p>
  </header>

  <form method="POST" action="?/create" class="stack create-form" use:enhanceForm={{ successMessage: 'Ingredient created', resetOnSuccess: true }}>
    <div class="grid-2">
      <label>
        Name
        <input name="name" required placeholder="e.g. juniper berry powder" />
      </label>
      <label>
        Default display unit
        <select name="default_display_unit">
          <option value="g">g</option>
          <option value="lb">lb (stored as g)</option>
          <option value="oz">oz (stored as g)</option>
          <option value="ml">ml</option>
          <option value="tsp">tsp</option>
          <option value="tbsp">tbsp</option>
        </select>
      </label>
    </div>
    <div>
      <Button variant="primary" type="submit">Create ingredient</Button>
    </div>
  </form>

  {#if form?.message}
    <p class={form.success ? 'muted' : 'warning'}>{form.message}</p>
  {/if}

  {#if data.ingredients.length === 0}
    <div class="empty-state">
      <p class="muted">No ingredients yet.</p>
    </div>
  {:else}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>Name</th><th>Default unit</th><th></th></tr>
        </thead>
        <tbody>
          {#each data.ingredients as ingredient}
            <tr>
              <td>{ingredient.name}</td>
              <td>
                <form method="POST" action="?/updateUnit" class="inline" use:enhanceForm={{ successMessage: 'Default unit updated' }}>
                  <input type="hidden" name="ingredient_id" value={ingredient.id} />
                  <select name="default_display_unit">
                    <option value="g" selected={ingredient.default_display_unit === 'g'}>g</option>
                    <option value="lb">lb (stored as g)</option>
                    <option value="oz">oz (stored as g)</option>
                    <option value="ml" selected={ingredient.default_display_unit === 'ml'}>ml</option>
                    <option value="tsp" selected={ingredient.default_display_unit === 'tsp'}>tsp</option>
                    <option value="tbsp" selected={ingredient.default_display_unit === 'tbsp'}>tbsp</option>
                  </select>
                  <Button size="sm" type="submit">Save</Button>
                </form>
              </td>
              <td><a href="/admin/conversions" class="muted">edit densities</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .grid-2 {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .table-wrap {
    overflow-x: auto;
  }

  .inline {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .empty-state {
    padding: var(--space-4);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--panel-soft);
  }

  @media (max-width: 900px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
</style>
