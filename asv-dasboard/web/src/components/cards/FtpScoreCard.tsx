'use client';

/**
 * FtpScoreCard.tsx
 * Kartu Skor FTP (Follow The Path) mengikuti docs/wireframe/dashboard.html
 */

import { useDashboardStore, useIsDataStale } from '@/lib/store';

export default function FtpScoreCard() {
  const ftpScore = useDashboardStore((s) => s.ftpScore);
  const lastUpdated = useDashboardStore((s) => s.lastUpdated);
  const stale = useIsDataStale();

  let scoreDisplay = '—';
  if (ftpScore.score !== null) {
    scoreDisplay = String(ftpScore.score);
  } else if (lastUpdated === 0) {
    scoreDisplay = '—';
  } else if (ftpScore.status === 'running') {
    scoreDisplay = 'Berjalan';
  } else if (ftpScore.status === 'idle') {
    scoreDisplay = 'Siap';
  } else if (ftpScore.status === 'failed') {
    scoreDisplay = 'Gagal';
  }

  return (
    <div className="card teal" role="region" aria-label="Kartu Skor FTP">
      {stale && <span className="stale-badge">Data basi</span>}
      <h3>Skor FTP</h3>

      <table aria-label="Tabel Skor Misi Follow The Path">
        <colgroup>
          <col className="c1" />
          <col className="c2" />
          <col className="c3" />
          <col className="c4" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Arah</th>
            <th scope="col">Coba</th>
            <th scope="col">Tabrakan</th>
            <th scope="col">Skor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{ftpScore.direction || 'Spot 1 → Spot 2'}</td>
            <td>{ftpScore.attempt || 1}/3</td>
            <td>{ftpScore.collisions ?? 0}</td>
            <td>{scoreDisplay}</td>
          </tr>
        </tbody>
      </table>

      <div className="src" style={{ marginTop: '20px' }}>
        /ftp/score
      </div>
    </div>
  );
}
