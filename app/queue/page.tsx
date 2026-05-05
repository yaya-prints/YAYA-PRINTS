"use client";

// =============================================================================
// PRIORITY QUEUE — DEDICATED COMMAND CENTER
// =============================================================================
// Path: /queue
// Master/detail layout: list of active jobs on the left, expanded detail on right.
// All data flows through Supabase, so changes here sync to /customers and /jobs
// (those pages re-fetch on mount).
//
// Phase 1 scope:
//   - List: priority drag-reorder, sort, filter
//   - Detail: customer block, financials, line items, brand assets, customer
//             history, notes, quick actions, linked quote
//   - URL state: /queue?job=<id> is shareable + bookmarkable
//   - Keyboard: ↑/↓ to navigate, Cmd/Ctrl+K to search, Esc to clear selection
// =============================================================================

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const fmtMoney = (n: number) => `$${(n || 0).toFixed(2)}`;
const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "TBD";
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "TBD"; }
};
const daysFromNow = (d: string | null | undefined): number | null => {
  if (!d) return null;
  const due = new Date(d);
  const now = new Date();
  return Math.floor((due.getTime() - now.getTime()) / 86400000);
};

const isPdfUrl = (url?: string | null) => !!url && /\.pdf(\?.*)?$/i.test(url);

// Stage palette — each stage has its own distinct color so the queue is
// scannable at a glance. Keys are case-insensitive at lookup time.
const STAGE_COLORS: Record<string, { bg: string; text: string; border: string; solid: string }> = {
  "incoming":           { bg: "bg-sky-500/15",     text: "text-sky-600",     border: "border-sky-500/40",     solid: "bg-sky-500" },
  "artwork":            { bg: "bg-violet-500/15",  text: "text-violet-600",  border: "border-violet-500/40",  solid: "bg-violet-500" },
  "approved":           { bg: "bg-emerald-500/15", text: "text-emerald-600", border: "border-emerald-500/40", solid: "bg-emerald-500" },
  "materials":          { bg: "bg-amber-500/15",   text: "text-amber-600",   border: "border-amber-500/40",   solid: "bg-amber-500" },
  "production":         { bg: "bg-rose-500/15",    text: "text-rose-600",    border: "border-rose-500/40",    solid: "bg-rose-500" },
  "pressing":           { bg: "bg-orange-500/15",  text: "text-orange-600",  border: "border-orange-500/40",  solid: "bg-orange-500" },
  "printing":           { bg: "bg-fuchsia-500/15", text: "text-fuchsia-600", border: "border-fuchsia-500/40", solid: "bg-fuchsia-500" },
  "qc":                 { bg: "bg-pink-500/15",    text: "text-pink-600",    border: "border-pink-500/40",    solid: "bg-pink-500" },
  "pack":               { bg: "bg-yellow-500/15",  text: "text-yellow-700",  border: "border-yellow-500/40",  solid: "bg-yellow-500" },
  "packaged & shelved": { bg: "bg-yellow-500/15",  text: "text-yellow-700",  border: "border-yellow-500/40",  solid: "bg-yellow-500" },
  "ship":               { bg: "bg-cyan-500/15",    text: "text-cyan-600",    border: "border-cyan-500/40",    solid: "bg-cyan-500" },
  "dispatch":           { bg: "bg-cyan-500/15",    text: "text-cyan-600",    border: "border-cyan-500/40",    solid: "bg-cyan-500" },
  "billing":            { bg: "bg-blue-500/15",    text: "text-blue-600",    border: "border-blue-500/40",    solid: "bg-blue-500" },
  "paid":               { bg: "bg-emerald-500/15", text: "text-emerald-600", border: "border-emerald-500/40", solid: "bg-emerald-500" },
  "done":               { bg: "bg-emerald-500/20", text: "text-emerald-500", border: "border-emerald-500/50", solid: "bg-emerald-500" },
  "completed":          { bg: "bg-emerald-500/20", text: "text-emerald-500", border: "border-emerald-500/50", solid: "bg-emerald-500" },
};
const stageStyle = (stage?: string) => STAGE_COLORS[(stage || "").toLowerCase()] || { bg: "bg-slate-500/15", text: "text-slate-500", border: "border-slate-500/40", solid: "bg-slate-500" };

// =============================================================================
// MAIN COMPONENT
// =============================================================================
function PriorityQueuePageInner() {
  const searchParams = useSearchParams();

  // ---- DATA ----
  const [jobs, setJobs] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerDocuments, setCustomerDocuments] = useState<any[]>([]); // for the selected customer
  const [loading, setLoading] = useState(true);

  // ---- UI STATE ----
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"priority" | "due" | "amount" | "customer">("priority");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  // ---- VIEW MODE: list (master/detail) or grid (dense numbering interface) ----
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  // ---- DATE RANGE filter for the grid view ----
  // "week" = last 7d, "month" = last 30d, "since-import" = since 2026-04-07
  // (when you imported the legacy data — anything after that is real active work)
  // "all" = everything
  const [dateRange, setDateRange] = useState<"week" | "month" | "since-import" | "all">("since-import");
  const [newNote, setNewNote] = useState("");
  // ---- THEME ----
  // Read the global theme set by the layout's toggle (localStorage 'yaya-theme'
  // and the 'themeChange' window event). Doesn't render its own toggle —
  // the master toggle lives in the top nav.
  const [theme, setThemeState] = useState<"light" | "dark">("dark");
  const isLightMode = theme === "light";
  useEffect(() => {
    const read = () => {
      try {
        const saved = localStorage.getItem("yaya-theme");
        setThemeState(saved === "light" ? "light" : "dark");
      } catch {}
    };
    read();
    window.addEventListener("themeChange", read);
    window.addEventListener("storage", read); // cross-tab sync
    return () => {
      window.removeEventListener("themeChange", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const t = useMemo(() => ({
    pageBg:     isLightMode ? "bg-slate-50" : "bg-[#0f1115]",
    pageText:   isLightMode ? "text-slate-900" : "text-slate-200",
    panelBg:    isLightMode ? "bg-white" : "bg-slate-950",
    panelBorder:isLightMode ? "border-slate-200" : "border-slate-800",
    subBg:      isLightMode ? "bg-slate-50" : "bg-slate-900/50",
    inputBg:    isLightMode ? "bg-white border-slate-300 text-slate-900 focus:border-rose-500" : "bg-black border-slate-700 text-white focus:border-rose-500",
    textMuted:  isLightMode ? "text-slate-500" : "text-[#686a6c]",
    textStrong: isLightMode ? "text-slate-900" : "text-white",
    rowHover:   isLightMode ? "hover:bg-slate-50" : "hover:bg-slate-900/40",
  }), [isLightMode]);
  const listRef = useRef<HTMLDivElement>(null);

  // ---- LOAD DATA ----
  const reload = useCallback(async () => {
    setLoading(true);
    const [c, q, j] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("quotes").select("id, customer_id, total_amount, amount_paid, status, deposit_paid_at, deposit_amount, quote_items(id, description, quantity, unit_price, quote_item_variants(color, xs, s, m, l, xl, xxl, xxxl, xxxxl, xxxxxl))"),
      supabase.from("jobs").select("*").or("is_archived.is.null,is_archived.eq.false"),
    ]);
    setCustomers(c.data || []);
    setQuotes(q.data || []);
    setJobs(j.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ---- DERIVE: active jobs only, with linked customer + quote ----
  const activeJobs = useMemo(() => {
    return jobs
      .filter(j => j.stage !== "Done" && j.stage !== "Closed" && !j.is_archived)
      .map(j => {
        const quote = quotes.find(q => q.id === j.quote_id);
        const customer = customers.find(c => c.id === quote?.customer_id || c.id === j.customer_id);
        return { ...j, _quote: quote, _customer: customer };
      });
  }, [jobs, quotes, customers]);

  // Distinct stages actually present in the data — drives the filter chips so
  // they always reflect reality (Pressing, Billing, Dispatch, etc.) instead of
  // a hard-coded list.
  const availableStages = useMemo(() => {
    const seen = new Set<string>();
    activeJobs.forEach(j => { if (j.stage) seen.add(j.stage); });
    return Array.from(seen).sort();
  }, [activeJobs]);

  // ---- SORT + FILTER ----
  const sortedFilteredJobs = useMemo(() => {
    let list = activeJobs.slice();
    // Filter: stage
    if (stageFilter !== "all") list = list.filter(j => j.stage === stageFilter);
    // Filter: date range (used by grid view; harmless in list view)
    if (dateRange !== "all") {
      const now = Date.now();
      let cutoff: number;
      if (dateRange === "week")          cutoff = now - 7 * 86400000;
      else if (dateRange === "month")    cutoff = now - 30 * 86400000;
      else /* since-import */            cutoff = new Date("2026-04-07").getTime();
      list = list.filter(j => j.created_at && new Date(j.created_at).getTime() >= cutoff);
    }
    // Filter: search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(j =>
        (j.title || "").toLowerCase().includes(q) ||
        (j._customer?.company_name || "").toLowerCase().includes(q) ||
        String(j.job_number || "").includes(q)
      );
    }
    // Sort
    const sorted = list.sort((a, b) => {
      switch (sortMode) {
        case "priority": return (a.priority_order ?? 9999) - (b.priority_order ?? 9999);
        case "due": {
          const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return ad - bd;
        }
        case "amount": return (b._quote?.total_amount || 0) - (a._quote?.total_amount || 0);
        case "customer": return (a._customer?.company_name || "").localeCompare(b._customer?.company_name || "");
      }
    });
    return sorted;
  }, [activeJobs, sortMode, stageFilter, searchQuery, dateRange]);

  const selectedJob = useMemo(() =>
    sortedFilteredJobs.find(j => j.id === selectedJobId) || sortedFilteredJobs[0] || null,
  [selectedJobId, sortedFilteredJobs]);

  // ---- URL SYNC: ?job=<id> ↔ selection ----
  // When the URL says one thing and selection is null, adopt URL.
  // When user clicks a job, we update selection AND push to URL together
  // (in the click handler, not via effect) — that prevents the race condition
  // where the URL effect re-fires and overrides a fresh click.
  useEffect(() => {
    const urlJob = searchParams?.get("job");
    if (urlJob && !selectedJobId) {
      const found = activeJobs.find(j => j.id === urlJob || String(j.job_number) === urlJob);
      if (found) setSelectedJobId(found.id);
    }
    if (!urlJob && !selectedJobId && sortedFilteredJobs[0]) {
      setSelectedJobId(sortedFilteredJobs[0].id);
    }
  }, [searchParams, activeJobs, sortedFilteredJobs, selectedJobId]);

  // Centralized "select this job" — used by clicks AND keyboard nav.
  // Updates state + URL together so they can never go out of sync.
  const selectJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    // Push URL change without triggering a re-render avalanche
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/queue?job=${jobId}`);
    }
  }, []);

  // ---- LOAD CUSTOMER DOCUMENTS WHEN CUSTOMER CHANGES (cached) ----
  // Cache by customer id so jumping back and forth doesn't hit the network repeatedly.
  const [docCache, setDocCache] = useState<Record<string, any[]>>({});
  useEffect(() => {
    const cid = selectedJob?._customer?.id;
    if (!cid) { setCustomerDocuments([]); return; }
    if (docCache[cid]) {
      setCustomerDocuments(docCache[cid]);
      return;
    }
    supabase.from("customer_documents").select("*").eq("customer_id", cid).order("uploaded_at", { ascending: false }).then(({ data }) => {
      const docs = data || [];
      setDocCache(prev => ({ ...prev, [cid]: docs }));
      setCustomerDocuments(docs);
    });
  }, [selectedJob?._customer?.id, docCache]);

  // ---- KEYBOARD SHORTCUTS ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (e.key === "Escape") {
        if (inField) (target as HTMLInputElement).blur();
        return;
      }
      if (inField) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const search = document.getElementById("queue-search") as HTMLInputElement;
        search?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = sortedFilteredJobs.findIndex(j => j.id === selectedJob?.id);
        const next = sortedFilteredJobs[Math.min(idx + 1, sortedFilteredJobs.length - 1)];
        if (next) selectJob(next.id);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = sortedFilteredJobs.findIndex(j => j.id === selectedJob?.id);
        const prev = sortedFilteredJobs[Math.max(idx - 1, 0)];
        if (prev) selectJob(prev.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sortedFilteredJobs, selectedJob?.id]);

  // ---- ACTIONS ----
  // All actions are OPTIMISTIC: update local state immediately so the UI doesn't
  // wait for the network. Sync to Supabase in the background. If the write fails
  // we log it (Phase 2 will add toast + automatic revert).

  // Set a priority on a single job AND auto-resolve conflicts.
  // Behavior: if you set Job A to priority N and Job B already has N,
  //   • Renumber the whole list so the new value lands in slot N
  //   • Everything from slot N onward shifts down by 1
  // Result: numbers are always strictly 1, 2, 3 ... no duplicates, no gaps,
  // and the job you just numbered ends up in the visual position you typed.
  const handlePriorityChange = (jobId: string, newOrder: number) => {
    if (newOrder < 1) newOrder = 1;
    // Pull the current visible-and-priority-sorted order
    const ordered = [...activeJobs].sort((a, b) => (a.priority_order ?? 9999) - (b.priority_order ?? 9999));
    // Remove the moving job from its current slot
    const without = ordered.filter(j => j.id !== jobId);
    const movedJob = activeJobs.find(j => j.id === jobId);
    if (!movedJob) return;
    // Cap newOrder at "end of list"
    const targetIndex = Math.min(newOrder - 1, without.length);
    // Insert at target
    const next = [...without.slice(0, targetIndex), movedJob, ...without.slice(targetIndex)];
    // Renumber strictly 1..n
    const updates = next.map((j, idx) => ({ id: j.id, priority_order: idx + 1 }));
    // Optimistic
    setJobs(prev => prev.map(j => {
      const u = updates.find(x => x.id === j.id);
      return u ? { ...j, priority_order: u.priority_order } : j;
    }));
    // Persist (only the rows that actually changed)
    const changed = updates.filter(u => {
      const before = activeJobs.find(j => j.id === u.id)?.priority_order;
      return before !== u.priority_order;
    });
    Promise.all(changed.map(u =>
      supabase.from("jobs").update({ priority_order: u.priority_order }).eq("id", u.id)
    )).catch(err => console.error("[priority sync]", err));
  };

  const handleStageChange = (jobId: string, newStage: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, stage: newStage } : j));
    supabase.from("jobs").update({ stage: newStage }).eq("id", jobId).then(({ error }) => {
      if (error) console.error("[stage sync]", error);
    });
  };

  const handleAddNote = () => {
    if (!selectedJob || !newNote.trim()) return;
    const existing = selectedJob.notes || "";
    const ts = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const combined = existing
      ? `${existing}\n\n[${ts}]\n${newNote.trim()}`
      : `[${ts}]\n${newNote.trim()}`;
    const jobId = selectedJob.id;
    // Optimistic
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, notes: combined } : j));
    setNewNote("");
    // Background
    supabase.from("jobs").update({ notes: combined }).eq("id", jobId).then(({ error }) => {
      if (error) console.error("[note sync]", error);
    });
  };

  const handleRescheduleDue = (jobId: string, newDate: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, due_date: newDate || null } : j));
    supabase.from("jobs").update({ due_date: newDate || null }).eq("id", jobId).then(({ error }) => {
      if (error) console.error("[due sync]", error);
    });
  };

  // Renumber all visible jobs as 1, 2, 3... preserving current visual order.
  // Use this after you've moved jobs around in the grid and want clean numbers.
  const handleRenumber = () => {
    if (!confirm("Renumber all visible jobs as 1, 2, 3… (preserves current order)?")) return;
    const updates = sortedFilteredJobs.map((j, idx) => ({ id: j.id, priority_order: idx + 1 }));
    setJobs(prev => prev.map(j => {
      const u = updates.find(x => x.id === j.id);
      return u ? { ...j, priority_order: u.priority_order } : j;
    }));
    Promise.all(updates.map(u =>
      supabase.from("jobs").update({ priority_order: u.priority_order }).eq("id", u.id)
    )).catch(err => console.error("[renumber]", err));
  };

  const handleMarkComplete = (jobId: string) => {
    if (!confirm("Mark this job as Done? It will be removed from the queue.")) return;
    // Optimistic — flag stage Done so it disappears from activeJobs immediately
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, stage: "Done" } : j));
    // Pick the next job to display so the right pane doesn't go blank
    const remainingIds = sortedFilteredJobs.filter(j => j.id !== jobId).map(j => j.id);
    if (remainingIds.length > 0 && selectedJobId === jobId) {
      selectJob(remainingIds[0]);
    }
    supabase.from("jobs").update({ stage: "Done" }).eq("id", jobId).then(({ error }) => {
      if (error) console.error("[complete sync]", error);
    });
  };

  // ---- DERIVE: customer history (other jobs by same customer) ----
  const customerHistory = useMemo(() => {
    if (!selectedJob?._customer?.id) return [];
    return jobs
      .filter(j => {
        const q = quotes.find(qq => qq.id === j.quote_id);
        return q?.customer_id === selectedJob._customer.id && j.id !== selectedJob.id;
      })
      .map(j => ({ ...j, _quote: quotes.find(q => q.id === j.quote_id) }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [jobs, quotes, selectedJob]);

  // ---- DERIVE: financials for selected job ----
  const fin = useMemo(() => {
    const q = selectedJob?._quote;
    if (!q) return { subtotal: 0, hst: 0, total: 0, paid: 0, deposit: 0, balance: 0 };
    const subtotal = Number(q.total_amount) || 0;
    const hst = subtotal * 0.13;
    const total = subtotal + hst;
    const paid = Number(q.amount_paid) || 0;
    const deposit = Number(q.deposit_amount) || 0;
    const balance = Math.max(0, total - paid - deposit);
    return { subtotal, hst, total, paid, deposit, balance };
  }, [selectedJob]);

  // ---- ITEM SUMMARY ----
  const itemSummary = useMemo(() => {
    const items = selectedJob?._quote?.quote_items || [];
    if (!items.length) return { lines: [], totalUnits: 0 };
    const lines = items.map((it: any) => {
      const sizes: Record<string, number> = {};
      let total = 0;
      (it.quote_item_variants || []).forEach((v: any) => {
        ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl"].forEach(k => {
          if (v[k] > 0) { sizes[k] = (sizes[k] || 0) + v[k]; total += v[k]; }
        });
      });
      return {
        description: it.description,
        quantity: it.quantity || total,
        unitPrice: it.unit_price,
        sizes,
        colors: [...new Set((it.quote_item_variants || []).map((v: any) => v.color).filter(Boolean))] as string[],
      };
    });
    const totalUnits = lines.reduce((s: number, l: any) => s + (l.quantity || 0), 0);
    return { lines, totalUnits };
  }, [selectedJob]);

  // =============================================================================
  // RENDER
  // =============================================================================
  if (loading) {
    return (
      <div className={`${t.pageBg} ${t.pageText} min-h-screen flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🔥</div>
          <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Loading queue…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${t.pageBg} ${t.pageText} min-h-screen`}>
      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-20 ${t.panelBg} border-b ${t.panelBorder} backdrop-blur-md`}>
        <div className="px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap">
          <Link href="/customers" className={`${t.textMuted} hover:${t.textStrong} text-[10px] font-black uppercase tracking-widest transition-colors`}>← Customers</Link>
          <div className={`w-px h-5 ${t.panelBorder} border-l`}></div>
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🔥</span>
            <div>
              <h1 className="text-lg md:text-xl font-black uppercase italic tracking-tight leading-none">Priority Queue</h1>
              <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>
                {sortedFilteredJobs.length} active
              </div>
            </div>
          </div>
          <div className="flex-1"></div>
          <input
            id="queue-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobs, customers, #… (⌘K)"
            className={`${t.inputBg} border rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none focus:border-rose-500 transition-colors w-48 md:w-64`}
          />
        </div>

        {/* ─── TOOLBAR — three logical rows, color-coded per group ─── */}
        <div className={`border-t ${t.panelBorder}`}>

          {/* ROW 1 — view + date range + renumber (the "what am I looking at" row) */}
          <div className={`px-4 md:px-6 py-2 flex items-center gap-2 flex-wrap text-[9px]`}>
            {/* VIEW TOGGLE — segmented */}
            <div className={`flex rounded-md border ${t.panelBorder} overflow-hidden shadow-sm`}>
              <button onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 font-black uppercase tracking-widest transition-colors ${viewMode === "list" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : `${t.textMuted} hover:${t.textStrong}`}`}>
                ☰ List
              </button>
              <button onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 font-black uppercase tracking-widest transition-colors ${viewMode === "grid" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : `${t.textMuted} hover:${t.textStrong}`}`}>
                ▦ Grid
              </button>
            </div>

            {/* DATE RANGE — emerald-themed (date = "freshness") */}
            <span className={`ml-2 font-black uppercase tracking-widest ${t.textMuted}`}>Show:</span>
            {[
              { id: "week",          label: "Past Week" },
              { id: "month",         label: "Past Month" },
              { id: "since-import",  label: "After Apr 7" },
              { id: "all",           label: "All" },
            ].map(d => (
              <button key={d.id} onClick={() => setDateRange(d.id as any)}
                className={`px-2.5 py-1 rounded-md font-black uppercase tracking-widest transition-colors ${dateRange === d.id ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/50" : `${t.textMuted} hover:${t.textStrong} border border-transparent`}`}>
                {d.label}
              </button>
            ))}

            <div className="flex-1"></div>

            <button
              onClick={handleRenumber}
              className="px-3 py-1.5 rounded-md font-black uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-400 transition-colors shadow-sm"
              title="Renumber all visible jobs as 1, 2, 3… in current order"
            >
              ↺ Renumber 1,2,3
            </button>
          </div>

          {/* ROW 2 — sort (sky blue, "ordering" semantic) */}
          <div className={`px-4 md:px-6 py-2 flex items-center gap-2 flex-wrap text-[9px] border-t ${t.panelBorder}`}>
            <span className={`font-black uppercase tracking-widest ${t.textMuted}`}>Sort:</span>
            {[
              { id: "priority", label: "Priority" },
              { id: "due",      label: "Due Date" },
              { id: "amount",   label: "$ Amount" },
              { id: "customer", label: "Customer" },
            ].map(s => (
              <button key={s.id} onClick={() => setSortMode(s.id as any)}
                className={`px-2.5 py-1 rounded-md font-black uppercase tracking-widest transition-colors ${sortMode === s.id ? "bg-sky-500/20 text-sky-600 border border-sky-500/50" : `${t.textMuted} hover:${t.textStrong} border border-transparent`}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* ROW 3 — stage filter (each chip in ITS OWN stage color) */}
          <div className={`px-4 md:px-6 py-2 flex items-center gap-2 flex-wrap text-[9px] border-t ${t.panelBorder}`}>
            <span className={`font-black uppercase tracking-widest ${t.textMuted}`}>Stage:</span>
            <button onClick={() => setStageFilter("all")}
              className={`px-2.5 py-1 rounded-md font-black uppercase tracking-widest transition-colors ${stageFilter === "all" ? `${isLightMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"} border border-transparent` : `${t.textMuted} hover:${t.textStrong} border border-transparent`}`}>
              All ({activeJobs.length})
            </button>
            {availableStages.map(s => {
              const ss = stageStyle(s);
              const count = activeJobs.filter(j => j.stage === s).length;
              const active = stageFilter === s;
              return (
                <button key={s} onClick={() => setStageFilter(s)}
                  className={`px-2.5 py-1 rounded-md font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 ${active ? `${ss.bg} ${ss.text} border ${ss.border} shadow-sm` : `${t.textMuted} hover:${t.textStrong} border border-transparent`}`}>
                  {/* Color dot — always visible so users learn the legend */}
                  <span className={`w-1.5 h-1.5 rounded-full ${ss.solid}`}></span>
                  {s}
                  {count > 0 && <span className={`opacity-60 font-bold`}>({count})</span>}
                </button>
              );
            })}
          </div>

        </div>
      </header>

      {/* ─── BODY: master/detail (LIST view) ────────────────────────────── */}
      {viewMode === "list" && (
      <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-104px)]">

        {/* ─── LIST (LEFT RAIL) ─── */}
        <div ref={listRef} className={`w-full lg:w-[400px] xl:w-[440px] shrink-0 border-r ${t.panelBorder} overflow-y-auto`}>
          {sortedFilteredJobs.length === 0 ? (
            <div className={`p-12 text-center ${t.textMuted}`}>
              <div className="text-4xl mb-3 opacity-50">🌴</div>
              <div className="text-[10px] font-black uppercase tracking-widest">No active jobs</div>
            </div>
          ) : (
            <div className="divide-y divide-current/5">
              {sortedFilteredJobs.map((job, idx) => {
                const ss = stageStyle(job.stage);
                const isSel = selectedJob?.id === job.id;
                const dn = daysFromNow(job.due_date);
                const isOverdue = dn !== null && dn < 0;
                const isUrgent = dn !== null && dn >= 0 && dn <= 2;
                return (
                  <button
                    key={job.id}
                    onClick={() => selectJob(job.id)}
                    className={`w-full text-left px-4 py-3 transition-all ${isSel ? `${isLightMode ? "bg-rose-50" : "bg-rose-500/10"} border-l-4 border-l-rose-500 pl-3` : `${t.rowHover} border-l-4 border-l-transparent`}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Priority # — shows the saved value, not the row position.
                          Editable in any sort mode. Empty string when null. */}
                      <div className="shrink-0 w-12 text-center">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={job.priority_order ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 9999 : parseInt(e.target.value);
                            if (!isNaN(val)) handlePriorityChange(job.id, val);
                          }}
                          className={`w-12 text-center text-sm font-black ${isLightMode ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900/60 border-slate-700 text-white"} border rounded-md py-1 outline-none focus:border-rose-500`}
                          title="Edit priority (lower number = higher priority)"
                        />
                      </div>
                      {/* Logo */}
                      <div className={`shrink-0 w-10 h-10 rounded-lg ${isLightMode ? "bg-white border-slate-200" : "bg-slate-950/40 border-slate-800"} border flex items-center justify-center overflow-hidden`}>
                        {job._customer?.logo_url ? (
                          isPdfUrl(job._customer.logo_url) ? (
                            <span className="text-base">📕</span>
                          ) : (
                            <img src={job._customer.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                          )
                        ) : (
                          <span className={`text-[10px] font-black italic uppercase tracking-tighter ${t.textMuted}`}>
                            {(job._customer?.company_name || "?").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={`text-[10px] font-black uppercase tracking-tight truncate ${t.textStrong}`}>{job._customer?.company_name || "Unknown"}</span>
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/30">#{job.job_number}</span>
                        </div>
                        <p className={`text-[10px] font-bold truncate ${t.textMuted} mb-1`}>{job.title}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border ${ss.bg} ${ss.text} ${ss.border}`}>{job.stage || "—"}</span>
                          <span className={`text-[8px] font-black uppercase tracking-widest ${isOverdue ? "text-red-500" : isUrgent ? "text-amber-500" : t.textMuted}`}>
                            {job.due_date ? (isOverdue ? `${Math.abs(dn!)}d OVERDUE` : `Due in ${dn}d`) : "No date"}
                          </span>
                          <span className={`text-[8px] font-black ml-auto ${t.textStrong}`}>{fmtMoney((job._quote?.total_amount || 0) * 1.13)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── DETAIL (RIGHT PANE) ─── */}
        <div className="flex-1 overflow-y-auto">
          {selectedJob ? (
            <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-5xl">
              {/* TITLE BLOCK */}
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Customer logo */}
                <div className={`shrink-0 w-20 h-20 rounded-2xl ${isLightMode ? "bg-white border-slate-200" : "bg-slate-950/40 border-slate-800"} border-2 flex items-center justify-center overflow-hidden`}>
                  {selectedJob._customer?.logo_url ? (
                    isPdfUrl(selectedJob._customer.logo_url) ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-3xl">📕</span>
                        <span className="text-[7px] font-black uppercase tracking-widest text-slate-500">PDF</span>
                      </div>
                    ) : (
                      <img src={selectedJob._customer.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                    )
                  ) : (
                    <span className={`text-2xl font-black italic uppercase tracking-tighter ${t.textMuted} opacity-50`}>
                      {(selectedJob._customer?.company_name || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[9px] font-black px-2 py-1 rounded bg-rose-500/15 text-rose-500 border border-rose-500/40 uppercase tracking-widest">#{selectedJob.job_number}</span>
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest border ${stageStyle(selectedJob.stage).bg} ${stageStyle(selectedJob.stage).text} ${stageStyle(selectedJob.stage).border}`}>{selectedJob.stage || "—"}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter leading-none mb-1">{selectedJob._customer?.company_name || "Unknown"}</h2>
                  <p className={`text-[12px] font-bold ${t.textMuted}`}>{selectedJob.title}</p>
                </div>
                {/* Quick actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => handleMarkComplete(selectedJob.id)} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">✓ Mark Complete</button>
                  {selectedJob._quote?.id && (
                    <Link href={`/quotes/${selectedJob._quote.id}`} className={`px-4 py-2 rounded-lg border ${t.panelBorder} ${t.textMuted} hover:${t.textStrong} text-[10px] font-black uppercase tracking-widest transition-all text-center`}>
                      View Quote
                    </Link>
                  )}
                </div>
              </div>

              {/* CONTACT + DUE DATE STRIP */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className={`${t.panelBg} border ${t.panelBorder} rounded-xl p-4`}>
                  <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Contact</div>
                  <div className={`text-[13px] font-black ${t.textStrong} mb-1`}>{selectedJob._customer?.contact_name || "—"}</div>
                  <div className="flex flex-col gap-1">
                    {selectedJob._customer?.email && <a href={`mailto:${selectedJob._customer.email}`} className={`text-[11px] font-bold text-sky-500 hover:underline truncate`}>📧 {selectedJob._customer.email}</a>}
                    {selectedJob._customer?.phone && <a href={`tel:${selectedJob._customer.phone}`} className={`text-[11px] font-bold text-emerald-500 hover:underline`}>📞 {selectedJob._customer.phone}</a>}
                  </div>
                </div>

                <div className={`${t.panelBg} border ${t.panelBorder} rounded-xl p-4`}>
                  <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Due Date</div>
                  <input
                    type="date"
                    value={selectedJob.due_date ? selectedJob.due_date.split("T")[0] : ""}
                    onChange={(e) => handleRescheduleDue(selectedJob.id, e.target.value)}
                    className={`${t.inputBg} border rounded-lg p-2 text-[11px] font-bold outline-none focus:border-rose-500 w-full`}
                  />
                  <div className={`text-[10px] font-black mt-2 ${(daysFromNow(selectedJob.due_date) ?? 999) < 0 ? "text-red-500" : (daysFromNow(selectedJob.due_date) ?? 999) <= 2 ? "text-amber-500" : "text-emerald-500"}`}>
                    {selectedJob.due_date
                      ? (daysFromNow(selectedJob.due_date)! < 0
                        ? `${Math.abs(daysFromNow(selectedJob.due_date)!)}d OVERDUE`
                        : `${daysFromNow(selectedJob.due_date)} days remaining`)
                      : "No date set"}
                  </div>
                </div>

                <div className={`${t.panelBg} border ${t.panelBorder} rounded-xl p-4`}>
                  <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Stage</div>
                  <select
                    value={selectedJob.stage || ""}
                    onChange={(e) => handleStageChange(selectedJob.id, e.target.value)}
                    className={`${t.inputBg} border rounded-lg p-2 text-[11px] font-bold outline-none focus:border-rose-500 w-full`}
                  >
                    {["Incoming", "Artwork", "Approved", "Materials", "Production", "QC", "Pack", "Ship", "Done"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* FINANCIALS */}
              <div className={`${t.panelBg} border ${t.panelBorder} rounded-2xl overflow-hidden`}>
                <div className={`px-5 py-3 border-b ${t.panelBorder}`}>
                  <h3 className={`text-[12px] font-black uppercase italic tracking-tight ${t.textStrong}`}>Financials</h3>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-1`}>Total (incl HST)</div>
                    <div className="text-2xl font-black tracking-tight">{fmtMoney(fin.total)}</div>
                  </div>
                  <div>
                    <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-1`}>Deposit</div>
                    <div className={`text-2xl font-black tracking-tight ${fin.deposit > 0 ? "text-emerald-500" : t.textMuted}`}>
                      {fmtMoney(fin.deposit)}
                    </div>
                    <div className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${selectedJob._quote?.deposit_paid_at ? "text-emerald-500" : "text-amber-500"}`}>
                      {selectedJob._quote?.deposit_paid_at ? "✓ PAID" : "PENDING"}
                    </div>
                  </div>
                  <div>
                    <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-1`}>Paid</div>
                    <div className="text-2xl font-black tracking-tight text-emerald-500">{fmtMoney(fin.paid + fin.deposit)}</div>
                  </div>
                  <div>
                    <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-1`}>Balance Due</div>
                    <div className={`text-2xl font-black tracking-tight ${fin.balance > 0 ? "text-rose-500" : "text-emerald-500"}`}>{fmtMoney(fin.balance)}</div>
                  </div>
                </div>
              </div>

              {/* LINE ITEMS */}
              <div className={`${t.panelBg} border ${t.panelBorder} rounded-2xl overflow-hidden`}>
                <div className={`px-5 py-3 border-b ${t.panelBorder} flex items-center justify-between`}>
                  <h3 className={`text-[12px] font-black uppercase italic tracking-tight ${t.textStrong}`}>What's Being Made</h3>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>{itemSummary.totalUnits} units total</span>
                </div>
                <div className="divide-y divide-current/5">
                  {itemSummary.lines.length === 0 ? (
                    <div className={`p-6 text-center ${t.textMuted} text-[10px] font-black uppercase tracking-widest`}>No line items</div>
                  ) : (
                    itemSummary.lines.map((line: any, i: number) => (
                      <div key={i} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className={`font-black tracking-tight ${t.textStrong} truncate`}>{line.description}</div>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/30 uppercase tracking-widest`}>{line.quantity} pcs</span>
                            {line.colors.map((c: string) => (
                              <span key={c} className={`text-[9px] font-bold px-2 py-0.5 rounded ${t.subBg} ${t.textMuted}`}>{c}</span>
                            ))}
                            {Object.entries(line.sizes).map(([k, v]) => (
                              <span key={k} className={`text-[9px] font-bold px-2 py-0.5 rounded ${isLightMode ? "bg-slate-100 text-slate-700" : "bg-slate-800 text-slate-300"}`}>
                                {k.toUpperCase()}: {v as number}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className={`text-right shrink-0 ${t.textMuted} text-[10px] font-bold`}>
                          {fmtMoney(line.unitPrice)} × {line.quantity}
                          <div className={`${t.textStrong} font-black text-[12px]`}>= {fmtMoney(line.unitPrice * line.quantity)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TWO-COL LOWER: notes + brand assets/history */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* NOTES */}
                <div className={`${t.panelBg} border ${t.panelBorder} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-3 border-b ${t.panelBorder}`}>
                    <h3 className={`text-[12px] font-black uppercase italic tracking-tight ${t.textStrong}`}>Notes</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    {selectedJob.notes ? (
                      <pre className={`whitespace-pre-wrap text-[12px] leading-relaxed font-bold ${t.textStrong} ${t.subBg} rounded-lg p-3 max-h-64 overflow-y-auto font-mono`}>{selectedJob.notes}</pre>
                    ) : (
                      <div className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>No notes yet</div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                        placeholder="Add a note… (Enter to save)"
                        className={`${t.inputBg} border rounded-lg p-2 text-[11px] font-bold outline-none focus:border-rose-500 flex-1`}
                      />
                      <button onClick={handleAddNote} disabled={!newNote.trim()} className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest transition-all">
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* BRAND ASSETS */}
                <div className={`${t.panelBg} border ${t.panelBorder} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-3 border-b ${t.panelBorder} flex items-center justify-between`}>
                    <h3 className={`text-[12px] font-black uppercase italic tracking-tight ${t.textStrong}`}>Brand Files</h3>
                    {selectedJob._customer?.id && (
                      <Link href={`/customers?client=${selectedJob._customer.id}`} className={`text-[9px] font-black uppercase tracking-widest text-violet-500 hover:underline`}>Manage →</Link>
                    )}
                  </div>
                  <div className="p-5">
                    {customerDocuments.length === 0 ? (
                      <div className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} text-center py-4`}>No files for this customer</div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {customerDocuments.slice(0, 8).map(d => (
                          <div key={d.id} className={`flex items-center gap-3 p-2 rounded-lg ${t.subBg}`}>
                            <span className="text-xl">📄</span>
                            <div className="flex-1 min-w-0">
                              <div className={`text-[11px] font-black truncate ${t.textStrong}`}>{d.file_name}</div>
                              <div className={`text-[9px] font-bold ${t.textMuted}`}>{d.doc_type || "Other"}</div>
                            </div>
                            <button
                              onClick={async () => {
                                const { data } = await supabase.storage.from("customer-documents").createSignedUrl(d.file_url, 60);
                                if (data?.signedUrl) {
                                  const a = document.createElement("a");
                                  a.href = data.signedUrl;
                                  a.download = d.file_name;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                }
                              }}
                              className={`text-[10px] font-black uppercase tracking-widest text-violet-500 hover:underline shrink-0`}
                            >
                              ⬇
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CUSTOMER HISTORY */}
              {customerHistory.length > 0 && (
                <div className={`${t.panelBg} border ${t.panelBorder} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-3 border-b ${t.panelBorder}`}>
                    <h3 className={`text-[12px] font-black uppercase italic tracking-tight ${t.textStrong}`}>Recent Jobs from {selectedJob._customer?.company_name}</h3>
                  </div>
                  <div className="divide-y divide-current/5">
                    {customerHistory.map((h: any) => (
                      <Link key={h.id} href={`/queue?job=${h.id}`} className={`p-4 flex items-center gap-3 ${t.rowHover} transition-colors`}>
                        <div className="shrink-0 text-[9px] font-black px-2 py-1 rounded bg-rose-500/10 text-rose-500 border border-rose-500/30 uppercase tracking-widest">#{h.job_number}</div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[11px] font-black truncate ${t.textStrong}`}>{h.title}</div>
                          <div className={`text-[9px] font-bold ${t.textMuted}`}>{fmtDate(h.created_at)}</div>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${stageStyle(h.stage).bg} ${stageStyle(h.stage).text} ${stageStyle(h.stage).border} shrink-0`}>{h.stage}</span>
                        <span className={`text-[10px] font-black ${t.textStrong} shrink-0`}>{fmtMoney((h._quote?.total_amount || 0) * 1.13)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className={`text-center py-4 ${t.textMuted} text-[8px] font-black uppercase tracking-widest opacity-50`}>
                ↑ ↓ navigate · ⌘K search · esc clear
              </div>
            </div>
          ) : (
            <div className={`flex items-center justify-center h-full ${t.textMuted}`}>
              <div className="text-center">
                <div className="text-5xl mb-3 opacity-50">🔥</div>
                <div className="text-[10px] font-black uppercase tracking-widest">Select a job from the list</div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ─── BODY: GRID view (dense numbering interface) ─────────────────── */}
      {viewMode === "grid" && (
        <div className="p-4 md:p-6">
          {sortedFilteredJobs.length === 0 ? (
            <div className={`p-16 text-center ${t.textMuted}`}>
              <div className="text-5xl mb-3 opacity-50">🌴</div>
              <div className="text-[10px] font-black uppercase tracking-widest">No jobs match the current filters</div>
            </div>
          ) : (
            <>
              <div className={`mb-4 px-2 text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>
                {sortedFilteredJobs.length} jobs · Type a number to bump a job to that slot · Click ↺ Renumber to reset to 1, 2, 3…
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {sortedFilteredJobs.map((job: any) => {
                  const ss = stageStyle(job.stage);
                  const dn = daysFromNow(job.due_date);
                  const isOverdue = dn !== null && dn < 0;
                  const isUrgent = dn !== null && dn >= 0 && dn <= 2;
                  return (
                    <div
                      key={job.id}
                      className={`${t.panelBg} border ${t.panelBorder} rounded-xl overflow-hidden hover:shadow-lg transition-all flex relative`}
                    >
                      {/* Stage color bar — left edge, always visible */}
                      <div className={`w-1.5 shrink-0 ${ss.solid}`} title={job.stage}></div>

                      <div className="flex-1 min-w-0 flex flex-col">
                        {/* TOP STRIP — priority # | logo + name | stage pill */}
                        <div className={`flex items-center gap-2 p-2.5 border-b ${t.panelBorder}`}>
                          {/* Priority # input — compact, prominent */}
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={job.priority_order ?? ""}
                            placeholder="—"
                            onChange={(e) => {
                              const val = e.target.value === "" ? 9999 : parseInt(e.target.value);
                              if (!isNaN(val)) handlePriorityChange(job.id, val);
                            }}
                            className={`shrink-0 w-10 h-10 text-center text-base font-black ${isLightMode ? "bg-rose-50 border-rose-300 text-rose-600" : "bg-rose-500/10 border-rose-500/40 text-rose-400"} border-2 rounded-lg outline-none focus:border-rose-500 placeholder:text-slate-400`}
                            title="Priority number"
                          />
                          {/* Compact logo */}
                          <div className={`shrink-0 w-9 h-9 rounded-md ${isLightMode ? "bg-white border-slate-200" : "bg-slate-950/40 border-slate-800"} border flex items-center justify-center overflow-hidden`}>
                            {job._customer?.logo_url ? (
                              isPdfUrl(job._customer.logo_url) ? (
                                <span className="text-base">📕</span>
                              ) : (
                                <img src={job._customer.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                              )
                            ) : (
                              <span className={`text-[10px] font-black italic uppercase tracking-tighter ${t.textMuted} opacity-60`}>
                                {(job._customer?.company_name || "?").slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          {/* Customer name + job # stacked */}
                          <div className="flex-1 min-w-0">
                            <div className={`text-[11px] font-black uppercase tracking-tight truncate ${t.textStrong}`}>{job._customer?.company_name || "Unknown"}</div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] font-black px-1 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/30">#{job.job_number}</span>
                              <span className={`text-[8px] font-black uppercase tracking-widest ${isOverdue ? "text-red-500" : isUrgent ? "text-amber-500" : t.textMuted}`}>
                                {job.due_date ? (isOverdue ? `${Math.abs(dn!)}d OD` : `${dn}d`) : "—"}
                              </span>
                            </div>
                          </div>
                          {/* Open in detail */}
                          <button
                            onClick={() => { setViewMode("list"); selectJob(job.id); }}
                            className={`shrink-0 w-7 h-7 rounded-full ${isLightMode ? "bg-slate-100 hover:bg-rose-500 text-slate-600 hover:text-white" : "bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white"} flex items-center justify-center text-[11px] font-black transition-all`}
                            title="Open detail"
                          >
                            ↗
                          </button>
                        </div>

                        {/* BODY — title + stage + amount */}
                        <div className="p-2.5 flex flex-col gap-1.5">
                          <div className={`text-[10px] font-bold ${t.textMuted} truncate`} title={job.title}>{job.title || "—"}</div>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${ss.bg} ${ss.text} ${ss.border}`}>
                              {job.stage || "—"}
                            </span>
                            <span className={`text-[12px] font-black ${t.textStrong}`}>{fmtMoney((job._quote?.total_amount || 0) * 1.13)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PriorityQueuePage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#0f1115] flex items-center justify-center font-black text-sky-500 tracking-widest uppercase animate-pulse text-sm">Loading Queue...</div>}>
      <PriorityQueuePageInner />
    </Suspense>
  );
}
