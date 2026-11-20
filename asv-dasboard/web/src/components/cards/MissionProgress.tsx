'use client';

/**
 * MissionProgress.tsx
 * Komponen progress bar 6 langkah misi mengikuti docs/wireframe/dashboard.html
 * - Selesai: centang biru (done)
 * - Sedang aktif: angka bercahaya (now)
 * - Belum selesai: abu-abu
 */

import { useDashboardStore } from '@/lib/store';
import { MISSION_PROGRESS_STEPS } from '@/lib/config';
import { MissionState } from '@/lib/types';

function getActiveStepIndex(state: MissionState): number {
  switch (state) {
    case 'START':
      return 1;
    case 'PICK_UP':
      return 2;
    case 'FOLLOW_PATH':
      return 3;
    case 'DOCKING':
      return 4;
    case 'PLACE_ITEM':
      return 5;
    case 'BUZZER_SPRAY':
      return 6;
    case 'DONE':
      return 7; // Semua selesai
    case 'IDLE':
      return 0; // Belum mulai
    case 'ESTOP':
      return 0;
    default:
      return 0;
  }
}

export default function MissionProgress() {
  const missionState = useDashboardStore((s) => s.missionState);
  const activeStep = getActiveStepIndex(missionState);

  return (
    <section className="progress" aria-label="Progres Tahapan Misi ASV">
      <div className="head">
        <h3>Mission Progress</h3>
        <span className="src">/asv/mission_state</span>
      </div>
      <div className="steps" role="list" aria-label="Enam Tahapan Misi">
        {MISSION_PROGRESS_STEPS.map(([title, subtitle], index) => {
          const stepNumber = index + 1;
          const isDone = stepNumber < activeStep;
          const isNow = stepNumber === activeStep;

          const stepClass = `step ${isDone ? 'done' : isNow ? 'now' : ''}`.trim();
          const statusText = isDone ? 'Selesai' : isNow ? 'Sedang Berlangsung' : 'Belum Dimulai';

          return (
            <div
              key={title}
              className={stepClass}
              role="listitem"
              aria-current={isNow ? 'step' : undefined}
              aria-label={`Langkah ${stepNumber}: ${title} (${subtitle}) - Status: ${statusText}`}
            >
              <div className="circle" aria-hidden="true">
                {isDone ? '✓' : stepNumber}
              </div>
              {title}
              <small>{subtitle}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
