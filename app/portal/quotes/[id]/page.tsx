"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

// --- DYNAMIC COLOR ENGINE ---
const getColorHex = (colorName: string): string => {
  if (!colorName) return "#CD7F32"; 
  
  const lower = colorName.toLowerCase().trim();
  
  const colorMap: { [key: string]: string } = {
    black: "#0f1115", white: "#94a3b8", navy: "#1e3a8a", red: "#dc2626", royal: "#2563eb", "royal blue": "#2563eb",
    grey: "#6b7280", gray: "#6b7280", "heather grey": "#9ca3af", "sport grey": "#9ca3af", charcoal: "#3f3f46",
    "nardo grey": "#686a6c", green: "#16a34a", "kelly green": "#16a34a", "forest green": "#14532d",
    yellow: "#ca8a04", gold: "#b45309", orange: "#ea580c", purple: "#7e22ce", pink: "#db2777",
    maroon: "#7f1d1d", burgundy: "#7f1d1d", brown: "#78350f", tan: "#d2b48c", sand: "#d2b48c",
    cream: "#d1d5db", teal: "#0d9488", cyan: "#0891b2", blue: "#3b82f6", olive: "#4d7c0f"
  };

  if (colorMap[lower]) return colorMap[lower];
  for (const key in colorMap) {
    if (lower.includes(key)) return colorMap[key];
  }

  return "#CD7F32"; 
};

// --- DYNAMIC GARMENT ICONS ---
const renderGarmentIcon = (description: string, colorHex: string): ReactNode => {
  if (!description) return <span className="w-5 h-5 mr-2 shrink-0"></span>;
  const desc = description.toLowerCase();
  const classes = "w-5 h-5 mr-2 shrink-0 mt-0.5";
  
  if (desc.includes("hoodie") || desc.includes("hooded")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M18 9l3 3-2 2-1-2v10H6V12l-1 2-2-2 3-3" />
        <path d="M8 9V5c0-2.5 1.5-4 4-4s4 1.5 4 4v4" />
        <path d="M10 9v3" />
        <path d="M14 9v3" />
        <path d="M7.5 15h9l1 5H6.5l1-5z" />
      </svg>
    );
  }
  if (desc.includes("polo") || desc.includes("collared")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M18 7l3 3-2 2-1-2v12H6V10l-1 2-2-2 3-3" />
        <path d="M9 7l3 4 3-4" />
        <path d="M12 7v6" />
        <circle cx="12" cy="10" r="0.5" fill={colorHex}/>
      </svg>
    );
  }
  if (desc.includes("hat") || desc.includes("cap") || desc.includes("beanie")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M4 15v-2a8 8 0 0 1 16 0v2" />
        <path d="M2 15h15c2 0 4 1 4 2s-2 2-4 2H2v-4z" />
        <circle cx="12" cy="4" r="1.5" />
        <path d="M12 5.5v7.5" />
      </svg>
    );
  }
  if (desc.includes("long sleeve") || desc.includes("longsleeve")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M17 6L22 18l-3 1-2-9v12H7V12L5 19l-3-1L7 6" />
        <path d="M8 6c0 2 2 3 4 3s4-1 4-3" />
      </svg>
    );
  }
  if (desc.includes("jacket") || desc.includes("zip")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M18 9l3 4-2 2-1-3v10H6V12l-1 3-2-2 3-4" />
        <path d="M9 9V5l3 3 3-3v4" />
        <path d="M12 8v14" />
        <path d="M7 16h3" />
        <path d="M14 16h3" />
      </svg>
    );
  }
  
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
      <path d="M18 7l3 3-2 2-1-2v12H6V10l-1 2-2-2 3-3" />
      <path d="M8 7c0 2 1.5 3 4 3s4-1 4-3" />
    </svg>
  );
};

export default function ClientFacingPO() {
  const params = useParams();
  const router = useRouter();
  const [quote, setQuote] = useState<any>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState(1122); 

  const [isLightMode, setIsLightMode] = useState<boolean>(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    if (savedTheme === 'light') setIsLightMode(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isLightMode;
    setIsLightMode(newTheme);
    localStorage.setItem('yaya-theme', newTheme ? 'light' : 'dark');
  };

  useEffect(() => {
    if (!params?.id) return;

    async function fetchQuote() {
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          customers (*),
          jobs (job_number),
          quote_items (
            *,
            quote_item_variants (*)
          )
        `)
        .eq("id", params.id)
        .single();
      
      if (data) setQuote(data);
      if (error) console.error("PO Fetch Error:", error);
    }
    
    fetchQuote();
  }, [params]);

  useEffect(() => {
    const updateScale = () => {
      if (typeof window !== 'undefined') {
        const screenWidth = window.innerWidth;
        if (screenWidth < 820) {
          setScale((screenWidth - 20) / 794);
        } else {
          setScale(1);
        }
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setCanvasHeight(entry.contentRect.height);
      }
    });
    
    if (canvasRef.current) {
      observer.observe(canvasRef.current);
      setCanvasHeight(canvasRef.current.offsetHeight);
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      observer.disconnect();
    };
  }, [quote]);

  if (!quote) return <div className="p-10 text-white bg-slate-950 flex justify-center items-center h-screen font-black uppercase tracking-widest">Loading Purchase Order...</div>;

  const subtotal = quote.total_amount;
  const tax = subtotal * 0.13; 
  const grandTotal = subtotal + tax;

  const totalSavings = quote.quote_items?.reduce((itemSum: number, item: any) => {
    return itemSum + item.quote_item_variants?.reduce((vSum: number, v: any) => {
      const qty = (v.xs || 0) + (v.s || 0) + (v.m || 0) + (v.l || 0) + (v.xl || 0) + (v.xxl || 0) + (v.xxxl || 0) + (v.xxxxl || 0) + (v.xxxxxl || 0);
      const savingsPerUnit = Math.max(0, (v.regular_price || 0) - (v.unit_price || 0));
      return vSum + (savingsPerUnit * qty);
    }, 0);
  }, 0) || 0;

  const handlePrint = () => {
    const originalTitle = document.title;
    const companyName = quote.customers?.company_name 
      ? quote.customers.company_name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() 
      : "CLIENT";
    const referenceNum = quote.jobs?.[0]?.job_number || "TBD";
    document.title = `${companyName}_PO_${referenceNum}`;
    window.print();
    document.title = originalTitle;
  };

  const theme = {
    bgMain: isLightMode ? "bg-slate-100" : "bg-[#0f1115]",
    bgPanel: isLightMode ? "bg-white" : "bg-slate-900",
    border: isLightMode ? "border-slate-200" : "border-slate-800",
    textMuted: isLightMode ? "text-slate-500" : "text-slate-400",
  };

  return (
    <div className={`min-h-screen ${theme.bgMain} py-6 md:py-10 flex flex-col items-center font-sans text-slate-900 print:bg-white print:py-0 px-2 md:px-0 overflow-x-hidden transition-colors duration-300`}>
      
      <style jsx global>{`
        @media print {
          nav, header, footer, .print-hidden { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
          body { background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0 !important; padding: 0 !important; }
          .min-h-screen { padding: 0 !important; margin: 0 !important; background: white !important; }
          .invoice-canvas { transform: none !important; width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; margin: 0 !important; page-break-after: always; }
          ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* COMMAND BAR (CLEANED FOR CLIENT) */}
      <div className="w-full max-w-[210mm] mb-4 flex flex-col gap-3 print:hidden px-2 sm:px-0 mt-4">
        <div className="w-full flex justify-between items-center mb-2">
            <button onClick={() => router.back()} className={`text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] transition ${isLightMode ? 'hover:text-slate-900' : 'hover:text-white'}`}>
              ← Return to Portal
            </button>
            <div className="flex gap-2">
              <button 
                onClick={toggleTheme}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all border shadow-sm ${
                  isLightMode 
                    ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50' 
                    : 'bg-black border-slate-700 text-white hover:bg-slate-800'
                }`}
              >
                {isLightMode ? 'Dark Mode' : 'Light Mode'}
              </button>
              <button onClick={handlePrint} className="bg-emerald-600 text-white px-6 py-2.5 rounded-full font-black uppercase text-[9px] tracking-widest shadow-xl hover:scale-105 transition-all hover:bg-emerald-500 border border-emerald-500">
                Download PDF
              </button>
            </div>
        </div>
      </div>

      {/* DYNAMIC SCALING WRAPPER FOR MOBILE */}
      <div className="w-full flex justify-center pb-8 print:pb-0 overflow-hidden print:overflow-visible origin-top print:!scale-100 print:!transform-none">
        <div className="print:!h-auto print:!block flex justify-center w-full origin-top print:!scale-100 print:!transform-none" style={{ height: scale < 1 ? `${canvasHeight * scale}px` : 'auto' }}>
          <div 
            ref={canvasRef}
            className="invoice-canvas bg-white p-[15mm] shadow-[0_40px_80px_rgba(0,0,0,0.4)] print:shadow-none relative flex flex-col border-t-[12px] border-black origin-top print:!scale-100 print:!transform-none print:!m-0"
            style={{ width: '210mm', minHeight: '297mm', transform: scale < 1 ? `scale(${scale})` : 'none' }}
          >
            
            {/* HEADER BLOCK */}
            <div className="flex justify-between items-start mb-10">
              <div>
                <h1 className="text-[54px] font-black uppercase tracking-tighter leading-[0.8] text-black italic">YAYA<br/><span className="text-[#686a6c] opacity-30 not-italic">SPORTS</span></h1>
                <p className="text-[8px] font-black uppercase tracking-[0.5em] mt-4 text-[#686a6c]">Custom Production House</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <h2 className="bg-black text-white px-4 py-1.5 text-xl font-black uppercase tracking-tighter mb-2 italic shadow-sm">PURCHASE ORDER #{quote.jobs?.[0]?.job_number || "TBD"}</h2>
                <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 border shadow-sm border-emerald-500 text-emerald-600 bg-emerald-50`}>
                  STATUS: APPROVED
                </div>
              </div>
            </div>

            {/* INFO BLOCK */}
            <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-4">
              <div className="space-y-0.5">
                <div className="text-[8px] font-black text-[#686a6c] uppercase tracking-[0.4em] mb-1">Purchaser</div>
                <div className="text-xl font-black uppercase text-black tracking-tighter leading-none">{quote.customers?.company_name}</div>
                <div className="text-[10px] font-bold text-sky-600 lowercase tracking-tight pt-0.5">{quote.customers?.email}</div>
              </div>
              
              <div className="text-right space-y-1">
                <div className="text-[9px] font-black text-black">
                  <span className="uppercase tracking-[0.3em] mr-3 text-[#686a6c]">Order Date</span> 
                  {new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                </div>
                <div className="text-[9px] font-black text-black">
                  <span className="uppercase tracking-[0.3em] mr-3 text-[#686a6c]">Terms</span> 
                  C.O.D. / E-TRANSFER
                </div>
              </div>
            </div>

           {/* LINE ITEMS TABLE */}
            <div className="flex-grow">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b-2 border-black font-black text-black uppercase tracking-widest text-[8px] bg-slate-50/80">
                    <th className="py-2.5 w-[26%] pl-2">Description</th>
                    <th className="py-2.5 w-[5%] text-center">Qty</th>
                    <th className="py-2.5 w-[9%]">Color</th>
                    <th className="py-2.5 w-[4%] text-center border-x border-white bg-slate-100/50">XS</th>
                    <th className="py-2.5 w-[4%] text-center border-x border-white">S</th>
                    <th className="py-2.5 w-[4%] text-center border-x border-white">M</th>
                    <th className="py-2.5 w-[4%] text-center border-x border-white">L</th>
                    <th className="py-2.5 w-[4%] text-center border-x border-white">XL</th>
                    <th className="py-2.5 w-[4%] text-center border-x border-white bg-slate-100/50">2X</th>
                    <th className="py-2.5 w-[4%] text-center border-x border-white bg-slate-100/50">3X</th>
                    <th className="py-2.5 w-[4%] text-center border-x border-white bg-slate-100/50">4X</th>
                    <th className="py-2.5 w-[4%] text-center border-x border-white bg-slate-100/50">5X</th>
                    <th className="py-2.5 w-[8%] text-right pr-2">PRICE</th>
                    <th className="py-2.5 w-[8%] text-right pr-2">SPECIAL</th>
                    <th className="py-2.5 w-[8%] text-right pr-2">Total</th>
                  </tr>
                </thead>
                <tbody className="font-bold text-black uppercase text-[9px]">
                  {quote.quote_items?.map((item: any) => {
                    const firstVisibleIdx = item.quote_item_variants?.findIndex((v: any) => 
                      ((v.xs || 0) + (v.s || 0) + (v.m || 0) + (v.l || 0) + (v.xl || 0) + (v.xxl || 0) + (v.xxxl || 0) + (v.xxxxl || 0) + (v.xxxxxl || 0)) > 0
                    );

                    return item.quote_item_variants?.map((v: any, vIdx: number) => {
                      const qty = (v.xs || 0) + (v.s || 0) + (v.m || 0) + (v.l || 0) + (v.xl || 0) + (v.xxl || 0) + (v.xxxl || 0) + (v.xxxxl || 0) + (v.xxxxxl || 0);
                      if (qty === 0) return null;
                      
                      const itemColorHex = getColorHex(v.color);
                      
                      return (
                        <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-1.5 pl-2 font-black tracking-tight align-middle">
                            <div className="flex items-center">
                              <div className="shrink-0 flex items-center justify-center">
                                {vIdx === firstVisibleIdx ? renderGarmentIcon(item.description, itemColorHex) : <span className="w-5 mr-2 block"></span>}
                              </div>
                              <div className="whitespace-normal break-words leading-[1.1] pr-2 w-full">
                                {vIdx === firstVisibleIdx ? item.description : ""}
                              </div>
                            </div>
                          </td>
                          <td className="py-1.5 text-center font-black bg-slate-50/50 align-middle">{qty}</td>
                          <td className="py-1.5 font-black whitespace-normal break-words pr-1 align-middle" style={{ color: itemColorHex }}>
                            {v.color || 'STANDARD'}
                          </td>
                          <td className={`py-1.5 text-center align-middle ${v.xs === 0 ? 'text-slate-200 font-light' : 'text-black'}`}>{v.xs || '-'}</td>
                          <td className={`py-1.5 text-center align-middle ${v.s === 0 ? 'text-slate-200 font-light' : 'text-black'}`}>{v.s || '-'}</td>
                          <td className={`py-1.5 text-center align-middle ${v.m === 0 ? 'text-slate-200 font-light' : 'text-black'}`}>{v.m || '-'}</td>
                          <td className={`py-1.5 text-center align-middle ${v.l === 0 ? 'text-slate-200 font-light' : 'text-black'}`}>{v.l || '-'}</td>
                          <td className={`py-1.5 text-center align-middle ${v.xl === 0 ? 'text-slate-200 font-light' : 'text-black'}`}>{v.xl || '-'}</td>
                          <td className={`py-1.5 text-center bg-slate-50/50 align-middle ${v.xxl === 0 ? 'text-slate-200 font-light' : 'text-black'}`}>{v.xxl || '-'}</td>
                          <td className={`py-1.5 text-center bg-slate-50/50 align-middle ${v.xxxl === 0 ? 'text-slate-200 font-light' : 'text-black'}`}>{v.xxxl || '-'}</td>
                          <td className={`py-1.5 text-center bg-slate-50/50 align-middle ${v.xxxxl === 0 ? 'text-slate-200 font-light' : 'text-black'}`}>{v.xxxxl || '-'}</td>
                          <td className={`py-1.5 text-center bg-slate-50/50 align-middle ${v.xxxxxl === 0 ? 'text-slate-200 font-light' : 'text-black'}`}>{v.xxxxxl || '-'}</td>
                          
                          <td className="py-1.5 text-right pr-2 align-middle whitespace-nowrap">
                            {v.regular_price > v.unit_price && (
                              <span className="text-[8px] text-red-500 line-through tracking-tighter">${v.regular_price?.toFixed(2)}</span>
                            )}
                          </td>
                          
                          <td className="py-1.5 text-right pr-2 align-middle whitespace-nowrap">
                            <span className="text-sky-600 font-black">${v.unit_price?.toFixed(2)}</span>
                          </td>
                          
                          <td className="py-1.5 text-right font-black tracking-tighter pr-2 align-middle">
                            ${(qty * (v.unit_price || 0)).toFixed(2)}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>

            {/* BOTTOM SECTION */}
            <div className="flex justify-between items-start pt-6 border-t-[6px] border-black mt-auto">
              
              <div className="w-1/2 space-y-5">
                <div className="text-[9px] font-black text-black uppercase tracking-[0.1em] space-y-1">
                  <div className="text-sm tracking-tighter italic mb-1.5">YAYA SPORTS INCORPORATED</div>
                  <div className="text-slate-500">39 BRANCHWOOD ST</div>
                  <div className="text-slate-500">OTTAWA - ON. - K2B6X8</div>
                  <div className="text-slate-500">613-666-YAYA (9292)</div>
                  <div className="text-slate-500">GSH/HST#: 71925 3957 RT0001</div>
                </div>

                <p className="text-[8px] normal-case font-bold text-slate-400 leading-relaxed max-w-[320px] pt-4">
                  Thank you for choosing YAYA SPORTS. This document serves as your official order confirmation. All custom orders are final sale upon approval of artwork. Please refer to standard Terms & Conditions for full production details.
                </p>
              </div>

              {/* FINANCIALS PANEL */}
              <div className="w-[260px] bg-slate-50 p-5 border border-slate-200 rounded-lg shadow-sm">
                <div className="space-y-3 text-[10px] font-black text-black uppercase tracking-widest">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Sub-Total</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {totalSavings > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      <span>Discount</span>
                      <span>-${totalSavings.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-500 border-b border-slate-200 pb-3">
                    <span>HST (13%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-1 text-2xl tracking-tighter text-black leading-none pb-2">
                    <span>TOTAL</span>
                    <span>${grandTotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="pt-10 border-b border-slate-300 text-[7px] text-[#686a6c] pb-1 text-center tracking-[0.5em]">
                    AUTHORIZED BY YAYA SPORTS
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}