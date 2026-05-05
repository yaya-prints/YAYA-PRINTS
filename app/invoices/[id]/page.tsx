"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

// --- DYNAMIC COLOR ENGINE ---
const getColorHex = (colorName: string): string => {
  if (!colorName) return "#CD7F32"; // Standard Bronze for no color choice
  
  const lower = colorName.toLowerCase().trim();
  
  const colorMap: { [key: string]: string } = {
    black: "#0f1115",
    white: "#94a3b8", // Solution for white: Slate Silver for visibility on white paper
    navy: "#1e3a8a",
    red: "#dc2626",
    royal: "#2563eb",
    "royal blue": "#2563eb",
    grey: "#6b7280",
    gray: "#6b7280",
    "heather grey": "#9ca3af",
    "sport grey": "#9ca3af",
    charcoal: "#3f3f46",
    "nardo grey": "#686a6c",
    green: "#16a34a",
    "kelly green": "#16a34a",
    "forest green": "#14532d",
    yellow: "#ca8a04", // Darker mustard yellow for readability
    gold: "#b45309",
    orange: "#ea580c",
    purple: "#7e22ce",
    pink: "#db2777",
    maroon: "#7f1d1d",
    burgundy: "#7f1d1d",
    brown: "#78350f",
    tan: "#d2b48c",
    sand: "#d2b48c",
    cream: "#d1d5db",
    teal: "#0d9488",
    cyan: "#0891b2",
    blue: "#3b82f6",
    olive: "#4d7c0f"
  };

  // Exact Match
  if (colorMap[lower]) return colorMap[lower];
  
  // Partial Match (e.g. "Heather Navy" -> Navy)
  for (const key in colorMap) {
    if (lower.includes(key)) return colorMap[key];
  }

  return "#CD7F32"; // Standard Bronze fallback
};

// --- DYNAMIC GARMENT ICONS ---
const renderGarmentIcon = (description: string, colorHex: string): ReactNode => {
  if (!description) return <span className="w-5 h-5 mr-2 shrink-0"></span>;
  const desc = description.toLowerCase();
  const cls = "w-5 h-5 mr-2 shrink-0 mt-0.5";
  const stroke = colorHex || "#475569";

  // ── APPAREL ───────────────────────────────────────────────────────────────
  if (desc.includes("hoodie") || desc.includes("hooded") || desc.includes("sweatshirt")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M7 4l-4 3 2 5 2-1v10h10V11l2 1 2-5-4-3"/>
        <path d="M7 4c0-.5 2-2 5-2s5 1.5 5 2v3a5 5 0 0 1-10 0V4z"/>
        <path d="M10 14h4"/>
      </svg>
    );
  }
  if (desc.includes("polo") || desc.includes("collared")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M8 3l-5 3 2 4 3-1v12h12V9l3 1 2-4-5-3-3 2"/>
        <path d="M10 3l2 3 2-3"/>
        <path d="M11 6v5"/>
      </svg>
    );
  }
  if (desc.includes("hat") || desc.includes("cap") || desc.includes("beanie") || desc.includes("snapback") || desc.includes("trucker")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M3 16c0-5 4-9 9-9s9 4 9 9"/>
        <path d="M2 16h20v2H2z"/>
        <circle cx="12" cy="10" r="1"/>
      </svg>
    );
  }
  if (desc.includes("long sleeve") || desc.includes("longsleeve") || desc.includes("long-sleeve")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M6 4l-3 4 1 8 2-1v9h12v-9l2 1 1-8-3-4"/>
        <path d="M9 4l3 3 3-3"/>
      </svg>
    );
  }
  if (desc.includes("jacket") || desc.includes("zip-up") || desc.includes("windbreaker")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M7 4l-4 3 2 5 2-1v12h10V11l2 1 2-5-4-3"/>
        <path d="M9 4l3 3 3-3"/>
        <path d="M12 7v15"/>
      </svg>
    );
  }
  if (desc.includes("tank top") || desc.includes("tank")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M9 3l-3 3-1 4 3 1v11h8V11l3-1-1-4-3-3"/>
        <path d="M9 3c0 2 1.5 3 3 3s3-1 3-3"/>
      </svg>
    );
  }
  if (desc.includes("t-shirt") || desc.includes("tshirt") || desc.includes("tee") || desc.includes("shirt")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M8 3l-5 3 2 4 3-1v12h12V9l3 1 2-4-5-3-3 2c-.7.6-1.7 1-3 1s-2.3-.4-3-1L8 3z"/>
      </svg>
    );
  }

  // ── PRINT MEDIA ───────────────────────────────────────────────────────────
  if (desc.includes("business card") || desc.includes("biz card")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <rect x="3" y="6" width="18" height="12" rx="2"/>
        <path d="M3 10h18"/>
        <path d="M7 14h4"/>
      </svg>
    );
  }
  if (desc.includes("postcard")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <rect x="3" y="5" width="18" height="14" rx="2"/>
        <path d="M14 9h4M14 12h4M14 15h3"/>
        <rect x="6" y="9" width="5" height="6" rx="1"/>
      </svg>
    );
  }
  if (desc.includes("flyer") || desc.includes("brochure") || desc.includes("a5") || desc.includes("a4") || desc.includes("letter") || desc.includes("rack card")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M6 3h9l4 4v14H6z"/>
        <path d="M15 3v4h4"/>
        <path d="M9 12h7M9 15h7M9 18h4"/>
      </svg>
    );
  }
  if (desc.includes("poster")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <rect x="5" y="3" width="14" height="18" rx="1"/>
        <path d="M8 8h8M8 12h8M8 16h5"/>
      </svg>
    );
  }
  if (desc.includes("banner") || desc.includes("vinyl banner") || desc.includes("backdrop")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <rect x="2" y="7" width="20" height="10" rx="1"/>
        <circle cx="4.5" cy="9.5" r=".7" fill={stroke}/>
        <circle cx="19.5" cy="9.5" r=".7" fill={stroke}/>
        <circle cx="4.5" cy="14.5" r=".7" fill={stroke}/>
        <circle cx="19.5" cy="14.5" r=".7" fill={stroke}/>
        <path d="M7 12h10"/>
      </svg>
    );
  }
  if (desc.includes("sticker") || desc.includes("decal") || desc.includes("die-cut") || desc.includes("kiss-cut")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <circle cx="12" cy="12" r="9" strokeDasharray="2 2"/>
        <circle cx="12" cy="12" r="6"/>
      </svg>
    );
  }
  if (desc.includes("yard sign") || desc.includes("lawn sign") || desc.includes("coroplast")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <rect x="4" y="4" width="16" height="11" rx="1"/>
        <path d="M9 15v6M15 15v6"/>
        <path d="M7 8h10M7 11h6"/>
      </svg>
    );
  }
  if (desc.includes("magnet") || desc.includes("car magnet") || desc.includes("fridge magnet")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M5 4v8a7 7 0 0 0 14 0V4"/>
        <path d="M5 4h4v6H5z"/>
        <path d="M15 4h4v6h-4z"/>
      </svg>
    );
  }
  if (desc.includes("label") || desc.includes("roll label")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M20 12L13 5H4v9l7 7z"/>
        <circle cx="8" cy="9" r="1.5"/>
      </svg>
    );
  }
  if (desc.includes("bookmark")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M7 3h10v18l-5-4-5 4z"/>
      </svg>
    );
  }
  if (desc.includes("dtf") || desc.includes("dtg") || desc.includes("transfer") || desc.includes("heat press") || desc.includes("htv") || desc.includes("vinyl")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <rect x="3" y="4" width="18" height="14" rx="2"/>
        <path d="M3 18l4-4 3 3 4-5 7 6"/>
        <circle cx="8" cy="9" r="1"/>
      </svg>
    );
  }
  if (desc.includes("print") || desc.includes("custom print")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
        <path d="M6 3h12v6H6zM6 18v3h12v-3"/>
        <path d="M3 9h18v9h-3v-2H6v2H3z"/>
        <circle cx="17" cy="12" r=".5" fill={stroke}/>
      </svg>
    );
  }

  // ── NEUTRAL FALLBACK ──────────────────────────────────────────────────────
  // Generic package box. NEVER a t-shirt — that was the old bug.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cls}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z"/>
      <path d="M3 8v8l9 5 9-5V8"/>
      <path d="M12 13v8"/>
    </svg>
  );
};


export default function ProfessionalPrintableInvoice() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState(1122); 

  // --- THEME STATE ---
  const [isLightMode, setIsLightMode] = useState<boolean>(false);

  // --- REVIEW LINK ---
  const GOOGLE_REVIEW_LINK = "https://www.google.com/search?newwindow=1&sca_esv=5cb8f0632b7ab272&sxsrf=ANbL-n7iNlUbBZjUa4TM12siOcgLb-C_Mw%3A1776024637339&q=YAYA%20PRINTS%20-%20T-SHIRT%20PRINTING%20%26%20EMBROIDERY&stick=H4sIAAAAAAAAAONgU1I1qLAwM0kzMTFJM08xMjAzTkyzMqiwNDNOSzU2MrRIsUhKNk9JW8SqHekY6agQEOTpFxKsoKsQohvs4RkUAhHw9HNXUFNw9XUK8vd0cQ2KBAA4tNCKVwAAAA&mat=CdZMizuI6cWP&ved=2ahUKEwjYwPusj-mTAxW9ETQIHeusILwQrMcEegQILRAC&sei=S_zbaYz0EJ7vruEP97bcmQ4#lrd=0x864f444f7d2063af:0x963fe3218d8bc7df,3,,,,";

  // --- THEME CHECK ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    if (savedTheme === 'light') setIsLightMode(true);
  }, []);

  // --- THEME TOGGLE FUNCTION ---
  const toggleTheme = () => {
    const newTheme = !isLightMode;
    setIsLightMode(newTheme);
    localStorage.setItem('yaya-theme', newTheme ? 'light' : 'dark');
  };

  useEffect(() => {
    if (!params?.id) return;

    async function fetchInvoice() {
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
      
      if (data) setInvoice(data);
      if (error) console.error("Invoice Fetch Error:", error);
    }
    
    fetchInvoice();
  }, [params]);

  // Perfect A4 Mobile Scaler
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
  }, [invoice]);

  if (!invoice) return <div className="p-10 text-white bg-slate-950 flex justify-center items-center h-screen font-black uppercase tracking-widest">Loading Professional Invoice...</div>;

  // Invoice Math
  const totalSavings = invoice.quote_items?.reduce((itemSum: number, item: any) => {
    const hasVariants = item.quote_item_variants && item.quote_item_variants.length > 0;
    if (hasVariants) {
      return itemSum + item.quote_item_variants.reduce((vSum: number, v: any) => {
        const qty = (v.xs || 0) + (v.s || 0) + (v.m || 0) + (v.l || 0) + (v.xl || 0) + (v.xxl || 0) + (v.xxxl || 0) + (v.xxxxl || 0) + (v.xxxxxl || 0);
        const savingsPerUnit = Math.max(0, (v.regular_price || 0) - (v.unit_price || 0));
        return vSum + (savingsPerUnit * qty);
      }, 0);
    } else {
      const savingsPerUnit = Math.max(0, (item.regular_price || 0) - (item.unit_price || 0));
      return itemSum + (savingsPerUnit * (item.quantity || 0));
    }
  }, 0) || 0;

  const subtotal = (invoice.total_amount || 0) + totalSavings;
  const tax = (invoice.total_amount || 0) * 0.13; 
  const grandTotal = (invoice.total_amount || 0) + tax;
  const amountPaid = invoice.amount_paid || 0;
  const balanceDue = grandTotal - amountPaid;

  // --- DYNAMIC PDF FILENAME FIX ---
  const handlePrint = () => {
    const originalTitle = document.title;
    
    const companyName = invoice.customers?.company_name 
      ? invoice.customers.company_name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() 
      : "CLIENT";
      
    const referenceNum = invoice.jobs?.[0]?.job_number || "TBD";
    
    document.title = `${companyName}_INVOICE_${referenceNum}`;
    
    window.print();
    
    document.title = originalTitle;
  };
  
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  // --- SHARE OPTIONS ---
  const sendInvoiceWA = () => {
    const cleanPhone = invoice.customers?.phone?.replace(/\D/g, '');
    if (!cleanPhone) return alert("No phone number found for this customer.");
    const text = encodeURIComponent(`Hi ${invoice.customers?.contact_name || 'there'}, here is your digital invoice from YAYA SPORTS:\n\n${shareUrl}`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const sendInvoiceEmail = () => {
    const subject = encodeURIComponent(`Invoice from YAYA SPORTS - Ref: ${invoice.jobs?.[0]?.job_number || 'OFFLINE'}`);
    const body = encodeURIComponent(`Hi ${invoice.customers?.contact_name || 'there'},\n\nPlease find your secure digital invoice link here:\n\n${shareUrl}\n\nThank you for choosing YAYA SPORTS!`);
    window.location.href = `mailto:${invoice.customers?.email}?subject=${subject}&body=${body}`;
  };

  const sendPaymentRequestWA = () => {
    const cleanPhone = invoice.customers?.phone?.replace(/\D/g, '');
    if (!cleanPhone) return alert("No phone number found for this customer.");
    const text = encodeURIComponent(`🔔 *PAYMENT REQUEST* 🔔\n\nHi ${invoice.customers?.contact_name || 'there'},\n\n*YAYA SPORTS INC.* has requested *$${balanceDue.toFixed(2)} CAD* for Invoice #${invoice.jobs?.[0]?.job_number || "TBD"}.\n\nTo pay this invoice securely with 0% fees:\n1. Open your banking app\n2. Send Interac e-Transfer to: *info@yayasports.ca*\n3. Required Memo: *Invoice #${invoice.jobs?.[0]?.job_number || "TBD"}*\n\nView your full digital invoice here:\n${shareUrl}\n\nThank you for choosing YAYA SPORTS!`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const sendPaymentRequestEmail = () => {
    const subject = encodeURIComponent(`Payment Request from YAYA SPORTS - Invoice #${invoice.jobs?.[0]?.job_number || "TBD"}`);
    const body = encodeURIComponent(`PAYMENT REQUEST\n\nHi ${invoice.customers?.contact_name || 'there'},\n\nYAYA SPORTS INC. has requested $${balanceDue.toFixed(2)} CAD for Invoice #${invoice.jobs?.[0]?.job_number || "TBD"}.\n\nTo pay this invoice securely with 0% fees:\n1. Send an Interac e-Transfer to: info@yayasports.ca\n2. Include the memo: Invoice #${invoice.jobs?.[0]?.job_number || "TBD"}\n\nYou can view your full digital invoice here:\n${shareUrl}\n\nThank you for choosing YAYA SPORTS!`);
    window.location.href = `mailto:${invoice.customers?.email}?subject=${subject}&body=${body}`;
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    alert(`${type} copied to clipboard!`);
  };

  // --- THEME CLASSES ---
  const theme = {
    bgMain: isLightMode ? "bg-slate-100" : "bg-[#0f1115]",
    bgPanel: isLightMode ? "bg-white" : "bg-slate-900",
    border: isLightMode ? "border-slate-200" : "border-slate-800",
    textMuted: isLightMode ? "text-slate-500" : "text-slate-400",
    btnPrimaryBg: isLightMode ? "bg-slate-100 hover:bg-slate-200" : "bg-slate-800 hover:bg-slate-700",
    btnPrimaryText: isLightMode ? "text-slate-800" : "text-white",
    btnSecondary: isLightMode ? "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700" : "bg-white/10 hover:bg-white/20 text-white",
    reqMoneyBg: isLightMode ? "bg-red-50 border-red-200" : "bg-[#1a0f0f] border-red-900/30",
    reqMoneyText: isLightMode ? "text-red-600" : "text-red-400",
  };

  return (
    <div className={`min-h-screen ${theme.bgMain} py-6 md:py-10 flex flex-col items-center font-sans text-slate-900 print:bg-white print:py-0 px-2 md:px-0 overflow-x-hidden transition-colors duration-300`}>
      
      <style jsx global>{`
        @media print {
          nav, header, footer, .print-hidden { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
          body { background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
          .min-h-screen { min-height: auto !important; padding: 0 !important; margin: 0 !important; background: white !important; }
          .invoice-canvas { transform: none !important; width: 210mm !important; height: 297mm !important; max-height: 297mm !important; box-shadow: none !important; margin: 0 !important; overflow: hidden !important; }
          ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* COMMAND BAR */}
      <div className="w-full max-w-[210mm] mb-8 flex flex-col gap-3 print:hidden px-2 sm:px-0 mt-4">
        
        <div className="w-full flex justify-between items-center mb-2">
            <button onClick={() => router.back()} className={`text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] transition ${isLightMode ? 'hover:text-slate-900' : 'hover:text-white'}`}>
              ← Return to Dashboard
            </button>
            <div className="flex gap-2">
              {/* THEME TOGGLE BUTTON */}
              <button 
                onClick={toggleTheme}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all border shadow-sm ${
                  isLightMode 
                    ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50' 
                    : 'bg-black border-slate-700 text-white hover:bg-slate-800'
                }`}
              >
                {isLightMode ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                    Dark
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    Light
                  </>
                )}
              </button>
              <button onClick={handlePrint} className="bg-emerald-600 text-white px-6 py-2.5 rounded-full font-black uppercase text-[9px] tracking-widest shadow-xl hover:scale-105 transition-all hover:bg-emerald-500 border border-emerald-500">
                Export PDF
              </button>
            </div>
        </div>

        <div className={`w-full ${theme.bgPanel} p-3 rounded-xl border ${theme.border} shadow-2xl flex flex-col sm:flex-row items-center gap-3 transition-colors`}>
          <div className={`${theme.textMuted} text-[10px] font-black uppercase tracking-widest w-full sm:w-[130px] shrink-0 text-center sm:text-left`}>
            Share Invoice:
          </div>
          <button onClick={sendInvoiceWA} className={`w-full flex-1 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${theme.btnPrimaryBg} ${theme.btnPrimaryText}`}>
            WhatsApp
          </button>
          <button onClick={sendInvoiceEmail} className={`w-full flex-1 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${theme.btnPrimaryBg} ${theme.btnPrimaryText}`}>
            Email
          </button>
          <button onClick={() => copyToClipboard(shareUrl, 'Invoice Link')} className={`w-full flex-1 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${theme.btnSecondary}`}>
            Copy Link
          </button>
        </div>

        {balanceDue > 0.01 && (
          <div className={`w-full ${theme.reqMoneyBg} p-3 rounded-xl border shadow-2xl flex flex-col sm:flex-row items-center gap-3 transition-colors`}>
            <div className={`${theme.reqMoneyText} text-[10px] font-black uppercase tracking-widest flex items-center justify-center sm:justify-start w-full sm:w-[130px] shrink-0`}>
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              Request Money:
            </div>
            <button onClick={sendPaymentRequestWA} className="w-full flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all shadow-md">
              Via WhatsApp
            </button>
            <button onClick={sendPaymentRequestEmail} className="w-full flex-1 bg-sky-600 hover:bg-sky-500 text-white py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all shadow-md">
              Via Email
            </button>
          </div>
        )}
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
              <div className="text-right flex flex-col items-end gap-1.5">
                <h2 className="bg-black text-white px-5 py-1.5 text-xl font-black uppercase tracking-tighter italic shadow-sm rounded-sm">Invoice #{invoice.jobs?.[0]?.job_number || "TBD"}</h2>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-sm shadow-sm border border-sky-400 text-sky-600 bg-sky-50">
                  REF: {invoice.id?.split('-')[0]?.toUpperCase()}
                </div>
                <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-sm border shadow-sm ${balanceDue <= 0.01 ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-amber-400 text-amber-700 bg-amber-50'}`}>
                  {balanceDue <= 0.01 ? '✓ STATUS: PAID' : '⚠ STATUS: UNPAID'}
                </div>
              </div>
            </div>

            {/* INFO BLOCK */}
            <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-4">
              <div className="space-y-0.5">
                <div className="text-[8px] font-black text-[#686a6c] uppercase tracking-[0.4em] mb-1">Recipient</div>
                <div className="text-xl font-black uppercase text-black tracking-tighter leading-none">{invoice.customers?.company_name}</div>
                <div className="text-[10px] font-bold text-sky-600 lowercase tracking-tight pt-0.5">{invoice.customers?.email}</div>
              </div>
              
              <div className="text-right space-y-1">
                <div className="text-[9px] font-black text-black">
                  <span className="uppercase tracking-[0.3em] mr-3 text-[#686a6c]">Issue Date</span> 
                  {new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
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
                    <th className="py-2.5 w-[4%] text-center bg-slate-100/60">XS</th>
                    <th className="py-2.5 w-[4%] text-center">S</th>
                    <th className="py-2.5 w-[4%] text-center bg-slate-100/60">M</th>
                    <th className="py-2.5 w-[4%] text-center">L</th>
                    <th className="py-2.5 w-[4%] text-center bg-slate-100/60">XL</th>
                    <th className="py-2.5 w-[4%] text-center">2X</th>
                    <th className="py-2.5 w-[4%] text-center bg-slate-100/60">3X</th>
                    <th className="py-2.5 w-[4%] text-center">4X</th>
                    <th className="py-2.5 w-[4%] text-center bg-slate-100/60">5X</th>
                    <th className="py-2.5 w-[8%] text-right pr-2">Price</th>
                    <th className="py-2.5 w-[8%] text-right pr-2">Special</th>
                    <th className="py-2.5 w-[8%] text-right pr-2">Total</th>
                  </tr>
                </thead>
                <tbody className="font-bold text-black uppercase text-[9px]">
                  {invoice.quote_items?.map((item: any) => {
                    // CHECK FOR PRINT MEDIA / GENERAL ITEMS
                    if (!item.quote_item_variants || item.quote_item_variants.length === 0) {
                      return (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-1.5 pl-2 font-black tracking-tight align-middle">
                            <div className="flex items-center">
                              <div className="shrink-0">
                                {renderGarmentIcon(item.description, "#475569")}
                              </div>
                              <div className="whitespace-normal break-words leading-[1.1] pr-2 w-full">
                                {item.description}
                              </div>
                            </div>
                          </td>
                          <td className="py-1.5 text-center font-black bg-slate-50/50 align-middle">{item.quantity}</td>
                          <td className="py-1.5 font-black whitespace-normal break-words pr-1 align-middle leading-[1.1]">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[8px] font-black uppercase tracking-widest">PRINT MEDIA</span>
                          </td>
                          <td colSpan={9} className="py-1.5 text-center text-[8px] text-slate-300 italic font-light tracking-widest align-middle">no size breakdown</td>
                          <td className="py-1.5 text-right pr-2 align-middle whitespace-nowrap">
                            {item.regular_price > item.unit_price && (
                              <span className="text-red-500 line-through font-black tracking-tighter">${((item.regular_price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-1.5 text-right pr-2 align-middle whitespace-nowrap">
                            <span className="text-sky-600 font-black tracking-tighter">${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}</span>
                          </td>
                          <td className="py-1.5 text-right font-black tracking-tighter pr-2 align-middle">
                            ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                          </td>
                        </tr>
                      );
                    }

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
                          <td className={`py-1.5 text-center bg-slate-50/60 align-middle ${v.xs === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xs || '·'}</td>
                          <td className={`py-1.5 text-center align-middle ${v.s === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.s || '·'}</td>
                          <td className={`py-1.5 text-center bg-slate-50/60 align-middle ${v.m === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.m || '·'}</td>
                          <td className={`py-1.5 text-center align-middle ${v.l === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.l || '·'}</td>
                          <td className={`py-1.5 text-center bg-slate-50/60 align-middle ${v.xl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xl || '·'}</td>
                          <td className={`py-1.5 text-center align-middle ${v.xxl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xxl || '·'}</td>
                          <td className={`py-1.5 text-center bg-slate-50/60 align-middle ${v.xxxl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xxxl || '·'}</td>
                          <td className={`py-1.5 text-center align-middle ${v.xxxxl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xxxxl || '·'}</td>
                          <td className={`py-1.5 text-center bg-slate-50/60 align-middle ${v.xxxxxl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xxxxxl || '·'}</td>
                          
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

                {/* INFO PAYMENT BOX FOR THE CLIENT TO SEE ON PDF/LINK */}
                {balanceDue > 0.01 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                      <div className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-3">0-Fee Payment Instructions</div>

                      <div className="flex items-center justify-between bg-white border border-slate-200 rounded p-2 mb-2 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Send E-Transfer To</span>
                          <span className="text-sm font-black text-red-600 tracking-tight">info@yayasports.ca</span>
                        </div>
                        <button onClick={() => copyToClipboard('info@yayasports.ca', 'Email')} className="print:hidden bg-slate-100 hover:bg-sky-100 text-sky-600 px-4 py-2 rounded text-[8px] font-black uppercase tracking-widest transition-colors border border-slate-200">
                          Copy
                        </button>
                      </div>

                      <div className="flex items-center justify-between bg-white border border-slate-200 rounded p-2 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">Required Memo / Message</span>
                          <span className="text-[11px] font-black text-sky-600 tracking-tight">{invoice.jobs?.[0]?.job_number || "TBD"}</span>
                        </div>
                        <button onClick={() => copyToClipboard(invoice.jobs?.[0]?.job_number || "TBD", 'Reference Code')} className="print:hidden bg-slate-100 hover:bg-sky-100 text-sky-600 px-4 py-2 rounded text-[8px] font-black uppercase tracking-widest transition-colors border border-slate-200">
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- ADDITIVE: DIGITAL GOOGLE REVIEW CTA (HIDDEN ON PRINT PDF) --- */}
                <div className="mt-4 pt-4 border-t border-slate-200 print:hidden">
                    <a href={GOOGLE_REVIEW_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-amber-50 hover:bg-amber-100 border border-amber-200 p-3 rounded-lg transition-colors cursor-pointer group shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-0.5 group-hover:text-amber-700">Love your custom gear?</span>
                            <span className="text-xs font-bold text-amber-800 tracking-tight">Leave us a 5-Star Review on Google</span>
                        </div>
                        <div className="text-2xl drop-shadow-sm group-hover:scale-110 transition-transform">⭐⭐⭐⭐⭐</div>
                    </a>
                </div>

                <p className="text-[8px] normal-case font-bold text-slate-400 leading-relaxed max-w-[320px] pt-2">
                  Thank you for choosing YAYA SPORTS. All custom orders are final sale upon approval of artwork. Please refer to standard Terms & Conditions for full production details.
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
                  
                  <div className="flex justify-between items-center pt-1 text-2xl tracking-tighter text-black leading-none">
                    <span>TOTAL</span>
                    <span>${grandTotal.toFixed(2)}</span>
                  </div>

                  {amountPaid > 0 && (
                    <div className="flex justify-between items-center pt-2 text-emerald-600 text-[9px] border-t border-emerald-100 mt-2">
                      <span>Payments Received</span>
                      <span>-${amountPaid.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center bg-[#e0f2fe] border border-[#bae6fd] p-4 mt-4 rounded-md shadow-inner">
                    <span className="text-[#0284c7] text-[8px] tracking-[0.2em] leading-tight">BALANCE<br/>DUE</span>
                    <span className="text-2xl text-[#0284c7] tracking-tighter leading-none italic">${balanceDue.toFixed(2)}</span>
                  </div>
                  
                  <div className="pt-10 border-b border-slate-300 text-[7px] text-[#686a6c] pb-1 text-center tracking-[0.5em]">
                    OFFICE SIGNATURE
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