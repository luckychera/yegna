import type { ChartDatum } from './chart-colors';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Charts are decorative summaries: every number is also listed as text beside them so the
 * information never depends on seeing a graphic or telling colors apart.
 */
export function BreakdownLegend({ data, format }: { data: ChartDatum[]; format?: (value: number) => string }) {
  return (
    <ul className="space-y-2">
      {data.map((item) => (
        <li key={item.name} className="flex items-center justify-between gap-3 text-body">
          <span className="flex items-center gap-2 text-ink-secondary">
            <span aria-hidden className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <span className="font-semibold text-ink">{format ? format(item.value) : item.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatusBarChart({ data, label }: { data: ChartDatum[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip cursor={{ fill: 'var(--color-surface-soft)' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((item) => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusPieChart({ data, label }: { data: ChartDatum[]; label: string }) {
  const visible = data.filter((item) => item.value > 0);

  return (
    <div role="img" aria-label={label} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={visible} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {visible.map((item) => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
