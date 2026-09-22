import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }
  return supabaseClient;
}

export async function ensureStorageBuckets() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const existing = new Set(buckets?.map((b) => b.name) || []);

    if (!existing.has("product-images")) {
      await supabase.storage.createBucket("product-images", {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
      console.log("[Supabase Storage] Created 'product-images' bucket");
    }

    if (!existing.has("pharmacy-assets")) {
      await supabase.storage.createBucket("pharmacy-assets", {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      });
      console.log("[Supabase Storage] Created 'pharmacy-assets' bucket");
    }
  } catch (err) {
    console.error("[Supabase Storage] Bucket check warning:", err);
  }
}

export async function uploadImageToStorage(
  bucket: "product-images" | "pharmacy-assets",
  path: string,
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      console.error("[Supabase Storage] Upload error:", error);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("[Supabase Storage] Upload exception:", err);
    return null;
  }
}

export async function broadcastRealtimeEvent(
  eventType: string,
  payload: Record<string, unknown>
) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const channel = supabase.channel("pharmacy-realtime");
    const message = {
      ...payload,
      timestamp: new Date().toISOString(),
    };
    try {
      // Explicit REST delivery. The channel is intentionally never subscribed
      // server-side, so channel.send() would hit its deprecated REST fallback
      // and log a deprecation warning on every broadcast.
      await channel.httpSend(eventType, message);
    } catch (httpErr) {
      // Realtime servers older than v2.97.0 have no per-event endpoint;
      // fall back to the legacy batch send() so broadcasts keep working.
      await channel.send({ type: "broadcast", event: eventType, payload: message });
    }
  } catch (err) {
    console.error("[Supabase Realtime] Broadcast warning:", err);
  }
}
