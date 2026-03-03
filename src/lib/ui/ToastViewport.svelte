<script lang="ts">
  import { toasts } from '$lib/ui/toast';
</script>

<div class="toast-wrap" aria-live="polite" aria-atomic="true">
  {#each $toasts as toast (toast.id)}
    <div class={`toast ${toast.tone}`}>
      <span>{toast.message}</span>
      <button type="button" class="close" on:click={() => toasts.remove(toast.id)} aria-label="Dismiss">×</button>
    </div>
  {/each}
</div>

<style>
  .toast-wrap {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 80;
    display: grid;
    gap: 8px;
    width: min(420px, calc(100vw - 24px));
  }

  .toast {
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: #fff;
    box-shadow: var(--shadow-md);
    padding: 10px 12px;
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 10px;
    font-size: 0.9rem;
  }

  .toast.success {
    border-color: #86efac;
  }

  .toast.error {
    border-color: #fca5a5;
  }

  .toast.info {
    border-color: #93c5fd;
  }

  .close {
    padding: 0;
    border: 0;
    background: transparent;
    width: 20px;
    height: 20px;
    line-height: 1;
    font-size: 1rem;
  }
</style>
