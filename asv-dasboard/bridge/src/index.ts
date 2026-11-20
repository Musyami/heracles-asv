/**
 * index.ts
 * Titik masuk utama modul Bridge (Fase F7 - Level Disruptive).
 * Menghubungkan Laptop Simulasi ROS 2 (rosbridge) ke Database Cloud Supabase.
 */

import { startRosClient } from './ros';
import { startUploader } from './uploader';
import { BRIDGE_CONFIG, isSupabaseServiceConfigured } from './config';

console.log('====================================================');
console.log('  HERACLES ASV — ROS 2 TO SUPABASE CLOUD BRIDGE');
console.log('  Barunastra ITS — Kontes Kapal Indonesia (KKI) 2026');
console.log('====================================================');
console.log(`[Bridge] Alamat ROSBridge : ${BRIDGE_CONFIG.ROSBRIDGE_URL}`);
console.log(
  `[Bridge] Supabase Cloud  : ${
    isSupabaseServiceConfigured()
      ? `${BRIDGE_CONFIG.SUPABASE_URL} (Service Role Aktif)`
      : 'Mode Offline (Menunggu Kunci di bridge/.env)'
  }`
);
console.log('----------------------------------------------------');

// 1. Mulai Uploader Supabase (live_state, runs, run_samples, run_events)
const stopUploader = startUploader();

// 2. Mulai Klien ROSBridge (berlangganan topic ROS 2 dan menghubungkan ke aggregator)
const stopRos = startRosClient();

// Penanganan sinyal penutupan terminal (Ctrl+C)
function gracefulShutdown() {
  console.log('\n[Bridge] Mematikan modul bridge...');
  stopRos();
  stopUploader();
  console.log('[Bridge] Bridge berhasil dimatikan dengan aman.');
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
