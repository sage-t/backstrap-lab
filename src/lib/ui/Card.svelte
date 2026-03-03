<script lang="ts">
  let {
    title = '',
    description = '',
    class: className = ''
  }: {
    title?: string;
    description?: string;
    class?: string;
  } = $props();
</script>

<section class={`card stack ${className}`}>
  {#if title}
    <header class="card-head">
      <h2>{title}</h2>
      {#if description}<p class="muted">{description}</p>{/if}
    </header>
  {/if}
  <slot />
</section>

<style>
  .card-head {
    display: grid;
    gap: var(--space-2);
  }
</style>
