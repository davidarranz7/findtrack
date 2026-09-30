import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export interface IncomeExpenseChartItem {
  label: string;
  income: number;
  expense: number;
}

@Component({
  selector: 'app-income-expense-chart',
  imports: [],
  templateUrl: './income-expense-chart.html',
  styleUrl: './income-expense-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomeExpenseChart {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private chart: Chart<'bar', number[], string> | null = null;

  readonly items = input.required<IncomeExpenseChartItem[]>();

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const canvas = this.chartCanvas()?.nativeElement;

      const items = this.items();

      if (!canvas || items.length === 0) {
        this.destroyChart();
        return;
      }

      this.renderChart(canvas, items);
    });

    this.destroyRef.onDestroy(() => {
      this.destroyChart();
    });
  }

  private renderChart(canvas: HTMLCanvasElement, items: IncomeExpenseChartItem[]): void {
    this.destroyChart();

    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: items.map((item) => item.label),
        datasets: [
          {
            label: 'Ingresos',
            data: items.map((item) => item.income),
            backgroundColor: '#0d6efd',
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Gastos',
            data: items.map((item) => item.expense),
            backgroundColor: '#dc3545',
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            border: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
            border: {
              display: false,
            },
            ticks: {
              callback: (value) => this.currencyFormatter.format(Number(value)),
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = Number(context.raw);

                return `${context.dataset.label}: ${this.currencyFormatter.format(value)}`;
              },
            },
          },
        },
      },
    });
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}
