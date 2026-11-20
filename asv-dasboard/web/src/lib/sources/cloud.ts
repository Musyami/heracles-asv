/**
 * sources/cloud.ts
 * Sumber data Cloud (Supabase Realtime) dan pembaca riwayat misi (Fase F6).
 *
 * Mengikuti arsitektur AGENTS.md:
 * 1. Berlangganan Realtime tabel `live_state` untuk menyuplai store dashboard publik.
 * 2. Fungsi query untuk membaca daftar run (`runs`), sampel run (`run_samples`), dan kejadian (`run_events`).
 * 3. Jika koneksi gagal atau kredensial Supabase kosong, jatuh ke cadangan `demo-run.json`
 *    dengan tanda isFallbackData = true agar UI menampilkan banner "Data cadangan" tanpa crash.
 */

import { getSupabase, isSupabaseConfigured } from '../supabase';
import { setDashboardState } from '../store';
import { DashboardStoreState, MissionEvent } from '../types';

export interface RunSummary {
  total_time_s?: number;
  collisions?: number;
  score?: number;
  items_delivered?: number;
  direction?: string;
}

export interface RunItem {
  id: string;
  name: string;
  status: 'running' | 'finished' | 'aborted';
  started_at: string;
  ended_at: string | null;
  summary: RunSummary;
}

export interface RunSample {
  id?: number;
  run_id?: string;
  t: number;
  mission_state: string;
  battery_pct: number;
  battery_v: number;
  x: number;
  y: number;
  yaw: number;
  thrust_left: number;
  thrust_right: number;
  kill_switch: boolean;
  gripper: string;
}

export interface RunDetails {
  run: RunItem;
  samples: RunSample[];
  events: MissionEvent[];
  isFallback: boolean;
}

/**
 * Membaca data cadangan demo-run.json dari folder public
 */
export async function loadDemoRunFallback(): Promise<RunDetails> {
  try {
    const res = await fetch('/demo-run.json');
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    return {
      run: data.run,
      samples: data.samples,
      events: data.events,
      isFallback: true,
    };
  } catch (err) {
    console.error('Gagal membaca demo-run.json cadangan:', err);
    // Data darurat minimum agar halaman tidak pernah crash
    return {
      run: {
        id: 'demo-run-nala16-cadangan',
        name: 'Simulasi Misi KKI 2026 (Darurat)',
        status: 'finished',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        summary: { total_time_s: 102, collisions: 0, score: 100, items_delivered: 3 },
      },
      samples: [],
      events: [],
      isFallback: true,
    };
  }
}

/**
 * Mengaktifkan sumber data live_state dari Supabase Realtime
 */
export function startCloudSource(): () => void {
  // Jika Supabase belum dikonfigurasi, langsung gunakan mode cadangan dari demo-run.json
  if (!isSupabaseConfigured()) {
    console.info('Kredensial Supabase belum ada di .env.local. Beralih ke data cadangan demo-run.json...');
    activateFallbackLiveState();
    return () => {};
  }

  const supabase = getSupabase();
  if (!supabase) {
    activateFallbackLiveState();
    return () => {};
  }

  setDashboardState({
    connection: 'connecting',
    isFallbackData: false,
  });

  let isSubscribed = false;

  // 1. Ambil data snapshot awal dari tabel live_state
  supabase
    .from('live_state')
    .select('data, updated_at')
    .eq('id', 1)
    .single()
    .then(
      ({ data, error }) => {
        if (error || !data) {
          console.warn('Gagal membaca live_state awal dari Supabase, menunggu realtime...', error);
        } else if (data.data) {
          applyLiveStatePatch(data.data, false);
        }
      },
      (err: unknown) => {
        console.warn('Error saat query live_state Supabase:', err);
      }
    );

  // 2. Berlangganan Realtime Postgres Changes pada tabel live_state
  const channel = supabase
    .channel('public:live_state')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_state', filter: 'id=eq.1' },
      (payload) => {
        isSubscribed = true;
        const newRecord = payload.new as { data?: Record<string, unknown> };
        if (newRecord && newRecord.data) {
          applyLiveStatePatch(newRecord.data, false);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        setDashboardState({ connection: 'connected', isFallbackData: false });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Koneksi Realtime Supabase terganggu:', err || status);
        if (!isSubscribed) {
          // Bila tidak pernah terhubung, jatuh ke data cadangan agar halaman tetap jalan
          activateFallbackLiveState();
        } else {
          setDashboardState({ connection: 'disconnected' });
        }
      }
    });

  // Pengembalian fungsi unsubscribe (cleanup)
  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Mengaplikasikan patch data live_state dari JSON Supabase ke store aplikasi
 */
function applyLiveStatePatch(data: Record<string, unknown>, isFallback: boolean) {
  setDashboardState((prev) => {
    return {
      ...prev,
      connection: 'connected',
      isFallbackData: isFallback,
      missionState: (data.missionState as DashboardStoreState['missionState']) ?? prev.missionState,
      battery: (data.battery as DashboardStoreState['battery']) ?? prev.battery,
      system: (data.system as DashboardStoreState['system']) ?? prev.system,
      gripper: (data.gripper as DashboardStoreState['gripper']) ?? prev.gripper,
      items: (data.items as DashboardStoreState['items']) ?? prev.items,
      telemetry: (data.telemetry as DashboardStoreState['telemetry']) ?? prev.telemetry,
      thrusters: (data.thrusters as DashboardStoreState['thrusters']) ?? prev.thrusters,
      ftpScore: (data.ftpScore as DashboardStoreState['ftpScore']) ?? prev.ftpScore,
      events: (data.events as DashboardStoreState['events']) ?? prev.events,
      missionTime: (data.missionTime as number) ?? prev.missionTime,
      cameraImage: (data.cameraImage as string | null) ?? null,
      lastUpdated: Date.now(),
    };
  });
}

/**
 * Mengaktifkan status data cadangan saat Supabase tidak tersedia
 */
async function activateFallbackLiveState() {
  const fallback = await loadDemoRunFallback();
  // Ambil sampel terakhir dari fallback sebagai live snapshot
  const lastSample = fallback.samples[fallback.samples.length - 1] || null;

  setDashboardState({
    connection: 'connected',
    isFallbackData: true,
    missionState: (lastSample?.mission_state as DashboardStoreState['missionState']) || 'DONE',
    battery: {
      percentage: lastSample?.battery_pct ?? 88,
      voltage: lastSample?.battery_v ?? 23.4,
    },
    system: {
      killSwitch: lastSample?.kill_switch ?? false,
      buzzer: false,
      spray: false,
    },
    gripper: (lastSample?.gripper as DashboardStoreState['gripper']) || 'READY',
    items: {
      prism: 'spot2',
      sphere: 'spot2',
      cube: 'spot2',
    },
    telemetry: {
      x: lastSample?.x ?? 21.0,
      y: lastSample?.y ?? 6.0,
      yaw: lastSample?.yaw ?? 0,
      speed: 0,
    },
    thrusters: {
      left: lastSample?.thrust_left ?? 0,
      right: lastSample?.thrust_right ?? 0,
    },
    ftpScore: {
      direction: fallback.run.summary.direction || 'Spot 1 → Spot 2',
      attempt: 1,
      collisions: fallback.run.summary.collisions ?? 0,
      status: 'finished',
      score: fallback.run.summary.score ?? 100,
    },
    events: fallback.events,
    missionTime: fallback.run.summary.total_time_s ?? 102,
    cameraImage: null,
    lastUpdated: Date.now(),
  });
}

/**
 * Mengambil daftar seluruh run yang tersimpan di Supabase
 * Jika tabel kosong atau query gagal, kembalikan run dari demo-run.json
 */
export async function fetchRuns(): Promise<{ runs: RunItem[]; isFallback: boolean }> {
  const supabase = getSupabase();
  if (!supabase) {
    const fallback = await loadDemoRunFallback();
    return { runs: [fallback.run], isFallback: true };
  }

  try {
    const { data, error } = await supabase
      .from('runs')
      .select('id, name, status, started_at, ended_at, summary')
      .order('started_at', { ascending: false });

    if (error || !data || data.length === 0) {
      console.warn('Belum ada run di Supabase atau gagal memuat:', error);
      const fallback = await loadDemoRunFallback();
      return { runs: [fallback.run], isFallback: true };
    }

    return { runs: data as RunItem[], isFallback: false };
  } catch (err) {
    console.error('Error saat fetchRuns:', err);
    const fallback = await loadDemoRunFallback();
    return { runs: [fallback.run], isFallback: true };
  }
}

/**
 * Mengambil detail satu run (informasi run, deret sampel waktu t, dan seluruh kejadian)
 */
export async function fetchRunDetails(runId: string): Promise<RunDetails> {
  // Jika ID adalah ID demo cadangan atau Supabase belum dikonfigurasi
  if (runId === 'demo-run-nala16-cadangan' || !isSupabaseConfigured()) {
    return loadDemoRunFallback();
  }

  const supabase = getSupabase();
  if (!supabase) {
    return loadDemoRunFallback();
  }

  try {
    // 1. Ambil meta run
    const { data: runData, error: runError } = await supabase
      .from('runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !runData) {
      console.warn(`Run ${runId} tidak ditemukan di Supabase, fallback ke demo-run.json`);
      return loadDemoRunFallback();
    }

    // 2. Ambil sampel berurutan berdasarkan waktu t
    const { data: samplesData, error: samplesError } = await supabase
      .from('run_samples')
      .select('*')
      .eq('run_id', runId)
      .order('t', { ascending: true });

    // 3. Ambil kejadian berurutan berdasarkan waktu t
    const { data: eventsData, error: eventsError } = await supabase
      .from('run_events')
      .select('t, type, data')
      .eq('run_id', runId)
      .order('t', { ascending: true });

    if (samplesError || eventsError) {
      console.warn('Gagal membaca sampel atau kejadian run:', samplesError || eventsError);
    }

    return {
      run: runData as RunItem,
      samples: (samplesData as RunSample[]) || [],
      events: (eventsData as MissionEvent[]) || [],
      isFallback: false,
    };
  } catch (err) {
    console.error(`Error mengambil run detail untuk ${runId}:`, err);
    return loadDemoRunFallback();
  }
}
