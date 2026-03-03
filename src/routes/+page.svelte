<script lang="ts">
  import Badge from '$lib/ui/Badge.svelte';
  import Button from '$lib/ui/Button.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';

  let { data, form } = $props();
</script>

<section class="card hero stack">
  <div class="hero-top">
    <Badge tone="primary">Backstrap Lab</Badge>
    <h1>Dial in your best wild game cook, then outdo it next run.</h1>
    <p class="muted">
      Capture canonical recipe ratios, spin variations, track notes, and let scaling stay mathematically consistent.
    </p>
  </div>
  <div class="hero-actions">
    <a class="btn-link primary" href="/recipes/new">Create Recipe</a>
    <a class="btn-link" href="/admin/conversions">Tune Ingredient Densities</a>
  </div>
</section>

<section class="card stack">
  <header class="section-head">
    <h2>Quick Start</h2>
    <p class="muted">Create a draft recipe now, then fill in ratios and cuts in the workspace.</p>
  </header>

  <form method="POST" action="?/create" class="quick-create" use:enhanceForm={{ successMessage: 'Recipe created' }}>
    <label for="quick-title" class="visually-hidden">Recipe title</label>
    <input id="quick-title" name="title" placeholder="e.g. Venison jalapeño cheddar sausage" required />
    <Button variant="primary" type="submit">Create</Button>
  </form>

  {#if form?.message}
    <p class={form.success ? 'muted' : 'warning'}>{form.message}</p>
  {/if}

  {#if data.recipes.length === 0}
    <div class="empty-state">
      <p>No recipes yet. Build your first ratio model and start branching variations.</p>
      <a href="/recipes/new" class="btn-link primary">Create First Recipe</a>
    </div>
  {:else}
    <ul class="recent-list">
      {#each data.recipes.slice(0, 6) as recipe}
        <li><a href={`/recipes/${recipe.id}`}>{recipe.title}</a></li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .hero {
    background: linear-gradient(140deg, #f8fffd, #f7fbff);
  }

  .hero-top {
    display: grid;
    gap: var(--space-3);
    max-width: 66ch;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .section-head {
    display: grid;
    gap: var(--space-2);
  }

  .quick-create {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .quick-create input {
    flex: 1 1 280px;
  }

  .empty-state {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    border: 1px dashed var(--border-strong);
    background: var(--panel-soft);
  }

  .recent-list {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: var(--space-2);
  }
</style>
