"use client";

import React, { useState, useRef } from "react";

// ============================================================================
// CONSTANTS & PRICING
// ============================================================================
const PRICING = {
  retail: { baseRateSqIn: 0.02, cutFee: 0.15 },
  wholesale: { baseRateSqIn: 0.0163, cutFee: 0.07 },
  addons: { fileCheck: 20.0, expedite: 35.0 },
};

const DISCOUNT_TIERS = [
  { minQty: 1, discount: 0, label: "Standard" },
  { minQty: 25, discount: 0.05, label: "5% Off" },
  { minQty: 50, discount: 0.10, label: "10% Off" },
  { minQty: 100, discount: 0.15, label: "15% Off" },
];

const MAX_WIDTH_INCHES = 22.75;
const DEFAULT_DPI = 300;

// ============================================================================
// PARSING UTILITIES
// ============================================================================
async function readPngDpi(file: File): Promise<number | null> {
  try {
    const slice = await file.slice(0, 8192).arrayBuffer();
    const dv = new DataView(slice);
    let i = 8;
    while (i + 12 <= dv.byteLength) {
      const len = dv.getUint32(i, false);
      i += 4;
      if (i + 4 > dv.byteLength) break;
      const type = String.fromCharCode(dv.getUint8(i), dv.getUint8(i + 1), dv.getUint8(i + 2), dv.getUint8(i + 3));
      i += 4;
      if (type === "pHYs" && len === 9 && i + 9 <= dv.byteLength) {
        const xppm = dv.getUint32(i, false);
        if (dv.getUint8(i + 8) === 1 && xppm > 0) return xppm * 0.0254;
      }
      i += len + 4;
    }
  } catch (e) {}
  return null;
}

async function readJpegDpi(file: File): Promise<number | null> {
  try {
    const buf = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    let i = 2;
    while (i + 10 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const segLen = (buf[i + 2] << 8) | buf[i + 3];
      if (segLen < 2 || i + 2 + segLen > buf.length) break;
      if (marker === 0xe0) {
        const s = i + 4;
        if (buf[s] === 0x4a && buf[s+1] === 0x46 && buf[s+2] === 0x49 && buf[s+3] === 0x46 && buf[s+4] === 0x00) {
          const units = buf[s + 7];
          const xDensity = (buf[s + 8] << 8) | buf[s + 9];
          if (xDensity > 0) return units === 1 ? xDensity : units === 2 ? xDensity * 2.54 : null;
        }
      }
      i += 2 + segLen;
    }
  } catch (e) {}
  return null;
}

function createImageFromFile(file: File): Promise<{ image: HTMLImageElement; src: string }> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, src });
    image.onerror = reject;
    image.src = src;
  });
}

function formatPrice(num: number) {
  return num.toFixed(2);
}

// ============================================================================
// TYPES
// ============================================================================
type CartItem = {
  id: string;
  file: File;
  previewUrl: string;
  dpi: number;
  width: number;
  height: number;
  aspectRatio: number;
  quantity: number;
  addons: { cutting: boolean; fileCheck: boolean };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function InteractiveCartEngine() {
  const [accountMode, setAccountMode] = useState<"retail" | "wholesale">("retail");
  const [files, setFiles] = useState<CartItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalExpedite, setGlobalExpedite] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- FILE HANDLING ---
  const handleFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setIsProcessing(true);
    
    const arr = Array.from(selectedFiles);
    for (const file of arr) {
      let dpi = DEFAULT_DPI;
      const isVector = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (!isVector) {
        if (file.type === "image/png") dpi = await readPngDpi(file) || dpi;
        else if (file.type === "image/jpeg" || file.type === "image/jpg") dpi = await readJpegDpi(file) || dpi;
      }

      let wIn = 10;
      let hIn = 10;
      let previewUrl = "pdf-placeholder";
      let aspectRatio = 1;

      if (!isVector) {
        const { image, src } = await createImageFromFile(file);
        previewUrl = src;
        wIn = image.naturalWidth / dpi;
        hIn = image.naturalHeight / dpi;
        aspectRatio = wIn > 0 ? hIn / wIn : 1;

        if (wIn > MAX_WIDTH_INCHES) {
          wIn = MAX_WIDTH_INCHES;
          hIn = MAX_WIDTH_INCHES * aspectRatio;
        }
      }

      const newItem: CartItem = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        previewUrl,
        dpi: isVector ? 999 : Math.round(dpi),
        width: wIn,
        height: hIn,
        aspectRatio,
        quantity: 10, // Default bulk starting point
        addons: { cutting: accountMode === "wholesale", fileCheck: false },
      };

      setFiles((prev) => [...prev, newItem]);
    }
    
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateItem = (id: string, updates: Partial<CartItem>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeItem = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // --- CART MATH ---
  const currentRates = PRICING[accountMode];
  const totalQuantity = files.reduce((sum, f) => sum + f.quantity, 0);
  const currentTier = [...DISCOUNT_TIERS].reverse().find(t => totalQuantity >= t.minQty) || DISCOUNT_TIERS[0];
  const nextTier = DISCOUNT_TIERS.find(t => t.minQty > totalQuantity);

  let totalPrintSubtotal = 0;
  let totalFileCheckFees = 0;

  const calculatedFiles = files.map((item) => {
    const areaSqIn = Math.max(0, item.width * item.height);
    const rawBaseSqPrice = areaSqIn * currentRates.baseRateSqIn;
    const discountedBaseSqPrice = rawBaseSqPrice * (1 - currentTier.discount);
    const perItemCutFee = item.addons.cutting ? currentRates.cutFee : 0;
    
    const unitPriceFinal = discountedBaseSqPrice + perItemCutFee;
    const lineTotal = unitPriceFinal * item.quantity;
    
    totalPrintSubtotal += lineTotal;
    if (item.addons.fileCheck) totalFileCheckFees += PRICING.addons.fileCheck;

    return { ...item, areaSqIn, rawBaseSqPrice, unitPriceFinal, lineTotal };
  });

  const globalFlatFees = (globalExpedite ? PRICING.addons.expedite : 0) + totalFileCheckFees;
  const grandTotal = totalPrintSubtotal + globalFlatFees;

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-gray-900 pb-20">
      
      {/* HEADER & ACCOUNT SIMULATOR */}
      <header className="bg-white border-b border-[#8A8D8F]/30 py-3 sm:py-4 px-3 sm:px-6 md:px-8 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">Custom Studio</h1>
            <span className="text-[#8A8D8F]">|</span>
            <span className="text-xs sm:text-sm font-semibold tracking-wider text-[#B87333] uppercase">Quoting Engine</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 bg-[#f4f4f5] p-1.5 rounded-lg border border-[#8A8D8F]/20 overflow-x-auto">
            <span className="text-xs font-bold text-gray-500 uppercase px-2 shrink-0">Account:</span>
            <button
              onClick={() => setAccountMode("retail")}
              className={`px-3 py-2 sm:py-1.5 text-xs font-bold rounded transition-all whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 active:scale-95 ${accountMode === "retail" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900"}`}
            >
              Guest <span className="hidden sm:inline">(Retail)</span>
            </button>
            <button
              onClick={() => setAccountMode("wholesale")}
              className={`px-3 py-2 sm:py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1 whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 active:scale-95 ${accountMode === "wholesale" ? "bg-[#1a1a1a] shadow-sm text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              PP Prefix <span className="hidden sm:inline">(Wholesale)</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 mt-5 sm:mt-8 space-y-5 sm:space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Workspace & Files */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Master Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative overflow-hidden flex flex-col items-center justify-center p-10 border-2 border-dashed transition-all duration-300 ease-in-out cursor-pointer rounded-xl bg-white
                ${isDragging ? "border-[#B87333] bg-[#B87333]/5 scale-[0.99]" : "border-[#8A8D8F]/40 hover:border-[#8A8D8F] hover:bg-[#f4f4f5]"}
              `}
            >
              <div className="flex items-center gap-4">
                <svg className={`w-8 h-8 ${isDragging ? "text-[#B87333]" : "text-[#8A8D8F]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-gray-900">Upload additional artwork</h3>
                  <p className="text-sm text-gray-500">Drag & drop or click to browse. Max width 22.75".</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" multiple accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              
              {isProcessing && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                  <div className="w-8 h-8 border-4 border-[#8A8D8F]/30 border-t-[#B87333] rounded-full animate-spin mb-2"></div>
                  <p className="text-sm font-bold text-gray-800">Processing DPI...</p>
                </div>
              )}
            </div>

            {/* Uploaded Files List */}
            <div className="space-y-4">
              {calculatedFiles.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-[#8A8D8F]/30 overflow-hidden flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {/* Left: Preview */}
                  <div className="md:w-48 bg-[#f4f4f5] border-r border-[#8A8D8F]/20 flex flex-col items-center justify-center p-4 relative min-h-[200px]">
                    {item.previewUrl === "pdf-placeholder" ? (
                      <span className="font-bold text-gray-400">PDF Document</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt={item.file.name} className="max-w-full max-h-40 object-contain drop-shadow-md" />
                    )}
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] font-bold text-[#8A8D8F] uppercase tracking-wider bg-white/80 px-2 py-1 rounded backdrop-blur-sm">
                      <span>{item.dpi === 999 ? "Vector" : `${item.dpi} DPI`}</span>
                      <span>{item.areaSqIn.toFixed(1)} sq in</span>
                    </div>
                  </div>

                  {/* Right: Configurator */}
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-lg text-gray-900 truncate pr-4">{item.file.name}</h4>
                        <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Width (in)</label>
                          <input type="number" value={item.width.toFixed(2)} onChange={(e) => {
                            const w = parseFloat(e.target.value) || 0.01;
                            updateItem(item.id, { width: w, height: w * item.aspectRatio });
                          }} className="w-full bg-white border border-[#8A8D8F]/30 rounded-md py-1.5 px-3 text-sm focus:border-[#1a1a1a] focus:ring-1 focus:ring-[#1a1a1a] outline-none transition-all"/>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Height (in)</label>
                          <input type="number" value={item.height.toFixed(2)} onChange={(e) => {
                            const h = parseFloat(e.target.value) || 0.01;
                            updateItem(item.id, { height: h, width: h / item.aspectRatio });
                          }} className="w-full bg-white border border-[#8A8D8F]/30 rounded-md py-1.5 px-3 text-sm focus:border-[#1a1a1a] focus:ring-1 focus:ring-[#1a1a1a] outline-none transition-all"/>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-end gap-4 border-t border-[#8A8D8F]/10 pt-4 mt-auto">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                          <input type="checkbox" checked={item.addons.cutting} onChange={() => updateItem(item.id, { addons: { ...item.addons, cutting: !item.addons.cutting }})} className="w-4 h-4 text-[#1a1a1a] rounded border-gray-300 focus:ring-[#1a1a1a]" />
                          Precision Cut
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                          <input type="checkbox" checked={item.addons.fileCheck} onChange={() => updateItem(item.id, { addons: { ...item.addons, fileCheck: !item.addons.fileCheck }})} className="w-4 h-4 text-[#1a1a1a] rounded border-gray-300 focus:ring-[#1a1a1a]" />
                          File Check
                        </label>
                      </div>

                      <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-lg border border-[#8A8D8F]/20">
                        <span className="text-xs font-bold text-gray-500 uppercase px-2">Qty</span>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className="w-20 text-center font-bold bg-white border border-[#8A8D8F]/30 rounded-md py-1 focus:border-[#B87333] outline-none"/>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {files.length === 0 && (
                <div className="text-center py-12 text-gray-400 italic">No artwork uploaded yet.</div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: The Interactive Quoting Summary */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            
            {/* Global Expedite Toggle */}
            <label className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-200 cursor-pointer hover:bg-orange-100 transition-all shadow-sm">
              <div>
                <span className="block text-sm font-bold text-orange-900 mb-0.5 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                  Expedite Entire Order
                </span>
                <span className="block text-xs text-orange-700">Skip the line. Ships in 24 hrs. (+${PRICING.addons.expedite})</span>
              </div>
              <div className="relative inline-flex items-center">
                <input type="checkbox" checked={globalExpedite} onChange={() => setGlobalExpedite(!globalExpedite)} className="sr-only peer" />
                <div className="w-11 h-6 bg-orange-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B87333]"></div>
              </div>
            </label>

            {/* Summary Box */}
            <div className="bg-[#1a1a1a] text-white rounded-xl shadow-xl overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#B87333]"></div>
              
              <div className="p-6">
                <h3 className="text-xl font-bold mb-4">Cart Summary</h3>

                {/* Progress Bar Tier Visualizer based on TOTAL Quantity */}
                <div className="bg-black/30 rounded-lg p-4 border border-white/10 mb-6">
                  <div className="flex justify-between text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">
                    <span>Combined Qty: {totalQuantity}</span>
                    {nextTier && <span className="text-[#B87333]">Unlock {nextTier.label} at {nextTier.minQty}</span>}
                  </div>
                  
                  {nextTier ? (
                    <>
                      <div className="w-full bg-gray-800 rounded-full h-2 mb-2 overflow-hidden">
                        <div className="bg-[#B87333] h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.min(100, (totalQuantity / nextTier.minQty) * 100)}%` }}></div>
                      </div>
                      <p className="text-[11px] text-gray-400">Add <strong className="text-white">{nextTier.minQty - totalQuantity}</strong> more items across any design to boost your global discount.</p>
                    </>
                  ) : (
                    <div className="text-emerald-400 text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wide">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Maximum bulk discount unlocked
                    </div>
                  )}
                </div>
                
                <div className="space-y-3 text-sm">
                  {calculatedFiles.map((item, index) => (
                    <div key={item.id} className="flex justify-between items-start text-gray-300 text-xs border-b border-white/5 pb-2">
                      <div className="flex-1 pr-4">
                        <span className="font-bold text-white block truncate">{item.file.name}</span>
                        <span className="text-gray-500">{item.quantity}x @ ${formatPrice(item.unitPriceFinal)}</span>
                      </div>
                      <span className="font-semibold text-white">${formatPrice(item.lineTotal)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between items-center font-bold text-white pt-2">
                    <span>Print Subtotal</span>
                    <span>${formatPrice(totalPrintSubtotal)}</span>
                  </div>

                  {globalFlatFees > 0 && (
                    <div className="flex justify-between items-center text-orange-300">
                      <span>Service Add-ons</span>
                      <span>+${formatPrice(globalFlatFees)}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-black p-6 border-t border-white/10">
                <div className="flex justify-between items-end mb-6">
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Grand Total</span>
                  <span className="text-3xl font-black text-[#B87333]">${formatPrice(grandTotal)}</span>
                </div>
                
                <button 
                  disabled={files.length === 0}
                  className="w-full bg-white text-[#1a1a1a] py-3.5 rounded-lg font-bold text-lg hover:bg-gray-200 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                  Proceed to Checkout →
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}