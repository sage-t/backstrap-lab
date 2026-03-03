<script lang="ts">
  let {
    open = $bindable(false),
    title = ''
  }: {
    open?: boolean;
    title?: string;
  } = $props();

  let dialogEl: HTMLDialogElement | null = null;

  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) dialogEl.showModal();
    if (!open && dialogEl.open) dialogEl.close();
  });

  const onClose = () => {
    open = false;
  };
</script>

<dialog bind:this={dialogEl} class="modal" on:close={onClose} aria-label={title || 'Dialog'}>
  <article class="modal-card card stack" role="document">
    <header class="modal-head">
      {#if title}<h2>{title}</h2>{/if}
      <button type="button" class="close" aria-label="Close dialog" on:click={() => (open = false)}>×</button>
    </header>
    <slot />
  </article>
</dialog>

<style>
  .modal {
    border: none;
    padding: 0;
    background: transparent;
    max-width: min(680px, calc(100vw - 24px));
    width: 100%;
  }

  .modal::backdrop {
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(2px);
  }

  .modal-card {
    margin: 0;
    box-shadow: var(--shadow-md);
  }

  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .close {
    border: 0;
    background: transparent;
    font-size: 1.6rem;
    line-height: 1;
    padding: 0;
    width: 32px;
    height: 32px;
  }
</style>
