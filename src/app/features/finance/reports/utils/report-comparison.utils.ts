export type ComparisonDirection = 'increase' | 'decrease' | 'same';

export interface PercentageComparison {
  previousValue: number;
  percentage: number | null;
  direction: ComparisonDirection;
}

export function getPercentageComparison(
  currentValue: number,
  previousValue: number,
): PercentageComparison {
  const direction: ComparisonDirection =
    currentValue > previousValue ? 'increase' : currentValue < previousValue ? 'decrease' : 'same';

  if (previousValue === 0) {
    return {
      previousValue,
      percentage: null,
      direction,
    };
  }

  const percentage = Math.abs(((currentValue - previousValue) / Math.abs(previousValue)) * 100);

  return {
    previousValue,
    percentage,
    direction,
  };
}
