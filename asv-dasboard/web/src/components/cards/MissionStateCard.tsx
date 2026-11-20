'use client';

/**
 * MissionStateCard.tsx
 * Kartu Mission State mengikuti docs/wireframe/dashboard.html
 */

import { useDashboardStore, useIsDataStale } from '@/lib/store';
import { MISSION_STATE_DESCRIPTIONS } from '@/lib/config';

// Pemetaan nama tampilan yang rapi untuk tiap mission_state
const STATE_TITLES: Record<string, string> = {
  IDLE: 'IDLE',
  START: 'Start',
  PICK_UP: 'Pick up',
  FOLLOW_PATH: 'Follow the path',
  DOCKING: 'Docking',
  PLACE_ITEM: 'Place item',
  BUZZER_SPRAY: 'Buzzer + spray',
  DONE: 'Done',
  ESTOP: 'ESTOP',
};

export default function MissionStateCard() {
  const missionState = useDashboardStore((s) => s.missionState);
  const stale = useIsDataStale();

  const title = STATE_TITLES[missionState] ?? (missionState || '—');
  const sub = MISSION_STATE_DESCRIPTIONS[missionState] ?? '—';

  return (
    <div
      className="card blue"
      role="region"
      aria-label={`Mission State: ${title}, Keterangan: ${sub}`}
    >
      {stale && <span className="stale-badge">Data basi</span>}
      <div className="lbl">Mission State</div>
      <div className="big">{title}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
