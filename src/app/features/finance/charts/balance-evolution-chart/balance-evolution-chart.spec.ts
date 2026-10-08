import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalanceEvolutionChart } from './balance-evolution-chart';

describe('BalanceEvolutionChart', () => {
  let component: BalanceEvolutionChart;
  let fixture: ComponentFixture<BalanceEvolutionChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalanceEvolutionChart],
    }).compileComponents();

    fixture = TestBed.createComponent(BalanceEvolutionChart);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
