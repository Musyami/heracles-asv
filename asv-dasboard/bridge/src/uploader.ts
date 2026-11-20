/**
 * uploader.ts
 * Mengirim data telemetri dan log ke Supabase menggunakan Service Role Key:
 * 1. live_state: Maksimal 2 Hz (setiap 500 ms) diperbarui ke baris id=1.
 * 2. runs:
 *    - Membuat sesi run baru saat mission_state keluar dari IDLE.
 *    - Mengakhiri sesi run saat mission_state menjadi DONE atau ESTOP, mengisi summary akhir (total waktu, tabrakan, skor, barang).
 * 3. run_samples: Sampel berkala 1 Hz dibatch (maksimal 5 sampel per batch) dan di-insert ke database.
 * 4. run_events: Kejadian diskrit (pick, place, gate_pass, dll.) dikirim SEGERA ke tabel run_events.
 * 
 * Jika kredensial Supabase kosong di bridge/.env, uploader beroperasi dalam mode "Simulasi Offline"
 * (mencetak log aktivitas tanpa error atau crash).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BRIDGE_CONFIG, isSupabaseServiceConfigured } from './config';
import {
  getCurrentSnapshot,
  onNewMissionEvent,
  createRunSampleRow,
  generateRunSummary,
} from './aggregator';
import { MissionEvent, RunSampleRow, RunEventRow, MissionState } from './types';

let supabase: SupabaseClient | null = null;
let currentRunId: string | null = null;
let currentRunStatus: 'running' | 'finished' | 'aborted' = 'running';
let lastMissionState: MissionState = 'IDLE';

export function getCurrentRunStatus() {
  return {
    runId: currentRunId,
    status: currentRunStatus,
  };
}

// Antrean sampel telemetri berkala untuk batch upload
let sampleBatchQueue: RunSampleRow[] = [];

// Timers
let liveStateTimer: NodeJS.Timeout | null = null;
let sampleTimer: NodeJS.Timeout | null = null;
let isRunning = false;

export function startUploader(): () => void {
  isRunning = true;

  if (isSupabaseServiceConfigured()) {
    console.log('[Uploader] Supabase Service Role terdeteksi. Memulai koneksi klien...');
    supabase = createClient(
      BRIDGE_CONFIG.SUPABASE_URL,
      BRIDGE_CONFIG.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  } else {
    console.log(
      '[Uploader] Kredensial Supabase di bridge/.env belum disetel. Berjalan dalam mode SIMULASI OFFLINE (log saja).'
    );
  }

  // 1. Loop upload live_state maksimal 2 Hz (500 ms)
  liveStateTimer = setInterval(() => {
    void handleLiveStateTick();
  }, BRIDGE_CONFIG.THROTTLE.LIVE_STATE_MS);

  // 2. Loop sampling 1 Hz (1000 ms)
  sampleTimer = setInterval(() => {
    void handleSampleTick();
  }, BRIDGE_CONFIG.THROTTLE.RUN_SAMPLES_MS);

  // 3. Listener kejadian seketika (run_events segera diunggah)
  onNewMissionEvent((event) => {
    void handleImmediateEvent(event);
  });

  return () => {
    isRunning = false;
    if (liveStateTimer) clearInterval(liveStateTimer);
    if (sampleTimer) clearInterval(sampleTimer);
    // Flush sisa sampel sebelum shutdown
    void flushSampleBatch();
  };
}

/**
 * Mengirim snapshot live_state terkini ke tabel `live_state` (id = 1)
 */
async function handleLiveStateTick() {
  if (!isRunning) return;

  const snapshot = getCurrentSnapshot();
  const state = snapshot.missionState;

  // Deteksi siklus hidup Run (Lifecycle)
  // A. Misi Mulai: State keluar dari IDLE -> buat baris baru di tabel `runs`
  if (lastMissionState === 'IDLE' && state !== 'IDLE' && !currentRunId) {
    await startNewRun();
  }

  // B. Misi Selesai: State berubah menjadi DONE atau ESTOP -> selesaikan run di tabel `runs`
  if (currentRunId && (state === 'DONE' || state === 'ESTOP') && lastMissionState !== state) {
    await finishCurrentRun(state === 'DONE' ? 'finished' : 'aborted');
  }

  // C. Misi Direset: State kembali ke IDLE
  if (state === 'IDLE' && lastMissionState !== 'IDLE') {
    currentRunId = null;
  }

  lastMissionState = state;

  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('live_state')
      .upsert(
        {
          id: 1,
          data: snapshot,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.warn('[Uploader] Gagal memperbarui live_state di Supabase:', error.message);
    }
  } catch (err) {
    console.warn('[Uploader] Error saat upload live_state:', err);
  }
}

/**
 * Mengambil sampel telemetri 1 Hz dan memasukkan ke antrean batch
 */
async function handleSampleTick() {
  if (!isRunning || !currentRunId) return;

  const sample = createRunSampleRow(currentRunId);
  sampleBatchQueue.push(sample);

  // Jika antrean mencapai ukuran batch atau saat run hampir selesai, lakukan flush
  if (sampleBatchQueue.length >= BRIDGE_CONFIG.THROTTLE.BATCH_SAMPLES_SIZE) {
    await flushSampleBatch();
  }
}

/**
 * Mengunggah tumpukan sampel (batch) ke tabel `run_samples`
 */
async function flushSampleBatch() {
  if (sampleBatchQueue.length === 0) return;

  const toUpload = [...sampleBatchQueue];
  sampleBatchQueue = [];

  if (!supabase) {
    console.log(`[Uploader OFFLINE] Merekam batch ${toUpload.length} sampel telemetri run`);
    return;
  }

  try {
    const { error } = await supabase.from('run_samples').insert(toUpload);
    if (error) {
      console.warn('[Uploader] Gagal insert run_samples batch:', error.message);
    }
  } catch (err) {
    console.warn('[Uploader] Error saat upload run_samples:', err);
  }
}

/**
 * Mengunggah satu kejadian diskrit SEGERA ke tabel `run_events`
 */
async function handleImmediateEvent(event: MissionEvent) {
  if (!isRunning) return;

  console.log(`[Uploader] Kejadian baru terdeteksi: [${event.type}] t=${event.t}s`, event.data || '');

  if (!currentRunId) {
    // Jika ada event sebelum run terdaftar, buat run terlebih dahulu
    await startNewRun();
  }

  if (!currentRunId) return;

  const row: RunEventRow = {
    run_id: currentRunId,
    t: event.t,
    type: event.type,
    data: event.data || {},
  };

  if (!supabase) {
    console.log(`[Uploader OFFLINE] Kejadian disimpan ke log memori: ${row.type}`);
    return;
  }

  try {
    const { error } = await supabase.from('run_events').insert(row);
    if (error) {
      console.warn('[Uploader] Gagal insert run_events:', error.message);
    }
  } catch (err) {
    console.warn('[Uploader] Error saat upload run_events:', err);
  }
}

/**
 * Membuat entri run baru di tabel `runs` saat state keluar dari IDLE
 */
async function startNewRun() {
  const timestamp = new Date().toISOString();
  const runName = `Misi ASV KKI — ${new Date().toLocaleTimeString('id-ID')}`;

  if (!supabase) {
    // Mode offline: buat ID acak untuk sesi simulasi
    currentRunId = `offline-run-${Date.now()}`;
    currentRunStatus = 'running';
    console.log(`[Uploader OFFLINE] === MEMULAI SESI RUN BARU [${currentRunId}]: ${runName} ===`);
    return;
  }

  try {
    const { data, error } = await supabase
      .from('runs')
      .insert({
        name: runName,
        status: 'running',
        started_at: timestamp,
        summary: {},
      })
      .select('id')
      .single();

    if (error || !data) {
      console.warn('[Uploader] Gagal membuat run baru di Supabase:', error?.message);
      currentRunId = `fallback-run-${Date.now()}`;
    } else {
      currentRunId = data.id;
      currentRunStatus = 'running';
      console.log(`[Uploader] === SESI RUN BARU DIMULAI DI SUPABASE: [${currentRunId}] ${runName} ===`);
    }
  } catch (err) {
    console.warn('[Uploader] Error saat insert runs:', err);
    currentRunId = `fallback-run-${Date.now()}`;
  }
}

/**
 * Menyelesaikan sesi run di tabel `runs` (mengisi ended_at, status, dan summary)
 */
async function finishCurrentRun(finalStatus: 'finished' | 'aborted') {
  if (!currentRunId) return;

  // Flush seluruh sampel sisa ke database terlebih dahulu
  await flushSampleBatch();

  const summary = generateRunSummary();
  currentRunStatus = finalStatus;

  console.log(
    `[Uploader] === SESI RUN [${currentRunId}] SELESAI DENGAN STATUS: ${finalStatus.toUpperCase()} ===`
  );
  console.log(
    `[Uploader] Ringkasan: Durasi: ${summary.total_time_s}s | Tabrakan: ${summary.collisions} | Skor: ${summary.score} | Barang: ${summary.items_delivered}/3`
  );

  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('runs')
      .update({
        status: finalStatus,
        ended_at: new Date().toISOString(),
        summary,
      })
      .eq('id', currentRunId);

    if (error) {
      console.warn('[Uploader] Gagal memperbarui status akhir run di Supabase:', error.message);
    }
  } catch (err) {
    console.warn('[Uploader] Error saat update akhir run:', err);
  }
}
