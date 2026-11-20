/**
 * config.ts
 * Konfigurasi utama aplikasi dan daftar nama topic ROS 2 di SATU tempat.
 * Mengikuti docs/topics.md bagian B dan C.
 */

// ============================================================
// DAFTAR TOPIC ROS 2 RESMI (docs/topics.md bagian B)
// ============================================================
export const TOPICS = {
  // Kontrak Dashboard (Wajib dipublikasikan robot/Control/ELC)
  MISSION_STATE: '/asv/mission_state',
  BATTERY: '/asv/battery',
  BATTERY_VOLTAGE: '/asv/battery_voltage',
  KILL_SWITCH: '/asv/kill_switch',
  KILL_SWITCH_CMD: '/dashboard/kill_switch_cmd',
  GRIPPER_STATE: '/asv/gripper_state',
  BUZZER: '/asv/buzzer',
  SPRAY: '/asv/spray',
  SPEED: '/asv/speed',
  THRUST_LEFT: '/wamv/thrusters/left/thrust',
  THRUST_RIGHT: '/wamv/thrusters/right/thrust',
  FTP_SCORE: '/ftp/score',
  MISSION_EVENTS: '/mission/events',

  // Topic bawaan simulasi VRX / Gazebo (docs/topics.md bagian A)
  // CEK: Tipe dan satuan topic bawaan perlu diverifikasi dengan `ros2 topic info -v`
  POSE: '/wamv/pose',
  FTP_BUOYS: '/ftp/buoys',
  FTP_PATH: '/ftp/path',
  CLOCK: '/clock',
  OVERVIEW_CAMERA: '/overview_camera/image',
} as const;

// Parameter kontrol thruster statis untuk tampilan kartu Thruster
export const THRUSTER_CONFIG = {
  MAX_THRUST: 850,
  PARAMS_LABEL: 'cruise 0,4 m/s · Kp 2,0 · Ki 0 · Kd 0,7 · max 850',
} as const;

// Konfigurasi arena kolam dan transformasi koordinat
export const ARENA_CONFIG = {
  POOL_WIDTH: 24.0, // meter (panjang kolam barat ke timur)
  POOL_HEIGHT: 12.0, // meter (lebar kolam selatan ke utara)

  // Transformasi koordinat dari dunia VRX/Gazebo ke arena (meter)
  // arena_x = (vrx_x * scaleX) + offsetX
  // arena_y = (vrx_y * scaleY) + offsetY
  COORDINATE_TRANSFORM: {
    scaleX: 1.0,
    scaleY: 1.0,
    offsetX: 0.0,
    offsetY: 0.0,
    invertY: false, // jika sumbu Y di simulator terbalik
  },

  // Pengaturan jejak pergerakan kapal (trail)
  TRAIL: {
    MAX_POINTS: 80,
    MIN_DISTANCE: 0.1, // meter antar titik jejak
  },
} as const;

// Batas waktu tanpa pesan baru sebelum data dianggap "data basi" (3 detik)
export const STALE_TIMEOUT_MS = 3000;

// Teks keterangan di bawah kartu Mission State (docs/topics.md bagian C)
export const MISSION_STATE_DESCRIPTIONS: Record<string, string> = {
  IDLE: 'Menunggu',
  START: 'Slot Spot 1',
  PICK_UP: 'Mengambil barang di Spot 1',
  FOLLOW_PATH: 'Menuju Spot 2',
  DOCKING: 'Docking di Spot 2',
  PLACE_ITEM: 'Menaruh barang di Spot 2',
  BUZZER_SPRAY: 'Buzzer dan semprot',
  DONE: 'Misi selesai',
  ESTOP: 'Kill switch aktif',
};

// Urutan dan label 6 langkah Mission Progress (docs/topics.md bagian C & dashboard.html)
export const MISSION_PROGRESS_STEPS: [string, string][] = [
  ['Start', 'Spot 1 slot'],
  ['Pick up', 'Spot 1'],
  ['Follow the path', 'Menuju Spot 2'],
  ['Docking', 'Spot 2 slot'],
  ['Place item', 'Spot 2 drop zone'],
  ['Buzzer + spray', 'After last item'],
];

// Konfigurasi visual untuk muatan barang
export const CARGO_ITEMS = {
  prism: { name: 'Prisma', shapeClass: 'tri' },
  sphere: { name: 'Bola', shapeClass: 'cir' },
  cube: { name: 'Kubus', shapeClass: 'sq' },
} as const;
