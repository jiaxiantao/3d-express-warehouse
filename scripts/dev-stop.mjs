#!/usr/bin/env node
/**
 * Stop stale Next.js dev servers for this project and remove .next/dev/lock.
 * Usage: pnpm dev:stop  |  pnpm dev:fresh
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(root, ".next", "dev", "lock");

function tryKill(pid) {
  if (!pid || Number.isNaN(pid)) {
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
    console.log(`Killed PID ${pid}`);
  } catch {
    // already exited or no permission
  }
}

if (fs.existsSync(lockPath)) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (lock.pid) {
      tryKill(Number(lock.pid));
    }
    if (lock.port) {
      try {
        const pids = execSync(`lsof -ti:${lock.port}`, { encoding: "utf8" }).trim();
        for (const pid of pids.split("\n").filter(Boolean)) {
          tryKill(Number(pid));
        }
      } catch {
        // port free
      }
    }
  } catch {
    // ignore malformed lock
  }
  try {
    fs.unlinkSync(lockPath);
    console.log("Removed .next/dev/lock");
  } catch {
    // ignore
  }
}

for (const port of [3100, 3000, 3001, 3002, 3003]) {
  try {
    const pids = execSync(`lsof -ti:${port}`, { encoding: "utf8" }).trim();
    for (const pid of pids.split("\n").filter(Boolean)) {
      const cmd = execSync(`ps -p ${pid} -o comm=`, { encoding: "utf8" }).trim();
      if (/next-server|next dev|node/.test(cmd)) {
        tryKill(Number(pid));
      }
    }
  } catch {
    // port free
  }
}

console.log("Dev server cleanup done. Run: pnpm dev");
