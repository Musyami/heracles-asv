/**
 * config.ts
 * Konfigurasi modul Bridge dan daftar nama topic ROS 2 di SATU tempat.
 * Mengikuti docs/topics.md bagian B dan batasan AGENTS.md.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Muat variabel lingkungan dari file bridge/.env jika ada
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const BRIDGE_CONFIG = {
  // Alamat rosbridge WebSocket (default simulasi: ws://localhost:9090)
  ROSBRIDGE_URL: process.env.ROSBRIDGE_URL || 'ws://localhost:9090',

  // Kredensial Supabase (Hanya dibaca dari bridge/.env)
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Batasan frekuensi pengunggahan (Throttle sesuai AGENTS.md)
  THROTTLE: {
    // live_state maksimal 2 kali per detik (500 ms)
    LIVE_STATE_MS: 500,
    // run_samples 1 kali per detik (1000 ms)
    RUN_SAMPLES_MS: 1000,
    // Ukuran batch maksimal sampel sebelum dikirim sekaligus
    BATCH_SAMPLES_SIZE: 5,
  },
} as const;

// Daftar Topic ROS 2 resmi sesuai docs/topics.md
export const TOPICS = {
  MISSION_STATE: '/asv/mission_state',
  BATTERY: '/asv/battery',
  BATTERY_VOLTAGE: '/asv/battery_voltage',
  KILL_SWITCH: '/asv/kill_switch',
  GRIPPER_STATE: '/asv/gripper_state',
  BUZZER: '/asv/buzzer',
  SPRAY: '/asv/spray',
  SPEED: '/asv/speed',
  THRUST_LEFT: '/wamv/thrusters/left/thrust',
  THRUST_RIGHT: '/wamv/thrusters/right/thrust',
  FTP_SCORE: '/ftp/score',
  MISSION_EVENTS: '/mission/events',
  POSE: '/wamv/pose',
  CLOCK: '/clock',
} as const;

export function isSupabaseServiceConfigured(): boolean {
  return (
    typeof BRIDGE_CONFIG.SUPABASE_URL === 'string' &&
    BRIDGE_CONFIG.SUPABASE_URL.trim().length > 0 &&
    typeof BRIDGE_CONFIG.SUPABASE_SERVICE_ROLE_KEY === 'string' &&
    BRIDGE_CONFIG.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0
  );
}
