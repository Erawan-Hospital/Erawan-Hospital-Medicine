-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)

create table if not exists medicines (
  id bigint generated always as identity primary key,
  code text,
  name text not null,
  unit text,
  warehouse text,
  company text,
  lot text,
  expiry date,
  qty numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists receiving_logs (
  id bigint generated always as identity primary key,
  log_date date not null default current_date,
  log_time text,
  name text not null,
  unit text,
  qty numeric not null default 0,
  lot text,
  expiry date,
  person text,
  place text,
  created_at timestamptz not null default now()
);

create table if not exists dispensing_logs (
  id bigint generated always as identity primary key,
  log_date date not null default current_date,
  log_time text,
  name text not null,
  unit text,
  qty numeric not null default 0,
  lot text,
  expiry date,
  person text,
  place text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id bigint generated always as identity primary key,
  name text not null,
  username text not null unique,
  password text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

-- Seed the two default accounts the app currently ships with.
insert into users (name, username, password, role) values
  ('ผู้ดูแลระบบ', 'admin', 'admin1234', 'admin'),
  ('เจ้าหน้าที่เภสัชกรรม', 'staff', 'staff1234', 'staff')
on conflict (username) do nothing;

-- Row Level Security stays on; all access goes through the Vercel API using
-- the service role key, which bypasses RLS. No public policies are needed.
alter table medicines enable row level security;
alter table receiving_logs enable row level security;
alter table dispensing_logs enable row level security;
alter table users enable row level security;
