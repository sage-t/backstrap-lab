<script lang="ts">
  import RecipeEditor from '$lib/components/RecipeEditor.svelte';
  let { data } = $props();
</script>

<RecipeEditor action="?/create" recipe={data.recipe} submitLabel="Create recipe" />
