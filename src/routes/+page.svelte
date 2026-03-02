<script lang="ts">
  let { data, form } = $props();
</script>

<section class="card stack">
  <h1>Backstrap Lab</h1>
  <p>Track wild game recipes, run variations, and auto-scale ingredients by meat weight.</p>
  <div>
    <a href="/recipes/new"><button class="primary">Create full recipe</button></a>
  </div>
</section>

<section class="card stack">
  <h2>Quick create</h2>
  <form method="POST" action="?/create" class="quick-create">
    <input name="title" placeholder="Recipe title" required />
    <button class="primary" type="submit">Create</button>
  </form>
  {#if form?.message}
    <p class="warning">{form.message}</p>
  {/if}
  <ul>
    {#each data.recipes as recipe}
      <li><a href={`/recipes/${recipe.id}`}>{recipe.title}</a></li>
    {/each}
  </ul>
</section>

<style>
  .quick-create {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  ul {
    margin: 0;
    padding-left: 1rem;
  }
</style>
