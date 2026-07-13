-- Run this once in the Supabase SQL Editor, after schema.sql, to allow the
-- browser to subscribe to live changes on medicines/receiving_logs/dispensing_logs.
--
-- This does NOT touch the `users` table — it stays fully locked down (no
-- policy = no anon access), so passwords are never reachable from the browser.
-- Reading medicines/receiving/dispensing publicly is no new exposure: /api/data
-- already serves this same data to anyone without login.

drop policy if exists "Public read access" on medicines;
create policy "Public read access" on medicines for select using (true);

drop policy if exists "Public read access" on receiving_logs;
create policy "Public read access" on receiving_logs for select using (true);

drop policy if exists "Public read access" on dispensing_logs;
create policy "Public read access" on dispensing_logs for select using (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'medicines') then
    alter publication supabase_realtime add table medicines;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'receiving_logs') then
    alter publication supabase_realtime add table receiving_logs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'dispensing_logs') then
    alter publication supabase_realtime add table dispensing_logs;
  end if;
end $$;
