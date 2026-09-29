import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpenseDistributionChart } from './expense-distribution-chart';

describe('ExpenseDistributionChart', () => {
  let component: ExpenseDistributionChart;
  let fixture: ComponentFixture<ExpenseDistributionChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseDistributionChart],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseDistributionChart);

    fixture.componentRef.setInput('items', []);
    fixture.componentRef.setInput('total', 0);

    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
