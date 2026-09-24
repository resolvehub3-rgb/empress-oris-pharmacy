import type { SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Create the browser Supabase client lazily.
 *
 * supabase-js (plus auth/realtime/postgrest/storage clients) is a sizeable
 * chunk; loading it through a dynamic import keeps it out of the critical
 * first-paint bundle so POS terminals paint the UI sooner, while the realtime
 * connection is established right afterwards in the background.
 */
function loadClient(): Promise<SupabaseClient | null> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const url = (import.meta as any).env?.VITE_SUPABASE_URL || "";
      const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
      if (!url || !key) return null;
      try {
        const { createClient } = await import("@supabase/supabase-js");
        return createClient(url, key);
      } catch (err) {
        console.warn("[Client Supabase] Error creating client:", err);
        clientPromise = null;
        return null;
      }
    })();
  }
  return clientPromise;
}

/** Resolves once the shared client exists (null when not configured). */
export function getClientSupabase(): Promise<SupabaseClient | null> {
  return loadClient();
}

export function subscribeToPharmacyRealtime(onEvent: (event: string, payload: any) => void) {
  let cancelled = false;
  let supabase: SupabaseClient | null = null;
  let channel: ReturnType<SupabaseClient["channel"]> | null = null;

  loadClient()
    .then((sb) => {
      if (cancelled || !sb) return;
      supabase = sb;
      try {
        const ch = sb.channel("pharmacy-realtime");
        ch.on("broadcast", { event: "*" }, (message: any) => {
          if (message?.event && message?.payload) {
            onEvent(message.event, message.payload);
          }
        }).subscribe();
        channel = ch;
      } catch (err) {
        console.warn("[Realtime Subscription] Note:", err);
      }
    })
    .catch(() => {
      /* client unavailable - behaves like an unconfigured environment */
    });

  return () => {
    cancelled = true;
    if (supabase && channel) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // channel already closed
      }
      channel = null;
    }
  };
}
