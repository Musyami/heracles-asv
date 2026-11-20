'use client';

/**
 * ConnectionBadge.tsx
 * Lencana status koneksi di Header mengikuti docs/wireframe/dashboard.html
 * - 3 status: connected (hijau), connecting (kuning), disconnected (merah)
 * - Titik berkedip (pulsing/blink)
 */

import { useDashboardStore } from '@/lib/store';
import { ConnectionStatus } from '@/lib/types';

const CONN_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Terhubung',
  connecting: 'Menyambung',
  disconnected: 'Tidak tersambung',
};

export default function ConnectionBadge() {
  const connection = useDashboardStore((s) => s.connection);
  const label = CONN_LABELS[connection] ?? 'Tidak tersambung';

  return (
    <div className="status" data-conn={connection} role="status" aria-live="polite">
      <span className="dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
