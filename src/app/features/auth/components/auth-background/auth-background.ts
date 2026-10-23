import { AfterViewInit, Component, ElementRef, inject, OnDestroy } from '@angular/core';
import { gsap } from 'gsap';

@Component({
  selector: 'app-auth-background',
  imports: [],
  templateUrl: './auth-background.html',
  styleUrl: './auth-background.scss',
})
export class AuthBackground implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private animationContext?: ReturnType<typeof gsap.context>;

  ngAfterViewInit(): void {
    this.animationContext = gsap.context(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reducedMotion) {
        gsap.set('.market-reveal', {
          attr: { width: 1664 },
        });

        return;
      }

      gsap.fromTo(
        '.market-reveal',
        {
          attr: { width: 0 },
        },
        {
          attr: { width: 1664 },
          duration: 2.5,
          ease: 'power1.inOut',
        },
      );
    }, this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.animationContext?.revert();
  }
}
