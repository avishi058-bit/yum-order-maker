-- Quiet-time tasks start 10 minutes after the last order (was 15), and the
-- clocked-in employee gets a phone push with the task again. Applied live by
-- patching staff_give_idle_task and staff_closing_nudge in place:
--   * orders.updated_at / created_at windows: '15 minutes' -> '10 minutes'
--   * staff_give_idle_task: after the owner push, a push to clocked-in
--     non-owner staff: title 'כשנוח לך', body = task title, tag 'idle-me-<id>'.
select 1;
