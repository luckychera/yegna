export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function fullName(parts: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const display = parts.displayName?.trim();

  if (display) {
    return display;
  }

  return [parts.firstName, parts.lastName].filter((part) => part && part.trim()).join(' ') || 'Member';
}

export function humanize(value: string): string {
  const text = value.replace(/_/g, ' ');

  return text.charAt(0).toUpperCase() + text.slice(1);
}
