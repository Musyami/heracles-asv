'use client';

/**
 * TelemetryCard.tsx
 * Kartu data telemetri robot mengikuti docs/wireframe/dashboard.html
 */

import { useDashboardStore, useIsDataStale } from '@/lib/store';

export default function TelemetryCard() {
  const telemetry = useDashboardStore((s) => s.telemetry);
  const stale = useIsDataStale();

  const xText =
    telemetry.x !== null ? `${telemetry.x.toFixed(1).replace('.', ',')} m` : '—';
  const yText =
    telemetry.y !== null ? `${telemetry.y.toFixed(1).replace('.', ',')} m` : '—';
  const yawText =
    telemetry.yaw !== null ? `${Math.round(telemetry.yaw)}°` : '—';
  const speedText =
    telemetry.speed !== null
      ? `${telemetry.speed.toFixed(1).replace('.', ',')} m/s`
      : '—';

  return (
    <div
      className="card blue"
      role="region"
      aria-label={`Telemetri Kapal: Posisi x ${xText}, Posisi y ${yText}, Arah ${yawText}, Kecepatan ${speedText}`}
    >
      {stale && <span className="stale-badge">Data basi</span>}
      <h3>Telemetri</h3>

      <div className="tel">
        <div>
          <span>Posisi x</span>
          <div className="val">{xText}</div>
        </div>
        <div>
          <span>Posisi y</span>
          <div className="val">{yText}</div>
        </div>
        <div>
          <span>Arah (yaw)</span>
          <div className="val">{yawText}</div>
        </div>
        <div>
          <span>Kecepatan</span>
          <div className="val">{speedText}</div>
        </div>
      </div>

      <div className="src">/wamv/pose · /asv/speed</div>
    </div>
  );
}
