/**
 * sources/index.ts
 * Manajer sumber data aplikasi dashboard.
 * Menentukan sumber data aktif berdasarkan parameter URL (?source=demo|live|cloud)
 * atau variabel lingkungan NEXT_PUBLIC_MODE (local -> live, public -> cloud).
 */

import { startDemoSource, triggerDemoKillSwitch } from './demo';
import { startLiveSource, publishKillSwitchCommand } from './live';
import { startCloudSource } from './cloud';

export type DataSourceType = 'demo' | 'live' | 'cloud';

/**
 * Mengirim perintah kill switch darurat ke robot (mode live) atau simulator demo
 */
export function sendKillSwitchCommand(cmd = true) {
  const sourceType = resolveDataSourceType();
  if (sourceType === 'live') {
    publishKillSwitchCommand(cmd);
  } else if (sourceType === 'demo') {
    triggerDemoKillSwitch(cmd);
  }
}

/**
 * Mendeteksi jenis sumber data yang harus digunakan
 */
export function resolveDataSourceType(searchParams?: URLSearchParams): DataSourceType {
  // 1. Cek parameter query ?source=
  const param = searchParams?.get('source')?.toLowerCase();
  if (param === 'demo' || param === 'live' || param === 'cloud') {
    return param as DataSourceType;
  }

  // 2. Jika di client browser dan ada window.location.search
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSource = urlParams.get('source')?.toLowerCase();
    if (urlSource === 'demo' || urlSource === 'live' || urlSource === 'cloud') {
      return urlSource as DataSourceType;
    }
  }

  // 3. Fallback default sesuai env NEXT_PUBLIC_MODE
  const mode = process.env.NEXT_PUBLIC_MODE?.toLowerCase();
  if (mode === 'public') {
    return 'cloud';
  }

  // Default untuk mode lokal adalah 'live' jika tersambung ke rosbridge, atau 'demo' sebagai cadangan
  return mode === 'local' ? 'live' : 'demo';
}

/**
 * Mengaktifkan sumber data terpilih dan mengembalikan fungsi pembersih (cleanup)
 */
export function initDataSource(type: DataSourceType): () => void {
  switch (type) {
    case 'demo':
      return startDemoSource();

    case 'live':
      return startLiveSource();

    case 'cloud':
      return startCloudSource();

    default:
      return startDemoSource();
  }
}
