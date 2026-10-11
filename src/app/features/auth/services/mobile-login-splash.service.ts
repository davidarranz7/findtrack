import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MobileLoginSplashService {
  private readonly activeState = signal(false);

  readonly isActive = this.activeState.asReadonly();

  start(): void {
    this.activeState.set(true);
  }

  finish(): void {
    this.activeState.set(false);
  }
}
