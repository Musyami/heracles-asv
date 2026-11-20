-- schema.sql
-- Skema Database Supabase untuk ASV Dashboard Barunastra ITS (Nala 16, KKI 2026)
-- Sesuai spesifikasi Model Data di AGENTS.md

-- 1. Tabel live_state (Menyimpan snapshot telemetri terkini robot, tepat 1 baris)
create table if not exists public.live_state (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Inisialisasi baris pertama jika belum ada
insert into public.live_state (id, data, updated_at)
values (1, '{"connection": "disconnected", "missionState": "IDLE"}'::jsonb, now())
on conflict (id) do nothing;

-- Tambahkan tabel live_state ke publication Realtime agar perubahan data langsung di-broadcast ke web
alter publication supabase_realtime add table public.live_state;

-- 2. Tabel runs (Menyimpan riwayat satu sesi/run misi penuh)
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null check (status in ('running', 'finished', 'aborted')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary jsonb default '{}'::jsonb
);

-- 3. Tabel run_samples (Sampel telemetri berkala ~1 Hz selama sesi run berlangsung)
create table if not exists public.run_samples (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs(id) on delete cascade,
  t real not null, -- detik sejak misi dimulai
  mission_state text,
  battery_pct real,
  battery_v real,
  x real,
  y real,
  yaw real,
  thrust_left real,
  thrust_right real,
  kill_switch boolean default false,
  gripper text
);

-- Index gabungan (run_id, t) untuk query sampling cepat saat pemutaran ulang (replay)
create index if not exists idx_run_samples_run_id_t on public.run_samples (run_id, t);

-- 4. Tabel run_events (Kejadian diskrit seperti pick, place, gate_pass, estop selama run)
create table if not exists public.run_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs(id) on delete cascade,
  t real not null,
  type text not null,
  data jsonb default '{}'::jsonb
);

-- Index gabungan (run_id, t) untuk query log kejadian run
create index if not exists idx_run_events_run_id_t on public.run_events (run_id, t);
