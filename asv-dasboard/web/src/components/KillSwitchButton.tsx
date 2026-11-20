'use client';

/**
 * KillSwitchButton.tsx
 * Tombol darurat Kill Switch kapal ASV mengikuti aturan keamanan di AGENTS.md:
 * 1. Hanya dirender pada MODE LOCAL dan bukan ?readonly=1 (di MODE PUBLIC tidak ditampilkan).
 * 2. Memerlukan dialog konfirmasi sebelum mengirim sinyal perintah.
 * 3. Memublikasikan pesan Bool (data: true) ke topic /dashboard/kill_switch_cmd via roslib.
 * 4. Nonaktif secara otomatis saat koneksi terputus/menyambung.
 * 5. Status di layar murni berasal dari topic umpan balik /asv/kill_switch (bukan dugaan tombol).
 */

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDashboardStore } from '@/lib/store';
import { sendKillSwitchCommand } from '@/lib/sources';

// Helper fungsi bebas langganan untuk mendeteksi hidrasi client secara aman
const emptySubscribe = () => () => {};

export default function KillSwitchButton() {
  const searchParams = useSearchParams();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Ambil status koneksi dan status kill switch terkini dari store
  const connection = useDashboardStore((s) => s.connection);
  const killSwitchActive = useDashboardStore((s) => s.system.killSwitch);
  const missionState = useDashboardStore((s) => s.missionState);

  // Menangani penekanan tombol ESC untuk menutup modal konfirmasi
  useEffect(() => {
    if (!isConfirmOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsConfirmOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    // Fokuskan tombol batal untuk keamanan aksesibilitas
    setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isConfirmOpen]);

  // Jika belum hidrasi client, jangan render apapun
  if (!isClient) {
    return null;
  }

  // ATURAN KEAMANAN:
  // Tombol TIDAK DIRENDER bila MODE=public atau URL memiliki parameter ?readonly=1
  const isPublicMode = process.env.NEXT_PUBLIC_MODE?.toLowerCase() === 'public';
  const readonlyParam = searchParams.get('readonly')?.toLowerCase();
  const isReadonly = readonlyParam === '1' || readonlyParam === 'true';

  if (isPublicMode || isReadonly) {
    return null;
  }

  const isConnected = connection === 'connected';
  const isEstop = killSwitchActive || missionState === 'ESTOP';

  // Handler eksekusi kirim perintah kill switch
  function handleConfirmKill() {
    setIsSending(true);
    try {
      // Kirim pesan { data: true } ke topic perintah /dashboard/kill_switch_cmd
      sendKillSwitchCommand(true);
    } finally {
      setIsSending(false);
      setIsConfirmOpen(false);
    }
  }

  // Handler untuk perintah pemulihan darurat jika dalam kondisi ESTOP
  function handleConfirmReset() {
    setIsSending(true);
    try {
      // Kirim pesan { data: false } untuk memulihkan sistem jika diperlukan
      sendKillSwitchCommand(false);
    } finally {
      setIsSending(false);
      setIsConfirmOpen(false);
    }
  }

  return (
    <div className="kill-switch-container">
      {/* Tombol Utama Kill Switch */}
      <button
        type="button"
        className={`kill-switch-btn ${isEstop ? 'is-active' : ''}`}
        disabled={!isConnected || isSending}
        onClick={() => setIsConfirmOpen(true)}
        aria-label="Tombol Darurat Kill Switch Kapal"
        title={!isConnected ? 'Tombol nonaktif: koneksi ke robot terputus' : undefined}
      >
        <span className="kill-icon" aria-hidden="true">
          {isEstop ? '🛑' : '⚠️'}
        </span>
        <span className="kill-text">
          {!isConnected
            ? 'Kill Switch (Tidak Terhubung)'
            : isEstop
              ? 'ESTOP AKTIF (Matikan Ulang / Reset)'
              : 'MATIKAN KAPAL (KILL SWITCH)'}
        </span>
      </button>

      {/* Subteks Keterangan Keamanan */}
      <div className="kill-hint">
        {!isConnected
          ? 'Perintah kontrol hanya aktif saat terhubung ke robot.'
          : isEstop
            ? 'Robot dalam kondisi darurat berhenti.'
            : 'Mengharuskan dialog konfirmasi sebelum eksekusi.'}
      </div>

      {/* MODAL DIALOG KONFIRMASI (Wajib sesuai AGENTS.md) */}
      {isConfirmOpen && (
        <div
          className="kill-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kill-dialog-title"
          onClick={() => setIsConfirmOpen(false)}
        >
          <div
            className="kill-modal-card"
            onClick={(e) => e.stopPropagation()} // Mencegah klik di dalam menutup dialog
          >
            <div className="modal-header">
              <span className="modal-icon" aria-hidden="true">
                🛑
              </span>
              <h4 id="kill-dialog-title">
                {isEstop ? 'Konfirmasi Pemulihan ESTOP' : 'Konfirmasi Darurat Kill Switch'}
              </h4>
            </div>

            <div className="modal-body">
              {isEstop ? (
                <>
                  <p>
                    Robot saat ini berada dalam kondisi <strong>ESTOP (Berhenti Darurat)</strong>.
                  </p>
                  <p>
                    Apakah Anda ingin mengirim sinyal pemulihan sistem ke robot untuk mengembalikan ke status <strong>IDLE</strong>?
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Apakah Anda yakin ingin <strong>MEMATIKAN KAPAL SEGERA</strong>?
                  </p>
                  <p className="modal-warn-text">
                    Tindakan ini akan memublikasikan pesan <code>&#123; data: true &#125;</code> ke topik ROS 2{' '}
                    <code>/dashboard/kill_switch_cmd</code>. Seluruh thruster akan dimatikan dan status misi menjadi <strong>ESTOP</strong>.
                  </p>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                ref={cancelButtonRef}
                className="btn-cancel"
                onClick={() => setIsConfirmOpen(false)}
              >
                Batal
              </button>
              {isEstop ? (
                <button
                  type="button"
                  className="btn-reset-estop"
                  onClick={handleConfirmReset}
                  disabled={isSending}
                >
                  {isSending ? 'Memproses...' : 'Pulihkan Sistem (IDLE)'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-danger-kill"
                  onClick={handleConfirmKill}
                  disabled={isSending}
                >
                  {isSending ? 'Mengirim...' : 'YA, MATIKAN KAPAL'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
