"use client";

// =============================================================================
// CREATE NEW ORDER — V2 (Phase 1)
// =============================================================================
// Parallel page at /quotes/new-v2 for the new "Create Order" UX.
// Phase 1: shell, header, Customer Information, Order Details, right sidebar.
// Subsequent phases will add: Garment table, Print Specs, Artwork upload,
// Pricing summary, Internal Notes, Workflow steps, save logic.
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

// ---- COMPONENT --------------------------------------------------------------
export default function CreateNewOrderV2() {
  const router = useRouter();

  // ---- THEME (use system theme set by global layout) -----------------------
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    const t = localStorage.getItem("yaya-theme");
    setIsLight(t === "light");
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

  // Inline customer form fields (populated when an existing customer is selected,
  // editable when creating a new one)
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

  // ---- LOAD CUSTOMERS -------------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, company_name, contact_name, email, phone, vip_tier, address")
        .order("company_name");
      if (data) setCustomers(data as Customer[]);
    })();
  }, []);

  // When user picks an existing customer, hydrate the form
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

  // ---- THEME TOKENS ---------------------------------------------------------
  const t = {
    pageBg: isLight ? "bg-slate-50" : "bg-[#0a0b0f]",
    text: isLight ? "text-slate-900" : "text-slate-100",
    textMuted: isLight ? "text-slate-500" : "text-slate-400",
    cardBg: isLight ? "bg-white" : "bg-[#13141a]",
    cardBorder: isLight ? "border-slate-200" : "border-white/5",
    inputBg: isLight ? "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400" : "bg-[#0d0e13] border-white/10 text-white placeholder:text-slate-600",
    chipInactive: isLight ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200" : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10",
    sectionBadge: "bg-sky-500 text-white",
    primaryBtn: "bg-sky-500 hover:bg-sky-400 text-white shadow-[0_8px_24px_-8px_rgba(14,165,233,0.6)]",
    secondaryBtn: isLight ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10",
  };

  // ---- HEADERS / SECTION SHELL ---------------------------------------------
  const SectionCard = ({ num, title, children }: { num: number; title: string; children: React.ReactNode }) => (
    <section className={`${t.cardBg} ${t.cardBorder} border rounded-2xl shadow-sm`}>
      <header className={`flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b ${t.cardBorder}`}>
        <span className={`${t.sectionBadge} w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0`}>{num}</span>
        <h2 className={`text-sm sm:text-base font-black ${t.text}`}>{title}</h2>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );

  const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <label className="flex flex-col gap-1.5">
      <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>
        {label}{required && <span className="text-rose-500 ml-1">*</span>}
      </span>
      {children}
    </label>
  );

  const inputCls = `w-full rounded-lg border px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus:border-sky-500 ${t.inputBg}`;

  // ---- SAVE STUBS (Phase 6 will wire them up) -------------------------------
  const saveDraft = () => alert("Save Draft will be wired in Phase 6.");
  const sendQuote = () => alert("Send Quote will be wired in Phase 6.");
  const createOrder = () => alert("Create Order will be wired in Phase 6.");

  return (
    <div className={`${t.pageBg} ${t.text} min-h-screen transition-colors duration-300`}>

      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div className={`${t.cardBg} ${t.cardBorder} border-b sticky top-0 z-30 backdrop-blur`}>
        <div className="max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-8 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-6">
          <div className="min-w-0">
            <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${t.text}`}>Create New Order</h1>
            <p className={`text-[11px] sm:text-xs font-medium ${t.textMuted} mt-0.5`}>
              Capture everything needed to move a job from quote to production without mistakes.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={saveDraft} className={`${t.secondaryBtn} px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 min-h-[44px] active:scale-95 transition-all`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save Draft
            </button>
            <button onClick={sendQuote} className={`${t.secondaryBtn} px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 min-h-[44px] active:scale-95 transition-all`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send Quote
            </button>
            <button onClick={createOrder} className={`${t.primaryBtn} px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 min-h-[44px] active:scale-95 transition-all`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
              Create Order
            </button>
          </div>
        </div>
      </div>

      {/* ─── BODY GRID ─────────────────────────────────────────────────────── */}
      <div className="max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-8 py-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-5">

        {/* ─── MAIN COLUMN ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 min-w-0">

          {/* SECTION 1 — Customer Information ----------------------------- */}
          <SectionCard num={1} title="Customer Information">
            <div className="flex flex-col gap-4">

              {/* Customer search */}
              <div className="relative">
                <Field label="Customer / Company" required>
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
                      placeholder="Search clients or type a new company name…"
                      className={inputCls + " pr-9"}
                    />
                    {selectedCustomerId && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Linked</span>
                    )}
                  </div>
                </Field>

                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className={`absolute top-full left-0 right-0 mt-1.5 ${t.cardBg} ${t.cardBorder} border rounded-lg shadow-2xl overflow-hidden z-20 max-h-72 overflow-y-auto`}>
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
                        className={`w-full text-left px-3.5 py-2.5 hover:bg-sky-500/10 transition-colors flex items-center justify-between gap-3 ${t.cardBorder} border-b last:border-b-0`}
                      >
                        <div className="min-w-0">
                          <div className={`text-sm font-black truncate ${t.text}`}>{c.company_name}</div>
                          {c.contact_name && <div className={`text-[10px] font-medium truncate ${t.textMuted}`}>{c.contact_name}</div>}
                        </div>
                        {c.vip_tier && /vip/i.test(c.vip_tier) && <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-1 rounded shrink-0">VIP ★</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact + Email row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="Contact Person" required>
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Mike Johnson" className={inputCls} />
                </Field>
                <Field label="Email" required>
                  <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mike@company.com" className={inputCls} />
                </Field>
              </div>

              {/* Phone + Customer Type row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="Phone" required>
                  <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 214-9876" className={inputCls} />
                </Field>
                <Field label="Customer Type">
                  <div className={`flex gap-1.5 p-1 rounded-lg ${isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
                    {(["vip", "repeat", "new"] as CustomerType[]).map(ct => {
                      const active = customerType === ct;
                      const accent = ct === "vip" ? "amber" : ct === "repeat" ? "sky" : "emerald";
                      const label = ct === "vip" ? "VIP ★" : ct === "repeat" ? "↻ Repeat" : "+ New";
                      return (
                        <button
                          key={ct}
                          type="button"
                          onClick={() => setCustomerType(ct)}
                          className={`flex-1 px-3 py-2 rounded-md text-[11px] font-black uppercase tracking-widest transition-all ${
                            active
                              ? `bg-${accent}-500 text-white shadow-md`
                              : `${t.textMuted} hover:${t.text}`
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>

              {/* Billing + Shipping addresses */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                <Field label="Billing Address">
                  <textarea rows={3} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="123 Fitness Way&#10;Suite 100&#10;Austin, TX 78701" className={inputCls + " resize-none"} />
                </Field>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Shipping Address</span>
                    <label className={`flex items-center gap-1.5 text-[10px] font-bold ${t.textMuted} cursor-pointer select-none`}>
                      <input type="checkbox" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} className="accent-sky-500" />
                      Same as billing
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    value={sameAsBilling ? billingAddress : shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    disabled={sameAsBilling}
                    placeholder={sameAsBilling ? "" : "123 Warehouse Ln…"}
                    className={inputCls + " resize-none disabled:opacity-60"}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECTION 2 — Order Details ---------------------------------- */}
          <SectionCard num={2} title="Order Details">
            <div className="flex flex-col gap-4">

              {/* Order # + Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="Order Number" required>
                  <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className={inputCls + " font-mono"} />
                </Field>
                <Field label="Due Date" required>
                  <div className="relative">
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
                    {dueInDays !== null && (
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded pointer-events-none ${
                        dueInDays < 0 ? "text-rose-500 bg-rose-500/10" : dueInDays <= 7 ? "text-amber-500 bg-amber-500/10" : "text-emerald-500 bg-emerald-500/10"
                      }`}>
                        {dueInDays < 0 ? `${Math.abs(dueInDays)}d overdue` : `${dueInDays}d left`}
                      </span>
                    )}
                  </div>
                </Field>
              </div>

              {/* Rush Order toggle */}
              <Field label="Rush Order">
                <div className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg border ${rushOrder ? "bg-rose-500/10 border-rose-500/30" : isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"}`}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rushOrder}
                      onClick={() => setRushOrder(!rushOrder)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${rushOrder ? "bg-rose-500" : isLight ? "bg-slate-300" : "bg-white/15"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rushOrder ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                    <span className={`text-sm font-bold ${t.text}`}>{rushOrder ? "Rush — expedite production" : "Standard timeline"}</span>
                  </div>
                  {rushOrder && (
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-rose-500 text-white">Rush Fee 15%</span>
                  )}
                </div>
              </Field>

              {/* Order Type */}
              <Field label="Order Type" required>
                <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)} className={inputCls + " appearance-none cursor-pointer"}>
                  <option>Custom Apparel</option>
                  <option>Promotional</option>
                  <option>Embroidery Only</option>
                  <option>DTF Transfers</option>
                  <option>Other</option>
                </select>
              </Field>

              {/* Sales Rep + Payment Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field label="Sales Rep" required>
                  <input value={salesRep} onChange={(e) => setSalesRep(e.target.value)} placeholder="Alex Morgan" className={inputCls} />
                </Field>
                <Field label="Payment Status">
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)} className={inputCls + " appearance-none cursor-pointer"}>
                    <option>Deposit Required</option>
                    <option>Paid in Full</option>
                    <option>Net 15</option>
                    <option>Net 30</option>
                  </select>
                </Field>
              </div>

              {/* Deposit % (only when applicable) */}
              {paymentStatus === "Deposit Required" && (
                <Field label={`Deposit (${depositPercent}%)`}>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={100} step={5} value={depositPercent} onChange={(e) => setDepositPercent(parseInt(e.target.value))} className="flex-1 accent-sky-500" />
                    <input type="number" min={0} max={100} value={depositPercent} onChange={(e) => setDepositPercent(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} className={inputCls + " w-20 text-center font-mono"} />
                  </div>
                </Field>
              )}

              {/* Delivery Method */}
              <Field label="Delivery Method" required>
                <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-lg ${isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
                  {(["pickup", "delivery", "shipping"] as DeliveryMethod[]).map(dm => {
                    const active = deliveryMethod === dm;
                    return (
                      <button
                        key={dm}
                        type="button"
                        onClick={() => setDeliveryMethod(dm)}
                        className={`px-3 py-2.5 rounded-md text-[11px] font-black uppercase tracking-widest capitalize transition-all min-h-[40px] ${
                          active ? "bg-sky-500 text-white shadow-md" : `${t.textMuted} hover:${t.text}`
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

          {/* PHASE 2+ PLACEHOLDERS ----------------------------------------- */}
          {[
            { num: 3, title: "Garment / Product Selection", phase: 2 },
            { num: 4, title: "Print Specifications",        phase: 3 },
            { num: 5, title: "Artwork / Files",             phase: 3 },
            { num: 6, title: "Pricing Summary",             phase: 4 },
            { num: 7, title: "Internal Notes",              phase: 4 },
            { num: 8, title: "Workflow / Next Steps",       phase: 5 },
          ].map(s => (
            <section key={s.num} className={`${t.cardBg} ${t.cardBorder} border rounded-2xl shadow-sm opacity-60`}>
              <header className={`flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b ${t.cardBorder}`}>
                <span className={`bg-slate-400 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0`}>{s.num}</span>
                <h2 className={`text-sm sm:text-base font-black ${t.text}`}>{s.title}</h2>
                <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/5 text-slate-500'}`}>Phase {s.phase}</span>
              </header>
              <div className={`p-6 text-center text-xs ${t.textMuted}`}>
                Coming in Phase {s.phase}
              </div>
            </section>
          ))}
        </div>

        {/* ─── RIGHT SIDEBAR ───────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[88px] lg:h-fit">

          {/* Order Summary (live) */}
          <div className={`${t.cardBg} ${t.cardBorder} border rounded-2xl shadow-sm overflow-hidden`}>
            <header className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${t.cardBorder}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest ${t.text}`}>Order Summary</h3>
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </header>
            <dl className="px-4 py-3 text-xs space-y-2.5">
              <Row label="Order Number" value={orderNumber} mono />
              <Row label="Customer" value={selectedCustomer?.company_name || companyName || "—"} highlight={!!selectedCustomer} vip={!!(selectedCustomer?.vip_tier && /vip/i.test(selectedCustomer.vip_tier))} />
              <Row label="Due Date" value={dueDate ? new Date(dueDate + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"} suffix={dueInDays !== null ? <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${dueInDays < 0 ? "bg-rose-500/15 text-rose-500" : dueInDays <= 7 ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"}`}>{dueInDays < 0 ? `${Math.abs(dueInDays)}d late` : `${dueInDays}d left`}</span> : null} />
              <Row label="Total Units" value="0" muted="(Phase 2)" />
              <Row label="Order Type" value={orderType} />
              <Row label="Payment Status" value={paymentStatus} suffix={paymentStatus === "Deposit Required" ? <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">{depositPercent}%</span> : null} />
              <Row label="Sales Rep" value={salesRep} />
              <Row label="Delivery" value={deliveryMethod} capitalize />
              {rushOrder && (
                <div className="flex items-center justify-between pt-2 border-t border-rose-500/20">
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">⚡ Rush Order</span>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500 text-white">+15%</span>
                </div>
              )}
            </dl>
          </div>

          {/* Timeline / Checklist (Phase 5 placeholder) */}
          <div className={`${t.cardBg} ${t.cardBorder} border rounded-2xl shadow-sm overflow-hidden opacity-60`}>
            <header className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${t.cardBorder}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest ${t.text}`}>Timeline / Checklist</h3>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/5 text-slate-500'}`}>Phase 5</span>
            </header>
            <div className={`px-4 py-6 text-center text-[11px] ${t.textMuted}`}>0 of 7 steps</div>
          </div>

          {/* Mockup Preview (Phase 5 placeholder) */}
          <div className={`${t.cardBg} ${t.cardBorder} border rounded-2xl shadow-sm overflow-hidden opacity-60`}>
            <header className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${t.cardBorder}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest ${t.text}`}>Mockup Preview</h3>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/5 text-slate-500'}`}>Phase 5</span>
            </header>
            <div className={`aspect-video flex items-center justify-center text-[11px] ${t.textMuted}`}>No mockups attached</div>
          </div>
        </aside>
      </div>

      {/* spacer for sticky bottom on mobile */}
      <div className="h-6" />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
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
        <span className={`text-xs font-bold truncate ${mono ? "font-mono" : ""} ${capitalize ? "capitalize" : ""} ${highlight ? "text-sky-500" : "text-slate-900 dark:text-white"}`}>
          {value}
          {muted && <span className="text-slate-500 dark:text-slate-500 ml-1 font-medium text-[10px]">{muted}</span>}
        </span>
        {vip && <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/15 px-1.5 py-0.5 rounded">VIP ★</span>}
        {suffix}
      </span>
    </div>
  );
}
