import { describe, it, expect } from 'vitest';
import { retentionLabel } from './logic.js';
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
