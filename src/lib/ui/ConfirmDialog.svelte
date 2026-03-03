<script lang="ts">
  import Modal from '$lib/ui/Modal.svelte';
  import Button from '$lib/ui/Button.svelte';

  let {
    open = $bindable(false),
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm
  }: {
    open?: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } = $props();
</script>

<Modal bind:open {title}>
  <p class="muted">{message}</p>
  <div class="actions">
    <Button on:click={() => (open = false)}>{cancelLabel}</Button>
    <Button variant={danger ? 'destructive' : 'primary'} on:click={() => {
      open = false;
      onConfirm();
    }}>{confirmLabel}</Button>
  </div>
</Modal>

<style>
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
