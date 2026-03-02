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

<section class="card stack">
  <h1>{data.recipe.title}</h1>
  {#if data.recipe.description}
    <p>{data.recipe.description}</p>
  {/if}
  <p>
    Base meat: <strong>{data.recipe.baseMeatGrams}g</strong>
    {#if data.recipe.baseAnimal}
      ({data.recipe.baseAnimal})
    {/if}
  </p>
  <p>Tags: {data.recipe.tags.join(', ') || 'none'}</p>
  <p>
    Community rating:
    {#if data.rating.count > 0}
      <strong>{data.rating.average?.toFixed(2)}</strong>/5 from {data.rating.count} ratings
    {:else}
      no ratings yet
    {/if}
  </p>
  {#if data.canRateRecipe}
    <form method="POST" action="?/rateRecipe" class="rating-form">
      <label>
        Your rating
        <select name="rating" required>
          <option value="" disabled selected={data.rating.myRating === null}>Pick</option>
          <option value="1" selected={data.rating.myRating === 1}>1</option>
          <option value="2" selected={data.rating.myRating === 2}>2</option>
          <option value="3" selected={data.rating.myRating === 3}>3</option>
          <option value="4" selected={data.rating.myRating === 4}>4</option>
          <option value="5" selected={data.rating.myRating === 5}>5</option>
        </select>
      </label>
      <button type="submit">Save rating</button>
    </form>
  {/if}
</section>

{#if form?.message}
  <section class="card stack">
    <p class={form.success ? '' : 'warning'}>{form.message}</p>
  </section>
{/if}

{#if data.canEditRecipe}
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
{:else}
  <section class="card stack">
    <h2>Cuts</h2>
    <p>{data.cuts.map((cut) => cut.cut_name).join(', ') || 'none'}</p>
    <h2>Ingredient ratios</h2>
    <ul>
      {#each data.recipeIngredients as ingredient}
        <li>
          {ingredient.name}:
          {#if ingredient.amount_grams_per_base !== null}
            {ingredient.amount_grams_per_base} g/base
          {:else}
            {ingredient.amount_ml_per_base} ml/base
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

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
</section>

<VariationsList variations={data.variations} allowDelete={data.canDeleteRecipe} />
<VariationTree variations={data.variations} />

<style>
  .rating-form {
    display: flex;
    gap: 0.5rem;
    align-items: end;
    flex-wrap: wrap;
  }
</style>
