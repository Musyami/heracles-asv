'use client';

/**
 * MissionTimeCard.tsx
 * Kartu Waktu Misi mengikuti docs/wireframe/dashboard.html
 */

import { useDashboardStore, useIsDataStale } from '@/lib/store';

export default function MissionTimeCard() {
  const missionTime = useDashboardStore((s) => s.missionTime);
  const attempt = useDashboardStore((s) => s.ftpScore.attempt);
  const lastUpdated = useDashboardStore((s) => s.lastUpdated);
  const stale = useIsDataStale();

  // Format waktu detik menjadi mm:ss (atau — jika belum ada data sama sekali)
  let timeText = '—';
  let mins = '00';
  let secs = '00';
  if (lastUpdated > 0 || missionTime > 0) {
    mins = Math.floor(missionTime / 60)
      .toString()
      .padStart(2, '0');
    secs = Math.floor(missionTime % 60)
      .toString()
      .padStart(2, '0');
    timeText = `${mins}:${secs}`;
  }

  return (
    <div
      className="card teal"
      role="region"
      aria-label={`Waktu Misi: ${mins} menit ${secs} detik, Percobaan ke-${attempt || 1} dari 3`}
    >
      {stale && <span className="stale-badge">Data basi</span>}
      <div className="lbl">Waktu Misi</div>
      <div className="val">{timeText}</div>
      <div className="sub" style={{ opacity: 0.9, fontSize: '16px' }}>
        Percobaan {attempt || 1}/3
      </div>
    </div>
  );
}
