/**
 * types.ts
 * Definisi tipe data internal bridge.
 * Menjaga struktur data persis sama dengan web/src/lib/types.ts dan model data Supabase.
 */

export type MissionState =
  | 'IDLE'
  | 'START'
  | 'PICK_UP'
  | 'FOLLOW_PATH'
  | 'DOCKING'
  | 'PLACE_ITEM'
  | 'BUZZER_SPRAY'
  | 'DONE'
  | 'ESTOP';

export type GripperState = 'READY' | 'GRABBING' | 'CARRYING' | 'PLACING';

export type ItemLocation = 'spot1' | 'board' | 'spot2';

export interface ItemsState {
  prism: ItemLocation;
  sphere: ItemLocation;
  cube: ItemLocation;
}

export interface BatteryState {
  percentage: number | null;
  voltage: number | null;
}

export interface TelemetryState {
  x: number | null;
  y: number | null;
  yaw: number | null;
  speed: number | null;
}

export interface ThrustersState {
  left: number | null;
  right: number | null;
}

export interface FtpScoreState {
  direction: string;
  attempt: number;
  collisions: number;
  status: 'idle' | 'running' | 'finished' | 'failed';
  score: number | null;
}

export interface MissionEvent {
  t: number;
  type: string;
  data?: Record<string, unknown>;
}

export interface SystemState {
  killSwitch: boolean;
  buzzer: boolean;
  spray: boolean;
}

// Format snapshot telemetri yang disimpan di kolom `data` pada tabel `live_state`
export interface LiveStatePayload {
  connection: 'connected' | 'connecting' | 'disconnected';
  missionState: MissionState;
  battery: BatteryState;
  system: SystemState;
  gripper: GripperState;
  items: ItemsState;
  telemetry: TelemetryState;
  thrusters: ThrustersState;
  ftpScore: FtpScoreState;
  events: MissionEvent[];
  missionTime: number;
  cameraImage: string | null;
  lastUpdated: number;
}

// Format baris pada tabel `run_samples`
export interface RunSampleRow {
  run_id: string;
  t: number;
  mission_state: string;
  battery_pct: number | null;
  battery_v: number | null;
  x: number | null;
  y: number | null;
  yaw: number | null;
  thrust_left: number | null;
  thrust_right: number | null;
  kill_switch: boolean;
  gripper: string;
}

// Format baris pada tabel `run_events`
export interface RunEventRow {
  run_id: string;
  t: number;
  type: string;
  data: Record<string, unknown>;
}

// Format ringkasan summary di tabel `runs`
export interface RunSummary {
  total_time_s: number;
  collisions: number;
  score: number;
  items_delivered: number;
  direction: string;
}
