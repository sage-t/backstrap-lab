<script lang="ts">
  import RecipeEditor from '$lib/components/RecipeEditor.svelte';
  let { data, form } = $props();
</script>

<RecipeEditor action="?/create" recipe={data.recipe} submitLabel="Create recipe" />

<section class="card stack">
  <h2>Import from text (AI)</h2>
  <p>Paste your notes or recipe text. The app will parse to a reviewable draft before saving.</p>
  <form method="POST" action="?/importText" class="stack">
    <label>
      Recipe text
      <textarea
        name="recipe_text"
        required
        placeholder="Paste recipe text from your notes here..."
        style="min-height: 180px;"
      ></textarea>
    </label>
    <button class="primary" type="submit">Import draft</button>
  </form>

  {#if form?.message}
    <p class={form.success ? '' : 'warning'}>{form.message}</p>
  {/if}

  {#if form?.imported}
    <div class="card stack">
      <h3>Imported draft preview</h3>
      <p><strong>Title:</strong> {form.imported.title}</p>
      <p><strong>Base meat:</strong> {form.imported.baseMeatGrams}g</p>
      {#if form.imported.meatWeightBasis === 'estimated_from_description'}
        <p class="warning"><strong>Estimated weight:</strong> {form.imported.meatWeightNote || 'Estimated from meat description.'}</p>
      {/if}
      {#if form.imported.baseAnimal}
        <p><strong>Animal:</strong> {form.imported.baseAnimal}</p>
      {/if}
      <p><strong>Cuts:</strong> {form.imported.cuts.join(', ') || 'none'}</p>
      <p><strong>Tags:</strong> {form.imported.tags.join(', ') || 'none'}</p>

      <h4>Ingredients</h4>
      <ul>
        {#each form.imported.ingredients as ingredient}
          <li>
            {ingredient.name}:
            {#if ingredient.amountGramsPerBase !== null}
              {ingredient.amountGramsPerBase} g/base
            {:else}
              {ingredient.amountMlPerBase} ml/base
            {/if}
          </li>
        {/each}
      </ul>

      <form method="POST" action="?/createFromImport">
        <input type="hidden" name="imported_json" value={form.importedJson} />
        <button class="primary" type="submit">Save imported recipe</button>
      </form>
    </div>
  {/if}
</section>
