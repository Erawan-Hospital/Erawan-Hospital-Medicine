-- Run once in the Supabase SQL Editor. One-time cleanup for data created
-- before รหัสยา (drug code) was made stable-per-name: makes every lot row
-- that shares a drug name share the SAME code (reusing an existing code for
-- that name if one exists, otherwise minting a fresh sequential YA-#####).
-- Safe to re-run — it's idempotent.

do $$
declare
  r record;
  seq int;
  assigned text;
begin
  select coalesce(max(substring(code from '(\d+)')::int), 1000) into seq from medicines where code ~ '\d+';

  for r in select distinct name from medicines order by name loop
    select code into assigned from medicines where name = r.name and code is not null limit 1;
    if assigned is null then
      seq := seq + 1;
      assigned := 'YA-' || lpad(seq::text, 5, '0');
    end if;
    update medicines set code = assigned where name = r.name and (code is distinct from assigned);
  end loop;
end $$;
