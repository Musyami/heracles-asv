/**
 * store.ts
 * State manager reaktif sederhana tanpa library eksternal.
 * Sumber data (demo, live, cloud) memperbarui store ini, dan UI hanya membaca dari sini.
 */

import { useSyncExternalStore, useState, useEffect } from 'react';
import { DashboardStoreState } from './types';
import { STALE_TIMEOUT_MS } from './config';

// State awal dashboard saat baru dibuka
export const initialDashboardState: DashboardStoreState = {
  connection: 'connecting',
  missionState: 'IDLE',
  battery: {
    percentage: null,
    voltage: null,
  },
  system: {
    killSwitch: false,
    buzzer: false,
    spray: false,
  },
  gripper: 'READY',
  items: {
    prism: 'spot1',
    sphere: 'spot1',
    cube: 'spot1',
  },
  telemetry: {
    x: null,
    y: null,
    yaw: null,
    speed: null,
  },
  thrusters: {
    left: null,
    right: null,
  },
  ftpScore: {
    direction: 'Spot 1 → Spot 2',
    attempt: 1,
    collisions: 0,
    status: 'idle',
    score: null,
  },
  events: [],
  missionTime: 0,
  cameraImage: null,
  isFallbackData: false,
  lastUpdated: 0, // 0 = belum ada data yang masuk
};

// Variabel penyimpan state tunggal
let currentState: DashboardStoreState = { ...initialDashboardState };
const listeners = new Set<() => void>();

/**
 * Mengambil snapshot state saat ini
 */
export function getDashboardState(): DashboardStoreState {
  return currentState;
}

/**
 * Memperbarui state secara parsial atau dengan fungsi updater
 */
export function setDashboardState(
  updater:
    | Partial<DashboardStoreState>
    | ((prev: DashboardStoreState) => Partial<DashboardStoreState>)
): void {
  const patch = typeof updater === 'function' ? updater(currentState) : updater;
  currentState = {
    ...currentState,
    ...patch,
    lastUpdated: patch.lastUpdated ?? Date.now(),
  };

  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error pada listener store:', e);
    }
  });
}

/**
 * Reset store ke kondisi awal
 */
export function resetDashboardState(): void {
  currentState = { ...initialDashboardState };
  listeners.forEach((listener) => listener());
}

/**
 * Berlangganan perubahan state
 */
export function subscribeToDashboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Hook React untuk membaca state dari store dengan selector
 */
export function useDashboardStore<T>(
  selector: (state: DashboardStoreState) => T
): T {
  return useSyncExternalStore(
    subscribeToDashboard,
    () => selector(currentState),
    () => selector(initialDashboardState)
  );
}

/**
 * Memeriksa apakah data sudah basi (> 3 detik tanpa pembaruan)
 */
export function isDataStale(lastUpdated: number): boolean {
  if (lastUpdated === 0) return true;
  return Date.now() - lastUpdated > STALE_TIMEOUT_MS;
}

/**
 * Hook reaktif untuk memeriksa status data basi di komponen React.
 * Mengecek ulang setiap 1 detik sehingga lencana 'Data basi' otomatis muncul
 * tepat saat data berhenti masuk lebih dari 3 detik.
 */
export function useIsDataStale(): boolean {
  const lastUpdated = useDashboardStore((s) => s.lastUpdated);

  // Hitung nilai awal langsung (tanpa setState di dalam effect)
  const [stale, setStale] = useState<boolean>(() => isDataStale(lastUpdated));

  useEffect(() => {
    // Perbarui setiap 1 detik agar lencana 'Data basi' muncul tepat waktunya
    const tick = () => setStale(isDataStale(lastUpdated));
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  return stale;
}

