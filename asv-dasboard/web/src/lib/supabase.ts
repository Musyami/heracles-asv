/**
 * supabase.ts
 * Inisialisasi klien Supabase untuk Web Dashboard (Fase F6 - Level Disruptive).
 * 
 * ATURAN KEAMANAN (AGENTS.md):
 * - HANYA menggunakan NEXT_PUBLIC_SUPABASE_ANON_KEY (baca publik lewat RLS).
 * - JANGAN PERNAH menaruh atau mengimpor service_role_key di kode web!
 * - Jika variabel lingkungan tidak ada atau tidak valid, fungsi ini tidak crash
 *   dan mengembalikan null agar aplikasi jatuh ke data cadangan (demo-run.json).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Periksa apakah kredensial Supabase terisi lengkap
export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim().length > 0
  );
};

// Singleton klien Supabase
let clientInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance) {
    try {
      clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    } catch (err) {
      console.warn('Gagal menginisialisasi klien Supabase:', err);
      return null;
    }
  }

  return clientInstance;
}
