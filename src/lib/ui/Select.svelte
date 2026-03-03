<script lang="ts">
  let {
    id,
    name,
    label = '',
    value = '',
    options = [],
    required = false,
    helper = ''
  }: {
    id?: string;
    name: string;
    label?: string;
    value?: string | number;
    options: Array<{ value: string | number; label: string }>;
    required?: boolean;
    helper?: string;
  } = $props();
</script>

<label for={id || name}>
  {label}
  <select id={id || name} {name} {required}>
    {#each options as option}
      <option value={option.value} selected={String(option.value) === String(value)}>{option.label}</option>
    {/each}
  </select>
  {#if helper}<span class="helper">{helper}</span>{/if}
</label>

<style>
  .helper {
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
