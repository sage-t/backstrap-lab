<script lang="ts">
  import Button from '$lib/ui/Button.svelte';
  import { enhanceForm } from '$lib/ui/enhance-form';
  import { formatVolumeFromMl, formatWeightFromGrams } from '$lib/measurement';

  let { data } = $props();
  let weightPreference = $state<'metric_g' | 'imperial_lb_oz'>('metric_g');
  let volumePreference = $state<'metric_ml' | 'kitchen_us'>('metric_ml');
  $effect(() => {
    weightPreference = data.settings.weightPreference;
    volumePreference = data.settings.volumePreference;
  });
  const previewPrefs = $derived({ weightPreference, volumePreference });
</script>

<section class="card stack">
  <header class="stack">
    <h1>Measurement Preferences</h1>
    <p class="muted">Storage stays grams/ml. This only changes how amounts are shown in the UI.</p>
  </header>

  <form method="POST" action="?/save" class="stack" use:enhanceForm={{ successMessage: 'Preferences saved' }}>
    <label>
      Weight display
      <select name="weight_preference" required bind:value={weightPreference}>
        <option value="metric_g">
          Metric (grams)
        </option>
        <option value="imperial_lb_oz">
          Imperial (lb + oz)
        </option>
      </select>
    </label>

    <label>
      Volume display
      <select name="volume_preference" required bind:value={volumePreference}>
        <option value="metric_ml">
          Metric (ml)
        </option>
        <option value="kitchen_us">
          Kitchen (cups + tbsp + tsp)
        </option>
      </select>
    </label>

    <section class="examples">
      <h3>Preview</h3>
      <p>Meat example (1814g): <strong>{formatWeightFromGrams(1814, previewPrefs)}</strong></p>
      <p>Spice example (28g): <strong>{formatWeightFromGrams(28, previewPrefs)}</strong></p>
      <p>Liquid example (355ml): <strong>{formatVolumeFromMl(355, previewPrefs)}</strong></p>
    </section>

    <div class="actions">
      <Button variant="primary" type="submit">Save preferences</Button>
    </div>
  </form>
</section>

<style>
  .examples {
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--panel-soft);
    padding: var(--space-3);
    display: grid;
    gap: var(--space-2);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
