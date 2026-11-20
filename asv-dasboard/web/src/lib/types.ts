/**
 * types.ts
 * Definisi tipe data global untuk dashboard ASV.
 * Mengikuti kontrak ROS 2 topic pada docs/topics.md bagian B dan C.
 */

// Nilai status misi resmi sesuai kontrak topic /asv/mission_state
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

// Status capit dari topic /asv/gripper_state
export type GripperState = 'READY' | 'GRABBING' | 'CARRYING' | 'PLACING';

// Lokasi muatan barang (prisma, bola, kubus)
export type ItemLocation = 'spot1' | 'board' | 'spot2';

export interface ItemsState {
  prism: ItemLocation;
  sphere: ItemLocation;
  cube: ItemLocation;
}

// Data baterai dari topic /asv/battery dan /asv/battery_voltage
export interface BatteryState {
  percentage: number | null; // 0 - 100 %
  voltage: number | null;    // Volt (misal 24.8 V atau 16.2 V)
}

// Data telemetri robot dari /wamv/pose dan /asv/speed
export interface TelemetryState {
  x: number | null;     // meter
  y: number | null;     // meter
  yaw: number | null;   // derajat (°), -180 sampai +180
  speed: number | null; // m/s
}

// Daya thruster kiri dan kanan dari /wamv/thrusters/*/thrust (-850 sampai +850)
export interface ThrustersState {
  left: number | null;
  right: number | null;
}

// Skor tantangan FTP dari topic /ftp/score
export interface FtpScoreState {
  direction: string;                                   // 'Spot1_ke_Spot2'
  attempt: number;                                     // 1 sampai 3
  collisions: number;                                  // Jumlah tabrakan
  status: 'idle' | 'running' | 'finished' | 'failed';  // Status tugas FTP
  score: number | null;                                // Nilai (100 - 20 per tabrakan) atau null
}

// Satu kejadian dalam log dari topic /mission/events
export interface MissionEvent {
  t: number;                          // detik sejak misi mulai
  type: string;                       // start, pick, place, ftp_start, gate_pass, collision, ftp_end, mission_done, estop
  data?: Record<string, unknown>;     // data tambahan (gate, item, carried, buoy, dll.)
}

// Status sistem digital (kill switch, buzzer, spray)
export interface SystemState {
  killSwitch: boolean; // true = aktif (robot dimatikan)
  buzzer: boolean;     // true = bunyi menyala
  spray: boolean;      // true = semprotan menyala
}

// Status koneksi data sumber ke dashboard
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

// Representasi lengkap state dashboard yang dikelola store
export interface DashboardStoreState {
  connection: ConnectionStatus;
  missionState: MissionState;
  battery: BatteryState;
  system: SystemState;
  gripper: GripperState;
  items: ItemsState;
  telemetry: TelemetryState;
  thrusters: ThrustersState;
  ftpScore: FtpScoreState;
  events: MissionEvent[];
  missionTime: number; // detik berjalan sejak keluar dari IDLE
  cameraImage: string | null; // data base64 atau data URL dari /overview_camera/image
  isFallbackData?: boolean; // penanda aktif saat data berasal dari file cadangan demo-run.json
  lastUpdated: number; // timestamp Date.now() saat pesan terakhir diterima
}
