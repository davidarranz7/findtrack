import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';
import { vi } from 'vitest';

import { MobileLoginSplash } from './mobile-login-splash';
import { MobileLoginSplashService } from './services/mobile-login-splash.service';

describe('MobileLoginSplash', () => {
  let fixture: ComponentFixture<MobileLoginSplash>;
  let isVisible: WritableSignal<boolean>;

  let claim: ReturnType<typeof vi.fn>;
  let finish: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let revert: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    isVisible = signal(false);

    claim = vi.fn(() => true);
    finish = vi.fn(() => isVisible.set(false));
    release = vi.fn();
    revert = vi.fn();

    vi.spyOn(gsap, 'context').mockReturnValue({
      revert,
    } as unknown as gsap.Context);

    await TestBed.configureTestingModule({
      imports: [MobileLoginSplash],
      providers: [
        {
          provide: MobileLoginSplashService,
          useValue: {
            isVisible,
            claim,
            finish,
            release,
          },
        },
      ],
    })
      .overrideComponent(MobileLoginSplash, {
        set: {
          template: '<div #splashRoot></div>',
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MobileLoginSplash);
    fixture.detectChanges();

    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  async function activateSplash(): Promise<void> {
    isVisible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should create the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not start when the splash is hidden', () => {
    expect(claim).not.toHaveBeenCalled();
    expect(gsap.context).not.toHaveBeenCalled();

    expect(fixture.nativeElement.classList.contains('is-playing')).toBe(false);
  });

  it('should claim the splash before animating', async () => {
    await activateSplash();

    expect(claim).toHaveBeenCalledWith(fixture.componentInstance);

    expect(gsap.context).toHaveBeenCalledOnce();
  });

  it('should scope the animation to the splash root', async () => {
    await activateSplash();

    const root = fixture.nativeElement.querySelector('div');

    expect(gsap.context).toHaveBeenCalledWith(expect.any(Function), root);
  });

  it('should apply the playing class while active', async () => {
    await activateSplash();

    expect(fixture.nativeElement.classList.contains('is-playing')).toBe(true);
  });

  it('should not animate if another component owns the splash', async () => {
    claim.mockReturnValue(false);

    await activateSplash();

    expect(claim).toHaveBeenCalledOnce();
    expect(gsap.context).not.toHaveBeenCalled();

    expect(fixture.nativeElement.classList.contains('is-playing')).toBe(false);
  });

  it('should finish when the animation completes', async () => {
    const timeline = {
      to: vi.fn().mockReturnThis(),
    };

    vi.spyOn(gsap, 'set').mockReturnValue({} as gsap.core.Tween);

    vi.spyOn(gsap, 'timeline').mockReturnValue(timeline as unknown as gsap.core.Timeline);

    vi.mocked(gsap.context).mockImplementation((callback) => {
      callback?.({} as gsap.Context);

      return {
        revert,
      } as unknown as gsap.Context;
    });

    await activateSplash();

    const options = vi.mocked(gsap.timeline).mock.calls[0][0] as {
      onComplete: () => void;
    };

    options.onComplete();

    expect(finish).toHaveBeenCalledOnce();

    fixture.detectChanges();
    await fixture.whenStable();

    expect(revert).toHaveBeenCalledOnce();
  });

  it('should stop when visibility changes to false', async () => {
    await activateSplash();

    isVisible.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(revert).toHaveBeenCalledOnce();

    expect(fixture.nativeElement.classList.contains('is-playing')).toBe(false);
  });

  it('should not create duplicate animations', async () => {
    await activateSplash();

    fixture.detectChanges();
    await fixture.whenStable();

    expect(gsap.context).toHaveBeenCalledOnce();
    expect(claim).toHaveBeenCalledOnce();
  });

  it('should finish if the animation fails', async () => {
    vi.mocked(gsap.context).mockImplementation(() => {
      throw new Error('Animation failed');
    });

    await activateSplash();

    expect(finish).toHaveBeenCalledOnce();
    expect(isVisible()).toBe(false);
  });

  it('should stop and release the splash when destroyed', async () => {
    await activateSplash();

    fixture.destroy();

    expect(revert).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledWith(fixture.componentInstance);
  });

  it('should allow stopping more than once', async () => {
    await activateSplash();

    fixture.componentInstance.stop();
    fixture.componentInstance.stop();

    expect(revert).toHaveBeenCalledOnce();
  });
});
