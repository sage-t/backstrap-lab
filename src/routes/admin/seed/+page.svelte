<script lang="ts">
  let { data, form } = $props();
</script>

<section class="card stack">
  <h1>Seed data</h1>
  <p>This inserts baseline ingredients, default conversions, one sample recipe, and one variation.</p>

  {#if data.isLocalHost}
    <form method="POST" action="?/run">
      <button class="primary" type="submit">Run local seed</button>
    </form>
  {:else}
    <p class="warning">Seed action disabled: only available on localhost.</p>
  {/if}

  {#if form?.message}
    <p>{form.message}</p>
  {/if}
</section>
