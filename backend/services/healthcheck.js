import os from 'os';
import dayjs from 'dayjs';
import { redisClient } from '../config/redis.js';
import mongoose from 'mongoose';

export async function HealthCheck() {
  // الوقت الحالي
  const now = dayjs().format('D-MMMM-YYYY hh:mm A');

  // سيرفر info
  const uptime = process.uptime(); // بالثواني
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

  const totalMemMB = (os.totalmem() / 1024 / 1024).toFixed(2);
  const freeMemMB = (os.freemem() / 1024 / 1024).toFixed(2);
  const usedMemMB = (totalMemMB - freeMemMB).toFixed(2);
  const memUsagePercent = ((usedMemMB / totalMemMB) * 100).toFixed(1);

  const cpus = os.cpus();
  const cpuModel = cpus[0].model;
  const cpuCount = cpus.length;

  // MongoDB status
  let mongoStatus = 'Disconnected';
  if (mongoose.connection.readyState === 1) mongoStatus = 'Connected';
  else if (mongoose.connection.readyState === 2) mongoStatus = 'Connecting';
  else if (mongoose.connection.readyState === 3) mongoStatus = 'Disconnecting';

  // Redis status
  let redisStatus = 'Disconnected';
  try {
    const ping = await redisClient.ping();
    if (ping === 'PONG') redisStatus = 'Connected';
  } catch {
    redisStatus = 'Disconnected';
  }

  // تجميع التقرير
  const report = `
*Fanvia Health Check Report*

 • *Time:* \`${now}\`
 • *Server Uptime:* \`${uptimeFormatted}\`
 
 • *System Info:*
   - CPU: \`${cpuModel}\` (${cpuCount} cores)
   - Memory: \`${usedMemMB}MB / ${totalMemMB}MB\` (${memUsagePercent}% used)
 
 • *Services Status:*
   - MongoDB: ${mongoStatus}
   - Redis: ${redisStatus}
 
*Note:* _If any service is not connected, please check the logs and restart the service._

---

©️ Fanvia - Automated Health Check System
  `.trim();

  return report;
}
