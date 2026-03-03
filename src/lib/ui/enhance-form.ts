import { applyAction, enhance } from '$app/forms';
import { toasts } from '$lib/ui/toast';

type EnhanceFormOptions = {
  successMessage?: string;
  errorMessage?: string;
  resetOnSuccess?: boolean;
};

export function enhanceForm(node: HTMLFormElement, options: EnhanceFormOptions = {}) {
  let current = options;

  const unenhance = enhance(node, () => {
    node.dataset.pending = 'true';

    return async ({ result, update }) => {
      node.dataset.pending = 'false';

      if (result.type === 'redirect') {
        await applyAction(result);
        return;
      }

      if (result.type === 'success') {
        await update({ reset: current.resetOnSuccess ?? false, invalidateAll: true });
        const dataMessage = (result.data as { message?: string } | undefined)?.message;
        if (current.successMessage || dataMessage) {
          toasts.push(current.successMessage || dataMessage || 'Saved', 'success');
        }
        return;
      }

      if (result.type === 'failure') {
        await applyAction(result);
        const dataMessage = (result.data as { message?: string } | undefined)?.message;
        toasts.push(dataMessage || current.errorMessage || 'Request failed', 'error');
        return;
      }

      toasts.push(current.errorMessage || result.error?.message || 'Request failed', 'error');
    };
  });

  return {
    update(next: EnhanceFormOptions) {
      current = next;
    },
    destroy() {
      unenhance.destroy();
    }
  };
}
