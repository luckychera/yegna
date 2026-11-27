const FALLBACK_TIME_ZONES = ['Africa/Addis_Ababa', 'Africa/Nairobi', 'UTC'];

/** IANA time zones, with Addis Ababa first. The current value is kept even if it is unusual. */
export function timeZoneChoices(current: string): string[] {
  let zones = FALLBACK_TIME_ZONES;

  try {
    const supported = Intl.supportedValuesOf('timeZone');

    if (supported.length > 0) zones = supported;
  } catch {
    zones = FALLBACK_TIME_ZONES;
  }

  const unique = new Set(zones);

  if (current.trim()) unique.add(current.trim());

  return [...unique].sort((left, right) => {
    if (left === 'Africa/Addis_Ababa') return -1;
    if (right === 'Africa/Addis_Ababa') return 1;

    return left.localeCompare(right);
  });
}

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'Amharic' },
] as const;
