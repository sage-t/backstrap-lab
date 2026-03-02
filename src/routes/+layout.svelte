<script lang="ts">
  import '../app.css';
  import RecipeList from '$lib/components/RecipeList.svelte';

  let { data, children } = $props();
</script>

<div class="app-shell">
  <aside class="sidebar">
    <RecipeList recipes={data.recipes} q={data.q} />
  </aside>
  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1rem;
    padding: 1rem;
  }

  .sidebar {
    position: sticky;
    top: 1rem;
    align-self: start;
    max-height: calc(100vh - 2rem);
    overflow: auto;
  }

  .content {
    min-width: 0;
    display: grid;
    gap: 1rem;
    align-content: start;
  }

  @media (max-width: 900px) {
    .app-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: static;
      max-height: none;
    }
  }
</style>
