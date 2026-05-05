"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter, useSearchParams } from "next/navigation";

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
  for (const key in colorMap) { if (lower.includes(key)) return colorMap[key]; }
  return "#CD7F32";
};

// --- DESCRIPTION PARSER: Splits "Tee (Double Sided)" into { name, sides } ---
const parseDescription = (raw: string): { name: string; sides: string | null } => {
  if (!raw) return { name: "", sides: null };
  const match = raw.match(/^(.*?)\s*\((Single Sided|Double Sided|Front Only|Back Only|Front \+ Back|Sleeves|All Over)\)\s*$/i);
  if (match) return { name: match[1].trim(), sides: match[2].trim() };
  return { name: raw, sides: null };
};

// --- DETECT IF AN ITEM IS NON-APPAREL (Print Media / Service / Misc) ---
const isGeneralItem = (item: any): boolean => {
  return !item.quote_item_variants || item.quote_item_variants.length === 0;
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

const QUOTE_VALIDITY_DAYS = 14;

export default function ProfessionalQuotePage() {
  const params = useParams();
  const router = useRouter();
  const [quote, setQuote] = useState<any>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState(1122);

  // --- NEW STATES ---
  const [includeHst, setIncludeHst] = useState(false); // OFF BY DEFAULT
  const [depositPct, setDepositPct] = useState(50);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [acceptanceStatus, setAcceptanceStatus] = useState<"pending" | "accepted" | "declined">("pending");
  const [signatureName, setSignatureName] = useState("");
  const [signatureDate, setSignatureDate] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // ── Payment state ────────────────────────────────────────────────────────
  // Stripe redirects back here with ?paid=true (success) or ?cancelled=true (abandon).
  // depositPaidAt mirrors the database column once the webhook confirms payment.
  const searchParams = useSearchParams();
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [depositPaidAt, setDepositPaidAt] = useState<string | null>(null);
  const [paymentBanner, setPaymentBanner] = useState<"success" | "cancelled" | null>(null);

  // ── Revival state ────────────────────────────────────────────────────────
  // When a quote is past its 14-day window, the customer can request revival.
  // We don't auto-revive — owner must approve via email link.
  const [showReviveModal, setShowReviveModal] = useState(false);
  const [reviveNote, setReviveNote] = useState("");
  const [isSubmittingRevive, setIsSubmittingRevive] = useState(false);
  const [revivalRequestedAt, setRevivalRequestedAt] = useState<string | null>(null);
  const [revivalBanner, setRevivalBanner] = useState<"submitted" | "revived" | "already_revived" | null>(null);

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
      if (error) console.error("Quote Fetch Error:", error);
    }

    fetchQuote();
  }, [params, paymentBanner]);

  // Mirror deposit_paid_at from the loaded quote into local state
  useEffect(() => {
    if (quote?.deposit_paid_at) setDepositPaidAt(quote.deposit_paid_at);
    if (quote?.revival_requested_at && !quote?.revival_approved_at) {
      setRevivalRequestedAt(quote.revival_requested_at);
    } else {
      setRevivalRequestedAt(null);
    }
  }, [quote]);

  // React to ?paid=true / ?cancelled=true / ?revived=true / ?revive=true on the URL
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get("paid") === "true") {
      setPaymentBanner("success");
      const t1 = setTimeout(() => setPaymentBanner("success"), 800);
      const t2 = setTimeout(() => setPaymentBanner("success"), 2500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (searchParams.get("cancelled") === "true") {
      setPaymentBanner("cancelled");
    }
    if (searchParams.get("revived") === "true") {
      setRevivalBanner("revived");
    }
    if (searchParams.get("already_revived") === "true") {
      setRevivalBanner("already_revived");
    }
    // ?revive=true → auto-open the revive modal (used in email links)
    if (searchParams.get("revive") === "true") {
      setShowReviveModal(true);
    }
  }, [searchParams]);

  // Submit revival request
  async function handleSubmitRevive() {
    if (!params?.id || isSubmittingRevive) return;
    setIsSubmittingRevive(true);
    try {
      const res = await fetch("/api/quotes/revive-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: String(params.id), note: reviveNote }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Could not submit. Please try again.");
        setIsSubmittingRevive(false);
        return;
      }
      setShowReviveModal(false);
      setIsSubmittingRevive(false);
      setRevivalBanner("submitted");
      setReviveNote("");
      // Trigger quote refresh so the "request submitted" state shows
      setRevivalRequestedAt(new Date().toISOString());
    } catch (err) {
      console.error("Revive request failed:", err);
      alert("Could not submit. Please try again.");
      setIsSubmittingRevive(false);
    }
  }

  // Kick off Stripe checkout
  async function handlePayDeposit() {
    if (!params?.id || isStartingPayment) return;
    setIsStartingPayment(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: String(params.id) }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        alert(json.error || "Could not start payment. Please try again.");
        setIsStartingPayment(false);
        return;
      }
      window.location.href = json.url;
    } catch (err) {
      console.error("Payment start failed:", err);
      alert("Could not start payment. Please try again.");
      setIsStartingPayment(false);
    }
  }

  // --- LOCAL PERSISTENCE FOR NOTES + ACCEPTANCE + HST ---
  useEffect(() => {
    if (!params?.id) return;
    const id = String(params.id);
    try {
      const savedNotes = localStorage.getItem(`quote-notes-${id}`);
      if (savedNotes) setNotes(savedNotes);
      const savedAcceptance = localStorage.getItem(`quote-acceptance-${id}`);
      if (savedAcceptance) {
        const parsed = JSON.parse(savedAcceptance);
        setAcceptanceStatus(parsed.status || "pending");
        setSignatureName(parsed.name || "");
        setSignatureDate(parsed.date || "");
      }
      const savedHst = localStorage.getItem(`quote-hst-${id}`);
      if (savedHst !== null) setIncludeHst(savedHst === "true");
    } catch (e) {
      console.error("LocalStorage read failed:", e);
    }
  }, [params]);

  useEffect(() => {
    if (!params?.id) return;
    try { localStorage.setItem(`quote-notes-${String(params.id)}`, notes); } catch {}
  }, [notes, params]);

  useEffect(() => {
    if (!params?.id) return;
    try { localStorage.setItem(`quote-hst-${String(params.id)}`, String(includeHst)); } catch {}
  }, [includeHst, params]);

  useEffect(() => {
    const updateScale = () => {
      if (typeof window !== 'undefined') {
        const screenWidth = window.innerWidth;
        if (screenWidth < 820) setScale((screenWidth - 20) / 794);
        else setScale(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) setCanvasHeight(entry.contentRect.height);
    });

    if (canvasRef.current) observer.observe(canvasRef.current);

    return () => {
      window.removeEventListener('resize', updateScale);
      observer.disconnect();
    };
  }, [quote]);

  if (!quote) return <div className="p-10 text-slate-900 dark:text-white bg-slate-100 dark:bg-[#0f1115] flex justify-center items-center h-screen font-black uppercase tracking-widest">Generating Quote...</div>;

  // --- FINANCIAL MATH ---
  const subtotal = quote.total_amount || 0;
  const tax = includeHst ? subtotal * 0.13 : 0;
  const grandTotal = subtotal + tax;
  const deposit = grandTotal * (depositPct / 100);

  const totalSavings = quote.quote_items?.reduce((itemSum: number, item: any) => {
    if (isGeneralItem(item)) return itemSum;
    return itemSum + (item.quote_item_variants?.reduce((vSum: number, v: any) => {
      const qty = (v.xs || 0) + (v.s || 0) + (v.m || 0) + (v.l || 0) + (v.xl || 0) + (v.xxl || 0) + (v.xxxl || 0) + (v.xxxxl || 0) + (v.xxxxxl || 0);
      const savingsPerUnit = Math.max(0, (v.regular_price || 0) - (v.unit_price || 0));
      return vSum + (savingsPerUnit * qty);
    }, 0) || 0);
  }, 0) || 0;

  // --- VALIDITY COUNTDOWN ---
  const createdAt = new Date(quote.created_at);
  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + QUOTE_VALIDITY_DAYS);
  const today = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / msPerDay);
  const isExpired = daysLeft <= 0;
  const isUrgent = !isExpired && daysLeft <= 3;

  // --- HANDLERS ---
  const handlePrint = () => {
    const originalTitle = document.title;
    const companyName = quote.customers?.company_name
      ? quote.customers.company_name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
      : "CLIENT";
    const referenceNum = quote.jobs?.[0]?.job_number || (quote.id ? quote.id.split('-')[0].toUpperCase() : "TBD");
    document.title = `${companyName}_QUOTE_${referenceNum}`;
    window.print();
    document.title = originalTitle;
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const sendEmail = () => {
    const subject = encodeURIComponent(`Quote from YAYA SPORTS — Ref: ${quote.id.split('-')[0].toUpperCase()}`);
    const body = encodeURIComponent(`Hi ${quote.customers?.contact_name || 'there'},\n\nPlease find your quote for your custom apparel project here:\n\n${shareUrl}\n\nThis quote is valid for ${QUOTE_VALIDITY_DAYS} days.\n\nThank you for choosing YAYA SPORTS!`);
    window.location.href = `mailto:${quote.customers?.email}?subject=${subject}&body=${body}`;
  };

  const sendWhatsApp = () => {
    const cleanPhone = quote.customers?.phone?.replace(/\D/g, '');
    if (!cleanPhone) return alert("No phone number found for this customer.");
    const text = encodeURIComponent(`Hi ${quote.customers?.contact_name || 'there'}, here is your quote from YAYA SPORTS:\n\n${shareUrl}`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    alert(`${type} copied to clipboard!`);
  };

  const handleAccept = () => {
    if (!signatureName.trim()) return alert("Please type your name to sign.");
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    setAcceptanceStatus("accepted");
    setSignatureDate(date);
    setShowSignatureModal(false);
    try {
      localStorage.setItem(`quote-acceptance-${String(params.id)}`, JSON.stringify({
        status: "accepted", name: signatureName, date
      }));
    } catch {}
  };

  const handleDecline = () => {
    if (!confirm("Are you sure you want to decline this quote?")) return;
    setAcceptanceStatus("declined");
    try {
      localStorage.setItem(`quote-acceptance-${String(params.id)}`, JSON.stringify({
        status: "declined", name: signatureName, date: new Date().toLocaleDateString()
      }));
    } catch {}
  };

  const resetAcceptance = () => {
    if (!confirm("Reset acceptance status?")) return;
    setAcceptanceStatus("pending");
    setSignatureName("");
    setSignatureDate("");
    try { localStorage.removeItem(`quote-acceptance-${String(params.id)}`); } catch {}
  };

  // --- BUILD FLAT LIST OF ROWS (apparel variants + general items mixed) ---
  type Row = {
    type: "apparel" | "general";
    item: any;
    variant?: any;
    isFirstVariant: boolean;
    qty: number;
    rowTotal: number;
    parsedName: string;
    sides: string | null;
  };

  const rows: Row[] = [];
  quote.quote_items?.forEach((item: any) => {
    const parsed = parseDescription(item.description || "");
    if (isGeneralItem(item)) {
      const qty = item.quantity || 0;
      const rowTotal = qty * (item.unit_price || 0);
      rows.push({
        type: "general",
        item,
        isFirstVariant: true,
        qty,
        rowTotal,
        parsedName: parsed.name,
        sides: parsed.sides,
      });
    } else {
      item.quote_item_variants?.forEach((v: any, vIdx: number) => {
        const qty = (v.xs || 0) + (v.s || 0) + (v.m || 0) + (v.l || 0) + (v.xl || 0) + (v.xxl || 0) + (v.xxxl || 0) + (v.xxxxl || 0) + (v.xxxxxl || 0);
        if (qty === 0) return;
        rows.push({
          type: "apparel",
          item,
          variant: v,
          isFirstVariant: vIdx === 0,
          qty,
          rowTotal: qty * (v.unit_price || 0),
          parsedName: parsed.name,
          sides: parsed.sides,
        });
      });
    }
  });

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0f1115] py-6 md:py-10 flex flex-col items-center font-sans text-slate-900 dark:text-slate-100 print:bg-white print:py-0 px-2 md:px-0 overflow-x-hidden">

      <style jsx global>{`
        @media print {
          nav, header, footer, .print-hidden { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
          body { background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0 !important; padding: 0 !important; }
          .min-h-screen { padding: 0 !important; margin: 0 !important; background: white !important; }
          .invoice-canvas { transform: none !important; width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; margin: 0 !important; }
          ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      {/* COMMAND BAR */}
      <div className="w-full max-w-[210mm] mb-6 flex flex-col gap-3 print:hidden px-2 sm:px-0 mt-4">

        <div className="w-full flex justify-between items-center mb-2 gap-2">
          <button onClick={() => router.back()} className="text-slate-500 text-[11px] sm:text-[10px] font-black uppercase tracking-widest sm:tracking-[0.4em] hover:text-slate-900 dark:hover:text-white transition min-h-[40px] flex items-center px-1 active:scale-95">
            ← <span className="hidden sm:inline">Return to Dashboard</span><span className="sm:hidden">Back</span>
          </button>
          <button onClick={handlePrint} className="bg-slate-900 dark:bg-white text-white dark:text-black px-5 sm:px-6 py-3 sm:py-2.5 rounded-full font-black uppercase text-[11px] sm:text-[9px] tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all min-h-[44px] sm:min-h-0">
            Export PDF
          </button>
        </div>

        {/* QUOTE CONTROL PANEL */}
        <div className="w-full bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-3">

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

            <label className="flex items-center gap-2 cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2.5 rounded-lg transition-all flex-1 sm:flex-none">
              <input type="checkbox" checked={includeHst} onChange={(e) => setIncludeHst(e.target.checked)} className="w-4 h-4 accent-sky-500" />
              <span className="text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-widest">Include HST (13%)</span>
            </label>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 rounded-lg flex-1 sm:flex-none">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Deposit %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={depositPct}
                onChange={(e) => setDepositPct(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-12 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center text-[11px] font-black rounded px-1 py-0.5 outline-none border border-slate-300 dark:border-slate-700 focus:border-sky-500"
              />
            </div>

            <button onClick={() => setShowNotes(!showNotes)} className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex-1 sm:flex-none ${showNotes ? 'bg-sky-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
              {showNotes ? 'Hide' : 'Show'} Notes / Terms
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-3 border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest sm:w-[100px] shrink-0 flex items-center">
              Share Quote:
            </div>
            <button onClick={sendWhatsApp} className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-3 sm:py-2.5 rounded-lg font-black uppercase text-[11px] sm:text-[9px] tracking-widest transition-all min-h-[44px] sm:min-h-0 active:scale-95">
              WhatsApp
            </button>
            <button onClick={sendEmail} className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-3 sm:py-2.5 rounded-lg font-black uppercase text-[11px] sm:text-[9px] tracking-widest transition-all min-h-[44px] sm:min-h-0 active:scale-95">
              Email
            </button>
            <button onClick={() => copyToClipboard(shareUrl, 'Quote Link')} className="flex-1 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-900 dark:text-white py-3 sm:py-2.5 rounded-lg font-black uppercase text-[11px] sm:text-[9px] tracking-widest transition-all min-h-[44px] sm:min-h-0 active:scale-95">
              Copy Link
            </button>
          </div>

          {showNotes && (
            <div className="border-t border-slate-800 pt-3">
              <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Notes / Custom Terms (saved on this device)</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="e.g. Artwork to be approved before production. Rush turnaround available for 15% surcharge..."
                className="w-full bg-slate-950 text-white text-[11px] font-medium rounded-lg p-3 outline-none border border-slate-800 focus:border-sky-500 resize-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* DYNAMIC SCALING WRAPPER FOR MOBILE */}
      <div className="w-full flex justify-center pb-8 print:pb-0 overflow-hidden print:overflow-visible origin-top">

        <div className="print:!h-auto print:!block flex justify-center w-full origin-top" style={{ height: scale < 1 ? `${canvasHeight * scale}px` : 'auto' }}>

          <div
            ref={canvasRef}
            className="invoice-canvas bg-white p-[15mm] shadow-[0_40px_80px_rgba(0,0,0,0.4)] print:shadow-none relative flex flex-col border-t-[12px] border-black origin-top"
            style={{ width: '210mm', minHeight: '297mm', transform: scale < 1 ? `scale(${scale})` : 'none' }}
          >

            {/* HEADER BLOCK */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-[54px] font-black uppercase tracking-tighter leading-[0.8] text-black italic">YAYA<br/><span className="text-[#686a6c] opacity-30 not-italic">SPORTS</span></h1>
                <p className="text-[8px] font-black uppercase tracking-[0.5em] mt-4 text-[#686a6c]">Custom Production House</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1.5">
                <h2 className="bg-black text-white px-5 py-1.5 text-xl font-black uppercase tracking-tighter italic shadow-sm rounded-sm">Quote</h2>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-sm shadow-sm border border-sky-400 text-sky-600 bg-sky-50">
                  REF: {quote.id.split('-')[0].toUpperCase()}
                </div>

                {/* VALIDITY BADGE */}
                <div className={`text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-sm border shadow-sm ${
                  isExpired ? 'border-red-400 text-red-600 bg-red-50'
                  : isUrgent ? 'border-amber-400 text-amber-700 bg-amber-50'
                  : 'border-emerald-400 text-emerald-600 bg-emerald-50'
                }`}>
                  {isExpired ? 'EXPIRED' : `VALID • ${daysLeft} DAY${daysLeft === 1 ? '' : 'S'} LEFT`}
                </div>

                {acceptanceStatus === "accepted" && (
                  <div className="text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-sm border-2 border-emerald-500 text-emerald-700 bg-emerald-50 shadow-sm">
                    ✓ ACCEPTED BY {signatureName.toUpperCase()}
                  </div>
                )}
                {depositPaidAt && (
                  <div className="text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-sm border-2 border-sky-500 text-sky-700 bg-sky-50 shadow-sm">
                    ✓ DEPOSIT PAID
                  </div>
                )}
                {acceptanceStatus === "declined" && (
                  <div className="text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-sm border-2 border-red-500 text-red-700 bg-red-50 shadow-sm">
                    ✗ DECLINED
                  </div>
                )}
              </div>
            </div>

            {/* INFO BLOCK */}
            <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-4">
              <div className="space-y-0.5">
                <div className="text-[8px] font-black text-[#686a6c] uppercase tracking-[0.4em] mb-1">Prepared For</div>
                <div className="text-xl font-black uppercase text-black tracking-tighter leading-none">{quote.customers?.company_name}</div>
                <div className="text-[10px] font-bold text-sky-600 lowercase tracking-tight pt-0.5">{quote.customers?.email}</div>
              </div>

              <div className="text-right space-y-1">
                <div className="text-[9px] font-black text-black">
                  <span className="uppercase tracking-[0.3em] mr-3 text-[#686a6c]">Date Issued</span>
                  {createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                </div>
                <div className="text-[9px] font-black text-black">
                  <span className="uppercase tracking-[0.3em] mr-3 text-[#686a6c]">Valid Until</span>
                  {expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
                </div>
                <div className="text-[9px] font-black text-black">
                  <span className="uppercase tracking-[0.3em] mr-3 text-[#686a6c]">Status</span>
                  {quote.status}
                </div>
              </div>
            </div>

            {/* LINE ITEMS TABLE */}
            <div className="flex-grow">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b-2 border-black font-black text-black uppercase tracking-widest text-[8px] bg-slate-50/80">
                    <th className="py-2.5 w-[25%] pl-2">Description</th>
                    <th className="py-2.5 w-[5%] text-center">Qty</th>
                    <th className="py-2.5 w-[10%]">Color / Sides</th>
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
                    <th className="py-2.5 w-[10%] text-right pr-2">Total</th>
                  </tr>
                </thead>
                <tbody className="font-bold text-black uppercase text-[9px]">
                  {rows.map((row, idx) => {
                    if (row.type === "general") {
                      const itemColorHex = "#0891b2";
                      return (
                        <tr key={`g-${row.item.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-2 pl-2 font-black tracking-tight align-middle">
                            <div className="flex items-center">
                              <div className="shrink-0">{renderGarmentIcon(row.parsedName, itemColorHex)}</div>
                              <div className="whitespace-normal break-words leading-[1.1] pr-2 w-full">{row.parsedName}</div>
                            </div>
                          </td>
                          <td className="py-2 text-center font-black bg-slate-50/50 align-middle">{row.qty}</td>
                          <td className="py-2 font-black whitespace-normal break-words pr-1 align-middle leading-[1.1]">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[8px] font-black uppercase tracking-widest">PRINT MEDIA</span>
                            {row.sides && (
                              <div className="text-[7px] tracking-tight font-bold text-slate-500 mt-1">{row.sides.toUpperCase()}</div>
                            )}
                          </td>
                          <td colSpan={9} className="py-2 text-center text-[8px] text-slate-300 italic font-light tracking-widest align-middle">no size breakdown</td>
                          {/* Price (regular line total — qty × regular_price). Falls back to unit_price if no regular stored. */}
                          <td className="py-2 text-right pr-2 align-middle whitespace-nowrap">
                            {(() => {
                              const regUnit = (row.item.regular_price ?? row.item.unit_price ?? 0);
                              const reg = regUnit * row.qty;
                              const isDiscounted = (row.item.regular_price ?? 0) > (row.item.unit_price ?? 0) && reg > 0;
                              return isDiscounted
                                ? <span className="text-[9px] text-red-500 line-through tracking-tighter">${reg.toFixed(2)}</span>
                                : <span className="text-slate-700 font-black">${reg.toFixed(2)}</span>;
                            })()}
                          </td>
                          {/* Special (discounted line total — qty × unit_price). Dash if no discount. */}
                          <td className="py-2 text-right pr-2 align-middle whitespace-nowrap">
                            {(() => {
                              const disc = (row.item.unit_price ?? 0) * row.qty;
                              const isDiscounted = (row.item.regular_price ?? 0) > (row.item.unit_price ?? 0) && disc > 0;
                              return isDiscounted
                                ? <span className="text-sky-600 font-black">${disc.toFixed(2)}</span>
                                : <span className="text-slate-300">—</span>;
                            })()}
                          </td>
                          <td className="py-2 text-right font-black tracking-tighter pr-2 align-middle">${row.rowTotal.toFixed(2)}</td>
                        </tr>
                      );
                    }

                    const v = row.variant;
                    const itemColorHex = getColorHex(v.color);
                    return (
                      <tr key={`a-${v.id}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-2 pl-2 font-black tracking-tight align-middle">
                          <div className="flex items-center">
                            <div className="shrink-0">
                              {row.isFirstVariant ? renderGarmentIcon(row.parsedName, itemColorHex) : <span className="w-5 mr-2 block"></span>}
                            </div>
                            <div className="whitespace-normal break-words leading-[1.1] pr-2 w-full">
                              {row.isFirstVariant ? row.parsedName : ""}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 text-center font-black bg-slate-50/50 align-middle">{row.qty}</td>

                        <td className="py-2 font-black whitespace-normal break-words pr-1 align-middle leading-[1.1]" style={{ color: itemColorHex }}>
                          <div>{v.color || 'STANDARD'}</div>
                          {row.isFirstVariant && row.sides && (
                            <div className="text-[7px] tracking-tight font-bold text-slate-500 mt-0.5">{row.sides.toUpperCase()}</div>
                          )}
                        </td>

                        <td className={`py-2 text-center bg-slate-50/60 align-middle ${v.xs === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xs || '·'}</td>
                        <td className={`py-2 text-center align-middle ${v.s === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.s || '·'}</td>
                        <td className={`py-2 text-center bg-slate-50/60 align-middle ${v.m === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.m || '·'}</td>
                        <td className={`py-2 text-center align-middle ${v.l === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.l || '·'}</td>
                        <td className={`py-2 text-center bg-slate-50/60 align-middle ${v.xl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xl || '·'}</td>
                        <td className={`py-2 text-center align-middle ${v.xxl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xxl || '·'}</td>
                        <td className={`py-2 text-center bg-slate-50/60 align-middle ${v.xxxl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xxxl || '·'}</td>
                        <td className={`py-2 text-center align-middle ${v.xxxxl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xxxxl || '·'}</td>
                        <td className={`py-2 text-center bg-slate-50/60 align-middle ${v.xxxxxl === 0 ? 'text-slate-300 font-light' : 'text-black'}`}>{v.xxxxxl || '·'}</td>

                        {/* Price (regular line total — qty × regular_price) */}
                        <td className="py-2 text-right pr-2 align-middle whitespace-nowrap">
                          {(() => {
                            const regUnit = (v.regular_price ?? v.unit_price ?? 0);
                            const reg = regUnit * row.qty;
                            const isDiscounted = (v.regular_price ?? 0) > (v.unit_price ?? 0) && reg > 0;
                            return isDiscounted
                              ? <span className="text-[9px] text-red-500 line-through tracking-tighter">${reg.toFixed(2)}</span>
                              : <span className="text-slate-700 font-black">${reg.toFixed(2)}</span>;
                          })()}
                        </td>
                        {/* Special (discounted line total — qty × unit_price). Dash if no discount. */}
                        <td className="py-2 text-right pr-2 align-middle whitespace-nowrap">
                          {(() => {
                            const disc = (v.unit_price ?? 0) * row.qty;
                            const isDiscounted = (v.regular_price ?? 0) > (v.unit_price ?? 0) && disc > 0;
                            return isDiscounted
                              ? <span className="text-sky-600 font-black">${disc.toFixed(2)}</span>
                              : <span className="text-slate-300">—</span>;
                          })()}
                        </td>
                        <td className="py-2 text-right font-black tracking-tighter pr-2 align-middle">${row.rowTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}

                  {rows.length === 0 && (
                    <tr><td colSpan={15} className="py-8 text-center text-slate-400 text-[10px] tracking-widest font-bold">No items on this quote.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* CUSTOM NOTES (only printed if entered) */}
            {notes.trim() && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <div className="text-[8px] font-black text-[#686a6c] uppercase tracking-[0.4em] mb-2">Notes & Terms</div>
                <p className="text-[9px] text-slate-700 leading-relaxed whitespace-pre-wrap">{notes}</p>
              </div>
            )}

            {/* BOTTOM SECTION */}
            <div className="flex justify-between items-start pt-6 border-t-[6px] border-black mt-auto">

              <div className="w-1/2 space-y-5 pr-4">
                <div className="text-[9px] font-black text-black uppercase tracking-[0.1em] space-y-1">
                  <div className="text-sm tracking-tighter italic mb-1.5">YAYA SPORTS INCORPORATED</div>
                  <div className="text-slate-500">39 BRANCHWOOD ST</div>
                  <div className="text-slate-500">OTTAWA - ON. - K2B6X8</div>
                  <div className="text-slate-500">613-666-YAYA (9292)</div>
                  <div className="text-slate-500">GST/HST#: 71925 3957 RT0001</div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <span className="text-sky-600 text-[10px] tracking-widest font-black uppercase">E-TRANSFER TO: INFO@YAYASPORTS.CA</span>
                </div>

                <p className="text-[8px] normal-case font-bold text-slate-400 leading-relaxed max-w-[320px] pt-2">
                  * This quote is valid for {QUOTE_VALIDITY_DAYS} days from the date issued. Production begins immediately upon artwork approval and deposit. Thank you for choosing YAYA SPORTS.
                </p>
              </div>

              {/* FINANCIALS PANEL */}
              <div className="w-[280px] bg-slate-50 p-5 border border-slate-200 rounded-lg shadow-sm">
                <div className="space-y-3 text-[10px] font-black text-black uppercase tracking-widest">
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Sub-Total</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {totalSavings > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      <span>You Save</span>
                      <span>-${totalSavings.toFixed(2)}</span>
                    </div>
                  )}
                  {includeHst ? (
                    <div className="flex justify-between items-center text-slate-500 border-b border-slate-200 pb-3">
                      <span>HST (13%)</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-slate-400 border-b border-slate-200 pb-3 text-[8px]">
                      <span>Tax</span>
                      <span className="italic normal-case tracking-normal">Not Included</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1 text-2xl tracking-tighter text-black leading-none">
                    <span>Quote Total</span>
                    <span>${grandTotal.toFixed(2)}</span>
                  </div>

                  {depositPct > 0 && depositPct < 100 && (
                    <div className="pt-3 border-t border-slate-200 space-y-1">
                      <div className="flex justify-between items-center text-[9px] text-sky-600">
                        <span>{depositPct}% Deposit Due</span>
                        <span>${deposit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[8px] text-slate-400">
                        <span>Balance on Delivery</span>
                        <span>${(grandTotal - deposit).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {acceptanceStatus === "accepted" ? (
                    <div className="pt-6 border-t border-emerald-300 mt-2">
                      <div className="text-[7px] text-slate-400 tracking-[0.4em] mb-1">SIGNED & ACCEPTED</div>
                      <div className="text-[10px] font-black text-emerald-700 tracking-tight italic" style={{ fontFamily: 'cursive' }}>
                        {signatureName}
                      </div>
                      <div className="text-[7px] text-slate-500 mt-1 tracking-widest">{signatureDate}</div>
                    </div>
                  ) : (
                    <div className="pt-10 border-b border-slate-300 text-[7px] text-[#686a6c] pb-1 text-center tracking-[0.5em]">
                      CUSTOMER APPROVAL
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EXPIRED BAR — customer can still sign (soft lock) but pricing may be stale.
          If they don't want to risk it, they can request a revival. */}
      {isExpired && acceptanceStatus === "pending" && !revivalRequestedAt && (
        <div className="print:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-amber-900 to-slate-900 border-t-2 border-amber-400/40 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40">
          <div className="max-w-[210mm] mx-auto flex flex-col sm:flex-row items-center gap-3">
            <div className="text-white text-[11px] font-black uppercase tracking-widest text-center sm:text-left flex-1">
              <span className="text-amber-300">⚠ This quote has expired.</span>{" "}
              <span className="text-amber-100/80 normal-case tracking-normal font-normal">Pricing may have changed. Request a revival or sign as-is below.</span>
            </div>
            <button onClick={() => setShowReviveModal(true)} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all">
              Request Revival
            </button>
            <button onClick={() => setShowSignatureModal(true)} className="w-full sm:w-auto bg-slate-800 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all border border-slate-700">
              Sign As-Is
            </button>
          </div>
        </div>
      )}

      {/* REVIVAL REQUEST PENDING BAR */}
      {isExpired && revivalRequestedAt && acceptanceStatus === "pending" && (
        <div className="print:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-slate-800 to-slate-900 border-t-2 border-amber-400/30 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40">
          <div className="max-w-[210mm] mx-auto flex items-center gap-3">
            <div className="text-white text-[11px] font-black uppercase tracking-widest text-center sm:text-left flex-1">
              <span className="text-amber-300">Revival requested.</span>{" "}
              <span className="text-slate-300 normal-case tracking-normal font-normal">We're reviewing your quote — you'll receive a fresh quote by email within one business day.</span>
            </div>
          </div>
        </div>
      )}

      {/* ACCEPT / DECLINE FLOATING BAR */}
      {acceptanceStatus === "pending" && !isExpired && (
        <div className="print:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-slate-900 to-black border-t-2 border-sky-500/30 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40">
          <div className="max-w-[210mm] mx-auto flex flex-col sm:flex-row items-center gap-3">
            <div className="text-white text-[11px] font-black uppercase tracking-widest text-center sm:text-left flex-1">
              Ready to proceed? <span className="text-sky-400">Approve this quote to lock in pricing.</span>
            </div>
            <button onClick={handleDecline} className="w-full sm:w-auto bg-slate-800 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all">
              Decline
            </button>
            <button onClick={() => setShowSignatureModal(true)} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all shadow-lg">
              ✓ Accept & Sign
            </button>
          </div>
        </div>
      )}

      {/* PAY DEPOSIT FLOATING BAR — shows after sign, before payment */}
      {acceptanceStatus === "accepted" && !depositPaidAt && (
        <div className="print:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-sky-900 to-slate-900 border-t-2 border-sky-400/40 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40">
          <div className="max-w-[210mm] mx-auto flex flex-col sm:flex-row items-center gap-3">
            <div className="text-white text-[11px] font-black uppercase tracking-widest text-center sm:text-left flex-1">
              Quote signed.{" "}
              <span className="text-sky-300">
                {depositPct > 0 && depositPct < 100
                  ? `Pay ${depositPct}% deposit ($${deposit.toFixed(2)}) to start production.`
                  : `Pay $${grandTotal.toFixed(2)} to start production.`}
              </span>
            </div>
            <button
              onClick={handlePayDeposit}
              disabled={isStartingPayment}
              className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 disabled:bg-sky-700 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all shadow-lg"
            >
              {isStartingPayment ? "Loading..." :
                (depositPct > 0 && depositPct < 100
                  ? `Pay $${deposit.toFixed(2)} Deposit`
                  : `Pay $${grandTotal.toFixed(2)}`)}
            </button>
          </div>
        </div>
      )}

      {/* PAYMENT RESULT BANNER */}
      {paymentBanner === "success" && (
        <div className="print:hidden fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <span className="text-xl">✓</span>
          <div>
            <div className="font-black text-[12px] uppercase tracking-widest">Payment Received</div>
            <div className="text-[10px] opacity-90">Your job is now in production. A receipt has been emailed to you.</div>
          </div>
          <button
            onClick={() => { setPaymentBanner(null); router.replace(`/quotes/${params?.id}`); }}
            className="ml-2 text-white/80 hover:text-white text-lg leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}
      {paymentBanner === "cancelled" && (
        <div className="print:hidden fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <span className="text-xl">!</span>
          <div>
            <div className="font-black text-[12px] uppercase tracking-widest">Payment Cancelled</div>
            <div className="text-[10px] opacity-90">No charge was made. You can pay anytime from this page.</div>
          </div>
          <button
            onClick={() => { setPaymentBanner(null); router.replace(`/quotes/${params?.id}`); }}
            className="ml-2 text-white/80 hover:text-white text-lg leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* REVIVAL BANNERS */}
      {revivalBanner === "submitted" && (
        <div className="print:hidden fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-sky-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <span className="text-xl">✓</span>
          <div>
            <div className="font-black text-[12px] uppercase tracking-widest">Revival Requested</div>
            <div className="text-[10px] opacity-90">We'll email you a fresh quote within one business day.</div>
          </div>
          <button
            onClick={() => { setRevivalBanner(null); router.replace(`/quotes/${params?.id}`); }}
            className="ml-2 text-white/80 hover:text-white text-lg leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}
      {revivalBanner === "revived" && (
        <div className="print:hidden fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <span className="text-xl">✓</span>
          <div>
            <div className="font-black text-[12px] uppercase tracking-widest">Quote Revived</div>
            <div className="text-[10px] opacity-90">Valid for another 14 days. Customer notified.</div>
          </div>
          <button
            onClick={() => { setRevivalBanner(null); router.replace(`/quotes/${params?.id}`); }}
            className="ml-2 text-white/80 hover:text-white text-lg leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}
      {revivalBanner === "already_revived" && (
        <div className="print:hidden fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-700 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <span className="text-xl">i</span>
          <div>
            <div className="font-black text-[12px] uppercase tracking-widest">Already Revived</div>
            <div className="text-[10px] opacity-90">This quote was already approved for revival.</div>
          </div>
          <button
            onClick={() => { setRevivalBanner(null); router.replace(`/quotes/${params?.id}`); }}
            className="ml-2 text-white/80 hover:text-white text-lg leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* REVIVE MODAL */}
      {showReviveModal && (
        <div className="print:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => !isSubmittingRevive && setShowReviveModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 pb-4 mb-5">
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-black">Request Revival</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-2 text-slate-500">We'll review pricing & email you a fresh quote</p>
            </div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-700 mb-2">Anything we should know? (optional)</label>
            <textarea
              value={reviveNote}
              onChange={(e) => setReviveNote(e.target.value)}
              placeholder="e.g. Quantities have changed — now need 500 instead of 250..."
              rows={4}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-sky-500 text-slate-900 mb-4 placeholder-slate-400"
              maxLength={500}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowReviveModal(false)}
                disabled={isSubmittingRevive}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRevive}
                disabled={isSubmittingRevive}
                className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-700 text-white px-5 py-2.5 rounded-lg font-black uppercase text-[10px] tracking-widest transition-all"
              >
                {isSubmittingRevive ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {acceptanceStatus !== "pending" && (
        <div className="print:hidden fixed bottom-4 right-4 z-40">
          <button onClick={resetAcceptance} className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest border border-slate-700 transition-all">
            Reset Status
          </button>
        </div>
      )}

      {/* SIGNATURE MODAL */}
      {showSignatureModal && (
        <div className="print:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowSignatureModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 pb-4 mb-5">
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-black">Accept Quote</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-2 text-slate-500">Type your name below to sign and approve</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest block mb-2 text-slate-500">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder={quote.customers?.contact_name || "Your name"}
                  className="w-full rounded-xl px-4 py-3 text-base font-bold outline-none transition-colors shadow-inner border border-slate-300 focus:border-emerald-500 bg-slate-50"
                  autoFocus
                />
              </div>

              {signatureName.trim() && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-[8px] tracking-[0.3em] font-black text-emerald-700 uppercase mb-1">Preview</div>
                  <div className="text-2xl text-emerald-700 italic" style={{ fontFamily: 'cursive' }}>{signatureName}</div>
                  <div className="text-[9px] text-slate-500 mt-1">Dated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
              )}

              <p className="text-[9px] text-slate-500 leading-relaxed">
                By typing your name, you agree this is a legally binding electronic signature accepting the terms of this quote, including pricing and turnaround.
              </p>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSignatureModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                  Cancel
                </button>
                <button onClick={handleAccept} disabled={!signatureName.trim()} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  Sign & Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
