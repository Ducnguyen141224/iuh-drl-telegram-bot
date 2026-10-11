import path from "node:path";
import { chromium } from "playwright-core";

export async function launchChrome({ headless, executablePath }) {
  const options = {
    headless,
    ...(executablePath ? { executablePath: path.resolve(executablePath) } : { channel: "chrome" }),
  };
  return chromium.launch(options);
}

export async function readEvents(page, url) {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  if (response && response.status() >= 400) {
    throw new Error(`Trang IUH trả về HTTP ${response.status()}`);
  }

  const table = page.locator("table.tblDoanvien");
  if ((await table.count()) === 0) {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const looksLoggedOut = /đăng nhập|login|mật khẩu|password/iu.test(bodyText);
    const error = new Error(
      looksLoggedOut
        ? "Phiên đăng nhập IUH đã hết hạn. Chạy lại: npm run login"
        : "Không tìm thấy bảng hoạt động trên trang IUH.",
    );
    error.code = looksLoggedOut ? "AUTH_REQUIRED" : "TABLE_NOT_FOUND";
    throw error;
  }

  return table.evaluate((element) => {
    const rows = [...element.querySelectorAll("tr")].slice(1);
    return rows
      .map((row) => {
        const cells = [...row.querySelectorAll("td")];
        if (cells.length < 6) return null;
        const link = cells[1].querySelector("a");
        const target = link?.getAttribute("data-target") || "";
        const idMatch = target.match(/myModal_(\d+)/u);
        const modal = target ? document.querySelector(target) : null;
        const statusCell = cells[5];
        const hasRegistrationControl = Boolean(
          statusCell.querySelector("a, button, input[type='submit']"),
        );

        return {
          id: idMatch?.[1] || "",
          name: (link?.textContent || cells[1].textContent || "").trim(),
          semester: (cells[2].textContent || "").trim(),
          points: (cells[3].textContent || "").trim(),
          deadline: (cells[4].textContent || "").trim(),
          status: (statusCell.textContent || "").trim(),
          details: (modal?.textContent || "")
            .replace(/^\s*×/u, "")
            .replace(/\bClose\s*$/iu, "")
            .trim(),
          hasRegistrationControl,
        };
      })
      .filter(Boolean);
  });
}
