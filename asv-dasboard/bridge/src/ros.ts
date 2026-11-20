/**
 * ros.ts
 * Modul koneksi WebSocket ke rosbridge_server (port 9090).
 * - Berlangganan topic-topic resmi sesuai docs/topics.md bagian B dan A.
 * - Reconnect otomatis bertahap (exponential backoff) saat koneksi terputus.
 * - Mengirim data topic yang masuk langsung ke modul aggregator.
 */

import ROSLIB from 'roslib';
import { BRIDGE_CONFIG, TOPICS } from './config';
import {
  setConnectionStatus,
  updateMissionState,
  updateBatteryPercentage,
  updateBatteryVoltage,
  updateKillSwitch,
  updateGripperState,
  updateBuzzer,
  updateSpray,
  updateSpeed,
  updatePose,
  updateThrusters,
  updateFtpScore,
  addMissionEvent,
} from './aggregator';

let activeRos: ROSLIB.Ros | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 8000;
let isStopping = false;

export function startRosClient(): () => void {
  isStopping = false;
  connectToRosbridge();

  return () => {
    isStopping = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (activeRos) {
      try {
        activeRos.close();
      } catch {
        // Abaikan penutupan socket
      }
      activeRos = null;
    }
    setConnectionStatus('disconnected');
  };
}

function connectToRosbridge() {
  if (isStopping) return;

  const url = BRIDGE_CONFIG.ROSBRIDGE_URL;
  console.log(`[Bridge ROS] Menghubungkan ke rosbridge: ${url}...`);
  setConnectionStatus('connecting');

  const ros = new ROSLIB.Ros({
    url,
  });

  ros.on('connection', () => {
    console.log('[Bridge ROS] Terhubung ke rosbridge server!');
    activeRos = ros;
    reconnectDelay = 1000;
    setConnectionStatus('connected');
    subscribeAllTopics(ros);
  });

  ros.on('error', (err) => {
    console.warn('[Bridge ROS] Koneksi error:', (err as { message?: string }).message || err);
  });

  ros.on('close', () => {
    console.warn('[Bridge ROS] Koneksi terputus.');
    activeRos = null;
    setConnectionStatus('disconnected');

    if (!isStopping) {
      scheduleReconnect();
    }
  });
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);

  console.log(`[Bridge ROS] Mencoba menyambung kembali dalam ${reconnectDelay / 1000} detik...`);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
    connectToRosbridge();
  }, reconnectDelay);
}

function subscribeAllTopics(ros: ROSLIB.Ros) {
  // 1. Mission State (/asv/mission_state)
  const subMissionState = new ROSLIB.Topic({
    ros,
    name: TOPICS.MISSION_STATE,
    messageType: 'std_msgs/String',
  });
  subMissionState.subscribe((msg: any) => {
    updateMissionState(msg?.data);
  });

  // 2. Baterai Persentase (/asv/battery)
  const subBattery = new ROSLIB.Topic({
    ros,
    name: TOPICS.BATTERY,
    messageType: 'std_msgs/Float32',
  });
  subBattery.subscribe((msg: any) => {
    if (typeof msg?.data === 'number') updateBatteryPercentage(msg.data);
  });

  // 3. Baterai Voltase (/asv/battery_voltage)
  const subBatteryVolt = new ROSLIB.Topic({
    ros,
    name: TOPICS.BATTERY_VOLTAGE,
    messageType: 'std_msgs/Float32',
  });
  subBatteryVolt.subscribe((msg: any) => {
    if (typeof msg?.data === 'number') updateBatteryVoltage(msg.data);
  });

  // 4. Status Kill Switch (/asv/kill_switch)
  const subKillSwitch = new ROSLIB.Topic({
    ros,
    name: TOPICS.KILL_SWITCH,
    messageType: 'std_msgs/Bool',
  });
  subKillSwitch.subscribe((msg: any) => {
    updateKillSwitch(Boolean(msg?.data));
  });

  // 5. Status Capit (/asv/gripper_state)
  const subGripper = new ROSLIB.Topic({
    ros,
    name: TOPICS.GRIPPER_STATE,
    messageType: 'std_msgs/String',
  });
  subGripper.subscribe((msg: any) => {
    updateGripperState(msg?.data);
  });

  // 6. Buzzer (/asv/buzzer)
  const subBuzzer = new ROSLIB.Topic({
    ros,
    name: TOPICS.BUZZER,
    messageType: 'std_msgs/Bool',
  });
  subBuzzer.subscribe((msg: any) => {
    updateBuzzer(Boolean(msg?.data));
  });

  // 7. Spray Semprotan (/asv/spray)
  const subSpray = new ROSLIB.Topic({
    ros,
    name: TOPICS.SPRAY,
    messageType: 'std_msgs/Bool',
  });
  subSpray.subscribe((msg: any) => {
    updateSpray(Boolean(msg?.data));
  });

  // 8. Kecepatan Robot (/asv/speed)
  const subSpeed = new ROSLIB.Topic({
    ros,
    name: TOPICS.SPEED,
    messageType: 'std_msgs/Float32',
  });
  subSpeed.subscribe((msg: any) => {
    if (typeof msg?.data === 'number') updateSpeed(msg.data);
  });

  // 9. Thruster Kiri (/wamv/thrusters/left/thrust)
  const subThrustLeft = new ROSLIB.Topic({
    ros,
    name: TOPICS.THRUST_LEFT,
    messageType: 'std_msgs/Float64',
  });
  subThrustLeft.subscribe((msg: any) => {
    if (typeof msg?.data === 'number') updateThrusters(msg.data, null);
  });

  // 10. Thruster Kanan (/wamv/thrusters/right/thrust)
  const subThrustRight = new ROSLIB.Topic({
    ros,
    name: TOPICS.THRUST_RIGHT,
    messageType: 'std_msgs/Float64',
  });
  subThrustRight.subscribe((msg: any) => {
    if (typeof msg?.data === 'number') updateThrusters(null, msg.data);
  });

  // 11. Skor FTP (/ftp/score)
  const subFtpScore = new ROSLIB.Topic({
    ros,
    name: TOPICS.FTP_SCORE,
    messageType: 'std_msgs/String',
  });
  subFtpScore.subscribe((msg: any) => {
    try {
      const parsed = typeof msg?.data === 'string' ? JSON.parse(msg.data) : msg?.data;
      if (parsed) updateFtpScore(parsed);
    } catch (e) {
      console.warn('[Bridge ROS] Gagal parse /ftp/score:', e);
    }
  });

  // 12. Log Kejadian (/mission/events)
  const subMissionEvents = new ROSLIB.Topic({
    ros,
    name: TOPICS.MISSION_EVENTS,
    messageType: 'std_msgs/String',
  });
  subMissionEvents.subscribe((msg: any) => {
    try {
      const parsed = typeof msg?.data === 'string' ? JSON.parse(msg.data) : msg?.data;
      if (parsed && parsed.type) {
        addMissionEvent(parsed);
      }
    } catch (e) {
      console.warn('[Bridge ROS] Gagal parse /mission/events:', e);
    }
  });

  // 13. Pose Robot (/wamv/pose)
  // CEK: Asumsi tipe geometry_msgs/PoseStamped, posisi meter x, y, orientasi quaternion
  const subPose = new ROSLIB.Topic({
    ros,
    name: TOPICS.POSE,
    messageType: 'geometry_msgs/PoseStamped',
  });
  subPose.subscribe((msg: any) => {
    const pos = msg?.pose?.position || msg?.position;
    const ori = msg?.pose?.orientation || msg?.orientation;

    let yaw: number | null = null;
    if (ori && typeof ori.z === 'number' && typeof ori.w === 'number') {
      yaw = Math.round(2 * Math.atan2(ori.z, ori.w) * (180 / Math.PI));
    }

    updatePose(
      pos && typeof pos.x === 'number' ? pos.x : null,
      pos && typeof pos.y === 'number' ? pos.y : null,
      yaw
    );
  });
}
