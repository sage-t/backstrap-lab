<script lang="ts">
  let {
    recipes = [],
    q = ''
  }: {
    recipes: Array<{ id: number; title: string; updated_at: string }>;
    q: string;
  } = $props();
</script>

<div class="card stack">
  <h2>Recipes</h2>
  <form method="GET" action="/" class="stack">
    <input name="q" placeholder="Search recipes" value={q} />
    <button type="submit">Search</button>
  </form>
  <a href="/recipes/new"><button class="primary" type="button">New recipe</button></a>
  <nav class="list">
    {#if recipes.length === 0}
      <p class="warning">No recipes found.</p>
    {:else}
      {#each recipes as recipe}
        <a class="item" href={`/recipes/${recipe.id}`}>{recipe.title}</a>
      {/each}
    {/if}
  </nav>
  <div class="admin-links">
    <a href="/admin/ingredients">Ingredients</a>
    <a href="/admin/conversions">Conversions</a>
    <a href="/admin/seed">Seed</a>
  </div>
</div>

<style>
  .list {
    display: grid;
    gap: 0.35rem;
  }

  .item {
    padding: 0.5rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #fff;
  }

  .admin-links {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    color: var(--muted);
    font-size: 0.9rem;
  }
</style>
