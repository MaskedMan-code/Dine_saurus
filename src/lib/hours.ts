export type OpeningHours = Record<string, { closed: boolean; open?: string; close?: string }>;
export function locationHours(
  hours: OpeningHours | null | undefined,
  holidays: string[],
  timezone: string,
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)?.value || '';
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  if (holidays.includes(date)) return { label: 'Closed today (holiday)', open: false };
  if (!hours) return { label: 'Opening hours not configured', open: null };
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const h = hours[String(weekday)];
  if (!h) return { label: 'Opening hours not configured', open: null };
  if (h.closed) return { label: 'Closed today', open: false };
  const time = `${part('hour')}:${part('minute')}`;
  return {
    label: `Today ${h.open}–${h.close} (${timezone})`,
    open: time >= (h.open || '') && time < (h.close || ''),
  };
}
