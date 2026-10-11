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
import { gsap } from 'gsap';

import { MobileLoginSplashService } from '../services/mobile-login-splash.service';

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

    this.animationContext = gsap.context(() => {
      gsap.set('.splash-logo', {
        autoAlpha: 0,
        y: 18,
        scale: 0.9,
      });

      gsap.set('.splash-name', {
        autoAlpha: 0,
        y: 40,
      });

      gsap.set('.splash-accent', {
        autoAlpha: 0,
        scaleX: 0,
      });

      const timeline = gsap.timeline({
        defaults: {
          ease: 'power3.out',
        },
        onComplete: () => {
          this.splashService.finish();
        },
      });

      timeline
        .to(
          '.splash-logo',
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.85,
            ease: 'power3.out',
          },
          0.1,
        )
        .to(
          '.splash-name',
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
          },
          0.5,
        )
        .to(
          '.splash-accent',
          {
            autoAlpha: 1,
            scaleX: 1,
            duration: 0.55,
            ease: 'power2.out',
          },
          1.05,
        )
        .to(
          '.splash-content',
          {
            y: -8,
            duration: 0.4,
            ease: 'power2.inOut',
          },
          2.3,
        )
        .to(
          root,
          {
            autoAlpha: 0,
            duration: 0.65,
            ease: 'power2.inOut',
          },
          2.65,
        );
    }, root);
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
