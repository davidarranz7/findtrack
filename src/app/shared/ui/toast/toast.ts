import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toast {
  private readonly toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;

  protected removeToast(id: number): void {
    this.toastService.remove(id);
  }
}
