import { describe, expect, it } from 'vitest';
import { calculateAdherence, calculateWeeklyAdherence, canConfirmDose } from '../src/services/adherence';
import type { DoseLog } from '../src/types';

const today = new Date(2026, 10, 15, 12, 0, 0);
const logs: DoseLog[] = [
  { id: '1', medicationId: 'a', scheduledAt: new Date(2026, 10, 15, 8).toISOString(), status: 'taken' },
  { id: '2', medicationId: 'a', scheduledAt: new Date(2026, 10, 15, 20).toISOString(), status: 'pending' },
  { id: '3', medicationId: 'b', scheduledAt: new Date(2026, 10, 15, 9).toISOString(), status: 'missed' },
  { id: '4', medicationId: 'a', scheduledAt: new Date(2026, 10, 14, 8).toISOString(), status: 'taken' },
];

describe('adherence calculations', () => {
  it('counts only the selected local calendar day', () => {
    const summary = calculateAdherence(logs, today);
    expect(summary.total).toBe(3);
    expect(summary.taken).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.missed).toBe(1);
    expect(summary.percentage).toBe(50);
  });

  it('does not treat pending doses as completed or due', () => {
    expect(calculateAdherence([{ ...logs[1] }], today).percentage).toBe(0);
  });

  it('returns seven consecutive daily data points', () => {
    const result = calculateWeeklyAdherence(logs, today);
    expect(result).toHaveLength(7);
    expect(result[6]?.label).toBe('Sun');
  });

  it('allows confirmation only while a dose is pending and an actor exists', () => {
    expect(canConfirmDose(logs[1]!, 'user-1')).toBe(true);
    expect(canConfirmDose(logs[0]!, 'user-1')).toBe(false);
    expect(canConfirmDose(logs[1]!, '')).toBe(false);
  });
});
