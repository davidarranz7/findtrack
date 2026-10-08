import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationPanel } from './notification-panel';

describe('NotificationPanel', () => {
  let component: NotificationPanel;
  let fixture: ComponentFixture<NotificationPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationPanel);

    component = fixture.componentInstance;

    fixture.componentRef.setInput('notifications', []);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the empty state', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('No tienes notificaciones');
  });
});
