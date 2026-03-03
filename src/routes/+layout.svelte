<script lang="ts">
  import '../app.css';
  import { navigating } from '$app/state';
  import RecipeList from '$lib/components/RecipeList.svelte';
  import ToastViewport from '$lib/ui/ToastViewport.svelte';
  import Skeleton from '$lib/ui/Skeleton.svelte';

  let { data, children } = $props();
</script>

<div class="app-shell">
  <aside class="sidebar">
    {#if data.user}
      <div class="card user-chip">
        <p class="muted">Signed in</p>
        <p class="identity">{data.user.email ?? data.user.id}</p>
        <p class="muted units-line">
          Units:
          {data.measurementPrefs.weightPreference === 'imperial_lb_oz' ? 'lb+oz' : 'g'}
          /
          {data.measurementPrefs.volumePreference === 'kitchen_us' ? 'cups+tbsp+tsp' : 'ml'}
          · <a href="/settings">change</a>
        </p>
      </div>
    {/if}
    <RecipeList recipes={data.recipes} q={data.q} />
  </aside>
  <main class="content">
    {#if navigating.to}
      <section class="card stack load-shell" aria-label="Loading">
        <Skeleton width="35%" height="24px" />
        <Skeleton width="100%" height="16px" />
        <Skeleton width="100%" height="16px" />
        <Skeleton width="78%" height="16px" />
      </section>
    {/if}
    <div class="page-content">
      {@render children()}
    </div>
  </main>
</div>

<ToastViewport />

<style>
  .app-shell {
    min-height: 100dvh;
    display: grid;
    grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
    gap: var(--space-4);
    padding: var(--space-4);
  }

  .sidebar {
    position: sticky;
    top: var(--space-4);
    align-self: start;
    max-height: calc(100dvh - var(--space-8));
    overflow: auto;
    padding-right: var(--space-1);
  }

  .content {
    min-width: 0;
    display: grid;
    gap: var(--space-4);
    align-content: start;
  }

  .user-chip {
    margin-bottom: var(--space-3);
    padding: var(--space-3);
    gap: var(--space-1);
    background: linear-gradient(135deg, #f9fffd, #f8fbff);
  }

  .identity {
    font-weight: 700;
    font-size: 0.9rem;
  }

  .units-line {
    font-size: 0.8rem;
  }

  .load-shell {
    opacity: 0.7;
  }

  .page-content {
    display: grid;
    gap: var(--space-4);
    animation: fade-in 0.16s ease;
  }

  @keyframes fade-in {
    from {
      opacity: 0.75;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 900px) {
    .app-shell {
      grid-template-columns: 1fr;
      padding: var(--space-2);
    }

    .sidebar {
      position: static;
      max-height: none;
      padding-right: 0;
    }
  }
</style>
