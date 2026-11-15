export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', options ?? { day: 'numeric', month: 'short' }).format(new Date(value));
}

export function todayLabel(date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

export function timeFromHourMinute(time: string, baseDate = new Date()): string {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.toISOString();
}

export function relativeDay(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (localDateKey(date) === localDateKey(today)) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (localDateKey(date) === localDateKey(tomorrow)) return 'Tomorrow';
  return formatDate(value, { weekday: 'short', day: 'numeric', month: 'short' });
}
