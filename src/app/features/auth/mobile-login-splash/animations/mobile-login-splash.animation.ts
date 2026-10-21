import { gsap } from 'gsap';

export function createMobileLoginSplashAnimation(
  root: HTMLElement,
  onComplete: () => void,
): gsap.Context {
  return gsap.context(() => {
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
      onComplete,
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
