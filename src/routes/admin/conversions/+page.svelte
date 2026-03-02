<script lang="ts">
  import ConversionsAdmin from '$lib/components/ConversionsAdmin.svelte';
  let { data } = $props();
</script>

<ConversionsAdmin rows={data.rows} />
