import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import type { MobileLoginSplash } from '../mobile-login-splash';
import { MobileLoginSplashService } from './mobile-login-splash.service';

describe('MobileLoginSplashService', () => {
  let service: MobileLoginSplashService;
  let isMobile: boolean;
  let prefersReducedMotion: boolean;

  const createSplash = () =>
    ({
      stop: vi.fn(),
    }) as unknown as MobileLoginSplash;

  beforeEach(() => {
    isMobile = true;
    prefersReducedMotion = false;

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query.includes('max-width') ? isMobile : prefersReducedMotion,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    TestBed.configureTestingModule({});

    service = TestBed.inject(MobileLoginSplashService);
  });

  afterEach(() => {
    service.finish();
    vi.restoreAllMocks();
  });

  it('should start with the splash hidden', () => {
    expect(service.isVisible()).toBe(false);
    expect(service.isActive()).toBe(false);
  });

  it('should not start on desktop devices', () => {
    isMobile = false;

    service.start();

    expect(service.isVisible()).toBe(false);
  });

  it('should respect reduced motion preferences', () => {
    prefersReducedMotion = true;

    service.start();

    expect(service.isVisible()).toBe(false);
  });

  it('should activate the splash on supported mobile devices', () => {
    service.start();

    expect(service.isVisible()).toBe(true);
    expect(service.isActive()).toBe(true);

    service.finish();

    expect(service.isVisible()).toBe(false);
  });

  it('should reject claims when the splash is inactive', () => {
    const component = createSplash();

    expect(service.claim(component)).toBe(false);
  });

  it('should allow only one component to claim the splash', () => {
    const first = createSplash();
    const second = createSplash();

    service.start();

    expect(service.claim(first)).toBe(true);
    expect(service.claim(second)).toBe(false);

    service.finish();
  });

  it('should stop the active component when finishing', () => {
    const component = createSplash();

    service.start();
    service.claim(component);

    service.finish();

    expect(component.stop).toHaveBeenCalledOnce();
    expect(service.isVisible()).toBe(false);
  });

  it('should ignore release requests from other components', () => {
    const active = createSplash();
    const other = createSplash();

    service.start();
    service.claim(active);

    service.release(other);

    expect(service.isVisible()).toBe(true);

    service.finish();

    expect(active.stop).toHaveBeenCalledOnce();
  });

  it('should finish when the active component is released', () => {
    const component = createSplash();

    service.start();
    service.claim(component);

    service.release(component);

    expect(service.isVisible()).toBe(false);
  });

  it('should allow another splash after finishing', () => {
    const first = createSplash();
    const second = createSplash();

    service.start();
    expect(service.claim(first)).toBe(true);

    service.finish();

    service.start();
    expect(service.claim(second)).toBe(true);

    service.finish();
  });

  it('should allow finish to be called more than once', () => {
    const component = createSplash();

    service.start();
    service.claim(component);

    service.finish();
    service.finish();

    expect(component.stop).toHaveBeenCalledOnce();
    expect(service.isVisible()).toBe(false);
  });
});
