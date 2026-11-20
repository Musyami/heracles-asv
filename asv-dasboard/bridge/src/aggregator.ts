/**
 * aggregator.ts
 * Menggabungkan seluruh pesan topic ROS 2 yang terpisah menjadi satu snapshot data lengkap.
 * Menyediakan fungsi pembaca snapshot dan pencatat kejadian diskrit.
 */

import {
  LiveStatePayload,
  MissionState,
  GripperState,
  MissionEvent,
  RunSampleRow,
  RunSummary,
} from './types';

// State internal memori bridge
const internalState: LiveStatePayload = {
  connection: 'disconnected',
  missionState: 'IDLE',
  battery: {
    percentage: null,
    voltage: null,
  },
  system: {
    killSwitch: false,
    buzzer: false,
    spray: false,
  },
  gripper: 'READY',
  items: {
    prism: 'spot1',
    sphere: 'spot1',
    cube: 'spot1',
  },
  telemetry: {
    x: null,
    y: null,
    yaw: null,
    speed: null,
  },
  thrusters: {
    left: null,
    right: null,
  },
  ftpScore: {
    direction: 'Spot 1 → Spot 2',
    attempt: 1,
    collisions: 0,
    status: 'idle',
    score: null,
  },
  events: [],
  missionTime: 0,
  cameraImage: null, // Sesuai AGENTS.md: Jangan pernah mengunggah gambar ke Supabase
  lastUpdated: 0,
};

// Waktu awal saat state keluar dari IDLE (untuk menghitung missionTime bila /clock tidak ada)
let missionStartTimestamp: number | null = null;

// Pendengar (listener) callback saat ada perubahan state atau kejadian
type StateListener = (snapshot: LiveStatePayload) => void;
type EventListener = (event: MissionEvent) => void;

const stateListeners: StateListener[] = [];
const eventListeners: EventListener[] = [];

export function onSnapshotChange(cb: StateListener) {
  stateListeners.push(cb);
}

export function onNewMissionEvent(cb: EventListener) {
  eventListeners.push(cb);
}

function notifyChange() {
  internalState.lastUpdated = Date.now();
  for (const cb of stateListeners) {
    try {
      cb(internalState);
    } catch (e) {
      console.error('[Aggregator] Error pada listener snapshot:', e);
    }
  }
}

/**
 * Mendapatkan salinan snapshot telemetri saat ini
 */
export function getCurrentSnapshot(): LiveStatePayload {
  return JSON.parse(JSON.stringify(internalState));
}

/**
 * Mengubah status koneksi rosbridge
 */
export function setConnectionStatus(status: 'connected' | 'connecting' | 'disconnected') {
  internalState.connection = status;
  notifyChange();
}

/**
 * Pembaruan Mission State (/asv/mission_state)
 */
export function updateMissionState(state: string) {
  const normalized = (state || 'IDLE').toUpperCase() as MissionState;
  const prevState = internalState.missionState;

  if (prevState === 'IDLE' && normalized !== 'IDLE') {
    // Mulai misi baru
    missionStartTimestamp = Date.now();
    internalState.missionTime = 0.1;
  } else if (normalized === 'IDLE') {
    // Reset misi ke kondisi awal
    missionStartTimestamp = null;
    internalState.missionTime = 0;
    internalState.items = { prism: 'spot1', sphere: 'spot1', cube: 'spot1' };
    internalState.events = [];
  }

  internalState.missionState = normalized;
  notifyChange();
}

/**
 * Pembaruan Baterai (/asv/battery & /asv/battery_voltage)
 */
export function updateBatteryPercentage(pct: number) {
  internalState.battery.percentage = pct;
  notifyChange();
}

export function updateBatteryVoltage(volt: number) {
  internalState.battery.voltage = volt;
  notifyChange();
}

/**
 * Pembaruan Status Sistem (/asv/kill_switch, /asv/buzzer, /asv/spray)
 */
export function updateKillSwitch(active: boolean) {
  internalState.system.killSwitch = Boolean(active);
  notifyChange();
}

export function updateBuzzer(active: boolean) {
  internalState.system.buzzer = Boolean(active);
  notifyChange();
}

export function updateSpray(active: boolean) {
  internalState.system.spray = Boolean(active);
  notifyChange();
}

/**
 * Pembaruan Capit (/asv/gripper_state)
 */
export function updateGripperState(state: string) {
  internalState.gripper = (state || 'READY').toUpperCase() as GripperState;
  notifyChange();
}

/**
 * Pembaruan Telemetri (/wamv/pose & /asv/speed)
 */
export function updatePose(x: number | null, y: number | null, yaw: number | null) {
  if (x !== null) internalState.telemetry.x = x;
  if (y !== null) internalState.telemetry.y = y;
  if (yaw !== null) internalState.telemetry.yaw = yaw;
  notifyChange();
}

export function updateSpeed(speed: number) {
  internalState.telemetry.speed = speed;
  notifyChange();
}

/**
 * Pembaruan Thruster (/wamv/thrusters/left/thrust dan right)
 */
export function updateThrusters(left: number | null, right: number | null) {
  if (left !== null) internalState.thrusters.left = Math.round(left);
  if (right !== null) internalState.thrusters.right = Math.round(right);
  notifyChange();
}

/**
 * Pembaruan Skor FTP (/ftp/score)
 */
export function updateFtpScore(data: {
  direction?: string;
  attempt?: number;
  collisions?: number;
  status?: 'idle' | 'running' | 'finished' | 'failed';
  score?: number | null;
}) {
  internalState.ftpScore = {
    direction: data.direction || internalState.ftpScore.direction,
    attempt: data.attempt ?? internalState.ftpScore.attempt,
    collisions: data.collisions ?? internalState.ftpScore.collisions,
    status: data.status || internalState.ftpScore.status,
    score: data.score ?? internalState.ftpScore.score,
  };
  notifyChange();
}

/**
 * Pembaruan Log Kejadian Misi (/mission/events)
 */
export function addMissionEvent(event: MissionEvent) {
  // Tambahkan ke daftar kejadian terkini (maks 25 kejadian terakhir untuk live_state)
  internalState.events = [event, ...internalState.events].slice(0, 25);

  // Perbarui lokasi barang muatan secara otomatis dari kejadian pick / place
  if (event.type === 'pick' && event.data?.item) {
    const itemKey = event.data.item as keyof typeof internalState.items;
    if (internalState.items[itemKey]) internalState.items[itemKey] = 'board';
  } else if (event.type === 'place' && event.data?.item) {
    const itemKey = event.data.item as keyof typeof internalState.items;
    if (internalState.items[itemKey]) internalState.items[itemKey] = 'spot2';
  }

  // Jika event memiliki waktu t, sinkronkan missionTime
  if (typeof event.t === 'number') {
    internalState.missionTime = event.t;
  }

  notifyChange();

  // Beritahu uploader bahwa ada kejadian penting baru untuk segera diunggah
  for (const cb of eventListeners) {
    try {
      cb(event);
    } catch (e) {
      console.error('[Aggregator] Error pada listener event:', e);
    }
  }
}

/**
 * Menghitung waktu misi (detik sejak keluar dari IDLE)
 */
export function getCalculatedMissionTime(): number {
  if (missionStartTimestamp === null) {
    return internalState.missionTime;
  }
  const elapsedSec = (Date.now() - missionStartTimestamp) / 1000;
  internalState.missionTime = +elapsedSec.toFixed(1);
  return internalState.missionTime;
}

/**
 * Membuat satu baris sampel untuk tabel `run_samples`
 */
export function createRunSampleRow(runId: string): RunSampleRow {
  const t = getCalculatedMissionTime();
  return {
    run_id: runId,
    t: +t.toFixed(1),
    mission_state: internalState.missionState,
    battery_pct: internalState.battery.percentage,
    battery_v: internalState.battery.voltage,
    x: internalState.telemetry.x,
    y: internalState.telemetry.y,
    yaw: internalState.telemetry.yaw,
    thrust_left: internalState.thrusters.left,
    thrust_right: internalState.thrusters.right,
    kill_switch: internalState.system.killSwitch,
    gripper: internalState.gripper,
  };
}

/**
 * Menghasilkan ringkasan akhir misi untuk tabel `runs`
 */
export function generateRunSummary(): RunSummary {
  // Hitung barang yang berhasil diantar ke Spot 2
  let delivered = 0;
  if (internalState.items.cube === 'spot2') delivered++;
  if (internalState.items.sphere === 'spot2') delivered++;
  if (internalState.items.prism === 'spot2') delivered++;

  const collisions = internalState.ftpScore.collisions || 0;
  // Skor FTP standar: 100 dikurangi 20 per tabrakan
  const finalScore =
    internalState.ftpScore.score !== null
      ? internalState.ftpScore.score
      : Math.max(0, 100 - collisions * 20);

  return {
    total_time_s: getCalculatedMissionTime(),
    collisions,
    score: finalScore,
    items_delivered: delivered,
    direction: internalState.ftpScore.direction,
  };
}
