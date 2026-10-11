import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';

import { AppBrand } from '../../../shared/app-brand/app-brand';

@Component({
  selector: 'app-mobile-login-splash',
  imports: [AppBrand],
  templateUrl: './mobile-login-splash.html',
  styleUrl: './mobile-login-splash.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileLoginSplash implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly finished = output<void>();

  ngOnInit(): void {
    timer(1750)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.finished.emit();
      });
  }
}
