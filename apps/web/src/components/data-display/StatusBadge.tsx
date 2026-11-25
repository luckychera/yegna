import { Badge } from '@/components/ui/Badge';
import { statusStyle, type StatusKind } from './status-config';

export function StatusBadge({ kind, status }: { kind: StatusKind; status: string }) {
  const { label, tone, icon } = statusStyle(kind, status);

  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}
