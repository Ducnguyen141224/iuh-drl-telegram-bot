import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { config } from "./config.js";
import { acquireProcessLock, writeJson } from "./storage.js";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(projectDir);
const runtimeDir = path.dirname(config.eventStatePath);
const children = new Map();
let stopping = false;

function log(name, text) {
  const file = path.join(runtimeDir, `${name}.log`);
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > 2_000_000) fs.renameSync(file, `${file}.previous`);
    fs.appendFileSync(file, text);
  } catch { /* Logging failure must not stop the service. */ }
}

function startWorker(name, script) {
  if (stopping) return;
  const child = spawn(process.execPath, [path.join(projectDir, "src", script)], {
    cwd: projectDir, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  children.set(name, child);
  log("local-service", `[${new Date().toISOString()}] Started ${name} PID=${child.pid}\n`);
  child.stdout.on("data", (chunk) => log(name, chunk));
  child.stderr.on("data", (chunk) => log(name, chunk));
  child.on("error", (error) => log("local-service", `${name}: ${error.code || "SPAWN_ERROR"}\n`));
  child.on("exit", (code) => {
    children.delete(name);
    log("local-service", `${name} exited (${code})\n`);
    if (!stopping) setTimeout(() => startWorker(name, script), 10_000);
  });
}

async function main() {
  await fsp.mkdir(runtimeDir, { recursive: true });
  const release = await acquireProcessLock(path.join(runtimeDir, "local-service.lock"));
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    for (const child of children.values()) child.kill();
    await release();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  startWorker("telegram-bot", "telegram-bot.js");
  startWorker("watcher", "index.js");
  const heartbeat = () => writeJson(path.join(runtimeDir, "local-service-status.json"), {
    pid: process.pid,
    heartbeatAt: new Date().toISOString(),
    children: Object.fromEntries([...children].map(([name, child]) => [name, child.pid])),
  }).catch(() => {});
  await heartbeat();
  setInterval(heartbeat, 10_000);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = error.code === "ALREADY_RUNNING" ? 0 : 1;
});
