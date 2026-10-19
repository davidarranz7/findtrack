import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the application name', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Finora App');
  });

  it('should render the search input', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const searchInput = compiled.querySelector('input[type="search"]');

    expect(searchInput).toBeTruthy();
  });

  it('should open the search when the input receives focus', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const searchInput = compiled.querySelector('input[type="search"]') as HTMLInputElement;

    searchInput.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(compiled.querySelector('.search-dropdown')).toBeTruthy();
  });

  it('should close the search when Escape is pressed', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const searchInput = compiled.querySelector('input[type="search"]') as HTMLInputElement;

    searchInput.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(compiled.querySelector('.search-dropdown')).toBeTruthy();

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      }),
    );

    fixture.detectChanges();

    expect(compiled.querySelector('.search-dropdown')).toBeNull();
  });

  it('should close the search when clicking outside', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const searchInput = compiled.querySelector('input[type="search"]') as HTMLInputElement;

    searchInput.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(compiled.querySelector('.search-dropdown')).toBeTruthy();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    fixture.detectChanges();

    expect(compiled.querySelector('.search-dropdown')).toBeNull();
  });
});
