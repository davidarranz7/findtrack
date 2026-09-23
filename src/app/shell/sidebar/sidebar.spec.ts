import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the navigation options', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('.sidebar-navigation .nav-link');

    expect(links.length).toBe(6);
    expect(compiled.textContent).toContain('Resumen');
    expect(compiled.textContent).toContain('Transacciones');
    expect(compiled.textContent).toContain('Presupuestos');
    expect(compiled.textContent).toContain('Categorías y Etiquetas');
    expect(compiled.textContent).toContain('Informes y Estadísticas');
    expect(compiled.textContent).toContain('Configuración');
  });
});
