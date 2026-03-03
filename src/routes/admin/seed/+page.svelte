<script lang="ts">
  import Button from '$lib/ui/Button.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';

  let { data, form } = $props();
</script>

<section class="card stack">
  <h1>Seed Data</h1>
  <p class="muted">
    Inserts baseline ingredients, conversion defaults, one sample recipe, and one variation.
  </p>

  {#if data.isLocalHost}
    <form method="POST" action="?/run" use:enhanceForm>
      <Button variant="primary" type="submit">Run local seed</Button>
    </form>
  {:else}
    <p class="warning">Seed is disabled outside localhost.</p>
  {/if}

  {#if form?.message}
    <p class={form.success ? 'muted' : 'warning'}>{form.message}</p>
  {/if}
</section>
