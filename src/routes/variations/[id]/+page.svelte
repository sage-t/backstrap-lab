<script lang="ts">
  import VariationDetail from '$lib/components/VariationDetail.svelte';
  let { data } = $props();
</script>

<VariationDetail
  variation={data.variation}
  scaled={data.scaled}
  recipeCuts={data.recipeCuts}
  variationCuts={data.variationCuts}
  notes={data.notes}
/>
