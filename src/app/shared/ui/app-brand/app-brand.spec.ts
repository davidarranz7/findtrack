import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppBrand } from './app-brand';

describe('AppBrand', () => {
  let component: AppBrand;
  let fixture: ComponentFixture<AppBrand>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppBrand],
    }).compileComponents();

    fixture = TestBed.createComponent(AppBrand);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the application name', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Finora');
  });

  it('should display the application logo', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const logo = compiled.querySelector<HTMLImageElement>('.brand-logo');

    expect(logo?.getAttribute('src')).toBe('/images/logo.png');
  });
});
