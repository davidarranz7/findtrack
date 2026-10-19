import type { ReportPeriod } from '../services/report-state';

export interface ReportMonth {
  key: string;
  label: string;
}

export function getMonthsEndingAt(referenceDate: Date, count: ReportPeriod): ReportMonth[] {
  const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'short' });

  return Array.from({ length: count }, (_, index) => {
    const monthsAgo = count - 1 - index;
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - monthsAgo, 1);
    const month = monthFormatter.format(date).replace('.', '');

    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: month.charAt(0).toUpperCase() + month.slice(1),
    };
  });
}

export function formatRangeLabel(months: ReportMonth[]): string {
  if (months.length === 0) {
    return '';
  }

  const first = months[0];
  const last = months[months.length - 1];
  const firstYear = first.key.slice(0, 4);
  const lastYear = last.key.slice(0, 4);

  if (months.length === 1) {
    return `${first.label} ${firstYear}`;
  }

  if (firstYear === lastYear) {
    return `${first.label} - ${last.label} ${lastYear}`;
  }

  return `${first.label} ${firstYear} - ${last.label} ${lastYear}`;
}
