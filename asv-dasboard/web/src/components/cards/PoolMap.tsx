'use client';

/**
 * PoolMap.tsx
 * Komponen peta interaktif kolam 24 x 12 meter berbasis SVG vektor.
 * Menampilkan:
 * - Kolam dengan grid meter halus dan batas area
 * - Spot 1 (Pickup + Start) di kiri dan Spot 2 (Drop + Docking) di kanan
 * - 5 Buoy hijau & 5 Buoy merah dengan jalur garis putus-putus
 * - 3 Gerbang utama (Gate 1, 2, 3) bertanda panah lebar dimensi
 * - 4 Rintangan kolam (kuning dan hitam)
 * - 3 Barang di Spot 1 (menghilang saat di-pick up) dan target di Spot 2
 * - Jalur acuan FTP (Follow The Path)
 * - Jejak pergerakan kapal (trail)
 * - Posisi dan arah hadap robot ASV (WAM-V Catamaran)
 */

import { useEffect, useRef, useState } from 'react';
import { useDashboardStore } from '@/lib/store';
import { ARENA_DATA, vrxToArena, arenaToSvg } from '@/lib/arena';
import { ARENA_CONFIG } from '@/lib/config';

interface Point {
  x: number;
  y: number;
}

export interface PoolMapProps {
  overrideRobot?: {
    x: number | null;
    y: number | null;
    yaw: number | null;
  };
  overrideTrail?: Point[];
}

export default function PoolMap({ overrideRobot, overrideTrail }: PoolMapProps = {}) {
  const telemetry = useDashboardStore((s) => s.telemetry);
  const items = useDashboardStore((s) => s.items);
  const missionState = useDashboardStore((s) => s.missionState);

  // Jejak pergerakan kapal
  const [trail, setTrail] = useState<Point[]>([]);
  const lastPointRef = useRef<Point | null>(null);

  // Ambil posisi robot dalam koordinat arena (gunakan override jika ada)
  const rawX = overrideRobot ? overrideRobot.x ?? 2.0 : telemetry.x ?? 2.0;
  const rawY = overrideRobot ? overrideRobot.y ?? 6.0 : telemetry.y ?? 6.0;
  const yaw = overrideRobot ? overrideRobot.yaw ?? 0 : telemetry.yaw ?? 0;

  // Konversi koordinat VRX ke arena (meter)
  const robotArena = vrxToArena(rawX, rawY);
  const robotSvg = arenaToSvg(robotArena.x, robotArena.y);

  // Update jejak pergerakan kapal
  useEffect(() => {
    // Reset jejak jika misi kembali ke IDLE
    if (missionState === 'IDLE') {
      lastPointRef.current = null;
      const animId = requestAnimationFrame(() => {
        setTrail([]);
      });
      return () => cancelAnimationFrame(animId);
    }

    const currentPoint: Point = { x: robotSvg.svgX, y: robotSvg.svgY };

    if (!lastPointRef.current) {
      lastPointRef.current = currentPoint;
      const animId = requestAnimationFrame(() => {
        setTrail([currentPoint]);
      });
      return () => cancelAnimationFrame(animId);
    }

    // Hitung jarak dari titik jejak terakhir
    const dx = currentPoint.x - lastPointRef.current.x;
    const dy = currentPoint.y - lastPointRef.current.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);

    // Minimal perpindahan ~4px (sekitar 0.1 meter)
    if (distPx >= 4) {
      lastPointRef.current = currentPoint;
      const animId = requestAnimationFrame(() => {
        setTrail((prev) => {
          const next = [...prev, currentPoint];
          if (next.length > ARENA_CONFIG.TRAIL.MAX_POINTS) {
            return next.slice(next.length - ARENA_CONFIG.TRAIL.MAX_POINTS);
          }
          return next;
        });
      });
      return () => cancelAnimationFrame(animId);
    }
  }, [robotSvg.svgX, robotSvg.svgY, missionState]);

  // Titik SVG jalur acuan FTP
  const ftpPathPoints = ARENA_DATA.defaultPath
    .map(([x, y]) => {
      const pt = arenaToSvg(x, y);
      return `${pt.svgX},${pt.svgY}`;
    })
    .join(' ');

  // Titik SVG untuk jejak kapal
  const activeTrail = overrideTrail || trail;
  const trailPoints = activeTrail.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Hitung bounding box Area FTP dalam SVG
  const ftpTopLeft = arenaToSvg(ARENA_DATA.ftpArea.x0, ARENA_DATA.ftpArea.y1);
  const ftpBottomRight = arenaToSvg(ARENA_DATA.ftpArea.x1, ARENA_DATA.ftpArea.y0);
  const ftpWidth = ftpBottomRight.svgX - ftpTopLeft.svgX;
  const ftpHeight = ftpBottomRight.svgY - ftpTopLeft.svgY;

  return (
    <div style={{ width: '100%', position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
      <svg
        viewBox="0 0 960 480"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          background: 'var(--map-bg)',
          borderRadius: '12px',
        }}
        aria-label="Peta Kolam Interaktif 24 x 12 meter"
      >
        <defs>
          {/* Pola grid air kolam per 1 meter (40px) */}
          <pattern id="poolGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="0.8"
            />
          </pattern>

          {/* Pola grid tebal per 3 meter (120px) */}
          <pattern id="poolMajorGrid" width="120" height="120" patternUnits="userSpaceOnUse">
            <path
              d="M 120 0 L 0 0 0 120"
              fill="none"
              stroke="rgba(255, 255, 255, 0.75)"
              strokeWidth="1.2"
            />
          </pattern>

          {/* Marker kepala panah jalur FTP */}
          <marker
            id="ftpArrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#1F5FE0" />
          </marker>
        </defs>

        {/* 1. Latar Belakang Air Kolam & Grid */}
        <rect width="960" height="480" fill="var(--map-bg)" />
        <rect width="960" height="480" fill="url(#poolGrid)" />
        <rect width="960" height="480" fill="url(#poolMajorGrid)" />

        {/* Garis batas kolam luar */}
        <rect
          x="1"
          y="1"
          width="958"
          height="478"
          fill="none"
          stroke="#1B335A"
          strokeWidth="3"
        />

        {/* 2. Area Follow The Path (FTP) Garis Putus-putus */}
        <rect
          x={ftpTopLeft.svgX}
          y={ftpTopLeft.svgY}
          width={ftpWidth}
          height={ftpHeight}
          fill="none"
          stroke="#8A9BB5"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />
        <text
          x={ftpTopLeft.svgX + ftpWidth / 2}
          y={ftpTopLeft.svgY + 22}
          textAnchor="middle"
          fill="#5B708B"
          fontSize="14"
          fontWeight="700"
          letterSpacing="1.5"
        >
          AREA FOLLOW THE PATH
        </text>

        {/* Garis dimensi jarak Spot 1 ke Spot 2 = 18 m */}
        <g stroke="#7A8D9F" strokeWidth="1.2" opacity="0.85">
          <line
            x1={ftpTopLeft.svgX}
            y1={ftpBottomRight.svgY + 24}
            x2={ftpBottomRight.svgX}
            y2={ftpBottomRight.svgY + 24}
          />
          <line
            x1={ftpTopLeft.svgX}
            y1={ftpBottomRight.svgY + 18}
            x2={ftpTopLeft.svgX}
            y2={ftpBottomRight.svgY + 30}
          />
          <line
            x1={ftpBottomRight.svgX}
            y1={ftpBottomRight.svgY + 18}
            x2={ftpBottomRight.svgX}
            y2={ftpBottomRight.svgY + 30}
          />
        </g>
        <text
          x={ftpTopLeft.svgX + ftpWidth / 2}
          y={ftpBottomRight.svgY + 34}
          textAnchor="middle"
          fill="#5B708B"
          fontSize="12"
          fontWeight="600"
        >
          distance Spot 1 to Spot 2 = 18 m (D)
        </text>

        {/* 3. Dermaga Spot 1 (Kiri) */}
        {/* Dock Kayu: x: 0 - 3m (0 - 120px), y: 4 - 8m (svgY: 160 - 320px) */}
        <g>
          {/* Dermaga utama kayu */}
          <rect
            x="0"
            y="160"
            width="120"
            height="160"
            fill="#8B5A36"
            stroke="#5D3A20"
            strokeWidth="2"
          />
          {/* Garis papan kayu */}
          <line x1="30" y1="160" x2="30" y2="320" stroke="#714829" strokeWidth="1" />
          <line x1="60" y1="160" x2="60" y2="320" stroke="#714829" strokeWidth="1" />
          <line x1="90" y1="160" x2="90" y2="320" stroke="#714829" strokeWidth="1" />

          {/* Slot cutout kapal: x: 1.5 - 3.0m (60 - 120px), y: 5.4 - 6.6m (svgY: 216 - 264px) */}
          <rect
            x="60"
            y="216"
            width="60"
            height="48"
            fill="var(--map-bg)"
            stroke="#5D3A20"
            strokeWidth="2"
          />

          {/* Teks Label Spot 1 */}
          <text x="60" y="145" textAnchor="middle" fill="#0F1B2D" fontSize="13" fontWeight="700">
            SPOT 1
          </text>
          <text x="60" y="157" textAnchor="middle" fill="#4B5B78" fontSize="11" fontWeight="500">
            (Pickup + Start)
          </text>
        </g>

        {/* 4. Dermaga Spot 2 (Kanan) */}
        {/* Dock Kayu: x: 21 - 24m (840 - 960px), y: 4 - 8m (svgY: 160 - 320px) */}
        <g>
          <rect
            x="840"
            y="160"
            width="120"
            height="160"
            fill="#8B5A36"
            stroke="#5D3A20"
            strokeWidth="2"
          />
          <line x1="870" y1="160" x2="870" y2="320" stroke="#714829" strokeWidth="1" />
          <line x1="900" y1="160" x2="900" y2="320" stroke="#714829" strokeWidth="1" />
          <line x1="930" y1="160" x2="930" y2="320" stroke="#714829" strokeWidth="1" />

          {/* Slot cutout kapal Spot 2 */}
          <rect
            x="840"
            y="216"
            width="60"
            height="48"
            fill="var(--map-bg)"
            stroke="#5D3A20"
            strokeWidth="2"
          />

          {/* Teks Label Spot 2 */}
          <text x="900" y="145" textAnchor="middle" fill="#0F1B2D" fontSize="13" fontWeight="700">
            SPOT 2
          </text>
          <text x="900" y="157" textAnchor="middle" fill="#4B5B78" fontSize="11" fontWeight="500">
            (Drop + Docking)
          </text>
        </g>

        {/* 5. Barang di Spot 1 (Muncul jika belum diambil / status 'spot1') */}
        <g id="spot1-items">
          {/* Kubus di x=0.9m, y=6.0m (36px, 240px) */}
          {items.cube === 'spot1' && (
            <g transform="translate(36, 240)">
              <rect x="-8" y="-8" width="16" height="16" rx="2" fill="#FFC933" stroke="#8A5A00" strokeWidth="1.2" />
            </g>
          )}

          {/* Bola di x=2.2m, y=7.0m (88px, 200px) */}
          {items.sphere === 'spot1' && (
            <g transform="translate(88, 200)">
              <circle r="8" fill="#FFC933" stroke="#8A5A00" strokeWidth="1.2" />
            </g>
          )}

          {/* Prisma di x=2.2m, y=5.0m (88px, 280px) */}
          {items.prism === 'spot1' && (
            <g transform="translate(88, 280)">
              <polygon points="0,-9 8,7 -8,7" fill="#FFC933" stroke="#8A5A00" strokeWidth="1.2" />
            </g>
          )}
        </g>

        {/* 6. Target Drop Zone Barang di Spot 2 (Garis putus-putus jika kosong, solid jika ditaruh) */}
        <g id="spot2-drops">
          {/* Target Kubus di x=23.1m, y=6.0m (924px, 240px) */}
          <g transform="translate(924, 240)">
            <rect
              x="-9"
              y="-9"
              width="18"
              height="18"
              rx="3"
              fill={items.cube === 'spot2' ? '#FFC933' : 'rgba(255, 255, 255, 0.2)'}
              stroke={items.cube === 'spot2' ? '#8A5A00' : 'rgba(255, 255, 255, 0.7)'}
              strokeWidth="1.5"
              strokeDasharray={items.cube === 'spot2' ? 'none' : '3 3'}
            />
          </g>

          {/* Target Bola di x=21.8m, y=7.0m (872px, 200px) */}
          <g transform="translate(872, 200)">
            <circle
              r="9"
              fill={items.sphere === 'spot2' ? '#FFC933' : 'rgba(255, 255, 255, 0.2)'}
              stroke={items.sphere === 'spot2' ? '#8A5A00' : 'rgba(255, 255, 255, 0.7)'}
              strokeWidth="1.5"
              strokeDasharray={items.sphere === 'spot2' ? 'none' : '3 3'}
            />
          </g>

          {/* Target Prisma di x=21.8m, y=5.0m (872px, 280px) */}
          <g transform="translate(872, 280)">
            <polygon
              points="0,-10 9,7 -9,7"
              fill={items.prism === 'spot2' ? '#FFC933' : 'rgba(255, 255, 255, 0.2)'}
              stroke={items.prism === 'spot2' ? '#8A5A00' : 'rgba(255, 255, 255, 0.7)'}
              strokeWidth="1.5"
              strokeDasharray={items.prism === 'spot2' ? 'none' : '3 3'}
            />
          </g>
        </g>

        {/* 7. Jalur Acuan FTP (Dashed Blue Line) */}
        <polyline
          points={ftpPathPoints}
          fill="none"
          stroke="#1F5FE0"
          strokeWidth="2.5"
          strokeDasharray="8 6"
          markerEnd="url(#ftpArrow)"
          opacity="0.85"
        />
        <text x="140" y="222" fill="#1F5FE0" fontSize="12" fontWeight="700">
          START
        </text>

        {/* 8. Garis Penghubung Buoy Hijau & Merah (Faint Lines) */}
        <polyline
          points={ARENA_DATA.green.map(([x, y]) => `${x * 40},${(12 - y) * 40}`).join(' ')}
          fill="none"
          stroke="#22C55E"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          opacity="0.6"
        />
        <polyline
          points={ARENA_DATA.red.map(([x, y]) => `${x * 40},${(12 - y) * 40}`).join(' ')}
          fill="none"
          stroke="#EF4444"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          opacity="0.6"
        />

        {/* Keterangan baris buoy */}
        <text x="360" y="145" textAnchor="middle" fill="#15803D" fontSize="12" fontWeight="600">
          green row (left)
        </text>
        <text x="360" y="325" textAnchor="middle" fill="#B91C1C" fontSize="12" fontWeight="600">
          red row (right)
        </text>

        {/* 9. Penanda Tiga Gerbang (Gates) Pasangan Buoy ke-1, ke-3, ke-5 */}
        {ARENA_DATA.gates.map((gate) => {
          const gPt = arenaToSvg(ARENA_DATA.green[gate.greenIndex][0], ARENA_DATA.green[gate.greenIndex][1]);
          const rPt = arenaToSvg(ARENA_DATA.red[gate.redIndex][0], ARENA_DATA.red[gate.redIndex][1]);
          const gateCenterX = gPt.svgX;
          const gateCenterY = (gPt.svgY + rPt.svgY) / 2;

          return (
            <g key={gate.id}>
              {/* Garis batas gerbang */}
              <line
                x1={gateCenterX}
                y1={gPt.svgY}
                x2={gateCenterX}
                y2={rPt.svgY}
                stroke="#6B7A96"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />

              {/* Panah dimensi lebar gerbang */}
              <g stroke="#4B5B78" strokeWidth="1" opacity="0.9">
                <line x1={gateCenterX + 16} y1={gPt.svgY + 6} x2={gateCenterX + 16} y2={rPt.svgY - 6} />
                <polyline points={`${gateCenterX + 13},${gPt.svgY + 11} ${gateCenterX + 16},${gPt.svgY + 6} ${gateCenterX + 19},${gPt.svgY + 11}`} fill="none" />
                <polyline points={`${gateCenterX + 13},${rPt.svgY - 11} ${gateCenterX + 16},${rPt.svgY - 6} ${gateCenterX + 19},${rPt.svgY - 11}`} fill="none" />
              </g>

              {/* Label badge dimensi gerbang */}
              <rect
                x={gateCenterX - 28}
                y={gateCenterY - 10}
                width="56"
                height="20"
                rx="4"
                fill="rgba(255, 255, 255, 0.9)"
                stroke="#A9BCDC"
                strokeWidth="1"
              />
              <text
                x={gateCenterX}
                y={gateCenterY + 4}
                textAnchor="middle"
                fill="#0F1B2D"
                fontSize="10"
                fontWeight="700"
              >
                {`G${gate.id} ${gate.width.toFixed(1)}m`}
              </text>
            </g>
          );
        })}

        {/* 10. Rintangan Kolam (Obstacles) */}
        {ARENA_DATA.obstacles.map((obs, idx) => {
          const pt = arenaToSvg(obs.x, obs.y);
          const isYellow = obs.color === 'yellow';

          return (
            <g key={idx} transform={`translate(${pt.svgX}, ${pt.svgY})`}>
              <circle
                r="10"
                fill={isYellow ? '#FFB300' : '#111827'}
                stroke={isYellow ? '#D97706' : '#374151'}
                strokeWidth="2"
              />
            </g>
          );
        })}

        {/* 11. Buoy Hijau (5 Buah) */}
        {ARENA_DATA.green.map(([x, y], idx) => {
          const pt = arenaToSvg(x, y);
          return (
            <g key={`green-${idx}`} transform={`translate(${pt.svgX}, ${pt.svgY})`}>
              <circle r="7.5" fill="#22C55E" stroke="#15803D" strokeWidth="2.5" />
            </g>
          );
        })}

        {/* 12. Buoy Merah (5 Buah) */}
        {ARENA_DATA.red.map(([x, y], idx) => {
          const pt = arenaToSvg(x, y);
          return (
            <g key={`red-${idx}`} transform={`translate(${pt.svgX}, ${pt.svgY})`}>
              <circle r="7.5" fill="#EF4444" stroke="#B91C1C" strokeWidth="2.5" />
            </g>
          );
        })}

        {/* 13. Jejak Kapal (Trail) */}
        {trail.length > 1 && (
          <polyline
            points={trailPoints}
            fill="none"
            stroke="#00E5FF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
          />
        )}

        {/* 14. Robot ASV (WAM-V Catamaran) */}
        <g
          transform={`translate(${robotSvg.svgX}, ${robotSvg.svgY}) rotate(${-yaw})`}
          style={{ transition: 'transform 0.1s linear' }}
        >
          {/* Efek halo cahaya kapal */}
          <circle r="22" fill="rgba(37, 99, 235, 0.2)" />

          {/* Lambung Kiri Catamaran (Pontoon) */}
          <rect x="-18" y="-12" width="36" height="6" rx="3" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="1" />

          {/* Lambung Kanan Catamaran (Pontoon) */}
          <rect x="-18" y="6" width="36" height="6" rx="3" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="1" />

          {/* Dek Tengah (Platform Kapal) */}
          <rect x="-10" y="-8" width="20" height="16" rx="2" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1" />

          {/* Arah Hadap Depan (Heading Arrow) */}
          <polygon points="12,0 6,-4 6,4" fill="#FFFFFF" />

          {/* Indikator Muatan di Atas Kapal */}
          {(items.cube === 'board' || items.sphere === 'board' || items.prism === 'board') && (
            <circle cx="-1" cy="0" r="3.5" fill="#FFC933" stroke="#8A5A00" strokeWidth="0.8" />
          )}
        </g>
      </svg>
    </div>
  );
}
