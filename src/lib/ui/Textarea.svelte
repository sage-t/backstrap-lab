<script lang="ts">
  let {
    id,
    name,
    label = '',
    value = '',
    placeholder = '',
    required = false,
    rows = 4,
    helper = '',
    error = ''
  }: {
    id?: string;
    name: string;
    label?: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
    rows?: number;
    helper?: string;
    error?: string;
  } = $props();
</script>

<label for={id || name}>
  {label}
  <textarea id={id || name} {name} {placeholder} {required} {rows} aria-invalid={Boolean(error)}>{value}</textarea>
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
