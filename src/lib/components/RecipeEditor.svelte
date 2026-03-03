<script lang="ts">
  import Button from '$lib/ui/Button.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';

  let {
    action,
    recipe,
    submitLabel = 'Save recipe'
  }: {
    action: string;
    recipe: {
      title: string;
      description: string;
      tags: string[];
      baseMeatGrams: number;
      baseAnimal: string;
    };
    submitLabel?: string;
  } = $props();
</script>

<form method="POST" action={action} class="card stack" use:enhanceForm={{ successMessage: 'Recipe saved' }}>
  <header class="editor-head">
    <h2>Recipe Overview</h2>
    <p class="muted">Keep this concise. You can tune ratios and cuts below.</p>
  </header>

  <div class="grid-2">
    <label>
      Title
      <input name="title" required value={recipe.title} />
    </label>
    <label>
      Base animal
      <input name="base_animal" value={recipe.baseAnimal} placeholder="elk, deer, boar" />
    </label>
  </div>

  <label>
    Description
    <textarea name="description" placeholder="What this recipe is for, style, smoke temp, anything important...">{recipe.description}</textarea>
  </label>

  <div class="grid-2">
    <label>
      Tags (comma separated)
      <input name="tags" value={recipe.tags.join(', ')} placeholder="smoke, venison, sausage" />
    </label>
    <label>
      Base meat grams
      <input
        name="base_meat_grams"
        type="number"
        min="1"
        required
        value={recipe.baseMeatGrams}
        aria-describedby="base-meat-helper"
      />
      <span id="base-meat-helper" class="muted small">
        Ratio calculations are normalized to this base amount.
      </span>
    </label>
  </div>

  <div class="actions">
    <Button variant="primary" type="submit">{submitLabel}</Button>
  </div>
</form>

<style>
  .editor-head {
    display: grid;
    gap: var(--space-2);
  }

  .grid-2 {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .small {
    font-size: 0.8rem;
  }

  @media (max-width: 900px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
</style>
