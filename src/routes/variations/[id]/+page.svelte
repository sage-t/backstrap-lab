<script lang="ts">
  import VariationDetail from '$lib/components/VariationDetail.svelte';
  let { data, form } = $props();
</script>

<VariationDetail
  variation={data.variation}
  scaled={data.scaled}
  recipeCuts={data.recipeCuts}
  variationCuts={data.variationCuts}
  notes={data.notes}
  variationIngredients={data.variationIngredients}
  ingredientCatalog={data.ingredientCatalog}
  canEditVariation={data.canEditVariation}
  canDeleteVariation={data.canDeleteVariation}
/>

{#if form?.message}
  <section class="card stack">
    <p class="warning">{form.message}</p>
  </section>
{/if}
