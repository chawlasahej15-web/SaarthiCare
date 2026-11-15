import type { DoseLog } from '../types';
import { localDateKey } from '../lib/date';

export interface AdherenceSummary {
  percentage: number;
  taken: number;
  skipped: number;
  missed: number;
  pending: number;
  total: number;
}

export function calculateAdherence(logs: DoseLog[], date = new Date()): AdherenceSummary {
  const dayLogs = logs.filter((log) => localDateKey(new Date(log.scheduledAt)) === localDateKey(date));
  const taken = dayLogs.filter((log) => log.status === 'taken').length;
  const skipped = dayLogs.filter((log) => log.status === 'skipped').length;
  const missed = dayLogs.filter((log) => log.status === 'missed').length;
  const pending = dayLogs.filter((log) => log.status === 'pending').length;
  const completedOrDue = taken + skipped + missed;
  return {
    percentage: completedOrDue === 0 ? 0 : Math.round((taken / completedOrDue) * 100),
    taken,
    skipped,
    missed,
    pending,
    total: dayLogs.length,
  };
}

export function calculateWeeklyAdherence(logs: DoseLog[], today = new Date()): Array<{ label: string; percentage: number }> {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const summary = calculateAdherence(logs, day);
    return {
      label: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(day),
      percentage: summary.percentage,
    };
  });
}

export function canConfirmDose(log: DoseLog, actorId: string): boolean {
  return Boolean(actorId) && log.status === 'pending';
}
