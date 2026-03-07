<script lang="ts">
  import RecipeEditor from '$lib/components/RecipeEditor.svelte';
  import IngredientRatioEditor from '$lib/components/IngredientRatioEditor.svelte';
  import VariationsList from '$lib/components/VariationsList.svelte';
  import VariationTree from '$lib/components/VariationTree.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Tabs from '$lib/ui/Tabs.svelte';
  import Modal from '$lib/ui/Modal.svelte';
  import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';
  import {
    formatRatioPerBase,
    formatWeightFromGrams
  } from '$lib/measurement';

  let { data, form } = $props();

  let activeTab = $state('overview');
  let showVariationModal = $state(false);
  let showDeleteRecipeDialog = $state(false);
  let showDeleteCutDialog = $state(false);
  let deleteRecipeForm = $state<HTMLFormElement | null>(null);
  let deleteRecipeSubmitter = $state<HTMLButtonElement | null>(null);
  let deleteCutForm = $state<HTMLFormElement | null>(null);
  let deleteCutSubmitter = $state<HTMLButtonElement | null>(null);

  function openDeleteRecipeDialog(event: MouseEvent) {
    event.preventDefault();
    deleteRecipeSubmitter = event.currentTarget as HTMLButtonElement;
    deleteRecipeForm = deleteRecipeSubmitter.form;
    showDeleteRecipeDialog = true;
  }

  function openDeleteCutDialog(event: MouseEvent) {
    event.preventDefault();
    deleteCutSubmitter = event.currentTarget as HTMLButtonElement;
    deleteCutForm = deleteCutSubmitter.form;
    showDeleteCutDialog = true;
  }
</script>

<header class="workspace-header card">
  <div class="workspace-title">
    <h1>{data.recipe.title}</h1>
    <div class="workspace-meta">
      <Badge tone="primary">{formatWeightFromGrams(data.recipe.baseMeatGrams, data.measurementPrefs)} base</Badge>
      {#if data.recipe.baseAnimal}
        <Badge>{data.recipe.baseAnimal}</Badge>
      {/if}
      <Badge>{data.variations.length} variation{data.variations.length === 1 ? '' : 's'}</Badge>
    </div>
  </div>
  <div class="workspace-actions">
    <Button variant="primary" on:click={() => (showVariationModal = true)}>New Variation</Button>
    {#if data.canEditRecipe}
      <Button on:click={() => (activeTab = 'overview')}>Edit</Button>
    {/if}
    {#if data.canDeleteRecipe}
      <form
        method="POST"
        action="?/deleteRecipe"
        bind:this={deleteRecipeForm}
        class="inline"
        use:enhanceForm
      >
        <Button
          variant="destructive"
          type="submit"
          on:click={openDeleteRecipeDialog}
        >
          Delete
        </Button>
      </form>
    {/if}
  </div>
</header>

<section class="card stack">
  <Tabs
    bind:active={activeTab}
    items={[
      { id: 'overview', label: 'Overview' },
      { id: 'ingredients', label: 'Ingredients' },
      { id: 'variations', label: 'Variations' }
    ]}
  />

  {#if activeTab === 'overview'}
    <div class="stack tab-panel">
      {#if data.recipe.description}
        <p>{data.recipe.description}</p>
      {/if}
      <p class="muted">Tags: {data.recipe.tags.join(', ') || 'none'}</p>
      <section class="rating-row">
        <div>
          <h3>Community rating</h3>
          {#if data.rating.count > 0}
            <p><strong>{data.rating.average?.toFixed(2)}</strong>/5 from {data.rating.count} ratings</p>
          {:else}
            <p class="muted">No ratings yet.</p>
          {/if}
        </div>
        {#if data.canRateRecipe}
          <form method="POST" action="?/rateRecipe" class="rating-form" use:enhanceForm={{ successMessage: 'Rating saved' }}>
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
            <Button type="submit">Save</Button>
          </form>
        {/if}
      </section>

      {#if data.canEditRecipe}
        <RecipeEditor action="?/updateRecipe" recipe={data.recipe} submitLabel="Save recipe" />
        <details class="advanced">
          <summary>Advanced options</summary>
          <p class="warning">
            Changing base meat grams auto-scales all recipe ingredient per-base amounts to preserve concentration.
          </p>
          <section class="stack">
            <h3>Cuts</h3>
            <ul class="inline-list">
              {#each data.cuts as cut}
                <li>
                  <Badge>{cut.cut_name}</Badge>
                  <form method="POST" action="?/deleteCut" use:enhanceForm={{ successMessage: 'Cut removed' }}>
                    <input type="hidden" name="cut_id" value={cut.id} />
                    <Button size="sm" type="submit" on:click={openDeleteCutDialog}>Remove</Button>
                  </form>
                </li>
              {/each}
            </ul>
            <form method="POST" action="?/addCut" class="cut-form" use:enhanceForm={{ successMessage: 'Cut added', resetOnSuccess: true }}>
              <input name="cut_name" required placeholder="e.g. loin, backstrap" />
              <Button type="submit">Add Cut</Button>
            </form>
          </section>
        </details>
      {:else}
        <section class="stack">
          <h3>Cuts</h3>
          <p>{data.cuts.map((cut) => cut.cut_name).join(', ') || 'none'}</p>
        </section>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'ingredients'}
    <div class="stack tab-panel">
      {#if data.canEditRecipe}
        <IngredientRatioEditor
          ingredients={data.ingredientCatalog}
          recipeId={data.recipe.id}
          recipeIngredients={data.recipeIngredients}
          recipeBaseMeatGrams={data.recipe.baseMeatGrams}
          measurementPrefs={data.measurementPrefs}
        />
      {:else}
        <section class="stack">
          <h3>Ingredient ratios</h3>
          <ul class="plain-list">
            {#each data.recipeIngredients as ingredient}
              <li>
                {ingredient.name}:
                {formatRatioPerBase(
                  ingredient.amount_grams_per_base,
                  ingredient.amount_ml_per_base,
                  ingredient.amount_units_per_base,
                  data.measurementPrefs
                )}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'variations'}
    <div class="stack tab-panel">
      <VariationsList
        variations={data.variations}
        allowDelete={data.canDeleteRecipe}
        measurementPrefs={data.measurementPrefs}
      />
      <VariationTree variations={data.variations} />
    </div>
  {/if}
</section>

<Modal bind:open={showVariationModal} title="Create variation">
  <form
    method="POST"
    action="?/createVariation"
    class="stack"
    use:enhanceForm={{ successMessage: 'Variation created' }}
  >
    <label>
      Cooked at
      <input type="date" name="cooked_at" value={data.today} required />
    </label>
    <label>
      Meat grams
      <input type="number" min="1" name="meat_grams" value={data.recipe.baseMeatGrams} required />
      <span class="muted small">Equivalent to {formatWeightFromGrams(data.recipe.baseMeatGrams, data.measurementPrefs)}</span>
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
          <option value={variation.id}>#{variation.id} {variation.cooked_at.slice(0, 10)}</option>
        {/each}
      </select>
    </label>
    <label>
      Initial rating (optional 1-5)
      <input type="number" min="1" max="5" name="rating" />
    </label>
    <div class="modal-actions">
      <Button on:click={() => (showVariationModal = false)}>Cancel</Button>
      <Button variant="primary" type="submit">Create variation</Button>
    </div>
  </form>
</Modal>

<ConfirmDialog
  bind:open={showDeleteRecipeDialog}
  title="Delete recipe?"
  message="This removes the recipe, all revisions, and all variations. This cannot be undone."
  confirmLabel="Delete recipe"
  danger={true}
  onConfirm={() => {
    if (!deleteRecipeForm) return;
    if (deleteRecipeSubmitter && deleteRecipeSubmitter.form === deleteRecipeForm) {
      deleteRecipeForm.requestSubmit(deleteRecipeSubmitter);
      return;
    }
    deleteRecipeForm.requestSubmit();
  }}
/>

<ConfirmDialog
  bind:open={showDeleteCutDialog}
  title="Delete cut?"
  message="This cut will be removed from the recipe."
  confirmLabel="Delete cut"
  danger={true}
  onConfirm={() => {
    if (deleteCutForm && deleteCutSubmitter) deleteCutForm.requestSubmit(deleteCutSubmitter);
  }}
/>

{#if form?.message}
  <section class="card stack">
    <p class={form.success ? 'muted' : 'warning'}>{form.message}</p>
  </section>
{/if}

<style>
  .workspace-header {
    position: sticky;
    top: var(--space-3);
    z-index: 20;
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(5px);
  }

  .workspace-title {
    display: grid;
    gap: var(--space-2);
  }

  .workspace-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .workspace-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: flex-end;
  }

  .tab-panel {
    padding-top: var(--space-2);
  }

  .rating-row {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .rating-form {
    display: flex;
    align-items: end;
    gap: var(--space-2);
  }

  .advanced {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    background: var(--panel-soft);
  }

  .advanced summary {
    cursor: pointer;
    font-weight: 700;
    margin-bottom: var(--space-3);
  }

  .cut-form {
    display: flex;
    gap: var(--space-2);
    align-items: end;
    flex-wrap: wrap;
  }

  .cut-form input {
    flex: 1 1 220px;
  }

  .inline-list {
    display: grid;
    gap: var(--space-2);
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .inline-list li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .plain-list {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: var(--space-2);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .inline {
    display: inline;
  }

  .small {
    font-size: 0.8rem;
  }

  @media (max-width: 900px) {
    .workspace-header {
      position: static;
    }
  }
</style>
