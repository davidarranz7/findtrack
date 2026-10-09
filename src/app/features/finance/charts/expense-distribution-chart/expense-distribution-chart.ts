import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { ArcElement, Chart, DoughnutController, Legend, Tooltip } from 'chart.js';

import { ThemeService } from '../../services/theme.service';
import { getChartTheme, getChartTooltipStyle } from '../chart-theme';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

export interface ExpenseDistributionItem {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-expense-distribution-chart',
  imports: [],
  templateUrl: './expense-distribution-chart.html',
  styleUrl: './expense-distribution-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseDistributionChart {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly themeService = inject(ThemeService);

  private readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private chart: Chart<'doughnut', number[], string> | null = null;

  readonly items = input.required<ExpenseDistributionItem[]>();

  readonly total = input.required<number>();

  protected readonly formattedTotal = computed(() => this.currencyFormatter.format(this.total()));

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const canvas = this.chartCanvas()?.nativeElement;
      const items = this.items();
      const isDark = this.themeService.isDark();

      if (!canvas || items.length === 0) {
        this.destroyChart();
        return;
      }

      this.renderChart(canvas, items, isDark);
    });

    this.destroyRef.onDestroy(() => {
      this.destroyChart();
    });
  }

  private renderChart(
    canvas: HTMLCanvasElement,
    items: ExpenseDistributionItem[],
    isDark: boolean,
  ): void {
    this.destroyChart();

    const theme = getChartTheme(canvas, isDark);

    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: items.map((item) => item.categoryName),
        datasets: [
          {
            data: items.map((item) => item.amount),
            backgroundColor: items.map((item) => item.color),
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            ...getChartTooltipStyle(theme),
            callbacks: {
              label: (context) => {
                const value = Number(context.raw);

                return `${context.label}: ${this.currencyFormatter.format(value)}`;
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
