import { describe, it, expect } from 'vitest';
import { dashboardCounts, displayGroupName, retentionLabel } from './logic.js';
describe('retention cohort display', () => {
  it('uses retained students rather than new arrivals', () => {
    expect(retentionLabel({student_count:8, baseline_from_previous:8, retained_from_previous:4},8)).toBe('50%');
  });
  it('keeps a missing source cohort pending', () => {
    expect(retentionLabel({student_count:5, source_spreadsheet:'source'},4)).toBe('—');
  });
  it('does not label roster growth as retention above 100 percent', () => {
    expect(retentionLabel({student_count:5},4)).toBe('—');
  });
});

describe('historical dashboard roster', () => {
  it('counts distinct source-roster students and groups for a selected month', () => {
    const data = {
      lessons: [{ id: 'l1', group_id: 'g1', lesson_date: '2026-09-03' }],
      rosterHistory: [
        { student_id: 's1', group_id: 'g1', source_type: '2026-09', source_status: 'Academic record' },
        { student_id: 's1', group_id: 'g2', source_type: '2026-09', source_status: 'Academic record' },
        { student_id: 's2', group_id: 'g1', source_type: '2026-09', source_status: 'Academic record' },
      ],
      students: [],
      rosters: [],
    };
    expect(dashboardCounts(data, '2026-09')).toEqual({ active: 2, left: 0, groups: 2, lessons: 1 });
  });

  it('shows full, capitalized group names without changing the group number', () => {
    expect(displayGroupName('pre-inter 13.3')).toBe('Pre-intermediate 13.3');
    expect(displayGroupName('inter 18')).toBe('Intermediate 18');
    expect(displayGroupName('elementary 10')).toBe('Elementary 10');
  });
});
