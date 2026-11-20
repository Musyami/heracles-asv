'use client';

/**
 * ThrusterCard.tsx
 * Kartu bar thruster kiri dan kanan mengikuti docs/wireframe/dashboard.html
 * Titik nol di tengah, maju = hijau ke kanan, mundur = kuning ke kiri.
 */

import { useDashboardStore, useIsDataStale } from '@/lib/store';
import { THRUSTER_CONFIG } from '@/lib/config';

function formatThrust(v: number | null) {
  if (v === null) {
    return {
      text: '—',
      percentWidth: 0,
      isRev: false,
    };
  }

  const clamped = Math.max(-THRUSTER_CONFIG.MAX_THRUST, Math.min(THRUSTER_CONFIG.MAX_THRUST, v));
  const absPct = Math.round((Math.abs(clamped) / THRUSTER_CONFIG.MAX_THRUST) * 100);
  const text = `${clamped > 0 ? '+' : ''}${clamped} (${absPct} %)`;
  const percentWidth = (Math.abs(clamped) / THRUSTER_CONFIG.MAX_THRUST) * 50;

  return {
    text,
    percentWidth,
    isRev: clamped < 0,
  };
}

export default function ThrusterCard() {
  const thrusters = useDashboardStore((s) => s.thrusters);
  const stale = useIsDataStale();

  const left = formatThrust(thrusters.left);
  const right = formatThrust(thrusters.right);

  return (
    <div className="card blue" role="region" aria-label="Status Thruster Propulsi">
      {stale && <span className="stale-badge">Data basi</span>}
      <h3>Thruster</h3>

      <div className="th">
        {/* Thruster Kiri */}
        <div className="t">
          <span>Kiri</span>
          <span className="mono">{left.text}</span>
        </div>
        <div
          className="track"
          role="progressbar"
          aria-label="Daya Dorong Thruster Kiri"
          aria-valuenow={Math.abs(thrusters.left ?? 0)}
          aria-valuemin={0}
          aria-valuemax={THRUSTER_CONFIG.MAX_THRUST}
          aria-valuetext={left.text}
        >
          <i
            className={left.isRev ? 'rev' : 'fwd'}
            style={{ width: `${left.percentWidth}%` }}
          />
        </div>

        {/* Thruster Kanan */}
        <div className="t">
          <span>Kanan</span>
          <span className="mono">{right.text}</span>
        </div>
        <div
          className="track"
          role="progressbar"
          aria-label="Daya Dorong Thruster Kanan"
          aria-valuenow={Math.abs(thrusters.right ?? 0)}
          aria-valuemin={0}
          aria-valuemax={THRUSTER_CONFIG.MAX_THRUST}
          aria-valuetext={right.text}
        >
          <i
            className={right.isRev ? 'rev' : 'fwd'}
            style={{ width: `${right.percentWidth}%` }}
          />
        </div>

        {/* Skala angka */}
        <div className="scale">
          <span className="l">-850 mundur</span>
          <span className="m">0</span>
          <span className="r">maju +850</span>
        </div>
      </div>

      <div className="params">{THRUSTER_CONFIG.PARAMS_LABEL}</div>
    </div>
  );
}
