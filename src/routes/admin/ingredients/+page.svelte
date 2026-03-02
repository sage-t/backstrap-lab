<script lang="ts">
  let { data, form } = $props();
</script>

<section class="card stack">
  <h1>Ingredients</h1>
  <form method="POST" action="?/create" class="stack">
    <label>
      Name
      <input name="name" required />
    </label>
    <label>
      Default display unit
      <select name="default_display_unit">
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="tsp">tsp</option>
        <option value="tbsp">tbsp</option>
      </select>
    </label>
    <button class="primary" type="submit">Create ingredient</button>
  </form>

  {#if form?.message}<p class="warning">{form.message}</p>{/if}

  <table>
    <thead>
      <tr><th>Name</th><th>Default unit</th><th></th></tr>
    </thead>
    <tbody>
      {#each data.ingredients as ingredient}
        <tr>
          <td>{ingredient.name}</td>
          <td>
            <form method="POST" action="?/updateUnit" class="inline">
              <input type="hidden" name="ingredient_id" value={ingredient.id} />
              <select name="default_display_unit" value={ingredient.default_display_unit}>
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="tsp">tsp</option>
                <option value="tbsp">tbsp</option>
              </select>
              <button type="submit">Save</button>
            </form>
          </td>
          <td><a href="/admin/conversions">densities</a></td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    border-bottom: 1px solid var(--line);
    text-align: left;
    padding: 0.4rem;
  }

  .inline {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
</style>
