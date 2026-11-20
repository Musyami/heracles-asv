/**
 * arena.ts
 * Geometri, data statis, dan utilitas konversi koordinat untuk peta kolam 24 x 12 meter.
 * Mengikuti reference/arena_mock/arena.json dan docs/topics.md.
 */

import { ARENA_CONFIG } from './config';

// Data statis arena kolam sesuai reference/arena_mock/arena.json
export const ARENA_DATA = {
  W: 24.0, // Panjang kolam (meter)
  H: 12.0, // Lebar kolam (meter)
  dock_w: 3.0,
  dock_h: 4.0,
  slot_d: 1.5,
  slot_w: 1.2,
  buoy_r: 0.15,
  obs_r: 0.22,
  asv_L: 0.99,
  asv_B: 0.6,

  // 5 Buoy Hijau (baris kiri/utara di y = 6.15 - 7.75)
  green: [
    [6.0, 7.6],
    [9.0, 7.75],
    [12.0, 6.15],
    [15.0, 7.75],
    [18.0, 7.6],
  ] as [number, number][],

  // 5 Buoy Merah (baris kanan/selatan di y = 4.25 - 5.6)
  red: [
    [6.0, 5.6],
    [9.0, 4.25],
    [12.0, 4.65],
    [15.0, 4.25],
    [18.0, 5.6],
  ] as [number, number][],

  // 3 Gerbang (Pasangan buoy ke-1, ke-3, dan ke-5): [x, center_y, lebar_gerbang]
  gates: [
    { id: 1, x: 6.0, cy: 6.6, width: 2.0, greenIndex: 0, redIndex: 0 },
    { id: 2, x: 12.0, cy: 5.4, width: 1.5, greenIndex: 2, redIndex: 2 },
    { id: 3, x: 18.0, cy: 6.6, width: 2.0, greenIndex: 4, redIndex: 4 },
  ],

  // 4 Rintangan Kolam
  obstacles: [
    { x: 7.5, y: 6.8, color: 'yellow', radius: 0.22 },
    { x: 10.5, y: 5.125, color: 'black', radius: 0.22 },
    { x: 13.5, y: 6.125, color: 'black', radius: 0.22 },
    { x: 16.5, y: 5.8, color: 'yellow', radius: 0.22 },
  ],

  // Posisi awal 3 Barang di Spot 1 (cy = 6.0)
  items: [
    { shape: 'cube' as const, name: 'Kubus', x: 0.9, y: 6.0 },
    { shape: 'sphere' as const, name: 'Bola', x: 2.2, y: 7.0 },
    { shape: 'prism' as const, name: 'Prisma', x: 2.2, y: 5.0 },
  ],

  // Target penempatan barang di Spot 2 (Drop Zone: W - x, cy + dy)
  drops: [
    { shape: 'cube' as const, name: 'Kubus', x: 23.1, y: 6.0 },
    { shape: 'sphere' as const, name: 'Bola', x: 21.8, y: 7.0 },
    { shape: 'prism' as const, name: 'Prisma', x: 21.8, y: 5.0 },
  ],

  // Batas Area Follow The Path (FTP)
  ftpArea: {
    x0: 4.5,
    x1: 19.5,
    y0: 2.6,
    y1: 9.4,
  },

  // Jalur acuan FTP dari Spot 1 melewati 3 gerbang ke Spot 2
  defaultPath: [
    [2.0, 6.0],
    [4.0, 6.0],
    [6.0, 6.6], // Gate 1
    [8.5, 6.0],
    [10.5, 5.8],
    [12.0, 5.4], // Gate 2
    [14.5, 6.2],
    [16.5, 6.4],
    [18.0, 6.6], // Gate 3
    [20.0, 6.0],
    [22.0, 6.0],
  ] as [number, number][],
};

/**
 * Mengonversi koordinat dunia VRX/Gazebo ke koordinat arena kolam (meter).
 * Nilai skala dan offset dapat disesuaikan di config.ts.
 */
export function vrxToArena(vrxX: number, vrxY: number): { x: number; y: number } {
  const { scaleX, scaleY, offsetX, offsetY, invertY } = ARENA_CONFIG.COORDINATE_TRANSFORM;
  const x = vrxX * scaleX + offsetX;
  let y = vrxY * scaleY + offsetY;

  if (invertY) {
    y = ARENA_CONFIG.POOL_HEIGHT - y;
  }

  // Batasi agar tidak keluar jauh dari kolam (clamping dengan toleransi)
  const clampedX = Math.max(-1, Math.min(ARENA_CONFIG.POOL_WIDTH + 1, x));
  const clampedY = Math.max(-1, Math.min(ARENA_CONFIG.POOL_HEIGHT + 1, y));

  return { x: clampedX, y: clampedY };
}

/**
 * Mengonversi koordinat arena kolam (meter) ke koordinat piksel SVG viewBox (960 x 480).
 * Mengingat di robotik Y=0 ada di bawah (selatan) dan Y=12 di atas (utara),
 * sedangkan SVG Y=0 ada di atas, maka sumbu Y dibalik: svgY = (12 - y) * 40.
 */
export function arenaToSvg(
  x: number,
  y: number,
  svgWidth = 960
): { svgX: number; svgY: number } {
  const scale = svgWidth / ARENA_CONFIG.POOL_WIDTH; // 960 / 24 = 40 px/m
  const svgX = x * scale;
  const svgY = (ARENA_CONFIG.POOL_HEIGHT - y) * scale;
  return { svgX, svgY };
}

/**
 * Mengonversi ukuran meter ke skala piksel SVG.
 */
export function meterToSvg(meters: number, svgWidth = 960): number {
  return meters * (svgWidth / ARENA_CONFIG.POOL_WIDTH);
}
