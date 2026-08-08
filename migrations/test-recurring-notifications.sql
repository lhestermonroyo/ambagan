-- ============================================================================
-- Manual test — recurring expense notifications (dev)
--
-- Exercises the three paths added in v1.4 without waiting for the hourly cron:
--   * personal (book) recurring  → 'recurring_posted' to the book owner
--   * group recurring            → 'recurring_posted' to the creator
--                                  (+ the existing 'expense_inclusion' to members)
--   * group recurring degraded   → 'recurring_review' to the creator
--
-- Run the sections IN ORDER in the Supabase SQL editor. Each section is a
-- separate statement/block on purpose — the editor commits between them, and
-- §4's HTTP request is only actually sent on commit.
--
-- TARGETS DEV. Everything is unqualified and resolved by the search_path below;
-- the function URL is the `-dev` deployment, which writes to the `dev` schema.
-- To point this at prod you'd change BOTH (don't — seed data in prod is a mess
-- to unpick).
-- ============================================================================

set search_path = dev, public, extensions;

-- ---------------------------------------------------------------------------
-- 0. Who/what are we testing with? Fill YOUR_EMAIL in, run, keep the ids handy.
-- ---------------------------------------------------------------------------
select u.id as user_id, u.email, u.plan, u.plan_expires_at,
       (select count(*) from user_push_tokens_tbl t where t.user_id = u.id) as push_tokens,
       p.notif_recurring_expense
from users_tbl u
left join user_preferences_tbl p on p.user_id = u.id
where u.email = 'YOUR_EMAIL';

-- Books you own, and groups you can post to (need >= 2 members for a real split).
select id as book_id, name from personal_books_tbl
where user_id = (select id from users_tbl where email = 'YOUR_EMAIL');

select g.id as group_id, g.name, g.currency, count(m.member_id) as members
from groups_tbl g
join group_members_tbl m on m.group_id = g.id
where g.admin_id = (select id from users_tbl where email = 'YOUR_EMAIL')
group by g.id, g.name, g.currency
having count(m.member_id) >= 2;

-- ---------------------------------------------------------------------------
-- 1. Preflight — the three things that silently swallow a push.
-- ---------------------------------------------------------------------------
-- a) The pref column must EXIST (migration 2026-08-02_recurring_notifications)
--    and be true. The function reads it as `!prefs[key]`, so a missing column
--    reads as "pref off" and drops every push while still writing the in-app row.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'dev'
  and table_name = 'user_preferences_tbl'
  and column_name = 'notif_recurring_expense';

-- b) You need at least one push token, or you'll only see the in-app row.
--    (0 tokens is fine if you only care about the notifications_tbl half.)

-- c) Recurring is Pro on BOTH sides — isCreatorPro() skips lapsed users, so a
--    free account generates nothing and the run looks like a no-op. Temporarily:
--      update users_tbl set plan = 'pro', plan_expires_at = now() + interval '1 day'
--      where email = 'YOUR_EMAIL';
--    Revert in §6 if this isn't normally a Pro account.

-- ---------------------------------------------------------------------------
-- 2. Seed a DUE personal (book) template.
--
-- next_run_at 5 minutes in the past + daily frequency ⇒ exactly ONE period is
-- owed (the next advance lands in the future), so this can't fan out into a
-- catch-up. Flip to `now() - interval '3 days'` if you want to test the
-- aggregated "posted 3 times — ₱X total" copy instead.
-- ---------------------------------------------------------------------------
insert into personal_recurring_tbl (
  book_id, user_id, amount, description, category, currency,
  frequency, repeat_interval, start_date, end_type, next_run_at, is_active
)
select b.id, b.user_id, 549, 'TEST recurring (book)', 'general', 'PHP',
       'daily', 1, current_date, 'never', now() - interval '5 minutes', true
from personal_books_tbl b
where b.user_id = (select id from users_tbl where email = 'YOUR_EMAIL')
order by b.created_at
limit 1
returning id, book_id, next_run_at;

-- ---------------------------------------------------------------------------
-- 3. Seed DUE group templates — one that posts cleanly, one that degrades.
--
-- Snapshots are camelCase JSONB ({userId, amount, percentage}) because the Edge
-- Function reads them as-is; snake_case here silently produces an empty split
-- and every occurrence degrades to a draft.
-- ---------------------------------------------------------------------------
-- 3a. Clean post → 'recurring_posted' to you + 'expense_inclusion' to the others.
with g as (
  select id, currency, admin_id from groups_tbl
  where id = 'YOUR_GROUP_ID'::uuid
), members as (
  select array_agg(member_id) as ids, count(*)::int as n
  from group_members_tbl where group_id = (select id from g)
)
insert into recurring_expenses_tbl (
  group_id, creator_id, amount, description, currency, split_type,
  payers_snapshot, splits_snapshot,
  frequency, repeat_interval, start_date, end_type, next_run_at, is_active
)
select
  g.id, g.admin_id, 600, 'TEST recurring (group)', g.currency, 'equal',
  jsonb_build_array(jsonb_build_object('userId', g.admin_id, 'amount', 600)),
  (select jsonb_agg(jsonb_build_object(
     'userId', m,
     'amount', round(600.0 / members.n, 2),
     'percentage', round(100.0 / members.n, 2)))
   from unnest(members.ids) as m),
  'daily', 1, current_date, 'never', now() - interval '5 minutes', true
from g, members
returning id, group_id, next_run_at;

-- 3b. Degraded → 'recurring_review'. The payer in the snapshot is a uuid that
--     isn't in the group (snapshots have no FK), which is exactly what a member
--     leaving looks like to the generator: validPayers is empty ⇒ draft.
with g as (
  select id, currency, admin_id from groups_tbl
  where id = 'YOUR_GROUP_ID'::uuid
)
insert into recurring_expenses_tbl (
  group_id, creator_id, amount, description, currency, split_type,
  payers_snapshot, splits_snapshot,
  frequency, repeat_interval, start_date, end_type, next_run_at, is_active
)
select
  g.id, g.admin_id, 300, 'TEST recurring (needs review)', g.currency, 'equal',
  jsonb_build_array(jsonb_build_object('userId', gen_random_uuid(), 'amount', 300)),
  jsonb_build_array(jsonb_build_object('userId', gen_random_uuid(), 'amount', 300, 'percentage', 100)),
  'daily', 1, current_date, 'never', now() - interval '5 minutes', true
from g
returning id, group_id, next_run_at;

-- ---------------------------------------------------------------------------
-- 4. Fire the function — same call the cron makes, minus the schedule.
--
-- The request is queued and only sent when this statement COMMITS, so the
-- returned id is a request id, not a result. Give it a second, then read §5.
-- Requires the service_role_key Vault secret to hold the NEW sb_secret_… key —
-- a legacy eyJ… JWT returns 401 (the function compares it byte-for-byte).
-- ---------------------------------------------------------------------------
select net.http_post(
  url     := 'https://zwlzyvvhgfmffjzzvrjx.supabase.co/functions/v1/run-recurring-dev',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'service_role_key'
    )
  ),
  body    := '{}'::jsonb
) as request_id;

-- ---------------------------------------------------------------------------
-- 5. Inspect.
-- ---------------------------------------------------------------------------
-- 5a. The function's own tally. Expect status 200 and a body like
--     {"processed":2,"generated":1,"drafts":1,"personalProcessed":1,"personalGenerated":1}
--     401 here = Vault key wrong/rolled. 500 = check the function logs.
select id, status_code, content, created
from net._http_response
order by created desc
limit 3;

-- 5b. The notifications. Expect ONE row per template per run — if a catch-up
--     produced N occurrences and you see N rows, the aggregation regressed.
select n.id, n.type, n.created_at, n.reference_id, n.is_read,
       (n.from_user_id = n.to_user_id) as self_addressed
from notifications_tbl n
where n.to_user_id = (select id from users_tbl where email = 'YOUR_EMAIL')
  and n.created_at > now() - interval '10 minutes'
order by n.created_at desc;

-- 5c. What actually got posted.
select id, description, amount, currency, expense_date, recurring_id
from personal_expenses_tbl
where recurring_id is not null and created_at > now() - interval '10 minutes';

select id, description, amount, is_draft, expense_date, recurring_id
from expenses_tbl
where recurring_id is not null and created_at > now() - interval '10 minutes';

-- 5d. Schedules advanced? next_run_at should now be ~24h out and last_run_at set.
select id, description, next_run_at, last_run_at, occurrences_count, is_active
from personal_recurring_tbl where description like 'TEST %';
select id, description, next_run_at, last_run_at, occurrences_count, is_active
from recurring_expenses_tbl where description like 'TEST %';

-- 5e. Pref respected? Turn it off, re-run §4, and confirm NO new notification
--     row appears for the recurring types (the pref gates the push; the row is
--     written first, so an off pref should still produce the in-app row —
--     that's the intended behaviour, only the push is suppressed).
--   update user_preferences_tbl set notif_recurring_expense = false
--   where user_id = (select id from users_tbl where email = 'YOUR_EMAIL');

-- ---------------------------------------------------------------------------
-- 6. Cleanup — order matters (expenses reference the templates).
-- ---------------------------------------------------------------------------
delete from notifications_tbl
where reference_id in (
  select id from personal_expenses_tbl where recurring_id in (select id from personal_recurring_tbl where description like 'TEST %')
  union all
  select id from expenses_tbl where recurring_id in (select id from recurring_expenses_tbl where description like 'TEST %')
);

-- Group expenses have children (payers / member splits / payment splits) and
-- their own notifications; delete those first if FKs complain.
delete from payment_splits_tbl where expense_id in (select id from expenses_tbl where recurring_id in (select id from recurring_expenses_tbl where description like 'TEST %'));
delete from member_splits_tbl  where expense_id in (select id from expenses_tbl where recurring_id in (select id from recurring_expenses_tbl where description like 'TEST %'));
delete from expense_payers_tbl where expense_id in (select id from expenses_tbl where recurring_id in (select id from recurring_expenses_tbl where description like 'TEST %'));
delete from expenses_tbl where recurring_id in (select id from recurring_expenses_tbl where description like 'TEST %');
delete from personal_expenses_tbl where recurring_id in (select id from personal_recurring_tbl where description like 'TEST %');

delete from recurring_expenses_tbl where description like 'TEST %';
delete from personal_recurring_tbl  where description like 'TEST %';

-- And revert the plan if you upgraded yourself in §1c:
--   update users_tbl set plan = 'free', plan_expires_at = null where email = 'YOUR_EMAIL';
