"use client";

import { useState, useEffect, useMemo, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// --- FULL PRODUCTION STAGE MAP FOR MODAL ---
const PIPELINE_STAGES = [
  { id: "Incoming", label: "New Orders" },
  { id: "Artwork", label: "To Artwork" },
  { id: "Sourcing", label: "To Source" },
  { id: "Ordered", label: "Blanks Ordered" },
  { id: "Received", label: "Blanks Received" },
  { id: "Staged", label: "To Stage" },
  { id: "Printing", label: "To Print" },
  { id: "Pressing", label: "To Press" },
  { id: "Finishing", label: "To Finish" },
  { id: "Dispatch", label: "To Dispatch" },
  { id: "Billing", label: "To Bill" },
  { id: "Paid", label: "Completed" }
];

// --- JOB COLUMN CONFIGURATION ---
const JOB_COLUMNS = [
  { id: "Artwork", label: "To Confirm Artwork", stages: ["Artwork"], color: "text-fuchsia-500 border-fuchsia-500/30", bg: "bg-fuchsia-500/10", taskPreset: "Artwork" },
  { id: "Sourcing", label: "To Buy / Source", stages: ["Sourcing", "Ordered", "Received", "Staged"], color: "text-amber-500 border-amber-500/30", bg: "bg-amber-500/10", taskPreset: "To Purchase" },
  { id: "Printing", label: "To Print", stages: ["Printing"], color: "text-pink-500 border-pink-500/30", bg: "bg-pink-500/10", taskPreset: "To Print" },
  { id: "Pressing", label: "To Press", stages: ["Pressing"], color: "text-red-500 border-red-500/30", bg: "bg-red-500/10", taskPreset: "To Press" },
  { id: "Finishing", label: "To Package / Finish", stages: ["Finishing"], color: "text-teal-500 border-teal-500/30", bg: "bg-teal-500/10", taskPreset: "To Finish" },
  { id: "Dispatch", label: "To Deliver / Pickup", stages: ["Dispatch"], color: "text-indigo-500 border-indigo-500/30", bg: "bg-indigo-500/10", taskPreset: "To Deliver" },
  { id: "Billing", label: "To Bill", stages: ["Billing"], color: "text-blue-500 border-blue-500/30", bg: "bg-blue-500/10", taskPreset: "To Bill" },
];

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

// --- GARMENT ICON RENDERER FOR CALENDAR BLOCKS ---
const renderGarmentIcon = (description: string, isLightMode: boolean, customClass?: string): ReactNode => {
  const desc = description?.toLowerCase() || "";
  const classes = customClass || "w-3 h-3 mr-1.5 shrink-0";
  // Determine color based on task preset colors so it matches the block aesthetic
  let color = isLightMode ? "#0f1115" : "#ffffff";
  if (desc.includes("print")) color = "#ec4899"; 
  else if (desc.includes("press")) color = "#ef4444";
  else if (desc.includes("finish") || desc.includes("pack")) color = "#14b8a6";
  
  // Use passed currentColor for custom overrides, else fallback to logic colors
  const strokeColor = customClass ? "currentColor" : color;

  if (desc.includes("hoodie") || desc.includes("hooded")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M18 9l3 3-2 2-1-2v10H6V12l-1 2-2-2 3-3" /><path d="M8 9V5c0-2.5 1.5-4 4-4s4 1.5 4 4v4" /><path d="M10 9v3" /><path d="M14 9v3" /><path d="M7.5 15h9l1 5H6.5l1-5z" /></svg>);
  }
  if (desc.includes("polo") || desc.includes("collared")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M18 7l3 3-2 2-1-2v12H6V10l-1 2-2-2 3-3" /><path d="M9 7l3 4 3-4" /><path d="M12 7v6" /><circle cx="12" cy="10" r="0.5" fill={strokeColor}/></svg>);
  }
  if (desc.includes("hat") || desc.includes("cap") || desc.includes("beanie")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M4 15v-2a8 8 0 0 1 16 0v2" /><path d="M2 15h15c2 0 4 1 4 2s-2 2-4 2H2v-4z" /><circle cx="12" cy="4" r="1.5" /><path d="M12 5.5v7.5" /></svg>);
  }
  if (desc.includes("long sleeve") || desc.includes("longsleeve")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M17 6L22 18l-3 1-2-9v12H7V12L5 19l-3-1L7 6" /><path d="M8 6c0 2 2 3 4 3s4-1 4-3" /></svg>);
  }
  if (desc.includes("jacket") || desc.includes("zip") || desc.includes("coat")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M18 9l3 4-2 2-1-3v10H6V12l-1 3-2-2 3-4" /><path d="M9 9V5l3 3 3-3v4" /><path d="M12 8v14" /><path d="M7 16h3" /><path d="M14 16h3" /></svg>);
  }
  if (desc.includes("pant") || desc.includes("sweatpant") || desc.includes("short") || desc.includes("bottom")) {
    return (<svg viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M9 3H4v18h5v-9h6v9h5V3h-5v5H9V3z"/></svg>);
  }
  return (<svg viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={classes}><path d="M18 7l3 3-2 2-1-2v12H6V10l-1 2-2-2 3-3" /><path d="M8 7c0 2 1.5 3 4 3s4-1 4-3" /></svg>);
};

export default function TodoListOS() {
  const [todos, setTodos] = useState<any[]>([]);
  const [jobsList, setJobsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<"list" | "calendar" | "trash" | "floor">("calendar"); 
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  const [completingTodo, setCompletingTodo] = useState<any>(null);
  
  // --- ADDITIVE: FLOOR MANIFEST STATE ---
  const [floorSelectedTaskId, setFloorSelectedTaskId] = useState<string | null>(null);

  // Form State
  const [newTask, setNewTask] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [calculatedDuration, setCalculatedDuration] = useState<number>(60);
  const [isBacklogSubmit, setIsBacklogSubmit] = useState(false); // ADDITIVE: Identify if pushing to backlog

  // Searchable Dropdown State
  const [jobSearchTerm, setJobSearchTerm] = useState("");
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // --- RESIZING STATE (TOP & BOTTOM) ---
  const [resizingTodoId, setResizingTodoId] = useState<string | null>(null);
  const [resizeType, setResizeType] = useState<'top' | 'bottom' | null>(null);
  const [startY, setStartY] = useState<number>(0);
  const [startDuration, setStartDuration] = useState<number>(0);
  const [startTimeMins, setStartTimeMins] = useState<number>(0);
  
  // --- AGENDA SIDEBAR STATE ---
  const [isAgendaOpen, setIsAgendaOpen] = useState(false);
  const calendarContainerRef = useRef<HTMLDivElement>(null);

  // --- ADDITIVE: BACKLOG STATE ---
  const [isBacklogOpen, setIsBacklogOpen] = useState(false);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);

  // --- ADDITIVE: QUICK SCHEDULE STATE ---
  const [quickScheduleJob, setQuickScheduleJob] = useState<{job: any, task: string, duration: number} | null>(null);
  const [qsHour, setQsHour] = useState("12");
  const [qsMinute, setQsMinute] = useState("00");
  const [qsAmPm, setQsAmPm] = useState("PM");
  const [qsDate, setQsDate] = useState("");

  const openQuickSchedule = (job: any, task: string, duration: number) => {
      const now = new Date();
      let h = now.getHours();
      let ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      
      // Snap up to the nearest 10 minute interval
      let m = now.getMinutes();
      let snappedM = Math.ceil(m / 10) * 10;
      if (snappedM >= 60) {
          snappedM = 0;
          h += 1;
          if (h === 12) ampm = ampm === 'AM' ? 'PM' : 'AM';
          if (h > 12) h = 1;
      }
      
      setQsHour(h.toString());
      setQsMinute(snappedM.toString().padStart(2, '0'));
      setQsAmPm(ampm);
      
      // Get current local date safely
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
      setQsDate(localISOTime);
      
      setQuickScheduleJob({ job, task, duration });
  };

  const handleQuickScheduleSubmit = async () => {
      if (!quickScheduleJob) return;
      try {
          let h24 = parseInt(qsHour);
          if (qsAmPm === 'PM' && h24 !== 12) h24 += 12;
          if (qsAmPm === 'AM' && h24 === 12) h24 = 0;
          
          const timeStr = `${h24.toString().padStart(2, '0')}:${qsMinute}:00`;
          
          const { error } = await supabase.from("todos").insert([{
              task: quickScheduleJob.task,
              job_id: quickScheduleJob.job.id,
              target_date: qsDate,
              target_time: timeStr,
              duration_minutes: quickScheduleJob.duration,
              is_deleted: false
          }]);
          if (error) throw error;
          fetchData();
          setQuickScheduleJob(null);
      } catch (err) {
          console.error("Failed to quick schedule:", err);
          showToast("error", "Failed to schedule task");
      }
  };

  // --- ADDITIVE: DEPENDENCY ENGINE STATE ---
  const [shiftDependenciesPrompt, setShiftDependenciesPrompt] = useState<{todoId: string, targetDate: string, timeStr: string, deltaMs: number} | null>(null);

  // ============ NEW: SYNC + SEARCH + TOAST + CONFIRM + BULK ============
  const [syncStatus, setSyncStatus] = useState<"live" | "polling" | "connecting">("connecting");
  const [globalSearch, setGlobalSearch] = useState("");
  const [toast, setToastMsg] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToastMsg({ type, message });
    setTimeout(() => setToastMsg(null), 3500);
  };
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel: string; danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  // Bulk selection for Today's Floor
  const [selectedFloorTaskIds, setSelectedFloorTaskIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("id, job_number, title, stage, quote_id, quotes(customers(company_name), quote_items(description, quantity, quote_item_variants(color, s, m, l, xl, xxl, xxxl)))")
        .not("stage", "eq", "Completed")
        .order("created_at", { ascending: false });
      
      if (jobsData) setJobsList(jobsData);

      const { data: todosData } = await supabase
        .from("todos")
        .select(`
          *,
          jobs (
            id,
            job_number,
            title,
            stage,
            quote_id,
            quotes(customers(company_name), quote_items(description, quantity))
          )
        `)
        .order("is_completed", { ascending: true })
        .order("target_date", { ascending: true })
        .order("target_time", { ascending: true });

      if (todosData) setTodos(todosData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // REALTIME SYNC — todos and jobs from any device/page (CRM reminders, shop-floor advances, quote approvals)
    const channel = supabase
      .channel('todos-page-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchData();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSyncStatus('polling');
      });

    // FALLBACK: poll every 45s in case realtime drops
    const poll = setInterval(fetchData, 45000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    if (savedTheme === 'light') setIsLightMode(true);
  }, []);

  // Global keyboard handler: ESC closes modals, hotkeys for navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't fire shortcuts while typing in inputs
      const target = e.target as HTMLElement;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (e.key === "Escape") {
        if (confirmDialog) { setConfirmDialog(null); return; }
        if (quickScheduleJob) { setQuickScheduleJob(null); return; }
        if (previewJobId) { setPreviewJobId(null); return; }
        if (shiftDependenciesPrompt) { setShiftDependenciesPrompt(null); return; }
        if (completingTodo) { setCompletingTodo(null); return; }
        if (isBacklogOpen) { setIsBacklogOpen(false); return; }
        if (isAgendaOpen) { setIsAgendaOpen(false); return; }
        if (globalSearch) { setGlobalSearch(""); return; }
        return;
      }

      // Cmd/Ctrl+K — focus global search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("todos-global-search")?.focus();
        return;
      }

      if (isTyping) return;

      // Single-key shortcuts when not typing
      if (e.key.toLowerCase() === "t") { setActiveTab("floor"); return; }
      if (e.key.toLowerCase() === "c") { setActiveTab("calendar"); return; }
      if (e.key.toLowerCase() === "l") { setActiveTab("list"); return; }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        // Focus the new-task input — works on calendar+list tabs where the form is visible
        const input = document.querySelector<HTMLInputElement>('input[placeholder="Type specific action..."]');
        if (input) input.focus();
        return;
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [shiftDependenciesPrompt, completingTodo, isBacklogOpen, isAgendaOpen, previewJobId, quickScheduleJob, confirmDialog, globalSearch]);

  // Handle Click Outside for Search Dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
              setIsJobDropdownOpen(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const PIXELS_PER_HOUR = 140; // ADDITIVE: More compact for 24-hour view
  const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;

  // ADDITIVE: Current Time Tracker
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
      return () => clearInterval(timer);
  }, []);

  // ADDITIVE: Initial Auto-Scroll to Current Time
  useEffect(() => {
      if (activeTab === "calendar" && calendarContainerRef.current) {
          // Brief timeout ensures render completes before scroll calculation
          setTimeout(() => {
              const now = new Date();
              const h = now.getHours();
              const m = now.getMinutes();
              const topPosition = (h * PIXELS_PER_HOUR) + (m * PIXELS_PER_MINUTE);
              calendarContainerRef.current?.scrollTo({
                  top: Math.max(0, topPosition - 200), // Centers the current time line perfectly
                  behavior: 'smooth'
              });
          }, 300);
      }
  }, [activeTab]);

// --- GLOBAL RESIZING LISTENERS ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingTodoId || !resizeType) return;
      
      const deltaY = e.clientY - startY;
      const rawDeltaMins = deltaY / PIXELS_PER_MINUTE;
      // Snap duration changes to 5 minute increments
      const snappedDeltaMins = Math.round(rawDeltaMins / 5) * 5; 

      setTodos(prev => prev.map(t => {
          if (t.id !== resizingTodoId) return t;

          if (resizeType === 'bottom') {
              const newDuration = Math.max(15, startDuration + snappedDeltaMins); // Min 15 mins
              return { ...t, duration_minutes: newDuration };
          } 
          
          if (resizeType === 'top') {
              // Calculate new start time
              const newStartMins = Math.max(0, startTimeMins + snappedDeltaMins);
              const newDuration = Math.max(15, startDuration - snappedDeltaMins);
              
              // Convert minutes back to HH:MM format
              const newH = Math.floor(newStartMins / 60).toString().padStart(2, '0');
              const newM = (newStartMins % 60).toString().padStart(2, '0');
              const newTimeStr = `${newH}:${newM}:00`;
              
              return { ...t, target_time: newTimeStr, duration_minutes: newDuration };
          }
          return t;
      }));
    };

    const handleMouseUp = async () => {
      if (!resizingTodoId) return;
      const todo = todos.find(t => t.id === resizingTodoId);
      if (todo) {
          // Commit to DB
          await supabase.from("todos").update({ 
              target_time: todo.target_time,
              duration_minutes: todo.duration_minutes 
          }).eq("id", todo.id);
      }
      setResizingTodoId(null);
      setResizeType(null);
    };

    if (resizingTodoId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingTodoId, resizeType, startY, startDuration, startTimeMins, todos]);

  const handleResizeStart = (e: React.MouseEvent, todo: any, type: 'top' | 'bottom') => {
      e.stopPropagation(); 
      e.preventDefault();
      setResizingTodoId(todo.id);
      setResizeType(type);
      setStartY(e.clientY);
      setStartDuration(todo.duration_minutes || 60);
      
      const [h, m] = todo.target_time.split(":");
      setStartTimeMins((parseInt(h, 10) * 60) + parseInt(m, 10));
  };

  const getJobTotalQty = (job: any) => {
      if (!job || !job.quotes || !job.quotes.quote_items) return 0;
      return job.quotes.quote_items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  };

  const formatToAMPM = (time24: string) => {
      if (!time24) return "";
      const [h, m] = time24.split(":");
      const hours = parseInt(h, 10);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  const calculateEndTime = (start24: string, durationMins: number) => {
      if (!start24) return "";
      const [h, m] = start24.split(":");
      const dateObj = new Date();
      dateObj.setHours(parseInt(h, 10), parseInt(m, 10), 0);
      dateObj.setMinutes(dateObj.getMinutes() + durationMins);
      
      const endH = dateObj.getHours().toString().padStart(2, '0');
      const endM = dateObj.getMinutes().toString().padStart(2, '0');
      return formatToAMPM(`${endH}:${endM}`);
  };

  useEffect(() => {
      if (selectedJobId && (newTask.includes("Press") || newTask.includes("Print"))) {
          const job = jobsList.find(j => j.id === selectedJobId);
          const qty = getJobTotalQty(job);
          setCalculatedDuration(qty > 0 ? qty : 60);
      } else {
          setCalculatedDuration(60); 
      }
  }, [selectedJobId, newTask, jobsList]);

  const getTaskColorClass = (taskName: string) => {
      const t = taskName.toLowerCase();
      if (t.includes("print")) return "bg-pink-500/20 text-pink-500 border-pink-500/50 dark:bg-pink-900/30";
      if (t.includes("press")) return "bg-red-500/20 text-red-500 border-red-500/50 dark:bg-red-900/30";
      if (t.includes("finish") || t.includes("pack")) return "bg-teal-500/20 text-teal-500 border-teal-500/50 dark:bg-teal-900/30";
      if (t.includes("purchas") || t.includes("order") || t.includes("source") || t.includes("buy")) return "bg-amber-500/20 text-amber-500 border-amber-500/50 dark:bg-amber-900/30";
      if (t.includes("deliver") || t.includes("dispatch")) return "bg-indigo-500/20 text-indigo-500 border-indigo-500/50 dark:bg-indigo-900/30";
      if (t.includes("art")) return "bg-fuchsia-500/20 text-fuchsia-500 border-fuchsia-500/50 dark:bg-fuchsia-900/30";
      return "bg-sky-500/20 text-sky-500 border-sky-500/50 dark:bg-sky-900/30"; 
  };

  const getNextAvailableSlot = () => {
    const today = new Date();
    const dateStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const todaysTodos = todos.filter(t => t.target_date === dateStr && t.target_time && !t.is_completed && !t.is_deleted);

    for (let hour = 9; hour <= 16; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`; 
        const isOccupied = todaysTodos.some(t => t.target_time.startsWith(timeStr.substring(0, 2)));
        if (!isOccupied) {
            return { date: dateStr, time: timeStr };
        }
    }
    return { date: dateStr, time: "17:00" }; 
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    setIsSubmitting(true);
    try {
      let finalDate = targetDate;
      let finalTime = targetTime;

      // ADDITIVE: Backlog Bypass
      if (isBacklogSubmit) {
          finalDate = "";
          finalTime = "";
      } else if (!finalDate || !finalTime) {
          const autoSlot = getNextAvailableSlot();
          finalDate = finalDate || autoSlot.date;
          finalTime = finalTime || autoSlot.time;
      }

      const { error } = await supabase.from("todos").insert([
        {
          task: newTask,
          job_id: selectedJobId || null,
          target_date: finalDate === "" ? null : finalDate,
          target_time: finalTime === "" ? null : finalTime,
          duration_minutes: calculatedDuration,
          is_deleted: false 
        }
      ]);

      if (error) throw error;

      setNewTask("");
      setSelectedJobId("");
      setJobSearchTerm("");
      setTargetDate("");
      setTargetTime("");
      fetchData(); 
      
      if (!isBacklogSubmit && (!targetDate || !targetTime)) {
          showToast("info", `Auto-scheduled for ${finalDate} at ${formatToAMPM(finalTime)}`);
      } else if (isBacklogSubmit) {
          showToast("success", "Stored in the Backlog");
      } else {
          showToast("success", "Task added");
      }

      setIsBacklogSubmit(false); // Reset State
    } catch (err) {
      console.error("Failed to add task:", err);
      showToast("error", "Failed to add task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckClick = (todo: any) => {
      if (todo.jobs && !todo.is_completed) {
          setCompletingTodo(todo);
      } else {
          toggleTodoStatus(todo.id, todo.is_completed);
      }
  };

  const handleCompleteAndMove = async (todoId: string, newStage?: string) => {
      try {
          await supabase.from("todos").update({ is_completed: true }).eq("id", todoId);
          setTodos(todos.map(t => t.id === todoId ? { ...t, is_completed: true } : t));
          
          if (newStage && completingTodo?.job_id) {
              await supabase.from("job_logs").insert([{ job_id: completingTodo.job_id, from_stage: completingTodo.jobs.stage, to_stage: newStage }]);
              await supabase.from("jobs").update({ stage: newStage, updated_at: new Date() }).eq("id", completingTodo.job_id);
          }
          
          setCompletingTodo(null);
          fetchData(); 
      } catch (err) {
          console.error("Error completing and moving:", err);
      }
  };

  const toggleTodoStatus = async (id: string, currentStatus: boolean) => {
    try {
      setTodos(todos.map(t => t.id === id ? { ...t, is_completed: !currentStatus } : t));
      const { error } = await supabase.from("todos").update({ is_completed: !currentStatus }).eq("id", id);
      if (error) throw error;
      fetchData(); 
    } catch (err) {
      console.error("Error toggling status:", err);
      fetchData(); 
    }
  };

  const moveToTrash = async (id: string) => {
    try {
      setTodos(todos.map(t => t.id === id ? { ...t, is_deleted: true } : t)); 
      const { error } = await supabase.from("todos").update({ is_deleted: true }).eq("id", id);
      if (error) throw error;
      fetchData(); 
    } catch (err) {
      console.error("Error trashing task:", err);
      fetchData(); 
    }
  };

  const restoreFromTrash = async (id: string) => {
    try {
      setTodos(todos.map(t => t.id === id ? { ...t, is_deleted: false } : t)); 
      const { error } = await supabase.from("todos").update({ is_deleted: false }).eq("id", id);
      if (error) throw error;
      fetchData(); 
    } catch (err) {
      console.error("Error restoring task:", err);
      fetchData(); 
    }
  };

  const permanentlyDelete = (id: string) => {
    setConfirmDialog({
      title: "Delete forever?",
      message: "This task will be removed permanently and cannot be recovered.",
      confirmLabel: "Delete Forever",
      danger: true,
      onConfirm: async () => {
        try {
          setTodos(todos.filter(t => t.id !== id));
          const { error } = await supabase.from("todos").delete().eq("id", id);
          if (error) throw error;
          showToast("success", "Deleted");
        } catch (err) {
          console.error("Error deleting task:", err);
          showToast("error", "Could not delete");
          fetchData();
        }
      },
    });
  };

  // --- DRAG AND DROP HANDLERS WITH 15-MIN SNAPPING ---
  const handleDragStart = (e: React.DragEvent, todoId: string) => {
      e.dataTransfer.setData("todoId", todoId);
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string, targetHour: number, boundingBoxTop: number) => {
      e.preventDefault();
      const todoId = e.dataTransfer.getData("todoId");
      const newJobTodoStr = e.dataTransfer.getData("newJobTodo");
      if (!todoId && !newJobTodoStr) return;

      // Calculate where exactly in the hour block they dropped it
      const dropY = e.clientY - boundingBoxTop;
      const rawMins = (dropY / PIXELS_PER_HOUR) * 60;
      
      // Snap to nearest 15 minutes
      const snappedMins = Math.round(rawMins / 15) * 15;
      
      let finalHour = targetHour;
      let finalMins = snappedMins;
      
      // Handle edge cases if snapping pushes it to the next hour
      if (finalMins >= 60) {
          finalHour += 1;
          finalMins -= 60;
      } else if (finalMins < 0) {
          finalMins = 0;
      }

      const timeStr = `${finalHour.toString().padStart(2, '0')}:${finalMins.toString().padStart(2, '0')}:00`;
      
      // ADDITIVE: Handle new job drag and drop creation
      if (newJobTodoStr) {
          const newJobData = JSON.parse(newJobTodoStr);
          try {
              const { error } = await supabase.from("todos").insert([{
                  task: newJobData.task,
                  job_id: newJobData.jobId,
                  target_date: targetDate,
                  target_time: timeStr,
                  duration_minutes: newJobData.duration,
                  is_deleted: false
              }]);
              if (error) throw error;
              fetchData();
          } catch (err) {
              console.error("Failed to create dragged task:", err);
          }
          return; // Exit early since this is a new task
      }

      // ADDITIVE: Dependency Engine Check before pushing to DB
      const todo = todos.find(t => t.id === todoId);
      if (todo && todo.target_date && todo.target_time) {
          const oldDateObj = new Date(`${todo.target_date}T${todo.target_time}`);
          const newDateObj = new Date(`${targetDate}T${timeStr}`);
          const deltaMs = newDateObj.getTime() - oldDateObj.getTime();
          
          if (deltaMs > 0 && todo.job_id) {
              const dependentTasks = todos.filter(t => t.job_id === todo.job_id && t.id !== todo.id && t.target_date && t.target_time && new Date(`${t.target_date}T${t.target_time}`) >= oldDateObj);
              if (dependentTasks.length > 0) {
                   setShiftDependenciesPrompt({ todoId, targetDate, timeStr, deltaMs });
                   return; // Pause execution for user confirmation
              }
          }
      }

      try {
          // Optimistic UI Update
          setTodos(todos.map(t => t.id === todoId ? { ...t, target_date: targetDate, target_time: timeStr } : t));
          // Database Sync
          await supabase.from("todos").update({ target_date: targetDate, target_time: timeStr }).eq("id", todoId);
      } catch (err) {
          console.error("Failed to move task:", err);
          fetchData(); // Reload on fail to fix UI
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Required to allow dropping
  };

  // --- ADDITIVE: BACKLOG DROP HANDLER ---
  const handleDropToBacklog = async (e: React.DragEvent) => {
      e.preventDefault();
      const todoId = e.dataTransfer.getData("todoId");
      if (!todoId) return;
      
      try {
          setTodos(todos.map(t => t.id === todoId ? { ...t, target_date: null, target_time: null } : t));
          await supabase.from("todos").update({ target_date: null, target_time: null }).eq("id", todoId);
      } catch (err) {
          console.error("Failed to move to backlog:", err);
          fetchData();
      }
  };

  // --- ADDITIVE: DEPENDENCY ENGINE CONFIRMATION ---
  const confirmShiftDependencies = async (shouldShift: boolean) => {
      if (!shiftDependenciesPrompt) return;
      const { todoId, targetDate, timeStr, deltaMs } = shiftDependenciesPrompt;
      
      try {
          // 1. Update primary task
          setTodos(prev => prev.map(t => t.id === todoId ? { ...t, target_date: targetDate, target_time: timeStr } : t));
          await supabase.from("todos").update({ target_date: targetDate, target_time: timeStr }).eq("id", todoId);
          
          // 2. Update dependencies if requested
          if (shouldShift) {
              const todo = todos.find(t => t.id === todoId);
              const oldDateObj = new Date(`${todo?.target_date}T${todo?.target_time}`);
              const dependentTasks = todos.filter(t => t.job_id === todo?.job_id && t.id !== todoId && t.target_date && t.target_time && new Date(`${t.target_date}T${t.target_time}`) >= oldDateObj);
              
              for (const dep of dependentTasks) {
                  const oldDepDate = new Date(`${dep.target_date}T${dep.target_time}`);
                  oldDepDate.setTime(oldDepDate.getTime() + deltaMs);
                  const newDepDateStr = oldDepDate.toISOString().split('T')[0];
                  const newDepTimeStr = oldDepDate.toTimeString().split(' ')[0];
                  
                  setTodos(prev => prev.map(t => t.id === dep.id ? { ...t, target_date: newDepDateStr, target_time: newDepTimeStr } : t));
                  await supabase.from("todos").update({ target_date: newDepDateStr, target_time: newDepTimeStr }).eq("id", dep.id);
              }
          }
      } catch (err) {
          console.error("Failed to shift dependencies:", err);
          fetchData();
      } finally {
          setShiftDependenciesPrompt(null);
      }
  };

  const activeTodos = todos.filter(t => !t.is_deleted);
  const trashedTodos = todos.filter(t => t.is_deleted);
  const pendingTodos = activeTodos.filter(t => !t.is_completed);
  const completedTodos = activeTodos.filter(t => t.is_completed);

  // --- ADDITIVE: BACKLOG TODOS ---
  const backlogTodos = pendingTodos.filter(t => !t.target_date || !t.target_time);

  // ============ NEW COMPUTED VALUES ============
  const todayStr = (() => {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().split('T')[0];
  })();
  const weekFromNowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().split('T')[0];
  })();
  const isOverdue = (t: any) => t.target_date && t.target_date < todayStr && !t.is_completed && !t.is_deleted;
  const overdueTodos = pendingTodos.filter(isOverdue);
  const todayTodos = pendingTodos.filter(t => t.target_date === todayStr);
  const thisWeekTodos = pendingTodos.filter(t => t.target_date && t.target_date >= todayStr && t.target_date <= weekFromNowStr);

  // Global search filter — matches task name, custom text, linked client, job number
  const matchesGlobalSearch = (t: any) => {
    if (!globalSearch.trim()) return true;
    const q = globalSearch.toLowerCase();
    return (
      (t.task || "").toLowerCase().includes(q) ||
      (t.jobs?.quotes?.customers?.company_name || "").toLowerCase().includes(q) ||
      (t.jobs?.title || "").toLowerCase().includes(q) ||
      String(t.jobs?.job_number || "").includes(q)
    );
  };

  // Searched derivations — used by the visible lists when a query is active
  const searchedPendingTodos = pendingTodos.filter(matchesGlobalSearch);
  const searchedTrashedTodos = trashedTodos.filter(matchesGlobalSearch);
  const searchedBacklogTodos = backlogTodos.filter(matchesGlobalSearch);

  // Bulk complete
  const handleBulkComplete = async () => {
    if (selectedFloorTaskIds.size === 0) return;
    const ids = Array.from(selectedFloorTaskIds);
    try {
      setTodos(todos.map(t => ids.includes(t.id) ? { ...t, is_completed: true } : t));
      const { error } = await supabase.from("todos").update({ is_completed: true }).in("id", ids);
      if (error) throw error;
      showToast("success", `✓ Completed ${ids.length} task${ids.length > 1 ? 's' : ''}`);
      setSelectedFloorTaskIds(new Set());
      fetchData();
    } catch (err) {
      console.error("Bulk complete failed:", err);
      showToast("error", "Could not complete tasks");
      fetchData();
    }
  };

  const toggleFloorSelect = (id: string) => {
    setSelectedFloorTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getSelectedJobDetails = () => {
      if (!selectedJobId) return null;
      const job = jobsList.find(j => j.id === selectedJobId);
      if (!job) return null;

      const items = job.quotes?.quote_items || [];
      let totalQty = 0;
      const breakdown = items.map((item: any) => {
          totalQty += (item.quantity || 0);
          const variants = item.quote_item_variants || [];
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
            if ((val as number) > 0) sizeStrs.push(`${key}:${val}`);
          }
          return { desc: item.description, qty: item.quantity, colors: Array.from(colors).join(', '), sizes: sizeStrs.join(' | ') };
      });
      return { totalQty, stage: job.stage, breakdown };
  };
  const jobDetails = getSelectedJobDetails();

  // --- CALENDAR LOGIC: DYNAMIC COMPACTION ---
  const getWeekDays = () => {
      const curr = new Date();
      const first = curr.getDate() - curr.getDay() + 1; 
      return Array.from({length: 7}).map((_, i) => {
          const d = new Date(curr.getTime());
          d.setDate(first + i);
          return d;
      });
  };
  const weekDays = getWeekDays();

  // Find the earliest and latest hours to compact the calendar
  const activeHours = useMemo(() => {
      // ADDITIVE: Forced 24-Hour View per user preference
      const hours = [];
      for (let i = 0; i < 24; i++) hours.push(i);
      return hours;
  }, []);

  const CALENDAR_MIN_HOUR = 0; // Lock to Midnight start

  const theme = {
      bgMain: isLightMode ? "bg-slate-50" : "bg-[#0f1115]",
      textMain: isLightMode ? "text-slate-900" : "text-slate-200",
      bgPanel: isLightMode ? "bg-white" : "bg-slate-950",
      bgSubPanel: isLightMode ? "bg-slate-50" : "bg-slate-900/50",
      border: isLightMode ? "border-slate-200" : "border-slate-800",
      textMuted: isLightMode ? "text-slate-500" : "text-[#686a6c]",
      textStrong: isLightMode ? "text-slate-900" : "text-white",
      inputBg: isLightMode ? "bg-white border-slate-300 text-slate-900 focus:border-sky-500" : "bg-black border-slate-700 text-white focus:border-sky-500",
  };

  const filteredSearchJobs = jobsList.filter(job => {
      const q = jobSearchTerm.toLowerCase();
      const jobName = (job.quotes?.customers?.company_name || job.title || "").toLowerCase();
      const jobNum = String(job.job_number || job.quote_id || "").toLowerCase();
      return jobName.includes(q) || jobNum.includes(q);
  });

  const scrollToTask = (time: string) => {
      if (!calendarContainerRef.current) return;
      const [h, m] = time.split(":");
const hour = parseInt(h, 10);
      const minutes = parseInt(m, 10);
const topPosition = ((hour - CALENDAR_MIN_HOUR) * PIXELS_PER_HOUR) + (minutes * PIXELS_PER_MINUTE);
calendarContainerRef.current.scrollTo({
          top: Math.max(0, topPosition - 100), 
          behavior: 'smooth'
      });
};

// ADDITIVE: Bulletproof Auto-Scroll to Current Time
useEffect(() => {
    if (activeTab === "calendar" && calendarContainerRef.current) {
        const executeScroll = () => {
            if (!calendarContainerRef.current) return;
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            
            // Calculate pixel position based on exact current hour and minute
            const topPosition = ((h - CALENDAR_MIN_HOUR) * PIXELS_PER_HOUR) + (m * PIXELS_PER_MINUTE);
            
            // Use 'auto' instead of 'smooth' so it instantly snaps to your exact time block on load
            calendarContainerRef.current.scrollTo({
                top: Math.max(0, topPosition - 200), // Offsets the scroll to put the current time directly in your line of sight
                behavior: 'auto' 
            });
        };

        // Fire immediately
        executeScroll();
        
        // Backup fire after DOM is 100% fully painted (fixes the 12:00 AM getting stuck bug)
        const fallbackTimer = setTimeout(executeScroll, 500);
        return () => clearTimeout(fallbackTimer);
    }
}, [activeTab, CALENDAR_MIN_HOUR]);

// ADDITIVE: Auto-scroll to current time when calendar opens or loads
useEffect(() => {
    if (activeTab === "calendar" && calendarContainerRef.current) {
        // Short timeout ensures the DOM has finished painting the full 24h height before scrolling
        setTimeout(() => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            
            // Calculate pixel position based on exact current hour and minute
            const topPosition = ((h - CALENDAR_MIN_HOUR) * PIXELS_PER_HOUR) + (m * PIXELS_PER_MINUTE);
            
            calendarContainerRef.current?.scrollTo({
                top: Math.max(0, topPosition - 200), // Offsets the scroll to put the current time directly in your line of sight
                behavior: 'smooth'
            });
        }, 300);
    }
}, [activeTab, CALENDAR_MIN_HOUR]);

  return (
    <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans flex flex-col selection:bg-sky-500 selection:text-white pb-20 transition-colors duration-300`}>
      
      {/* HEADER */}
      <div className={`border-b ${theme.border} ${theme.bgPanel} p-4 md:px-8 flex flex-col md:flex-row gap-4 justify-between items-center z-50 sticky top-0 shadow-sm transition-colors duration-300`}>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className={`text-2xl font-black uppercase tracking-tighter leading-none italic ${theme.textStrong}`}>YAYA <span className="text-sky-500">OPS</span></h1>
            <span className={`text-[9px] font-black ${theme.textMuted} uppercase tracking-widest`}>Master Action Tracker</span>
          </div>
          {/* SYNC STATUS */}
          <span
            className={`hidden sm:flex text-[8px] font-black uppercase tracking-widest items-center gap-1 px-2 py-1 rounded-full border ${
              syncStatus === 'live'
                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                : syncStatus === 'polling'
                  ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
                  : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
            }`}
            title={
              syncStatus === 'live' ? 'Realtime sync active — changes from CRM, Quotes, Shop Floor appear instantly' :
              syncStatus === 'polling' ? 'Realtime disconnected — polling every 45s' :
              'Connecting…'
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'live' ? 'bg-emerald-500 animate-pulse' : syncStatus === 'polling' ? 'bg-amber-500' : 'bg-slate-400 animate-pulse'}`}></span>
            {syncStatus === 'live' ? 'Live' : syncStatus === 'polling' ? 'Poll' : '...'}
          </span>
          <button onClick={() => {
              const newMode = !isLightMode;
              setIsLightMode(newMode);
              localStorage.setItem('yaya-theme', newMode ? 'light' : 'dark');
          }} className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
              {isLightMode ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>

        {/* GLOBAL SEARCH (center) */}
        <div className="relative w-full md:w-80 flex-shrink min-w-0 order-3 md:order-2">
          <input
            id="todos-global-search"
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search task, client, job #..."
            className={`w-full text-xs font-bold rounded-lg pl-9 pr-16 py-2 border outline-none transition-colors ${isLightMode ? 'bg-white border-slate-200 placeholder:text-slate-400 focus:border-sky-500' : 'bg-black/40 border-slate-700 placeholder:text-slate-500 focus:border-sky-500'}`}
          />
          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.textMuted}`}>🔍</span>
          {globalSearch ? (
            <button onClick={() => setGlobalSearch("")} className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black ${theme.textMuted} hover:text-red-500`}>✕</button>
          ) : (
            <kbd className={`hidden sm:block absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-mono px-1.5 py-0.5 rounded border ${isLightMode ? 'border-slate-300 text-slate-400 bg-slate-50' : 'border-slate-700 text-slate-500 bg-black/50'}`}>⌘K</kbd>
          )}
        </div>

        {/* TABS & DRAWER TOGGLES (right) */}
        <div className="flex items-center gap-3 order-2 md:order-3 flex-wrap">
            {activeTab === "calendar" && (
                <>
                    <button onClick={() => setIsBacklogOpen(!isBacklogOpen)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'bg-white border-slate-300 text-slate-700' : 'bg-black border-slate-700 text-slate-300'} hover:border-amber-500 hover:text-amber-500`}>
                        📥 Backlog ({backlogTodos.length})
                    </button>
                    <button onClick={() => setIsAgendaOpen(!isAgendaOpen)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'bg-white border-slate-300 text-slate-700' : 'bg-black border-slate-700 text-slate-300'} hover:border-sky-500 hover:text-sky-500`}>
                        ☰ Agenda
                    </button>
                </>
            )}
            <div className={`flex rounded-xl p-1 border ${theme.border} ${isLightMode ? 'bg-slate-100' : 'bg-black/40'}`}>
                <button onClick={() => setActiveTab("floor")} title="Today's Floor (T)" className={`px-3 lg:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${activeTab === 'floor' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/50' : `${theme.textMuted} hover:${theme.textStrong}`}`}>
                  📋 Floor
                  {todayTodos.length > 0 && <span className={`text-[8px] px-1 rounded ${activeTab === 'floor' ? 'bg-emerald-500/30' : 'bg-slate-500/30'}`}>{todayTodos.length}</span>}
                </button>
                <button onClick={() => setActiveTab("calendar")} title="Calendar (C)" className={`px-3 lg:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'calendar' ? 'bg-fuchsia-500/20 text-fuchsia-500 border border-fuchsia-500/50' : `${theme.textMuted} hover:${theme.textStrong}`}`}>
                  📅 Calendar
                </button>
                <button onClick={() => setActiveTab("list")} title="Task List (L)" className={`px-3 lg:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'list' ? 'bg-sky-500/20 text-sky-500 border border-sky-500/50' : `${theme.textMuted} hover:${theme.textStrong}`}`}>
                  📑 List
                </button>
                <button onClick={() => setActiveTab("trash")} title="Trash" className={`px-3 lg:px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${activeTab === 'trash' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : `${theme.textMuted} hover:${theme.textStrong}`}`}>
                  🗑️ Trash
                  {trashedTodos.length > 0 && <span className={`text-[8px] px-1 rounded ${activeTab === 'trash' ? 'bg-red-500/30' : 'bg-slate-500/30'}`}>{trashedTodos.length}</span>}
                </button>
            </div>
        </div>
      </div>

      <div className="flex-grow max-w-[1600px] w-full mx-auto p-4 md:p-8 flex flex-col gap-6 relative overflow-hidden">

        {/* ============ PIPELINE SUMMARY TILES ============ */}
        {!isLoading && activeTab !== "trash" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            <button
              onClick={() => { setActiveTab("floor"); }}
              className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                activeTab === "floor" ? 'ring-2 ring-emerald-500' : ''
              } ${isLightMode ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-900/50 border-white/10 hover:border-white/20'}`}
            >
              <p className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>Today</p>
              <p className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-500 mt-1">{todayTodos.length}</p>
              <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${theme.textMuted}`}>tasks scheduled</p>
            </button>
            <button
              onClick={() => setActiveTab("calendar")}
              className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                activeTab === "calendar" ? 'ring-2 ring-fuchsia-500' : ''
              } ${isLightMode ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-900/50 border-white/10 hover:border-white/20'}`}
            >
              <p className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>This Week</p>
              <p className="text-2xl md:text-3xl font-black tracking-tighter text-fuchsia-500 mt-1">{thisWeekTodos.length}</p>
              <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${theme.textMuted}`}>next 7 days</p>
            </button>
            <button
              onClick={() => { if (overdueTodos.length > 0) { setActiveTab("calendar"); showToast("info", `${overdueTodos.length} overdue task${overdueTodos.length > 1 ? 's' : ''} — shown in red on the calendar`); } }}
              disabled={overdueTodos.length === 0}
              className={`p-4 rounded-2xl border text-left transition-all ${overdueTodos.length > 0 ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer' : 'cursor-default opacity-60'} ${
                overdueTodos.length > 0
                  ? (isLightMode ? 'bg-red-50 border-red-200' : 'bg-red-950/20 border-red-500/30')
                  : (isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/10')
              }`}
            >
              <p className={`text-[9px] font-black uppercase tracking-widest ${overdueTodos.length > 0 ? 'text-red-500' : theme.textMuted}`}>Overdue</p>
              <p className={`text-2xl md:text-3xl font-black tracking-tighter mt-1 ${overdueTodos.length > 0 ? 'text-red-500' : (isLightMode ? 'text-slate-300' : 'text-slate-600')}`}>{overdueTodos.length}</p>
              <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${theme.textMuted}`}>needs attention</p>
            </button>
            <button
              onClick={() => { setActiveTab("calendar"); setIsBacklogOpen(true); }}
              className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isLightMode ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-900/50 border-white/10 hover:border-white/20'}`}
            >
              <p className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>Backlog</p>
              <p className="text-2xl md:text-3xl font-black tracking-tighter text-amber-500 mt-1">{backlogTodos.length}</p>
              <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${theme.textMuted}`}>unscheduled</p>
            </button>
          </div>
        )}

        {/* Active-search banner */}
        {globalSearch && (
          <div className={`flex items-center justify-between px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'}`}>
            <span>🔍 Filtering by &ldquo;{globalSearch}&rdquo; — showing {searchedPendingTodos.length} of {pendingTodos.length} active tasks</span>
            <button onClick={() => setGlobalSearch("")} className={`underline hover:text-red-500 transition-colors`}>Clear</button>
          </div>
        )}
        
        {/* ADDITIVE: UNSCHEDULED BACKLOG SIDEBAR */}
        {isBacklogOpen && activeTab === "calendar" && (
            <div 
                className={`absolute top-8 left-8 bottom-8 w-80 ${theme.bgPanel} border ${theme.border} rounded-2xl shadow-2xl z-40 flex flex-col animate-in slide-in-from-left-8`}
                onDragOver={handleDragOver}
                onDrop={handleDropToBacklog}
            >
                <div className={`p-4 border-b ${theme.border} flex justify-between items-center`}>
                    <h2 className={`text-sm font-black uppercase tracking-widest ${theme.textStrong}`}>Unscheduled Backlog</h2>
                    <button onClick={() => setIsBacklogOpen(false)} className={`text-[10px] font-black uppercase ${theme.textMuted} hover:text-red-500`}>Close ✕</button>
                </div>
                <div className={`p-2 border-b ${theme.border} bg-amber-500/10 text-amber-500 text-[9px] font-bold uppercase tracking-widest text-center`}>
                    Drag items to calendar to schedule
                </div>
                <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                    {searchedBacklogTodos.map(todo => {
                        const clientName = todo.jobs ? (todo.jobs.quotes?.customers?.company_name || todo.jobs.title) : "";
                        const colorClass = getTaskColorClass(todo.task);
                        return (
                            <div 
                                key={todo.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, todo.id)}
                                className={`p-3 rounded-xl border-2 ${colorClass} ${isLightMode ? 'bg-opacity-10' : 'bg-opacity-20'} shadow-sm group cursor-grab active:cursor-grabbing`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${colorClass.split(' ')[0]}`}>{todo.task}</span>
                                    <button onClick={() => moveToTrash(todo.id)} className="w-5 h-5 rounded bg-red-500 hover:bg-red-400 text-white flex items-center justify-center text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">×</button>
                                </div>
                                {todo.jobs ? (
                                    <div className="flex flex-col gap-1">
                                        <span className={`text-[10px] font-black uppercase truncate ${theme.textStrong}`}>#{todo.jobs.job_number} {clientName}</span>
                                        <span className={`text-[8.5px] font-bold uppercase text-emerald-600 dark:text-emerald-400`}>
                                            {todo.duration_minutes || 60} MINS
                                        </span>
                                    </div>
                                ) : (
                                    <span className={`text-[10px] font-black ${theme.textMuted}`}>General Task • {todo.duration_minutes || 60} MINS</span>
                                )}
                            </div>
                        )
                    })}
                    {searchedBacklogTodos.length === 0 && (
                        <div className={`text-center p-8 font-black uppercase tracking-widest text-[9px] ${theme.textMuted}`}>{globalSearch ? `No backlog items match "${globalSearch}"` : "Backlog is empty."}</div>
                    )}
                </div>
            </div>
        )}

        {/* GHOST MENU AGENDA SIDEBAR */}
        {isAgendaOpen && activeTab === "calendar" && (
            <div className={`absolute top-8 right-8 bottom-8 w-80 ${theme.bgPanel} border ${theme.border} rounded-2xl shadow-2xl z-40 flex flex-col animate-in slide-in-from-right-8`}>
                <div className={`p-4 border-b ${theme.border} flex justify-between items-center`}>
                    <h2 className={`text-sm font-black uppercase tracking-widest ${theme.textStrong}`}>Weekly Agenda</h2>
                    <button onClick={() => setIsAgendaOpen(false)} className={`text-[10px] font-black uppercase ${theme.textMuted} hover:text-red-500`}>Close ✕</button>
                </div>
                <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
                    {weekDays.map(date => {
                        const dateStr = date.toISOString().split('T')[0];
                        const dayTodos = searchedPendingTodos.filter(t => t.target_date === dateStr).sort((a,b) => a.target_time.localeCompare(b.target_time));
                        
                        if (dayTodos.length === 0) return null;

                        return (
                            <div key={dateStr} className="flex flex-col gap-3">
                                <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] border-b ${theme.border} pb-1 ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}>
                                    {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                </h3>
                                {dayTodos.map(todo => {
                                    const clientName = todo.jobs ? (todo.jobs.quotes?.customers?.company_name || todo.jobs.title) : "";
                                    return (
                                        <div key={todo.id} className={`p-3 rounded-xl border ${theme.border} ${isLightMode ? 'bg-slate-50' : 'bg-black/40'} shadow-sm group`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${getTaskColorClass(todo.task).split(' ')[1]}`}>{todo.task}</span>
                                                <span className={`text-[9px] font-bold ${theme.textMuted}`}>{formatToAMPM(todo.target_time)}</span>
                                            </div>
                                            {todo.jobs && <span className={`text-[10px] font-black uppercase truncate block mb-1 ${theme.textStrong}`}>#{todo.jobs.job_number} {clientName}</span>}
                                            
                                            <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => scrollToTask(todo.target_time)} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${isLightMode ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'}`}>
                                                    📅 Find
                                                </button>
                                                {todo.jobs && (
                                                    <Link href="/shop-floor" className={`flex-1 py-1.5 rounded-lg text-[9px] text-center font-black uppercase tracking-widest border transition-colors ${isLightMode ? 'bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100' : 'bg-sky-900/30 border-sky-800/50 text-sky-400 hover:bg-sky-800/50'}`}>
                                                        ↗️ Floor
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

        {/* ADD TASK PANEL */}
        {activeTab !== "trash" && activeTab !== "floor" && (
            <div className={`w-full ${theme.bgPanel} border ${theme.border} rounded-[2rem] p-6 md:p-8 shadow-xl relative overflow-hidden transition-colors`}>
                <div className="absolute top-0 right-0 bg-sky-500/20 text-sky-500 px-4 py-1.5 rounded-bl-xl text-[10px] font-black uppercase tracking-widest border-b border-l border-sky-500/30">
                    New Action Item
                </div>
                
                <form onSubmit={handleAddTodo} className="flex flex-col gap-6 mt-4">
                    <div className="flex flex-col xl:flex-row gap-6 items-start w-full">
                        
                        {/* Left Side: Job Selection & Details */}
                        <div className="flex-1 w-full flex flex-col gap-3" ref={searchDropdownRef}>
                            <div className="relative">
                                <label className={`text-[10px] font-black ${theme.textMuted} uppercase tracking-widest block mb-2`}>1. Select Target Job</label>
                                
                                <input 
                                    type="text"
                                    value={jobSearchTerm}
                                    onChange={(e) => {
                                        setJobSearchTerm(e.target.value);
                                        setIsJobDropdownOpen(true);
                                        if (e.target.value === "") setSelectedJobId(""); 
                                    }}
                                    onFocus={() => setIsJobDropdownOpen(true)}
                                    placeholder="Search by Job # or Client Name..."
                                    className={`w-full rounded-xl px-5 py-4 text-sm font-bold outline-none transition-colors shadow-inner ${theme.inputBg}`}
                                />
                                
                                {isJobDropdownOpen && (
                                    <div className={`absolute top-full left-0 w-full mt-2 border rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                                        <div 
                                            onClick={() => { setSelectedJobId(""); setJobSearchTerm(""); setIsJobDropdownOpen(false); }}
                                            className={`p-4 border-b last:border-0 cursor-pointer transition-colors text-xs font-black uppercase tracking-widest ${isLightMode ? 'border-slate-100 hover:bg-slate-50 text-slate-500' : 'border-slate-700 hover:bg-slate-700 text-slate-400'}`}
                                        >
                                            -- General Shop Task (No Linked Job) --
                                        </div>
                                        {filteredSearchJobs.map(job => (
                                            <div 
                                                key={job.id} 
                                                onClick={() => {
                                                    setSelectedJobId(job.id);
                                                    setJobSearchTerm(`${job.job_number ? `#${job.job_number}` : `QUOTE ID: ${job.quote_id?.split('-')[0].toUpperCase()}`} - ${job.quotes?.customers?.company_name || job.title}`);
                                                    setIsJobDropdownOpen(false);
                                                }}
                                                className={`p-4 border-b last:border-0 cursor-pointer transition-colors flex justify-between items-center ${isLightMode ? 'border-slate-100 hover:bg-sky-50' : 'border-slate-700 hover:bg-sky-900/30'}`}
                                            >
                                                <span className={`text-xs font-black uppercase tracking-tighter ${theme.textStrong}`}>
                                                    {job.job_number ? `#${job.job_number}` : `QUOTE ID: ${job.quote_id?.split('-')[0].toUpperCase()}`} - {job.quotes?.customers?.company_name || job.title}
                                                </span>
                                                <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${isLightMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                                                    {job.stage}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* ADDITIVE: Draggable Jobs List based on Action */}
                            {(() => {
                                const matchedColumn = JOB_COLUMNS.find(col => col.taskPreset === newTask);
                                if (!matchedColumn) return null;
                                const actionJobs = jobsList.filter(j => matchedColumn.stages.includes(j.stage));
                                if (actionJobs.length === 0) return null;

                                return (
                                    <div className={`mt-2 p-4 rounded-xl border ${theme.border} ${theme.bgSubPanel} animate-in fade-in slide-in-from-top-2`}>
                                        <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${matchedColumn.color.split(' ')[0]}`}>
                                            Jobs Ready For: {newTask} (Drag to Calendar)
                                        </h3>
                                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                            {actionJobs.map(job => {
                                                const qty = getJobTotalQty(job);
                                                const duration = qty > 0 ? qty : 60;
                                                return (
                                                    <div 
                                                        key={job.id}
                                                        draggable
                                                        onClick={() => setPreviewJobId(job.id)}
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.setData("newJobTodo", JSON.stringify({ jobId: job.id, task: newTask, duration }));
                                                        }}
                                                        className={`p-3 border rounded-lg cursor-grab active:cursor-grabbing hover:border-sky-500 transition-colors shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-black/40 border-slate-700'}`}
                                                    >
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className={`text-[10px] font-black uppercase truncate mr-2 ${theme.textStrong}`}>
                                                                {job.job_number ? `#${job.job_number}` : 'QUOTE'} - {job.quotes?.customers?.company_name || job.title}
                                                            </span>
                                                            <span className="text-[9px] font-black text-emerald-500 shrink-0">{qty} PCS</span>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-inherit">
                                                            <div className={`text-[8px] font-bold uppercase ${theme.textMuted}`}>
                                                                Est. Duration: {duration} mins
                                                            </div>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); openQuickSchedule(job, newTask, duration); }}
                                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all hover:scale-105 shadow-md bg-sky-500 hover:bg-sky-400 text-white flex items-center gap-1`}
                                                            >
                                                                ⚡ Add to Floor
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* DYNAMIC JOB DETAILS VISUALIZER */}
                            {jobDetails && (
                                <div className={`${theme.bgSubPanel} border border-sky-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2`}>
                                    <div className={`flex justify-between items-center mb-3 border-b ${theme.border} pb-3`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest">Job Breakdown</span>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${isLightMode ? 'bg-white border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                                Status: {jobDetails.stage}
                                            </span>
                                        </div>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded border ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`}>{jobDetails.totalQty} Total PCS</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {jobDetails.breakdown.map((item: any, idx: number) => {
                                            const firstColor = item.colors.split(',')[0].trim();
                                            const hex = COLOR_HEX_MAP[firstColor] || '#333';
                                            return (
                                                <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg border ${isLightMode ? 'bg-white border-slate-200' : 'bg-black/40 border-white/5'}`}>
                                                    <div className="w-6 h-6 rounded-full border border-slate-400/20 shrink-0" style={{ backgroundColor: hex }}></div>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className={`text-[10px] font-black uppercase truncate ${theme.textStrong}`}>{item.desc}</span>
                                                        <span className={`text-[8px] font-bold uppercase truncate ${theme.textMuted}`}>{item.colors} | {item.sizes}</span>
                                                    </div>
                                                    <span className="text-xs font-black text-emerald-500 shrink-0">{item.qty}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Side: Task & Schedule */}
                        <div className="flex-[1.5] w-full flex flex-col gap-6">
                            
                            {/* Task Action Buttons */}
                            <div>
                                <label className={`text-[10px] font-black ${theme.textMuted} uppercase tracking-widest block mb-2`}>2. Define Task Action</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {["To Purchase", "To Print", "To Press", "To Package", "To Deliver", "To Bill", "Artwork"].map(action => (
                                        <button 
                                            key={action} type="button" onClick={() => setNewTask(action)}
                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors border ${newTask === action ? getTaskColorClass(action) : isLightMode ? 'bg-slate-100 text-slate-500 border-slate-300 hover:border-sky-500' : 'bg-black/40 text-slate-400 border-slate-800 hover:border-slate-500'}`}
                                        >
                                            {action}
                                        </button>
                                    ))}
                                    <button 
                                        type="button" onClick={() => setNewTask("")}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors border ${!["To Purchase", "To Print", "To Press", "To Package", "To Deliver", "To Bill", "Artwork"].includes(newTask) && newTask !== "" ? 'bg-sky-500/20 text-sky-500 border-sky-500/50' : isLightMode ? 'bg-slate-100 text-slate-500 border-slate-300 hover:border-sky-500' : 'bg-black/40 text-slate-400 border-slate-800 hover:border-slate-500'}`}
                                    >
                                        Custom Action
                                    </button>
                                </div>

                                <input 
                                    type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)}
                                    placeholder="Type specific action..."
                                    className={`w-full rounded-xl px-5 py-4 text-lg font-black outline-none transition-colors shadow-inner border ${theme.inputBg}`}
                                    required
                                />
                            </div>

                            {/* Prominent Scheduling Block */}
                            <div className="flex flex-col sm:flex-row gap-4 w-full">
                                {/* SINGLE BUTTON DATE PICKER */}
                                <div className="w-full sm:w-1/2 relative">
                                    <label className={`text-[10px] font-black ${theme.textMuted} uppercase tracking-widest block mb-2`}>3. Schedule Date</label>
                                    <input 
                                        type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                                        className={`w-full rounded-xl px-5 py-4 text-sm font-bold outline-none transition-colors shadow-inner cursor-pointer border relative z-10 ${theme.inputBg}`}
                                        style={{ colorScheme: isLightMode ? 'light' : 'dark' }}
                                    />
                                    {/* The visual facade to make it look like a nice button */}
                                    <div className={`absolute inset-0 top-[22px] flex items-center justify-between px-5 rounded-xl pointer-events-none ${targetDate ? 'border-2 border-emerald-500' : 'border border-dashed ' + theme.border} ${isLightMode ? 'bg-white' : 'bg-black'}`}>
                                        <span className={`font-black text-sm ${targetDate ? 'text-emerald-500' : theme.textMuted}`}>{targetDate || "Select Date..."}</span>
                                        <span className="text-xl">📅</span>
                                    </div>
                                </div>

                                {/* NATIVE TIME PICKER FOR UNRESTRICTED SLOTS */}
                                <div className="w-full sm:w-1/2 relative">
                                    <label className={`text-[10px] font-black ${theme.textMuted} uppercase tracking-widest block mb-2`}>4. Time Slot (Open)</label>
                                    <input 
                                        type="time" value={targetTime} onChange={(e) => setTargetTime(e.target.value)}
                                        className={`w-full rounded-xl px-5 py-4 text-sm font-bold outline-none transition-colors shadow-inner cursor-pointer border relative z-10 ${theme.inputBg}`}
                                        style={{ colorScheme: isLightMode ? 'light' : 'dark' }}
                                    />
                                    {/* Visual facade */}
                                    <div className={`absolute inset-0 top-[22px] flex items-center justify-between px-5 rounded-xl pointer-events-none ${targetTime ? 'border-2 border-emerald-500' : 'border border-dashed ' + theme.border} ${isLightMode ? 'bg-white' : 'bg-black'}`}>
                                        <span className={`font-black text-sm ${targetTime ? 'text-emerald-500' : theme.textMuted}`}>{targetTime ? formatToAMPM(targetTime) : "Any Time..."}</span>
                                        <span className="text-xl">⏰</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Duration & End Time Visualizer */}
                            {selectedJobId && (newTask.includes("Press") || newTask.includes("Print")) && targetTime && (
                                <div className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg flex justify-between items-center">
                                    <span>AUTO-CALCULATED DURATION: {calculatedDuration} MINS</span>
                                    <span>EST. COMPLETION: {calculateEndTime(targetTime, calculatedDuration)}</span>
                                </div>
                            )}

                            <div className="flex justify-end items-center gap-3 mt-2">
                                {!targetDate && !targetTime && newTask.trim() && !isBacklogSubmit && (
                                    <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse text-right hidden lg:block">
                                        * Leaving Date/Time blank will auto-schedule
                                    </p>
                                )}
                                {/* ADDITIVE: DUAL SUBMIT BUTTONS FOR BACKLOG */}
                                <button 
                                    type="submit" 
                                    onClick={() => setIsBacklogSubmit(true)}
                                    disabled={isSubmitting || !newTask.trim()}
                                    className={`w-full sm:w-auto px-6 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${isSubmitting || !newTask.trim() ? 'bg-slate-300 text-slate-500 cursor-not-allowed border-none dark:bg-slate-800 dark:text-slate-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 shadow-md hover:-translate-y-1'}`}
                                >
                                    📥 Add to Backlog
                                </button>
                                <button 
                                    type="submit" 
                                    onClick={() => setIsBacklogSubmit(false)}
                                    disabled={isSubmitting || !newTask.trim()}
                                    className={`w-full sm:w-auto px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${isSubmitting || !newTask.trim() ? 'bg-slate-300 text-slate-500 cursor-not-allowed border-none dark:bg-slate-800 dark:text-slate-600' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:-translate-y-1'}`}
                                >
                                    {isSubmitting ? 'Saving...' : '+ Add Action'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        )}

        {/* --- MAIN CONTENT SWITCHER --- */}
        {isLoading ? (
            <div className="flex justify-center p-10 text-sky-500 font-black uppercase tracking-widest animate-pulse">Loading Operations Data...</div>
        ) : (
            <>
                {/* TODAY'S FLOOR MANIFEST VIEW */}
                {activeTab === "floor" && (() => {
                    const now = new Date();
                    const tzOffset = now.getTimezoneOffset() * 60000;
                    const todayStr = (new Date(now.getTime() - tzOffset)).toISOString().split('T')[0];
                    
                    const todaysTasks = searchedPendingTodos.filter(t => t.target_date === todayStr).sort((a, b) => (a.target_time || "24:00").localeCompare(b.target_time || "24:00"));
                    const selectedTask = todaysTasks.find(t => t.id === floorSelectedTaskId) || todaysTasks[0];

                    return (
                        <div className="w-full flex flex-col lg:flex-row gap-6 animate-in fade-in min-h-[calc(100vh-140px)] print:min-h-0 print:block">
                            
                            {/* LEFT: Task Timeline (Hidden on Print) */}
                            <div className={`w-full lg:w-[400px] shrink-0 flex flex-col gap-4 ${theme.bgPanel} border ${theme.border} rounded-[2rem] p-5 shadow-sm overflow-y-auto custom-scrollbar print:hidden`}>
                                <div className="flex justify-between items-center border-b border-inherit pb-4 mb-2 shrink-0">
                                    <h2 className={`text-lg font-black uppercase tracking-tighter ${theme.textStrong}`}>Today's Agenda</h2>
                                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 px-3 py-1.5 rounded-lg">{todaysTasks.length} Tasks</span>
                                </div>

                                {/* BULK-COMPLETE BAR — appears when selections exist */}
                                {selectedFloorTaskIds.size > 0 && (
                                    <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border animate-in slide-in-from-top-2 ${isLightMode ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                                        <span className={`text-[10px] font-black uppercase tracking-widest text-emerald-500`}>
                                            {selectedFloorTaskIds.size} selected
                                        </span>
                                        <div className="flex gap-2">
                                            <button onClick={() => setSelectedFloorTaskIds(new Set())} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border transition-colors ${isLightMode ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>Clear</button>
                                            <button onClick={handleBulkComplete} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all">✓ Complete All</button>
                                        </div>
                                    </div>
                                )}

                                {todaysTasks.length === 0 ? (
                                    <div className="text-center p-8 text-[10px] font-black uppercase tracking-widest text-slate-400 border-2 border-dashed border-inherit rounded-2xl mt-4">{globalSearch ? `No today tasks match "${globalSearch}"` : "No tasks scheduled for today."}</div>
                                ) : (
                                    todaysTasks.map(t => {
                                        const isSelected = selectedTask?.id === t.id;
                                        const isChecked = selectedFloorTaskIds.has(t.id);
                                        const colorClass = getTaskColorClass(t.task);
                                        const clientName = t.jobs ? (t.jobs.quotes?.customers?.company_name || t.jobs.title) : "General Task";
                                        return (
                                            <div
                                                key={t.id}
                                                className={`text-left p-5 rounded-2xl transition-all border-2 flex flex-col gap-2 cursor-pointer ${isSelected ? 'border-sky-500 shadow-md ' + (isLightMode ? 'bg-sky-50' : 'bg-sky-900/20') : isChecked ? 'border-emerald-500 ' + (isLightMode ? 'bg-emerald-50/50' : 'bg-emerald-900/10') : `border-transparent hover:border-slate-300 dark:hover:border-slate-700 ${isLightMode ? 'bg-slate-50' : 'bg-black/40'}`}`}
                                                onClick={() => setFloorSelectedTaskId(t.id)}
                                            >
                                                <div className="flex justify-between items-center w-full mb-1 gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {/* Bulk-select checkbox */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleFloorSelect(t.id); }}
                                                            className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] font-black transition-colors ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : (isLightMode ? 'border-slate-300 hover:border-emerald-500' : 'border-slate-600 hover:border-emerald-500')}`}
                                                            title="Select for bulk action"
                                                        >
                                                            {isChecked ? '✓' : ''}
                                                        </button>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${colorClass}`}>{t.task}</span>
                                                    </div>
                                                    <span className={`text-[12px] font-black ${theme.textMuted}`}>
                                                        {t.target_time ? formatToAMPM(t.target_time) : 'Any Time'}
                                                    </span>
                                                </div>
                                                <span className={`text-sm font-black uppercase truncate w-full ${theme.textStrong}`}>
                                                    {t.jobs?.job_number ? `#${t.jobs.job_number} ` : ''}{clientName}
                                                </span>
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.textMuted}`}>Est. {t.duration_minutes || 60} MINS</span>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            {/* RIGHT: Manifest PDF View (Takes over screen on print) */}
                            <div className={`flex-1 flex flex-col ${theme.bgPanel} border ${theme.border} rounded-[2rem] p-6 lg:p-10 shadow-xl overflow-hidden print:block print:fixed print:inset-0 print:z-[9999] print:border-none print:shadow-none print:bg-white print:text-black print:rounded-none print:p-8`}>
                                {selectedTask ? (() => {
                                    const clientName = selectedTask.jobs ? (selectedTask.jobs.quotes?.customers?.company_name || selectedTask.jobs.title) : "General Task";
                                    const job = selectedTask.jobs;
                                    return (
                                        <>
                                            {/* Action Bar / Print Header */}
                                            <div className="flex justify-between items-start border-b border-inherit pb-6 mb-6 shrink-0 print:border-black print:pb-4">
                                                <div>
                                                    <div className="hidden print:block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Daily Print Manifest • {new Date().toLocaleDateString()}</div>
                                                    <h1 className={`text-4xl font-black uppercase tracking-tighter leading-none mb-3 print:text-black ${theme.textStrong}`}>{selectedTask.task}</h1>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-sm font-bold uppercase tracking-widest print:text-black ${theme.textMuted}`}>{selectedTask.target_time ? formatToAMPM(selectedTask.target_time) : 'Unscheduled Time'}</span>
                                                        <span className="text-sm font-bold text-emerald-500 print:text-black">• {selectedTask.duration_minutes || 60} MINS ALLOCATED</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 print:hidden">
                                                    <button onClick={() => window.print()} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'} flex items-center gap-2 shadow-sm`}>
                                                        🖨️ Print Manifest
                                                    </button>
                                                    <button onClick={() => handleCheckClick(selectedTask)} className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30 flex items-center gap-2">
                                                        ✓ Complete
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Job Details Area */}
                                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6 print:overflow-visible print:pr-0">
                                                <div className={`p-6 rounded-2xl border print:border-black print:border-2 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-slate-800'}`}>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-sky-500 mb-2 print:text-black">Client / Order Target</div>
                                                    <div className={`text-2xl md:text-3xl font-black uppercase print:text-black ${theme.textStrong}`}>{clientName}</div>
                                                    {job && <div className={`text-xs font-black uppercase tracking-widest mt-2 print:text-black ${theme.textMuted}`}>Job #{job.job_number} • Quote: {job.quote_id?.split('-')[0].toUpperCase()} • Status: {job.stage}</div>}
                                                </div>

                                                {job?.quotes?.quote_items && job.quotes.quote_items.length > 0 ? (
                                                    <div className="flex flex-col gap-3">
                                                        <h3 className={`text-[10px] font-black uppercase tracking-widest print:text-black ${theme.textMuted}`}>Production Breakdown</h3>
                                                        {job.quotes.quote_items.map((item: any, idx: number) => {
                                                            const variants = item.quote_item_variants || [];
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
                                                            const sizeStrs = [];
                                                            for (const [key, val] of Object.entries(totals)) {
                                                                if ((val as number) > 0) sizeStrs.push(`${key}:${val}`);
                                                            }
                                                            const firstColor = Array.from(colors)[0] || "Black";
                                                            const hex = COLOR_HEX_MAP[firstColor] || '#333';

                                                            return (
                                                                <div key={idx} className={`flex flex-col md:flex-row items-start md:items-center gap-4 p-5 rounded-2xl border print:border-black print:border-b-2 print:rounded-none print:break-inside-avoid ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
                                                                    
                                                                    {/* Checkbox for physical printing */}
                                                                    <div className="hidden print:block w-8 h-8 border-2 border-black rounded-md shrink-0"></div>

                                                                    {/* Digital Icon */}
                                                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border print:hidden ${isLightMode ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400'}`}>
                                                                        {renderGarmentIcon(item.description, isLightMode, "w-8 h-8")}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-3 mb-2">
                                                                            <div className="w-5 h-5 rounded-full border border-slate-400/30 print:border-black print:border-2 shrink-0 shadow-inner" style={{ backgroundColor: hex }}></div>
                                                                            <span className={`text-lg font-black uppercase truncate print:text-black ${theme.textStrong}`}>{item.description}</span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                                            {sizeStrs.map(s => {
                                                                                const [size, qty] = s.split(':');
                                                                                return (
                                                                                    <div key={s} className={`flex items-center justify-center px-2 py-1.5 rounded-lg border print:border-black print:bg-white print:text-black ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/80 border-slate-700'}`}>
                                                                                        <span className={`text-[11px] font-black mr-2 print:text-black ${theme.textMuted}`}>{size}</span>
                                                                                        <span className={`text-[12px] font-black print:text-black ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}>{qty}</span>
                                                                                    </div>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>

                                                                    <div className={`flex items-center justify-center min-w-[100px] shrink-0 md:pl-6 md:border-l print:border-black ${theme.border}`}>
                                                                        <span className="text-4xl font-black text-emerald-500 print:text-black leading-none mr-1">{item.quantity}</span>
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 print:text-black mt-3">PCS</span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-center p-8 border-2 border-dashed border-inherit rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 print:border-black print:text-black">
                                                        No specific items listed for this task.
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    );
                                })() : (
                                    <div className="flex-1 flex items-center justify-center flex-col text-center opacity-50 print:hidden">
                                        <span className="text-6xl mb-6">📋</span>
                                        <h2 className={`text-2xl font-black uppercase tracking-widest ${theme.textStrong}`}>Manifest Empty</h2>
                                        <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${theme.textMuted}`}>No tasks selected or scheduled for today.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* NEW HORIZONTAL COLUMN LIST VIEW */}
                {activeTab === "list" && (
                    <div className="flex overflow-x-auto gap-6 pb-6 custom-scrollbar items-start w-full snap-x">
                        
                        {/* COLUMN 1: GENERAL PENDING TASKS */}
                        <div className={`w-[320px] shrink-0 snap-start rounded-[2rem] p-5 border shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-white/5'}`}>
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${theme.textMuted}`}>Pending Actions (General)</h3>
                            <div className="flex flex-col gap-3">
                                {searchedPendingTodos.filter(t => !t.job_id).map(todo => (
                                    <div key={todo.id} className={`group ${theme.bgPanel} border ${theme.border} rounded-2xl p-4 shadow-sm hover:border-sky-500 transition-colors`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`px-2 py-1 rounded border text-[9px] font-black uppercase tracking-widest ${getTaskColorClass(todo.task)}`}>{todo.task}</span>
                                            <button onClick={() => toggleTodoStatus(todo.id, todo.is_completed)} className={`w-6 h-6 rounded-md border ${theme.border} hover:bg-emerald-500 hover:border-emerald-500 hover:text-white flex items-center justify-center transition-colors text-[10px]`} title="Complete">✓</button>
                                        </div>
                                        {todo.target_date && (
                                            <div className="text-[9px] font-black text-amber-500 tracking-widest bg-amber-500/10 px-2 py-1 rounded inline-block mt-2">
                                                🗓 {todo.target_date} {todo.target_time ? `@ ${formatToAMPM(todo.target_time)}` : ''}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {searchedPendingTodos.filter(t => !t.job_id).length === 0 && (
                                    <div className="text-center p-6 border-2 border-dashed border-inherit rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-400">No General Tasks</div>
                                )}
                            </div>
                        </div>

                        {/* COLUMNS 2+: JOBS SORTED BY PRODUCTION STAGE */}
                        {JOB_COLUMNS.map(col => {
                            const columnJobs = jobsList.filter(j => col.stages.includes(j.stage));
                            
                            return (
                                <div key={col.id} className={`w-[320px] shrink-0 snap-start rounded-[2rem] p-5 border shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-white/5'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${col.color.split(' ')[0]}`}>{col.label}</h3>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${col.bg} ${col.color}`}>{columnJobs.length}</span>
                                    </div>
                                    
                                    <div className="flex flex-col gap-4">
                                        {columnJobs.map(job => {
                                            const jobTodos = searchedPendingTodos.filter(t => t.job_id === job.id);
                                            
                                            return (
                                                <div key={job.id} onClick={() => setPreviewJobId(job.id)} className={`flex flex-col ${theme.bgPanel} border ${theme.border} rounded-[1.5rem] p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer`}>
                                                    
                                                    {/* Job Header */}
                                                    <div className="flex justify-between items-start mb-3 z-10">
                                                        <div className="flex flex-col w-full min-w-0">
                                                            <div className="flex items-center justify-between gap-2 mb-1 w-full">
                                                                <span className={`text-xs font-black uppercase truncate ${theme.textStrong}`}>
                                                                    {job.job_number ? `#${job.job_number}` : `QUOTE: ${job.quote_id?.split('-')[0].toUpperCase()}`}
                                                                </span>
                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border whitespace-nowrap shrink-0 ${isLightMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                                                    {job.stage}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[10px] font-bold truncate ${theme.textMuted}`}>{job.quotes?.customers?.company_name}</span>
                                                        </div>
                                                    </div>

                                                    {/* Job Breakdown Items */}
                                                    <div className="flex flex-col gap-1 mb-4 z-10 border-l-2 border-emerald-500 pl-2">
                                                        {job.quotes?.quote_items?.map((item: any, i: number) => (
                                                            <span key={i} className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase truncate">
                                                                {item.quantity}x {item.description}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {/* Render Scheduled Todos if they exist for this job */}
                                                    {jobTodos.length > 0 && (
                                                        <div className="flex flex-col gap-2 mb-4 z-10">
                                                            {jobTodos.map(t => (
                                                                <div key={t.id} className={`text-[9px] font-black border px-2 py-1.5 rounded-lg flex justify-between items-center group/task ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                                                    <span className="truncate pr-2"><span className={`${col.color.split(' ')[0]}`}>{t.task}</span> • 🗓 {t.target_date}</span>
                                                                    <div className="flex gap-1 shrink-0">
                                                                        <Link href="/shop-floor" className="w-5 h-5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/20 hover:bg-sky-500 hover:text-white flex items-center justify-center transition-colors" title="Jump to Floor">↗️</Link>
                                                                        <button onClick={() => handleCheckClick(t)} className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors" title="Complete Task">✓</button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Quick Schedule Button */}
                                                    <button 
                                                        onClick={() => { setSelectedJobId(job.id); setJobSearchTerm(`${job.job_number ? `#${job.job_number}` : 'QUOTE'} - ${job.quotes?.customers?.company_name || job.title}`); setNewTask(col.taskPreset); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                        className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors z-10 border ${isLightMode ? 'bg-slate-50 hover:bg-slate-200 text-slate-500 border-slate-200' : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'}`}
                                                    >
                                                        + Schedule Task
                                                    </button>
                                                </div>
                                            )
                                        })}
                                        {columnJobs.length === 0 && (
                                            <div className="text-center p-6 border-2 border-dashed border-inherit rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-400">Clear</div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* CALENDAR VIEW */}
                {activeTab === "calendar" && (
                    <div className={`w-full ${theme.bgPanel} border ${theme.border} rounded-[2rem] p-4 md:p-6 shadow-2xl overflow-hidden animate-in fade-in relative flex flex-col`}>
                        {/* ADDITIVE: Jump to Now Utility */}
                        <div className="flex justify-end items-center mb-2 px-2 shrink-0 z-10 relative">
                            <button 
                                onClick={() => {
                                    const now = new Date();
                                    const topPosition = (now.getHours() * PIXELS_PER_HOUR) + (now.getMinutes() * PIXELS_PER_MINUTE);
                                    calendarContainerRef.current?.scrollTo({ top: Math.max(0, topPosition - 200), behavior: 'smooth' });
                                }}
                                className={`absolute -top-12 right-4 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-sky-500 hover:bg-sky-400 text-white shadow-lg flex items-center gap-2`}
                            >
                                🎯 Jump to Now
                            </button>
                        </div>
                        <div className="min-w-[1000px] w-full h-[80vh] min-h-[600px] overflow-y-auto overflow-x-auto custom-scrollbar relative pr-2" 
ref={calendarContainerRef}>
                            {/* Sticky Calendar Header (Days) */}
                            <div className={`grid grid-cols-8 gap-2 border-b ${theme.border} pb-4 mb-4 sticky top-0 z-40 ${theme.bgPanel} pt-2 shadow-sm`}>
                                <div className="text-center"></div> {/* Empty corner for times */}
                                {weekDays.map(date => {
                                    const isToday = new Date().toDateString() === date.toDateString();
                                    return (
                                        <div key={date.toISOString()} className={`text-center flex flex-col items-center justify-center p-2 rounded-xl ${isToday ? 'bg-sky-500/10 border border-sky-500/50' : ''}`}>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-sky-500' : theme.textMuted}`}>
                                                {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                            </span>
                                            <span className={`text-xl font-black ${isToday ? 'text-sky-500' : theme.textStrong}`}>
                                                {date.getDate()}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Dynamic Stretching Calendar Grid */}
                            <div className="flex flex-col relative" style={{ height: `${(activeHours.length) * PIXELS_PER_HOUR}px` }}>
                                
                                {/* ADDITIVE: Current Time Red Line Indicator */}
                                {(() => {
                                    const topPos = (currentTime.getHours() * PIXELS_PER_HOUR) + (currentTime.getMinutes() * PIXELS_PER_MINUTE);
                                    return (
                                        <div className="absolute w-full z-30 pointer-events-none flex items-center" style={{ top: `${topPos}px` }}>
                                            <div className="w-[12.5%] text-right pr-2 sticky left-0 z-30">
                                                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shadow-sm">Now</span>
                                            </div>
                                            <div className="flex-1 h-[2px] bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)] relative">
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500"></div>
                                            </div>
                                        </div>
                                    );
                                })()}
              
                                {/* Background Grid Lines & Hour Labels (Sticky Left) */}
                                {activeHours.map(hour => {
                                    const timeStr24 = `${hour.toString().padStart(2, '0')}:00`;
                                    const displayHour = formatToAMPM(timeStr24);
                                    const topPosition = (hour - CALENDAR_MIN_HOUR) * PIXELS_PER_HOUR;
                                    
                                    return (
                                        <div key={hour} className={`absolute w-full flex border-t ${theme.border}`} style={{ top: `${topPosition}px`, height: `${PIXELS_PER_HOUR}px` }}>
                                            {/* Sticky Hour Label */}
                                            <div className={`w-[12.5%] text-right pr-4 text-[10px] font-black ${theme.textMuted} uppercase tracking-widest pt-2 border-r ${theme.border} shrink-0 sticky left-0 z-20 ${theme.bgPanel}`}>
                                                {displayHour}
                                            </div>
                                            <div className="flex-1 grid grid-cols-7">
                                                {/* Draw vertical lines for each day AND add drop zones */}
                                                {weekDays.map((date, i) => {
                                                    const dropDate = date.toISOString().split('T')[0];
                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className={`border-r ${theme.border} h-full transition-colors relative group/dropzone`}
                                                            onDragOver={handleDragOver}
                                                            onDrop={(e) => {
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                handleDrop(e, dropDate, hour, rect.top);
                                                            }}
                                                        >
                                                            <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover/dropzone:opacity-100 pointer-events-none transition-opacity"></div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Render Absolute Positioned Events */}
                                {activeTodos.map(todo => {
                                    if (!todo.target_date || !todo.target_time) return null;
                                    
                                    const [h, m] = todo.target_time.split(":");
                                    const hour = parseInt(h, 10);
                                    const minutes = parseInt(m, 10);
                                    
                                    if (hour < CALENDAR_MIN_HOUR || hour > activeHours[activeHours.length - 1]) return null;

                                    const topPosition = ((hour - CALENDAR_MIN_HOUR) * PIXELS_PER_HOUR) + (minutes * PIXELS_PER_MINUTE);
                                    
                                    const rawHeight = (todo.duration_minutes || 60) * PIXELS_PER_MINUTE;
                                    const blockHeight = Math.max(rawHeight, 100); 

                                    const eventDate = new Date(todo.target_date);
                                    const dayIndex = weekDays.findIndex(d => d.toISOString().split('T')[0] === eventDate.toISOString().split('T')[0]);
                                    
                                    if (dayIndex === -1) return null; 

                                    const clientName = todo.jobs ? (todo.jobs.quotes?.customers?.company_name || todo.jobs.title) : "";
                                    const colorClass = todo.is_completed ? (isLightMode ? 'bg-slate-200 border-slate-300 opacity-60' : 'bg-slate-800 border-slate-700 opacity-60') : getTaskColorClass(todo.task);

                                    return (
                                        <div 
                                            key={todo.id} 
                                            draggable={!resizingTodoId} 
                                            onDragStart={(e) => handleDragStart(e, todo.id)}
                                            onClick={(e) => {
                                                // Prevent opening if they clicked an action button inside
                                                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
                                                if (todo.job_id) setPreviewJobId(todo.job_id);
                                            }}
                                            className={`absolute rounded-xl p-2 shadow-md border-2 ${colorClass} ${isLightMode && !todo.is_completed ? 'bg-opacity-20' : 'bg-opacity-30'} transition-all group hover:z-50 hover:shadow-2xl cursor-pointer active:cursor-grabbing flex flex-col overflow-hidden`}
                                            style={{ 
                                                top: `${topPosition}px`, 
                                                height: `${blockHeight}px`,
                                                left: `${12.5 + (dayIndex * 12.5)}%`, 
                                                width: '12%',
                                                zIndex: todo.id === resizingTodoId ? 60 : (todo.is_completed ? 10 : 20)
                                            }}
                                        >
                                            {/* TOP RESIZE HANDLE */}
                                            {!todo.is_completed && (
                                                <div 
                                                    className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-30 opacity-0 group-hover:opacity-100 hover:bg-sky-500/30 rounded-t-xl transition-colors"
                                                    onMouseDown={(e) => handleResizeStart(e, todo, 'top')}
                                                ></div>
                                            )}

                                            {/* CALENDAR BLOCK ACTIONS - Top Right */}
                                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 p-1 rounded-lg z-30">
                                                {todo.jobs && <Link href="/shop-floor" className="w-5 h-5 rounded bg-sky-500/20 text-sky-400 hover:bg-sky-500 hover:text-white flex items-center justify-center text-[9px]" title="Jump to Floor">↗️</Link>}
                                                <button onClick={(e) => { e.stopPropagation(); handleCheckClick(todo); }} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] ${todo.is_completed ? 'bg-slate-500 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-white'}`} title="Complete">✓</button>
                                                <button onClick={(e) => { e.stopPropagation(); moveToTrash(todo.id); }} className="w-5 h-5 rounded bg-red-500 hover:bg-red-400 text-white flex items-center justify-center text-[11px] font-black" title="Delete">×</button>
                                            </div>

                                            {/* CALENDAR BLOCK CONTENT */}
                                            <div className="flex flex-col flex-grow relative z-10 overflow-y-auto custom-scrollbar pb-4">
                                                <span className={`text-[10px] md:text-[11px] font-black uppercase tracking-widest block border-b border-inherit pb-1 mb-1 flex items-center gap-1 truncate ${todo.is_completed ? 'line-through text-slate-500' : theme.textStrong}`}>
                                                    {todo.is_completed && <span className="text-emerald-500">✓</span>}
                                                    {todo.task}
                                                </span>
                                                
                                                {todo.jobs ? (
                                                    <div className="flex flex-col gap-0.5 pr-1">
                                                        <span className={`text-[11px] md:text-xs font-black uppercase truncate leading-tight ${todo.is_completed ? 'text-slate-500' : theme.textStrong}`}>
                                                            {clientName}
                                                        </span>
                                                        <span className={`text-[9px] font-bold uppercase truncate leading-none ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                                                            {todo.jobs.job_number ? `#${todo.jobs.job_number}` : `QUOTE: ${todo.jobs.quote_id?.split('-')[0].toUpperCase()}`}
                                                        </span>
                                                        
                                                        {blockHeight > 65 && (
                                                            <div className="flex flex-col mt-1.5 space-y-1">
                                                                {todo.jobs.quotes?.quote_items?.map((item: any, idx: number) => {
                                                                    const firstColor = item.quote_item_variants?.[0]?.color || "Black";
                                                                    const hex = COLOR_HEX_MAP[firstColor] || '#333';
                                                                    return (
                                                                        <div key={idx} className="flex items-center gap-1">
                                                                            <div className="w-2 h-2 rounded-full border border-slate-400/30 shrink-0" style={{ backgroundColor: hex }}></div>
                                                                            <span className={`text-[8.5px] font-bold uppercase truncate ${todo.is_completed ? 'text-slate-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                                <span className="font-black mr-0.5">{item.quantity}x</span> {item.description}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className={`text-[9px] font-black ${todo.is_completed ? 'text-slate-500' : theme.textMuted}`}>General Task</span>
                                                )}
                                            </div>

                                            {/* BOTTOM RESIZE HANDLE & END TIME DISPLAY */}
                                            <div 
                                                className={`absolute bottom-0 left-0 right-0 py-1.5 px-2 text-[9px] font-black text-center border-t border-inherit cursor-ns-resize z-20 transition-colors rounded-b-xl ${isLightMode ? 'bg-black/5 text-slate-700 hover:bg-sky-500/20 hover:text-sky-700' : 'bg-white/5 text-slate-300 hover:bg-sky-500/30 hover:text-white'}`}
                                                onMouseDown={(e) => handleResizeStart(e, todo, 'bottom')}
                                            >
                                                Ends {calculateEndTime(todo.target_time, todo.duration_minutes || 60)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                        </div>
                    </div>
                )}

                {/* DELETE BIN VIEW */}
                {activeTab === "trash" && (
                    <div className="flex flex-col gap-6 w-full animate-in fade-in">
                        <div className={`flex justify-between items-end border-b ${theme.border} pb-2`}>
                            <h2 className={`text-xl font-black uppercase tracking-tighter italic text-red-500`}>Delete Bin</h2>
                            <span className="bg-red-500/10 text-red-500 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-red-500/30">{trashedTodos.length} Items</span>
                        </div>

                        {searchedTrashedTodos.length === 0 ? (
                            <div className={`border border-dashed ${theme.border} rounded-2xl p-10 text-center font-black uppercase tracking-widest text-xs ${theme.textMuted}`}>
                                {globalSearch ? `No deleted items match "${globalSearch}"` : "Trash bin is empty."}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 opacity-80">
                                {searchedTrashedTodos.map(todo => {
                                    const clientName = todo.jobs ? (todo.jobs.quotes?.customers?.company_name || todo.jobs.title) : "";
                                    return (
                                    <div key={todo.id} className={`bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-2xl p-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm`}>
                                        <div className="flex items-center gap-4 w-full xl:w-auto overflow-hidden">
                                            <div className="flex items-center gap-3 w-full overflow-hidden">
                                                <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shrink-0 border bg-slate-800 text-slate-400 border-slate-700`}>{todo.task}</span>
                                                {todo.jobs && <span className={`text-sm font-black uppercase truncate ${theme.textMuted}`}>#{todo.jobs.job_number} {clientName}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 w-full xl:w-auto justify-end">
                                            <button onClick={() => restoreFromTrash(todo.id)} className="font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-500/50 hover:bg-emerald-500 hover:text-white transition-colors">Restore</button>
                                            <button onClick={() => permanentlyDelete(todo.id)} className="font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg bg-red-600 text-white shadow-md hover:bg-red-500 transition-colors">Delete Forever</button>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                )}
            </>
        )}
      </div>

      {/* --- ADDITIVE: QUICK SCHEDULE MODAL --- */}
      {quickScheduleJob && (
          <div className="fixed inset-0 z-[120] bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setQuickScheduleJob(null)}>
              <div className={`w-full max-w-lg ${theme.bgPanel} border ${theme.border} rounded-[2rem] p-8 shadow-2xl flex flex-col`} onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-start mb-6 border-b border-inherit pb-4">
                      <div>
                          <h2 className={`text-2xl font-black uppercase tracking-tighter leading-none text-sky-500 flex items-center gap-2`}>
                              ⚡ Quick Schedule
                          </h2>
                          <p className={`text-sm font-bold uppercase tracking-widest mt-2 ${theme.textStrong}`}>
                              {quickScheduleJob.job.job_number ? `#${quickScheduleJob.job.job_number}` : 'QUOTE'} - {quickScheduleJob.job.quotes?.customers?.company_name || quickScheduleJob.job.title}
                          </p>
                      </div>
                      <button onClick={() => setQuickScheduleJob(null)} className={`text-[10px] font-black uppercase ${theme.textMuted} hover:text-red-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded`}>✕ ESC</button>
                  </div>

                  <div className={`flex flex-col gap-6`}>
                      {/* Task Info Row */}
                      <div className={`flex items-center justify-between p-4 rounded-xl border ${isLightMode ? 'bg-sky-50 border-sky-100' : 'bg-sky-900/20 border-sky-800/50'}`}>
                          <div className="flex flex-col">
                              <span className={`text-[10px] font-black uppercase tracking-widest text-sky-500 mb-1`}>Production Action</span>
                              <span className={`text-lg font-black uppercase ${theme.textStrong}`}>{quickScheduleJob.task}</span>
                          </div>
                          <div className="flex flex-col text-right">
                              <span className={`text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1`}>Time Block Req.</span>
                              <span className={`text-lg font-black uppercase ${theme.textStrong}`}>{quickScheduleJob.duration} MINS</span>
                          </div>
                      </div>

                      {/* Date & Time Configuration */}
                      <div>
                          <label className={`text-[10px] font-black ${theme.textMuted} uppercase tracking-widest block mb-3`}>Set Start Date & Time</label>
                          
                          <div className="flex flex-col gap-3">
                              <input 
                                  type="date" 
                                  value={qsDate} 
                                  onChange={(e) => setQsDate(e.target.value)}
                                  className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors border ${theme.inputBg}`}
                                  style={{ colorScheme: isLightMode ? 'light' : 'dark' }}
                              />

                              <div className="flex gap-2 h-14">
                                  {/* Hour Dropdown */}
                                  <div className="relative flex-1">
                                      <select 
                                          value={qsHour} 
                                          onChange={(e) => setQsHour(e.target.value)}
                                          className={`w-full h-full appearance-none rounded-xl px-4 text-xl font-black text-center outline-none transition-colors border cursor-pointer ${theme.inputBg}`}
                                      >
                                          {["1","2","3","4","5","6","7","8","9","10","11","12"].map(h => (
                                              <option key={h} value={h}>{h}</option>
                                          ))}
                                      </select>
                                      <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs">▼</span>
                                  </div>
                                  
                                  <span className={`text-3xl font-black self-center pb-1 ${theme.textMuted}`}>:</span>

                                  {/* 10-Minute Interval Dropdown */}
                                  <div className="relative flex-1">
                                      <select 
                                          value={qsMinute} 
                                          onChange={(e) => setQsMinute(e.target.value)}
                                          className={`w-full h-full appearance-none rounded-xl px-4 text-xl font-black text-center outline-none transition-colors border cursor-pointer ${theme.inputBg}`}
                                      >
                                          {["00", "10", "20", "30", "40", "50"].map(m => (
                                              <option key={m} value={m}>{m}</option>
                                          ))}
                                      </select>
                                      <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs">▼</span>
                                  </div>

                                  {/* AM/PM Toggle */}
                                  <div className="flex bg-slate-200 dark:bg-slate-800 rounded-xl p-1 border border-inherit">
                                      <button 
                                          type="button"
                                          onClick={() => setQsAmPm("AM")} 
                                          className={`px-4 font-black text-sm rounded-lg transition-all ${qsAmPm === "AM" ? 'bg-white dark:bg-slate-600 shadow-sm text-sky-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                      >AM</button>
                                      <button 
                                          type="button"
                                          onClick={() => setQsAmPm("PM")} 
                                          className={`px-4 font-black text-sm rounded-lg transition-all ${qsAmPm === "PM" ? 'bg-white dark:bg-slate-600 shadow-sm text-sky-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                      >PM</button>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <button 
                          onClick={handleQuickScheduleSubmit}
                          className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:-translate-y-1 flex justify-center items-center gap-2"
                      >
                          🚀 Lock it in & Send to Floor
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- ADDITIVE: JOB PREVIEW MODAL --- */}
      {previewJobId && (() => {
          const previewJob = jobsList.find(j => j.id === previewJobId);
          if (!previewJob) return null;
          return (
              <div className="fixed inset-0 z-[110] bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewJobId(null)}>
                  <div className={`w-full max-w-2xl ${theme.bgPanel} border ${theme.border} rounded-[2rem] p-8 shadow-2xl flex flex-col max-h-[80vh]`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-between items-start mb-6 border-b border-inherit pb-4 shrink-0">
                          <div>
                              <h2 className={`text-2xl font-black uppercase tracking-tighter leading-none ${theme.textStrong}`}>
                                  {previewJob.job_number ? `#${previewJob.job_number}` : `QUOTE: ${previewJob.quote_id?.split('-')[0].toUpperCase()}`}
                              </h2>
                              <p className={`text-sm font-bold uppercase tracking-widest mt-2 ${theme.textMuted}`}>{previewJob.quotes?.customers?.company_name || previewJob.title}</p>
                          </div>
                          <button onClick={() => setPreviewJobId(null)} className={`text-[10px] font-black uppercase ${theme.textMuted} hover:text-red-500`}>Close ✕</button>
                      </div>
                      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
                          {previewJob.quotes?.quote_items?.map((item: any, idx: number) => {
                              const variants = item.quote_item_variants || [];
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
                              const sizeStrs = [];
                              for (const [key, val] of Object.entries(totals)) {
                                  if ((val as number) > 0) sizeStrs.push(`${key}:${val}`);
                              }
                              const firstColor = Array.from(colors)[0] || "Black";
                              const hex = COLOR_HEX_MAP[firstColor] || '#333';
                              return (
                                  <div key={idx} className={`flex items-center gap-3 md:gap-4 p-3 rounded-2xl border shadow-sm transition-colors ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
                                      
                                      {/* Icon wrapper */}
                                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${isLightMode ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400'}`}>
                                          {renderGarmentIcon(item.description, isLightMode, "w-8 h-8")}
                                      </div>

                                      {/* Color Swatch Inline */}
                                      <div className="w-6 h-6 rounded-full border border-slate-400/30 shadow-inner shrink-0" style={{ backgroundColor: hex }} title={Array.from(colors).join(', ')}></div>

                                      {/* Description */}
                                      <span className={`text-sm md:text-base font-black uppercase truncate flex-1 min-w-[100px] ${theme.textStrong}`}>
                                          {item.description}
                                      </span>

                                      {/* Compact Size Breakdown */}
                                      <div className="flex items-center gap-1 shrink-0 flex-nowrap overflow-x-auto custom-scrollbar pb-1 px-2">
                                          {sizeStrs.map(s => {
                                              const [size, qty] = s.split(':');
                                              return (
                                                  <div key={s} className={`flex items-center justify-center px-2 py-1 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/80 border-slate-700'}`}>
                                                      <span className={`text-[11px] font-black mr-2 ${theme.textMuted}`}>{size}</span>
                                                      <span className={`text-[12px] font-black ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}>{qty}</span>
                                                  </div>
                                              )
                                          })}
                                      </div>

                                      {/* Massive Quantity */}
                                      <div className={`flex items-center justify-center min-w-[80px] shrink-0 pl-3 md:pl-4 border-l ${theme.border}`}>
                                          <span className="text-3xl md:text-4xl font-black text-emerald-500 leading-none tracking-tighter mr-1">{item.quantity}</span>
                                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 mt-2 md:mt-3">PCS</span>
                                      </div>
                                  </div>
                              )
                          })}
                          {(!previewJob.quotes?.quote_items || previewJob.quotes.quote_items.length === 0) && (
                              <div className="text-center p-8 border-2 border-dashed border-inherit rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">No items found for this job.</div>
                          )}
                      </div>
                  </div>
              </div>
          );
      })()}

      {/* --- ADDITIVE: JOB PREVIEW MODAL --- */}
      {previewJobId && (() => {
          const previewJob = jobsList.find(j => j.id === previewJobId);
          if (!previewJob) return null;
          return (
              <div className="fixed inset-0 z-[110] bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewJobId(null)}>
                  <div className={`w-full max-w-2xl ${theme.bgPanel} border ${theme.border} rounded-[2rem] p-8 shadow-2xl flex flex-col max-h-[80vh]`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-between items-start mb-6 border-b border-inherit pb-4 shrink-0">
                          <div>
                              <h2 className={`text-2xl font-black uppercase tracking-tighter leading-none ${theme.textStrong}`}>
                                  {previewJob.job_number ? `#${previewJob.job_number}` : `QUOTE: ${previewJob.quote_id?.split('-')[0].toUpperCase()}`}
                              </h2>
                              <p className={`text-sm font-bold uppercase tracking-widest mt-2 ${theme.textMuted}`}>{previewJob.quotes?.customers?.company_name || previewJob.title}</p>
                          </div>
                          <button onClick={() => setPreviewJobId(null)} className={`text-[10px] font-black uppercase ${theme.textMuted} hover:text-red-500`}>Close ✕</button>
                      </div>
                      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
                          {previewJob.quotes?.quote_items?.map((item: any, idx: number) => {
                              const variants = item.quote_item_variants || [];
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
                              const sizeStrs = [];
                              for (const [key, val] of Object.entries(totals)) {
                                  if ((val as number) > 0) sizeStrs.push(`${key}:${val}`);
                              }
                              const firstColor = Array.from(colors)[0] || "Black";
                              const hex = COLOR_HEX_MAP[firstColor] || '#333';
                              return (
                                  <div key={idx} className={`flex items-center gap-3 md:gap-4 p-3 rounded-2xl border shadow-sm transition-colors ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800'}`}>
                                      
                                      {/* Icon wrapper */}
                                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${isLightMode ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400'}`}>
                                          {renderGarmentIcon(item.description, isLightMode, "w-8 h-8")}
                                      </div>

                                      {/* Color Swatch Inline */}
                                      <div className="w-6 h-6 rounded-full border border-slate-400/30 shadow-inner shrink-0" style={{ backgroundColor: hex }} title={Array.from(colors).join(', ')}></div>

                                      {/* Description */}
                                      <span className={`text-sm md:text-base font-black uppercase truncate flex-1 min-w-[100px] ${theme.textStrong}`}>
                                          {item.description}
                                      </span>

                                      {/* Compact Size Breakdown */}
                                      <div className="flex items-center gap-1 shrink-0 flex-nowrap overflow-x-auto custom-scrollbar pb-1 px-2">
                                          {sizeStrs.map(s => {
                                              const [size, qty] = s.split(':');
                                              return (
                                                  <div key={s} className={`flex items-center justify-center px-2 py-1 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-800/80 border-slate-700'}`}>
                                                      <span className={`text-[11px] font-black mr-2 ${theme.textMuted}`}>{size}</span>
                                                      <span className={`text-[12px] font-black ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}>{qty}</span>
                                                  </div>
                                              )
                                          })}
                                      </div>

                                      {/* Massive Quantity */}
                                      <div className={`flex items-center justify-center min-w-[80px] shrink-0 pl-3 md:pl-4 border-l ${theme.border}`}>
                                          <span className="text-3xl md:text-4xl font-black text-emerald-500 leading-none tracking-tighter mr-1">{item.quantity}</span>
                                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 mt-2 md:mt-3">PCS</span>
                                      </div>
                                  </div>
                              )
                          })}
                          {(!previewJob.quotes?.quote_items || previewJob.quotes.quote_items.length === 0) && (
                              <div className="text-center p-8 border-2 border-dashed border-inherit rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400">No items found for this job.</div>
                          )}
                      </div>
                  </div>
              </div>
          );
      })()}

      {/* --- ADDITIVE: DEPENDENCY SHIFT MODAL --- */}
      {shiftDependenciesPrompt && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShiftDependenciesPrompt(null)}>
            <div className={`w-full max-w-lg ${theme.bgPanel} border ${theme.border} rounded-[2rem] p-8 shadow-2xl flex flex-col`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start mb-6 border-b border-inherit pb-4">
                    <div>
                        <h2 className={`text-2xl font-black uppercase italic tracking-tighter leading-none text-sky-500`}>Auto-Shift Dependencies?</h2>
                        <p className={`text-xs font-bold uppercase tracking-widest mt-3 ${theme.textStrong}`}>
                            You pushed this task forward in the schedule.
                        </p>
                    </div>
                </div>
                
                <p className={`text-[10px] font-black uppercase tracking-widest mb-6 ${theme.textMuted} leading-relaxed`}>
                    This job has other production tasks scheduled after this one. Do you want to automatically shift all subsequent tasks forward by the exact same amount of time?
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-inherit">
                    <button onClick={() => confirmShiftDependencies(false)} className={`flex-1 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'border-slate-200 hover:bg-slate-100 text-slate-700' : 'border-slate-800 hover:bg-slate-800 text-slate-300'}`}>
                        No, Just Move This Task
                    </button>
                    <button onClick={() => confirmShiftDependencies(true)} className="flex-1 bg-sky-600 hover:bg-sky-500 text-white p-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)]">
                        Yes, Auto-Shift All Following Tasks
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL: COMPLETE TASK & UPDATE STAGE --- */}
      {completingTodo && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setCompletingTodo(null)}>
            <div className={`w-full max-w-xl ${theme.bgPanel} border ${theme.border} rounded-[2rem] p-8 shadow-2xl flex flex-col`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6 border-b border-inherit pb-4">
                    <div>
                        <h2 className={`text-2xl font-black uppercase italic tracking-tighter leading-none ${theme.textStrong}`}>Task Completed!</h2>
                        <p className={`text-xs font-bold uppercase tracking-widest mt-2 text-emerald-500`}>✓ {completingTodo.task}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-inherit ${theme.textMuted}`}>Job #{completingTodo.jobs?.job_number}</span>
                </div>
                
                <p className={`text-[10px] font-black uppercase tracking-widest mb-4 ${theme.textMuted}`}>Would you like to advance the Job Stage?</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                    {PIPELINE_STAGES.map(stage => (
                        <button 
                            key={stage.id}
                            onClick={() => handleCompleteAndMove(completingTodo.id, stage.id)}
                            className={`p-3 rounded-xl border ${isLightMode ? 'border-slate-200 hover:bg-sky-50' : 'border-slate-800 hover:bg-sky-500/10'} text-[9px] font-black uppercase tracking-widest transition-all hover:border-sky-500 ${theme.textStrong} ${completingTodo.jobs?.stage === stage.id ? (isLightMode ? 'bg-slate-100 border-slate-300' : 'bg-slate-800 border-slate-600') : ''}`}
                        >
                            Move to {stage.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-inherit">
                    <button onClick={() => setCompletingTodo(null)} className={`flex-1 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'border-slate-200 hover:bg-slate-100' : 'border-slate-800 hover:bg-slate-800'} ${theme.textStrong}`}>
                        Cancel
                    </button>
                    <button onClick={() => handleCompleteAndMove(completingTodo.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        Just Complete Task
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ============ CONFIRM DIALOG ============ */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmDialog(null)}>
          <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`text-lg font-black uppercase italic tracking-tighter mb-2 ${theme.textStrong}`}>{confirmDialog.title}</h3>
            <p className={`text-sm leading-relaxed mb-6 ${theme.textMuted}`}>{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog(null)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${isLightMode ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>Cancel</button>
              <button onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md text-white ${confirmDialog.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{confirmDialog.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ TOAST ============ */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[300] animate-in slide-in-from-bottom-2 duration-300">
          <div className={`px-5 py-3 rounded-xl shadow-2xl border font-black text-xs uppercase tracking-widest max-w-sm ${
            toast.type === "success"
              ? (isLightMode ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40')
              : toast.type === "error"
                ? (isLightMode ? 'bg-red-50 text-red-700 border-red-300' : 'bg-red-500/15 text-red-400 border-red-500/40')
                : (isLightMode ? 'bg-sky-50 text-sky-700 border-sky-300' : 'bg-sky-500/15 text-sky-400 border-sky-500/40')
          }`}>
            {toast.message}
          </div>
        </div>
      )}

    </div>
  );
}