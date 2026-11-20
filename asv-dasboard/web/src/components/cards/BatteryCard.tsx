'use client';

/**
 * BatteryCard.tsx
 * Kartu status baterai mengikuti docs/wireframe/dashboard.html
 */

import { useDashboardStore, useIsDataStale } from '@/lib/store';

export default function BatteryCard() {
  const battery = useDashboardStore((s) => s.battery);
  const stale = useIsDataStale();

  const pct = battery.percentage;
  const volt = battery.voltage;

  const pctText = pct !== null ? `${Math.round(pct)} %` : '—';
  const voltText =
    volt !== null ? `${volt.toFixed(1).replace('.', ',')} V` : '—';

  const barWidth = pct !== null ? Math.min(100, Math.max(0, pct)) : 0;

  return (
    <div
      className="card blue"
      role="region"
      aria-label={`Status Baterai: ${pctText}, Tegangan: ${voltText}`}
    >
      {stale && <span className="stale-badge">Data basi</span>}
      <div className="lbl">Baterai</div>
      <div className="big font-mono">{pctText}</div>
      <div
        className="bar"
        role="progressbar"
        aria-label="Kapasitas Baterai"
        aria-valuenow={Math.round(barWidth)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${barWidth}%` }} />
      </div>
      <div className="src" style={{ marginTop: '8px', fontSize: '15px' }}>
        {voltText} · /asv/battery
      </div>
    </div>
  );
}
