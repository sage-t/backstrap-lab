<script lang="ts">
  let {
    id,
    name,
    label = '',
    value = '',
    type = 'text',
    placeholder = '',
    required = false,
    min,
    max,
    step,
    helper = '',
    error = ''
  }: {
    id?: string;
    name: string;
    label?: string;
    value?: string | number;
    type?: string;
    placeholder?: string;
    required?: boolean;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    helper?: string;
    error?: string;
  } = $props();
</script>

<label for={id || name}>
  {label}
  <input id={id || name} {name} {type} {placeholder} {required} {min} {max} {step} {value} aria-invalid={Boolean(error)} />
  {#if helper}<span class="helper">{helper}</span>{/if}
  {#if error}<span class="error">{error}</span>{/if}
</label>

<style>
  .helper {
    font-size: 0.8rem;
    color: var(--muted);
  }

  .error {
    font-size: 0.8rem;
    color: var(--danger);
  }
</style>
