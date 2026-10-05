import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly duration = 4000;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  private nextId = 0;

  private readonly toastList = signal<Toast[]>([]);

  readonly toasts = this.toastList.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  warning(message: string): void {
    this.show('warning', message);
  }

  info(message: string): void {
    this.show('info', message);
  }

  remove(id: number): void {
    const timer = this.timers.get(id);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.toastList.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(type: ToastType, message: string): void {
    const id = ++this.nextId;

    this.toastList.update((toasts) => [
      ...toasts,
      {
        id,
        type,
        message,
      },
    ]);

    const timer = setTimeout(() => {
      this.remove(id);
    }, this.duration);

    this.timers.set(id, timer);
  }
}
