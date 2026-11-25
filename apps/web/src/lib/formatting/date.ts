const ETHIOPIA_TZ = 'Africa/Addis_Ababa';
const DAY_MS = 86_400_000;

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateOnlyFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Apr 29, 2026" for an instant (rendered in the viewer's time zone). */
export function formatDate(value: string | Date | null | undefined): string {
  const date = value ? toDate(value) : null;

  return date ? dateFormat.format(date) : '—';
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = value ? toDate(value) : null;

  return date ? dateTimeFormat.format(date) : '—';
}

/**
 * Calendar dates (due dates, contribution periods) arrive as "2026-10-29T00:00:00.000Z".
 * Only the date part is meaningful, so it is rendered in UTC to avoid shifting the day.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = toDate(`${value.slice(0, 10)}T00:00:00.000Z`);

  return date ? dateOnlyFormat.format(date) : '—';
}

/** Today's calendar date in Ethiopia as YYYY-MM-DD (matches how the backend evaluates due dates). */
export function todayInEthiopia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ETHIOPIA_TZ }).format(now);
}

export function daysUntil(dateOnly: string, now: Date = new Date()): number {
  const due = Date.parse(`${dateOnly.slice(0, 10)}T00:00:00.000Z`);
  const today = Date.parse(`${todayInEthiopia(now)}T00:00:00.000Z`);

  return Math.round((due - today) / DAY_MS);
}

/** "Due today", "Due in 3 days", "Overdue by 2 days". */
export function formatDueLabel(dueDate: string, now: Date = new Date()): string {
  const days = daysUntil(dueDate, now);

  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return 'Overdue by 1 day';

  return `Overdue by ${Math.abs(days)} days`;
}

/** "Just now", "2 hours ago", "Yesterday", "Apr 29, 2026". */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  const date = value ? toDate(value) : null;

  if (!date) {
    return '—';
  }

  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);

  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return formatDate(date);
}

export function greetingFor(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: ETHIOPIA_TZ }).format(now),
  );

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';

  return 'Good evening';
}
