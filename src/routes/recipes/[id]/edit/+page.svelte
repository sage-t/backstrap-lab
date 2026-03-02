<script lang="ts">
  import RecipeEditor from '$lib/components/RecipeEditor.svelte';
  let { data } = $props();
</script>

<RecipeEditor action="?/save" recipe={data.recipe} submitLabel="Save and return" />
