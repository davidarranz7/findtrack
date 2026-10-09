export interface ChartTheme {
  primary: string;
  danger: string;
  text: string;
  textSecondary: string;
  border: string;
  surface: string;
  areaFill: string;
}

export function getChartTheme(canvas: HTMLCanvasElement, isDark: boolean): ChartTheme {
  const styles = getComputedStyle(canvas);

  const getColor = (variable: string): string => {
    return styles.getPropertyValue(variable).trim();
  };

  const primary = getColor('--app-primary');

  return {
    primary,
    danger: getColor('--app-danger'),
    text: getColor('--app-text'),
    textSecondary: getColor('--app-text-secondary'),
    border: getColor('--app-border'),
    surface: getColor('--app-surface'),
    areaFill: getTransparentColor(primary, isDark ? 0.16 : 0.08),
  };
}

export function getChartTooltipStyle(theme: ChartTheme) {
  return {
    backgroundColor: theme.surface,
    titleColor: theme.text,
    bodyColor: theme.textSecondary,
    borderColor: theme.border,
    borderWidth: 1,
    padding: 10,
  };
}

function getTransparentColor(color: string, opacity: number): string {
  const hex = color.replace('#', '');

  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return color;
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
