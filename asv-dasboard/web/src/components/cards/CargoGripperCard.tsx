'use client';

/**
 * CargoGripperCard.tsx
 * Kartu Muatan (pick up) dan Capit mengikuti docs/wireframe/dashboard.html
 */

import { useDashboardStore, useIsDataStale } from '@/lib/store';
import { CARGO_ITEMS } from '@/lib/config';
import { ItemLocation } from '@/lib/types';

const GRIPPER_CHIPS = [
  { key: 'READY', label: 'Siap' },
  { key: 'GRABBING', label: 'Mengambil' },
  { key: 'CARRYING', label: 'Membawa' },
  { key: 'PLACING', label: 'Menaruh' },
] as const;

export default function CargoGripperCard() {
  const items = useDashboardStore((s) => s.items);
  const gripper = useDashboardStore((s) => s.gripper);
  const stale = useIsDataStale();

  // Hitung jumlah barang di tiap lokasi
  const counts: Record<ItemLocation, number> = {
    spot1: 0,
    board: 0,
    spot2: 0,
  };

  (Object.keys(items) as (keyof typeof items)[]).forEach((k) => {
    const loc = items[k];
    if (counts[loc] !== undefined) {
      counts[loc]++;
    }
  });

  return (
    <div className="card teal" role="region" aria-label="Status Muatan Barang dan Capit">
      {stale && <span className="stale-badge">Data basi</span>}
      <div className="cargo-head">
        <h3>Muatan (pick up)</h3>
        <b id="carriedText" aria-live="polite">{counts.board} dari 3 terbawa</b>
      </div>

      {/* 3 Kotak Muatan Barang */}
      <div className="tiles" role="group" aria-label="Status Tiga Barang Kargo">
        {(Object.keys(CARGO_ITEMS) as (keyof typeof CARGO_ITEMS)[]).map((key) => {
          const item = CARGO_ITEMS[key];
          const isOnBoard = items[key] === 'board';

          return (
            <div
              key={key}
              className={`tile ${isOnBoard ? '' : 'empty'}`.trim()}
              role="status"
              aria-label={`Muatan ${item.name}: ${isOnBoard ? 'Terisi di kapal' : 'Kosong'}`}
            >
              <div className="ck" aria-hidden="true">{isOnBoard ? '✓' : '✕'}</div>
              <div className="shape">
                <div className={item.shapeClass} aria-hidden="true" />
              </div>
              <b>{item.name}</b>
              <small>{isOnBoard ? 'Terisi' : 'Kosong'}</small>
            </div>
          );
        })}
      </div>

      {/* Petunjuk simbol */}
      <div className="keys" aria-hidden="true">
        <span>
          <i />
          Terisi
        </span>
        <span>
          <i className="d" />
          Kosong
        </span>
      </div>

      {/* 3 Kotak Lokasi Barang */}
      <div className="counts" role="group" aria-label="Distribusi Lokasi Barang">
        <div
          className={`count ${counts.spot1 > 0 ? 'has' : ''}`}
          aria-label={`${counts.spot1} barang di Spot 1`}
        >
          Di Spot 1
          <span className="mono">{counts.spot1} barang</span>
        </div>
        <div
          className={`count ${counts.board > 0 ? 'has' : ''}`}
          aria-label={`${counts.board} barang sedang dibawa di kapal`}
        >
          Sedang dibawa
          <span className="mono">{counts.board} barang</span>
        </div>
        <div
          className={`count ${counts.spot2 > 0 ? 'has' : ''}`}
          aria-label={`${counts.spot2} barang di Spot 2`}
        >
          Di Spot 2
          <span className="mono">{counts.spot2} barang</span>
        </div>
      </div>

      {/* Status Capit (Gripper) */}
      <div className="grip">
        <h3>Capit</h3>
        <div className="chips" role="group" aria-label="Status Operasi Capit ASV">
          {GRIPPER_CHIPS.map((chip) => {
            const isActive = gripper === chip.key;
            return (
              <div
                key={chip.key}
                className={`chip ${isActive ? 'on' : ''}`.trim()}
                role="status"
                aria-label={`Capit ${chip.label}${isActive ? ' (Aktif)' : ''}`}
              >
                {chip.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
