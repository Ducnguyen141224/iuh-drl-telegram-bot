import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { launchChrome } from "./browser.js";
import { config } from "./config.js";
import { writeJson } from "./storage.js";

const browser = await launchChrome({
  headless: false,
  executablePath: config.executablePath,
});
const existingSession = await fs.access(config.authStatePath).then(() => config.authStatePath, () => undefined);
const context = await browser.newContext({ storageState: existingSession });
const page = await context.newPage();
const terminal = readline.createInterface({ input, output });
const waitForUserLogin = process.argv.includes("--wait");

try {
  await page.goto(config.url, { waitUntil: "domcontentloaded", timeout: 45_000 });

  if ((await page.locator("table.tblDoanvien").count()) === 0) {
    console.log("\nHãy đăng nhập IUH trong cửa sổ Chrome vừa mở.");
    if (waitForUserLogin) {
      console.log("Đang chờ bạn đăng nhập. Phiên sẽ được lưu khi bảng hoạt động xuất hiện (tối đa 15 phút).");
    } else {
      await terminal.question(
        "Khi trang Tra cứu và bảng Đăng ký tham gia đã hiện ra, nhấn Enter tại đây... ",
      );
    }
  }

  await page.locator("table.tblDoanvien").waitFor({
    state: "visible",
    timeout: waitForUserLogin ? 15 * 60_000 : 15_000,
  });
  await fs.mkdir(path.dirname(config.authStatePath), { recursive: true });
  await writeJson(config.authStatePath, await context.storageState());
  console.log(`Đã lưu phiên đăng nhập tại ${config.authStatePath}`);
} catch (error) {
  console.error(`Không thể lưu phiên đăng nhập: ${error.message}`);
  process.exitCode = 1;
} finally {
  terminal.close();
  await browser.close();
}
