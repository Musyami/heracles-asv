/**
 * tools/make-demo-run.ts
 * Skrip satu kali yang mensimulasikan satu run misi penuh (± 102 detik)
 * dan menulis hasilnya ke web/public/demo-run.json.
 *
 * Cara pakai:
 *   npx tsx tools/make-demo-run.ts
 *
 * Tidak ada koneksi Supabase, tidak ada koneksi ROS. Hanya komputasi lokal.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// TIPE DATA (cermin dari web/src/lib/types.ts)
// ============================================================

interface RunSample {
  t: number;           // detik sejak misi mulai
  mission_state: string;
  battery_pct: number;
  battery_v: number;
  x: number;
  y: number;
  yaw: number;         // derajat
  thrust_left: number;
  thrust_right: number;
  kill_switch: boolean;
  gripper: string;
}

interface RunEvent {
  t: number;
  type: string;
  data: Record<string, unknown>;
}

interface RunSummary {
  total_time_s: number;
  collisions: number;
  score: number;
  items_delivered: number;
  direction: string;
}

interface DemoRun {
  run: {
    id: string;
    name: string;
    status: string;
    started_at: string;
    ended_at: string;
    summary: RunSummary;
  };
  events: RunEvent[];
  samples: RunSample[];
}

// ============================================================
// PARAMETER SIMULASI
// ============================================================

// Durasi total simulasi (detik)
const TOTAL_DURATION_S = 102;

// Interval sampel (detik) — 1 sampel per detik
const SAMPLE_INTERVAL_S = 2;

// Waktu mulai referensi (ISO string)
const STARTED_AT = '2026-11-20T10:00:00Z';

// ============================================================
// FUNGSI HELPER
// ============================================================

/** Membulatkan angka ke N desimal */
function round(n: number, dec = 1): number {
  return +n.toFixed(dec);
}

/** Menginterpolasi linier dari a ke b, progress 0..1 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Menghitung quaternion-z dari sudut yaw dalam derajat */
function yawToQz(yawDeg: number): number {
  return Math.sin((yawDeg * Math.PI) / 180 / 2);
}
// Fungsi di atas tidak terpakai di output JSON akhir, tapi berguna bila diperlukan

// ============================================================
// LOGIKA SIMULASI MISI
// ============================================================

/**
 * Menentukan state misi pada waktu t (dalam detik).
 * Fase misi:
 *   0  - 5s  : IDLE
 *   5  - 15s : START
 *  15  - 35s : PICK_UP
 *  35  - 63s : FOLLOW_PATH
 *  63  - 73s : DOCKING
 *  73  - 90s : PLACE_ITEM
 *  90  - 100s: BUZZER_SPRAY
 * 100  - 102s: DONE
 */
function getMissionState(t: number): string {
  if (t < 6)   return 'IDLE';
  if (t < 16)  return 'START';
  if (t < 36)  return 'PICK_UP';
  if (t < 64)  return 'FOLLOW_PATH';
  if (t < 74)  return 'DOCKING';
  if (t < 90)  return 'PLACE_ITEM';
  if (t < 100) return 'BUZZER_SPRAY';
  return 'DONE';
}

/** Menentukan state gripper pada waktu t */
function getGripperState(t: number): string {
  if (t < 5)   return 'READY';
  if (t < 16)  return 'READY';
  // Ambil barang pertama
  if (t < 18)  return 'GRABBING';
  if (t < 20)  return 'CARRYING';
  // Ambil barang kedua
  if (t < 22)  return 'GRABBING';
  if (t < 24)  return 'CARRYING';
  // Ambil barang ketiga
  if (t < 26)  return 'GRABBING';
  // Bawa selama FOLLOW_PATH dan DOCKING
  if (t < 73)  return 'CARRYING';
  // Taruh barang pertama
  if (t < 76)  return 'PLACING';
  if (t < 78)  return 'READY';
  // Taruh barang kedua
  if (t < 82)  return 'PLACING';
  if (t < 84)  return 'READY';
  // Taruh barang ketiga
  if (t < 86)  return 'PLACING';
  return 'READY';
}

/** Menghitung posisi robot (x, y) dan yaw pada waktu t */
function getRobotPose(t: number): { x: number; y: number; yaw: number } {
  if (t < 6) {
    // IDLE di Spot 1
    return { x: 2.2, y: 6.0, yaw: 0 };
  }
  if (t < 16) {
    // START — bergerak dari x=2.2 ke x=3.2
    const p = (t - 6) / 10;
    return { x: round(lerp(2.2, 3.2, p), 2), y: 6.0, yaw: 0 };
  }
  if (t < 36) {
    // PICK_UP — diam di x=3.2
    return { x: 3.2, y: 6.0, yaw: 0 };
  }
  if (t < 64) {
    // FOLLOW_PATH — bergerak dari x=3.5 ke x=21.0 dengan sedikit osilasi y
    const p = (t - 36) / 28;
    const x = round(lerp(3.5, 21.0, p), 2);
    // Osilasi kecil pada y agar lintasan terlihat realistis
    const y = round(6.0 + Math.sin(p * Math.PI * 2.5) * 0.8, 2);
    const yaw = Math.round(Math.cos(p * Math.PI * 2.5) * 12);
    return { x, y, yaw };
  }
  if (t < 74) {
    // DOCKING — masuk ke Spot 2 (x=21.0 → x=21.8)
    const p = (t - 64) / 10;
    return { x: round(lerp(21.0, 21.8, p), 2), y: 6.0, yaw: 0 };
  }
  // PLACE_ITEM, BUZZER_SPRAY, DONE — diam di Spot 2
  return { x: 21.8, y: 6.0, yaw: 0 };
}

/** Menghitung daya dorong thruster kiri dan kanan pada waktu t */
function getThrusters(t: number, state: string): { left: number; right: number } {
  switch (state) {
    case 'IDLE':
      return { left: 0, right: 0 };
    case 'START': {
      // Akselerasi lalu deselerasi
      const p = (t - 6) / 10;
      if (p < 0.4) {
        return { left: Math.round(lerp(0, 200, p / 0.4)), right: Math.round(lerp(0, 200, p / 0.4)) };
      }
      return { left: Math.round(lerp(200, 60, (p - 0.4) / 0.6)), right: Math.round(lerp(200, 60, (p - 0.4) / 0.6)) };
    }
    case 'PICK_UP':
      return { left: 30, right: 30 };
    case 'FOLLOW_PATH': {
      // Variasi kecil untuk tampilan realistis
      const p = (t - 36) / 28;
      const base = 420;
      const diff = Math.round(Math.sin(p * Math.PI * 3) * 60);
      return { left: base - diff, right: base + diff };
    }
    case 'DOCKING': {
      // Deselerasi masuk dermaga
      const p = (t - 64) / 10;
      const thr = Math.round(lerp(150, 0, p));
      return { left: thr, right: thr };
    }
    default:
      return { left: 0, right: 0 };
  }
}

// ============================================================
// SIMULASI UTAMA
// ============================================================

/** Membuat array sampel setiap SAMPLE_INTERVAL_S detik */
function buildSamples(): RunSample[] {
  const samples: RunSample[] = [];
  // Baterai mulai 96%, turun ± 10% selama misi 102 detik
  const BATT_START = 96.0;
  const BATT_END = 85.8;

  for (let t = 0; t <= TOTAL_DURATION_S; t += SAMPLE_INTERVAL_S) {
    const state = getMissionState(t);
    const gripper = getGripperState(t);
    const pose = getRobotPose(t);
    const thrusters = getThrusters(t, state);

    const battPct = round(lerp(BATT_START, BATT_END, t / TOTAL_DURATION_S), 1);
    // Voltase linier dengan persentase (asumsi 24.8V full, 22.5V akhir misi)
    const battV = round(lerp(24.8, 22.5, t / TOTAL_DURATION_S), 1);

    samples.push({
      t: round(t, 1),
      mission_state: state,
      battery_pct: battPct,
      battery_v: battV,
      x: pose.x,
      y: pose.y,
      yaw: pose.yaw,
      thrust_left: thrusters.left,
      thrust_right: thrusters.right,
      kill_switch: false,
      gripper,
    });
  }
  return samples;
}

/** Membuat daftar event misi */
function buildEvents(): RunEvent[] {
  return [
    // t=0: Misi mulai
    { t: 0.0, type: 'start', data: { description: 'Misi dimulai dari dermaga Spot 1' } },

    // Pick up 3 barang
    { t: 16.5, type: 'pick', data: { item: 'cube',   carried: 1 } },
    { t: 22.0, type: 'pick', data: { item: 'sphere', carried: 2 } },
    { t: 28.5, type: 'pick', data: { item: 'prism',  carried: 3 } },

    // FTP dimulai
    { t: 35.0, type: 'ftp_start', data: { direction: 'Spot1_ke_Spot2', attempt: 1 } },

    // Melewati 3 gerbang
    { t: 41.2, type: 'gate_pass', data: { gate: 1, description: 'Melintasi Gate 1 (lebar 2.0m)' } },
    { t: 49.5, type: 'gate_pass', data: { gate: 2, description: 'Melintasi Gate 2 (lebar 1.5m)' } },
    { t: 58.8, type: 'gate_pass', data: { gate: 3, description: 'Melintasi Gate 3 (lebar 2.0m)' } },

    // Docking berhasil
    { t: 65.0, type: 'docking', data: { dock: 'Spot 2', status: 'berhasil' } },

    // Taruh 3 barang
    { t: 76.0, type: 'place', data: { item: 'cube',   carried: 2 } },
    { t: 81.5, type: 'place', data: { item: 'sphere', carried: 1 } },
    { t: 87.0, type: 'place', data: { item: 'prism',  carried: 0 } },

    // Buzzer dan semprot air
    { t: 92.0, type: 'buzzer_spray', data: { buzzer: true, spray: true } },

    // Misi selesai
    { t: 101.5, type: 'mission_done', data: { status: 'sukses', score: 100 } },
  ];
}

// ============================================================
// ENTRY POINT
// ============================================================

function main() {
  console.log('[make-demo-run] Memulai simulasi misi...');

  const samples = buildSamples();
  const events  = buildEvents();

  // Hitung waktu selesai dari STARTED_AT + TOTAL_DURATION_S
  const startedMs = new Date(STARTED_AT).getTime();
  const endedAt   = new Date(startedMs + TOTAL_DURATION_S * 1000).toISOString();

  const demoRun: DemoRun = {
    run: {
      id:         'demo-run-nala16-cadangan',
      name:       'Simulasi Misi KKI 2026 — Data Cadangan',
      status:     'finished',
      started_at: STARTED_AT,
      ended_at:   endedAt,
      summary: {
        total_time_s:    TOTAL_DURATION_S,
        collisions:      0,
        score:           100,
        items_delivered: 3,
        direction:       'Spot 1 → Spot 2',
      },
    },
    events,
    samples,
  };

  // Tulis ke web/public/demo-run.json
  const outPath = path.resolve(__dirname, '../web/public/demo-run.json');
  fs.writeFileSync(outPath, JSON.stringify(demoRun, null, 2) + '\n', 'utf-8');

  console.log(`[make-demo-run] Selesai!`);
  console.log(`  - Sampel  : ${samples.length} baris (interval ${SAMPLE_INTERVAL_S}s)`);
  console.log(`  - Event   : ${events.length} kejadian`);
  console.log(`  - Durasi  : ${TOTAL_DURATION_S} detik`);
  console.log(`  - Output  : ${outPath}`);
}

// Fungsi yawToQz tidak dipanggil di JSON output akhir; ini mencegah warning TS unused
void (yawToQz);

main();
