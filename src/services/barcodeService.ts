import { Product } from "../types";
import { apiRequest } from "../lib/api";
import { getCachedProducts } from "../lib/offlineDb";
import { isOnline } from "../lib/offlineSync";

export type BarcodeMode = "register" | "cashier";

export interface BarcodeLookupResult {
  barcode: string;
  product: Product | null;
  found: boolean;
  message?: string;
}

const NOT_FOUND_MESSAGE = "Product not found. Please check the barcode or register this product first.";

export function normalizeBarcode(value: unknown): string {
  return String(value ?? "").trim();
}

export function isValidBarcode(value: string): boolean {
  const code = normalizeBarcode(value);
  if (!code) return false;
  // Retail barcodes are short text values; reject obvious garbage without
  // destroying legitimate leading-zero values.
  return code.length <= 64;
}

function toProduct(raw: any): Product {
  return {
    ...raw,
    totalStock: raw?.totalStock ?? raw?.total_stock ?? raw?.available_stock ?? 0,
    sellingPrice: raw?.sellingPrice ?? raw?.selling_price ?? "0",
  } as Product;
}

export function findInCatalogue(catalogue: Product[], barcode: string): Product | null {
  const code = normalizeBarcode(barcode);
  if (!code) return null;
  return (
    catalogue.find(
      (p) =>
        normalizeBarcode(p.barcode) === code ||
        normalizeBarcode(p.sku) === code ||
        normalizeBarcode((p as any).id) === code
    ) || null
  );
}

export async function findProductByBarcode(
  barcode: string,
  catalogue?: Product[]
): Promise<Product | null> {
  const code = normalizeBarcode(barcode);
  if (!code) return null;

  const localCatalogue = catalogue && catalogue.length ? catalogue : await getCachedProducts().catch(() => []);
  const localMatch = findInCatalogue(localCatalogue as Product[], code);
  if (localMatch) return toProduct(localMatch);

  if (isOnline()) {
    try {
      const res = await apiRequest<{ products: any[] }>(
        `/api/pos/search?barcode=${encodeURIComponent(code)}`
      );
      if (res?.products?.length) {
        return toProduct(res.products[0]);
      }
    } catch (err) {
      console.warn("[BarcodeService] Remote lookup failed:", err);
    }
  }

  return null;
}

export async function processBarcode(params: {
  barcode: string;
  mode: BarcodeMode;
  catalogue?: Product[];
}): Promise<BarcodeLookupResult> {
  const code = normalizeBarcode(params.barcode);
  if (!isValidBarcode(code)) {
    return { barcode: code, product: null, found: false, message: "Invalid barcode." };
  }

  if (params.mode === "register") {
    // Registration mode never performs product identification or auto-creation.
    return { barcode: code, product: null, found: false };
  }

  const product = await findProductByBarcode(code, params.catalogue);
  if (!product) {
    return { barcode: code, product: null, found: false, message: NOT_FOUND_MESSAGE };
  }

  const available = (product as any).totalStock ?? 0;
  if (available <= 0) {
    return {
      barcode: code,
      product,
      found: true,
      message: `"${product.name}" is out of stock.`,
    };
  }

  const isActive = (product as any).isActive ?? (product as any).is_active;
  if (isActive === false) {
    return {
      barcode: code,
      product,
      found: false,
      message: `"${product.name}" is inactive and cannot be sold.`,
    };
  }

  return { barcode: code, product, found: true };
}
