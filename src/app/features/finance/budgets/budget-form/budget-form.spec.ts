import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetForm } from './budget-form';

describe('BudgetForm', () => {
  let component: BudgetForm;
  let fixture: ComponentFixture<BudgetForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetForm],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetForm);

    fixture.componentRef.setInput('selectedMonth', '2026-10');

    component = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
