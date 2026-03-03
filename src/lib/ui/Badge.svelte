<script lang="ts">
  let {
    tone = 'default',
    class: className = ''
  }: {
    tone?: 'default' | 'primary' | 'warning' | 'danger' | 'success';
    class?: string;
  } = $props();
</script>

<span class={`badge ${tone} ${className}`}><slot /></span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.75rem;
    font-weight: 700;
    border: 1px solid var(--border);
    background: var(--panel-soft);
    color: var(--text);
  }

  .primary {
    background: var(--primary-soft);
    color: var(--primary);
    border-color: transparent;
  }

  .warning {
    background: var(--warning-soft);
    color: var(--warning);
    border-color: transparent;
  }

  .danger {
    background: var(--danger-soft);
    color: var(--danger);
    border-color: transparent;
  }

  .success {
    background: #dcfce7;
    color: var(--success);
    border-color: transparent;
  }
</style>
