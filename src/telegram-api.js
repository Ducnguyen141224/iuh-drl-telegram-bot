export function createTelegramClient(token) {
  return async function telegram(method, body = {}) {
    let response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      const code = error.cause?.code || error.name || "NETWORK_ERROR";
      throw new Error(`Không kết nối được Telegram (${code}).`);
    }

    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) {
      const error = new Error(
        `Telegram ${method} thất bại (HTTP ${response.status}, mã ${result?.error_code || "không rõ"}).`,
      );
      error.retryAfter = result?.parameters?.retry_after;
      error.httpStatus = response.status;
      error.errorCode = result?.error_code;
      throw error;
    }
    return result.result;
  };
}
