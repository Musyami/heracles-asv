'use client';

/**
 * EventLogCard.tsx
 * Kartu Log Kejadian (/mission/events) mengikuti docs/wireframe/dashboard.html
 */

import { useDashboardStore } from '@/lib/store';
import { MissionEvent } from '@/lib/types';

function formatEventData(data?: Record<string, unknown>): string {
  if (!data || Object.keys(data).length === 0) return '';
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

function getTagClass(type: string): string {
  if (type === 'gate_pass') return 'tag gp';
  if (type === 'estop') return 'tag danger';
  if (type === 'mission_done') return 'tag done';
  return 'tag';
}

export default function EventLogCard() {
  const events = useDashboardStore((s) => s.events);

  return (
    <section className="card teal log" aria-label="Log Kejadian Misi">
      <h3>Log Kejadian</h3>
      <div role="log" aria-live="polite" aria-relevant="additions">
        {events.length === 0 ? (
          <div style={{ padding: '16px 0', opacity: 0.7 }}>Belum ada kejadian tercatat.</div>
        ) : (
          events.map((ev: MissionEvent, idx: number) => {
            const tagClass = getTagClass(ev.type);
            const timeText = `${ev.t.toFixed(1).replace('.', ',')} s`;
            const dataText = formatEventData(ev.data);

            return (
              <div key={`${ev.t}-${ev.type}-${idx}`} className="ev">
                <span className="mono">{timeText}</span>
                <span>
                  <span className={tagClass}>
                    {ev.type}
                  </span>
                </span>
                <span className="d">{dataText}</span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
