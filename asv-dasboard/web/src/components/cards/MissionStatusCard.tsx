'use client';

/**
 * MissionStatusCard.tsx
 * Kartu status misi mengikuti logika render() docs/wireframe/dashboard.html
 * - Merah (Berhenti): jika kill switch aktif atau state ESTOP
 * - Abu-abu (Siap): jika IDLE
 * - Hijau (Selesai): jika DONE
 * - Hijau (Berjalan): status selain di atas
 */

import { useDashboardStore, useIsDataStale } from '@/lib/store';

export default function MissionStatusCard() {
  const missionState = useDashboardStore((s) => s.missionState);
  const killSwitch = useDashboardStore((s) => s.system.killSwitch);
  const stale = useIsDataStale();

  let colorClass = 'green';
  let text = 'Berjalan';

  if (killSwitch || missionState === 'ESTOP') {
    colorClass = 'red';
    text = 'Berhenti';
  } else if (missionState === 'IDLE') {
    colorClass = 'gray';
    text = 'Siap';
  } else if (missionState === 'DONE') {
    colorClass = 'green';
    text = 'Selesai';
  } else {
    colorClass = 'green';
    text = 'Berjalan';
  }

  return (
    <div
      className={`card ${colorClass}`}
      role="region"
      aria-label={`Status Misi: ${text}`}
    >
      {stale && <span className="stale-badge">Data basi</span>}
      <div className="lbl">Status Misi</div>
      <div className="val" style={{ marginTop: '12px', fontSize: '32px' }}>
        <span className="pill-dot" aria-hidden="true" />
        <span>{text}</span>
      </div>
    </div>
  );
}
