-- policies.sql
-- Aturan Keamanan Row Level Security (RLS) untuk ASV Dashboard Barunastra ITS
-- Sesuai spesifikasi di AGENTS.md:
-- 1. RLS aktif di seluruh tabel.
-- 2. Policy SELECT diizinkan untuk peranan 'anon' dan 'authenticated' (baca publik).
-- 3. TIDAK ADA policy insert/update/delete untuk peranan anon.
-- 4. Bridge menulis data menggunakan Service Role Key yang otomatis melewati RLS (bypasses RLS).

-- Aktifkan RLS pada keempat tabel
alter table public.live_state enable row level security;
alter table public.runs enable row level security;
alter table public.run_samples enable row level security;
alter table public.run_events enable row level security;

-- Policy SELECT untuk live_state
drop policy if exists "Izinkan baca publik live_state" on public.live_state;
create policy "Izinkan baca publik live_state"
  on public.live_state
  for select
  to anon, authenticated
  using (true);

-- Policy SELECT untuk runs
drop policy if exists "Izinkan baca publik runs" on public.runs;
create policy "Izinkan baca publik runs"
  on public.runs
  for select
  to anon, authenticated
  using (true);

-- Policy SELECT untuk run_samples
drop policy if exists "Izinkan baca publik run_samples" on public.run_samples;
create policy "Izinkan baca publik run_samples"
  on public.run_samples
  for select
  to anon, authenticated
  using (true);

-- Policy SELECT untuk run_events
drop policy if exists "Izinkan baca publik run_events" on public.run_events;
create policy "Izinkan baca publik run_events"
  on public.run_events
  for select
  to anon, authenticated
  using (true);
