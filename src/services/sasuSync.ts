/**
 * SasuSync SMS adapter.
 *
 * Credentials and endpoint are provided via environment variables so that no
 * secrets are hard-coded or exposed to the frontend:
 *   SASUSYNC_API_URL  - full URL of the SasuSync send-message endpoint
 *   SASUSYNC_API_KEY  - API key / bearer token
 *   SASUSYNC_SENDER   - registered sender ID (optional)
 */
export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export function isSasuSyncConfigured(): boolean {
  return !!process.env.SASUSYNC_API_URL && !!process.env.SASUSYNC_API_KEY;
}

export async function sendSms(to: string, message: string): Promise<SmsSendResult> {
  const url = process.env.SASUSYNC_API_URL;
  const apiKey = process.env.SASUSYNC_API_KEY;
  const sender = process.env.SASUSYNC_SENDER;

  if (!url || !apiKey) {
    return { success: false, error: "SasuSync is not configured (missing SASUSYNC_API_URL or SASUSYNC_API_KEY)." };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to,
        message,
        sender,
      }),
    });

    const data = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      return { success: false, error: data?.message || data?.error || `HTTP ${response.status}` };
    }

    return { success: true, providerMessageId: data?.id || data?.messageId || data?.message_id };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error contacting SasuSync." };
  }
}
