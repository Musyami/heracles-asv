'use client';

/**
 * DashboardView.tsx
 * Tampilan utama dashboard ASV yang menyusun seluruh kartu dan menghubungkan ke data source.
 */

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDashboardStore, useIsDataStale } from '@/lib/store';
import { initDataSource, resolveDataSourceType } from '@/lib/sources';

// Import seluruh kartu komponen
import MissionStateCard from './cards/MissionStateCard';
import BatteryCard from './cards/BatteryCard';
import MissionStatusCard from './cards/MissionStatusCard';
import MissionTimeCard from './cards/MissionTimeCard';
import MissionProgress from './cards/MissionProgress';
import PoolMapCard from './cards/PoolMapCard';
import CargoGripperCard from './cards/CargoGripperCard';
import SystemStatusCard from './cards/SystemStatusCard';
import TelemetryCard from './cards/TelemetryCard';
import ThrusterCard from './cards/ThrusterCard';
import FtpScoreCard from './cards/FtpScoreCard';
import EventLogCard from './cards/EventLogCard';

export default function DashboardView() {
  const searchParams = useSearchParams();
  const connection = useDashboardStore((s) => s.connection);
  const lastUpdated = useDashboardStore((s) => s.lastUpdated);
  const killSwitch = useDashboardStore((s) => s.system.killSwitch);
  const missionState = useDashboardStore((s) => s.missionState);
  const isFallbackData = useDashboardStore((s) => s.isFallbackData);
  const isStale = useIsDataStale();
  const isEstop = killSwitch || missionState === 'ESTOP';

  // Inisialisasi sumber data (demo / live / cloud) saat komponen dimuat
  useEffect(() => {
    const sourceType = resolveDataSourceType(searchParams);
    const cleanup = initDataSource(sourceType);
    return () => {
      cleanup();
    };
  }, [searchParams]);

  return (
    <main>
      {/* Banner Merah: Koneksi Putus (dengan Reconnect Otomatis Bertahap) */}
      {connection === 'disconnected' && (
        <aside
          className="connection-banner"
          role="alert"
          aria-live="assertive"
        >
          <div className="banner-icon" aria-hidden="true">
            📡
          </div>
          <div className="banner-content">
            <h2 className="banner-title">Koneksi Putus</h2>
            <p className="banner-desc">
              Hubungan ke server rosbridge terputus. Sistem mencoba menyambung kembali secara otomatis dengan jeda bertahap... Pastikan server ROS / mock aktif.
            </p>
          </div>
        </aside>
      )}

      {/* Banner Kuning: Data Basi (> 3 detik tanpa pesan baru saat terhubung) */}
      {connection === 'connected' && isStale && lastUpdated > 0 && (
        <aside
          className="connection-banner warning"
          role="status"
          aria-live="polite"
        >
          <div className="banner-icon" aria-hidden="true">
            ⏱️
          </div>
          <div className="banner-content">
            <h2 className="banner-title">Peringatan: Data Basi</h2>
            <p className="banner-desc">
              Tidak ada pesan telemetri baru selama lebih dari 3 detik. Nilai terakhir tetap dipertahankan dengan tanda &quot;Data basi&quot; pada setiap kartu.
            </p>
          </div>
        </aside>
      )}
      {/* Banner Kecil Data Cadangan (Fase F6 - Jika Supabase/Cloud tidak tersedia) */}
      {isFallbackData && (
        <aside
          role="status"
          style={{
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid #EAB308',
            color: 'var(--text)',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true">⚠️</span>
            <span>
              <b>Data cadangan aktif:</b> Menggunakan berkas simulasi statis lokal (<code>demo-run.json</code>) karena server cloud/database belum terhubung. Halaman tetap beroperasi penuh.
            </span>
          </div>
        </aside>
      )}

      {/* Banner Merah Peringatan Darurat saat Kill Switch / ESTOP Aktif */}
      {isEstop && (
        <aside className="emergency-banner" role="alert" aria-live="assertive">
          <div className="emergency-banner-icon" aria-hidden="true">
            🛑
          </div>
          <div className="emergency-banner-content">
            <h2 className="emergency-banner-title">
              PERINGATAN DARURAT: KILL SWITCH AKTIF — SISTEM KAPAL BERHENTI (ESTOP)
            </h2>
            <p className="emergency-banner-desc">
              Robot ASV menerima perintah henti darurat. Seluruh thruster telah dinonaktifkan seketika (0 N) dan kendali otomatis dibekukan demi keselamatan kapal di kolam.
            </p>
          </div>
        </aside>
      )}

      {/* Baris 1: 4 Kartu Metrik Utama */}
      <section className="row r1">
        <MissionStateCard />
        <BatteryCard />
        <MissionStatusCard />
        <MissionTimeCard />
      </section>

      {/* Baris 2: Mission Progress 6 Langkah */}
      <MissionProgress />

      {/* Baris 3: Peta Kolam & Panel Muatan + Status Sistem */}
      <section className="row r3">
        <PoolMapCard />
        <div className="stack">
          <CargoGripperCard />
          <SystemStatusCard />
        </div>
      </section>

      {/* Baris 4: Telemetri, Thruster, Skor FTP */}
      <section className="row r4">
        <TelemetryCard />
        <ThrusterCard />
        <FtpScoreCard />
      </section>

      {/* Baris 5: Log Kejadian */}
      <EventLogCard />
    </main>
  );
}
