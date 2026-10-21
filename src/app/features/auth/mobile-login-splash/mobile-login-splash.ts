import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { MobileLoginSplashService } from './services/mobile-login-splash.service';
import { createMobileLoginSplashAnimation } from './animations/mobile-login-splash.animation';

@Component({
  selector: 'app-mobile-login-splash',
  imports: [],
  templateUrl: './mobile-login-splash.html',
  styleUrl: './mobile-login-splash.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-playing]': 'isPlaying()',
  },
})
export class MobileLoginSplash implements OnDestroy {
  private readonly splashService = inject(MobileLoginSplashService);

  private readonly splashRoot = viewChild<ElementRef<HTMLElement>>('splashRoot');

  protected readonly isPlaying = signal(false);

  private animationContext: gsap.Context | null = null;

  constructor() {
    effect(() => {
      const visible = this.splashService.isVisible();
      const root = this.splashRoot()?.nativeElement;

      if (!visible) {
        if (this.isPlaying()) {
          this.stop();
        }

        return;
      }

      if (!root || this.isPlaying()) {
        return;
      }

      if (!this.splashService.claim(this)) {
        return;
      }

      try {
        this.play(root);
      } catch {
        this.splashService.finish();
      }
    });
  }

  private play(root: HTMLElement): void {
    this.isPlaying.set(true);

    this.animationContext = createMobileLoginSplashAnimation(root, () =>
      this.splashService.finish(),
    );
  }

  stop(): void {
    this.animationContext?.revert();
    this.animationContext = null;
    this.isPlaying.set(false);
  }

  ngOnDestroy(): void {
    this.stop();
    this.splashService.release(this);
  }
}
