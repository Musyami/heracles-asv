'use client';

/**
 * RunsListView.tsx
 * Komponen antarmuka daftar riwayat sesi uji coba kapal ASV (Fase F6).
 * Membaca data dari tabel `runs` Supabase atau jatuh ke `demo-run.json`.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchRuns, RunItem } from '@/lib/sources/cloud';

export default function RunsListView() {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchRuns().then((result) => {
      if (active) {
        setRuns(result.runs);
        setIsFallback(result.isFallback);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Banner informasi jika menggunakan data cadangan */}
      {isFallback && (
        <aside
          role="status"
          style={{
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid #EAB308',
            color: 'var(--text)',
            padding: '12px 18px',
            borderRadius: '12px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <b>Mode Data Cadangan Aktif:</b> Menampilkan sesi contoh lokal (<code>demo-run.json</code>) karena kredensial Supabase di <code>.env.local</code> belum disetel atau tabel di cloud masih kosong.
          </div>
        </aside>
      )}

      {/* Header Halaman */}
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>Riwayat Sesi Misi ASV</h1>
          <p style={{ opacity: 0.75, marginTop: '4px', fontSize: '15px' }}>
            Daftar seluruh rekaman uji coba misi KKI 2026. Klik &quot;Putar Ulang (Replay)&quot; untuk meninjau lintasan dan telemetri per detik.
          </p>
        </div>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            background: '#1F5FE0',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          ← Kembali ke Live Dashboard
        </Link>
      </section>

      {/* Daftar Run Tabel / Kartu */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.7 }}>
          Memuat data riwayat run...
        </div>
      ) : runs.length === 0 ? (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            borderRadius: '16px',
            background: 'var(--card-gray-bg)',
            border: '1px solid var(--card-border)',
            color: 'var(--text)',
          }}
        >
          <p style={{ fontSize: '16px', opacity: 0.8 }}>Belum ada sesi misi yang tersimpan di database.</p>
        </div>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            borderRadius: '16px',
            border: '1px solid var(--card-border)',
            background: 'var(--card-gray-bg)',
            color: 'var(--text)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--table-border)', background: 'rgba(120, 140, 180, 0.08)' }}>
                <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'inherit' }}>Nama Sesi / ID</th>
                <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'inherit' }}>Status</th>
                <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'inherit' }}>Waktu Mulai</th>
                <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'inherit' }}>Durasi</th>
                <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'inherit' }}>Skor FTP</th>
                <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'inherit' }}>Tabrakan</th>
                <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', textAlign: 'right', color: 'inherit' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const isFinished = r.status === 'finished';
                const isAborted = r.status === 'aborted';
                const statusColor = isFinished ? '#22C55E' : isAborted ? '#EF4444' : '#3B82F6';
                const statusLabel = isFinished ? 'Selesai' : isAborted ? 'Gagal / ESTOP' : 'Berjalan';
                const startDateStr = new Date(r.started_at).toLocaleString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const duration = r.summary?.total_time_s ? `${Math.round(r.summary.total_time_s)} detik` : '—';
                const score = r.summary?.score !== undefined ? `${r.summary.score}` : '—';
                const collisions = r.summary?.collisions !== undefined ? `${r.summary.collisions}` : '0';

                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid var(--table-border)',
                    }}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>{r.name}</div>
                      <div className="mono" style={{ fontSize: '12px', opacity: 0.65, marginTop: '2px' }}>
                        {r.id}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: `${statusColor}22`,
                          color: statusColor,
                          border: `1px solid ${statusColor}55`,
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: statusColor,
                          }}
                        />
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', opacity: 0.9 }}>
                      {startDateStr}
                    </td>
                    <td className="mono" style={{ padding: '16px 20px', fontSize: '14px' }}>
                      {duration}
                    </td>
                    <td className="mono" style={{ padding: '16px 20px', fontSize: '15px', fontWeight: 700 }}>
                      {score}
                    </td>
                    <td className="mono" style={{ padding: '16px 20px', fontSize: '14px' }}>
                      {collisions}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <Link
                        href={`/runs/${r.id}`}
                        style={{
                          display: 'inline-block',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          background: '#1F5FE0',
                          color: '#FFFFFF',
                          textDecoration: 'none',
                          fontSize: '13px',
                          fontWeight: 700,
                          boxShadow: '0 2px 6px rgba(31, 95, 224, 0.3)',
                        }}
                      >
                        Putar Replay ▶
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
