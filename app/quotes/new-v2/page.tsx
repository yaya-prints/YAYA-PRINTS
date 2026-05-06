"use client";

// =============================================================================
// CREATE NEW ORDER — V2 (Phase 1, dense-grid layout)
// =============================================================================
// Parallel page at /quotes/new-v2 for the new "Create Order" UX.
// Phase 1: shell, header, Customer Information, Order Details, right sidebar.
// Layout uses a 12-column grid so sections sit side-by-side like the
// reference design, minimizing vertical scroll on desktop.
// =============================================================================

import { useState, useEffect, useMemo } from "react";
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

type ThemeTokens = {
  pageBg: string; text: string; textMuted: string;
  cardBg: string; cardBorder: string; cardShadow: string;
  inputBg: string; primaryBtn: string; secondaryBtn: string;
  hintBg: string;
};

// ---- CONSTANTS --------------------------------------------------------------
const GILDAN_COLORS = ["White", "Black", "Navy", "Sport Grey", "Red", "Royal", "Dark Heather", "Charcoal", "Forest Green", "Gold", "Maroon", "Safety Pink", "Safety Orange"];
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

                      {/* Top row: product + color + total + delete */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="text"
                            value={line.description}
                            placeholder="Product / style…"
                            onChange={(e) => updateLine(line.id, { description: e.target.value })}
                            onFocus={() => setProductSearchOpen(line.id)}
                            onBlur={() => setTimeout(() => setProductSearchOpen(prev => prev === line.id ? null : prev), 150)}
                            className={inputSm}
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
                                  className={`w-full text-left px-2.5 py-1.5 hover:bg-sky-500/10 transition-colors flex items-center justify-between gap-2 ${t.cardBorder} border-b last:border-b-0`}
                                >
                                  <span className={`text-[12px] font-bold truncate ${t.text}`}>{p.name}</span>
                                  {p.default_price != null && <span className={`text-[10px] font-mono ${t.textMuted} shrink-0`}>${p.default_price}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <select
                          value={line.color}
                          onChange={(e) => updateLine(line.id, { color: e.target.value })}
                          className={inputSm + " w-24 shrink-0 cursor-pointer"}
                        >
                          {GILDAN_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <div className={`flex flex-col items-end shrink-0 ${qty > 0 ? "" : "opacity-40"}`}>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} leading-none`}>{qty} units</span>
                          <span className={`text-[12px] font-black font-mono ${t.text} leading-tight`}>${total.toFixed(2)}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all`}
                          aria-label="Remove line"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
                        </button>
                      </div>

                      {/* Sizes row + unit price */}
                      <div className="flex items-end gap-2 overflow-x-auto no-scrollbar">
                        {SIZE_KEYS.map(sz => (
                          <div key={sz} className="flex flex-col items-center shrink-0">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} leading-none mb-0.5`}>{SIZE_LABELS[sz]}</span>
                            <input
                              type="number"
                              min={0}
                              value={line[sz] || ""}
                              onChange={(e) => updateLine(line.id, { [sz]: parseInt(e.target.value) || 0 } as Partial<LineItem>)}
                              placeholder="0"
                              className={`w-9 text-center px-1 py-1 rounded text-[12px] font-bold font-mono outline-none border focus:border-sky-500 ${line[sz] > 0 ? (isLight ? "bg-white border-sky-300 text-sky-700" : "bg-sky-500/10 border-sky-500/40 text-sky-300") : (isLight ? "bg-white border-slate-200 text-slate-400" : "bg-[#0d0e13] border-white/10 text-slate-600")}`}
                            />
                          </div>
                        ))}
                        <div className="flex-1" />
                        <div className="flex flex-col items-end shrink-0 ml-1">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} leading-none mb-0.5`}>$/unit</span>
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

          {/* SECTION 4 — Print Specifications (xl: 4 of 12) — Phase 3 ------- */}
          <SectionCard t={t} num={4} title="Print Specifications" hint="Phase 3" className="md:col-span-1 xl:col-span-4" placeholder="DTF / Screen / Embroidery / Vinyl + locations + colors" />

          {/* SECTION 5 — Artwork / Files (xl: 4 of 12) — Phase 3 ------------ */}
          <SectionCard t={t} num={5} title="Artwork / Files" hint="Phase 3" className="md:col-span-1 xl:col-span-4" placeholder="Drag & drop with print-ready / awaiting-approval status" />

          {/* SECTION 6 — Pricing Summary (xl: 4 of 12) — Phase 4 ------------ */}
          <SectionCard t={t} num={6} title="Pricing Summary" hint="Phase 4" className="md:col-span-2 xl:col-span-4" placeholder="Auto-calculates from line items + setup + rush + tax" />

          {/* SECTION 7 — Internal Notes (full width) — Phase 4 -------------- */}
          <SectionCard t={t} num={7} title="Internal Notes / Production Notes" hint="Phase 4" className="md:col-span-2 xl:col-span-12" placeholder="Special Instructions • Packaging Notes • QC Notes — three-column layout" />

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
