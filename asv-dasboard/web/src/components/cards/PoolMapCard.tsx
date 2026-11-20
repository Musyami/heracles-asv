'use client';

/**
 * PoolMapCard.tsx
 * Kartu Peta Kolam interaktif menampilkan arena 24 x 12 meter, posisi robot, buoy, gerbang,
 * dan jejak pergerakan kapal (Fase F3).
 * Menyediakan opsi alih tampilan antara Peta Vektor Interaktif dan Kamera Atas.
 */

import { useState } from 'react';
import { useDashboardStore } from '@/lib/store';
import PoolMap from './PoolMap';

export default function PoolMapCard() {
  const cameraImage = useDashboardStore((s) => s.cameraImage);
  const [viewMode, setViewMode] = useState<'map' | 'camera'>('map');

  return (
    <div className="card blue map" role="region" aria-label="Peta Kolam dan Pemantauan Visual">
      {/* Header Kartu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
          <h3>Peta Kolam</h3>
          <span className="src" style={{ fontSize: '15px' }}>
            /overview_camera/image · /wamv/pose · /ftp/buoys · /ftp/path
          </span>
        </div>

        {/* Tombol Alih Mode Tampilan (Peta Vektor vs Kamera) */}
        <div
          role="group"
          aria-label="Pilihan Tampilan Peta"
          style={{ display: 'flex', gap: '6px', background: 'rgba(255, 255, 255, 0.15)', padding: '3px', borderRadius: '8px' }}
        >
          <button
            type="button"
            aria-pressed={viewMode === 'map'}
            onClick={() => setViewMode('map')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#FFFFFF',
              background: viewMode === 'map' ? '#1D4ED8' : 'transparent',
              transition: 'background 0.2s',
            }}
          >
            Peta Arena
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'camera'}
            onClick={() => setViewMode('camera')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#FFFFFF',
              background: viewMode === 'camera' ? '#1D4ED8' : 'transparent',
              transition: 'background 0.2s',
            }}
          >
            Kamera Atas
          </button>
        </div>
      </div>

      {/* Konten Peta: Vektor Interaktif atau Gambar Kamera */}
      <div className="mapimg" style={{ marginTop: '12px', border: '2px solid rgba(255, 255, 255, 0.85)' }}>
        {viewMode === 'map' ? (
          <PoolMap />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            id="mapImg"
            src={cameraImage || '/peta-kolam.png'}
            alt="Peta kolam 24 x 12 m (dari kamera atas)"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        )}
      </div>

      {/* Legenda Simbol */}
      <div className="legend">
        <span>
          <i style={{ background: '#FFC933' }} />
          Item
        </span>
        <span>
          <i className="c" style={{ background: '#22C77E' }} />
          Buoy hijau
        </span>
        <span>
          <i className="c" style={{ background: '#D93025' }} />
          Buoy merah
        </span>
        <span>
          <i className="c" style={{ background: '#FFB300' }} />
          Rintangan Kuning
        </span>
        <span>
          <i className="c" style={{ background: '#000000' }} />
          Rintangan Hitam
        </span>
        <span>
          <i style={{ background: '#1D4ED8', width: '22px', height: '14px', borderRadius: '3px' }} />
          Robot ASV
        </span>
        <span>
          <i style={{ background: '#00E5FF', width: '20px', height: '3px' }} />
          Jejak
        </span>
      </div>
    </div>
  );
}
