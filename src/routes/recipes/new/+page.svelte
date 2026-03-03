<script lang="ts">
  import RecipeEditor from '$lib/components/RecipeEditor.svelte';
  import Tabs from '$lib/ui/Tabs.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';
  import {
    formatRatioPerBase,
    formatWeightFromGrams
  } from '$lib/measurement';

  let { data, form } = $props();
  let activeTab = $state<'manual' | 'import'>('manual');
</script>

<section class="card stack">
  <header class="stack">
    <Badge tone="primary">New Recipe</Badge>
    <h1>Create a ratio model</h1>
    <p class="muted">Start from scratch or import your rough notes and review before saving.</p>
  </header>

  <Tabs
    bind:active={activeTab}
    items={[
      { id: 'manual', label: 'Manual' },
      { id: 'import', label: 'Import from text' }
    ]}
  />

  {#if activeTab === 'manual'}
    <RecipeEditor action="?/create" recipe={data.recipe} submitLabel="Create recipe" />
  {/if}

  {#if activeTab === 'import'}
    <section class="stack import-shell">
      <form method="POST" action="?/importText" class="stack" use:enhanceForm={{ errorMessage: 'Import failed' }}>
        <label>
          Recipe text
          <textarea
            name="recipe_text"
            required
            placeholder="Paste recipe text from notes, docs, or messages..."
            style="min-height: 220px;"
          ></textarea>
        </label>
        <Button variant="primary" type="submit">Interpret draft</Button>
      </form>

      {#if form?.message}
        <p class={form.success ? 'muted' : 'warning'}>{form.message}</p>
      {/if}

      {#if form?.imported}
        <div class="card stack draft-preview">
          <h3>Imported draft preview</h3>
          <p><strong>Title:</strong> {form.imported.title}</p>
          <p><strong>Base meat:</strong> {formatWeightFromGrams(form.imported.baseMeatGrams, data.measurementPrefs)}</p>
          {#if form.imported.meatWeightBasis === 'estimated_from_description'}
            <p class="warning">
              <strong>Estimated weight:</strong> {form.imported.meatWeightNote || 'Estimated from description.'}
            </p>
          {/if}
          {#if form.imported.baseAnimal}
            <p><strong>Animal:</strong> {form.imported.baseAnimal}</p>
          {/if}
          <p><strong>Cuts:</strong> {form.imported.cuts.join(', ') || 'none'}</p>
          <p><strong>Tags:</strong> {form.imported.tags.join(', ') || 'none'}</p>

          <h4>Ingredients</h4>
          <ul class="ingredients-preview">
            {#each form.imported.ingredients as ingredient}
              <li>
                <span>{ingredient.name}</span>
                <strong>
                  {formatRatioPerBase(
                    ingredient.amountGramsPerBase,
                    ingredient.amountMlPerBase,
                    data.measurementPrefs
                  )}
                </strong>
              </li>
            {/each}
          </ul>

          <form method="POST" action="?/createFromImport" use:enhanceForm={{ successMessage: 'Imported recipe created' }}>
            <input type="hidden" name="imported_json" value={form.importedJson} />
            <Button variant="primary" type="submit">Save imported recipe</Button>
          </form>
        </div>
      {/if}
    </section>
  {/if}
</section>

<style>
  .import-shell {
    padding-top: var(--space-2);
  }

  .draft-preview {
    background: linear-gradient(145deg, #f8fffd, #f8fbff);
  }

  .ingredients-preview {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  .ingredients-preview li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    border-bottom: 1px dashed var(--border);
    padding-bottom: 6px;
  }
</style>
