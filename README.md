# Academic Department OS

Continues the existing React/Vite/Supabase application. Production uses the same Supabase project and publishable key as before. Access remains controlled by existing database policies.

## Local checks

Use Node.js 22.16 or newer, then run:

```text
npm ci
npm test
npm run build
```

Tests mock Supabase and never create real students, lessons, scores, or payments. They cover page navigation, Groups/Open, retention column order, student search/status options, lesson/month values, save errors, lesson numbering, monthly counts, payroll display, finance filtering and payment saves. Pagination tests check the 1,000-row response boundary.

## Data and deployment

- No schema migrations, policy changes, payroll recalculation, or data imports are included.
- Payroll totals come from stored `group_payroll.total_amount`; approved August 2026 (8,432,332) and September 2026 (6,442,833) totals are compared, never overwritten.
- Dashboard defines active students as enrolled at any point in a month. Historical frozen/transfer status cannot be reconstructed without status-history data.
- All data reads are paginated; read errors appear explicitly instead of silently displaying zero counts.
- LIVE/HW records use lesson/student keys. Scores use assessment/student keys; assessments are selected within their calendar month. Blank LIVE/HW means unrecorded and cannot be used to silently write absence/missing.
- Payment month filters use the payment date, and filter summary totals together with the rows. Course month remains a separate field. Saves validate group membership, positive amount, date, and course month, and block repeated submissions while pending.
- Database writes require existing insert/select/update policies and unique constraints. A successful local mock test is not proof that live permissions are configured.

Before deployment, verify that Supabase is healthy, inspect table/role policies and unique constraints, and verify the stored payroll totals. Confirm Render build command `npm ci && npm run build`, output directory `dist`, and Node runtime. Do not apply unverified database permission changes to bypass errors.

## Combined acceptance test

Use this checklist once a verified release is deployed. Do not save fake production data.

1. Dashboard: switch August/September; check active/left students, groups and lessons against source records.
2. Students: search by name and formatted/unformatted phone number.
3. Student status: open the editor and check all five options; cancel.
4. Groups: confirm M1 → M2 → Retention 1 → M3 → Retention 2 and stored counts/percentages.
5. Groups/Open: open two or three groups and return to Groups each time.
6. Academic Sheet: switch months and lessons; check LIVE/HW against known lesson records and assessment scores against the selected assessment.
7. Add Lesson/Assessment: check the next continuous lesson number and assessment form; cancel without saving fake data. Verify live write permissions separately with approved real operations.
8. Support: confirm it says “On progress”.
9. Payroll: switch August/September, open How for several groups, and confirm totals remain 8,432,332 / 6,442,833.
10. Finance: switch payment months and compare rows/count/collected total; check Group → Student → Date → Amount → Course Month → Note. Save only a real authorized payment and confirm it appears once in the correct month.
