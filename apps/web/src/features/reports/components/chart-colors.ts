export interface ChartDatum {
  name: string;
  value: number;
  color: string;
}

/** Colors come from the design tokens (CSS variables), never hard-coded in components. */
export const CHART_COLORS = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  primary: 'var(--color-primary)',
  muted: 'var(--color-ink-muted)',
} as const;
