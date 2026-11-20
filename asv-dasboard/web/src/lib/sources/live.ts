/**
 * live.ts
 * Sumber data langsung dari ROS 2 via rosbridge WebSocket (port 9090).
 * - Menggunakan roslib 1.4.1 (di-import secara dinamis di client).
 * - Status koneksi menyambung / terhubung / terputus sinkron dengan ConnectionBadge.
 * - Reconnect bertahap (exponential backoff).
 * - Throttle pose dan thruster maksimal 10 kali per detik (10 Hz).
 * - Throttle kamera overview ~2 Hz.
 * - JSON parse aman dengan try/catch.
 * - Komentar // CEK: untuk asumsi tipe topic bawaan VRX.
 */

import type ROSLIB from 'roslib';
import { setDashboardState } from '../store';
import { TOPICS } from '../config';
import { MissionEvent, MissionState, GripperState } from '../types';

// Tipe data pose robot
interface PoseMessage {
  pose?: {
    position?: { x?: number; y?: number; z?: number };
    orientation?: { x?: number; y?: number; z?: number; w?: number };
  };
  position?: { x?: number; y?: number; z?: number };
  orientation?: { x?: number; y?: number; z?: number; w?: number };
}

// Referensi koneksi dan timer untuk pembersihan
let activeRos: ROSLIB.Ros | null = null;
let isConnecting = false;
let shouldReconnect = true;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelay = 1000; // Mulai dari 1 detik
const MAX_RECONNECT_DELAY = 8000; // Maksimal 8 detik

// Publisher untuk perintah kill switch
let killCmdTopic: ROSLIB.Topic<{ data: boolean }> | null = null;

// Variabel throttling
let lastPoseTime = 0;
let lastThrustLeftTime = 0;
let lastThrustRightTime = 0;
let lastCameraTime = 0;

/**
 * Memublikasikan perintah kill switch ke robot (/dashboard/kill_switch_cmd)
 */
export function publishKillSwitchCommand(cmd = true) {
  if (killCmdTopic && activeRos?.isConnected) {
    console.log('[Live ROS] Mengirim perintah Kill Switch Cmd:', cmd);
    killCmdTopic.publish({ data: cmd });
  } else {
    console.warn('[Live ROS] Tidak dapat mengirim perintah, koneksi belum siap');
  }
}

/**
 * Mendapatkan URL WebSocket rosbridge.
 * Jika NEXT_PUBLIC_ROSBRIDGE_URL kosong, gunakan hostname dari halaman (misal: 192.168.1.50)
 * agar dashboard dapat diakses dari HP/laptop lain di jaringan Wi-Fi lokal (F-LAN).
 */
export function getRosbridgeUrl(): string {
  if (process.env.NEXT_PUBLIC_ROSBRIDGE_URL) {
    return process.env.NEXT_PUBLIC_ROSBRIDGE_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `ws://${window.location.hostname}:9090`;
  }
  return 'ws://localhost:9090';
}

/**
 * Memulai koneksi live ke rosbridge
 */
export function startLiveSource(): () => void {
  shouldReconnect = true;
  reconnectDelay = 1000;

  async function connect() {
    if (isConnecting || activeRos?.isConnected) return;
    const url = getRosbridgeUrl();
    isConnecting = true;

    setDashboardState({ connection: 'connecting' });

    try {
      // Dynamic import roslib di sisi client saja
      const roslibModule = (await import('roslib')).default as typeof ROSLIB;

      const ros = new roslibModule.Ros({
        url,
      });
      activeRos = ros;

      ros.on('connection', () => {
        console.log(`[Live ROS] Terhubung ke rosbridge di ${url}`);
        isConnecting = false;
        reconnectDelay = 1000;
        setDashboardState({ connection: 'connected', lastUpdated: Date.now() });

        // Siapkan publisher perintah kill switch
        killCmdTopic = new roslibModule.Topic({
          ros,
          name: TOPICS.KILL_SWITCH_CMD,
          messageType: 'std_msgs/Bool',
        });

        // Langganan ke semua topik ROS 2
        subscribeToTopics(roslibModule, ros);
      });

      ros.on('error', (err: unknown) => {
        console.error('[Live ROS] Error koneksi rosbridge:', err);
        isConnecting = false;
        setDashboardState({ connection: 'disconnected' });
        triggerReconnect();
      });

      ros.on('close', () => {
        console.warn('[Live ROS] Koneksi rosbridge terputus');
        isConnecting = false;
        setDashboardState({ connection: 'disconnected' });
        triggerReconnect();
      });
    } catch (err) {
      console.error('[Live ROS] Gagal menginisialisasi roslib:', err);
      isConnecting = false;
      setDashboardState({ connection: 'disconnected' });
      triggerReconnect();
    }
  }

  function triggerReconnect() {
    if (!shouldReconnect) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);

    console.log(`[Live ROS] Mencoba menyambung kembali dalam ${reconnectDelay / 1000} detik...`);
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
      connect();
    }, reconnectDelay);
  }

  // Mulai koneksi pertama
  connect();

  // Fungsi pembersih saat unmount atau berganti sumber data
  return () => {
    shouldReconnect = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (activeRos) {
      try {
        activeRos.close();
      } catch {
        // Abaikan error penutupan socket
      }
      activeRos = null;
    }
    killCmdTopic = null;
    isConnecting = false;
  };
}

/**
 * Mendaftarkan subscription ke seluruh topik yang ada di docs/topics.md bagian B dan A
 */
function subscribeToTopics(roslibModule: typeof ROSLIB, ros: ROSLIB.Ros) {
  // 1. Mission State (/asv/mission_state)
  const subMissionState = new roslibModule.Topic<{ data: string }>({
    ros,
    name: TOPICS.MISSION_STATE,
    messageType: 'std_msgs/String',
  });
  subMissionState.subscribe((msg) => {
    const stateVal = (msg.data || 'IDLE').toUpperCase() as MissionState;
    setDashboardState((prev) => {
      const isResetToIdle = stateVal === 'IDLE' && prev.missionState !== 'IDLE';
      return {
        missionState: stateVal,
        // Jika keluar dari IDLE dan waktu misi masih 0, inisialisasi waktu; jika kembali ke IDLE, reset ke 0
        missionTime: isResetToIdle ? 0 : stateVal !== 'IDLE' && prev.missionTime === 0 ? 0.1 : prev.missionTime,
        ...(isResetToIdle
          ? {
              items: { prism: 'spot1', sphere: 'spot1', cube: 'spot1' },
              events: [],
            }
          : {}),
      };
    });
  });

  // 2. Baterai Persentase (/asv/battery)
  const subBattery = new roslibModule.Topic<{ data: number }>({
    ros,
    name: TOPICS.BATTERY,
    messageType: 'std_msgs/Float32',
  });
  subBattery.subscribe((msg) => {
    setDashboardState((prev) => ({
      battery: { ...prev.battery, percentage: msg.data },
    }));
  });

  // 3. Baterai Voltase (/asv/battery_voltage)
  const subBatteryVolt = new roslibModule.Topic<{ data: number }>({
    ros,
    name: TOPICS.BATTERY_VOLTAGE,
    messageType: 'std_msgs/Float32',
  });
  subBatteryVolt.subscribe((msg) => {
    setDashboardState((prev) => ({
      battery: { ...prev.battery, voltage: msg.data },
    }));
  });

  // 4. Status Kill Switch (/asv/kill_switch)
  const subKillSwitch = new roslibModule.Topic<{ data: boolean }>({
    ros,
    name: TOPICS.KILL_SWITCH,
    messageType: 'std_msgs/Bool',
  });
  subKillSwitch.subscribe((msg) => {
    setDashboardState((prev) => ({
      system: { ...prev.system, killSwitch: Boolean(msg.data) },
    }));
  });

  // 5. Status Capit (/asv/gripper_state)
  const subGripper = new roslibModule.Topic<{ data: string }>({
    ros,
    name: TOPICS.GRIPPER_STATE,
    messageType: 'std_msgs/String',
  });
  subGripper.subscribe((msg) => {
    setDashboardState({
      gripper: (msg.data || 'READY').toUpperCase() as GripperState,
    });
  });

  // 6. Status Buzzer (/asv/buzzer)
  const subBuzzer = new roslibModule.Topic<{ data: boolean }>({
    ros,
    name: TOPICS.BUZZER,
    messageType: 'std_msgs/Bool',
  });
  subBuzzer.subscribe((msg) => {
    setDashboardState((prev) => ({
      system: { ...prev.system, buzzer: Boolean(msg.data) },
    }));
  });

  // 7. Status Spray Semprotan (/asv/spray)
  const subSpray = new roslibModule.Topic<{ data: boolean }>({
    ros,
    name: TOPICS.SPRAY,
    messageType: 'std_msgs/Bool',
  });
  subSpray.subscribe((msg) => {
    setDashboardState((prev) => ({
      system: { ...prev.system, spray: Boolean(msg.data) },
    }));
  });

  // 8. Kecepatan Kapal (/asv/speed)
  const subSpeed = new roslibModule.Topic<{ data: number }>({
    ros,
    name: TOPICS.SPEED,
    messageType: 'std_msgs/Float32',
  });
  subSpeed.subscribe((msg) => {
    setDashboardState((prev) => ({
      telemetry: { ...prev.telemetry, speed: msg.data },
    }));
  });

  // 9. Thruster Kiri (/wamv/thrusters/left/thrust) - Throttle 10 Hz
  const subThrustLeft = new roslibModule.Topic<{ data: number }>({
    ros,
    name: TOPICS.THRUST_LEFT,
    messageType: 'std_msgs/Float64',
  });
  subThrustLeft.subscribe((msg) => {
    const now = Date.now();
    if (now - lastThrustLeftTime >= 100) {
      lastThrustLeftTime = now;
      setDashboardState((prev) => ({
        thrusters: { ...prev.thrusters, left: Math.round(msg.data) },
      }));
    }
  });

  // 10. Thruster Kanan (/wamv/thrusters/right/thrust) - Throttle 10 Hz
  const subThrustRight = new roslibModule.Topic<{ data: number }>({
    ros,
    name: TOPICS.THRUST_RIGHT,
    messageType: 'std_msgs/Float64',
  });
  subThrustRight.subscribe((msg) => {
    const now = Date.now();
    if (now - lastThrustRightTime >= 100) {
      lastThrustRightTime = now;
      setDashboardState((prev) => ({
        thrusters: { ...prev.thrusters, right: Math.round(msg.data) },
      }));
    }
  });

  // 11. Skor FTP (/ftp/score) - Parse JSON dengan try/catch
  const subFtpScore = new roslibModule.Topic<{ data: string }>({
    ros,
    name: TOPICS.FTP_SCORE,
    messageType: 'std_msgs/String',
  });
  subFtpScore.subscribe((msg) => {
    try {
      const parsed = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
      setDashboardState({
        ftpScore: {
          direction: parsed.direction || 'Spot 1 → Spot 2',
          attempt: parsed.attempt ?? 1,
          collisions: parsed.collisions ?? 0,
          status: parsed.status || 'running',
          score: parsed.score ?? null,
        },
      });
    } catch (e) {
      console.error('[Live ROS] Gagal parse /ftp/score JSON:', e);
    }
  });

  // 12. Log Kejadian (/mission/events) - Parse JSON dengan try/catch
  const subMissionEvents = new roslibModule.Topic<{ data: string }>({
    ros,
    name: TOPICS.MISSION_EVENTS,
    messageType: 'std_msgs/String',
  });
  subMissionEvents.subscribe((msg) => {
    try {
      const parsed: MissionEvent = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
      setDashboardState((prev) => {
        const events = [parsed, ...prev.events].slice(0, 20);

        // Update lokasi barang otomatis dari event pick dan place
        const items = { ...prev.items };
        if (parsed.type === 'pick' && parsed.data?.item) {
          const itemKey = parsed.data.item as keyof typeof items;
          if (items[itemKey]) items[itemKey] = 'board';
        } else if (parsed.type === 'place' && parsed.data?.item) {
          const itemKey = parsed.data.item as keyof typeof items;
          if (items[itemKey]) items[itemKey] = 'spot2';
        }

        return {
          events,
          items,
          missionTime: parsed.t ?? prev.missionTime,
        };
      });
    } catch (e) {
      console.error('[Live ROS] Gagal parse /mission/events JSON:', e);
    }
  });

  // 13. Pose Robot (/wamv/pose) - Throttle 10 Hz
  // CEK: Asumsi tipe geometry_msgs/PoseStamped, koordinat x, y dalam meter, orientasi quaternion
  const subPose = new roslibModule.Topic<PoseMessage>({
    ros,
    name: TOPICS.POSE,
    messageType: 'geometry_msgs/PoseStamped',
  });
  subPose.subscribe((msg) => {
    const now = Date.now();
    if (now - lastPoseTime >= 100) {
      lastPoseTime = now;
      const pos = msg.pose?.position || msg.position || {};
      const ori = msg.pose?.orientation || msg.orientation || {};

      // Konversi quaternion z, w ke sudut derajat yaw
      let yaw = 0;
      if (typeof ori.z === 'number' && typeof ori.w === 'number') {
        yaw = Math.round(2 * Math.atan2(ori.z, ori.w) * (180 / Math.PI));
      }

      setDashboardState((prev) => ({
        telemetry: {
          ...prev.telemetry,
          x: typeof pos.x === 'number' ? pos.x : prev.telemetry.x,
          y: typeof pos.y === 'number' ? pos.y : prev.telemetry.y,
          yaw,
        },
      }));
    }
  });

  // 14. Gambar Kamera Atas (/overview_camera/image) - Throttle ~2 Hz (500 ms)
  // CEK: Asumsi tipe sensor_msgs/CompressedImage dengan data format base64
  const subCamera = new roslibModule.Topic<{ format?: string; data?: string }>({
    ros,
    name: TOPICS.OVERVIEW_CAMERA,
    messageType: 'sensor_msgs/CompressedImage',
  });
  subCamera.subscribe((msg) => {
    const now = Date.now();
    if (now - lastCameraTime >= 500 && msg?.data) {
      lastCameraTime = now;
      const fmt = msg.format || 'png';
      const imgSrc = msg.data.startsWith('data:') ? msg.data : `data:image/${fmt};base64,${msg.data}`;
      setDashboardState({ cameraImage: imgSrc });
    }
  });
}
