import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';

import { AuthService } from '../../../features/auth/services/auth.service';
import { NotificationService } from '../../../features/finance/services/notification.service';
import { TransactionService } from '../../../features/finance/services/transaction.service';
import { HeaderNotifications } from './header-notifications';

describe('HeaderNotifications', () => {
  let component: HeaderNotifications;
  let fixture: ComponentFixture<HeaderNotifications>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderNotifications],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ id: 'user-1' }),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            transactionsChanged$: new Subject<void>(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            syncBudgetNotifications: () => of([]),
            getNotifications: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderNotifications);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open and close the notification panel', () => {
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('[aria-label="Notificaciones"]') as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    expect(element.querySelector('app-notification-panel')).toBeTruthy();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    button.click();
    fixture.detectChanges();

    expect(element.querySelector('app-notification-panel')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('should close the panel when Escape is pressed', () => {
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('[aria-label="Notificaciones"]') as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      }),
    );

    fixture.detectChanges();

    expect(element.querySelector('app-notification-panel')).toBeNull();
  });

  it('should close the panel when clicking outside', () => {
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('[aria-label="Notificaciones"]') as HTMLButtonElement;

    button.click();
    fixture.detectChanges();

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    fixture.detectChanges();

    expect(element.querySelector('app-notification-panel')).toBeNull();
  });
});
