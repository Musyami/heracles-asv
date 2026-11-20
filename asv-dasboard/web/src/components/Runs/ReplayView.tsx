'use client';

/**
 * ReplayView.tsx
 * Pemutar ulang (replay player) sesi misi ASV lengkap dengan kontrol interaktif:
 * - Play / Pause
 * - Scrubber timeline slider
 * - Kecepatan pemutaran 1x / 2x
 * - Tombol unduh data telemetri format CSV
 * - Sinkronisasi peta lintasan robot (PoolMap), telemetri, thruster, log kejadian, dan status misi
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { fetchRunDetails, RunDetails, RunSample } from '@/lib/sources/cloud';
import PoolMap from '@/components/cards/PoolMap';
import { arenaToSvg, vrxToArena } from '@/lib/arena';
import { MISSION_STATE_DESCRIPTIONS } from '@/lib/config';

interface ReplayViewProps {
  runId: string;
}

export default function ReplayView({ runId }: ReplayViewProps) {
  const [data, setData] = useState<RunDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Status Pemutar
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // detik
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);

  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  // Ambil data run saat komponen dipasang
  useEffect(() => {
    let active = true;
    fetchRunDetails(runId).then((result) => {
      if (active) {
        setData(result);
        setIsLoading(false);
        // Set awal waktu ke 0
        setCurrentTime(0);
      }
    });
    return () => {
      active = false;
    };
  }, [runId]);

  // Durasi total misi
  const totalDuration = useMemo(() => {
    if (!data) return 0;
    if (data.run.summary?.total_time_s) return data.run.summary.total_time_s;
    if (data.samples.length > 0) return data.samples[data.samples.length - 1].t;
    return 100;
  }, [data]);

  // Efek animasi pemutaran waktu nyata
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      lastTickRef.current = null;
      return;
    }

    let isSubscribed = true;

    const onFrame = (timestamp: number) => {
      if (!isSubscribed) return;
      if (!lastTickRef.current) {
        lastTickRef.current = timestamp;
      }
      const deltaSec = ((timestamp - lastTickRef.current) / 1000) * playbackSpeed;
      lastTickRef.current = timestamp;

      setCurrentTime((prev) => {
        const next = prev + deltaSec;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(onFrame);
    };

    lastTickRef.current = null;
    animationFrameRef.current = requestAnimationFrame(onFrame);

    return () => {
      isSubscribed = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, totalDuration]);

  // Ambil sampel telemetri terdekat dengan currentTime
  const currentSample = useMemo<RunSample | null>(() => {
    if (!data || data.samples.length === 0) return null;
    // Cari sampel dengan waktu t <= currentTime terdekat
    let best = data.samples[0];
    for (let i = 0; i < data.samples.length; i++) {
      if (data.samples[i].t <= currentTime) {
        best = data.samples[i];
      } else {
        break;
      }
    }
    return best;
  }, [data, currentTime]);

  // Kejadian yang sudah terjadi hingga currentTime
  const visibleEvents = useMemo(() => {
    if (!data) return [];
    return data.events.filter((e) => e.t <= currentTime);
  }, [data, currentTime]);

  // Jejak pergerakan (trail) hingga currentTime
  const replayTrail = useMemo(() => {
    if (!data || data.samples.length === 0) return [];
    return data.samples
      .filter((s) => s.t <= currentTime)
      .map((s) => {
        const arena = vrxToArena(s.x, s.y);
        const svg = arenaToSvg(arena.x, arena.y);
        return { x: svg.svgX, y: svg.svgY };
      });
  }, [data, currentTime]);

  // Fungsi Toggle Play / Pause
  const togglePlay = () => {
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
    }
    setIsPlaying((prev) => !prev);
  };

  // Fungsi Export / Unduh CSV
  const downloadCsv = () => {
    if (!data || data.samples.length === 0) return;

    const headers = [
      't_detik',
      'mission_state',
      'battery_pct',
      'battery_v',
      'x_m',
      'y_m',
      'yaw_deg',
      'thrust_left',
      'thrust_right',
      'kill_switch',
      'gripper',
    ];

    const rows = data.samples.map((s) => [
      s.t.toFixed(1),
      s.mission_state,
      s.battery_pct.toFixed(1),
      s.battery_v.toFixed(2),
      s.x.toFixed(2),
      s.y.toFixed(2),
      s.yaw.toFixed(1),
      Math.round(s.thrust_left),
      Math.round(s.thrust_right),
      s.kill_switch ? 'true' : 'false',
      s.gripper,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `run_${data.run.id}_telemetry.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format detik ke mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <h2>Memuat sesi replay...</h2>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <h2>Data sesi misi tidak ditemukan.</h2>
        <Link href="/runs" style={{ color: '#1F5FE0', marginTop: '16px', display: 'inline-block' }}>
          ← Kembali ke daftar run
        </Link>
      </main>
    );
  }

  const stateDesc = currentSample?.mission_state
    ? MISSION_STATE_DESCRIPTIONS[currentSample.mission_state] || currentSample.mission_state
    : '—';

  return (
    <main style={{ maxWidth: '1360px', margin: '0 auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner Informasi Fallback jika data cadangan */}
      {data.isFallback && (
        <aside
          role="status"
          style={{
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid #EAB308',
            color: 'var(--text)',
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <b>Sesi Contoh Cadangan:</b> Meninjau data simulasi statis lokal (<code>demo-run.json</code>).
          </span>
          <Link href="/runs" style={{ color: 'inherit', fontWeight: 600 }}>
            Daftar Run →
          </Link>
        </aside>
      )}

      {/* Bar Navigasi & Judul Run */}
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/runs"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'inherit',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              ← Kembali
            </Link>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>
              {data.run.name}
            </h1>
          </div>
          <div className="mono" style={{ fontSize: '13px', opacity: 0.65, marginTop: '4px' }}>
            ID: {data.run.id} · Status: {data.run.status} · Mulai: {new Date(data.run.started_at).toLocaleString('id-ID')}
          </div>
        </div>

        <button
          type="button"
          onClick={downloadCsv}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '10px',
            background: '#16A34A',
            color: '#fff',
            fontWeight: 600,
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>📥 Unduh CSV</span>
        </button>
      </section>

      {/* PANEL KONTROL REPLAY (Timeline Scrubber & Kecepatan) */}
      <section
        role="region"
        aria-label="Panel Kontrol Replay"
        style={{
          background: 'var(--card-gray-bg)',
          border: '1.5px solid var(--card-border)',
          borderRadius: '18px',
          padding: '18px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Tombol Play/Pause */}
          <button
            type="button"
            onClick={togglePlay}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: '#1F5FE0',
              border: 'none',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 2px 8px rgba(31, 95, 224, 0.4)',
            }}
            aria-label={isPlaying ? 'Jeda pemutaran replay' : 'Mulai pemutaran replay'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Indikator Waktu */}
          <div className="mono" style={{ fontSize: '18px', fontWeight: 700, minWidth: '130px' }}>
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </div>

          {/* Slider Scrubber Waktu */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              type="range"
              min={0}
              max={totalDuration || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => {
                setCurrentTime(parseFloat(e.target.value));
              }}
              style={{
                width: '100%',
                cursor: 'pointer',
                accentColor: '#1F5FE0',
                height: '8px',
              }}
              aria-label="Seek timeline replay"
            />
          </div>

          {/* Pengalih Kecepatan (1x / 2x) */}
          <div
            role="group"
            aria-label="Kecepatan putar"
            style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '8px', padding: '3px' }}
          >
            <button
              type="button"
              onClick={() => setPlaybackSpeed(1)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: playbackSpeed === 1 ? '#1F5FE0' : 'transparent',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              1x
            </button>
            <button
              type="button"
              onClick={() => setPlaybackSpeed(2)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: playbackSpeed === 2 ? '#1F5FE0' : 'transparent',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              2x
            </button>
          </div>
        </div>
      </section>

      {/* TAMPILAN SINKRONISASI TELEMETRI SIKLUS WAKTU t */}
      <div style={{ display: 'grid', gridTemplateColumns: '740fr 500fr', gap: '20px' }}>
        {/* Kolom Kiri: Peta Kolam Interaktif dengan Jejak Replay */}
        <div className="card blue map">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Peta Lintasan Replay</h3>
            <span className="mono" style={{ fontSize: '14px', opacity: 0.9 }}>
              t = {currentTime.toFixed(1)}s
            </span>
          </div>

          <div className="mapimg" style={{ marginTop: '12px', border: '2px solid rgba(255, 255, 255, 0.85)' }}>
            <PoolMap
              overrideRobot={{
                x: currentSample?.x ?? 2.2,
                y: currentSample?.y ?? 6.0,
                yaw: currentSample?.yaw ?? 0,
              }}
              overrideTrail={replayTrail}
            />
          </div>

          {/* Ringkasan Skor & Tabrakan */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '15px' }}>
            <span>
              Target: <b>{data.run.summary?.direction || 'Spot 1 → Spot 2'}</b>
            </span>
            <span>
              Tabrakan: <b>{data.run.summary?.collisions ?? 0}</b>
            </span>
            <span>
              Skor Akhir: <b>{data.run.summary?.score ?? 100}</b>
            </span>
          </div>
        </div>

        {/* Kolom Kanan: Telemetri, Thruster, State, & Event Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Kartu Status & State */}
          <div className="card green" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="lbl" style={{ fontSize: '18px' }}>Mission State Saat Ini</div>
              <div className="mono" style={{ fontSize: '16px', fontWeight: 700 }}>
                Baterai: {currentSample?.battery_pct ? `${currentSample.battery_pct.toFixed(0)}%` : '—'} ({currentSample?.battery_v ? `${currentSample.battery_v.toFixed(1)}V` : '—'})
              </div>
            </div>
            <div className="big" style={{ fontSize: '32px', marginTop: '6px' }}>
              {currentSample?.mission_state || '—'}
            </div>
            <div className="sub" style={{ fontSize: '16px' }}>
              {stateDesc}
            </div>
          </div>

          {/* Kartu Telemetri & Thruster */}
          <div className="card teal" style={{ padding: '16px 20px' }}>
            <div className="lbl" style={{ fontSize: '18px' }}>Telemetri & Thruster</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '10px' }}>
              <div>
                <span style={{ fontSize: '13px', opacity: 0.85 }}>Posisi X</span>
                <div className="mono" style={{ fontSize: '20px', fontWeight: 700 }}>
                  {currentSample?.x !== undefined ? `${currentSample.x.toFixed(2)} m` : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '13px', opacity: 0.85 }}>Posisi Y</span>
                <div className="mono" style={{ fontSize: '20px', fontWeight: 700 }}>
                  {currentSample?.y !== undefined ? `${currentSample.y.toFixed(2)} m` : '—'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '13px', opacity: 0.85 }}>Yaw (Hadap)</span>
                <div className="mono" style={{ fontSize: '20px', fontWeight: 700 }}>
                  {currentSample?.yaw !== undefined ? `${Math.round(currentSample.yaw)}°` : '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.2)', paddingTop: '10px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>Thruster Kiri</span>
                  <span className="mono">{Math.round(currentSample?.thrust_left ?? 0)} N</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>Thruster Kanan</span>
                  <span className="mono">{Math.round(currentSample?.thrust_right ?? 0)} N</span>
                </div>
              </div>
            </div>
          </div>

          {/* Log Kejadian Misi Terkumpul Sampai Detik t */}
          <div
            className="card gray"
            style={{
              flex: 1,
              padding: '16px 20px',
              minHeight: '220px',
              maxHeight: '280px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <div className="lbl" style={{ fontSize: '18px' }}>Log Kejadian (s.d. {currentTime.toFixed(1)}s)</div>
              <span className="mono" style={{ fontSize: '13px', opacity: 0.8 }}>
                {visibleEvents.length} kejadian
              </span>
            </div>

            {visibleEvents.length === 0 ? (
              <div style={{ opacity: 0.6, fontSize: '14px', marginTop: '20px', textAlign: 'center' }}>
                Belum ada kejadian tercatat di awal misi.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                {visibleEvents.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <span className="mono" style={{ color: '#5AA9FF', fontWeight: 700, minWidth: '45px' }}>
                      {ev.t.toFixed(1)}s
                    </span>
                    <span style={{ fontWeight: 600, textTransform: 'uppercase', minWidth: '90px' }}>
                      {ev.type}
                    </span>
                    <span style={{ opacity: 0.9 }}>
                      {ev.data?.description
                        ? String(ev.data.description)
                        : ev.data
                        ? JSON.stringify(ev.data)
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
