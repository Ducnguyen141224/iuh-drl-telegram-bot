import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, file);
}

export async function acquireProcessLock(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    const handle = await fs.open(file, "wx");
    await handle.writeFile(String(process.pid));
    await handle.close();
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    // A lock from a previous Windows boot cannot own a process in this boot.
    const stat = await fs.stat(file);
    if (stat.mtimeMs < Date.now() - os.uptime() * 1000 - 5000) {
      await fs.unlink(file);
      return acquireProcessLock(file);
    }
    const pid = Number(await fs.readFile(file, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`Khóa tiến trình không hợp lệ: ${path.basename(file)}`);
    try { process.kill(pid, 0); }
    catch (processError) {
      if (processError.code !== "ESRCH") throw processError;
      await fs.unlink(file);
      return acquireProcessLock(file);
    }
    const errorRunning = new Error(`Tiến trình ${path.basename(file)} đã chạy (PID ${pid}).`);
    errorRunning.code = "ALREADY_RUNNING";
    throw errorRunning;
  }
  return async () => {
    const owner = await fs.readFile(file, "utf8").catch(() => "");
    if (owner === String(process.pid)) await fs.unlink(file).catch(() => {});
  };
}
