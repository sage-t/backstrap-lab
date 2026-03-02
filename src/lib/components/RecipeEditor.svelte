<script lang="ts">
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

<form method="POST" action={action} class="card stack">
  <h2>Recipe</h2>
  <label>
    Title
    <input name="title" required value={recipe.title} />
  </label>
  <label>
    Description
    <textarea name="description">{recipe.description}</textarea>
  </label>
  <label>
    Tags (comma separated)
    <input name="tags" value={recipe.tags.join(', ')} placeholder="smoke, venison" />
  </label>
  <label>
    Base meat grams
    <input name="base_meat_grams" type="number" min="1" required value={recipe.baseMeatGrams} />
  </label>
  <label>
    Base animal
    <input name="base_animal" value={recipe.baseAnimal} placeholder="elk, deer, boar" />
  </label>
  <button class="primary" type="submit">{submitLabel}</button>
</form>
