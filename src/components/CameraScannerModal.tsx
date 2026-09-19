import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  ZapOff,
  Upload,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  Volume2,
  VolumeX,
  Package,
  ArrowRight,
  Layers,
} from "lucide-react";
import { Product } from "../types";
import { apiRequest } from "../lib/api";

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductScanned: (product: Product) => void;
}

export function CameraScannerModal({
  isOpen,
  onClose,
  onProductScanned,
}: CameraScannerModalProps) {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [continuousMode, setContinuousMode] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastFoundProduct, setLastFoundProduct] = useState<Product | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "pos-qr-reader-container";
  const lastScannedTimeRef = useRef<number>(0);

  // Play synthesized crisp POS beep
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio context might be restricted before gesture
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    const now = Date.now();
    // Throttle identical scans within 1.2s to prevent duplicate triggers
    if (decodedText === lastScannedCode && now - lastScannedTimeRef.current < 1200) {
      return;
    }

    lastScannedTimeRef.current = now;
    setLastScannedCode(decodedText);
    playBeep();

    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(60);
      } catch {}
    }

    setLookupLoading(true);
    setScanMessage(null);

    try {
      const res = await apiRequest<{ products: Product[] }>(
        `/api/pos/search?barcode=${encodeURIComponent(decodedText)}`
      );

      if (res.products && res.products.length > 0) {
        const found = res.products[0];
        setLastFoundProduct(found);
        setScanCount((prev) => prev + 1);

        const available = found.totalStock ?? (found as any).total_stock ?? (found as any).available_stock ?? 0;
        if (available <= 0) {
          setScanMessage({
            type: "error",
            text: `"${found.name}" is OUT OF STOCK (0 units available).`,
          });
        } else {
          setScanMessage({
            type: "success",
            text: `Added "${found.name}" to cart (GH₵ ${parseFloat(found.sellingPrice || (found as any).selling_price || "0").toFixed(2)})`,
          });
          onProductScanned(found);
        }

        if (!continuousMode) {
          stopScanner();
          onClose();
        }
      } else {
        setScanMessage({
          type: "error",
          text: `No product matched code: ${decodedText}`,
        });
      }
    } catch (err: any) {
      setScanMessage({
        type: "error",
        text: err.message || "Failed to lookup product.",
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const startScanner = async (cameraId?: string) => {
    setCameraError(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
          verbose: false,
        });
      }

      // Check if already scanning
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edgeSize = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
          return {
            width: edgeSize,
            height: Math.floor(edgeSize * 0.7), // wide rectangle perfect for 1D barcodes and QR
          };
        },
        aspectRatio: 1.0,
      };

      const cameraSource = cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "environment" };

      await scannerRef.current.start(
        cameraSource,
        config,
        (decodedText) => handleScanSuccess(decodedText),
        () => {
          // ignore frame errors while scanning
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.warn("[Scanner] Camera Start Error:", err);
      setCameraError(
        err?.message ||
          "Unable to access camera. Please allow camera permissions in your browser or try selecting another camera."
      );
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.warn("[Scanner] Stop Error:", err);
      }
    }
    setIsScanning(false);
    setTorchEnabled(false);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !isScanning) return;
    try {
      const nextTorch = !torchEnabled;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchEnabled(nextTorch);
    } catch (err) {
      console.warn("[Scanner] Torch not supported on this camera.");
    }
  };

  // Image file scanner fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }
      const decodedResult = await scannerRef.current.scanFile(file, true);
      if (decodedResult) {
        handleScanSuccess(decodedResult);
      }
    } catch (err: any) {
      setScanMessage({
        type: "error",
        text: "Could not detect a valid QR code or Barcode in that image.",
      });
    }
  };

  // Query cameras when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/rear camera if found
          const backCam = devices.find((d) =>
            /back|rear|environment/i.test(d.label)
          );
          const initialId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(initialId);
          startScanner(initialId);
        } else {
          startScanner();
        }
      })
      .catch(() => {
        if (!isMounted) return;
        startScanner();
      });

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white flex items-center space-x-2">
                <span>Camera QR &amp; Barcode Scanner</span>
                {scanCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-teal-500 text-slate-900">
                    {scanCount} scanned
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">Aim camera at QR code or pharmaceutical barcode</p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute beep sound" : "Enable beep sound"}
              className={`p-2 rounded-xl transition ${
                soundEnabled ? "text-teal-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-800"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Canvas Area */}
        <div className="relative bg-black flex-1 flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
          {/* HTML5 QR Container */}
          <div id={containerId} className="w-full h-full max-h-[360px] overflow-hidden" />

          {/* Aiming Reticle Overlays */}
          {isScanning && !cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-64 h-48 border-2 border-teal-400/80 rounded-2xl shadow-[0_0_20px_rgba(20,184,166,0.3)] flex flex-col justify-between p-2">
                {/* Corner markers */}
                <div className="w-4 h-4 border-t-4 border-l-4 border-teal-300 -mt-2 -ml-2 rounded-tl" />
                <div className="w-4 h-4 border-t-4 border-r-4 border-teal-300 -mt-2 -mr-2 rounded-tr self-end" />
                <div className="w-4 h-4 border-b-4 border-l-4 border-teal-300 -mb-2 -ml-2 rounded-bl" />
                <div className="w-4 h-4 border-b-4 border-r-4 border-teal-300 -mb-2 -mr-2 rounded-br self-end" />

                {/* Animated Horizontal Laser Scan Beam */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse shadow-[0_0_8px_rgba(45,212,191,0.8)] top-1/2 -translate-y-1/2" />
              </div>

              <div className="absolute bottom-4 px-3 py-1 bg-black/60 backdrop-blur-xs rounded-full border border-white/10 text-[11px] font-mono text-teal-300 flex items-center space-x-1.5">
                <ScanLine className="w-3.5 h-3.5 animate-spin" />
                <span>Align barcode or QR code within box</span>
              </div>
            </div>
          )}

          {/* Camera Error or Permission Denied View */}
          {cameraError && (
            <div className="p-6 text-center text-slate-300 space-y-4 max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Camera Access Required</h4>
                <p className="text-xs text-slate-400 mt-1">{cameraError}</p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => startScanner(selectedCameraId)}
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center space-x-2 shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Camera Permission</span>
                </button>

                <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer flex items-center justify-center space-x-2 transition">
                  <Upload className="w-4 h-4 text-teal-400" />
                  <span>Scan Image from File</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Live Scan Feedback Banner */}
        {scanMessage && (
          <div
            className={`p-3 text-xs flex items-center justify-between border-t border-b transition ${
              scanMessage.type === "success"
                ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                : "bg-rose-950/80 border-rose-800 text-rose-300"
            }`}
          >
            <div className="flex items-center space-x-2">
              {scanMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="font-semibold">{scanMessage.text}</span>
            </div>
            {lastScannedCode && (
              <span className="font-mono text-[10px] opacity-75">{lastScannedCode}</span>
            )}
          </div>
        )}

        {/* Last Found Product Summary Bar */}
        {lastFoundProduct && (
          <div className="p-3 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <Package className="w-4 h-4 text-teal-400 shrink-0" />
              <div>
                <span className="font-bold text-white">{lastFoundProduct.name}</span>
                <span className="text-slate-400 text-[11px] ml-1.5 font-mono">
                  {lastFoundProduct.sku}
                </span>
              </div>
            </div>
            <span className="font-black text-teal-400">
              GH₵ {parseFloat(lastFoundProduct.sellingPrice || (lastFoundProduct as any).selling_price || "0").toFixed(2)}
            </span>
          </div>
        )}

        {/* Bottom Controls Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Camera Select */}
            {cameras.length > 1 && (
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 text-[11px]">Camera:</span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    startScanner(e.target.value);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 max-w-[160px] truncate"
                >
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Camera ${c.id.substring(0, 5)}...`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Torch / Flashlight toggle */}
            <button
              onClick={toggleTorch}
              disabled={!isScanning}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                torchEnabled
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              } disabled:opacity-40`}
            >
              {torchEnabled ? <ZapOff className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{torchEnabled ? "Flash Off" : "Flashlight"}</span>
            </button>

            {/* Continuous Mode Toggle */}
            <button
              onClick={() => setContinuousMode(!continuousMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                continuousMode
                  ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
              title="Continuous mode allows scanning multiple items consecutively without closing"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{continuousMode ? "Continuous Mode: ON" : "Single Scan"}</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            {/* File Upload Option */}
            <label className="text-[11px] text-slate-400 hover:text-teal-400 cursor-pointer flex items-center space-x-1 transition">
              <Upload className="w-3.5 h-3.5" />
              <span>Or upload barcode / QR image</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition"
            >
              Done Scanning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
