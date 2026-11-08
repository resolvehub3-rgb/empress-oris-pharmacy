import { apiRequest } from "./api";
import {
  getPendingSales,
  removePendingSale,
  getCachedProducts,
  cacheProducts,
  setLastSync,
  getLastSync,
} from "./offlineDb";

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export async function syncPendingSales(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 };
  const pending = await getPendingSales();
  let synced = 0;
  let failed = 0;
  for (const sale of pending) {
    try {
      await apiRequest("/api/sales/offline", { method: "POST", body: JSON.stringify({ sale }) });
      await removePendingSale(sale.id);
      synced++;
    } catch (err) {
      failed++;
      console.warn("[OfflineSync] Failed to sync sale", sale.id, err);
    }
  }
  if (synced > 0) await setLastSync(new Date().toISOString());
  return { synced, failed };
}

export async function refreshProductCache(): Promise<void> {
  if (!isOnline()) return;
  try {
    const res = await apiRequest<{ products: any[] }>("/api/products");
    await cacheProducts(res.products || []);
    await setLastSync(new Date().toISOString());
  } catch (err) {
    console.warn("[OfflineSync] Failed to refresh products", err);
  }
}

export async function getOfflineProducts(): Promise<any[]> {
  if (isOnline()) {
    try {
      const res = await apiRequest<{ products: any[] }>("/api/products");
      await cacheProducts(res.products || []);
      return res.products || [];
    } catch {
      return getCachedProducts();
    }
  }
  return getCachedProducts();
}
