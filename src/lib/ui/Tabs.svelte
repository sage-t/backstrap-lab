<script lang="ts">
  let {
    items,
    active = $bindable('')
  }: {
    items: Array<{ id: string; label: string }>;
    active?: string;
  } = $props();

  $effect(() => {
    if (!active && items.length > 0) active = items[0].id;
  });
</script>

<nav class="tabs" aria-label="Sections">
  {#each items as item}
    <button
      type="button"
      class:active={active === item.id}
      role="tab"
      aria-selected={active === item.id}
      on:click={() => (active = item.id)}
    >
      {item.label}
    </button>
  {/each}
</nav>

<style>
  .tabs {
    display: flex;
    gap: var(--space-2);
    border-bottom: 1px solid var(--border);
    padding-bottom: var(--space-2);
    overflow-x: auto;
  }

  .tabs button {
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    color: var(--muted);
    white-space: nowrap;
  }

  .tabs button.active {
    background: var(--panel-soft);
    color: var(--text);
    font-weight: 700;
  }
</style>
