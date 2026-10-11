import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import type { MobileLoginSplash } from '../mobile-login-splash/mobile-login-splash';

@Injectable({
  providedIn: 'root',
})
export class MobileLoginSplashService {
  private readonly document = inject(DOCUMENT);
  private readonly applicationRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  readonly isVisible = signal(false);
  readonly isActive = this.isVisible;

  private mountedComponent: ComponentRef<MobileLoginSplash> | null = null;
  private playingComponent: MobileLoginSplash | null = null;

  start(): void {
    const browserWindow = this.document.defaultView;

    if (!browserWindow) {
      return;
    }

    const isMobile = browserWindow.matchMedia(
      '(max-width: 767.98px) and (pointer: coarse)',
    ).matches;

    const prefersReducedMotion = browserWindow.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (!isMobile || prefersReducedMotion) {
      return;
    }

    this.finish();

    const activeElement = this.document.activeElement;

    if (activeElement instanceof browserWindow.HTMLElement) {
      activeElement.blur();
    }

    this.isVisible.set(true);

    // Si el componente ya está en app.html, se reutiliza.
    // Si no está montado, lo creamos temporalmente.
    void import('../mobile-login-splash/mobile-login-splash')
      .then(({ MobileLoginSplash }) => {
        if (!this.isVisible() || this.playingComponent) {
          return;
        }

        const componentRef = createComponent(MobileLoginSplash, {
          environmentInjector: this.environmentInjector,
        });

        this.mountedComponent = componentRef;

        this.document.body.appendChild(componentRef.location.nativeElement);

        this.applicationRef.attachView(componentRef.hostView);

        componentRef.changeDetectorRef.detectChanges();
      })
      .catch(() => {
        this.finish();
      });
  }

  claim(component: MobileLoginSplash): boolean {
    if (!this.isVisible() || this.playingComponent) {
      return false;
    }

    this.playingComponent = component;

    return true;
  }

  release(component: MobileLoginSplash): void {
    if (this.playingComponent !== component) {
      return;
    }

    this.playingComponent = null;

    if (this.isVisible()) {
      this.finish();
    }
  }

  finish(): void {
    const playingComponent = this.playingComponent;
    const mountedComponent = this.mountedComponent;

    this.playingComponent = null;
    this.mountedComponent = null;

    this.isVisible.set(false);

    playingComponent?.stop();

    if (!mountedComponent) {
      return;
    }

    this.applicationRef.detachView(mountedComponent.hostView);
    mountedComponent.destroy();
  }
}
