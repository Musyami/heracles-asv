/**
 * tools/mock-rosbridge.ts
 * Server tiruan protokol rosbridge (WebSocket pada port 9090).
 * Mengimplementasikan protokol rosbridge v2.0 (subscribe, unsubscribe, publish, advertise)
 * dan menerbitkan topic palsu persis sesuai docs/topics.md bagian B dan A.
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';

const PORT = parseInt(process.env.PORT || '9090', 10);
const wss = new WebSocketServer({ port: PORT });

console.log(`[Mock ROSBridge] Server berjalan di ws://localhost:${PORT}`);

// Membaca gambar placeholder peta kolam untuk topic /overview_camera/image
let cameraBase64 = '';
const imagePath = path.resolve(__dirname, '../web/public/peta-kolam.png');
try {
  if (fs.existsSync(imagePath)) {
    cameraBase64 = fs.readFileSync(imagePath).toString('base64');
    console.log(`[Mock ROSBridge] Berhasil memuat gambar kamera: ${imagePath} (${cameraBase64.length} karakter base64)`);
  } else {
    console.warn(`[Mock ROSBridge] File gambar tidak ditemukan di ${imagePath}`);
  }
} catch (err) {
  console.error('[Mock ROSBridge] Gagal membaca gambar kamera:', err);
}

// Struktur data langganan per client: Map<WebSocket, Set<topicName>>
const clientSubscriptions = new Map<WebSocket, Set<string>>();

// ============================================================
// STATE SIMULASI ROBOT
// ============================================================
let simTick = 0;
let killSwitchActive = false;
let buzzerActive = false;
let sprayActive = false;
let missionState = 'IDLE';
let gripperState = 'READY';
let batteryPct = 96.0;
let batteryVolt = 25.0;
let speed = 0.0;
let thrustLeft = 0.0;
let thrustRight = 0.0;
let posX = 2.0;
let posY = 3.0;
let yawDeg = 0.0;
let ftpAttempt = 1;
let ftpCollisions = 0;
let ftpScore: number | null = null;
let ftpStatus = 'idle';

// Event log list
const emittedEvents: string[] = [];

/**
 * Mengirim pesan rosbridge ke semua client yang berlangganan topic tersebut
 */
function broadcast(topic: string, msg: unknown) {
  const payload = JSON.stringify({
    op: 'publish',
    topic,
    msg,
  });

  for (const [client, topics] of clientSubscriptions.entries()) {
    if (client.readyState === WebSocket.OPEN && topics.has(topic)) {
      client.send(payload);
    }
  }
}

// ============================================================
// PENANGANAN KONEKSI CLIENT
// ============================================================
wss.on('connection', (ws: WebSocket) => {
  console.log('[Mock ROSBridge] Client terhubung');
  clientSubscriptions.set(ws, new Set<string>());

  ws.on('message', (rawData: string) => {
    try {
      const data = JSON.parse(rawData.toString());
      const op = data.op;
      const topic = data.topic;

      if (op === 'subscribe' && topic) {
        clientSubscriptions.get(ws)?.add(topic);
        console.log(`[Mock ROSBridge] Client subscribe -> ${topic}`);

        // Kirim nilai terkini langsung ke subscriber baru
        sendCurrentTopicState(ws, topic);
      } else if (op === 'unsubscribe' && topic) {
        clientSubscriptions.get(ws)?.delete(topic);
        console.log(`[Mock ROSBridge] Client unsubscribe -> ${topic}`);
      } else if (op === 'publish' && topic) {
        handleClientPublish(topic, data.msg);
      }
    } catch (e) {
      console.error('[Mock ROSBridge] Gagal mem-parse pesan client:', e);
    }
  });

  ws.on('close', () => {
    console.log('[Mock ROSBridge] Client terputus');
    clientSubscriptions.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[Mock ROSBridge] Socket error:', err);
  });
});

let estopTicks = 0;

/**
 * Menangani perintah yang dipublikasikan oleh dashboard ke robot
 */
function handleClientPublish(topic: string, msg: { data?: unknown }) {
  console.log(`[Mock ROSBridge] Menerima publish pada ${topic}:`, msg);

  // Perintah Kill Switch dari Dashboard (/dashboard/kill_switch_cmd)
  if (topic === '/dashboard/kill_switch_cmd') {
    if (msg?.data === true) {
      console.warn('[Mock ROSBridge] !!! PERINTAH KILL SWITCH DITERIMA !!! Robot dimatikan ke ESTOP.');
      killSwitchActive = true;
      missionState = 'ESTOP';
      estopTicks = 0;
      thrustLeft = 0;
      thrustRight = 0;
      speed = 0;

      // Broadcast pembaruan darurat segera
      broadcast('/asv/kill_switch', { data: true });
      broadcast('/asv/mission_state', { data: 'ESTOP' });
      broadcast('/wamv/thrusters/left/thrust', { data: 0 });
      broadcast('/wamv/thrusters/right/thrust', { data: 0 });
      broadcast('/mission/events', {
        data: JSON.stringify({
          t: +(simTick * 0.1).toFixed(1),
          type: 'estop',
          data: { reason: 'kill_switch_cmd' },
        }),
      });
    } else if (msg?.data === false) {
      console.log('[Mock ROSBridge] Perintah pulihkan kill switch diterima.');
      killSwitchActive = false;
      missionState = 'IDLE';
      estopTicks = 0;
      broadcast('/asv/kill_switch', { data: false });
      broadcast('/asv/mission_state', { data: 'IDLE' });
    }
  }
}

/**
 * Mengirim nilai awal ke subscriber baru
 */
function sendCurrentTopicState(ws: WebSocket, topic: string) {
  function sendMsg(msg: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ op: 'publish', topic, msg }));
    }
  }

  switch (topic) {
    case '/asv/mission_state':
      sendMsg({ data: missionState });
      break;
    case '/asv/battery':
      sendMsg({ data: batteryPct });
      break;
    case '/asv/battery_voltage':
      sendMsg({ data: batteryVolt });
      break;
    case '/asv/kill_switch':
      sendMsg({ data: killSwitchActive });
      break;
    case '/asv/gripper_state':
      sendMsg({ data: gripperState });
      break;
    case '/asv/buzzer':
      sendMsg({ data: buzzerActive });
      break;
    case '/asv/spray':
      sendMsg({ data: sprayActive });
      break;
    case '/asv/speed':
      sendMsg({ data: speed });
      break;
    case '/wamv/thrusters/left/thrust':
      sendMsg({ data: thrustLeft });
      break;
    case '/wamv/thrusters/right/thrust':
      sendMsg({ data: thrustRight });
      break;
    case '/ftp/score':
      sendMsg({
        data: JSON.stringify({
          direction: 'Spot1_ke_Spot2',
          attempt: ftpAttempt,
          collisions: ftpCollisions,
          status: ftpStatus,
          score: ftpScore,
        }),
      });
      break;
  }
}

// ============================================================
// LOOP SIMULASI PERILAKU ROBOT (10 Hz = 100 ms)
// ============================================================
setInterval(() => {
  simTick++;

  // Jika kill switch aktif, robot berhenti diam di tempat
  if (killSwitchActive) {
    thrustLeft = 0;
    thrustRight = 0;
    speed = 0;
    estopTicks++;

    // Pertahankan kondisi ESTOP selama 15 detik (150 tick @ 100ms) agar penguji dapat mengamati status
    if (estopTicks >= 150) {
      console.log('[Mock ROSBridge] Memulihkan sistem dari ESTOP ke IDLE...');
      killSwitchActive = false;
      missionState = 'IDLE';
      estopTicks = 0;
      broadcast('/asv/kill_switch', { data: false });
      broadcast('/asv/mission_state', { data: 'IDLE' });
    }
  } else {
    // Jalankan siklus misi 120 detik (1200 ticks @ 100ms)
    const cycle = simTick % 1200;

    // Perlahan kurangi baterai
    batteryPct = Math.max(12, +(96 - (simTick / 1200) * 8).toFixed(1));
    batteryVolt = +(24.0 * (batteryPct / 100)).toFixed(1);

    if (cycle < 60) {
      // 0 - 6s: IDLE (Siap)
      if (cycle === 0) {
        emittedEvents.length = 0; // Bersihkan event untuk siklus baru
      }
      missionState = 'IDLE';
      gripperState = 'READY';
      buzzerActive = false;
      sprayActive = false;
      ftpStatus = 'idle';
      ftpScore = null;
      speed = 0.0;
      thrustLeft = 0;
      thrustRight = 0;
      posX = 2.2;
      posY = 6.0;
      yawDeg = 0;
    } else if (cycle < 160) {
      // 6 - 16s: START (Mulai manuver dari Spot 1)
      missionState = 'START';
      speed = 0.3;
      thrustLeft = 200;
      thrustRight = 200;
      posX = +(2.2 + ((cycle - 60) / 100) * 1.0).toFixed(2);
      posY = 6.0;
      yawDeg = 0;
    } else if (cycle < 360) {
      // 16 - 36s: PICK_UP (Mengambil 3 barang)
      missionState = 'PICK_UP';
      speed = 0.1;
      thrustLeft = 60;
      thrustRight = 60;
      posX = 3.2;
      posY = 6.0;
      yawDeg = 0;

      if (cycle < 220) {
        gripperState = 'GRABBING';
        emitEventOnce('pick_cube', { t: 18.0, type: 'pick', data: { item: 'cube', carried: 1 } });
      } else if (cycle < 280) {
        gripperState = 'CARRYING';
        emitEventOnce('pick_sphere', { t: 22.5, type: 'pick', data: { item: 'sphere', carried: 2 } });
      } else {
        gripperState = 'CARRYING';
        emitEventOnce('pick_prism', { t: 28.0, type: 'pick', data: { item: 'prism', carried: 3 } });
      }
    } else if (cycle < 640) {
      // 36 - 64s: FOLLOW_PATH (Melalui 3 gerbang)
      missionState = 'FOLLOW_PATH';
      gripperState = 'CARRYING';
      ftpStatus = 'running';
      emitEventOnce('ftp_start', { t: 36.0, type: 'ftp_start', data: { direction: 'Spot1_ke_Spot2', attempt: 1 } });

      thrustLeft = 360;
      thrustRight = 468;
      speed = 0.9;

      const progress = (cycle - 360) / 280;
      posX = +(3.5 + progress * 17.0).toFixed(2);
      posY = +(6.0 + Math.sin(progress * Math.PI * 2.5) * 0.8).toFixed(2);
      yawDeg = Math.round(Math.cos(progress * Math.PI * 2.5) * 15);

      if (posX >= 6.0) emitEventOnce('gate_1', { t: 40.2, type: 'gate_pass', data: { gate: 1 } });
      if (posX >= 12.0) emitEventOnce('gate_2', { t: 48.6, type: 'gate_pass', data: { gate: 2 } });
      if (posX >= 18.0) emitEventOnce('gate_3', { t: 58.1, type: 'gate_pass', data: { gate: 3 } });
    } else if (cycle < 740) {
      // 64 - 74s: DOCKING di Spot 2
      missionState = 'DOCKING';
      gripperState = 'CARRYING';
      speed = 0.3;
      thrustLeft = 110;
      thrustRight = 90;
      posX = 21.8;
      posY = 6.0;
      yawDeg = 0;
    } else if (cycle < 900) {
      // 74 - 90s: PLACE_ITEM (Menaruh 3 barang di Spot 2)
      missionState = 'PLACE_ITEM';
      speed = 0.0;
      thrustLeft = 0;
      thrustRight = 0;

      if (cycle < 790) {
        gripperState = 'PLACING';
        emitEventOnce('place_cube', { t: 76.0, type: 'place', data: { item: 'cube', carried: 2 } });
      } else if (cycle < 840) {
        gripperState = 'PLACING';
        emitEventOnce('place_sphere', { t: 81.0, type: 'place', data: { item: 'sphere', carried: 1 } });
      } else {
        gripperState = 'READY';
        emitEventOnce('place_prism', { t: 86.0, type: 'place', data: { item: 'prism', carried: 0 } });
      }
    } else if (cycle < 1000) {
      // 90 - 100s: BUZZER_SPRAY
      missionState = 'BUZZER_SPRAY';
      gripperState = 'READY';
      buzzerActive = true;
      sprayActive = true;
      speed = 0.0;
      thrustLeft = 0;
      thrustRight = 0;
    } else {
      // 100 - 120s: DONE (Misi selesai)
      missionState = 'DONE';
      buzzerActive = false;
      sprayActive = false;
      ftpStatus = 'finished';
      ftpScore = 100;
      emitEventOnce('mission_done', { t: 101.0, type: 'mission_done', data: {} });
    }
  }

  // ============================================================
  // PUBLIKASI BERKALA (DENGAN FREKUENSI SESUAI KONTRAK TOPIC)
  // ============================================================

  // 1. Frekuensi 10 Hz: Pose dan Thruster
  // CEK: Tipe topic bawaan VRX /wamv/pose diasumsikan geometry_msgs/PoseStamped
  const yawRad = (yawDeg * Math.PI) / 180;
  broadcast('/wamv/pose', {
    header: {
      stamp: { sec: Math.floor(simTick / 10), nanosec: (simTick % 10) * 100000000 },
      frame_id: 'map',
    },
    pose: {
      position: { x: posX, y: posY, z: 0.0 },
      orientation: {
        x: 0.0,
        y: 0.0,
        z: Math.sin(yawRad / 2),
        w: Math.cos(yawRad / 2),
      },
    },
  });

  broadcast('/wamv/thrusters/left/thrust', { data: thrustLeft });
  broadcast('/wamv/thrusters/right/thrust', { data: thrustRight });

  // 2. Frekuensi 5 Hz (setiap 200 ms): Speed
  if (simTick % 2 === 0) {
    broadcast('/asv/speed', { data: speed });
  }

  // 3. Frekuensi 2 Hz (setiap 500 ms): Gambar kamera overview
  // CEK: Topic bawaan /overview_camera/image diasumsikan sensor_msgs/CompressedImage dengan data base64
  if (simTick % 5 === 0 && cameraBase64) {
    broadcast('/overview_camera/image', {
      header: { frame_id: 'overview_camera' },
      format: 'png',
      data: cameraBase64,
    });
  }

  // 4. Frekuensi 1 Hz (setiap 1000 ms): State, Baterai, Status Sistem, Skor FTP
  if (simTick % 10 === 0) {
    broadcast('/asv/mission_state', { data: missionState });
    broadcast('/asv/battery', { data: batteryPct });
    broadcast('/asv/battery_voltage', { data: batteryVolt });
    broadcast('/asv/kill_switch', { data: killSwitchActive });
    broadcast('/asv/gripper_state', { data: gripperState });
    broadcast('/asv/buzzer', { data: buzzerActive });
    broadcast('/asv/spray', { data: sprayActive });

    broadcast('/ftp/score', {
      data: JSON.stringify({
        direction: 'Spot1_ke_Spot2',
        attempt: ftpAttempt,
        collisions: ftpCollisions,
        status: ftpStatus,
        score: ftpScore,
      }),
    });

    // CEK: /ftp/buoys diasumsikan array koordinat buoy statis
    broadcast('/ftp/buoys', {
      poses: [
        { position: { x: 6, y: 3 }, orientation: { w: 1 } },
        { position: { x: 6, y: 9 }, orientation: { w: 1 } },
        { position: { x: 12, y: 3 }, orientation: { w: 1 } },
        { position: { x: 12, y: 9 }, orientation: { w: 1 } },
        { position: { x: 18, y: 3 }, orientation: { w: 1 } },
        { position: { x: 18, y: 9 }, orientation: { w: 1 } },
      ],
    });

    // CEK: /ftp/path diasumsikan nav_msgs/Path dari Spot 1 ke Spot 2
    broadcast('/ftp/path', {
      header: { frame_id: 'map' },
      poses: [
        { pose: { position: { x: 2, y: 6 } } },
        { pose: { position: { x: 6, y: 6 } } },
        { pose: { position: { x: 12, y: 6 } } },
        { pose: { position: { x: 18, y: 6 } } },
        { pose: { position: { x: 22, y: 6 } } },
      ],
    });
  }
}, 100);

function emitEventOnce(key: string, ev: { t: number; type: string; data: Record<string, unknown> }) {
  if (!emittedEvents.includes(key)) {
    emittedEvents.push(key);
    console.log(`[Mock ROSBridge] Event terpicu: ${ev.type}`, ev.data);
    broadcast('/mission/events', {
      data: JSON.stringify(ev),
    });
  }
}
