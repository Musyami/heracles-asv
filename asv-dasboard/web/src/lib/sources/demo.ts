/**
 * demo.ts
 * Sumber data demo (simulasi lokal bergerak tanpa ROS bridge / Supabase).
 * Menghasilkan data bergerak: pose, penurunan baterai, perubahan mission_state,
 * pemindahan muatan barang, pergerakan capit, thruster maju/mundur, skor FTP,
 * buzzer/spray, dan pengujian kill switch serta status koneksi.
 */

import { setDashboardState, getDashboardState } from '../store';
import { MissionEvent, MissionState, GripperState } from '../types';

let demoInterval: NodeJS.Timeout | null = null;
let tickCount = 0;

let demoKillSwitch = false;
let demoEstopTicks = 0;

/**
 * Memicu kondisi kill switch pada mode demo untuk pengujian UI tanpa server ROS
 */
export function triggerDemoKillSwitch(active = true) {
  demoKillSwitch = active;
  demoEstopTicks = 0;
  const state = getDashboardState();
  setDashboardState({
    missionState: active ? 'ESTOP' : 'IDLE',
    system: { ...state.system, killSwitch: active },
    thrusters: { left: 0, right: 0 },
    telemetry: { ...state.telemetry, speed: 0 },
    lastUpdated: Date.now(),
  });
}

export function startDemoSource(): () => void {
  demoKillSwitch = false;
  demoEstopTicks = 0;

  // Reset state awal untuk demo
  setDashboardState({
    connection: 'connected',
    missionState: 'IDLE',
    battery: {
      percentage: 95,
      voltage: 24.8,
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
      x: 2.2,
      y: 6.0,
      yaw: 0,
      speed: 0.0,
    },
    thrusters: {
      left: 0,
      right: 0,
    },
    ftpScore: {
      direction: 'Spot 1 → Spot 2',
      attempt: 1,
      collisions: 0,
      status: 'idle',
      score: null,
    },
    events: [
      {
        t: 0.0,
        type: 'start',
        data: {},
      },
    ],
    missionTime: 0,
    lastUpdated: Date.now(),
  });

  tickCount = 0;

  // Jalankan loop simulasi setiap 500 ms (2 kali per detik)
  demoInterval = setInterval(() => {
    tickCount++;
    const state = getDashboardState();

    // Jika kill switch diaktifkan dalam demo, tahan kondisi ESTOP selama 15 detik
    if (demoKillSwitch) {
      demoEstopTicks++;
      if (demoEstopTicks >= 30) {
        demoKillSwitch = false;
        demoEstopTicks = 0;
      } else {
        setDashboardState({
          missionState: 'ESTOP',
          system: { ...state.system, killSwitch: true },
          thrusters: { left: 0, right: 0 },
          telemetry: { ...state.telemetry, speed: 0 },
          lastUpdated: Date.now(),
        });
        return;
      }
    }

    // Skenario siklus waktu demo (total 100 detik siklus)
    const cycle = tickCount % 120;
    const missionTime = Math.max(0, cycle - 4) * 0.5;

    let nextMission: MissionState = 'IDLE';
    let nextGrip: GripperState = 'READY';
    let killSwitch = false;
    let buzzer = false;
    let spray = false;
    let ftpStatus: 'idle' | 'running' | 'finished' | 'failed' = 'idle';
    let ftpScore: number | null = null;
    let conn = state.connection;

    // Lokasi 3 barang
    const nextItems = { ...state.items };

    // Simulasi telemetri & thruster
    let x = 2.2;
    let y = 6.0;
    let yaw = 0;
    let speed = 0.0;
    let tl = 0;
    let tr = 0;

    // Baterai perlahan berkurang
    const pct = Math.max(15, 95 - Math.floor(tickCount / 10));
    const volt = +(25.2 * (pct / 100)).toFixed(1);

    // Kumpulan event yang terus bertambah
    const currentEvents = [...state.events];

    function addEvent(ev: MissionEvent) {
      if (!currentEvents.some((e) => e.type === ev.type && JSON.stringify(e.data) === JSON.stringify(ev.data))) {
        currentEvents.unshift(ev);
      }
    }

    if (cycle < 6) {
      // 0 - 3s: IDLE (Siap di Spot 1 Slot)
      nextMission = 'IDLE';
      nextGrip = 'READY';
      nextItems.prism = 'spot1';
      nextItems.sphere = 'spot1';
      nextItems.cube = 'spot1';
      tl = 0;
      tr = 0;
      speed = 0.0;
      x = 2.2;
      y = 6.0;
      yaw = 0;
      ftpStatus = 'idle';
    } else if (cycle < 16) {
      // 3 - 8s: START
      nextMission = 'START';
      tl = 150;
      tr = 150;
      speed = 0.3;
      x = +(2.2 + (cycle - 6) * 0.1).toFixed(2);
      y = 6.0;
      yaw = 0;
    } else if (cycle < 36) {
      // 8 - 18s: PICK_UP (Mengambil 3 barang di Spot 1)
      nextMission = 'PICK_UP';
      tl = 50;
      tr = 50;
      speed = 0.1;
      x = 3.2;
      y = 6.0;
      yaw = 0;

      if (cycle < 22) {
        nextGrip = 'GRABBING';
        nextItems.cube = 'board';
        addEvent({ t: 4.2, type: 'pick', data: { item: 'cube', carried: 1 } });
      } else if (cycle < 28) {
        nextGrip = 'CARRYING';
        nextItems.cube = 'board';
        nextItems.sphere = 'board';
        addEvent({ t: 6.8, type: 'pick', data: { item: 'sphere', carried: 2 } });
      } else {
        nextGrip = 'CARRYING';
        nextItems.cube = 'board';
        nextItems.sphere = 'board';
        nextItems.prism = 'board';
        addEvent({ t: 9.1, type: 'pick', data: { item: 'prism', carried: 3 } });
      }
    } else if (cycle < 64) {
      // 18 - 32s: FOLLOW_PATH (Melalui 3 gerbang kolam x=6, x=12, x=18)
      nextMission = 'FOLLOW_PATH';
      nextGrip = 'CARRYING';
      ftpStatus = 'running';
      addEvent({ t: 17.0, type: 'ftp_start', data: { direction: 'Spot1_ke_Spot2', attempt: 1 } });

      tl = 360;
      tr = 468;
      speed = 0.9;

      // Kapal bergerak maju sepanjang kolam dari x=3.5 ke x=20.5
      const progressRatio = (cycle - 36) / 28;
      x = +(3.5 + progressRatio * 17.0).toFixed(2);

      // Jalur meliuk halus melewati Gate 1 (y=6.6), Gate 2 (y=5.4), Gate 3 (y=6.6)
      y = +(6.0 + Math.sin(progressRatio * Math.PI * 2.5) * 0.8).toFixed(2);
      yaw = Math.round(Math.cos(progressRatio * Math.PI * 2.5) * 15);

      if (x >= 6.0) addEvent({ t: 21.4, type: 'gate_pass', data: { gate: 1 } });
      if (x >= 12.0) addEvent({ t: 26.8, type: 'gate_pass', data: { gate: 2 } });
      if (x >= 17.5) addEvent({ t: 31.2, type: 'gate_pass', data: { gate: 3 } });
    } else if (cycle < 74) {
      // 32 - 37s: DOCKING di Spot 2
      nextMission = 'DOCKING';
      nextGrip = 'CARRYING';
      ftpStatus = 'running';
      tl = 120;
      tr = 90;
      speed = 0.3;
      x = 21.2;
      y = 6.0;
      yaw = 0;
    } else if (cycle < 90) {
      // 37 - 45s: PLACE_ITEM (Menaruh barang di Spot 2)
      nextMission = 'PLACE_ITEM';
      tl = 0;
      tr = 0;
      speed = 0.0;
      x = 21.8;
      y = 6.0;
      yaw = 0;

      if (cycle < 79) {
        nextGrip = 'PLACING';
        nextItems.cube = 'spot2';
        addEvent({ t: 37.5, type: 'place', data: { item: 'cube', carried: 2 } });
      } else if (cycle < 84) {
        nextGrip = 'PLACING';
        nextItems.sphere = 'spot2';
        addEvent({ t: 39.0, type: 'place', data: { item: 'sphere', carried: 1 } });
      } else {
        nextGrip = 'READY';
        nextItems.prism = 'spot2';
        addEvent({ t: 41.5, type: 'place', data: { item: 'prism', carried: 0 } });
      }
    } else if (cycle < 100) {
      // 45 - 50s: BUZZER_SPRAY (Buzzer dan semprot air)
      nextMission = 'BUZZER_SPRAY';
      nextGrip = 'READY';
      buzzer = true;
      spray = true;
      tl = 0;
      tr = 0;
      speed = 0.0;
      x = 22.0;
      y = 6.0;
    } else if (cycle < 112) {
      // 50 - 56s: DONE (Misi selesai, skor FTP 100)
      nextMission = 'DONE';
      nextGrip = 'READY';
      buzzer = false;
      spray = false;
      ftpStatus = 'finished';
      ftpScore = 100;
      tl = 0;
      tr = 0;
      speed = 0.0;
      addEvent({ t: 45.0, type: 'mission_done', data: {} });
    } else {
      // 56 - 60s: Demo pengujian kondisi darurat (Kill switch aktif / ESTOP)
      nextMission = 'ESTOP';
      killSwitch = true;
      tl = 0;
      tr = 0;
      speed = 0.0;
    }

    // Demo status koneksi: berganti menyambung sebentar sebelum kembali normal
    if (cycle === 118) {
      conn = 'connecting';
    } else if (cycle === 119) {
      conn = 'connected';
    }

    setDashboardState({
      connection: conn,
      missionState: nextMission,
      battery: {
        percentage: pct,
        voltage: volt,
      },
      system: {
        killSwitch,
        buzzer,
        spray,
      },
      gripper: nextGrip,
      items: nextItems,
      telemetry: {
        x,
        y,
        yaw,
        speed,
      },
      thrusters: {
        left: tl,
        right: tr,
      },
      ftpScore: {
        direction: 'Spot 1 → Spot 2',
        attempt: 1,
        collisions: 0,
        status: ftpStatus,
        score: ftpScore,
      },
      events: currentEvents.slice(0, 15), // simpan 15 event terkini
      missionTime,
      lastUpdated: Date.now(),
    });
  }, 500);

  return () => {
    if (demoInterval) {
      clearInterval(demoInterval);
      demoInterval = null;
    }
  };
}
