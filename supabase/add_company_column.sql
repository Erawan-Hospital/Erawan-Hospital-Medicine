-- Run once in the Supabase SQL Editor. Adds the drug company/manufacturer
-- field shown in the "รายการยาทั้งหมด" table and PDF export.

alter table medicines add column if not exists company text;
