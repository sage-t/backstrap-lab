import { writable } from 'svelte/store';

export type ToastTone = 'success' | 'error' | 'info';

export type Toast = {
  id: number;
  tone: ToastTone;
  message: string;
};

const { subscribe, update } = writable<Toast[]>([]);

let sequence = 1;

export const toasts = {
  subscribe,
  push(message: string, tone: ToastTone = 'info', timeoutMs = 2400) {
    const id = sequence++;
    update((items) => [...items, { id, message, tone }]);
    if (timeoutMs > 0) {
      setTimeout(() => {
        update((items) => items.filter((item) => item.id !== id));
      }, timeoutMs);
    }
  },
  remove(id: number) {
    update((items) => items.filter((item) => item.id !== id));
  }
};
