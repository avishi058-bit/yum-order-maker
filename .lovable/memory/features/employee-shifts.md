---
name: Employee shifts
description: Eliya Biran clock in/out, real employer cost 41.60 ₪/h (incl. national insurance), hours only shown to him
type: feature
---
Eliya Biran has a clock in/out button in the kitchen top bar (ShiftClock.tsx, with confirm dialog). Work_shifts table (id, employee_name, clock_in, clock_out; RLS admin/kitchen). Only hours worked are shown to him — never pay. Real hourly cost is 41.60 ₪ (40 ₪ + national insurance) — HOURLY_WAGE in DashboardView.tsx, added to wages in net profit. Don't also enter his pay in the monthly wages box (double count).
