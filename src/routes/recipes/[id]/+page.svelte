<script lang="ts">
  import RecipeEditor from '$lib/components/RecipeEditor.svelte';
  import IngredientRatioEditor from '$lib/components/IngredientRatioEditor.svelte';
  import VariationsList from '$lib/components/VariationsList.svelte';
  import VariationTree from '$lib/components/VariationTree.svelte';

  let { data, form } = $props();

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
    <label>
      Parent variation (optional)
      <select name="parent_variation_id">
        <option value="">None (new root)</option>
        {#each data.variations as variation}
          <option value={variation.id}>
            #{variation.id} {variation.cooked_at.slice(0, 10)} (rating {variation.rating ?? '-'})
          </option>
        {/each}
      </select>
    </label>
    <label>
      Variation rating (optional 1-5)
      <input type="number" min="1" max="5" name="rating" />
    </label>
    <button class="primary" type="submit">Create variation</button>
  </form>
  {#if form?.message}
    <p class="warning">{form.message}</p>
  {/if}
</section>

<VariationsList variations={data.variations} allowDelete={true} />
<VariationTree variations={data.variations} />
