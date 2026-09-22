import React, { useRef } from "react";
import { X, Printer, CheckCircle2, Phone, MapPin, Building } from "lucide-react";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: any;
}

export function ReceiptModal({ isOpen, onClose, receiptData }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !receiptData) return null;

  const handlePrint = () => {
    window.print();
  };

  const {
    pharmacyName = "Empress Oris Herbal & Mart",
    pharmacyAddress = "Accra, Ghana",
    pharmacyPhone = "",
    logoUrl,
    receiptFooter = "Thank you for your patronage! Medicines sold are not returnable once opened.",
    receiptNumber,
    date = new Date().toISOString(),
    cashierName,
    customerName,
    customerPhone,
    items = [],
    subtotal = "0.00",
    discount = "0.00",
    totalAmount = "0.00",
    paymentMethod = "CASH",
    amountReceived = "0.00",
    changeGiven = "0.00",
    transactionReference,
  } = receiptData;

  const resolvedLogo = logoUrl || "/logo.png";

  const formattedDate = new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Action Header - Hidden during print */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center space-x-2 text-emerald-600 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Sale Completed Successfully</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Paper */}
        <div ref={receiptRef} className="p-6 text-slate-900 font-mono text-xs leading-relaxed print:p-0">
          {/* Pharmacy Branding */}
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
            {resolvedLogo && (
              <img src={resolvedLogo} alt="Logo" className="w-12 h-12 mx-auto rounded-full object-contain mb-1" />
            )}
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-900">{pharmacyName}</h1>
            <p className="text-[11px] text-slate-600 flex items-center justify-center space-x-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{pharmacyAddress}</span>
            </p>
            {pharmacyPhone && (
              <p className="text-[11px] text-slate-600 flex items-center justify-center space-x-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>Tel: {pharmacyPhone}</span>
              </p>
            )}
            <p className="text-[10px] text-slate-400">ACCRA, GHANA (GHS)</p>
          </div>

          {/* Meta Info */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Receipt No:</span>
              <span className="font-bold">{receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date/Time:</span>
              <span>{formattedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier:</span>
              <span className="font-semibold">{cashierName || "Dispenser"}</span>
            </div>
            {customerName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span>{customerName} {customerPhone ? `(${customerPhone})` : ""}</span>
              </div>
            )}
          </div>

          {/* Items Header */}
          <div className="py-2 border-b border-slate-300 text-[11px] font-bold grid grid-cols-12">
            <span className="col-span-6">Item</span>
            <span className="col-span-2 text-center">Qty</span>
            <span className="col-span-2 text-right">Price</span>
            <span className="col-span-2 text-right">Total</span>
          </div>

          {/* Items List */}
          <div className="py-2 space-y-2 border-b border-dashed border-slate-300 text-[11px]">
            {items.map((item: any, idx: number) => {
              const name = item.productName || item.product?.name || "Product";
              const qty = item.quantity || 1;
              const price = parseFloat(item.unitPrice || 0).toFixed(2);
              const total = parseFloat(item.totalPrice || item.unitPrice * qty || 0).toFixed(2);

              return (
                <div key={idx} className="grid grid-cols-12 items-baseline">
                  <div className="col-span-6 pr-1 truncate font-medium">
                    {name}
                  </div>
                  <div className="col-span-2 text-center">{qty}</div>
                  <div className="col-span-2 text-right">{price}</div>
                  <div className="col-span-2 text-right font-bold">{total}</div>
                </div>
              );
            })}
          </div>

          {/* Financial Summary */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal:</span>
              <span>GH₵ {parseFloat(subtotal).toFixed(2)}</span>
            </div>
            {parseFloat(discount) > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount:</span>
                <span>- GH₵ {parseFloat(discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200">
              <span>TOTAL PAYABLE:</span>
              <span className="text-teal-700">GH₵ {parseFloat(totalAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Mode:</span>
              <span className="font-bold uppercase">{paymentMethod.replace("_", " ")}</span>
            </div>
            {transactionReference && (
              <div className="flex justify-between">
                <span className="text-slate-500">Ref / TxID:</span>
                <span className="font-mono">{transactionReference}</span>
              </div>
            )}
            {paymentMethod === "CASH" && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cash Received:</span>
                  <span>GH₵ {parseFloat(amountReceived).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-500">Change Given:</span>
                  <span>GH₵ {parseFloat(changeGiven).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer Notice */}
          <div className="pt-3 text-center text-[10px] text-slate-500 space-y-1">
            <p className="italic">{receiptFooter}</p>
            <p className="font-bold text-slate-700">*** Thank You & Get Well Soon ***</p>
          </div>
        </div>

        {/* Modal Action Footer - Hidden during print */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center print:hidden">
          <span className="text-xs text-slate-500">Printed via SamTeck Digital POS</span>
          <div className="space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
            >
              Done
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
