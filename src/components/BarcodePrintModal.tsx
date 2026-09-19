import React, { useState, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import {
  Barcode as BarcodeIcon,
  Printer,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Settings2,
  Tag,
  Layers,
  Building,
} from "lucide-react";
import { Product } from "../types";
import { apiRequest } from "../lib/api";

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onProductUpdated?: (updatedProduct: Product) => void;
}

export function BarcodePrintModal({
  isOpen,
  onClose,
  product,
  onProductUpdated,
}: BarcodePrintModalProps) {
  if (!isOpen || !product) return null;

  const [barcodeValue, setBarcodeValue] = useState(
    product.barcode || product.sku || ""
  );
  const [format, setFormat] = useState<"CODE128" | "EAN13" | "CODE39">("CODE128");
  const [copies, setCopies] = useState<number>(4);
  const [labelSize, setLabelSize] = useState<"single" | "grid" | "shelf">("grid");
  const [showPrice, setShowPrice] = useState(true);
  const [showStoreName, setShowStoreName] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [batchNumber, setBatchNumber] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [isSavingBarcode, setIsSavingBarcode] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const previewSvgRef = useRef<SVGSVGElement | null>(null);
  const printContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-select latest batch expiry if available
  useEffect(() => {
    if (product) {
      setBarcodeValue(product.barcode || product.sku || "");
      const batches = (product as any).batches || [];
      if (batches.length > 0) {
        setBatchNumber(batches[0].batch_number || "");
        if (batches[0].expiry_date) {
          setExpiryDate(new Date(batches[0].expiry_date).toLocaleDateString("en-GB"));
        }
      }
    }
  }, [product]);

  // Render SVG barcode using JsBarcode
  useEffect(() => {
    if (!barcodeValue.trim()) {
      setRenderError("Barcode value cannot be empty.");
      return;
    }

    try {
      setRenderError(null);
      if (previewSvgRef.current) {
        JsBarcode(previewSvgRef.current, barcodeValue.trim(), {
          format: format,
          width: 1.6,
          height: 44,
          displayValue: true,
          fontSize: 12,
          font: "monospace",
          textMargin: 3,
          margin: 6,
          background: "#ffffff",
          lineColor: "#000000",
        });
      }
    } catch (err: any) {
      console.warn("[Barcode Render] Warning:", err);
      // Fallback to CODE128 if EAN13 check digits fail
      if (format !== "CODE128") {
        setFormat("CODE128");
      } else {
        setRenderError(err.message || "Invalid barcode string for selected format.");
      }
    }
  }, [barcodeValue, format, isOpen]);

  // Render print barcodes whenever copies, label options or barcode changes
  useEffect(() => {
    if (!isOpen || !printContainerRef.current) return;

    const svgs = printContainerRef.current.querySelectorAll<SVGSVGElement>(".printable-barcode-svg");
    svgs.forEach((svg) => {
      try {
        JsBarcode(svg, barcodeValue.trim(), {
          format: format,
          width: labelSize === "shelf" ? 1.4 : 1.6,
          height: labelSize === "shelf" ? 34 : 42,
          displayValue: true,
          fontSize: 11,
          font: "monospace",
          textMargin: 2,
          margin: 4,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch (err) {
        console.warn(err);
      }
    });
  }, [barcodeValue, format, copies, labelSize, isOpen]);

  // Generate a standard EAN/Code-128 barcode number if missing
  const handleGenerateBarcode = () => {
    // Generate clean 12-digit code or EO-prefixed standard
    const randomPart = Math.floor(10000000 + Math.random() * 90000000).toString();
    const newCode = `EO${randomPart}`;
    setBarcodeValue(newCode);
  };

  // Save generated barcode to the product in Supabase PostgreSQL
  const handleSaveBarcodeToDatabase = async () => {
    if (!barcodeValue.trim()) return;
    setIsSavingBarcode(true);
    setSaveSuccess(false);

    try {
      const res = await apiRequest<{ success: boolean; product: Product }>(
        `/api/products/${product.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...product,
            barcode: barcodeValue.trim(),
          }),
        }
      );

      if (res.product) {
        setSaveSuccess(true);
        if (onProductUpdated) {
          onProductUpdated(res.product);
        }
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch (err: any) {
      alert("Failed to save barcode: " + err.message);
    } finally {
      setIsSavingBarcode(false);
    }
  };

  // Trigger native browser printing
  const handlePrint = () => {
    window.print();
  };

  const sellingPriceFormatted = parseFloat(
    product.sellingPrice || (product as any).selling_price || "0"
  ).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      {/* Non-Print Modal Workspace */}
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] print:hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Barcode Generator &amp; Label Printing
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {product.name} ({product.dosageForm || "Medicine"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Barcode Config Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
            <div className="sm:col-span-7 space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Barcode Value (SKU / Code / EAN)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  placeholder="Enter or generate barcode"
                  className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  title="Generate random valid barcode string"
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition flex items-center space-x-1 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>Generate</span>
                </button>
              </div>
            </div>

            <div className="sm:col-span-5 flex space-x-2">
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-bold text-slate-700">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                >
                  <option value="CODE128">Code 128 (Universal)</option>
                  <option value="EAN13">EAN-13</option>
                  <option value="CODE39">Code 39</option>
                </select>
              </div>

              {barcodeValue !== product.barcode && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-transparent select-none">Save</label>
                  <button
                    type="button"
                    onClick={handleSaveBarcodeToDatabase}
                    disabled={isSavingBarcode || !barcodeValue.trim()}
                    className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0 disabled:opacity-50"
                  >
                    {isSavingBarcode ? "Saving..." : "Save to DB"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Barcode <strong>{barcodeValue}</strong> successfully saved to product catalog in Supabase.</span>
            </div>
          )}

          {/* Live Preview Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Label Sticker Preview</span>
              <span className="text-[11px] text-slate-400 font-normal">Standard 50mm × 30mm layout</span>
            </div>

            <div className="p-6 bg-slate-100 rounded-2xl flex items-center justify-center">
              <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm w-64 text-center space-y-1 select-none">
                {showStoreName && (
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-800 border-b border-slate-100 pb-1">
                    Empress Oris Herbal &amp; Mart
                  </div>
                )}
                <div className="text-xs font-extrabold text-slate-900 truncate leading-tight pt-0.5">
                  {product.name}
                </div>
                {product.dosageForm && (
                  <div className="text-[10px] text-slate-500 font-medium">
                    {product.dosageForm} {product.strength ? `• ${product.strength}` : ""}
                  </div>
                )}

                {/* SVG Barcode Preview */}
                <div className="py-1 flex justify-center">
                  <svg ref={previewSvgRef} className="max-w-full h-auto mx-auto" />
                </div>

                {renderError && (
                  <p className="text-[10px] text-rose-600 font-bold">{renderError}</p>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                  {showSku && (
                    <span className="font-mono text-slate-500">{product.sku}</span>
                  )}
                  {showPrice && (
                    <span className="font-black text-slate-900 text-xs ml-auto">
                      GH₵ {sellingPriceFormatted}
                    </span>
                  )}
                </div>

                {expiryDate && (
                  <div className="text-[9px] text-slate-400 font-mono text-right pt-0.5">
                    Exp: {expiryDate}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Printing Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                <span>Quantity &amp; Page Layout</span>
              </h4>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-600 font-medium">Labels to Print:</label>
                <div className="flex items-center space-x-1.5">
                  {[1, 4, 8, 12, 24].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCopies(num)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                        copies === num
                          ? "bg-teal-600 text-white shadow-2xs"
                          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 px-2 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-600 font-medium">Sheet Format:</label>
                <select
                  value={labelSize}
                  onChange={(e) => setLabelSize(e.target.value as any)}
                  className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="grid">A4 Sticker Sheet (3-Column Grid)</option>
                  <option value="single">Single Roll / Thermal (50×30mm)</option>
                  <option value="shelf">Shelf Edge Label (40×25mm)</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Settings2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Label Elements Included</span>
              </h4>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-slate-700 font-medium">Store Name</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-slate-700 font-medium">Selling Price (GH₵)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSku}
                    onChange={(e) => setShowSku(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-slate-700 font-medium">Product SKU</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!expiryDate}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setExpiryDate(new Date().toLocaleDateString("en-GB"));
                      } else {
                        setExpiryDate("");
                      }
                    }}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-slate-700 font-medium">Batch Expiry</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!barcodeValue.trim()}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Print {copies} {copies === 1 ? "Label" : "Labels"}</span>
          </button>
        </div>
      </div>

      {/* DEDICATED PRINT STYLES & CONTAINER (Visible exclusively during window.print()) */}
      <div
        ref={printContainerRef}
        className="hidden print:block fixed inset-0 bg-white p-2 text-black z-[9999]"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .print\\:block, .print\\:block * {
              visibility: visible !important;
            }
            @page {
              size: auto;
              margin: 4mm;
            }
          }
        ` }} />

        <div
          className={`grid ${
            labelSize === "single"
              ? "grid-cols-1 gap-2"
              : labelSize === "shelf"
              ? "grid-cols-4 gap-2"
              : "grid-cols-3 gap-3"
          }`}
        >
          {Array.from({ length: copies }).map((_, index) => (
            <div
              key={index}
              className="border border-black p-2.5 rounded text-center flex flex-col justify-between bg-white text-black break-inside-avoid"
              style={{
                width: labelSize === "shelf" ? "42mm" : labelSize === "single" ? "52mm" : "62mm",
                minHeight: labelSize === "shelf" ? "28mm" : "34mm",
              }}
            >
              {showStoreName && (
                <div className="text-[8px] font-black uppercase tracking-wider border-b border-black pb-0.5 leading-none">
                  Empress Oris Herbal &amp; Mart
                </div>
              )}

              <div className="text-[10px] font-black truncate leading-tight mt-0.5">
                {product.name}
              </div>

              {product.dosageForm && (
                <div className="text-[8px] text-gray-700 leading-none">
                  {product.dosageForm} {product.strength ? `• ${product.strength}` : ""}
                </div>
              )}

              {/* Printable Barcode */}
              <div className="my-0.5 flex justify-center">
                <svg className="printable-barcode-svg max-w-full h-auto mx-auto" />
              </div>

              <div className="flex items-center justify-between border-t border-black pt-0.5 text-[9px] leading-none">
                {showSku && <span className="font-mono text-[8px]">{product.sku}</span>}
                {showPrice && (
                  <span className="font-black text-[10px] ml-auto">
                    GH₵ {sellingPriceFormatted}
                  </span>
                )}
              </div>

              {expiryDate && (
                <div className="text-[7px] text-right font-mono leading-none mt-0.5">
                  EXP: {expiryDate}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
