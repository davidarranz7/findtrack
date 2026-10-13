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
  CategoryScale,
  Chart,
  type ChartDataset,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

import { ThemeService } from '../../services/theme.service';
import { getChartTheme, getChartTooltipStyle } from '../chart-theme';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
);

export interface BalanceEvolutionChartItem {
  label: string;
  balance: number;
}

export interface BalanceEvolutionChartSeries {
  id: string;
  label: string;
  color: string;
  balances: number[];
}

@Component({
  selector: 'app-balance-evolution-chart',
  imports: [],
  templateUrl: './balance-evolution-chart.html',
  styleUrl: './balance-evolution-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceEvolutionChart {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly themeService = inject(ThemeService);

  private readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private chart: Chart<'line', number[], string> | null = null;

  readonly items = input.required<BalanceEvolutionChartItem[]>();
  readonly series = input<BalanceEvolutionChartSeries[]>([]);

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const canvas = this.chartCanvas()?.nativeElement;
      const items = this.items();
      const series = this.series();
      const isDark = this.themeService.isDark();

      if (!canvas || items.length === 0) {
        this.destroyChart();
        return;
      }

      this.renderChart(canvas, items, series, isDark);
    });

    this.destroyRef.onDestroy(() => {
      this.destroyChart();
    });
  }

  private renderChart(
    canvas: HTMLCanvasElement,
    items: BalanceEvolutionChartItem[],
    series: BalanceEvolutionChartSeries[],
    isDark: boolean,
  ): void {
    this.destroyChart();

    const theme = getChartTheme(canvas, isDark);

    const datasets: ChartDataset<'line', number[]>[] = [
      {
        label: 'Balance acumulado total',
        data: items.map((item) => item.balance),
        borderColor: theme.primary,
        backgroundColor: theme.areaFill,
        pointBackgroundColor: theme.surface,
        pointBorderColor: theme.primary,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: series.length > 0 ? 3 : 2,
        fill: series.length === 0,
        tension: 0.35,
      },
      ...series.map((item): ChartDataset<'line', number[]> => ({
        label: item.label,
        data: item.balances,
        borderColor: item.color,
        backgroundColor: item.color,
        pointBackgroundColor: theme.surface,
        pointBorderColor: item.color,
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        fill: false,
        tension: 0.35,
      })),
    ];

    this.chart = new Chart<'line', number[], string>(canvas, {
      type: 'line',
      data: {
        labels: items.map((item) => item.label),
        datasets,
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
            ticks: {
              color: theme.textSecondary,
            },
          },
          y: {
            beginAtZero: true,
            border: {
              display: false,
            },
            grid: {
              color: theme.border,
            },
            ticks: {
              color: theme.textSecondary,
              callback: (value) => this.currencyFormatter.format(Number(value)),
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: theme.textSecondary,
            },
          },
          tooltip: {
            ...getChartTooltipStyle(theme),
            callbacks: {
              label: (context) =>
                `${context.dataset.label ?? 'Balance'}: ${this.currencyFormatter.format(Number(context.raw))}`,
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
