import { describe,it,expect } from 'vitest';
import { decomposeSales,equalLengthPreviousPeriod,previousMonthEquivalentPeriod,previousWeekEquivalentPeriod } from './business-insight.service';

describe('Business insight comparison math',()=>{
  it('compares month-to-date against the same number of days in the previous month',()=>{
    expect(previousMonthEquivalentPeriod({from:'2026-10-01',to:'2026-10-08'})).toEqual({from:'2026-09-01',to:'2026-09-08'});
  });
  it('compares week-to-date with the same weekdays in the previous week',()=>{
    expect(previousWeekEquivalentPeriod({from:'2026-10-05',to:'2026-10-08'})).toEqual({from:'2026-09-28',to:'2026-10-01'});
  });
  it('keeps custom periods equal in length, including leap day',()=>{
    expect(equalLengthPreviousPeriod({from:'2024-03-01',to:'2024-03-03'})).toEqual({from:'2024-02-27',to:'2024-02-29'});
  });
  it('decomposes the full sale change into bill-count and average-bill effects without overlap',()=>{
    const d=decomposeSales(255000,480,300000,600);
    expect(d.billCountImpact).toBeLessThan(0);expect(d.averageBillImpact).toBeGreaterThan(0);
    expect(d.billCountImpact+d.averageBillImpact).toBe(d.totalChange);
    expect(d.previousAverage).toBe(500);expect(d.currentAverage).toBe(531.25);
  });
  it('never produces infinity when the previous sales value is zero',()=>{
    const d=decomposeSales(1000,10,0,0);expect(Number.isFinite(d.totalChange)).toBe(true);expect(d.currentAverage).toBe(100);expect(d.averageBillImpact).toBe(500);expect(d.billCountImpact).toBe(500);
  });
});
