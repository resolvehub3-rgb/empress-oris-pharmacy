/**
 * SasuSync SMS adapter.
 *
 * Official SasuSync SMS API:
 *   Base URL: https://sms.sasusync.com
 *   Sandbox:  POST /smssandbox/v1/send
 *   Live:     POST /api/v1/send
 *
 * Configuration is provided via backend environment variables only:
 *   SASUSYNC_API_KEY      - SasuSync API key (sent as X-API-Key)
 *   SASUSYNC_BASE_URL    - https://sms.sasusync.com
 *   SASUSYNC_MODE        - "sandbox" or "live"
 *   SASUSYNC_SENDER_ID   - approved sender ID
 */
export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  taskId?: string;
  queued?: boolean;
  error?: string;
}

function getBaseUrl(): string {
  return (process.env.SASUSYNC_BASE_URL || "https://sms.sasusync.com").replace(/\/+$/, "");
}

function getMode(): "sandbox" | "live" {
  return process.env.SASUSYNC_MODE === "live" ? "live" : "sandbox";
}

export function getSasuSyncEndpoint(): string {
  const base = getBaseUrl();
  return getMode() === "live"
    ? `${base}/api/v1/send`
    : `${base}/smssandbox/v1/send`;
}

export function isSasuSyncConfigured(): boolean {
  return !!process.env.SASUSYNC_API_KEY && !!process.env.SASUSYNC_SENDER_ID;
}

export function normalizeGhanaPhone(input: string): string {
  const raw = String(input || "").trim().replace(/\s+/g, "").replace(/^\+/, "");
  if (!raw) return "";
  if (raw.startsWith("233") && raw.length >= 12) return raw;
  if (raw.startsWith("0") && raw.length === 10) return `233${raw.slice(1)}`;
  if (raw.length === 9) return `233${raw}`;
  return raw;
}

export function validateGhanaPhone(input: string): boolean {
  const normalized = normalizeGhanaPhone(input);
  return /^233\d{9}$/.test(normalized);
}

export async function sendSms(
  to: string,
  message: string,
  idempotencyKey?: string
): Promise<SmsSendResult> {
  const apiKey = process.env.SASUSYNC_API_KEY;
  const senderId = process.env.SASUSYNC_SENDER_ID || process.env.SASUSYNC_SENDER;

  if (!apiKey || !senderId) {
    return {
      success: false,
      error: "SasuSync is not configured (missing SASUSYNC_API_KEY or SASUSYNC_SENDER_ID).",
    };
  }

  const recipient = normalizeGhanaPhone(to);
  if (!validateGhanaPhone(recipient)) {
    return { success: false, error: "Invalid recipient phone number." };
  }

  const url = getSasuSyncEndpoint();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    };
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender: senderId,
        recipients: [recipient],
        message,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({} as any));

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || data?.error || `HTTP ${response.status}`,
      };
    }

    const taskId = data?.task_id || data?.taskId || data?.id;
    const queued = data?.status === "queued" || data?.queued === true;

    // Accepted or queued counts as accepted.
    return {
      success: true,
      taskId,
      providerMessageId: taskId,
      queued,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.name === "AbortError" ? "SMS request timed out." : err?.message || "Network error contacting SasuSync.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
