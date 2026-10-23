import { gsap } from 'gsap';
import { vi } from 'vitest';

import { createMobileLoginSplashAnimation } from './mobile-login-splash.animation';

vi.mock('gsap', () => ({
  gsap: {
    context: vi.fn((callback: () => void) => {
      callback();

      return {
        revert: vi.fn(),
      };
    }),
    set: vi.fn(),
    timeline: vi.fn(() => {
      const timeline = {
        to: vi.fn(),
      };

      timeline.to.mockReturnValue(timeline);

      return timeline;
    }),
  },
}));

describe('createMobileLoginSplashAnimation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an animation scoped to the splash root', () => {
    const root = document.createElement('div');
    const onComplete = vi.fn();

    const context = createMobileLoginSplashAnimation(root, onComplete);

    expect(gsap.context).toHaveBeenCalledWith(expect.any(Function), root);

    expect(context.revert).toBeTypeOf('function');
  });

  it('should prepare the initial state of animated elements', () => {
    const root = document.createElement('div');

    createMobileLoginSplashAnimation(root, vi.fn());

    expect(gsap.set).toHaveBeenCalledTimes(3);

    expect(gsap.set).toHaveBeenCalledWith('.splash-logo', {
      autoAlpha: 0,
      y: 18,
      scale: 0.9,
    });

    expect(gsap.set).toHaveBeenCalledWith('.splash-name', {
      autoAlpha: 0,
      y: 40,
    });

    expect(gsap.set).toHaveBeenCalledWith('.splash-accent', {
      autoAlpha: 0,
      scaleX: 0,
    });
  });

  it('should preserve the five original animation steps', () => {
    const root = document.createElement('div');

    createMobileLoginSplashAnimation(root, vi.fn());

    const timeline = vi.mocked(gsap.timeline).mock.results[0].value;

    expect(timeline.to).toHaveBeenCalledTimes(5);

    expect(timeline.to).toHaveBeenNthCalledWith(
      1,
      '.splash-logo',
      expect.objectContaining({
        duration: 0.85,
      }),
      0.1,
    );

    expect(timeline.to).toHaveBeenNthCalledWith(
      2,
      '.splash-name',
      expect.objectContaining({
        duration: 0.8,
      }),
      0.5,
    );

    expect(timeline.to).toHaveBeenNthCalledWith(
      3,
      '.splash-accent',
      expect.objectContaining({
        duration: 0.55,
      }),
      1.05,
    );

    expect(timeline.to).toHaveBeenNthCalledWith(
      4,
      '.splash-content',
      expect.objectContaining({
        duration: 0.4,
      }),
      2.3,
    );

    expect(timeline.to).toHaveBeenNthCalledWith(
      5,
      root,
      expect.objectContaining({
        autoAlpha: 0,
        duration: 0.65,
      }),
      2.65,
    );
  });

  it('should execute the callback when the animation finishes', () => {
    const root = document.createElement('div');
    const onComplete = vi.fn();

    createMobileLoginSplashAnimation(root, onComplete);

    const options = vi.mocked(gsap.timeline).mock.calls[0][0] as {
      onComplete: () => void;
    };

    expect(onComplete).not.toHaveBeenCalled();

    options.onComplete();

    expect(onComplete).toHaveBeenCalledOnce();
  });
});
