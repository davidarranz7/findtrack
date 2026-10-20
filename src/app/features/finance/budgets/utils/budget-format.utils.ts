const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

const monthFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
});

export function formatBudgetCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatBudgetPercentage(percentage: number): string {
  return `${Math.round(percentage)} %`;
}

export function formatBudgetMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const label = monthFormatter.format(new Date(year, monthNumber - 1, 1));

  return label.charAt(0).toUpperCase() + label.slice(1);
}
