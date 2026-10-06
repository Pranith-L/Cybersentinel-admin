import { describe, expect, it } from 'vitest';
import { getChartRegistrationSource } from './eventChartData';

describe('getChartRegistrationSource', () => {
  it('prefers the full global registration set when it exists', () => {
    const globalData = [{ id: 'g-1' }, { id: 'g-2' }];
    const coordinatorData = [{ id: 'c-1' }];

    expect(getChartRegistrationSource({
      allEventParticipants: globalData,
      participants: coordinatorData,
      allDbEvents: [{ id: 'e-1' }],
    })).toBe(globalData);
  });

  it('falls back to coordinator-scoped data when global registration set is unavailable', () => {
    const coordinatorData = [{ id: 'c-1' }];

    expect(getChartRegistrationSource({
      allEventParticipants: [],
      participants: coordinatorData,
      allDbEvents: [{ id: 'e-1' }],
    })).toEqual(coordinatorData);
  });

  it('uses coordinator data only when no system event catalog is available', () => {
    const coordinatorData = [{ id: 'c-1' }];

    expect(getChartRegistrationSource({
      allEventParticipants: [],
      participants: coordinatorData,
      allDbEvents: [],
    })).toBe(coordinatorData);
  });
});
