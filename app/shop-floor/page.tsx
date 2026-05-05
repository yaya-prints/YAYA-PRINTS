"use client";

import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import Link from "next/link"; 

// --- COLOR DATABASE FOR PROMINENT SWATCHES ---
const COLOR_HEX_MAP: Record<string, string> = {
  "Antique Cherry Red": "#7C1C29", "Antique Sapphire": "#126B88", "Ash": "#D7D7D7", "Ash Grey": "#D7D7D7",
  "Azalea": "#F089B2", "Black": "#111111", "Cardinal Red": "#8A1529", 
  "Carolina Blue": "#7BAFD4", "Charcoal": "#4F5254", "Charcoal Grey": "#4F5254", "Cherry Red": "#B80F2A", 
  "Dark Chocolate": "#35231D", "Dark Heather": "#4B4F55", "Forest Green": "#182C25", 
  "Garnet": "#5F121F", "Gold": "#FFC72C", "Heather Dark Green": "#2d4235", 
  "Heather Dark Maroon": "#5d1e2e", "Heather Dark Navy": "#2b3447", 
  "Heather Deep Royal": "#3b5ba5", "Heather Scarlet Red": "#b93d47", 
  "Heliconia": "#DB3E79", "Indigo Blue": "#475D74", "Irish Green": "#009E60", 
  "Light Blue": "#ADD8E6", "Light Pink": "#FFB6C1", "Maroon": "#500000", 
  "Navy": "#000080", "Purple": "#6A0DAD", "Red": "#E60000", "Royal": "#4169E1", 
  "Safety Green": "#CEFF00", "Sand": "#C2B280", "Sapphire": "#0F52BA", 
  "Sport Grey": "#9E9E9E", "White": "#FFFFFF"
};

const getColorHex = (colorName: string): string => {
  if (!colorName) return "#CD7F32"; 
  const lower = colorName.toLowerCase().trim();
  const colorMap: { [key: string]: string } = {
    black: "#0f1115", white: "#ffffff", navy: "#1e3a8a", red: "#dc2626", royal: "#2563eb", "royal blue": "#2563eb",
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

const getContrastTextColor = (hex: string, isLightMode: boolean) => {
    const lowerHex = hex.toLowerCase();
    if (lowerHex === '#ffffff' || lowerHex === '#fff') return isLightMode ? '#0f1115' : '#ffffff';
    if (lowerHex === '#000000' || lowerHex === '#000' || lowerHex === '#111111') return isLightMode ? '#000000' : '#ffffff';
    return hex;
};

const renderGarmentIcon = (description: string, colorHex: string): ReactNode => {
  const desc = description?.toLowerCase() || "";
  const classes = "w-6 h-6 mr-2 shrink-0 drop-shadow-md";
  if (desc.includes("hoodie") || desc.includes("hooded")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M18 9l3 3-2 2-1-2v10H6V12l-1 2-2-2 3-3" /><path d="M8 9V5c0-2.5 1.5-4 4-4s4 1.5 4 4v4" /><path d="M10 9v3" /><path d="M14 9v3" /><path d="M7.5 15h9l1 5H6.5l1-5z" /></svg>);
  }
  if (desc.includes("polo") || desc.includes("collared")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M18 7l3 3-2 2-1-2v12H6V10l-1 2-2-2 3-3" /><path d="M9 7l3 4 3-4" /><path d="M12 7v6" /><circle cx="12" cy="10" r="0.5" fill={colorHex}/></svg>);
  }
  if (desc.includes("hat") || desc.includes("cap") || desc.includes("beanie")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M4 15v-2a8 8 0 0 1 16 0v2" /><path d="M2 15h15c2 0 4 1 4 2s-2 2-4 2H2v-4z" /><circle cx="12" cy="4" r="1.5" /><path d="M12 5.5v7.5" /></svg>);
  }
  if (desc.includes("long sleeve") || desc.includes("longsleeve")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M17 6L22 18l-3 1-2-9v12H7V12L5 19l-3-1L7 6" /><path d="M8 6c0 2 2 3 4 3s4-1 4-3" /></svg>);
  }
  if (desc.includes("jacket") || desc.includes("zip") || desc.includes("coat")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M18 9l3 4-2 2-1-3v10H6V12l-1 3-2-2 3-4" /><path d="M9 9V5l3 3 3-3v4" /><path d="M12 8v14" /><path d="M7 16h3" /><path d="M14 16h3" /></svg>);
  }
  return (<svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M18 7l3 3-2 2-1-2v12H6V10l-1 2-2-2 3-3" /><path d="M8 7c0 2 1.5 3 4 3s4-1 4-3" /></svg>);
};

const STAGE_OPTIONS = [
  { dbValue: "Received", label: "To Received" },
  { dbValue: "Printing", label: "To Print" },
  { dbValue: "Pressing", label: "To Press" },
  { dbValue: "Finishing", label: "To Package" },
  { dbValue: "Dispatch", label: "To Deliver / Pickup" }
];

const PIPELINE_ORDER = [
  "Incoming", "Artwork", "Sourcing", "Ordered", "Received",
  "Staged", "Printing", "Pressing", "Finishing", "Dispatch", "Billing", "Paid"
];

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

function ToggleSwitch({ checked, onChange, label, sublabel, accentColor = "emerald", isLightMode = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; sublabel?: string; accentColor?: string, isLightMode?: boolean }) {
  const colorMap: Record<string, { bg: string; ring: string }> = {
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/20", ring: "shadow-[0_0_12px_rgba(16,185,129,0.4)]" },
    sky: { bg: "bg-sky-50 dark:bg-sky-950/20", ring: "shadow-[0_0_12px_rgba(56,189,248,0.4)]" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/20", ring: "shadow-[0_0_12px_rgba(245,158,11,0.4)]" },
    rose: { bg: "bg-rose-50 dark:bg-rose-950/20", ring: "shadow-[0_0_12px_rgba(244,63,94,0.4)]" },
    teal: { bg: "bg-teal-50 dark:bg-teal-950/20", ring: "shadow-[0_0_12px_rgba(20,184,166,0.4)]" },
  };
  const colors = colorMap[accentColor] || colorMap.emerald;
  return (
    <button 
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 w-full p-2.5 rounded-xl border-2 transition-all duration-200 text-left group ${
        checked 
          ? (isLightMode 
             ? `bg-${accentColor}-50 border-${accentColor}-400 ${colors.ring}`
             : `bg-${accentColor}-950/20 border-${accentColor}-700/40 ${colors.ring}`)
          : (isLightMode ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-black/40 border-slate-800 hover:border-slate-600')
      }`}
      style={checked ? { 
        backgroundColor: isLightMode 
            ? (accentColor === 'emerald' ? '#ecfdf5' : accentColor === 'teal' ? '#f0fdfa' : accentColor === 'rose' ? '#fff1f2' : '#ecfdf5')
            : (accentColor === 'emerald' ? 'rgba(6,78,59,0.2)' : accentColor === 'teal' ? 'rgba(15,118,110,0.15)' : accentColor === 'rose' ? 'rgba(159,18,57,0.15)' : 'rgba(6,78,59,0.2)'),
        borderColor: accentColor === 'emerald' ? (isLightMode ? '#34d399' : 'rgba(16,185,129,0.4)') : accentColor === 'teal' ? (isLightMode ? '#2dd4bf' : 'rgba(20,184,166,0.4)') : accentColor === 'rose' ? (isLightMode ? '#fb7185' : 'rgba(244,63,94,0.3)') : (isLightMode ? '#34d399' : 'rgba(16,185,129,0.4)')
      } : {}}
    >
      <div 
        className={`relative w-9 h-5 rounded-full transition-all duration-200 shrink-0 ${checked ? colors.bg : (isLightMode ? 'bg-slate-300' : 'bg-slate-700')}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className={`text-[9px] font-black uppercase tracking-widest transition-colors truncate ${checked ? (isLightMode ? 'text-slate-900' : 'text-white') : (isLightMode ? 'text-slate-500 group-hover:text-slate-700' : 'text-slate-400 group-hover:text-slate-200')}`}>{label}</span>
        {sublabel && <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 truncate ${isLightMode ? 'text-slate-400' : 'text-slate-600'}`}>{sublabel}</span>}
      </div>
      {checked && (
        <div className="ml-auto shrink-0">
          <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20" style={{ color: accentColor === 'teal' ? '#2dd4bf' : accentColor === 'rose' ? '#fb7185' : '#34d399' }}>
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  );
}

// =============================================================================
// HELPER: Load saved progress from the most recent "Progress Saved" job_log
// for the given job + stage. Returns the metadata object or null.
// =============================================================================
async function loadSavedProgress(jobId: string, currentStage: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from("job_logs")
      .select("metadata, notes")
      .eq("job_id", jobId)
      .eq("from_stage", currentStage)
      .eq("to_stage", currentStage) // Progress saves have from_stage === to_stage
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error loading saved progress:", error);
      return null;
    }
    if (data && data.length > 0 && data[0].metadata) {
      return data[0].metadata;
    }
    return null;
  } catch (err) {
    console.error("Exception loading saved progress:", err);
    return null;
  }
}

export default function ShopFloorTerminal() {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track the PREVIOUS active job id so we only reset state on actual job switch
  const prevActiveJobIdRef = useRef<string | null>(null);
  
  // Track whether we're currently loading progress (to show indicator)
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [hasUnsavedProgress, setHasUnsavedProgress] = useState(false); 
  
  // --- MOBILE QUEUE & MODAL STATE ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"details" | "artwork" | "pressing">("details");
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  
  const [logData, setLogData] = useState({
      qtyProcessed: "0",
      pricePaid: "",
      spoilsTotal: 0,
      spoilsSizes: { S: 0, M: 0, L: 0, XL: 0, "2XL": 0, "3XL": 0 },
      operatorNotes: "",
      operatorName: "OP-1",
      manualStatusOverride: "" 
  });
  
  // RESTORED: Original tickCounts variable for backward compatibility
  const [tickCounts, setTickCounts] = useState<Record<string, number>>({});
  
  // --- INDEPENDENT STATE FOR PRINT vs PRESS ---
  const [tickCountsPrint, setTickCountsPrint] = useState<Record<string, number>>({});
  const [tickCountsPress, setTickCountsPress] = useState<Record<string, number>>({});

  const [stagedSizesPresent, setStagedSizesPresent] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SIZE_OPTIONS.forEach(s => { initial[s] = false; });
    return initial;
  });
  const [stagedReceivedBy, setStagedReceivedBy] = useState<string>("");
  const [stagedBoxLocation, setStagedBoxLocation] = useState<string>("");
  const [finishingQcBy, setFinishingQcBy] = useState<string>("");
  const [dispatchInvoicePaid, setDispatchInvoicePaid] = useState<boolean>(false);
  const [dispatchTrackingNumber, setDispatchTrackingNumber] = useState<string>("");
  const [dispatchPickupBin, setDispatchPickupBin] = useState<string>("");
  const [dispatchMethod, setDispatchMethod] = useState<"shipping" | "pickup">("pickup");
  
  // --- Save feedback state ---
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  // --- ADDITIVE: SCHEDULE TASK MODAL STATE ---
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTaskName, setScheduleTaskName] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  // --- QUEUE FILTER & SEARCH (helps printers find the job they need on a crowded shop floor) ---
  const [queueSearch, setQueueSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState<"all" | "urgent" | "upstream" | "ready" | "printing" | "pressing" | "finishing" | "dispatch">("all");

  // --- ESCAPE KEY LISTENER FOR SAFELY CLOSING JOBS & MODALS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
         if (showConfirmModal) {
            setShowConfirmModal(false);
         } else if (scheduleModalOpen) {
            setScheduleModalOpen(false);
         } else if (activeJob) {
            if (hasUnsavedProgress) {
                const confirmDiscard = window.confirm("⚠️ You have unsaved progress on this job. Are you sure you want to close it and discard your changes?");
                if (confirmDiscard) {
                    setActiveJob(null);
                    setHasUnsavedProgress(false);
                }
            } else {
                setActiveJob(null);
            }
         }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeJob, hasUnsavedProgress, scheduleModalOpen, showConfirmModal]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    if (savedTheme === 'light') setIsLightMode(true);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatJobForTerminal = useCallback((dbJob: any) => {
    const items = dbJob.quotes?.quote_items || [];
    const primaryItem = items[0] || {};
    const variants = primaryItem.quote_item_variants || [];
    
    let totalTargetQty = 0;
    const itemsList = items.map((item: any) => {
        totalTargetQty += (item.quantity || 0);
        return {
            id: item.id,
            description: item.description || "Custom Apparel",
            quantity: item.quantity || 0,
            variants: (item.quote_item_variants || []).sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))
        };
    }).sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));

    let sizeStrs: string[] = [];
    let colors = new Set<string>();
    const totals: any = { S: 0, M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0 };
    
    variants.forEach((v: any) => {
      if (v.color) colors.add(v.color);
      if (v.s) totals.S += v.s;
      if (v.m) totals.M += v.m;
      if (v.l) totals.L += v.l;
      if (v.xl) totals.XL += v.xl;
      if (v.xxl) totals['2XL'] += v.xxl;
      if (v.xxxl) totals['3XL'] += v.xxxl;
    });
    for (const [key, val] of Object.entries(totals)) {
      if ((val as number) > 0) sizeStrs.push(`${key}: ${val}`);
    }
    return {
        id: dbJob.id,
        job_number: dbJob.job_number,
        client: dbJob.quotes?.customers?.company_name || dbJob.title || "Internal Job",
        deadline: dbJob.due_date || "No Due Date",
        status: dbJob.stage,
        garment: primaryItem.description || "Custom Apparel",
        color: Array.from(colors).join(', ') || "Various",
        sizes: sizeStrs.join(' | ') || "TBD",
        itemsList: itemsList, 
        totalTargetQty: totalTargetQty, 
        
        frontSpecs: dbJob.front_specs || { preset: "Custom", scale: 30, x: 50, y: 40 },
        backSpecs: dbJob.back_specs || { preset: "No Print", scale: 0, x: 50, y: 50 },
        
        progressData: dbJob.progress_data || {},

        _raw: dbJob
    };
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          quotes(id, total_amount, customers(*), quote_items(*, quote_item_variants(*))), progress_data
        `)
        .in('stage', ['Incoming', 'Artwork', 'Sourcing', 'Ordered', 'Received', 'Staged', 'Printing', 'Pressing', 'Finishing', 'Dispatch']);
      if (error) throw error;
      if (data) {
        const formattedJobs = data.map(formatJobForTerminal).sort((a, b) => {
            const stageDiff = PIPELINE_ORDER.indexOf(a.status) - PIPELINE_ORDER.indexOf(b.status);
            if (stageDiff !== 0) return stageDiff;
            return a.job_number - b.job_number;
        });
        setJobs(formattedJobs);

        setActiveJob((prev: any) => {
          if (formattedJobs.length === 0) return null;
          if (!prev) {
            // Default to the first job that's ready to work on (not upstream queue)
            const ready = formattedJobs.find(j => ['Received','Staged','Printing','Pressing','Finishing','Dispatch'].includes(j.status));
            return ready || formattedJobs[0];
          }
          const stillExists = formattedJobs.find(j => j.id === prev.id);
          if (stillExists) return stillExists;
          return formattedJobs[0];
        });
      }
    } catch (err) {
      console.error("Error fetching shop floor jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [formatJobForTerminal]);

  // --- SYNC STATUS indicator: shows when data flows from quotes/invoices/CRM ---
  const [syncStatus, setSyncStatus] = useState<"live" | "polling" | "connecting">("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<number>(Date.now());
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Set<string>>(new Set());
  const prevJobIdsRef = useRef<Set<string>>(new Set());

  // Detect newly-arrived jobs (flash badge for 10s)
  useEffect(() => {
    const currentIds = new Set(jobs.map(j => j.id));
    const prevIds = prevJobIdsRef.current;
    const newlyAdded = [...currentIds].filter(id => !prevIds.has(id));
    if (newlyAdded.length > 0 && prevIds.size > 0) {
      setRecentlyAddedIds(prev => {
        const next = new Set(prev);
        newlyAdded.forEach(id => next.add(id));
        return next;
      });
      // Auto-clear the highlight after 10s
      setTimeout(() => {
        setRecentlyAddedIds(prev => {
          const next = new Set(prev);
          newlyAdded.forEach(id => next.delete(id));
          return next;
        });
      }, 10000);
    }
    prevJobIdsRef.current = currentIds;
  }, [jobs]);

  useEffect(() => {
    fetchJobs();

    // PRIMARY: Supabase realtime subscription — instant sync from quotes/invoices/CRM
    // When any client on any device approves a quote, pays an invoice, or moves a job,
    // this channel fires and shop-floor refetches immediately.
    const channel = supabase
      .channel('shop-floor-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchJobs();
        setLastSyncAt(Date.now());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        fetchJobs();
        setLastSyncAt(Date.now());
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSyncStatus('polling');
      });

    // FALLBACK: 30s poll in case realtime drops (network issues, tablet sleep, etc.)
    const pollInterval = setInterval(() => {
      fetchJobs();
      setLastSyncAt(Date.now());
    }, 30000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchJobs]);

  // ==========================================================================
  // PERSISTENCE EFFECT: LOAD SAVED DATA INTO INDEPENDENT STATE
  // ==========================================================================
  useEffect(() => {
    const currentId = activeJob?.id || null;
    const previousId = prevActiveJobIdRef.current;

    if (currentId === previousId) {
      if (activeJob) {
        setLogData(prev => {
          if (prev.manualStatusOverride !== activeJob.status) {
            return { ...prev, manualStatusOverride: activeJob.status };
          }
          return prev;
        });
      }
      return;
    }

    prevActiveJobIdRef.current = currentId;
    setHasUnsavedProgress(false);
    setActiveTab("details");

    if (!activeJob) return;

    // Default Fallback Reset
    setLogData({
      qtyProcessed: "0",
      pricePaid: "",
      spoilsTotal: 0,
      spoilsSizes: { S: 0, M: 0, L: 0, XL: 0, "2XL": 0, "3XL": 0 },
      operatorNotes: "",
      operatorName: "OP-1",
      manualStatusOverride: activeJob.status
    });
    const initialSizes: Record<string, boolean> = {};
    SIZE_OPTIONS.forEach(s => { initialSizes[s] = false; });
    setStagedSizesPresent(initialSizes);
    setStagedReceivedBy("");
    setStagedBoxLocation("");
    setFinishingQcBy("");
    setDispatchInvoicePaid(false);
    setDispatchTrackingNumber("");
    setDispatchPickupBin("");
    setDispatchMethod("pickup");
    
    // Clear out the previous job's ticks entirely
    setTickCounts({});
    setTickCountsPrint({});
    setTickCountsPress({});

    setIsLoadingProgress(true);

    const stageData = activeJob.progressData?.[activeJob.status] || {};
    const loadedPrintTicks = activeJob.progressData?.ticksPrint || {};
    const loadedPressTicks = activeJob.progressData?.ticksPress || {};

    if (Object.keys(stageData).length > 0 || Object.keys(loadedPrintTicks).length > 0 || Object.keys(loadedPressTicks).length > 0) {
        
        setTickCountsPrint(loadedPrintTicks);
        setTickCountsPress(loadedPressTicks);
        
        // Sync the original tickCounts variable for backward compatibility
        const activeTicks = activeJob.status === "Pressing" ? loadedPressTicks : loadedPrintTicks;
        setTickCounts(activeTicks);

        const totalTicked = Object.values(activeTicks as Record<string, number>).reduce((sum, v) => sum + v, 0);
        
        setLogData({
          qtyProcessed: stageData.qtyProcessed !== undefined ? stageData.qtyProcessed : totalTicked.toString(),
          pricePaid: stageData.pricePaid !== undefined ? stageData.pricePaid : "",
          spoilsTotal: stageData.spoilsTotal !== undefined ? stageData.spoilsTotal : 0,
          spoilsSizes: stageData.spoilsSizes || { S: 0, M: 0, L: 0, XL: 0, "2XL": 0, "3XL": 0 },
          operatorNotes: stageData.operatorNotes || "",
          operatorName: "OP-1",
          manualStatusOverride: activeJob.status
        });

        if (stageData.stagedSizesPresent) {
            setStagedSizesPresent(stageData.stagedSizesPresent);
        }

        setStagedReceivedBy(stageData.stagedReceivedBy || "");
        setStagedBoxLocation(stageData.stagedBoxLocation || "");
        setFinishingQcBy(stageData.finishingQcBy || "");
        setDispatchInvoicePaid(stageData.dispatchInvoicePaid || false);
        setDispatchTrackingNumber(stageData.dispatchTrackingNumber || "");
        setDispatchPickupBin(stageData.dispatchPickupBin || "");
        setDispatchMethod(stageData.dispatchMethod || "pickup");

        setIsLoadingProgress(false);

    } else {
        loadSavedProgress(activeJob.id, activeJob.status).then((metadata) => {
          if (!metadata) {
            setIsLoadingProgress(false);
            return;
          }

          if (metadata.ticks && typeof metadata.ticks === 'object') {
            setTickCounts(metadata.ticks);
            if (activeJob.status === "Pressing") {
                setTickCountsPress(metadata.ticks);
            } else {
                setTickCountsPrint(metadata.ticks);
            }
            const totalTicked = Object.values(metadata.ticks as Record<string, number>).reduce((sum: number, v) => sum + (v as number), 0);
            setLogData(prev => ({ ...prev, qtyProcessed: totalTicked.toString() }));
          } else if (metadata.qty_processed !== undefined) {
            setLogData(prev => ({ ...prev, qtyProcessed: String(metadata.qty_processed) }));
          }

          if (activeJob.status === "Received") {
            if (metadata.sizes_present && Array.isArray(metadata.sizes_present)) {
              const restored: Record<string, boolean> = {};
              SIZE_OPTIONS.forEach(s => { restored[s] = metadata.sizes_present.includes(s); });
              setStagedSizesPresent(restored);
            }
            if (metadata.received_by) setStagedReceivedBy(metadata.received_by);
            if (metadata.box_location) setStagedBoxLocation(metadata.box_location);
          }
          else if (activeJob.status === "Printing") {
            if (metadata.price_paid !== undefined) {
              setLogData(prev => ({ ...prev, pricePaid: String(metadata.price_paid) }));
            }
          }
          else if (activeJob.status === "Pressing") {
            if (metadata.spoils_total !== undefined) {
              setLogData(prev => ({ ...prev, spoilsTotal: metadata.spoils_total }));
            }
            if (metadata.spoils_by_size) {
              setLogData(prev => ({ ...prev, spoilsSizes: { ...prev.spoilsSizes, ...metadata.spoils_by_size } }));
            }
          }
          else if (activeJob.status === "Finishing") {
            if (metadata.qc_by) setFinishingQcBy(metadata.qc_by);
          }
          else if (activeJob.status === "Dispatch") {
            if (metadata.invoice_paid !== undefined) setDispatchInvoicePaid(metadata.invoice_paid);
            if (metadata.dispatch_method) setDispatchMethod(metadata.dispatch_method);
            if (metadata.tracking_number) setDispatchTrackingNumber(metadata.tracking_number);
            if (metadata.pickup_bin) setDispatchPickupBin(metadata.pickup_bin);
          }

          setIsLoadingProgress(false);
        }).catch(() => {
          setIsLoadingProgress(false);
        });
    }
  }, [activeJob?.id, activeJob?.status, activeJob?.progressData]);

  // --- ADDITIVE UPGRADE: MANUAL LOCAL STATE MODIFICATION ENGINE (NO AUTO-SYNC) ---
  const modifyTicks = (itemIdx: number, varIdx: number, size: string, maxQty: number, action: 'add' | 'exact' | 'all', val?: number) => {
      const key = `${itemIdx}-${varIdx}-${size.toLowerCase()}`;
      setHasUnsavedProgress(true);
      
      const isPress = activeJob.status === "Pressing";
      const currentTicks = isPress ? tickCountsPress : tickCountsPrint;
      const current = currentTicks[key] || 0;
      
      let next = current;
      if (action === 'add') next = Math.min(maxQty, Math.max(0, current + (val || 1))); // Failsafe: never drop below 0
      else if (action === 'exact') next = Math.min(maxQty, Math.max(0, val || 0));
      else if (action === 'all') next = maxQty;
      
      if (next === current) return;
      
      const newTicks = { ...currentTicks, [key]: next };
      const totalTicked = Object.values(newTicks).reduce((sum, v) => sum + v, 0);
      
      setTickCounts(newTicks); // Keep legacy variable in sync
      if (isPress) {
          setTickCountsPress(newTicks);
          // Only start tracking time if it's the very first press logged
          if (!activeJob.progressData?.pressingStartTime && totalTicked > 0) {
              const pTime = new Date().toISOString();
              setActiveJob((prev: any) => ({ ...prev, progressData: { ...prev.progressData, pressingStartTime: pTime }}));
          }
      } else {
          setTickCountsPrint(newTicks);
      }
      
      setLogData(ld => ({...ld, qtyProcessed: totalTicked.toString()}));
  };

  // Keep legacy tick functions for backward compatibility of components
  const handleTick = (itemIdx: number, varIdx: number, size: string, maxQty: number) => {
      modifyTicks(itemIdx, varIdx, size, maxQty, 'add', 1);
  };
  const handleUntick = (e: React.MouseEvent, itemIdx: number, varIdx: number, size: string) => {
      e.preventDefault(); 
      modifyTicks(itemIdx, varIdx, size, 999999, 'add', -1);
  };

  const handleSpoilSizeChange = (size: string, value: string) => {
      const numValue = parseInt(value) || 0;
      setLogData(prev => {
          const newSpoilsSizes = { ...prev.spoilsSizes, [size]: numValue };
          const newTotal = Object.values(newSpoilsSizes).reduce((a, b) => a + (b as number), 0);
          return { ...prev, spoilsSizes: newSpoilsSizes, spoilsTotal: newTotal };
      });
      setHasUnsavedProgress(true);
  };

  const handleManualStatusChange = async (newStatus: string) => {
      if (!activeJob || newStatus === activeJob.status) return;
      
      try {
          await supabase.from("job_logs").insert([{ 
              job_id: activeJob.id, 
              from_stage: activeJob.status, 
              to_stage: newStatus,
              notes: "Manual Status Override via Shop Floor"
          }]);
          
          await supabase.from("jobs")
              .update({ stage: newStatus, updated_at: new Date() })
              .eq("id", activeJob.id);
          
          setLogData(prev => ({...prev, manualStatusOverride: newStatus}));
          prevActiveJobIdRef.current = null;
          setActiveJob((prev: any) => ({...prev, status: newStatus}));
          setHasUnsavedProgress(false);
          
          fetchJobs();
      } catch (err) {
          console.error("Failed to update status manually:", err);
          alert("Error changing job status.");
      }
  };

  // --- MANUAL SAVING ENGINE ---
  const submitStageAdvancement = async (logDetails: any | null, isAdvancing: boolean = true) => {
      if (!activeJob) return;

      const progression: Record<string, string> = {
          "Received": "Printing",
          "Printing": "Pressing",
          "Pressing": "Finishing",
          "Finishing": "Dispatch",
          "Dispatch": "Paid"
      };
      
      const nextStage = isAdvancing ? (progression[activeJob.status] || "Paid") : activeJob.status;
      
      setSaveStatus("saving");
      
      try {
          let actionNote = isAdvancing ? `Moved to ${nextStage}.` : `Progress Saved.`;
          
          let stageSpecificData: any = {};

          if (activeJob.status === "Received") {
              const presentSizes = Object.entries(stagedSizesPresent).filter(([_, v]) => v).map(([k]) => k);
              const missingSizes = Object.entries(stagedSizesPresent).filter(([_, v]) => !v).map(([k]) => k);
              actionNote += ` Received by: ${stagedReceivedBy || 'N/A'}. Box Location: ${stagedBoxLocation || 'N/A'}. Sizes Present: ${presentSizes.join(', ') || 'None checked'}. Missing: ${missingSizes.join(', ') || 'All accounted for'}. Notes: ${logDetails.operatorNotes}`;
              stageSpecificData = { sizes_present: presentSizes, sizes_missing: missingSizes, received_by: stagedReceivedBy, box_location: stagedBoxLocation, operatorNotes: logDetails.operatorNotes };
          }
          else if (activeJob.status === "Printing") {
              actionNote += ` Qty: ${logDetails.qtyProcessed}. Price Paid: $${logDetails.pricePaid}. Notes: ${logDetails.operatorNotes}`;
              stageSpecificData = { qty_processed: logDetails.qtyProcessed, price_paid: logDetails.pricePaid, ticks: tickCountsPrint, operatorNotes: logDetails.operatorNotes };
          } 
          else if (activeJob.status === "Pressing") {
              const spoilsDetailStr = Object.entries(logDetails.spoilsSizes).filter(([_, qty]) => (qty as number) > 0).map(([size, qty]) => `${size}:${qty}`).join(', ');
              const spoilLog = spoilsDetailStr ? `(Sizes: ${spoilsDetailStr})` : '';
              actionNote += ` Qty: ${logDetails.qtyProcessed}. Total Spoils: ${logDetails.spoilsTotal} ${spoilLog}. Notes: ${logDetails.operatorNotes}`;
              stageSpecificData = { qty_processed: logDetails.qtyProcessed, spoils_total: logDetails.spoilsTotal, spoils_by_size: logDetails.spoilsSizes, ticks: tickCountsPress, operatorNotes: logDetails.operatorNotes };
          }
          else if (activeJob.status === "Finishing") {
              actionNote += ` QC By: ${finishingQcBy || 'N/A'}. Notes: ${logDetails.operatorNotes}`;
              stageSpecificData = { qc_by: finishingQcBy, ticks: tickCountsPrint, operatorNotes: logDetails.operatorNotes };
          }
          else if (activeJob.status === "Dispatch") {
              const deliveryInfo = dispatchMethod === "shipping" ? `Tracking: ${dispatchTrackingNumber || 'N/A'}` : `Pickup Bin: ${dispatchPickupBin || 'N/A'}`;
              actionNote += ` Invoice Paid: ${dispatchInvoicePaid ? 'YES' : 'NO'}. Method: ${dispatchMethod}. ${deliveryInfo}. Notes: ${logDetails.operatorNotes}`;
              stageSpecificData = { invoice_paid: dispatchInvoicePaid, dispatch_method: dispatchMethod, tracking_number: dispatchTrackingNumber, pickup_bin: dispatchPickupBin, operatorNotes: logDetails.operatorNotes };
          }
          else {
              actionNote += ` Notes: ${logDetails.operatorNotes}`;
          }

          const namespacedMetadata = {
              stage: activeJob.status, // Legacy identifier
              [activeJob.status]: stageSpecificData
          };

          await supabase.from("job_logs").insert([{ 
              job_id: activeJob.id, 
              from_stage: activeJob.status, 
              to_stage: nextStage, 
              notes: actionNote, 
              metadata: namespacedMetadata 
          }]);
          
          // Inject the current states securely into the progress_data block
          const newProgressData = { 
              ...(activeJob.progressData || {}), 
              [activeJob.status]: stageSpecificData,
              ticksPrint: tickCountsPrint,
              ticksPress: tickCountsPress
          };

          if (isAdvancing) {
              await supabase.from("jobs").update({ stage: nextStage, updated_at: new Date(), progress_data: newProgressData }).eq("id", activeJob.id);
              prevActiveJobIdRef.current = null;
              
              setSaveStatus("idle");
              setShowConfirmModal(false);
              setHasUnsavedProgress(false);
              fetchJobs();
          } else {
              await supabase.from("jobs").update({ updated_at: new Date(), progress_data: newProgressData }).eq("id", activeJob.id);
              setActiveJob((prev: any) => ({ ...prev, progressData: newProgressData }));
              
              setSaveStatus("saved");
              setHasUnsavedProgress(false);
              setTimeout(() => setSaveStatus("idle"), 3000);
          }
          
      } catch (err) {
          console.error("Failed to advance job:", err);
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
      }
  };

  // --- ADDITIVE UPGRADE: SCHEDULE TASK FUNCTION ---
  const handleScheduleTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTaskName.trim() || !activeJob) return;

    setIsScheduling(true);
    try {
        let finalDate = scheduleDate;
        let finalTime = scheduleTime;

        if (!finalDate) {
            finalDate = new Date().toISOString().split('T')[0];
        }
        if (!finalTime) {
            finalTime = "12:00";
        }

        const { error } = await supabase.from("todos").insert([{
            task: scheduleTaskName,
            job_id: activeJob.id,
            target_date: finalDate,
            target_time: finalTime,
            duration_minutes: 60,
            is_deleted: false 
        }]);

        if (error) throw error;

        setScheduleModalOpen(false);
        setScheduleTaskName("");
        setScheduleDate("");
        setScheduleTime("");
        alert(`Task successfully added to calendar for ${finalDate}`);
    } catch (err) {
        console.error("Failed to schedule task:", err);
        alert("Failed to schedule task.");
    } finally {
        setIsScheduling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "Received": return "bg-lime-500/20 text-lime-500 border-lime-500/50 shadow-[0_0_15px_rgba(132,204,22,0.2)]";
      case "Printing": return "bg-pink-500/20 text-pink-500 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.2)]";
      case "Pressing": return "bg-red-500/20 text-red-500 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]";
      case "Finishing": return "bg-teal-500/20 text-teal-500 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.2)]";
      case "Dispatch": return "bg-indigo-500/20 text-indigo-500 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]";
      default: return "bg-slate-500/20 text-slate-500 border-slate-500/50";
    }
  };
  
  const getStatusLabel = (status: string) => {
      switch(status) {
          case "Received": return "To Receive";
          case "Printing": return "To Print";
          case "Pressing": return "To Press";
          case "Finishing": return "To Package";
          case "Dispatch": return "To Deliver";
          default: return status.toUpperCase();
      }
  };

  const checkedSizesCount = Object.values(stagedSizesPresent).filter(Boolean).length;

  const getNextStageLabel = (currentStatus: string) => {
      const map: Record<string, string> = {
          "Received": "Move to Printing",
          "Printing": "Move to Pressing",
          "Pressing": "Move to Packaging",
          "Finishing": "Move to Dispatch",
          "Dispatch": "Close & Complete",
      };
      return map[currentStatus] || "Log & Mark Step Complete";
  };

  if (isLoading) {
      return <div className={`h-screen w-screen ${isLightMode ? 'bg-slate-50' : 'bg-[#050505]'} flex items-center justify-center font-black text-sky-500 tracking-widest uppercase animate-pulse transition-colors duration-300`}>Initializing Terminal...</div>;
  }

  // --- COMPACT & ADVANCED INTERACTIVE TICKER (VERTICALLY STACKED LAYOUT) ---
  const renderInteractiveTicker = () => {
      if (!["Printing", "Pressing", "Finishing"].includes(activeJob.status)) return null;

      return (
          <div className={`w-full ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'} border rounded-xl p-3 md:p-5 shadow-inner mt-4`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-[10px] font-black ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'} uppercase tracking-[0.2em]`}>Interactive Production Ticker</h3>
                {isLoadingProgress && (
                  <span className="text-[9px] font-bold text-sky-500 animate-pulse uppercase tracking-widest">Loading saved progress...</span>
                )}
              </div>
              <p className={`text-[9px] font-bold ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'} uppercase tracking-widest mb-4`}>Use +1, +5, ALL, or click input to manually log quantities. Right click to subtract.</p>
              
              <div className="flex flex-col gap-4">
                  {activeJob.itemsList.map((item: any, iIdx: number) => (
                      <div key={iIdx} className={`p-3 md:p-4 rounded-2xl border shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700/50'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-inherit pb-2 mb-3">
                              <div className="flex items-center">
                                  {renderGarmentIcon(item.description, "#38bdf8")}
                                  <span className={`text-sm lg:text-base font-black uppercase tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{item.description}</span>
                              </div>
                              <span className="text-[10px] font-black text-sky-500 bg-sky-500/10 px-2.5 py-1 rounded border border-sky-500/20 w-fit">{item.quantity} PCS</span>
                          </div>

                          {/* Grid layout for side-by-side variants */}
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                              {item.variants.map((v: any, vIdx: number) => {
                                  const hex = COLOR_HEX_MAP[v.color] || getColorHex(v.color);
                                  const contrastText = getContrastTextColor(hex, isLightMode);
                                  const validSizes = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl"].filter(sz => v[sz] > 0);
                                  if (validSizes.length === 0) return null;

                                  return (
                                      <div key={vIdx} className={`flex flex-col gap-2 p-2.5 rounded-xl border-2 ${isLightMode ? 'bg-slate-50' : 'bg-black/60'}`} style={{ borderColor: hex, backgroundColor: `${hex}1A` }}>
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2 px-1">
                                                <div className="w-3.5 h-3.5 rounded-full border shadow-sm" style={{backgroundColor: hex, borderColor: hex === '#ffffff' ? '#ccc' : 'transparent'}}></div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest`} style={{ color: contrastText }}>{v.color}</span>
                                              </div>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                              {validSizes.map(sz => {
                                                  const key = `${iIdx}-${vIdx}-${sz}`;
                                                  const activeTicks = activeJob.status === "Pressing" ? tickCountsPress : tickCountsPrint;
                                                  const count = activeTicks[key] || 0;
                                                  const max = v[sz];
                                                  const isComplete = count === max;
                                                  const isInteractiveStage = ["Printing", "Pressing", "Finishing"].includes(activeJob.status);
                                                  
                                                  if (!isInteractiveStage) {
                                                      return (
                                                          <div key={sz} className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
                                                              <span className={`text-xl font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>{sz}</span>
                                                              <span className={`text-xs font-black mt-0.5 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{max} PCS</span>
                                                          </div>
                                                      )
                                                  }

                                                  return (
                                                      <div key={sz} className={`flex flex-col p-1.5 rounded-lg border-2 shadow-sm relative overflow-hidden group ${
                                                          isComplete 
                                                              ? (isLightMode ? 'bg-emerald-50 border-emerald-500' : 'bg-emerald-950/30 border-emerald-500/80')
                                                              : (isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700')
                                                      }`}>
                                                          <div className={`absolute top-0 left-0 h-full transition-all duration-300 ${count > 0 && !isComplete ? (isLightMode ? 'bg-amber-100' : 'bg-amber-500/20') : ''} ${isComplete ? (isLightMode ? 'bg-emerald-100' : 'bg-emerald-500/20') : ''}`} style={{width: `${(count/max)*100}%`}}></div>
                                                          
                                                          <div 
                                                              onClick={() => modifyTicks(iIdx, vIdx, sz, max, 'add', 1)}
                                                              onContextMenu={(e) => { e.preventDefault(); modifyTicks(iIdx, vIdx, sz, max, 'add', -1); }}
                                                              className="flex justify-between items-center z-10 w-full mb-1 px-1 cursor-pointer"
                                                          >
                                                              <span className={`text-sm font-black uppercase ${isComplete ? (isLightMode ? 'text-emerald-600' : 'text-emerald-400') : (isLightMode ? 'text-slate-700' : 'text-slate-300')}`}>{sz}</span>
                                                              
                                                              {/* Enlarged Prominent Fraction */}
                                                              <div className="flex items-baseline gap-1 pointer-events-none">
                                                                  <span className={`text-lg font-black ${isComplete ? (isLightMode ? 'text-emerald-600' : 'text-emerald-400') : (isLightMode ? 'text-slate-900' : 'text-white')}`}>{count}</span>
                                                                  <span className={`text-[10px] font-black ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>/ {max}</span>
                                                              </div>
                                                          </div>

                                                          <div className="flex items-center gap-1 z-10 w-full mt-auto relative">
                                                              <button type="button" onClick={() => modifyTicks(iIdx, vIdx, sz, max, 'add', 1)} onContextMenu={(e) => { e.preventDefault(); modifyTicks(iIdx, vIdx, sz, max, 'add', -1); }} className={`flex-1 rounded text-[8px] font-bold py-1 transition-colors ${isLightMode ? 'bg-slate-200 hover:bg-sky-500 hover:text-white text-slate-700' : 'bg-white/10 hover:bg-sky-500 hover:text-white text-white'}`}>+1</button>
                                                              <button type="button" onClick={() => modifyTicks(iIdx, vIdx, sz, max, 'add', 5)} className={`flex-1 rounded text-[8px] font-bold py-1 transition-colors ${isLightMode ? 'bg-slate-200 hover:bg-sky-500 hover:text-white text-slate-700' : 'bg-white/10 hover:bg-sky-500 hover:text-white text-white'}`}>+5</button>
                                                              <button type="button" onClick={() => modifyTicks(iIdx, vIdx, sz, max, 'all')} className={`flex-1 rounded text-[8px] font-bold py-1 transition-colors ${isLightMode ? 'bg-slate-200 hover:bg-emerald-500 hover:text-white text-slate-700' : 'bg-white/10 hover:bg-emerald-500 hover:text-white text-white'}`}>ALL</button>
                                                              <input 
                                                                  type="number" 
                                                                  min="0" max={max}
                                                                  value={count === 0 ? "" : count}
                                                                  onChange={(e) => modifyTicks(iIdx, vIdx, sz, max, 'exact', parseInt(e.target.value) || 0)}
                                                                  className={`w-9 border rounded text-center text-[10px] font-bold py-1 outline-none focus:border-sky-500 ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-black border-slate-600 text-white'}`}
                                                              />
                                                          </div>
                                                      </div>
                                                  )
                                              })}
                                          </div>
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  // -------- QUEUE COMPUTATIONS (urgency, filtering, grouping) --------
  const isJobUrgent = (job: any) => {
    if (!job.deadline || job.deadline === "No Due Date") return false;
    const d = new Date(job.deadline);
    const today = new Date(); today.setHours(0,0,0,0);
    return d <= today;
  };

  const upstreamStages = ['Incoming', 'Artwork', 'Sourcing', 'Ordered'];
  const readyStages = ['Received', 'Staged'];

  const matchesFilter = (job: any) => {
    switch (queueFilter) {
      case "all": return true;
      case "urgent": return isJobUrgent(job);
      case "upstream": return upstreamStages.includes(job.status);
      case "ready": return readyStages.includes(job.status);
      case "printing": return job.status === "Printing";
      case "pressing": return job.status === "Pressing";
      case "finishing": return job.status === "Finishing";
      case "dispatch": return job.status === "Dispatch";
      default: return true;
    }
  };

  const matchesSearch = (job: any) => {
    if (!queueSearch.trim()) return true;
    const q = queueSearch.toLowerCase();
    return (
      String(job.job_number).includes(q) ||
      (job.client || "").toLowerCase().includes(q) ||
      (job.garment || "").toLowerCase().includes(q) ||
      (job.color || "").toLowerCase().includes(q)
    );
  };

  const visibleJobs = jobs.filter(j => matchesFilter(j) && matchesSearch(j));
  const urgentCount = jobs.filter(isJobUrgent).length;
  const upstreamCount = jobs.filter(j => upstreamStages.includes(j.status)).length;
  const readyCount = jobs.filter(j => readyStages.includes(j.status)).length;

  // Next-stage helper — what the primary action advances to
  const nextStageFor = (currentStage: string): string | null => {
    const idx = PIPELINE_ORDER.indexOf(currentStage);
    if (idx < 0 || idx >= PIPELINE_ORDER.length - 1) return null;
    return PIPELINE_ORDER[idx + 1];
  };

  return (
    <div className={`h-screen w-screen ${isLightMode ? 'bg-slate-100 text-slate-900' : 'bg-[#050505] text-slate-200'} font-sans flex flex-col overflow-hidden selection:bg-sky-500 selection:text-white transition-colors duration-300`}>
      
      {/* GLOBAL SAVING OVERLAY (PREVENTS CLICKING AWAY WHILE SAVING) */}
      {saveStatus === "saving" && (
          <div className="fixed inset-0 z-[9999] bg-slate-900/80 dark:bg-black/80 backdrop-blur-md flex items-center justify-center flex-col animate-in fade-in">
              <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(56,189,248,0.5)]"></div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-[0.2em] animate-pulse">Syncing to Cloud</h2>
              <p className="text-xs md:text-sm font-bold text-sky-400 uppercase tracking-widest mt-3">Please wait...</p>
          </div>
      )}

      {/* TERMINAL HEADER — tighter */}
      <div className={`${isLightMode ? 'bg-white/90 border-slate-200' : 'bg-slate-950/80 border-white/5'} backdrop-blur-xl border-b px-4 py-2.5 flex justify-between items-center shrink-0 shadow-sm z-50`}>
        <div className="flex items-center gap-3">
          
          {/* MOBILE MENU TOGGLE */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className={`lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black text-[10px] uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-black border-slate-800 text-slate-300 hover:text-white'}`}
          >
            <span className="text-sm">☰</span> Queue
          </button>
          <button onClick={() => router.back()} className={`hidden lg:block transition text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg whitespace-nowrap border ${isLightMode ? 'text-slate-500 hover:text-slate-900 bg-slate-100 border-slate-200' : 'text-[#686a6c] hover:text-white bg-black border-white/10 hover:border-slate-500'}`}>
            ← Exit
          </button>
          
          {/* MANUAL LIGHT/DARK TOGGLE */}
          <button onClick={() => {
              const newMode = !isLightMode;
              setIsLightMode(newMode);
              localStorage.setItem('yaya-theme', newMode ? 'light' : 'dark');
          }} className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-widest transition-colors ml-2 ${isLightMode ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
              {isLightMode ? '🌙 Dark' : '☀️ Light'}
          </button>

          <div className="flex flex-col hidden sm:flex ml-4">
            <h1 className={`text-base font-black uppercase tracking-tighter leading-none italic ${isLightMode ? 'text-slate-900' : 'text-white'}`}>YAYA <span className="text-sky-500">PRODUCTION</span></h1>
            <span className={`text-[7px] font-black uppercase tracking-[0.3em] ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Shop Floor Terminal OS</span>
          </div>
        </div>

        <div className="text-right flex items-center gap-4">
            {activeJob && (
                <>
                    <button onClick={() => setScheduleModalOpen(true)} className={`hidden xl:flex items-center justify-center px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${isLightMode ? 'border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100' : 'border-sky-500/30 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20'} shadow-sm cursor-pointer`}>
                        📅 Schedule Task
                    </button>
                    <div className={`hidden md:flex items-center justify-center px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isLightMode ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/10 bg-black/40 text-slate-400'} shadow-sm`}>
                        Stage: <span className="text-sky-500 ml-1">{activeJob.status}</span>
                    </div>
                </>
            )}
            <div className="flex flex-col items-end">
                <span className={`text-[7px] font-black uppercase tracking-widest hidden sm:block ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Ottawa Facility</span>
                <span className="text-sm font-mono text-emerald-500 font-bold tracking-widest">{time}</span>
            </div>
        </div>
      </div>

      <div className="flex flex-grow overflow-hidden h-full relative">
        
        {/* MOBILE SIDEBAR OVERLAY */}
        {isSidebarOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* LEFT: JOB QUEUE */}
        <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 w-[280px] xl:w-[320px] lg:backdrop-blur-xl border-r flex flex-col shrink-0 h-full overflow-y-auto custom-scrollbar shadow-2xl lg:shadow-md z-50 lg:z-40 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/90 border-white/5'} ${saveStatus === 'saving' ? 'pointer-events-none opacity-50' : ''}`}>

          {/* Header w/ sync status */}
          <div className={`p-2.5 border-b sticky top-0 z-10 flex flex-col gap-2 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-black/40'}`}>
            <div className="flex justify-between items-center">
              <h2 className={`text-[9px] font-black uppercase tracking-[0.2em] ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Active Queue</h2>
              <div className="flex items-center gap-1.5">
                {/* LIVE SYNC INDICATOR — users know data is fresh */}
                <span
                  className={`text-[7px] font-black uppercase tracking-widest flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                    syncStatus === 'live'
                      ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                      : syncStatus === 'polling'
                        ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
                        : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
                  }`}
                  title={
                    syncStatus === 'live'
                      ? 'Realtime sync active — new jobs from Quotes/Invoices/CRM appear instantly'
                      : syncStatus === 'polling'
                        ? 'Realtime disconnected — falling back to 30s poll'
                        : 'Connecting to realtime channel…'
                  }
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'live' ? 'bg-emerald-500 animate-pulse' : syncStatus === 'polling' ? 'bg-amber-500' : 'bg-slate-400 animate-pulse'}`}></span>
                  {syncStatus === 'live' ? 'Live' : syncStatus === 'polling' ? 'Poll' : '...'}
                </span>
                <span className="text-[8px] font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded uppercase border border-sky-500/20">{visibleJobs.length}/{jobs.length}</span>
              </div>
            </div>

            {/* SEARCH */}
            <div className="relative">
              <input
                type="text"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Search #, client, garment…"
                className={`w-full text-[10px] font-bold rounded-lg pl-7 pr-7 py-1.5 border outline-none transition-colors ${isLightMode ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-500' : 'bg-black/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-sky-500'}`}
              />
              <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs ${isLightMode ? 'text-slate-400' : 'text-slate-600'}`}>🔍</span>
              {queueSearch && (
                <button onClick={() => setQueueSearch("")} className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black ${isLightMode ? 'text-slate-400 hover:text-slate-900' : 'text-slate-500 hover:text-white'}`}>✕</button>
              )}
            </div>

            {/* FILTER CHIPS */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {[
                { id: "all",       label: "All",       count: jobs.length,   color: "sky" },
                { id: "urgent",    label: "🔥 Urgent", count: urgentCount,   color: "red" },
                { id: "upstream",  label: "⏳ Coming", count: upstreamCount, color: "amber" },
                { id: "ready",     label: "Ready",     count: readyCount,    color: "lime" },
                { id: "printing",  label: "Print",     count: jobs.filter(j => j.status === "Printing").length,  color: "pink" },
                { id: "pressing",  label: "Press",     count: jobs.filter(j => j.status === "Pressing").length,  color: "red" },
                { id: "finishing", label: "Finish",    count: jobs.filter(j => j.status === "Finishing").length, color: "teal" },
                { id: "dispatch",  label: "Dispatch",  count: jobs.filter(j => j.status === "Dispatch").length,  color: "indigo" },
              ].map(chip => {
                const active = queueFilter === chip.id;
                const disabled = chip.count === 0 && chip.id !== "all";
                return (
                  <button
                    key={chip.id}
                    onClick={() => setQueueFilter(chip.id as any)}
                    disabled={disabled}
                    className={`shrink-0 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all flex items-center gap-1 ${
                      active
                        ? `bg-${chip.color}-500 text-white border-${chip.color}-400 shadow-sm`
                        : disabled
                          ? (isLightMode ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' : 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed')
                          : (isLightMode ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-400' : 'bg-black/40 border-slate-800 text-slate-400 hover:border-slate-600')
                    }`}
                  >
                    {chip.label}
                    {chip.count > 0 && <span className={`text-[7px] ${active ? 'opacity-80' : 'opacity-60'}`}>{chip.count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-1.5 space-y-1.5">
            {visibleJobs.length === 0 ? (
                <div className={`text-center p-8 font-black uppercase tracking-widest text-[9px] ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>
                  {jobs.length === 0 ? "No Active Jobs" : queueSearch ? `No jobs match "${queueSearch}"` : "No jobs match filter"}
                </div>
            ) : (
                visibleJobs.map((job) => {
                  const urgent = isJobUrgent(job);
                  const isNew = recentlyAddedIds.has(job.id);
                  const isUpstream = upstreamStages.includes(job.status);
                  return (
                <button
                    key={job.id}
                    onClick={() => { setActiveJob(job); setIsSidebarOpen(false); }}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-300 shadow-sm relative ${
                      activeJob?.id === job.id
                        ? 'bg-sky-500/10 border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                        : urgent
                          ? (isLightMode ? 'bg-red-50 border-red-300 hover:border-red-400' : 'bg-red-950/20 border-red-500/30 hover:border-red-500/60')
                          : isUpstream
                            ? (isLightMode ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300 opacity-85' : 'bg-amber-950/10 border-amber-500/20 hover:border-amber-500/40 opacity-80')
                            : (isLightMode ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-black/40 border-white/5 hover:border-slate-600')
                    }`}
                >
                    {isNew && (
                      <span className="absolute -top-1.5 -right-1.5 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-sky-500 text-white animate-pulse shadow-lg">NEW</span>
                    )}
                    <div className="flex flex-wrap justify-between items-center gap-1 mb-2">
                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md border uppercase tracking-widest ${getStatusColor(job.status)}`}>
                          {getStatusLabel(job.status)}
                      </span>
                      <div className="flex items-center gap-1">
                        {urgent && <span className="text-[7px] font-black text-red-500 animate-pulse">🔥</span>}
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${isLightMode ? 'bg-slate-100 text-slate-500' : 'bg-slate-800 text-slate-300'}`}>#{job.job_number}</span>
                      </div>
                    </div>
                    <h3 className={`text-sm font-black uppercase tracking-tight mb-3 truncate w-full ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{job.client}</h3>
                    
                    {/* COMPACT ITEMS BREAKDOWN */}
                    <div className={`flex flex-col gap-1.5 pt-2 border-t ${isLightMode ? 'border-slate-100' : 'border-slate-800'}`}>
                        {job.itemsList.map((item: any, idx: number) => (
                            <div key={idx} className="flex flex-col">
                                <div className="text-[9px] font-black uppercase tracking-widest truncate">
                                    <span className="text-sky-500 mr-1">{item.quantity}x</span> 
                                    <span className={isLightMode ? 'text-slate-900' : 'text-white'}>{item.description}</span>
                                </div>
                                <div className="flex flex-col">
                                    {item.variants.map((v: any, vIdx: number) => {
                                        const szStrs = ["xs","s","m","l","xl","xxl","xxxl"].map(sz => v[sz] ? `${sz.toUpperCase()}:${v[sz]}` : null).filter(Boolean).join(',');
                                        return (
                                            <span key={vIdx} className={`flex items-center gap-1 text-[8px] font-bold uppercase truncate mt-0.5 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>
                                                <div className={`w-2 h-2 rounded-full border ${isLightMode ? 'border-slate-300' : 'border-slate-600'}`} style={{backgroundColor: getColorHex(v.color)}}></div>
                                                {v.color} {szStrs ? `(${szStrs})` : ''}
                                            </span>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </button>
                );})
            )}
          </div>
        </div>

        {/* RIGHT: ACTIVE JOB DETAILS (THE WORKSPACE) */}
        {activeJob ? (
            <div className={`flex-grow flex flex-col relative h-full overflow-hidden w-full min-w-0 ${isLightMode ? 'bg-slate-100' : 'bg-[#050505]'}`}>
            
            {/* Header for Job */}
            <div className={`p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 w-full ${isLightMode ? 'border-slate-200 bg-white' : 'border-white/5 bg-slate-900/50'}`}>
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <h2 className={`text-xl md:text-3xl font-black uppercase tracking-tighter truncate leading-none ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{activeJob.client}</h2>
                    <span className="text-xs font-mono text-sky-500 font-bold bg-sky-500/10 px-3 py-1 rounded border border-sky-500/30 whitespace-nowrap shrink-0">#{activeJob.job_number}</span>
                </div>
                <div className="flex text-[9px] font-black text-red-500 uppercase tracking-widest items-center gap-1.5 border border-red-500/20 bg-red-500/10 px-3 py-1.5 rounded-lg">
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    DUE: {activeJob.deadline}
                </div>
            </div>

            {/* STAGE PROGRESS STRIP — at-a-glance where we are + one-click advance */}
            {(() => {
              const currentStage = activeJob.status;
              const currentIdx = PIPELINE_ORDER.indexOf(currentStage);
              const nextStage = nextStageFor(currentStage);
              const isUpstream = upstreamStages.includes(currentStage);
              // Visible sub-stages for the progress pips (skip Incoming/Billing/Paid in the visual)
              const visiblePipeline = ['Artwork','Sourcing','Ordered','Received','Staged','Printing','Pressing','Finishing','Dispatch'];
              return (
                <div className={`px-4 py-3 border-b shrink-0 flex flex-col md:flex-row items-stretch md:items-center gap-3 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-white/5'}`}>
                  {/* Pipeline pips */}
                  <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                    {visiblePipeline.map((s, i) => {
                      const sIdx = PIPELINE_ORDER.indexOf(s);
                      const isPast = currentIdx > sIdx;
                      const isCur  = currentStage === s;
                      return (
                        <div key={s} className="flex items-center gap-1 shrink-0">
                          <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border transition-colors ${
                            isCur
                              ? (isLightMode ? 'bg-sky-500 text-white border-sky-400' : 'bg-sky-500 text-white border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]')
                              : isPast
                                ? (isLightMode ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30')
                                : (isLightMode ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-slate-900 text-slate-600 border-slate-800')
                          }`}>
                            {isPast ? '✓ ' : ''}{getStatusLabel(s)}
                          </div>
                          {i < visiblePipeline.length - 1 && (
                            <span className={`text-[8px] ${isPast ? 'text-emerald-500' : (isLightMode ? 'text-slate-300' : 'text-slate-700')}`}>›</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* PRIMARY ACTION — huge, obvious, impossible to miss */}
                  {isUpstream ? (
                    <div className={`shrink-0 px-5 py-3 rounded-xl border-2 border-dashed text-center ${isLightMode ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-amber-500/30 bg-amber-500/5 text-amber-400'}`}>
                      <div className="text-[8px] font-black uppercase tracking-widest mb-0.5">⏳ Waiting Upstream</div>
                      <div className="text-[10px] font-black">Blanks not yet received</div>
                    </div>
                  ) : nextStage && nextStage !== 'Billing' && nextStage !== 'Paid' ? (
                    <button
                      onClick={() => setShowConfirmModal(true)}
                      className="shrink-0 px-6 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_28px_rgba(16,185,129,0.55)] transition-all flex items-center gap-2 active:scale-95"
                      title="Advance this job to the next stage"
                    >
                      <span className="text-base">→</span>
                      <span className="flex flex-col items-start leading-tight">
                        <span className="text-[8px] opacity-80">Next Stage</span>
                        <span>Advance to {getStatusLabel(nextStage)}</span>
                      </span>
                    </button>
                  ) : (
                    <div className={`shrink-0 px-5 py-3 rounded-xl border text-center ${isLightMode ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
                      <div className="text-[8px] font-black uppercase tracking-widest mb-0.5">✓ Ready</div>
                      <div className="text-[10px] font-black">Send to Billing</div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB NAVIGATION */}
            <div className={`flex border-b shrink-0 px-4 ${isLightMode ? 'border-slate-200 bg-white' : 'border-white/5 bg-slate-950'}`}>
                <button 
                  onClick={() => setActiveTab("details")}
                  className={`px-4 sm:px-6 py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${activeTab === "details" ? "border-sky-500 text-sky-500 bg-sky-500/5" : `border-transparent ${isLightMode ? 'text-slate-500 hover:text-slate-900' : 'text-[#686a6c] hover:text-white'}`}`}
                >
                  Logs & Specs
                </button>
                <button 
                  onClick={() => setActiveTab("artwork")}
                  className={`px-4 sm:px-6 py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${activeTab === "artwork" ? "border-sky-500 text-sky-500 bg-sky-500/5" : `border-transparent ${isLightMode ? 'text-slate-500 hover:text-slate-900' : 'text-[#686a6c] hover:text-white'}`}`}
                >
                  Artwork Proofs
                </button>
                {/* NEW TAB: PRESSING LOG */}
                <button 
                  onClick={() => setActiveTab("pressing")}
                  className={`px-4 sm:px-6 py-3 text-[9px] sm:text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${activeTab === "pressing" ? "border-emerald-500 text-emerald-500 bg-emerald-500/5" : `border-transparent ${isLightMode ? 'text-slate-500 hover:text-slate-900' : 'text-[#686a6c] hover:text-white'}`}`}
                >
                  Pressing Log
                </button>
            </div>

            {/* TAB CONTENT: PRODUCTION SPECS (WIDESCREEN COMPACT LAYOUT) */}
            {activeTab === "details" && (
                <div className="flex-grow p-3 md:p-4 overflow-y-auto custom-scrollbar w-full">
                    
                    {/* === DESKTOP: VERTICAL STACK LAYOUT === */}
                    <div className="max-w-[1600px] mx-auto flex flex-col gap-4 lg:gap-6 items-start">
                        
                        {/* 1. TOP PANELS: Meta & Totals */}
                        <div className="flex flex-col xl:flex-row gap-4 lg:gap-6 w-full">
                            {/* Job Status Card — manual override (primary action is the big green button in the stage strip above) */}
                            <div className={`flex-1 border-2 rounded-2xl p-4 lg:p-5 shadow-sm relative flex flex-col justify-center gap-2 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
                                <div className="flex items-center justify-between">
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Override Stage</span>
                                  <span className={`text-[8px] font-bold uppercase tracking-widest ${isLightMode ? 'text-slate-400' : 'text-slate-600'}`}>manual</span>
                                </div>
                                <select
                                    value={logData.manualStatusOverride}
                                    onChange={(e) => handleManualStatusChange(e.target.value)}
                                    title="Manually jump this job to any stage (skips validation). For normal flow, use the big green Advance button above."
                                    className={`w-full appearance-none px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] border outline-none cursor-pointer transition-colors shadow-sm
                                        ${activeJob.status === 'Printing' ? 'bg-pink-500/10 text-pink-500 border-pink-500/30' :
                                          activeJob.status === 'Pressing' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                                          activeJob.status === 'Finishing' ? 'bg-teal-500/10 text-teal-500 border-teal-500/30' :
                                          activeJob.status === 'Dispatch' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30' :
                                          'bg-lime-500/10 text-lime-500 border-lime-500/30'}`}
                                >
                                    {STAGE_OPTIONS.map(opt => (
                                        <option key={opt.dbValue} value={opt.dbValue} className={`font-sans ${isLightMode ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>{opt.label}</option>
                                    ))}
                                </select>
                                <p className={`text-[8px] font-bold mt-1 ${isLightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                  Use for corrections. Normal flow: ↑ green button above.
                                </p>
                            </div>

                            {/* TRI-BOX TOTALS */}
                            <div className="flex-[2] flex flex-col gap-2 w-full">
                              <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <div className={`flex-1 border px-3 py-4 rounded-2xl shadow-inner flex flex-col justify-center items-center ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black border-slate-800'}`}>
                                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Target</p>
                                    <p className="text-3xl font-black text-blue-500 tracking-widest">{activeJob.totalTargetQty}</p>
                                </div>
                                <div className={`flex-1 border px-3 py-4 rounded-2xl shadow-inner flex flex-col justify-center items-center ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black border-slate-800'}`}>
                                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Processed</p>
                                    <p className="text-3xl font-black text-emerald-500 tracking-widest">{logData.qtyProcessed}</p>
                                </div>
                                <div className={`flex-1 border px-3 py-4 rounded-2xl shadow-inner flex flex-col justify-center items-center ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black border-slate-800'}`}>
                                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Remain</p>
                                    <p className="text-3xl font-black text-amber-500 tracking-widest">{Math.max(0, activeJob.totalTargetQty - (parseInt(logData.qtyProcessed) || 0))}</p>
                                </div>
                              </div>
                              {/* Progress bar */}
                              {(() => {
                                const processed = parseInt(logData.qtyProcessed) || 0;
                                const target = activeJob.totalTargetQty || 0;
                                const pct = target > 0 ? Math.min(100, Math.round((processed / target) * 100)) : 0;
                                return (
                                  <div className={`w-full flex items-center gap-3 px-2`}>
                                    <div className={`flex-1 h-2 rounded-full overflow-hidden ${isLightMode ? 'bg-slate-200' : 'bg-slate-800'}`}>
                                      <div
                                        className={`h-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-sky-500 to-emerald-500'}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className={`text-[10px] font-black font-mono shrink-0 min-w-[2.5rem] text-right ${pct === 100 ? 'text-emerald-500' : (isLightMode ? 'text-slate-600' : 'text-slate-400')}`}>
                                      {pct}%
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                        </div>

                        {/* 2. MIDDLE: INTERACTIVE TICKER FULL WIDTH */}
                        <div className="w-full flex flex-col gap-6">
                            {renderInteractiveTicker()}
                        </div>

                        {/* 3. BOTTOM: STAGE INPUTS & NOTES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 w-full">
                            <div className={`w-full border-2 rounded-2xl p-4 lg:p-5 shadow-sm relative flex flex-col gap-4 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
                                {activeJob.status === "Received" && (
                                    <div className="flex flex-col gap-4 w-full">
                                        <div className={`rounded-xl p-3 lg:p-4 border ${isLightMode ? 'bg-slate-50 border-lime-200' : 'bg-black/40 border-lime-900/30'}`}>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                                                <span className="text-[10px] font-black text-lime-500 uppercase tracking-widest">Are All Sizes Present?</span>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border transition-all ${
                                                    checkedSizesCount === SIZE_OPTIONS.length 
                                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                                                        : (isLightMode ? 'bg-white text-slate-400 border-slate-200' : 'bg-slate-900 text-slate-500 border-slate-800')
                                                }`}>
                                                    {checkedSizesCount}/{SIZE_OPTIONS.length} Checked
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-3">
                                                {SIZE_OPTIONS.map(size => (
                                                    <button 
                                                        key={size}
                                                        type="button"
                                                        onClick={() => setStagedSizesPresent(prev => ({...prev, [size]: !prev[size]}))}
                                                        className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg border-2 transition-all duration-200 cursor-pointer shadow-sm ${
                                                            stagedSizesPresent[size] 
                                                                ? (isLightMode ? 'bg-emerald-50 border-emerald-400' : 'bg-emerald-950/30 border-emerald-600/60') 
                                                                : (isLightMode ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-black/60 border-slate-800 hover:border-slate-600')
                                                        }`}
                                                    >
                                                        <span className={`text-[10px] font-black uppercase ${stagedSizesPresent[size] ? 'text-emerald-500' : (isLightMode ? 'text-slate-500' : 'text-[#686a6c]')}`}>{size}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => { const all: Record<string, boolean> = {}; SIZE_OPTIONS.forEach(s => { all[s] = true; }); setStagedSizesPresent(all); }} className="flex-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest hover:text-emerald-600 transition-colors bg-emerald-500/10 py-1.5 rounded-lg border border-emerald-500/30 shadow-sm">✓ All</button>
                                                <button type="button" onClick={() => { const all: Record<string, boolean> = {}; SIZE_OPTIONS.forEach(s => { all[s] = false; }); setStagedSizesPresent(all); }} className="flex-1 text-[9px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 transition-colors bg-rose-500/10 py-1.5 rounded-lg border border-rose-500/30 shadow-sm">✕ Clear</button>
                                            </div>
                                        </div>
                                        <input type="text" value={stagedReceivedBy} onChange={(e) => setStagedReceivedBy(e.target.value)} className={`w-full rounded-lg px-3 py-3 text-sm font-bold outline-none shadow-inner border ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} placeholder="Who received the boxes?" />
                                        <input type="text" value={stagedBoxLocation} onChange={(e) => setStagedBoxLocation(e.target.value)} className={`w-full rounded-lg px-3 py-3 text-sm font-bold outline-none shadow-inner border ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} placeholder="Shelf ID / Box Location..." />
                                    </div>
                                )}

                                {activeJob.status === "Printing" && (
                                    <div className="flex flex-col gap-4 w-full">
                                        <div>
                                            <label className={`text-[9px] font-bold uppercase tracking-widest block mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Total Logged Qty</label>
                                            <input type="number" value={logData.qtyProcessed} onChange={(e) => { setLogData({...logData, qtyProcessed: e.target.value}); setHasUnsavedProgress(true); }} className={`w-full rounded-xl px-4 py-3 text-lg font-black outline-none shadow-inner border ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} placeholder="Qty Printed" />
                                        </div>
                                        <div>
                                            <label className={`text-[9px] font-bold uppercase tracking-widest block mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Price Paid ($)</label>
                                            <input type="number" value={logData.pricePaid} onChange={(e) => { setLogData({...logData, pricePaid: e.target.value}); setHasUnsavedProgress(true); }} className={`w-full border-emerald-500/50 rounded-xl px-4 py-3 text-lg font-black text-emerald-500 outline-none shadow-inner border ${isLightMode ? 'bg-white' : 'bg-black'}`} placeholder="0.00" />
                                        </div>
                                    </div>
                                )}

                                {activeJob.status === "Pressing" && (
                                    <div className="flex flex-col gap-4 w-full h-full">
                                        <div className={`w-full h-full p-4 rounded-xl border shadow-sm flex flex-col justify-center ${isLightMode ? 'bg-red-50 border-red-200' : 'bg-red-950/10 border-red-900/30'}`}>
                                            <div className="flex justify-between items-center mb-3">
                                                <label className="text-[10px] font-black text-red-500 uppercase tracking-widest">Spoils & Damages</label>
                                                <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">Total: {logData.spoilsTotal}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {["S","M","L","XL","2XL","3XL"].map(sz=><div key={sz} className="text-center">
                                                    <label className="text-[8px] font-black text-red-500/70 block mb-0.5">{sz}</label>
                                                    <input type="number" min="0" placeholder="0" value={(logData.spoilsSizes as any)[sz] || ""} onChange={e=>handleSpoilSizeChange(sz,e.target.value)} className={`w-full rounded-lg px-2 py-2 text-sm font-black text-red-500 text-center outline-none shadow-inner border ${isLightMode ? 'bg-white border-red-200' : 'bg-black border-red-900/50'}`} />
                                                </div>)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeJob.status === "Finishing" && (
                                    <div className="flex flex-col gap-4 w-full">
                                        <div>
                                            <label className={`text-[9px] font-bold uppercase tracking-widest block mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Final QC Check By</label>
                                            <input type="text" value={finishingQcBy} onChange={(e) => setFinishingQcBy(e.target.value)} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none shadow-inner border ${isLightMode ? 'bg-white border-teal-200 text-slate-900' : 'bg-black border-teal-900/40 text-white'}`} placeholder="QC Inspector name..." />
                                        </div>
                                    </div>
                                )}

                                {activeJob.status === "Dispatch" && (
                                    <div className="flex flex-col gap-4 w-full">
                                        <ToggleSwitch checked={dispatchInvoicePaid} onChange={setDispatchInvoicePaid} label={dispatchInvoicePaid ? "Invoice Paid" : "Invoice NOT Paid"} accentColor={dispatchInvoicePaid ? "emerald" : "rose"} isLightMode={isLightMode} />
                                        
                                        <div>
                                            <label className={`text-[9px] font-bold uppercase tracking-widest block mb-2 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Delivery Method</label>
                                            <div className={`flex gap-1.5 p-1 rounded-lg border shadow-inner ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-black/60 border-slate-800'}`}>
                                                <button type="button" onClick={() => setDispatchMethod("pickup")} className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${dispatchMethod === 'pickup' ? (isLightMode ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-700 text-white shadow-lg') : (isLightMode ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300')}`}>Pickup</button>
                                                <button type="button" onClick={() => setDispatchMethod("shipping")} className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${dispatchMethod === 'shipping' ? (isLightMode ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-700 text-white shadow-lg') : (isLightMode ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300')}`}>Shipping</button>
                                            </div>
                                        </div>

                                        {dispatchMethod === "shipping" && (
                                            <div>
                                                <label className={`text-[9px] font-bold uppercase tracking-widest block mb-1.5 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Tracking Number</label>
                                                <input type="text" value={dispatchTrackingNumber} onChange={(e) => setDispatchTrackingNumber(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm font-bold font-mono outline-none tracking-wider shadow-inner border ${isLightMode ? 'bg-white border-indigo-200 text-slate-900' : 'bg-black border-indigo-900/40 text-white'}`} placeholder="Tracking # (e.g. 1Z999AA...)" />
                                            </div>
                                        )}

                                        {dispatchMethod === "pickup" && (
                                            <div>
                                                <label className={`text-[9px] font-bold uppercase tracking-widest block mb-1.5 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Pickup Bin Location</label>
                                                <input type="text" value={dispatchPickupBin} onChange={(e) => setDispatchPickupBin(e.target.value)} className={`w-full rounded-lg px-3 py-2 text-sm font-bold outline-none shadow-inner border ${isLightMode ? 'bg-white border-indigo-200 text-slate-900' : 'bg-black border-indigo-900/40 text-white'}`} placeholder="Pickup Bin Location..." />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className={`w-full border-2 rounded-2xl p-4 lg:p-5 shadow-sm relative flex flex-col gap-4 h-full ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
                                <label className={`text-[9px] font-bold uppercase tracking-widest block mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Operator Notes (Optional)</label>
                                <textarea rows={4} value={logData.operatorNotes} onChange={(e) => { setLogData({...logData, operatorNotes: e.target.value}); setHasUnsavedProgress(true); }} className={`w-full h-full rounded-lg px-3 py-2 text-sm outline-none shadow-inner border custom-scrollbar flex-grow ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} placeholder="Drop notes, issues, or details here..." />
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* NEW TAB CONTENT: PRESSING LOG */}
            {activeTab === "pressing" && (
                <div className="flex-grow p-4 md:p-6 overflow-y-auto custom-scrollbar w-full">
                    <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
                        
                        {/* Report Generator UI */}
                        <div className={`p-6 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-end gap-4 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700/50'}`}>
                            <div className="flex-1 w-full">
                                <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Start Date</label>
                                <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className={`w-full rounded-lg px-4 py-3 text-sm font-bold outline-none shadow-inner border ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} />
                            </div>
                            <div className="flex-1 w-full">
                                <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>End Date</label>
                                <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className={`w-full rounded-lg px-4 py-3 text-sm font-bold outline-none shadow-inner border ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} />
                            </div>
                            <button onClick={() => alert("Generating Press Report for selected timeframe...")} className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-md bg-blue-600 hover:bg-blue-500 text-white border border-blue-500`}>
                                Generate Report
                            </button>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className={`p-6 rounded-2xl border shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700/50'}`}>
                                <div className="flex justify-between items-start">
                                    <h3 className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Total Pressed Units</h3>
                                    {activeJob.progressData?.pressingStartTime && (
                                        <div className={`px-3 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-widest ${isLightMode ? 'bg-sky-50 border-sky-200 text-sky-600' : 'bg-sky-950/20 border-sky-900/30 text-sky-400'}`}>
                                            Started: {new Date(activeJob.progressData.pressingStartTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                                        </div>
                                    )}
                                </div>
                                <div className="text-4xl font-black text-emerald-500 mt-2">
                                    {Object.values(tickCountsPress).reduce((sum, v) => sum + v, 0)} <span className="text-lg text-slate-500">/ {activeJob.totalTargetQty}</span>
                                </div>
                            </div>
                            <div className={`p-6 rounded-2xl border shadow-sm ${isLightMode ? 'bg-red-50 border-red-200' : 'bg-red-950/10 border-red-900/30'}`}>
                                <h3 className="text-[10px] font-black uppercase tracking-widest mb-2 text-red-500">Total Spoils / Damages</h3>
                                <div className="text-4xl font-black text-red-500">
                                    {logData.spoilsTotal}
                                </div>
                                <div className="flex gap-3 mt-3 flex-wrap">
                                    {Object.entries(logData.spoilsSizes).filter(([_, v]) => (v as number) > 0).map(([sz, qty]) => (
                                        <div key={sz} className={`text-xs font-bold text-red-600 px-3 py-1.5 rounded-md border ${isLightMode ? 'bg-red-100 border-red-200' : 'text-red-400 bg-red-500/20 border-red-500/30'}`}>
                                            {sz}: {qty as number}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Detailed Pressed Breakdown */}
                        <div className={`w-full border rounded-xl p-4 md:p-6 shadow-inner ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Pressed Items Breakdown</h3>
                            
                            <div className="flex flex-col gap-6">
                                {activeJob.itemsList.map((item: any, iIdx: number) => (
                                    <div key={iIdx} className={`p-4 md:p-5 rounded-2xl border shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700/50'}`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-inherit pb-3 mb-4">
                                            <div className="flex items-center">
                                                {renderGarmentIcon(item.description, "#38bdf8")}
                                                <span className={`text-sm lg:text-base font-black uppercase tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{item.description}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                            {item.variants.map((v: any, vIdx: number) => {
                                                const hex = COLOR_HEX_MAP[v.color] || getColorHex(v.color);
                                                const contrastText = getContrastTextColor(hex, isLightMode);
                                                const validSizes = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl"].filter(sz => v[sz] > 0);
                                                if (validSizes.length === 0) return null;

                                                return (
                                                    <div key={vIdx} className={`flex flex-col gap-3 p-3 md:p-4 rounded-xl border-2 ${isLightMode ? 'bg-slate-50' : 'bg-black/60'}`} style={{ borderColor: hex, backgroundColor: `${hex}1A` }}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-4 h-4 rounded-full border shadow-sm" style={{backgroundColor: hex, borderColor: hex === '#ffffff' ? '#ccc' : 'transparent'}}></div>
                                                                <span className={`text-[10px] font-black uppercase tracking-widest`} style={{ color: contrastText }}>{v.color}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                            {validSizes.map(sz => {
                                                                const key = `${iIdx}-${vIdx}-${sz}`;
                                                                const count = tickCountsPress[key] || 0;
                                                                const max = v[sz];
                                                                const isComplete = count === max;
                                                                
                                                                return (
                                                                    <div key={sz} className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 shadow-sm ${isComplete ? (isLightMode ? 'bg-emerald-50 border-emerald-500' : 'bg-emerald-950/30 border-emerald-500/80') : (count > 0 ? (isLightMode ? 'bg-amber-50 border-amber-400' : 'bg-amber-950/30 border-amber-500/60') : (isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'))}`}>
                                                                        <span className={`text-xl font-black uppercase ${isComplete ? 'text-emerald-500' : (count > 0 ? 'text-amber-500' : (isLightMode ? 'text-slate-500' : 'text-[#686a6c]'))}`}>{sz}</span>
                                                                        <span className={`text-xs font-black mt-0.5 ${isComplete ? 'text-emerald-500' : (isLightMode ? 'text-slate-900' : 'text-white')}`}>{count} / {max}</span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: ARTWORK & MOCKUPS */}
            {activeTab === "artwork" && (
                <div className="flex-grow p-4 md:p-8 overflow-y-auto custom-scrollbar flex flex-col xl:flex-row gap-6 w-full items-start justify-center">
                    
                    {/* Front Artwork & Coords */}
                    <div className="flex-1 w-full max-w-[600px] flex flex-col gap-4">
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] text-center ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Front Artwork Proof</h3>
                        {activeJob.frontMockup ? (
                            <>
                                <div className={`w-full rounded-[2rem] aspect-square flex items-center justify-center p-6 border relative shadow-xl ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-black border-slate-800'}`}>
                                    <img src={activeJob.frontMockup} alt="Front View" className="max-h-full object-contain rounded-xl filter drop-shadow-2xl" />
                                    <div className="absolute inset-0 pointer-events-none opacity-20">
                                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-sky-500 border-l border-dashed border-sky-400"></div>
                                        <div className="absolute left-0 right-0 top-[40%] h-px bg-sky-500 border-t border-dashed border-sky-400"></div>
                                    </div>
                                </div>
                                <div className={`w-full border rounded-[1.5rem] p-5 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className={`text-[9px] font-black uppercase tracking-[0.2em] ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Print Specs</h3>
                                        <span className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'bg-sky-50 text-sky-600 border border-sky-200' : 'bg-sky-500/10 text-sky-500 border border-sky-500/30'}`}>{activeJob.frontSpecs.preset}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className={`border rounded-xl p-3 text-center shadow-inner ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black border-slate-800'}`}><p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Scale</p><p className="text-lg font-mono font-bold text-sky-500">{activeJob.frontSpecs.scale}%</p></div>
                                        <div className={`border rounded-xl p-3 text-center shadow-inner ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black border-slate-800'}`}><p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>X-Axis</p><p className={`text-lg font-mono font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{activeJob.frontSpecs.x}%</p></div>
                                        <div className={`border rounded-xl p-3 text-center shadow-inner ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black border-slate-800'}`}><p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Y-Axis</p><p className={`text-lg font-mono font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{activeJob.frontSpecs.y}%</p></div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className={`w-full rounded-[2rem] aspect-square flex flex-col items-center justify-center p-8 border border-dashed ${isLightMode ? 'bg-slate-50 border-slate-300' : 'bg-black border-slate-800'}`}>
                                <i className={`material-icons-round text-6xl mb-4 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>image_not_supported</i>
                                <span className={`font-black uppercase tracking-widest text-sm text-center ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>No Mockup Saved</span>
                            </div>
                        )}
                    </div>

                    {/* Back Artwork & Coords */}
                    <div className="flex-1 w-full max-w-[600px] flex flex-col gap-4">
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] text-center ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Back Artwork Proof</h3>
                        {activeJob.backMockup ? (
                            <>
                                <div className={`w-full rounded-[2rem] aspect-square flex items-center justify-center p-6 border relative shadow-xl ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-black border-slate-800'}`}>
                                    <img src={activeJob.backMockup} alt="Back View" className="max-h-full object-contain rounded-xl filter drop-shadow-2xl" />
                                    <div className="absolute inset-0 pointer-events-none opacity-20">
                                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-sky-500 border-l border-dashed border-sky-400"></div>
                                        <div className="absolute left-0 right-0 top-[30%] h-px bg-sky-500 border-t border-dashed border-sky-400"></div>
                                    </div>
                                </div>
                                <div className={`w-full border rounded-[1.5rem] p-5 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'} ${activeJob.backSpecs.scale === 0 ? 'opacity-50' : ''}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className={`text-[9px] font-black uppercase tracking-[0.2em] ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Print Specs</h3>
                                        <span className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'bg-sky-50 text-sky-600 border border-sky-200' : 'bg-sky-500/10 text-sky-500 border border-sky-500/30'}`}>{activeJob.backSpecs.preset}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className={`border rounded-xl p-3 text-center shadow-inner ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black border-slate-800'}`}><p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Scale</p><p className="text-lg font-mono font-bold text-sky-500">{activeJob.backSpecs.scale}%</p></div>
                                        <div className={`border rounded-xl p-3 text-center shadow-inner ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black border-slate-800'}`}><p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>X-Axis</p><p className={`text-lg font-mono font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{activeJob.frontSpecs.x}%</p></div>
                                        <div className={`border rounded-xl p-3 text-center shadow-inner ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black border-slate-800'}`}><p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>Y-Axis</p><p className={`text-lg font-mono font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{activeJob.frontSpecs.y}%</p></div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className={`w-full rounded-[2rem] aspect-square flex flex-col items-center justify-center p-8 border opacity-70 ${isLightMode ? 'bg-slate-100 border-slate-300' : 'bg-black border-slate-800'}`}>
                                <i className={`material-icons-round text-6xl mb-4 ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>do_not_disturb_alt</i>
                                <span className={`font-black uppercase tracking-widest text-sm text-center ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>No Back Print Required</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ACTION FOOTER */}
            <div className={`border-t px-4 py-4 flex flex-col sm:flex-row gap-3 shrink-0 z-40 w-full justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-950 border-white/5'}`}>
                <div className="w-full max-w-[1600px] flex flex-col sm:flex-row gap-3 items-center">
                    <button className={`sm:flex-1 w-full sm:w-auto py-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-widest transition-all shrink-0 ${isLightMode ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-500 hover:text-white' : 'border-red-500/30 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white'}`}>
                        Report Issue
                    </button>
                    <button 
                      onClick={() => submitStageAdvancement(logData, false)} 
                      disabled={saveStatus === "saving"}
                      className={`sm:flex-1 w-full sm:w-auto py-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-widest transition-all shrink-0 ${
                        saveStatus === "saved" 
                          ? (isLightMode ? "border-emerald-500 text-emerald-600 bg-emerald-50" : "border-emerald-500/30 text-emerald-500 bg-emerald-500/10")
                          : saveStatus === "error" 
                          ? (isLightMode ? "border-red-500 text-red-600 bg-red-50" : "border-red-500/30 text-red-500 bg-red-500/10")
                          : saveStatus === "saving" 
                          ? (isLightMode ? "border-sky-300 text-sky-500 bg-sky-50 cursor-wait" : "border-sky-500/50 text-sky-400 bg-sky-600/50 cursor-wait")
                          : (isLightMode ? "border-sky-500 text-sky-600 bg-white hover:bg-sky-500 hover:text-white shadow-[0_0_20px_rgba(56,189,248,0.2)]" : "border-sky-500 text-sky-500 bg-transparent hover:bg-sky-500 hover:text-white shadow-[0_0_20px_rgba(56,189,248,0.3)]")
                      }`}
                    >
                        {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "Save Failed" : "Save Progress"}
                    </button>
                    <button onClick={() => setShowConfirmModal(true)} className="sm:flex-[3] w-full sm:w-auto py-4 rounded-xl bg-emerald-600 border border-emerald-500 text-white font-black uppercase text-xs lg:text-sm tracking-[0.2em] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all shrink-0">
                        {getNextStageLabel(activeJob.status)}
                    </button>
                </div>
            </div>
            </div>
        ) : (
            <div className={`flex-grow flex flex-col items-center justify-center relative h-full overflow-hidden w-full p-6 ${isLightMode ? 'bg-slate-100' : 'bg-[#050505]'}`}>
                {jobs.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 max-w-md text-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${isLightMode ? 'bg-emerald-100' : 'bg-emerald-500/10'}`}>✓</div>
                    <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>All Clear</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      No jobs in production right now.
                    </p>
                    <p className={`text-[10px] font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-500'} max-w-xs`}>
                      When a quote is approved in /quotes, an order is created in CRM, or a payment posts in /invoices, new jobs will appear here automatically.
                    </p>
                    <div className={`flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${syncStatus === 'live' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                      {syncStatus === 'live' ? 'Realtime sync active — ready for new jobs' : 'Syncing every 30s'}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 max-w-md text-center">
                    <div className={`text-5xl ${isLightMode ? 'text-slate-400' : 'text-slate-600'}`}>👈</div>
                    <h3 className={`text-xl font-black uppercase italic tracking-tighter ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Pick a Job</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Select one from the queue to start working
                    </p>
                    {/* Quick summary */}
                    <div className="grid grid-cols-2 gap-2 w-full mt-2">
                      {urgentCount > 0 && (
                        <button onClick={() => { setQueueFilter("urgent"); setIsSidebarOpen(true); }} className={`p-3 rounded-xl border transition-all hover:-translate-y-0.5 ${isLightMode ? 'bg-red-50 border-red-200 hover:border-red-400' : 'bg-red-950/20 border-red-500/30 hover:border-red-500/60'}`}>
                          <div className="text-2xl font-black text-red-500">{urgentCount}</div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-red-500">🔥 Urgent</div>
                        </button>
                      )}
                      {readyCount > 0 && (
                        <button onClick={() => { setQueueFilter("ready"); setIsSidebarOpen(true); }} className={`p-3 rounded-xl border transition-all hover:-translate-y-0.5 ${isLightMode ? 'bg-lime-50 border-lime-200 hover:border-lime-400' : 'bg-lime-950/20 border-lime-500/30 hover:border-lime-500/60'}`}>
                          <div className="text-2xl font-black text-lime-500">{readyCount}</div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-lime-500">Ready to Print</div>
                        </button>
                      )}
                      {upstreamCount > 0 && (
                        <button onClick={() => { setQueueFilter("upstream"); setIsSidebarOpen(true); }} className={`p-3 rounded-xl border transition-all hover:-translate-y-0.5 ${isLightMode ? 'bg-amber-50 border-amber-200 hover:border-amber-400' : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60'}`}>
                          <div className="text-2xl font-black text-amber-500">{upstreamCount}</div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-amber-500">⏳ Coming</div>
                        </button>
                      )}
                      <button onClick={() => { setQueueFilter("all"); setIsSidebarOpen(true); }} className={`p-3 rounded-xl border transition-all hover:-translate-y-0.5 ${isLightMode ? 'bg-sky-50 border-sky-200 hover:border-sky-400' : 'bg-sky-950/20 border-sky-500/30 hover:border-sky-500/60'}`}>
                        <div className="text-2xl font-black text-sky-500">{jobs.length}</div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-sky-500">Total Jobs</div>
                      </button>
                    </div>
                  </div>
                )}
            </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && activeJob && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowConfirmModal(false)}>
            <div className={`w-full max-w-md border rounded-[2rem] p-6 sm:p-8 shadow-2xl flex flex-col ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-950 border-white/10'}`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4 border-b border-inherit pb-3">
                    <div>
                        <h2 className={`text-xl sm:text-2xl font-black uppercase italic tracking-tighter leading-none ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Advance Stage?</h2>
                    </div>
                </div>
                
                <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-6 leading-relaxed ${isLightMode ? 'text-slate-500' : 'text-[#686a6c]'}`}>
                    Ready to move <span className={`font-black ${isLightMode ? 'text-sky-600' : 'text-sky-500'}`}>#{activeJob.job_number} ({activeJob.client})</span> to <span className={`font-black ${isLightMode ? 'text-emerald-600' : 'text-emerald-500'}`}>{getNextStageLabel(activeJob.status).replace(' →', '').replace('Move to ', '')}</span>?
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-inherit">
                    <button onClick={() => setShowConfirmModal(false)} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700' : 'border-slate-800 bg-black/40 hover:bg-slate-800 text-white'}`}>
                        Cancel
                    </button>
                    <button onClick={() => { setShowConfirmModal(false); submitStageAdvancement(logData, true); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        Confirm & Move
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* SCHEDULE TASK MODAL */}
      {scheduleModalOpen && activeJob && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className={`w-full max-w-xl border rounded-[2rem] p-6 sm:p-8 shadow-2xl flex flex-col ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
                <div className="flex justify-between items-start mb-6 border-b border-inherit pb-4">
                    <div>
                        <h2 className={`text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Schedule Task</h2>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Job #{activeJob.job_number} • {activeJob.client}</p>
                    </div>
                    <button onClick={() => setScheduleModalOpen(false)} className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'}`}>Close</button>
                </div>
                
                <form onSubmit={handleScheduleTask} className="flex flex-col gap-6">
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Task Category</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {["To Purchase", "To Print", "To Press", "To Package", "To Deliver", "To Bill", "Artwork"].map(action => (
                                <button 
                                    key={action} type="button" onClick={() => setScheduleTaskName(action)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors border ${scheduleTaskName === action ? 'bg-sky-500/20 text-sky-500 border-sky-500/50' : (isLightMode ? 'bg-slate-100 text-slate-500 border-slate-300 hover:border-sky-500' : 'bg-black/40 text-slate-400 border-slate-800 hover:border-slate-500')}`}
                                >
                                    {action}
                                </button>
                            ))}
                        </div>
                        <input 
                            type="text" value={scheduleTaskName} onChange={(e) => setScheduleTaskName(e.target.value)}
                            placeholder="Or type custom action..."
                            className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500' : 'bg-black border-slate-700 text-white focus:border-sky-500'}`}
                            required
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                        <div className="w-full sm:w-1/2 relative">
                            <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Schedule Date</label>
                            <input 
                                type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                                className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border cursor-pointer relative z-10 ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500' : 'bg-black border-slate-700 text-white focus:border-emerald-500'}`}
                                style={{ colorScheme: isLightMode ? 'light' : 'dark' }}
                            />
                        </div>
                        <div className="w-full sm:w-1/2 relative">
                            <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Time Slot (Open)</label>
                            <input 
                                type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                                className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border cursor-pointer relative z-10 ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500' : 'bg-black border-slate-700 text-white focus:border-emerald-500'}`}
                                style={{ colorScheme: isLightMode ? 'light' : 'dark' }}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-inherit mt-2">
                        <button type="button" onClick={() => setScheduleModalOpen(false)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'border-slate-200 hover:bg-slate-100 text-slate-700' : 'border-slate-800 bg-black/40 hover:bg-slate-800 text-white'}`}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isScheduling || !scheduleTaskName.trim()} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)] ${isScheduling || !scheduleTaskName.trim() ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white'}`}>
                            {isScheduling ? 'Saving...' : 'Add to Calendar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}