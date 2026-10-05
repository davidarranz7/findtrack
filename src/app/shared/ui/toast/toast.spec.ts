import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Toast } from './toast';
import { ToastService } from './toast.service';

describe('Toast', () => {
  let component: Toast;
  let fixture: ComponentFixture<Toast>;
  let toastService: ToastService;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [Toast],
    }).compileComponents();

    fixture = TestBed.createComponent(Toast);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);

    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show a success toast', () => {
    toastService.success('Transacción actualizada correctamente.');

    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('.app-toast');

    const message = fixture.nativeElement.querySelector('.toast-message');

    expect(toast).toBeTruthy();
    expect(toast.classList.contains('toast-success')).toBe(true);

    expect(message.textContent.trim()).toBe('Transacción actualizada correctamente.');
  });

  it('should remove a toast when the close button is clicked', () => {
    toastService.success('Operación completada.');

    fixture.detectChanges();

    const closeButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.toast-close-button');

    closeButton.click();

    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('.app-toast');

    expect(toast).toBeNull();
    expect(toastService.toasts()).toEqual([]);
  });
});
