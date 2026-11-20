'use client';

/**
 * SystemStatusCard.tsx
 * Kartu Status Sistem (Kill Switch, Buzzer, Spray) mengikuti docs/wireframe/dashboard.html
 */

import { useDashboardStore, useIsDataStale } from '@/lib/store';
import KillSwitchButton from '@/components/KillSwitchButton';

export default function SystemStatusCard() {
  const system = useDashboardStore((s) => s.system);
  const stale = useIsDataStale();

  return (
    <div className="card teal sys">
      {stale && <span className="stale-badge">Data basi</span>}
      <h3>Status Sistem</h3>

      <div className="line" style={{ marginTop: '14px' }}>
        <b>Kill Switch</b>
        <span className={`badge ${system.killSwitch ? 'on-bad' : ''}`.trim()}>
          {system.killSwitch ? 'AKTIF' : 'NONAKTIF'}
        </span>
      </div>

      <div className="line">
        <b>Buzzer</b>
        <span className={`badge ${system.buzzer ? 'on-ok' : ''}`.trim()}>
          {system.buzzer ? 'AKTIF' : 'NONAKTIF'}
        </span>
      </div>

      <div className="line">
        <b>Spray</b>
        <span className={`badge ${system.spray ? 'on-ok' : ''}`.trim()}>
          {system.spray ? 'AKTIF' : 'NONAKTIF'}
        </span>
      </div>

      {/* Tombol Perintah Kill Switch (Hanya Mode Lokal & Bukan Readonly) */}
      <KillSwitchButton />
    </div>
  );
}
