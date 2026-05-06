"use client";

// =============================================================================
// CREATE NEW ORDER — V2 (Phase 1, dense-grid layout)
// =============================================================================
// Parallel page at /quotes/new-v2 for the new "Create Order" UX.
// Phase 1: shell, header, Customer Information, Order Details, right sidebar.
// Layout uses a 12-column grid so sections sit side-by-side like the
// reference design, minimizing vertical scroll on desktop.
// =============================================================================

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ---- TYPES ------------------------------------------------------------------
type Customer = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  vip_tier?: string | null;
  address?: string | null;
};

type CustomerType = "vip" | "repeat" | "new";
type DeliveryMethod = "pickup" | "delivery" | "shipping";
type OrderType = "Custom Apparel" | "Promotional" | "Embroidery Only" | "DTF Transfers" | "Other";
type PaymentStatus = "Deposit Required" | "Paid in Full" | "Net 15" | "Net 30";

type CatalogItem = {
  id: string;
  name: string;
  category?: string | null;
  default_price?: number | null;
};

// One row in the garment table = one product+color combo with size breakdown.
// On save (Phase 6) rows with the same `description` are grouped into one
// quote_item with multiple variants; the flat shape here keeps the UI simple.
type LineItem = {
  id: string;
  description: string;
  color: string;
  xs: number; s: number; m: number; l: number; xl: number;
  xxl: number; xxxl: number; xxxxl: number; xxxxxl: number;
  unit_price: number;
  regular_price: number;
};

type PrintMethod = "DTF" | "Screen Print" | "Embroidery" | "Vinyl" | "Heat Press";
type PrintLocation = "Left Chest" | "Full Front" | "Full Back" | "Left Sleeve" | "Right Sleeve" | "Back Yoke";
type ArtworkStatus = "print-ready" | "awaiting-approval";

type AttachedFile = {
  id: string;
  name: string;
  url: string;          // public URL
  path: string;         // storage path (used for delete)
  size: number;         // bytes
  type: string;         // mime type
  isImage: boolean;
  status: ArtworkStatus;
};

const PRINT_METHODS: PrintMethod[] = ["DTF", "Screen Print", "Embroidery", "Vinyl", "Heat Press"];
const PRINT_LOCATIONS: PrintLocation[] = ["Left Chest", "Full Front", "Full Back", "Left Sleeve", "Right Sleeve", "Back Yoke"];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type ThemeTokens = {
  pageBg: string; text: string; textMuted: string;
  cardBg: string; cardBorder: string; cardShadow: string;
  inputBg: string; primaryBtn: string; secondaryBtn: string;
  hintBg: string;
};

// ---- CONSTANTS --------------------------------------------------------------
// Color palette + hex map mirrored from /app/mockup-v2/page.tsx so this page
// shows real garment colours with accurate swatches. If the mockup page adds
// or renames a colour, update both.
const ALL_COLORS = [
  "White", "Black", "Charcoal", "Dark Heather", "Sport Grey", "Navy",
  "Off White", "Ice Grey", "Paragon", "Graphite Heather", "Heather Dark Grey",
  "Natural", "Cornsilk", "Sand", "Dark Chocolate",
  "Daisy", "Gold", "Old Gold", "Orange", "Heather Orange", "Safety Orange",
  "Light Pink", "Safety Pink", "Azalea", "Coral Silk", "Heliconia", "Antique Heliconia", "Heather Heliconia",
  "Heather Berry", "Cherry Red", "Antique Cherry Red", "Red", "Heather Red", "Heather Scarlet Red",
  "Cardinal Red", "Heather Cardinal Red", "Garnet", "Maroon", "Heather Maroon", "Heather Dark Maroon",
  "Heather Radiant Orchid", "Orchid", "Iris", "Violet", "Purple", "Heather Purple",
  "Sky", "Light Blue", "Carolina Blue", "Stone Blue", "Tropical Blue", "Sapphire",
  "Antique Sapphire", "Heather Sapphire", "Heather Galapagos Blue", "Royal",
  "Heather Royal", "Heather Deep Royal", "Indigo Blue", "Heather Indigo",
  "Metro Blue", "Heather Navy", "Heather Dark Navy",
  "Mint Green", "Pistachio", "Lime", "Kiwi", "Sage", "Irish Green",
  "Heather Irish Green", "Kelly Green", "Jade Dome", "Forest", "Forest Green",
  "Heather Dark Green", "Military Green", "Heather Military Green", "Safety Green",
  "Ash",
];
const COLOR_HEX: Record<string, string> = {
  "Antique Cherry Red":"#7C1C29","Antique Heliconia":"#D14578","Antique Sapphire":"#126B88","Ash":"#D7D7D7",
  "Azalea":"#F089B2","Black":"#111111","Cardinal Red":"#8A1529","Carolina Blue":"#7BAFD4","Charcoal":"#4F5254",
  "Cherry Red":"#B80F2A","Coral Silk":"#F08080","Cornsilk":"#FFF8DC","Daisy":"#FFD700","Dark Chocolate":"#35231D",
  "Dark Heather":"#4B4F55","Forest":"#182C25","Forest Green":"#182C25","Garnet":"#5F121F","Gold":"#FFC72C",
  "Graphite Heather":"#454545","Heather Berry":"#8B3A62","Heather Cardinal Red":"#7D2B3A","Heather Dark Green":"#2d4235",
  "Heather Dark Grey":"#555555","Heather Dark Maroon":"#5d1e2e","Heather Dark Navy":"#2b3447","Heather Deep Royal":"#3b5ba5",
  "Heather Galapagos Blue":"#2A6E82","Heather Heliconia":"#C14B74","Heather Indigo":"#384B66","Heather Irish Green":"#3A8E5D",
  "Heather Maroon":"#5C2634","Heather Military Green":"#545C44","Heather Navy":"#2F3B4C","Heather Orange":"#D86E45",
  "Heather Purple":"#5C466A","Heather Radiant Orchid":"#A865B5","Heather Red":"#B33E4C","Heather Royal":"#4A77B4",
  "Heather Sapphire":"#3F7696","Heather Scarlet Red":"#b93d47","Heliconia":"#DB3E79","Ice Grey":"#C4C6C8",
  "Indigo Blue":"#475D74","Irish Green":"#009E60","Iris":"#5D3FD3","Jade Dome":"#00A86B","Kelly Green":"#4CBB17",
  "Kiwi":"#8EE53F","Light Blue":"#ADD8E6","Light Pink":"#FFB6C1","Lime":"#BFFF00","Maroon":"#500000",
  "Metro Blue":"#1A3256","Military Green":"#4B5320","Mint Green":"#98FF98","Natural":"#EBE5D5","Navy":"#000080",
  "Off White":"#F8F8FF","Old Gold":"#CFB53B","Orange":"#FFA500","Orchid":"#DA70D6","Paragon":"#9C9C9C",
  "Pistachio":"#93C572","Purple":"#6A0DAD","Red":"#E60000","Royal":"#4169E1","Safety Green":"#CEFF00",
  "Safety Orange":"#FF7518","Safety Pink":"#FF1DCE","Sage":"#B2AC88","Sand":"#C2B280","Sapphire":"#0F52BA",
  "Sky":"#87CEEB","Sport Grey":"#9E9E9E","Stone Blue":"#5C7893","Tropical Blue":"#00BFFF","Violet":"#7851A9",
  "White":"#FFFFFF",
};
const colorHex = (name: string) => COLOR_HEX[name] || "#cccccc";

const SIZE_KEYS = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl"] as const;
const SIZE_LABELS: Record<(typeof SIZE_KEYS)[number], string> = {
  xs: "XS", s: "S", m: "M", l: "L", xl: "XL", xxl: "2X", xxxl: "3X", xxxxl: "4X", xxxxxl: "5X",
};
type SizeKey = (typeof SIZE_KEYS)[number];

const newLine = (price = 0): LineItem => ({
  id: Math.random().toString(36).slice(2, 11),
  description: "",
  color: "Black",
  xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0,
  unit_price: price,
  regular_price: price,
});

const lineQty   = (l: LineItem) => l.xs + l.s + l.m + l.l + l.xl + l.xxl + l.xxxl + l.xxxxl + l.xxxxxl;
const lineTotal = (l: LineItem) => lineQty(l) * (l.unit_price || 0);

// ---- COMPONENT --------------------------------------------------------------
export default function CreateNewOrderV2() {
  const router = useRouter();

  // ---- THEME (use system theme set by global layout) -----------------------
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("yaya-theme");
    setIsLight(saved === "light");
    const onChange = () => setIsLight(localStorage.getItem("yaya-theme") === "light");
    window.addEventListener("themeChange", onChange);
    return () => window.removeEventListener("themeChange", onChange);
  }, []);

  // ---- CUSTOMER STATE -------------------------------------------------------
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("repeat");

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [sameAsBilling, setSameAsBilling] = useState(true);

  // ---- ORDER DETAILS STATE --------------------------------------------------
  const [orderNumber, setOrderNumber] = useState(`ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [rushOrder, setRushOrder] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("Custom Apparel");
  const [salesRep, setSalesRep] = useState("Alex Morgan");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("Deposit Required");
  const [depositPercent, setDepositPercent] = useState(30);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("shipping");

  // ---- GARMENT / PRODUCT STATE ---------------------------------------------
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [lines, setLines] = useState<LineItem[]>([newLine()]);
  const [productSearchOpen, setProductSearchOpen] = useState<string | null>(null); // line id whose dropdown is open

  // ---- PRINT SPECS STATE ----------------------------------------------------
  const [printMethod, setPrintMethod] = useState<PrintMethod>("DTF");
  const [printLocations, setPrintLocations] = useState<PrintLocation[]>(["Full Front"]);
  const [numColors, setNumColors] = useState(1);
  const [printNotes, setPrintNotes] = useState("");

  // ---- PRICING + INTERNAL NOTES STATE --------------------------------------
  const [setupFees, setSetupFees] = useState(0);
  const [addOnCharges, setAddOnCharges] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);
  const [taxRate, setTaxRate] = useState(8.25); // percent
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [packagingNotes, setPackagingNotes] = useState("");
  const [qcNotes, setQcNotes] = useState("");

  // ---- ARTWORK FILES STATE -------------------------------------------------
  // Persisted so we can survive a page refresh during a long order build.
  // Each file is a session-scoped draft id; on save (Phase 6) the rows get
  // re-keyed by job id and the files moved/renamed.
  const [draftId] = useState(() => Math.random().toString(36).slice(2, 11));
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setIsUploading(true);
    try {
      for (const f of arr) {
        const ext = f.name.split(".").pop() || "bin";
        const path = `draft-${draftId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("job-attachments").upload(path, f);
        if (error) throw error;
        const { data } = supabase.storage.from("job-attachments").getPublicUrl(path);
        setFiles(prev => [...prev, {
          id: Math.random().toString(36).slice(2, 11),
          name: f.name,
          url: data.publicUrl,
          path,
          size: f.size,
          type: f.type,
          isImage: f.type.startsWith("image/"),
          status: "awaiting-approval",
        }]);
      }
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = async (file: AttachedFile) => {
    try {
      await supabase.storage.from("job-attachments").remove([file.path]);
    } catch {
      // Best-effort delete — even if remote remove fails, drop from UI.
    }
    setFiles(prev => prev.filter(f => f.id !== file.id));
  };

  const setFileStatus = (id: string, status: ArtworkStatus) =>
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status } : f));

  const togglePrintLocation = (loc: PrintLocation) =>
    setPrintLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);

  // ---- DERIVED VALUES (right sidebar) --------------------------------------
  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const dueInDays = useMemo(() => {
    if (!dueDate) return null;
    const d = new Date(dueDate + "T12:00:00");
    const now = new Date(); now.setHours(0,0,0,0);
    return Math.round((d.getTime() - now.getTime()) / 86400000);
  }, [dueDate]);

  // ---- LOAD CUSTOMERS + CATALOG --------------------------------------------
  useEffect(() => {
    (async () => {
      const [{ data: cust }, { data: cat }] = await Promise.all([
        supabase.from("customers").select("id, company_name, contact_name, email, phone, vip_tier, address").order("company_name"),
        supabase.from("catalog_items").select("id, name, category, default_price").order("name"),
      ]);
      if (cust) setCustomers(cust as Customer[]);
      if (cat) setCatalog(cat as CatalogItem[]);
    })();
  }, []);

  useEffect(() => {
    if (!selectedCustomer) return;
    setCompanyName(selectedCustomer.company_name ?? "");
    setContactName(selectedCustomer.contact_name ?? "");
    setEmail(selectedCustomer.email ?? "");
    setPhone(selectedCustomer.phone ?? "");
    setBillingAddress(selectedCustomer.address ?? "");
    if (selectedCustomer.vip_tier && /vip/i.test(selectedCustomer.vip_tier)) setCustomerType("vip");
  }, [selectedCustomer]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(c => c.company_name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q))
      .slice(0, 12);
  }, [customers, customerSearch]);

  // ---- LINE-ITEM HELPERS ---------------------------------------------------
  const addLine = (preset?: Partial<LineItem>) => setLines(ls => [...ls, { ...newLine(), ...preset }]);
  const removeLine = (id: string) => setLines(ls => ls.length === 1 ? [newLine()] : ls.filter(l => l.id !== id));
  const updateLine = (id: string, patch: Partial<LineItem>) =>
    setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));

  const totalUnits = useMemo(() => lines.reduce((sum, l) => sum + lineQty(l), 0), [lines]);
  const subtotal   = useMemo(() => lines.reduce((sum, l) => sum + lineTotal(l), 0), [lines]);

  // Pricing breakdown — order of ops mirrors the screenshot:
  // Subtotal + Setup + AddOns => preTax.  Rush is +15% on preTax (if on).
  // Tax applies to (preTax + rush).  Shipping is added after tax.
  const rushFee     = useMemo(() => rushOrder ? (subtotal + setupFees + addOnCharges) * 0.15 : 0, [rushOrder, subtotal, setupFees, addOnCharges]);
  const preTaxTotal = useMemo(() => subtotal + setupFees + addOnCharges + rushFee, [subtotal, setupFees, addOnCharges, rushFee]);
  const taxAmount   = useMemo(() => preTaxTotal * (taxRate / 100), [preTaxTotal, taxRate]);
  const grandTotal  = useMemo(() => preTaxTotal + taxAmount + shippingFee, [preTaxTotal, taxAmount, shippingFee]);
  const depositAmount = useMemo(() => paymentStatus === "Deposit Required" ? grandTotal * (depositPercent / 100) : 0, [grandTotal, depositPercent, paymentStatus]);

  // Margin estimate — uses each line's regular_price as MSRP and unit_price
  // as our cost-to-customer. Rough proxy until we add a true cost field.
  const estProfit = useMemo(() => lines.reduce((sum, l) => {
    const margin = (l.unit_price || 0) - (l.regular_price || 0);
    return sum + margin * lineQty(l);
  }, 0), [lines]);
  const estMarginPct = grandTotal > 0 ? (estProfit / grandTotal) * 100 : 0;
  const productSearchTerms = useMemo(() => catalog.filter(c =>
    !c.category || (c.category !== "Print Media" && c.category !== "Misc" && c.category !== "Services" && c.category !== "Design" && c.category !== "Custom Insert" && c.category !== "Upsells")
  ), [catalog]);

  // ---- THEME TOKENS ---------------------------------------------------------
  const t: ThemeTokens = {
    pageBg: isLight ? "bg-slate-50" : "bg-[#0a0b0f]",
    text: isLight ? "text-slate-900" : "text-slate-100",
    textMuted: isLight ? "text-slate-500" : "text-slate-400",
    cardBg: isLight ? "bg-white" : "bg-[#13141a]",
    cardBorder: isLight ? "border-slate-200/80" : "border-white/[0.06]",
    cardShadow: isLight ? "shadow-[0_1px_2px_rgba(0,0,0,0.04)]" : "shadow-[0_1px_0_rgba(255,255,255,0.02)_inset]",
    inputBg: isLight ? "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400" : "bg-[#0d0e13] border-white/10 text-white placeholder:text-slate-600",
    primaryBtn: "bg-sky-500 hover:bg-sky-400 text-white shadow-[0_8px_24px_-8px_rgba(14,165,233,0.6)]",
    secondaryBtn: isLight ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10",
    hintBg: isLight ? "bg-slate-100 text-slate-500" : "bg-white/[0.04] text-slate-500",
  };

  // NOTE: SectionCard and Field are defined OUTSIDE this component (below)
  // so React keeps the same component type across renders. Defining them inline
  // would cause inputs to lose focus on every keystroke as the parent re-renders
  // and React unmounts/remounts the children with new component identity.

  const inputCls = `w-full rounded-md border px-3 py-2 text-[13px] font-medium outline-none transition-colors focus:border-sky-500 ${t.inputBg}`;
  const inputSm  = `w-full rounded-md border px-2.5 py-1.5 text-[12px] font-medium outline-none transition-colors focus:border-sky-500 ${t.inputBg}`;

  // ---- SAVE STUBS (Phase 6 will wire them up) -------------------------------
  const saveDraft = () => alert("Save Draft will be wired in Phase 6.");
  const sendQuote = () => alert("Send Quote will be wired in Phase 6.");
  const createOrder = () => alert("Create Order will be wired in Phase 6.");

  return (
    <div className={`${t.pageBg} ${t.text} min-h-screen transition-colors duration-300`}>

      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div className={`${t.cardBg} ${t.cardBorder} border-b sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-opacity-80`}>
        <div className="max-w-[1800px] mx-auto px-3 sm:px-5 lg:px-6 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 lg:gap-6">
          <div className="min-w-0">
            <h1 className={`text-lg sm:text-xl font-black tracking-tight leading-tight ${t.text}`}>Create New Order</h1>
            <p className={`text-[11px] font-medium ${t.textMuted} mt-0.5 leading-snug`}>
              Capture everything needed to move a job from quote to production without mistakes.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={saveDraft} className={`${t.secondaryBtn} px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 min-h-[40px] active:scale-95 transition-all`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save Draft
            </button>
            <button onClick={sendQuote} className={`${t.secondaryBtn} px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 min-h-[40px] active:scale-95 transition-all`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send Quote
            </button>
            <button onClick={createOrder} className={`${t.primaryBtn} px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 min-h-[40px] active:scale-95 transition-all`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
              Create Order
            </button>
          </div>
        </div>
      </div>

      {/* ─── BODY: main grid + right sidebar ───────────────────────────────── */}
      <div className="max-w-[1800px] mx-auto px-3 sm:px-5 lg:px-6 py-4 grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-4">

        {/* ─── MAIN: 12-col dense grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4 min-w-0 auto-rows-min">

          {/* SECTION 1 — Customer Information (xl: 4 of 12) ----------------- */}
          <SectionCard t={t} num={1} title="Customer Information" className="md:col-span-2 xl:col-span-4">
            <div className="flex flex-col gap-3">

              {/* Customer search */}
              <div className="relative">
                <Field t={t} label="Customer / Company" required>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch || companyName}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setCompanyName(e.target.value);
                        setSelectedCustomerId("");
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                      placeholder="Search or type a new company name…"
                      className={inputCls + " pr-16"}
                    />
                    {selectedCustomerId && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Linked</span>
                    )}
                  </div>
                </Field>

                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className={`absolute top-full left-0 right-0 mt-1 ${t.cardBg} ${t.cardBorder} border rounded-md shadow-2xl overflow-hidden z-20 max-h-60 overflow-y-auto`}>
                    {filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setCustomerSearch("");
                          setShowCustomerDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-sky-500/10 transition-colors flex items-center justify-between gap-3 ${t.cardBorder} border-b last:border-b-0`}
                      >
                        <div className="min-w-0">
                          <div className={`text-[13px] font-bold truncate ${t.text}`}>{c.company_name}</div>
                          {c.contact_name && <div className={`text-[10px] font-medium truncate ${t.textMuted}`}>{c.contact_name}</div>}
                        </div>
                        {c.vip_tier && /vip/i.test(c.vip_tier) && <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">VIP ★</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field t={t} label="Contact" required>
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Mike Johnson" className={inputCls} />
                </Field>
                <Field t={t} label="Email" required>
                  <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mike@company.com" className={inputCls} />
                </Field>
              </div>

              <div className="grid grid-cols-[1fr_1.4fr] gap-3">
                <Field t={t} label="Phone" required>
                  <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 214-9876" className={inputCls} />
                </Field>
                <Field t={t} label="Customer Type">
                  <div className={`flex gap-1 p-0.5 rounded-md ${isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/[0.04] border border-white/10'}`}>
                    {(["vip", "repeat", "new"] as CustomerType[]).map(ct => {
                      const active = customerType === ct;
                      const accent = ct === "vip" ? "amber" : ct === "repeat" ? "sky" : "emerald";
                      const label = ct === "vip" ? "VIP ★" : ct === "repeat" ? "↻ Repeat" : "+ New";
                      return (
                        <button
                          key={ct}
                          type="button"
                          onClick={() => setCustomerType(ct)}
                          className={`flex-1 px-2 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                            active ? `bg-${accent}-500 text-white shadow-sm` : `${t.textMuted} hover:${t.text}`
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field t={t} label="Billing Address">
                  <textarea rows={3} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="123 Fitness Way&#10;Suite 100&#10;Austin, TX 78701" className={inputCls + " resize-none text-[12px] leading-snug"} />
                </Field>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase tracking-[0.12em] ${t.textMuted}`}>Shipping</span>
                    <label className={`flex items-center gap-1 text-[9px] font-bold ${t.textMuted} cursor-pointer select-none`}>
                      <input type="checkbox" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} className="accent-sky-500 w-3 h-3" />
                      Same as billing
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    value={sameAsBilling ? billingAddress : shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    disabled={sameAsBilling}
                    placeholder={sameAsBilling ? "" : "123 Warehouse Ln…"}
                    className={inputCls + " resize-none text-[12px] leading-snug disabled:opacity-60"}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECTION 2 — Order Details (xl: 3 of 12) ------------------------ */}
          <SectionCard t={t} num={2} title="Order Details" className="md:col-span-1 xl:col-span-3">
            <div className="flex flex-col gap-3">

              <Field t={t} label="Order Number" required>
                <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className={inputCls + " font-mono"} />
              </Field>

              <Field t={t} label="Due Date" required>
                <div className="relative">
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
                  {dueInDays !== null && (
                    <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded pointer-events-none ${
                      dueInDays < 0 ? "text-rose-500 bg-rose-500/10" : dueInDays <= 7 ? "text-amber-500 bg-amber-500/10" : "text-emerald-500 bg-emerald-500/10"
                    }`}>
                      {dueInDays < 0 ? `${Math.abs(dueInDays)}d od` : `${dueInDays}d`}
                    </span>
                  )}
                </div>
              </Field>

              {/* Rush Order toggle */}
              <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border ${rushOrder ? "bg-rose-500/10 border-rose-500/30" : isLight ? "bg-slate-50 border-slate-200" : "bg-white/[0.03] border-white/10"}`}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rushOrder}
                    onClick={() => setRushOrder(!rushOrder)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${rushOrder ? "bg-rose-500" : isLight ? "bg-slate-300" : "bg-white/15"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rushOrder ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                  <span className={`text-[12px] font-bold ${t.text}`}>Rush Order</span>
                </div>
                {rushOrder && (
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500 text-white">+15%</span>
                )}
              </div>

              <Field t={t} label="Order Type" required>
                <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)} className={inputCls + " appearance-none cursor-pointer"}>
                  <option>Custom Apparel</option>
                  <option>Promotional</option>
                  <option>Embroidery Only</option>
                  <option>DTF Transfers</option>
                  <option>Other</option>
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field t={t} label="Sales Rep" required>
                  <input value={salesRep} onChange={(e) => setSalesRep(e.target.value)} placeholder="Alex Morgan" className={inputSm} />
                </Field>
                <Field t={t} label="Payment">
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)} className={inputSm + " appearance-none cursor-pointer"}>
                    <option>Deposit Required</option>
                    <option>Paid in Full</option>
                    <option>Net 15</option>
                    <option>Net 30</option>
                  </select>
                </Field>
              </div>

              {paymentStatus === "Deposit Required" && (
                <Field t={t} label={`Deposit (${depositPercent}%)`}>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={100} step={5} value={depositPercent} onChange={(e) => setDepositPercent(parseInt(e.target.value))} className="flex-1 accent-sky-500" />
                    <input type="number" min={0} max={100} value={depositPercent} onChange={(e) => setDepositPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} className={inputSm + " w-14 text-center font-mono"} />
                  </div>
                </Field>
              )}

              <Field t={t} label="Delivery" required>
                <div className={`grid grid-cols-3 gap-1 p-0.5 rounded-md ${isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/[0.04] border border-white/10'}`}>
                  {(["pickup", "delivery", "shipping"] as DeliveryMethod[]).map(dm => {
                    const active = deliveryMethod === dm;
                    return (
                      <button
                        key={dm}
                        type="button"
                        onClick={() => setDeliveryMethod(dm)}
                        className={`px-2 py-1.5 rounded text-[10px] font-black uppercase tracking-widest capitalize transition-all ${
                          active ? "bg-sky-500 text-white shadow-sm" : `${t.textMuted} hover:${t.text}`
                        }`}
                      >
                        {dm}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </SectionCard>

          {/* SECTION 3 — Garment / Product Selection (xl: 5 of 12) ---------- */}
          <SectionCard t={t} num={3} title="Garment / Product Selection" className="md:col-span-2 xl:col-span-5">
            <div className="flex flex-col gap-2.5">

              {/* Lines */}
              <div className="flex flex-col gap-2">
                {lines.map((line) => {
                  const qty = lineQty(line);
                  const total = lineTotal(line);
                  const matches = !line.description ? [] : productSearchTerms.filter(p =>
                    p.name.toLowerCase().includes(line.description.toLowerCase())
                  ).slice(0, 8);
                  const dropdownOpen = productSearchOpen === line.id && matches.length > 0;

                  return (
                    <div key={line.id} className={`rounded-lg border ${isLight ? "bg-slate-50/50 border-slate-200" : "bg-white/[0.02] border-white/5"} p-2.5 flex flex-col gap-2`}>

                      {/* Row 1: Product name (prominent, full width) + delete */}
                      <div className="flex items-start gap-2">
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="text"
                            value={line.description}
                            placeholder="Search products or type a product / style…"
                            onChange={(e) => updateLine(line.id, { description: e.target.value })}
                            onFocus={() => setProductSearchOpen(line.id)}
                            onBlur={() => setTimeout(() => setProductSearchOpen(prev => prev === line.id ? null : prev), 150)}
                            className={inputCls}
                          />
                          {dropdownOpen && (
                            <div className={`absolute top-full left-0 right-0 mt-1 ${t.cardBg} ${t.cardBorder} border rounded-md shadow-2xl overflow-hidden z-20 max-h-52 overflow-y-auto`}>
                              {matches.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    updateLine(line.id, {
                                      description: p.name,
                                      unit_price: p.default_price ?? 0,
                                      regular_price: p.default_price ?? 0,
                                    });
                                    setProductSearchOpen(null);
                                  }}
                                  className={`w-full text-left px-3 py-2 hover:bg-sky-500/10 transition-colors flex items-center justify-between gap-2 ${t.cardBorder} border-b last:border-b-0`}
                                >
                                  <span className={`text-[13px] font-bold truncate ${t.text}`}>{p.name}</span>
                                  {p.default_price != null && <span className={`text-[11px] font-mono ${t.textMuted} shrink-0`}>${p.default_price}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all"
                          aria-label="Remove line"
                          title="Remove line"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
                        </button>
                      </div>

                      {/* Row 2: Color picker + total + unit price */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <ColorPicker value={line.color} onChange={(c) => updateLine(line.id, { color: c })} t={t} isLight={isLight} />

                        <div className="flex-1" />

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>$/unit</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unit_price || ""}
                            onChange={(e) => updateLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className={inputSm + " w-20 text-right font-mono"}
                          />
                        </div>

                        <div className={`flex flex-col items-end shrink-0 px-2 ${qty > 0 ? "" : "opacity-40"}`}>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} leading-none`}>{qty} units</span>
                          <span className={`text-[13px] font-black font-mono leading-tight ${qty > 0 ? "text-emerald-500" : t.text}`}>${total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Row 3: Size matrix (scrolls horizontally on narrow widths) */}
                      <div className="flex items-end gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
                        {SIZE_KEYS.map(sz => (
                          <div key={sz} className="flex flex-col items-center shrink-0">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} leading-none mb-1`}>{SIZE_LABELS[sz]}</span>
                            <input
                              type="number"
                              min={0}
                              value={line[sz] || ""}
                              onChange={(e) => updateLine(line.id, { [sz]: parseInt(e.target.value) || 0 } as Partial<LineItem>)}
                              placeholder="0"
                              className={`w-10 text-center px-1 py-1.5 rounded text-[13px] font-bold font-mono outline-none border focus:border-sky-500 ${line[sz] > 0 ? (isLight ? "bg-sky-50 border-sky-300 text-sky-700" : "bg-sky-500/15 border-sky-500/50 text-sky-300") : (isLight ? "bg-white border-slate-200 text-slate-400" : "bg-[#0d0e13] border-white/10 text-slate-500")}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add buttons */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => addLine()}
                  className={`px-3 py-2 rounded-md border border-dashed text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${isLight ? "border-slate-300 text-slate-600 hover:border-sky-500 hover:text-sky-500" : "border-white/15 text-slate-400 hover:border-sky-500 hover:text-sky-400"}`}
                >
                  + Add Product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const last = lines[lines.length - 1];
                    addLine({ description: last.description, unit_price: last.unit_price, regular_price: last.regular_price, color: last.color === "Black" ? "White" : "Black" });
                  }}
                  className={`px-3 py-2 rounded-md text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${isLight ? "text-slate-500 hover:text-sky-500" : "text-slate-400 hover:text-sky-400"}`}
                  title="Add another color of the same product"
                >
                  + Color of last
                </button>

                <div className="flex-1" />

                <div className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>
                  {lines.filter(l => l.description.trim()).length} items · <span className={totalUnits > 0 ? t.text : ""}>{totalUnits} units</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECTION 4 — Print Specifications (xl: 4 of 12) ----------------- */}
          <SectionCard t={t} num={4} title="Print Specifications" className="md:col-span-1 xl:col-span-4">
            <div className="flex flex-col gap-3">

              <Field t={t} label="Print Method" required>
                <div className="flex flex-wrap gap-1.5">
                  {PRINT_METHODS.map(m => {
                    const active = printMethod === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPrintMethod(m)}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-widest transition-all border active:scale-95 ${
                          active
                            ? "bg-sky-500 text-white border-sky-400 shadow-md"
                            : isLight
                              ? "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                              : "bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/30 hover:text-slate-200"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field t={t} label={`Print Locations (${printLocations.length})`}>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRINT_LOCATIONS.map(loc => {
                    const active = printLocations.includes(loc);
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => togglePrintLocation(loc)}
                        className={`px-2.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-1.5 active:scale-95 ${
                          active
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-500"
                            : isLight
                              ? "bg-white border-slate-200 text-slate-500 hover:border-slate-400"
                              : "bg-white/[0.03] border-white/10 text-slate-500 hover:border-white/30 hover:text-slate-300"
                        }`}
                      >
                        {active && <span className="text-[10px] leading-none">✓</span>}
                        {loc}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field t={t} label="Number of Colors">
                <div className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border ${isLight ? "bg-white border-slate-200" : "bg-[#0d0e13] border-white/10"}`}>
                  <button
                    type="button"
                    onClick={() => setNumColors(c => Math.max(1, c - 1))}
                    className={`w-7 h-7 rounded flex items-center justify-center text-base font-black ${t.textMuted} hover:${t.text} hover:bg-white/[0.05] active:scale-95 transition-all`}
                    aria-label="Decrease colors"
                  >
                    −
                  </button>
                  <div className="flex-1 flex items-center gap-1.5">
                    <span className={`text-[15px] font-black font-mono ${t.text}`}>{numColors}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${t.textMuted}`}>{numColors === 1 ? "color" : "colors"}</span>
                    <div className="flex-1" />
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(numColors, 8) }).map((_, i) => (
                        <span
                          key={i}
                          className="w-3 h-3 rounded-full border border-slate-300"
                          style={{ backgroundColor: ["#111", "#fff", "#e60000", "#4169e1", "#ffc72c", "#009e60", "#6a0dad", "#ff7518"][i] }}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNumColors(c => Math.min(20, c + 1))}
                    className={`w-7 h-7 rounded flex items-center justify-center text-base font-black ${t.textMuted} hover:${t.text} hover:bg-white/[0.05] active:scale-95 transition-all`}
                    aria-label="Increase colors"
                  >
                    +
                  </button>
                </div>
              </Field>

              <Field t={t} label="Special Instructions">
                <textarea
                  rows={3}
                  value={printNotes}
                  onChange={(e) => setPrintNotes(e.target.value)}
                  placeholder="e.g. Use high-density ink for front design. Match PMS 186 C for red."
                  className={inputCls + " resize-none text-[12px] leading-snug"}
                />
              </Field>
            </div>
          </SectionCard>

          {/* SECTION 5 — Artwork / Files (xl: 4 of 12) ---------------------- */}
          <SectionCard t={t} num={5} title="Artwork / Files" className="md:col-span-1 xl:col-span-4">
            <div className="flex flex-col gap-3">

              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center text-center py-6 px-4 ${
                  isDragging
                    ? "border-sky-500 bg-sky-500/10"
                    : isLight
                      ? "border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/40"
                      : "border-white/15 bg-white/[0.02] hover:border-sky-500/50 hover:bg-sky-500/[0.04]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.ai,.psd,.eps"
                  onChange={(e) => handleUpload(e.target.files)}
                  className="hidden"
                />
                {isUploading ? (
                  <>
                    <div className="w-7 h-7 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className={`text-[11px] font-black uppercase tracking-widest ${t.text}`}>Uploading…</p>
                  </>
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`mb-1.5 ${t.textMuted}`}>
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className={`text-[12px] font-black uppercase tracking-widest ${t.text}`}>Drag & drop files here</p>
                    <p className={`text-[10px] font-medium ${t.textMuted} mt-0.5`}>or <span className="text-sky-500">click to browse</span></p>
                    <p className={`text-[9px] font-medium ${t.textMuted} mt-1`}>AI · PSD · PDF · EPS · PNG · JPG (max 200MB)</p>
                  </>
                )}
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className={`flex items-center justify-between text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>
                    <span>{files.length} file{files.length === 1 ? "" : "s"} attached</span>
                    <span>{files.filter(f => f.status === "print-ready").length} ready · {files.filter(f => f.status === "awaiting-approval").length} pending</span>
                  </div>
                  {files.map(f => (
                    <div key={f.id} className={`group flex items-center gap-2 p-2 rounded-md border ${isLight ? "bg-white border-slate-200" : "bg-white/[0.03] border-white/10"}`}>
                      {/* Thumbnail */}
                      <div className={`shrink-0 w-10 h-10 rounded-md overflow-hidden flex items-center justify-center ${isLight ? "bg-slate-100" : "bg-black/40"}`}>
                        {f.isImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-base">📄</span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className={`block text-[12px] font-bold truncate ${t.text} hover:text-sky-500`} title={f.name}>
                          {f.name}
                        </a>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] font-mono ${t.textMuted}`}>{formatFileSize(f.size)}</span>
                          <button
                            type="button"
                            onClick={() => setFileStatus(f.id, f.status === "print-ready" ? "awaiting-approval" : "print-ready")}
                            className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded transition-colors ${
                              f.status === "print-ready"
                                ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
                                : "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                            }`}
                            title="Click to toggle status"
                          >
                            {f.status === "print-ready" ? "✓ Print Ready" : "⏳ Awaiting Approval"}
                          </button>
                        </div>
                      </div>
                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeFile(f)}
                        className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all opacity-60 group-hover:opacity-100"
                        aria-label={`Remove ${f.name}`}
                        title="Remove file"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {/* SECTION 6 — Pricing Summary (xl: 4 of 12) ---------------------- */}
          <SectionCard t={t} num={6} title="Pricing Summary" className="md:col-span-2 xl:col-span-4">
            <div className="flex flex-col gap-1.5 text-[12px]">

              <PriceRow t={t} label="Subtotal" value={subtotal} mono />
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Setup Fees</span>
                <input
                  type="number" min={0} step={5}
                  value={setupFees || ""}
                  onChange={(e) => setSetupFees(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={inputSm + " w-24 text-right font-mono"}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Add-on Charges</span>
                <input
                  type="number" min={0} step={5}
                  value={addOnCharges || ""}
                  onChange={(e) => setAddOnCharges(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={inputSm + " w-24 text-right font-mono"}
                />
              </div>

              {rushOrder && (
                <PriceRow t={t} label="Rush Fee (15%)" value={rushFee} mono accent="rose" />
              )}

              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Shipping</span>
                <input
                  type="number" min={0} step={1}
                  value={shippingFee || ""}
                  onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={inputSm + " w-24 text-right font-mono"}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} flex items-center gap-1.5`}>
                  Tax
                  <input
                    type="number" min={0} max={30} step={0.25}
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className={`w-12 text-center font-mono text-[10px] py-0.5 px-1 rounded border outline-none focus:border-sky-500 ${t.inputBg}`}
                  />
                  <span>%</span>
                </span>
                <span className={`text-[12px] font-mono font-bold ${t.text}`}>${taxAmount.toFixed(2)}</span>
              </div>

              {paymentStatus === "Deposit Required" && (
                <PriceRow t={t} label={`Deposit (${depositPercent}%)`} value={-depositAmount} mono accent="emerald" />
              )}

              {/* Grand Total */}
              <div className={`flex items-center justify-between gap-2 mt-1 pt-2.5 border-t ${t.cardBorder}`}>
                <span className={`text-[12px] font-black uppercase tracking-widest ${t.text}`}>Grand Total</span>
                <span className="text-[20px] font-black font-mono text-sky-500 tracking-tight">${grandTotal.toFixed(2)}</span>
              </div>

              {/* Est. Profit / Margin */}
              {(estProfit !== 0 && grandTotal > 0) && (
                <div className={`flex items-center justify-between gap-2 mt-1`}>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Est. Profit / Margin</span>
                  <span className={`text-[11px] font-mono font-bold ${estProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    ${estProfit.toFixed(2)} ({estMarginPct.toFixed(1)}%)
                  </span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* SECTION 7 — Internal Notes (full width) ------------------------ */}
          <SectionCard t={t} num={7} title="Internal Notes / Production Notes" className="md:col-span-2 xl:col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field t={t} label="Special Instructions">
                <textarea
                  rows={3}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Customer wants extra soft feel on tees. Use low-cure ink."
                  className={inputCls + " resize-none text-[12px] leading-snug"}
                />
              </Field>
              <Field t={t} label="Packaging Notes">
                <textarea
                  rows={3}
                  value={packagingNotes}
                  onChange={(e) => setPackagingNotes(e.target.value)}
                  placeholder="Fold & bag individually. Include thank-you card."
                  className={inputCls + " resize-none text-[12px] leading-snug"}
                />
              </Field>
              <Field t={t} label="QC Notes">
                <textarea
                  rows={3}
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  placeholder="Check print alignment on hoodies. Verify logo placement on caps."
                  className={inputCls + " resize-none text-[12px] leading-snug"}
                />
              </Field>
            </div>
          </SectionCard>

          {/* SECTION 8 — Workflow / Next Steps (full width) — Phase 5 ------- */}
          <SectionCard t={t} num={8} title="Workflow / Next Steps" hint="Phase 5" className="md:col-span-2 xl:col-span-12" placeholder="Quote Sent → Artwork Approval → Deposit → To Buy → To Print → To Press → Packaging → Ready" />
        </div>

        {/* ─── RIGHT SIDEBAR ───────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-[78px] lg:h-fit min-w-0">

          {/* Order Summary (live) */}
          <div className={`${t.cardBg} ${t.cardBorder} ${t.cardShadow} border rounded-xl overflow-hidden`}>
            <header className={`flex items-center justify-between gap-3 px-3.5 py-2.5 border-b ${t.cardBorder}`}>
              <h3 className={`text-[11px] font-black uppercase tracking-widest ${t.text}`}>Order Summary</h3>
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </header>
            <dl className="px-3.5 py-3 text-xs space-y-2">
              <Row label="Order #" value={orderNumber} mono />
              <Row label="Customer" value={selectedCustomer?.company_name || companyName || "—"} highlight={!!selectedCustomer} vip={!!(selectedCustomer?.vip_tier && /vip/i.test(selectedCustomer.vip_tier))} />
              <Row
                label="Due Date"
                value={dueDate ? new Date(dueDate + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                suffix={dueInDays !== null ? <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${dueInDays < 0 ? "bg-rose-500/15 text-rose-500" : dueInDays <= 7 ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"}`}>{dueInDays < 0 ? `${Math.abs(dueInDays)}d late` : `${dueInDays}d left`}</span> : null}
              />
              <Row label="Total Units" value={totalUnits.toString()} highlight={totalUnits > 0} />
              <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} mono highlight={subtotal > 0} />
              <Row label="Grand Total" value={`$${grandTotal.toFixed(2)}`} mono highlight={grandTotal > 0} suffix={paymentStatus === "Deposit Required" && depositAmount > 0 ? <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500">Dep ${depositAmount.toFixed(0)}</span> : null} />
              <Row label="Order Type" value={orderType} />
              <Row label="Payment" value={paymentStatus} suffix={paymentStatus === "Deposit Required" ? <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">{depositPercent}%</span> : null} />
              <Row label="Sales Rep" value={salesRep} />
              <Row label="Delivery" value={deliveryMethod} capitalize />
              {rushOrder && (
                <div className="flex items-center justify-between pt-2 border-t border-rose-500/20">
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">⚡ Rush Order</span>
                  <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500 text-white">+15%</span>
                </div>
              )}
            </dl>
          </div>

          {/* Timeline / Checklist (Phase 5 placeholder) */}
          <div className={`${t.cardBg} ${t.cardBorder} ${t.cardShadow} border rounded-xl overflow-hidden opacity-60`}>
            <header className={`flex items-center justify-between gap-3 px-3.5 py-2.5 border-b ${t.cardBorder}`}>
              <h3 className={`text-[11px] font-black uppercase tracking-widest ${t.text}`}>Timeline / Checklist</h3>
              <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.04] text-slate-500'}`}>Phase 5</span>
            </header>
            <div className={`px-3.5 py-4 text-center text-[11px] ${t.textMuted}`}>0 of 7 steps</div>
          </div>

          {/* Mockup Preview (Phase 5 placeholder) */}
          <div className={`${t.cardBg} ${t.cardBorder} ${t.cardShadow} border rounded-xl overflow-hidden opacity-60`}>
            <header className={`flex items-center justify-between gap-3 px-3.5 py-2.5 border-b ${t.cardBorder}`}>
              <h3 className={`text-[11px] font-black uppercase tracking-widest ${t.text}`}>Mockup Preview</h3>
              <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.04] text-slate-500'}`}>Phase 5</span>
            </header>
            <div className={`aspect-[16/10] flex items-center justify-center text-[11px] ${t.textMuted}`}>No mockups attached</div>
          </div>
        </aside>
      </div>

      <div className="h-4" />
    </div>
  );
}

// ── Helpers (defined OUTSIDE the page component so React keeps the same
//    component identity across renders — otherwise inputs lose focus on every
//    keystroke as the parent re-renders and remounts the children) ──────────

function SectionCard({
  num, title, hint, children, className = "", placeholder, t,
}: {
  num: number;
  title: string;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
  placeholder?: string;
  t: ThemeTokens;
}) {
  return (
    <section className={`${t.cardBg} ${t.cardBorder} ${t.cardShadow} border rounded-xl flex flex-col ${className} ${placeholder ? "opacity-60" : ""}`}>
      <header className={`flex items-center gap-2.5 px-3.5 py-2.5 border-b ${t.cardBorder}`}>
        <span className={`${placeholder ? "bg-slate-400" : "bg-sky-500"} text-white w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shrink-0`}>{num}</span>
        <h2 className={`text-[13px] font-black ${t.text} flex-1 truncate`}>{title}</h2>
        {hint && <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${t.hintBg}`}>{hint}</span>}
      </header>
      <div className="p-3.5 flex-1">
        {placeholder ? (
          <div className={`h-full min-h-[120px] flex items-center justify-center text-[11px] font-medium ${t.textMuted}`}>
            {placeholder}
          </div>
        ) : children}
      </div>
    </section>
  );
}

function Field({
  label, required, children, t,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  t: ThemeTokens;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-[9px] font-black uppercase tracking-[0.12em] ${t.textMuted}`}>
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

// Color picker — button shows the current swatch + name; clicking opens a
// grid of every garment colour from the mockup-v2 palette. Defined outside
// the page component for stable identity (otherwise inputs in the page
// would lose focus on every render).
function ColorPicker({ value, onChange, t, isLight }: {
  value: string;
  onChange: (c: string) => void;
  t: ThemeTokens;
  isLight: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hex = colorHex(value);
  const isLightSwatch = ["#FFFFFF", "#F8F8FF", "#EBE5D5", "#FFF8DC"].includes(hex);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md border outline-none transition-colors hover:border-sky-500 ${t.inputBg}`}
      >
        <span
          className={`w-4 h-4 rounded-full shrink-0 ${isLightSwatch ? "border border-slate-300" : ""}`}
          style={{ backgroundColor: hex }}
        />
        <span className="text-[12px] font-bold truncate">{value}</span>
        <span className={`text-[9px] ${t.textMuted}`}>▼</span>
      </button>

      {open && (
        <div className={`absolute top-full left-0 mt-1 w-72 ${t.cardBg} ${t.cardBorder} border rounded-md shadow-2xl z-30 p-2 max-h-72 overflow-y-auto`}>
          <div className="grid grid-cols-6 gap-1">
            {ALL_COLORS.map(c => {
              const cHex = colorHex(c);
              const cLight = ["#FFFFFF", "#F8F8FF", "#EBE5D5", "#FFF8DC"].includes(cHex);
              const selected = c === value;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); }}
                  title={c}
                  className={`relative w-8 h-8 rounded-md transition-all hover:scale-110 active:scale-95 ${cLight ? "border border-slate-300" : ""} ${selected ? "ring-2 ring-sky-500 ring-offset-2 " + (isLight ? "ring-offset-white" : "ring-offset-[#13141a]") : ""}`}
                  style={{ backgroundColor: cHex }}
                />
              );
            })}
          </div>
          <div className={`mt-2 pt-2 border-t ${t.cardBorder} text-[10px] font-bold ${t.textMuted} text-center`}>
            {value}
          </div>
        </div>
      )}
    </div>
  );
}

function PriceRow({
  label, value, mono, accent, t,
}: {
  label: string;
  value: number;
  mono?: boolean;
  accent?: "rose" | "emerald" | "amber";
  t: ThemeTokens;
}) {
  const valueColor = accent === "rose" ? "text-rose-500" : accent === "emerald" ? "text-emerald-500" : accent === "amber" ? "text-amber-500" : t.text;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>{label}</span>
      <span className={`text-[12px] font-bold ${mono ? "font-mono" : ""} ${valueColor}`}>
        {value < 0 ? `−$${Math.abs(value).toFixed(2)}` : `$${value.toFixed(2)}`}
      </span>
    </div>
  );
}

function Row({
  label, value, mono, highlight, vip, suffix, capitalize, muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  vip?: boolean;
  suffix?: React.ReactNode;
  capitalize?: boolean;
  muted?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
      <span className="flex items-center gap-1.5 min-w-0 justify-end">
        <span className={`text-[12px] font-bold truncate ${mono ? "font-mono" : ""} ${capitalize ? "capitalize" : ""} ${highlight ? "text-sky-500" : "text-slate-900 dark:text-white"}`}>
          {value}
          {muted && <span className="text-slate-500 dark:text-slate-500 ml-1 font-medium text-[10px]">{muted}</span>}
        </span>
        {vip && <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded">VIP ★</span>}
        {suffix}
      </span>
    </div>
  );
}
