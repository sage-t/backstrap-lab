<script lang="ts">
  type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
  type Size = 'sm' | 'md';

  let {
    type = 'button',
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled = false,
    class: className = '',
    ...rest
  }: {
    type?: 'button' | 'submit' | 'reset';
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    disabled?: boolean;
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<button
  {type}
  {...rest}
  class={`ui-btn ${variant} ${size} ${className}`}
  disabled={disabled || loading}
  aria-busy={loading}
  on:click
>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
    <span class="visually-hidden">Loading</span>
  {/if}
  <slot />
</button>

<style>
  .ui-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border-radius: var(--radius-sm);
    font-weight: 650;
    border: 1px solid var(--border);
  }

  .ui-btn.sm {
    padding: 6px 10px;
    font-size: 0.86rem;
  }

  .ui-btn.md {
    padding: 9px 14px;
    font-size: 0.93rem;
  }

  .ui-btn.primary {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
  }

  .ui-btn.secondary {
    background: #fff;
  }

  .ui-btn.ghost {
    border-color: transparent;
    background: transparent;
  }

  .ui-btn.destructive {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: currentColor;
    animation: spin 0.8s linear infinite;
  }

  .ui-btn.secondary .spinner,
  .ui-btn.ghost .spinner {
    border-color: rgba(15, 23, 42, 0.2);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
