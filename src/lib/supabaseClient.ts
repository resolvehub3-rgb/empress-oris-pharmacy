import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getClientSupabase(): SupabaseClient | null {
  if (!client) {
    const url = (import.meta as any).env?.VITE_SUPABASE_URL || "";
    const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
    if (url && key) {
      try {
        client = createClient(url, key);
      } catch (err) {
        console.warn("[Client Supabase] Error creating client:", err);
      }
    }
  }
  return client;
}

export function subscribeToPharmacyRealtime(onEvent: (event: string, payload: any) => void) {
  const sb = getClientSupabase();
  if (!sb) return () => {};

  try {
    const channel = sb.channel("pharmacy-realtime");
    channel
      .on("broadcast", { event: "*" }, (message: any) => {
        if (message?.event && message?.payload) {
          onEvent(message.event, message.payload);
        }
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  } catch (err) {
    console.warn("[Realtime Subscription] Note:", err);
    return () => {};
  }
}
