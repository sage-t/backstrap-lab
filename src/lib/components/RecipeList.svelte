<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import Badge from '$lib/ui/Badge.svelte';

  type RecipeNavRow = {
    id: number;
    title: string;
    updated_at: string;
    last_cooked_at: string | null;
    variation_count: number;
  };

  let {
    recipes = [],
    q = ''
  }: {
    recipes: RecipeNavRow[];
    q: string;
  } = $props();

  let search = $state('');
  let activeIndex = $state(0);
  let debounceHandle: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    search = q;
  });

  const activeRecipeId = $derived(Number(page.url.pathname.split('/')[2] ?? 0));
  const filtered = $derived.by(() => {
    const term = search.trim().toLowerCase();
    if (!term) return recipes;
    return recipes.filter((recipe) => recipe.title.toLowerCase().includes(term));
  });

  $effect(() => {
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(() => {
      const current = page.url.searchParams.get('q') ?? '';
      if (search.trim() === current.trim()) return;
      const next = search.trim();
      const path = page.url.pathname || '/';
      goto(next ? `${path}?q=${encodeURIComponent(next)}` : path, {
        keepFocus: true,
        noScroll: true,
        replaceState: true,
        invalidateAll: false
      });
    }, 260);
  });

  $effect(() => {
    activeIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));
  });

  const onSearchKeydown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(filtered.length - 1, 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      return;
    }
    if (event.key === 'Enter' && filtered.length > 0) {
      event.preventDefault();
      const target = filtered[activeIndex];
      if (target) goto(`/recipes/${target.id}`);
    }
  };

  function highlight(text: string, term: string): string {
    const clean = term.trim();
    if (!clean) return escapeHtml(text);
    const escapedTerm = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escapedTerm})`, 'ig');
    return escapeHtml(text).replace(re, '<mark class=\"hit\">$1</mark>');
  }

  function escapeHtml(text: string): string {
    const quote = '\"';
    const apostrophe = String.fromCharCode(39);
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll(quote, '&quot;')
      .replaceAll(apostrophe, '&#039;');
  }

  function formatDate(value: string | null): string {
    if (!value) return 'Never cooked';
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
</script>

<div class="card stack nav-shell">
  <header class="nav-header">
    <h2>Recipes</h2>
    <a class="btn-link primary" href="/recipes/new" aria-label="Create new recipe">New Recipe</a>
  </header>

  <label class="search-field" for="recipe-search">
    <span class="visually-hidden">Search recipes</span>
    <input
      id="recipe-search"
      bind:value={search}
      placeholder="Search recipes..."
      autocomplete="off"
      spellcheck="false"
      onkeydown={onSearchKeydown}
    />
  </label>

  <nav class="list" aria-label="Recipe list">
    {#if filtered.length === 0}
      <section class="empty">
        <h3>No recipes yet</h3>
        <p class="muted">
          Start your first recipe to build variation history and compare cooks over time.
        </p>
        <a href="/recipes/new" class="btn-link primary">Create Your First Recipe</a>
      </section>
    {:else}
      {#each filtered as recipe, index (recipe.id)}
        <a
          class={`item ${activeRecipeId === recipe.id ? 'is-active' : ''} ${index === activeIndex ? 'is-keyboard' : ''}`}
          href={`/recipes/${recipe.id}`}
          onmouseenter={() => (activeIndex = index)}
        >
          <p class="title">{@html highlight(recipe.title, search)}</p>
          <div class="meta">
            <span>{formatDate(recipe.last_cooked_at)}</span>
            <Badge>{recipe.variation_count} variation{recipe.variation_count === 1 ? '' : 's'}</Badge>
          </div>
        </a>
      {/each}
    {/if}
  </nav>

  <footer class="admin-links">
    <a href="/admin/ingredients">Ingredients</a>
    <a href="/admin/conversions">Conversions</a>
    <a href="/admin/seed">Seed</a>
  </footer>
</div>

<style>
  .nav-shell {
    gap: var(--space-3);
  }

  .nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .search-field input {
    background: var(--panel-soft);
    padding-left: 36px;
    background-image: radial-gradient(circle at 14px 14px, #8da1b6 0 1.4px, transparent 1.5px);
  }

  .list {
    display: grid;
    gap: var(--space-2);
    max-height: min(66vh, 620px);
    overflow: auto;
    padding-right: var(--space-1);
  }

  .item {
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: #fff;
    display: grid;
    gap: var(--space-2);
    transition: border-color 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
  }

  .item:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }

  .is-active {
    border-color: var(--primary);
    box-shadow: inset 0 0 0 1px var(--primary);
    background: #f7fefc;
  }

  .is-keyboard {
    box-shadow: var(--focus);
  }

  .title {
    font-weight: 700;
    font-size: 0.96rem;
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    color: var(--muted);
    font-size: 0.8rem;
  }

  .empty {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--panel-soft);
  }

  .admin-links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-size: 0.85rem;
    color: var(--muted);
  }

  :global(mark.hit) {
    background: #fde68a;
    color: inherit;
    border-radius: 3px;
    padding: 0 2px;
  }
</style>
