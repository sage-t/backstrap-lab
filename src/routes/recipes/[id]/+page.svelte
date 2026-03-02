<script lang="ts">
  import RecipeEditor from '$lib/components/RecipeEditor.svelte';
  import IngredientRatioEditor from '$lib/components/IngredientRatioEditor.svelte';
  import VariationsList from '$lib/components/VariationsList.svelte';

  let { data } = $props();

  const confirmDelete = (event: SubmitEvent, message: string) => {
    if (!confirm(message)) event.preventDefault();
  };
</script>

<RecipeEditor action="?/updateRecipe" recipe={data.recipe} submitLabel="Save recipe" />

<section class="card stack">
  <p class="warning">
    Changing base meat grams auto-scales all recipe ingredient per-base amounts to preserve concentration.
  </p>
  <form
    method="POST"
    action="?/deleteRecipe"
    onsubmit={(event) => confirmDelete(event, 'Delete this recipe and all its variations?')}
  >
    <button type="submit">Delete recipe</button>
  </form>
</section>

<section class="card stack">
  <h2>Cuts</h2>
  <ul>
    {#each data.cuts as cut}
      <li>
        {cut.cut_name}
        <form
          method="POST"
          action="?/deleteCut"
          style="display:inline"
          onsubmit={(event) => confirmDelete(event, 'Delete this cut?')}
        >
          <input type="hidden" name="cut_id" value={cut.id} />
          <button type="submit">remove</button>
        </form>
      </li>
    {/each}
  </ul>
  <form method="POST" action="?/addCut" class="stack">
    <input name="cut_name" required placeholder="loin, backstrap" />
    <button type="submit">Add cut</button>
  </form>
</section>

<IngredientRatioEditor
  ingredients={data.ingredientCatalog}
  recipeId={data.recipe.id}
  recipeIngredients={data.recipeIngredients}
/>

<section class="card stack">
  <h2>New variation</h2>
  <form method="POST" action="?/createVariation" class="stack">
    <label>
      Cooked at
      <input type="date" name="cooked_at" value={data.today} required />
    </label>
    <label>
      Meat grams
      <input type="number" min="1" name="meat_grams" value={data.recipe.baseMeatGrams} required />
    </label>
    <label>
      Animal override
      <input name="animal_override" placeholder={data.recipe.baseAnimal || 'optional'} />
    </label>
    <button class="primary" type="submit">Create variation</button>
  </form>
</section>

<VariationsList variations={data.variations} allowDelete={true} />
