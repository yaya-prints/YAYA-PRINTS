"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// --- FULL PRODUCTION STAGE MAP ---
const PIPELINE_STAGES = [
  { id: "Incoming",  label: "New Orders",       color: "bg-slate-500",  short: "New" },
  { id: "Artwork",   label: "Awaiting Artwork", color: "bg-purple-500", short: "Art" },
  { id: "Sourcing",  label: "To Source",        color: "bg-amber-500",  short: "Source" },
  { id: "Ordered",   label: "Blanks Ordered",   color: "bg-orange-500", short: "Ordered" },
  { id: "Received",  label: "Blanks Received",  color: "bg-lime-500",   short: "Received" },
  { id: "Staged",    label: "To Stage",         color: "bg-cyan-500",   short: "Stage" },
  { id: "Printing",  label: "To Print",         color: "bg-pink-500",   short: "Print" },
  { id: "Pressing",  label: "To Press",         color: "bg-red-500",    short: "Press" },
  { id: "Finishing", label: "To Finish",        color: "bg-teal-500",   short: "Finish" },
  { id: "Dispatch",  label: "To Dispatch",      color: "bg-blue-500",   short: "Dispatch" }
];

const LEAD_STAGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  "Cold Lead":      { label: "Cold",     color: "text-slate-500",   bg: "bg-slate-500/10",   border: "border-slate-500/30" },
  "Meeting Booked": { label: "Meeting",  color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  "Quoting":        { label: "Quoting",  color: "text-fuchsia-500", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30" },
  "Active VIP":     { label: "Active",   color: "text-sky-500",     bg: "bg-sky-500/10",     border: "border-sky-500/30" },
};

export default function ExecutiveCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [syncStatus, setSyncStatus] = useState<"live" | "polling" | "connecting">("connecting");

  // ---- DATA STATE ----
  const [agenda, setAgenda] = useState<any[]>([]);          // todos in next 3 hours, today
  const [overdueTodos, setOverdueTodos] = useState<any[]>([]); // overdue todos
  const [hotLeads, setHotLeads] = useState<any[]>([]);       // top 5 active CRM leads
  const [arOwed, setArOwed] = useState<any[]>([]);           // top owing clients
  const [productionJobs, setProductionJobs] = useState<any[]>([]); // all active jobs (for slicing into Print/Press/Source etc.)

  const [metrics, setMetrics] = useState({
    openRevenue: 0,
    closedRevenue: 0,
    activeJobs: 0,
    totalJobs: 0,
    conversionRate: 0,
    arTotal: 0,
    overdueJobsCount: 0,
    stageBreakdown: {} as Record<string, number>
  });

  // Tick the clock every minute (so the "next 3 hours" window stays current)
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = useCallback(async () => {
    // ---- 1. SALES (quotes) ----
    const { data: quotes } = await supabase
      .from("quotes")
      .select("id, status, total_amount, amount_paid, customers(company_name)");

    let openRev = 0, closedRev = 0, draftCount = 0, approvedCount = 0;
    let arTotal = 0;
    const arByClient: Record<string, { name: string; amount: number; quoteIds: string[] }> = {};

    if (quotes) {
      quotes.forEach((q: any) => {
        if (q.status === "Draft") { openRev += q.total_amount || 0; draftCount++; }
        else if (q.status === "Approved") {
          closedRev += q.total_amount || 0;
          approvedCount++;
          // A/R: approved quote with amount_paid less than total
          const owe = (q.total_amount || 0) - (q.amount_paid || 0);
          if (owe > 0.01) {
            arTotal += owe;
            const name = q.customers?.company_name || "Unknown";
            if (!arByClient[name]) arByClient[name] = { name, amount: 0, quoteIds: [] };
            arByClient[name].amount += owe;
            arByClient[name].quoteIds.push(q.id);
          }
        }
      });
    }
    const totalQuotes = draftCount + approvedCount;
    const winRate = totalQuotes > 0 ? Math.round((approvedCount / totalQuotes) * 100) : 0;

    // ---- 2. PRODUCTION (jobs) ----
    const { data: jobs } = await supabase
      .from("jobs")
      .select(`
        id, job_number, stage, due_date, sort_order,
        quotes(total_amount, customers(company_name))
      `)
      .order("sort_order", { ascending: true, nullsFirst: false });

    let active = 0;
    let overdueJobs = 0;
    const breakdown: Record<string, number> = {};
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    if (jobs) {
      jobs.forEach((j: any) => {
        const stage = j.stage;
        breakdown[stage] = (breakdown[stage] || 0) + 1;
        if (stage !== "Paid" && stage !== "Billing") {
          active++;
          if (j.due_date && new Date(j.due_date) < todayStart) overdueJobs++;
        }
      });
    }
    const activeJobs = (jobs || []).filter((j: any) => j.stage !== "Paid" && j.stage !== "Billing");
    setProductionJobs(activeJobs);

    // ---- 3. CRM HOT LEADS ----
    const { data: leadsData } = await supabase
      .from("customers")
      .select("id, company_name, contact_name, lead_status, last_contacted_at, vip_tier")
      .in("lead_status", ["Cold Lead", "Meeting Booked", "Quoting"])
      .order("last_contacted_at", { ascending: false, nullsFirst: false })
      .limit(5);
    setHotLeads(leadsData || []);

    // ---- 4. TODOS — split into "next 3 hours today" and "overdue" ----
    const todayStr = (() => {
      const d = new Date();
      const tz = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tz).toISOString().split('T')[0];
    })();

    const { data: todosToday } = await supabase
      .from("todos")
      .select(`id, task, target_date, target_time, duration_minutes, jobs(job_number, quotes(customers(company_name)))`)
      .eq("is_completed", false)
      .eq("is_deleted", false)
      .eq("target_date", todayStr)
      .order("target_time", { ascending: true });

    const { data: todosOverdue } = await supabase
      .from("todos")
      .select(`id, task, target_date, target_time, jobs(job_number, quotes(customers(company_name)))`)
      .eq("is_completed", false)
      .eq("is_deleted", false)
      .lt("target_date", todayStr)
      .order("target_date", { ascending: true })
      .limit(5);

    // Build "next 3 hours" window
    const nowDate = new Date();
    const threeHoursLater = new Date(nowDate.getTime() + 3 * 60 * 60 * 1000);
    const nextWindow = (todosToday || []).filter((t: any) => {
      if (!t.target_time) return false;
      const [h, m] = t.target_time.split(":").map((x: string) => parseInt(x, 10));
      const taskDate = new Date();
      taskDate.setHours(h, m, 0, 0);
      // Show items from now until 3 hours later (and ones that started recently — within 30 min)
      const thirtyMinAgo = new Date(nowDate.getTime() - 30 * 60 * 1000);
      return taskDate >= thirtyMinAgo && taskDate <= threeHoursLater;
    });
    setAgenda(nextWindow.length > 0 ? nextWindow : (todosToday || []).slice(0, 6));
    setOverdueTodos(todosOverdue || []);

    // A/R top list
    const arSorted = Object.values(arByClient).sort((a: any, b: any) => b.amount - a.amount).slice(0, 6);
    setArOwed(arSorted);

    setMetrics({
      openRevenue: openRev,
      closedRevenue: closedRev,
      activeJobs: active,
      totalJobs: jobs?.length || 0,
      conversionRate: winRate,
      arTotal,
      overdueJobsCount: overdueJobs,
      stageBreakdown: breakdown
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    // Realtime — when anything in jobs/quotes/todos changes anywhere, refresh
    const channel = supabase
      .channel('home-cmd-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchAll())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSyncStatus('polling');
      });

    // 60s poll fallback
    const poll = setInterval(fetchAll, 60000);

    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [fetchAll]);

  const formatToAMPM = (time24: string) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  })();

  // Production breakdowns
  const sourcingJobs = productionJobs.filter(j => j.stage === "Sourcing" || j.stage === "Ordered").slice(0, 5);
  const printingJobs = productionJobs.filter(j => j.stage === "Printing" || j.stage === "Staged").slice(0, 5);
  const pressingJobs = productionJobs.filter(j => j.stage === "Pressing").slice(0, 5);
  const finishingJobs = productionJobs.filter(j => j.stage === "Finishing" || j.stage === "Dispatch").slice(0, 5);

  const isJobOverdue = (j: any) => {
    if (!j.due_date) return false;
    const d = new Date(j.due_date);
    const today = new Date(); today.setHours(0,0,0,0);
    return d < today;
  };

  const renderJobMiniCard = (j: any) => {
    const overdue = isJobOverdue(j);
    return (
      <Link
        href="/jobs"
        key={j.id}
        className={`group block px-3 py-2 rounded-lg border transition-all hover:-translate-y-0.5 ${overdue ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-500/30' : 'bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/5 hover:border-sky-500/50'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <span className="text-[11px] font-black uppercase truncate text-slate-900 dark:text-white">
              #{j.job_number} {j.quotes?.customers?.company_name || "Unknown"}
            </span>
            <span className="text-[8px] font-bold text-slate-500 truncate uppercase tracking-widest">
              Due: {j.due_date ? new Date(j.due_date).toLocaleDateString() : 'TBD'}
            </span>
          </div>
          {overdue && <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-red-500 text-white uppercase shrink-0">OD</span>}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1115] text-slate-900 dark:text-white font-sans p-3 sm:p-4 md:p-8 max-w-[1600px] mx-auto pb-8 md:pb-32 transition-colors duration-300">

      {/* ============ HEADER ============ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-5 md:mb-8 border-b border-slate-200 dark:border-white/10 pb-5 md:pb-8 mt-2 md:mt-4 gap-3 md:gap-4">
        <div className="w-full md:w-auto">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none text-slate-900 dark:text-white">YAYA Command</h1>
            <span
              className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 px-2 py-1 rounded-full border ${
                syncStatus === 'live'
                  ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                  : syncStatus === 'polling'
                    ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
                    : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
              }`}
              title={
                syncStatus === 'live' ? 'Realtime sync active — every change across the app appears here instantly' :
                syncStatus === 'polling' ? 'Realtime disconnected — polling every 60s' :
                'Connecting…'
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'live' ? 'bg-emerald-500 animate-pulse' : syncStatus === 'polling' ? 'bg-amber-500' : 'bg-slate-400 animate-pulse'}`}></span>
              {syncStatus === 'live' ? 'Live' : syncStatus === 'polling' ? 'Poll' : '...'}
            </span>
          </div>
          <p className="text-slate-500 text-[11px] md:text-xs font-black uppercase tracking-widest md:tracking-[0.3em] mt-2 md:mt-3 md:ml-1">
            {greeting} · {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={fetchAll}
            className="flex-1 md:flex-none px-4 py-2.5 md:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] md:text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:border-sky-500 hover:text-sky-500 transition-colors min-h-[44px] md:min-h-0 active:scale-95"
            title="Force refresh"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ============ ALERT STRIP — only when something needs attention ============ */}
      {!loading && (overdueTodos.length > 0 || metrics.overdueJobsCount > 0) && (
        <div className="mb-5 md:mb-6 p-4 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="text-[12px] md:text-[11px] font-black uppercase tracking-widest text-red-700 dark:text-red-400">Needs your attention</p>
              <p className="text-[11px] md:text-[10px] font-bold text-red-600 dark:text-red-300 mt-0.5">
                {overdueTodos.length > 0 && `${overdueTodos.length} overdue task${overdueTodos.length > 1 ? 's' : ''}`}
                {overdueTodos.length > 0 && metrics.overdueJobsCount > 0 && ' · '}
                {metrics.overdueJobsCount > 0 && `${metrics.overdueJobsCount} overdue job${metrics.overdueJobsCount > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {overdueTodos.length > 0 && (
              <Link href="/todos" className="flex-1 md:flex-none text-center px-4 py-3 md:py-2 bg-red-500 hover:bg-red-600 text-white text-[11px] md:text-[10px] font-black uppercase tracking-widest rounded-lg shadow transition-colors min-h-[44px] md:min-h-0 flex items-center justify-center active:scale-95">View Tasks →</Link>
            )}
            {metrics.overdueJobsCount > 0 && (
              <Link href="/jobs" className="flex-1 md:flex-none text-center px-4 py-3 md:py-2 bg-red-500 hover:bg-red-600 text-white text-[11px] md:text-[10px] font-black uppercase tracking-widest rounded-lg shadow transition-colors min-h-[44px] md:min-h-0 flex items-center justify-center active:scale-95">View Jobs →</Link>
            )}
          </div>
        </div>
      )}

      {/* ============ KPI METRICS GRID — 5 cards ============ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4 mb-5 md:mb-6">
        {[
          { label: "Open Proposals", subtitle: "Pipeline revenue", value: `$${metrics.openRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}`, color: "blue", href: "/quotes" },
          { label: "Closed Revenue", subtitle: "Approved total",   value: `$${metrics.closedRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}`, color: "emerald", href: "/quotes" },
          { label: "A/R Owed",       subtitle: "Money to collect", value: `$${metrics.arTotal.toLocaleString(undefined, {maximumFractionDigits: 0})}`, color: "rose", href: "/invoices" },
          { label: "Active Jobs",    subtitle: "In production",    value: `${metrics.activeJobs}`, color: "amber", href: "/jobs" },
          { label: "Win Rate",       subtitle: "Lead → deal",      value: `${metrics.conversionRate}%`, color: "purple", href: "/quotes" },
        ].map((kpi, i) => (
          <Link
            key={i}
            href={kpi.href}
            className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 p-3.5 sm:p-4 md:p-5 rounded-2xl shadow hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all relative overflow-hidden group"
          >
            <div className={`absolute top-0 right-0 w-20 h-20 bg-${kpi.color}-500/10 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-${kpi.color}-500/20 transition-colors`}></div>
            <div className={`text-[10px] sm:text-[9px] font-black text-${kpi.color}-600 dark:text-${kpi.color}-400 uppercase tracking-widest mb-1 relative z-10`}>{kpi.label}</div>
            {loading ? (
              <div className="h-7 w-20 bg-slate-200 dark:bg-white/5 rounded animate-pulse"></div>
            ) : (
              <div className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tighter relative z-10">{kpi.value}</div>
            )}
            <div className="text-[10px] sm:text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1 relative z-10">{kpi.subtitle}</div>
          </Link>
        ))}
      </div>

      {/* ============ ROW 2: NEXT 3 HOURS + A/R ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6">

        {/* NEXT 3 HOURS — left, 2/3 */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 p-5 md:p-6 rounded-2xl shadow flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏰</span>
              <h2 className="text-[12px] md:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Next 3 Hours</h2>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{now.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}</span>
            </div>
            <Link href="/todos" className="text-[9px] font-black text-purple-500 uppercase tracking-widest hover:text-purple-400">Calendar →</Link>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-12 bg-slate-100 dark:bg-white/5 rounded-xl"></div>
              <div className="h-12 bg-slate-100 dark:bg-white/5 rounded-xl"></div>
              <div className="h-12 bg-slate-100 dark:bg-white/5 rounded-xl"></div>
            </div>
          ) : agenda.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="text-3xl mb-2">🌴</span>
              <p className="text-[11px] font-black uppercase tracking-widest mb-1">Clear schedule</p>
              <p className="text-[9px] font-bold uppercase tracking-widest opacity-70">No tasks in the next 3 hours</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 flex-1">
              {agenda.map((item: any) => {
                // Determine if "now" or upcoming
                let timeBadge = "upcoming";
                if (item.target_time) {
                  const [h, m] = item.target_time.split(":").map((x: string) => parseInt(x, 10));
                  const td = new Date(); td.setHours(h, m, 0, 0);
                  const diff = td.getTime() - now.getTime();
                  if (diff < 0 && diff > -30 * 60 * 1000) timeBadge = "now";
                  else if (diff < 0) timeBadge = "late";
                  else if (diff < 60 * 60 * 1000) timeBadge = "soon";
                }
                const badgeStyle = {
                  now:      'bg-emerald-500 text-white',
                  late:     'bg-red-500 text-white',
                  soon:     'bg-amber-500 text-white',
                  upcoming: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }[timeBadge];
                return (
                  <Link
                    href="/todos"
                    key={item.id}
                    className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 p-3 rounded-xl flex items-center justify-between gap-3 hover:border-purple-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest shrink-0 ${badgeStyle}`}>
                        {timeBadge === 'now' ? 'NOW' : timeBadge === 'late' ? 'LATE' : timeBadge === 'soon' ? 'SOON' : 'UPCOMING'}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] font-black text-slate-900 dark:text-white uppercase truncate">{item.task}</span>
                        {item.jobs && (
                          <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 truncate">
                            #{item.jobs.job_number} {item.jobs.quotes?.customers?.company_name}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.target_time && (
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 shrink-0 font-mono">
                        {formatToAMPM(item.target_time)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* A/R OWED — right */}
        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 p-5 md:p-6 rounded-2xl shadow flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <h2 className="text-[12px] md:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Money Owed</h2>
            </div>
            <Link href="/invoices" className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-400">All →</Link>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-10 bg-slate-100 dark:bg-white/5 rounded-xl"></div>
              <div className="h-10 bg-slate-100 dark:bg-white/5 rounded-xl"></div>
            </div>
          ) : arOwed.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-slate-400">
              <span className="text-3xl mb-2">✓</span>
              <p className="text-[11px] font-black uppercase tracking-widest">All paid up</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {arOwed.map((c: any) => (
                <Link
                  href="/invoices"
                  key={c.name}
                  className="px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex items-center justify-between gap-2 hover:border-rose-500/50 transition-colors"
                >
                  <span className="text-[11px] font-black uppercase truncate text-slate-900 dark:text-white">{c.name}</span>
                  <span className="text-sm font-black text-rose-500 shrink-0">${c.amount.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ============ ROW 3: HOT LEADS + BOTTLENECKS + ACTION ITEMS ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6">

        {/* HOT LEADS */}
        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 p-5 md:p-6 rounded-2xl shadow flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <h2 className="text-[12px] md:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Hot Leads</h2>
            </div>
            <Link href="/customers" className="text-[9px] font-black text-teal-500 uppercase tracking-widest hover:text-teal-400">CRM →</Link>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-10 bg-slate-100 dark:bg-white/5 rounded-xl"></div>
              <div className="h-10 bg-slate-100 dark:bg-white/5 rounded-xl"></div>
            </div>
          ) : hotLeads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-slate-400">
              <p className="text-[10px] font-black uppercase tracking-widest">No active leads</p>
              <Link href="/prospector" className="mt-3 text-[9px] font-black text-fuchsia-500 uppercase tracking-widest hover:text-fuchsia-400">Find some →</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {hotLeads.map((lead: any) => {
                const stage = LEAD_STAGES[lead.lead_status] || LEAD_STAGES["Cold Lead"];
                return (
                  <Link
                    href="/customers"
                    key={lead.id}
                    className="px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 flex items-center justify-between gap-2 hover:border-teal-500/50 transition-colors"
                  >
                    <span className="text-[11px] font-black uppercase truncate text-slate-900 dark:text-white">{lead.company_name}</span>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-widest shrink-0 ${stage.bg} ${stage.color} ${stage.border}`}>{stage.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* PIPELINE BOTTLENECKS — compact version */}
        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 p-5 md:p-6 rounded-2xl shadow flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <h2 className="text-[12px] md:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Pipeline</h2>
            </div>
            <Link href="/jobs" className="text-[9px] font-black text-sky-500 uppercase tracking-widest hover:text-sky-400">Board →</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {PIPELINE_STAGES.filter((_, i) => i < 6).map((stat) => {
              const val = metrics.stageBreakdown[stat.id] || 0;
              const maxVal = metrics.activeJobs > 0 ? metrics.activeJobs : 1;
              const pct = Math.min(100, Math.round((val / maxVal) * 100));
              return (
                <div key={stat.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest truncate ${val > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>{stat.short}</span>
                    <span className={`text-[9px] font-black ${val > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-700'}`}>{val}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-black h-1.5 rounded-full overflow-hidden">
                    <div className={`h-full ${val > 0 ? stat.color : 'bg-transparent'} transition-all`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* OVERDUE TASKS — only shows when there ARE overdue, otherwise it's a 'green / clear' card */}
        <div className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 p-5 md:p-6 rounded-2xl shadow flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <h2 className="text-[12px] md:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Overdue Tasks</h2>
            </div>
            <Link href="/todos" className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-400">Tracker →</Link>
          </div>
          {loading ? (
            <div className="h-12 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
          ) : overdueTodos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-emerald-500">
              <span className="text-3xl mb-2">✓</span>
              <p className="text-[10px] font-black uppercase tracking-widest">Nothing overdue</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {overdueTodos.map((t: any) => (
                <Link
                  href="/todos"
                  key={t.id}
                  className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 flex flex-col gap-0.5 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                >
                  <span className="text-[10px] font-black uppercase truncate text-red-700 dark:text-red-300">{t.task}</span>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
                    {t.jobs ? `#${t.jobs.job_number} · ` : ''}due {new Date(t.target_date).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ============ ROW 4: PRODUCTION SHORTCUTS — what to do next on the floor ============ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6">

        {[
          { title: "🛒 To Purchase", subtitle: "Need to source/order blanks", color: "amber", jobs: sourcingJobs, href: "/purchasing" },
          { title: "🖨 To Print",    subtitle: "Staged + ready for press",     color: "pink",  jobs: printingJobs, href: "/jobs" },
          { title: "🔥 To Press",    subtitle: "Heat-press queue",             color: "red",   jobs: pressingJobs, href: "/shop-floor" },
          { title: "📦 To Finish",   subtitle: "Finishing + dispatch",         color: "teal",  jobs: finishingJobs, href: "/jobs" },
        ].map((bucket, i) => (
          <div key={i} className="bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 p-4 md:p-5 rounded-2xl shadow flex flex-col">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200 dark:border-white/5">
              <div className="flex flex-col">
                <h3 className={`text-[10px] font-black text-${bucket.color}-600 dark:text-${bucket.color}-400 uppercase tracking-widest`}>{bucket.title}</h3>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{bucket.subtitle}</span>
              </div>
              <span className={`text-xs font-black px-2 py-1 rounded-md bg-${bucket.color}-500/10 text-${bucket.color}-500 border border-${bucket.color}-500/20`}>{bucket.jobs.length}</span>
            </div>
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-10 bg-slate-100 dark:bg-white/5 rounded-lg"></div>
              </div>
            ) : bucket.jobs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nothing here</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {bucket.jobs.map(renderJobMiniCard)}
                <Link href={bucket.href} className={`text-center mt-2 text-[9px] font-black text-${bucket.color}-500 hover:text-${bucket.color}-400 uppercase tracking-widest`}>
                  View all →
                </Link>
              </div>
            )}
          </div>
        ))}

      </div>

      {/* ============ QUICK ACTIONS PANEL ============ */}
      <div className="bg-gradient-to-br from-sky-600 to-blue-700 rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0_20px_50px_rgba(37,99,235,0.3)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -ml-10 -mb-10"></div>
        <div className="relative z-10">
          <p className="text-[11px] md:text-[9px] font-black text-white/80 uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Link href="/quotes/new" className="bg-white text-blue-600 text-center py-4 md:py-3 rounded-xl font-black uppercase tracking-widest text-[11px] md:text-[9px] hover:scale-[1.02] active:scale-95 transition-all shadow-lg min-h-[52px] md:min-h-0 flex items-center justify-center">+ Proposal</Link>
            <Link href="/todos" className="bg-blue-800 hover:bg-blue-900 text-white border border-blue-500 text-center py-4 md:py-3 rounded-xl font-black uppercase tracking-widest text-[11px] md:text-[9px] hover:scale-[1.02] active:scale-95 transition-all min-h-[52px] md:min-h-0 flex items-center justify-center">+ Task</Link>
            <Link href="/customers" className="bg-blue-800 hover:bg-blue-900 text-white border border-blue-500 text-center py-4 md:py-3 rounded-xl font-black uppercase tracking-widest text-[11px] md:text-[9px] hover:scale-[1.02] active:scale-95 transition-all min-h-[52px] md:min-h-0 flex items-center justify-center">+ Lead</Link>
            <Link href="/shop-floor" className="bg-emerald-500 hover:bg-emerald-600 text-white text-center py-4 md:py-3 rounded-xl font-black uppercase tracking-widest text-[11px] md:text-[9px] hover:scale-[1.02] active:scale-95 transition-all shadow-lg min-h-[52px] md:min-h-0 flex items-center justify-center">▶ Shop Floor</Link>
            <Link href="/jobs" className="bg-blue-800 hover:bg-blue-900 text-white border border-blue-500 text-center py-4 md:py-3 rounded-xl font-black uppercase tracking-widest text-[11px] md:text-[9px] hover:scale-[1.02] active:scale-95 transition-all col-span-2 md:col-span-1 min-h-[52px] md:min-h-0 flex items-center justify-center">📋 Board</Link>
          </div>
        </div>
      </div>

    </div>
  );
}
