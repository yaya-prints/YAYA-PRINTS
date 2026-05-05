"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// =====================================================================
// PRINT MANAGEMENT — Daily summaries (Purchase / Print / Press / Invoice)
//                  + per-job production & garment labels
// =====================================================================

// ---- TAB CONFIG: maps each tab to the production stage(s) it covers ----
type TabKey = "purchase" | "print" | "press" | "invoice";

const TABS: {
  key: TabKey;
  label: string;
  stages: string[];                   // jobs.stage values that belong here
  accent: string;                     // tailwind accent (border + text)
  pillBg: string;                     // tab pill background when active
  pillIdle: string;                   // tab pill background when idle
  printTitle: string;                 // big title on the printed page
}[] = [
  {
    key: "purchase",
    label: "Purchase",
    stages: ["Sourcing", "Ordered"],
    accent: "border-amber-500 text-amber-600 dark:text-amber-400",
    pillBg: "bg-amber-500 text-white border-amber-600",
    pillIdle: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    printTitle: "DAILY PURCHASE LIST",
  },
  {
    key: "print",
    label: "Print",
    stages: ["Printing"],
    accent: "border-indigo-500 text-indigo-600 dark:text-indigo-400",
    pillBg: "bg-indigo-500 text-white border-indigo-600",
    pillIdle: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30",
    printTitle: "DAILY PRINT LIST",
  },
  {
    key: "press",
    label: "Press",
    stages: ["Pressing"],
    accent: "border-violet-500 text-violet-600 dark:text-violet-400",
    pillBg: "bg-violet-500 text-white border-violet-600",
    pillIdle: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 border-violet-200 dark:border-violet-500/30",
    printTitle: "DAILY PRESS LIST",
  },
  {
    key: "invoice",
    label: "Invoice",
    stages: ["Billing"],
    accent: "border-rose-500 text-rose-600 dark:text-rose-400",
    pillBg: "bg-rose-500 text-white border-rose-600",
    pillIdle: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
    printTitle: "DAILY INVOICE LIST",
  },
];

// Sizes recognised on a quote_item_variant row
const SIZE_KEYS = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl"] as const;
const SIZE_LABELS: Record<string, string> = {
  xs: "XS", s: "S", m: "M", l: "L", xl: "XL", xxl: "2XL", xxxl: "3XL", xxxxl: "4XL", xxxxxl: "5XL",
};

// Build a compact human-readable size:qty breakdown for a list of variants
function variantSizeBreakdown(variants: any[] = []): string {
  const totals: Record<string, number> = {};
  for (const v of variants) {
    for (const k of SIZE_KEYS) {
      const q = Number(v?.[k] || 0);
      if (q > 0) totals[k] = (totals[k] || 0) + q;
    }
  }
  const parts = SIZE_KEYS
    .filter(k => totals[k])
    .map(k => `${SIZE_LABELS[k]}×${totals[k]}`);
  return parts.join("  ");
}

// Quoted price = sum(variant.qty * variant.unit_price) OR fallback (qty * item.unit_price)
function quotedPriceForItem(item: any): number {
  const variants: any[] = item?.quote_item_variants || [];
  let total = 0;
  let hadVariantPriced = false;
  for (const v of variants) {
    const sizeQty = SIZE_KEYS.reduce((s, k) => s + Number(v?.[k] || 0), 0);
    const price = Number(v?.unit_price || 0);
    if (price > 0 && sizeQty > 0) {
      hadVariantPriced = true;
      total += sizeQty * price;
    }
  }
  if (hadVariantPriced) return total;
  // Fallback: line-level price
  const qty = Number(item?.quantity || 0);
  const unit = Number(item?.unit_price || 0);
  return qty * unit;
}

// Sum quoted price for an entire job
function quotedPriceForJob(job: any): number {
  const items: any[] = job?.quotes?.quote_items || [];
  const itemsTotal = items.reduce((s, it) => s + quotedPriceForItem(it), 0);
  if (itemsTotal > 0) return itemsTotal;
  return Number(job?.quotes?.total_amount || 0);
}

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
};

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export default function PrintCenter() {
  const [activeTab, setActiveTab] = useState<TabKey>("print");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>(""); // YYYY-MM-DD or ""
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Per-job label state
  const [labelJobId, setLabelJobId] = useState<string>("");
  const [labelType, setLabelType] = useState<"prod-4x6" | "prod-2x1" | "garment-2x1">("prod-4x6");

  // ----- LOAD DATA -----
  const loadJobs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select(
        `id, job_number, title, stage, due_date, technical_notes, updated_at,
         quotes(id, total_amount,
           customers(id, company_name, contact_name),
           quote_items(id, description, quantity, unit_price,
             quote_item_variants(id, color, xs, s, m, l, xl, xxl, xxxl, xxxxl, xxxxxl, unit_price)))`
      )
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) console.error("Print Center DB Error:", error);
    if (data) setJobs(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Reset selection when switching tabs
  useEffect(() => { setSelectedIds(new Set()); }, [activeTab]);

  // ----- FILTERED JOBS FOR ACTIVE TAB -----
  const tabConfig = useMemo(() => TABS.find(t => t.key === activeTab)!, [activeTab]);

  const tabJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs.filter(j => {
      if (!tabConfig.stages.includes(j.stage)) return false;
      if (dateFilter && j.due_date) {
        // due_date may be 'YYYY-MM-DD' or full ISO — compare on the date portion
        const jd = String(j.due_date).slice(0, 10);
        if (jd !== dateFilter) return false;
      }
      if (q) {
        const hay = [
          j.title,
          j.job_number,
          j.quotes?.customers?.company_name,
          j.quotes?.customers?.contact_name,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, tabConfig, dateFilter, searchQuery]);

  // Selected rows for printing — keep stable order matching tabJobs
  const selectedJobs = useMemo(
    () => tabJobs.filter(j => selectedIds.has(j.id)),
    [tabJobs, selectedIds]
  );

  // Selected job for label printing
  const labelJob = useMemo(
    () => jobs.find(j => j.id === labelJobId) || null,
    [jobs, labelJobId]
  );

  // ----- HANDLERS -----
  const toggleOne = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (selectedIds.size === tabJobs.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(tabJobs.map(j => j.id)));
  };

  const handlePrintList = () => {
    if (selectedJobs.length === 0) {
      alert("Select at least one job to print.");
      return;
    }
    document.body.classList.add("printing-list");
    document.body.classList.remove("printing-label");
    // Defer to next tick so React paints the print-only DOM first
    setTimeout(() => {
      window.print();
      document.body.classList.remove("printing-list");
    }, 50);
  };

  const handlePrintLabel = () => {
    if (!labelJob) {
      alert("Pick a job first.");
      return;
    }
    document.body.classList.add("printing-label");
    document.body.classList.remove("printing-list");
    document.body.dataset.labelType = labelType;
    setTimeout(() => {
      window.print();
      document.body.classList.remove("printing-label");
      delete document.body.dataset.labelType;
    }, 50);
  };

  // =====================================================================
  // RENDER
  // =====================================================================
  return (
    <div className="min-h-[calc(100vh-70px)] bg-slate-50 dark:bg-[#0f1115] text-slate-900 dark:text-slate-100 transition-colors duration-300">

      {/* ============ PRINT-ONLY STYLES ============ */}
      <style jsx global>{`
        /* Hide print-only DOM during normal screen use */
        .print-only { display: none !important; }

        @media print {
          /* Hide everything; un-hide only the active print surface */
          body * { visibility: hidden !important; }
          body.printing-list  .print-list,
          body.printing-list  .print-list  * { visibility: visible !important; }
          body.printing-label .print-label,
          body.printing-label .print-label * { visibility: visible !important; }

          .print-only   { display: block !important; }
          .screen-only  { display: none  !important; }

          .print-list, .print-label {
            position: absolute !important;
            left: 0; top: 0; right: 0;
            background: #fff !important;
            color: #000 !important;
          }
          .print-list * { color: #000 !important; }

          /* Don't split a job row across pages */
          .print-row { break-inside: avoid; page-break-inside: avoid; }

          /* Show only the chosen label variant */
          body.printing-label[data-label-type="prod-4x6"]    .print-label-2x1,
          body.printing-label[data-label-type="prod-4x6"]    .print-label-garment,
          body.printing-label[data-label-type="prod-2x1"]    .print-label-4x6,
          body.printing-label[data-label-type="prod-2x1"]    .print-label-garment,
          body.printing-label[data-label-type="garment-2x1"] .print-label-4x6,
          body.printing-label[data-label-type="garment-2x1"] .print-label-2x1 {
            display: none !important;
          }

          /* Per-output @page rules */
          @page list-page  { size: Letter;            margin: 0.5in;  }
          @page label-4x6  { size: 4in 6in;           margin: 0.1in;  }
          @page label-2x1  { size: 2.25in 1.25in;     margin: 0.05in; }

          body.printing-list                                  .print-list   { page: list-page; }
          body.printing-label[data-label-type="prod-4x6"]     .print-label  { page: label-4x6; }
          body.printing-label[data-label-type="prod-2x1"]     .print-label  { page: label-2x1; }
          body.printing-label[data-label-type="garment-2x1"]  .print-label  { page: label-2x1; }
        }
      `}</style>

      {/* =================== SCREEN UI =================== */}
      <div className="screen-only">
        {/* HEADER */}
        <div className="px-4 md:px-8 pt-6 pb-4 max-w-[1600px] mx-auto">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic">
                Print Center
              </h1>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">
                Daily lists · Production labels · Garment labels
              </p>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {jobs.length} jobs loaded
            </div>
          </div>

          {/* ============ TAB PILLS ============ */}
          <div className="flex flex-wrap gap-2.5 mb-6">
            {TABS.map(t => {
              const count = jobs.filter(j => t.stages.includes(j.stage)).length;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border shadow-sm transition-all active:scale-95 ${
                    isActive ? t.pillBg : t.pillIdle
                  }`}
                >
                  {t.label} <span className="opacity-70 ml-1">· {count}</span>
                </button>
              );
            })}
          </div>

          {/* ============ DAILY LIST PANEL ============ */}
          <section className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8 overflow-hidden border-t-4 ${tabConfig.accent}`}>
            <header className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className={`text-lg font-black uppercase tracking-tight ${tabConfig.accent.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                  {tabConfig.label} List
                </h2>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                  {tabJobs.length} jobs · {selectedIds.size} selected
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search title, client, job #…"
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 outline-none focus:border-sky-500 w-56"
                />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 outline-none focus:border-sky-500"
                />
                {dateFilter && (
                  <button
                    onClick={() => setDateFilter("")}
                    className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Clear date
                  </button>
                )}
                <button
                  onClick={toggleAll}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {selectedIds.size === tabJobs.length && tabJobs.length > 0 ? "Clear" : "All"}
                </button>
                <button
                  onClick={handlePrintList}
                  disabled={selectedIds.size === 0}
                  className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  🖨 Print {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                </button>
              </div>
            </header>

            {/* TABLE */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-12 text-center text-xs font-black uppercase tracking-widest text-slate-400">Loading…</div>
              ) : tabJobs.length === 0 ? (
                <div className="p-12 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                  No jobs in this stage{dateFilter ? " for that date" : ""}.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="p-3 text-left w-10">✓</th>
                      <th className="p-3 text-left">Job</th>
                      <th className="p-3 text-left">Client</th>
                      <th className="p-3 text-left">Items · Sizes · Colors</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Quoted</th>
                      <th className="p-3 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabJobs.map(j => {
                      const items: any[] = j.quotes?.quote_items || [];
                      const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
                      const total = quotedPriceForJob(j);
                      const checked = selectedIds.has(j.id);
                      return (
                        <tr
                          key={j.id}
                          onClick={() => toggleOne(j.id)}
                          className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40 ${
                            checked ? "bg-sky-50 dark:bg-sky-500/5" : ""
                          }`}
                        >
                          <td className="p-3 align-top">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOne(j.id)}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 accent-sky-500"
                            />
                          </td>
                          <td className="p-3 align-top">
                            <div className="font-black text-slate-900 dark:text-white leading-tight">{j.title || "Untitled"}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                              #{j.job_number} · Due {fmtDate(j.due_date)}
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            <div className="font-bold">{j.quotes?.customers?.company_name || "Internal"}</div>
                            {j.quotes?.customers?.contact_name && (
                              <div className="text-[11px] text-slate-500">{j.quotes.customers.contact_name}</div>
                            )}
                          </td>
                          <td className="p-3 align-top">
                            {items.length === 0 ? (
                              <span className="text-slate-400 text-xs italic">No items</span>
                            ) : (
                              <ul className="space-y-1.5">
                                {items.map(it => {
                                  const colors = (it.quote_item_variants || []).map((v: any) => v.color).filter(Boolean).join(", ");
                                  const sizeStr = variantSizeBreakdown(it.quote_item_variants);
                                  return (
                                    <li key={it.id} className="text-xs">
                                      <span className="font-black">{it.quantity}× {it.description}</span>
                                      {colors && <span className="text-slate-500"> · {colors}</span>}
                                      {sizeStr && <span className="text-slate-400 block ml-2">{sizeStr}</span>}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </td>
                          <td className="p-3 text-right align-top font-black">{totalQty}</td>
                          <td className="p-3 text-right align-top font-black text-emerald-600 dark:text-emerald-400">
                            {fmtMoney(total)}
                          </td>
                          <td className="p-3 align-top max-w-[260px]">
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-snug">
                              {j.technical_notes || <span className="text-slate-300 dark:text-slate-700 italic">—</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* ============ PER-JOB LABEL PANEL ============ */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden border-t-4 border-sky-500">
            <header className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-sky-600 dark:text-sky-400">
                  Single Job · Production & Garment Labels
                </h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                  Pick a job, pick a label size, then print directly to your label printer.
                </p>
              </div>
            </header>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
              {/* CONTROLS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Job</span>
                  <select
                    value={labelJobId}
                    onChange={e => setLabelJobId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 outline-none focus:border-sky-500"
                  >
                    <option value="">— Pick a job —</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>
                        #{j.job_number} · {j.quotes?.customers?.company_name || "Internal"} · {j.title || "Untitled"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Label Type</span>
                  <select
                    value={labelType}
                    onChange={e => setLabelType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 outline-none focus:border-sky-500"
                  >
                    <option value="prod-4x6">Production · 4″ × 6″</option>
                    <option value="prod-2x1">Production · 2.25″ × 1.25″</option>
                    <option value="garment-2x1">Garment Tag · 2.25″ × 1.25″ (one per garment)</option>
                  </select>
                </label>
              </div>

              {/* PREVIEW + PRINT BUTTON */}
              <div className="flex flex-col items-center gap-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Preview</div>
                <div className="bg-slate-100 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                  <LabelPreview job={labelJob} labelType={labelType} />
                </div>
                <button
                  onClick={handlePrintLabel}
                  disabled={!labelJob}
                  className="text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-lg bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  🖨 Print Label
                </button>
              </div>
            </div>

            {/* GARMENT LABEL: when chosen, explain how many will print */}
            {labelType === "garment-2x1" && labelJob && (
              <div className="px-5 pb-5">
                <GarmentLabelSummary job={labelJob} />
              </div>
            )}
          </section>
        </div>
      </div>

      {/* =================== PRINT SURFACES =================== */}

      {/* ----- DAILY LIST PRINTOUT ----- */}
      <div className="print-only print-list">
        <DailyListPrint
          tabConfig={tabConfig}
          jobs={selectedJobs}
          dateFilter={dateFilter}
        />
      </div>

      {/* ----- LABEL PRINTOUT ----- */}
      <div className="print-only print-label">
        {labelJob && labelType === "prod-4x6" && (
          <div className="print-label-4x6"><Label4x6 job={labelJob} /></div>
        )}
        {labelJob && labelType === "prod-2x1" && (
          <div className="print-label-2x1"><LabelProd2x1 job={labelJob} /></div>
        )}
        {labelJob && labelType === "garment-2x1" && (
          <div className="print-label-garment"><GarmentLabelSheet job={labelJob} /></div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// DAILY LIST — letter-sized printout
// =====================================================================
function DailyListPrint({
  tabConfig, jobs, dateFilter,
}: {
  tabConfig: typeof TABS[number];
  jobs: any[];
  dateFilter: string;
}) {
  const today = new Date().toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const totalJobs = jobs.length;
  const totalQty = jobs.reduce((s, j) => s + (j.quotes?.quote_items || []).reduce((a: number, it: any) => a + Number(it.quantity || 0), 0), 0);
  const totalValue = jobs.reduce((s, j) => s + quotedPriceForJob(j), 0);

  return (
    <div style={{ padding: "0.1in 0.2in", fontFamily: "Inter, system-ui, sans-serif", color: "#000" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>YAYA Sports Inc. · 613-666-9292</div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, textTransform: "uppercase", marginTop: 2 }}>{tabConfig.printTitle}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11 }}>
          <div style={{ fontWeight: 900 }}>{today}</div>
          {dateFilter && <div style={{ fontSize: 10, marginTop: 2 }}>Filtered to due {fmtDate(dateFilter)}</div>}
          <div style={{ fontSize: 10, marginTop: 2 }}>
            {totalJobs} jobs · {totalQty} pcs · {fmtMoney(totalValue)}
          </div>
        </div>
      </div>

      {/* Rows */}
      {jobs.map((j, idx) => {
        const items: any[] = j.quotes?.quote_items || [];
        const jobQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
        const jobTotal = quotedPriceForJob(j);
        return (
          <div key={j.id} className="print-row" style={{ borderBottom: "1px solid #000", padding: "10px 0", display: "grid", gridTemplateColumns: "20px 1fr", gap: 8 }}>
            <div style={{ paddingTop: 2 }}>
              <div style={{ width: 14, height: 14, border: "1.5px solid #000", borderRadius: 3 }} />
            </div>
            <div>
              {/* Top line */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 900, textTransform: "uppercase", letterSpacing: -0.3 }}>
                  {idx + 1}. {j.title || "Untitled Job"}
                  <span style={{ fontWeight: 700, fontSize: 11, marginLeft: 8 }}>· #{j.job_number}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 900 }}>
                  Due {fmtDate(j.due_date)} · {jobQty} pcs · {fmtMoney(jobTotal)}
                </div>
              </div>
              {/* Client */}
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                {j.quotes?.customers?.company_name || "Internal"}
                {j.quotes?.customers?.contact_name && <span style={{ fontWeight: 500 }}> — {j.quotes.customers.contact_name}</span>}
              </div>

              {/* Items table */}
              {items.length > 0 && (
                <table style={{ width: "100%", marginTop: 6, fontSize: 10, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #000", textAlign: "left" }}>
                      <th style={{ padding: "3px 4px", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Qty</th>
                      <th style={{ padding: "3px 4px", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Description</th>
                      <th style={{ padding: "3px 4px", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Colors</th>
                      <th style={{ padding: "3px 4px", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Sizes</th>
                      <th style={{ padding: "3px 4px", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => {
                      const colors = (it.quote_item_variants || []).map((v: any) => v.color).filter(Boolean).join(", ");
                      const sizes = variantSizeBreakdown(it.quote_item_variants) || "—";
                      const price = quotedPriceForItem(it);
                      return (
                        <tr key={it.id} style={{ borderBottom: "1px dotted #888" }}>
                          <td style={{ padding: "3px 4px", fontWeight: 900 }}>{it.quantity}</td>
                          <td style={{ padding: "3px 4px" }}>{it.description}</td>
                          <td style={{ padding: "3px 4px" }}>{colors || "—"}</td>
                          <td style={{ padding: "3px 4px" }}>{sizes}</td>
                          <td style={{ padding: "3px 4px", textAlign: "right", fontWeight: 700 }}>{fmtMoney(price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Notes */}
              <div style={{ marginTop: 8, fontSize: 10, display: "grid", gridTemplateColumns: "70px 1fr", gap: 6 }}>
                <div style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Notes:</div>
                <div style={{ minHeight: 24, borderBottom: "1px solid #000", whiteSpace: "pre-wrap" }}>
                  {j.technical_notes || ""}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div style={{ marginTop: 16, fontSize: 9, textAlign: "center", color: "#555" }}>
        Printed {new Date().toLocaleString("en-CA")} · YAYA Sports Inc.
      </div>
    </div>
  );
}

// =====================================================================
// LABEL PREVIEW — scaled-down preview shown on screen
// =====================================================================
function LabelPreview({ job, labelType }: { job: any | null; labelType: string }) {
  if (!job) {
    return (
      <div className="w-[240px] h-[160px] flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-md">
        Pick a job to preview
      </div>
    );
  }
  // Scale: label units → preview pixels.  4×6 label → 240×360, 2.25×1.25 → 225×125
  if (labelType === "prod-4x6") {
    return (
      <div style={{ width: 240, height: 360, background: "#fff", color: "#000", border: "1px solid #cbd5e1", borderRadius: 4, transform: "none", overflow: "hidden" }}>
        <div style={{ transform: "scale(0.6)", transformOrigin: "top left", width: 400, height: 600 }}>
          <Label4x6 job={job} />
        </div>
      </div>
    );
  }
  if (labelType === "prod-2x1") {
    return (
      <div style={{ width: 225, height: 125, background: "#fff", color: "#000", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ transform: "scale(1)", transformOrigin: "top left" }}>
          <LabelProd2x1 job={job} preview />
        </div>
      </div>
    );
  }
  // garment label preview shows ONE label; on print we generate one per garment
  return (
    <div style={{ width: 225, height: 125, background: "#fff", color: "#000", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ transform: "scale(1)", transformOrigin: "top left" }}>
        <LabelGarment2x1 job={job} item={job?.quotes?.quote_items?.[0]} variant={job?.quotes?.quote_items?.[0]?.quote_item_variants?.[0]} size="M" preview />
      </div>
    </div>
  );
}

// =====================================================================
// 4" × 6" PRODUCTION LABEL
// =====================================================================
function Label4x6({ job }: { job: any }) {
  const items: any[] = job?.quotes?.quote_items || [];
  const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const totalValue = quotedPriceForJob(job);
  const allColors = Array.from(new Set(items.flatMap((it: any) => (it.quote_item_variants || []).map((v: any) => v.color)).filter(Boolean)));

  // Layout uses absolute units (in) so it fills a 4×6 sheet exactly.
  return (
    <div style={{
      width: "4in", height: "6in", padding: "0.18in",
      boxSizing: "border-box", background: "#fff", color: "#000",
      fontFamily: "Inter, system-ui, sans-serif", fontSize: 10, lineHeight: 1.25,
      display: "flex", flexDirection: "column",
    }}>
      {/* Top: brand + job # */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 4 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.5, textTransform: "uppercase" }}>YAYA Sports</div>
          <div style={{ fontSize: 9, fontWeight: 700 }}>613-666-9292</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Job</div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>#{job.job_number}</div>
        </div>
      </div>

      {/* Client + title */}
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#444" }}>Client</div>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.3, lineHeight: 1.1, textTransform: "uppercase" }}>
          {job.quotes?.customers?.company_name || "Internal"}
        </div>
        {job.quotes?.customers?.contact_name && (
          <div style={{ fontSize: 10, fontWeight: 600 }}>{job.quotes.customers.contact_name}</div>
        )}
      </div>

      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#444" }}>Job Title</div>
        <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>{job.title || "Untitled"}</div>
      </div>

      {/* Due / stage / qty */}
      <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 9 }}>
        <Cell label="Due" value={fmtDate(job.due_date)} />
        <Cell label="Stage" value={job.stage || "—"} />
        <Cell label="Qty" value={`${totalQty} pcs`} />
      </div>

      {/* Items list */}
      <div style={{ marginTop: 6, flex: 1, overflow: "hidden", borderTop: "1px solid #000", paddingTop: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Items</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map(it => {
            const sizes = variantSizeBreakdown(it.quote_item_variants);
            const colors = (it.quote_item_variants || []).map((v: any) => v.color).filter(Boolean).join(", ");
            return (
              <li key={it.id} style={{ marginBottom: 4, fontSize: 10 }}>
                <div style={{ fontWeight: 900 }}>{it.quantity}× {it.description}</div>
                {colors && <div style={{ fontSize: 9 }}>{colors}</div>}
                {sizes && <div style={{ fontSize: 9, color: "#333" }}>{sizes}</div>}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom: notes + price */}
      <div style={{ borderTop: "1px solid #000", paddingTop: 4, marginTop: 4 }}>
        <div style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Notes</div>
        <div style={{ fontSize: 9, minHeight: "0.4in", whiteSpace: "pre-wrap" }}>{job.technical_notes || ""}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, fontWeight: 900 }}>
          <div>Quoted</div>
          <div>{fmtMoney(totalValue)}</div>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #000", borderRadius: 3, padding: "3px 5px", background: "#f4f4f5" }}>
      <div style={{ fontSize: 7, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, color: "#555" }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

// =====================================================================
// 2.25" × 1.25" PRODUCTION LABEL
// =====================================================================
function LabelProd2x1({ job, preview = false }: { job: any; preview?: boolean }) {
  const items: any[] = job?.quotes?.quote_items || [];
  const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const colors = Array.from(new Set(items.flatMap((it: any) => (it.quote_item_variants || []).map((v: any) => v.color)).filter(Boolean))).join(", ");
  const company = job.quotes?.customers?.company_name || "Internal";

  return (
    <div style={{
      width: "2.25in", height: "1.25in", padding: "0.06in 0.08in",
      boxSizing: "border-box", background: "#fff", color: "#000",
      fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.15,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      border: preview ? "none" : "none",
    }}>
      {/* top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.5 }}>YAYA</div>
        <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: -0.5 }}>#{job.job_number}</div>
      </div>
      {/* client */}
      <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: -0.3, lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {company}
      </div>
      {/* item summary */}
      <div style={{ fontSize: 8, fontWeight: 700, lineHeight: 1.1, overflow: "hidden", maxHeight: "0.32in" }}>
        {totalQty} pcs · {items.map(it => it.description).slice(0, 2).join(", ") || "—"}
      </div>
      {/* due + colors */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontWeight: 700 }}>
        <div>Due {fmtDate(job.due_date)}</div>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "1.2in" }}>{colors}</div>
      </div>
    </div>
  );
}

// =====================================================================
// 2.25" × 1.25" GARMENT LABEL — one per garment
// =====================================================================
function LabelGarment2x1({
  job, item, variant, size, preview = false,
}: { job: any; item: any; variant: any; size: string; preview?: boolean }) {
  const company = job?.quotes?.customers?.company_name || "Internal";
  return (
    <div style={{
      width: "2.25in", height: "1.25in", padding: "0.06in 0.08in",
      boxSizing: "border-box", background: "#fff", color: "#000",
      fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.15,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      border: preview ? "none" : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.5 }}>YAYA Sports</div>
        <div style={{ fontSize: 8, fontWeight: 700 }}>613-666-9292</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: -0.3, lineHeight: 1.05, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {company}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.1, overflow: "hidden", maxHeight: "0.3in" }}>
        {item?.description || "Item"}{variant?.color ? ` · ${variant.color}` : ""}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 8, fontWeight: 700 }}>Size</div>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.5 }}>{size}</div>
      </div>
    </div>
  );
}

// =====================================================================
// GARMENT LABEL SHEET — generates one label per garment (with page breaks)
// =====================================================================
function expandGarmentLabels(job: any) {
  const out: { item: any; variant: any; size: string; key: string }[] = [];
  const items: any[] = job?.quotes?.quote_items || [];
  for (const it of items) {
    const variants: any[] = it.quote_item_variants || [];
    if (variants.length === 0) {
      // No variants — emit `quantity` blank-size labels
      const qty = Number(it.quantity || 0);
      for (let i = 0; i < qty; i++) {
        out.push({ item: it, variant: null, size: "", key: `${it.id}-blank-${i}` });
      }
      continue;
    }
    for (const v of variants) {
      for (const k of SIZE_KEYS) {
        const qty = Number(v?.[k] || 0);
        for (let i = 0; i < qty; i++) {
          out.push({ item: it, variant: v, size: SIZE_LABELS[k], key: `${it.id}-${v.id}-${k}-${i}` });
        }
      }
    }
  }
  return out;
}

function GarmentLabelSummary({ job }: { job: any }) {
  const labels = expandGarmentLabels(job);
  return (
    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
      Will print <span className="font-black text-slate-900 dark:text-white">{labels.length}</span> garment label{labels.length === 1 ? "" : "s"} — one per garment, broken down by size & color.
    </div>
  );
}

function GarmentLabelSheet({ job }: { job: any }) {
  const labels = expandGarmentLabels(job);
  return (
    <div>
      {labels.map(({ item, variant, size, key }) => (
        <div key={key} style={{ pageBreakAfter: "always", breakAfter: "page" }}>
          <LabelGarment2x1 job={job} item={item} variant={variant} size={size} />
        </div>
      ))}
    </div>
  );
}
