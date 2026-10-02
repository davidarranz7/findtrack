import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly message = input.required<string>();

  readonly confirmText = input('Confirmar');
  readonly cancelText = input('Cancelar');
  readonly processingText = input('Procesando...');

  readonly isProcessing = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected confirm(): void {
    if (this.isProcessing()) {
      return;
    }

    this.confirmed.emit();
  }

  protected cancel(): void {
    if (this.isProcessing()) {
      return;
    }

    this.cancelled.emit();
  }
}
