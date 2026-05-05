"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// --- DYNAMIC COLOR ENGINE FOR ICONS ---
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

// --- DYNAMIC GARMENT ICONS ---
const renderGarmentIcon = (description: string, colorHex: string): ReactNode => {
  const desc = description?.toLowerCase() || "";
  const classes = "w-7 h-7 mr-3 shrink-0 drop-shadow-md";
  if (desc.includes("hoodie") || desc.includes("hooded")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M18 9l3 3-2 2-1-2v10H6V12l-1 2-2-2 3-3" /><path d="M8 9V5c0-2.5 1.5-4 4-4s4 1.5 4 4v4" /><path d="M10 9v3" /><path d="M14 9v3" /><path d="M7.5 15h9l1 5H6.5l1-5z" />
      </svg>
    );
  }
  if (desc.includes("polo") || desc.includes("collared")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M18 7l3 3-2 2-1-2v12H6V10l-1 2-2-2 3-3" /><path d="M9 7l3 4 3-4" /><path d="M12 7v6" /><circle cx="12" cy="10" r="0.5" fill={colorHex}/>
      </svg>
    );
  }
  if (desc.includes("hat") || desc.includes("cap") || desc.includes("beanie")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M4 15v-2a8 8 0 0 1 16 0v2" /><path d="M2 15h15c2 0 4 1 4 2s-2 2-4 2H2v-4z" /><circle cx="12" cy="4" r="1.5" /><path d="M12 5.5v7.5" />
      </svg>
    );
  }
  if (desc.includes("long sleeve") || desc.includes("longsleeve")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M17 6L22 18l-3 1-2-9v12H7V12L5 19l-3-1L7 6" /><path d="M8 6c0 2 2 3 4 3s4-1 4-3" />
      </svg>
    );
  }
  if (desc.includes("jacket") || desc.includes("zip") || desc.includes("coat")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
        <path d="M18 9l3 4-2 2-1-3v10H6V12l-1 3-2-2 3-4" /><path d="M9 9V5l3 3 3-3v4" /><path d="M12 8v14" /><path d="M7 16h3" /><path d="M14 16h3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={colorHex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={classes}>
      <path d="M18 7l3 3-2 2-1-2v12H6V10l-1 2-2-2 3-3" /><path d="M8 7c0 2 1.5 3 4 3s4-1 4-3" />
    </svg>
  );
};

export default function ProductionBoard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [jobLogs, setJobLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // Date range filter — preset shortcuts + free-form custom range.
  // dateField controls whether we filter on `created_at` or `due_date`.
  // For a production board, due_date is what you usually care about.
  const [datePreset, setDatePreset] = useState<"today"|"week"|"month"|"after_import"|"all"|"custom">("after_import");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [dateField, setDateField] = useState<"created_at"|"due_date">("created_at");

  // Compute the active [from, to] window from the preset.
  const dateWindow = (() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = 24 * 60 * 60 * 1000;
    if (datePreset === "today")        return { from: startOfToday, to: null as Date | null };
    if (datePreset === "week")         return { from: new Date(startOfToday.getTime() - 7  * day), to: null };
    if (datePreset === "month")        return { from: new Date(startOfToday.getTime() - 30 * day), to: null };
    if (datePreset === "after_import") return { from: new Date("2026-04-08T00:00:00"), to: null };
    if (datePreset === "custom") {
      return {
        from: customFrom ? new Date(customFrom + "T00:00:00") : null,
        to:   customTo   ? new Date(customTo   + "T23:59:59") : null,
      };
    }
    return { from: null, to: null }; // "all"
  })();
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  
  const [showMobileIntel, setShowMobileIntel] = useState(false);
  const [jobToNotify, setJobToNotify] = useState<any>(null);

  // --- SCHEDULING STATE ---
  const [scheduleTask, setScheduleTask] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // --- UNDO/REDO STATE ---
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // --- FILE UPLOAD STATE ---
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // SYNCED STAGES: These now perfectly map to the CRM DB_STAGE_MAP
  const stages = [
    { name: "Incoming", label: "Incoming", color: "bg-blue-50 text-blue-500 border-blue-500/20 dark:bg-blue-500/10 dark:border-blue-500/30", accent: "border-blue-500" },
    { name: "Artwork", label: "Artwork in Approval", color: "bg-fuchsia-50 text-fuchsia-500 border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/30", accent: "border-fuchsia-500" },
    { name: "Sourcing", label: "To Buy", color: "bg-orange-50 text-orange-500 border-orange-500/20 dark:bg-orange-500/10 dark:border-orange-500/30", accent: "border-orange-500" },
    { name: "Printing", label: "To Print", color: "bg-indigo-50 text-indigo-500 border-indigo-500/20 dark:bg-indigo-500/10 dark:border-indigo-500/30", accent: "border-indigo-500" },
    { name: "Pressing", label: "To Press", color: "bg-violet-50 text-violet-500 border-violet-500/20 dark:bg-violet-500/10 dark:border-violet-500/30", accent: "border-violet-500" },
    { name: "Dispatch", label: "To Deliver / Pick Up", color: "bg-teal-50 text-teal-500 border-teal-500/20 dark:bg-teal-500/10 dark:border-teal-500/30", accent: "border-teal-500" },
    { name: "Billing", label: "To Invoice", color: "bg-rose-50 text-rose-500 border-rose-500/20 dark:bg-rose-500/10 dark:border-rose-500/30", accent: "border-rose-500" },
    { name: "Paid", label: "Paid", color: "bg-emerald-50 text-emerald-500 border-emerald-500/20 dark:bg-emerald-500/10 dark:border-emerald-500/30", accent: "border-emerald-500" }
  ];

  const stageNames = stages.map(s => s.name);

  // --- UNDO/REDO KEYBOARD SHORTCUTS ---
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setEditingJob(null);
      setJobToNotify(null);
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
    }
    if (((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'z') || ((event.metaKey || event.ctrlKey) && event.key === 'y')) {
        event.preventDefault();
        handleRedo();
    }
  }, [history, historyIndex]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => { if (editingJob) loadJobLogs(editingJob.id); }, [editingJob]);

  async function loadJobs() {
    const { data } = await supabase.from("jobs").select(`
      *,
      quotes(id, total_amount, customers(*), quote_items(*, quote_item_variants(*)))
    `).order("updated_at", { ascending: false });
    
    if (data) {
        setJobs(data);
        if (history.length === 0) {
            setHistory([data]);
            setHistoryIndex(0);
        }
    }
  }

  async function loadJobLogs(jobId: string) {
    const { data } = await supabase.from("job_logs").select("*").eq("job_id", jobId).order("created_at", { ascending: true });
    if (data) setJobLogs(data);
  }

  // --- UNDO / REDO LOGIC ---
  const saveHistoryState = (newJobsState: any[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newJobsState);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = async () => {
      if (historyIndex > 0) {
          const previousState = history[historyIndex - 1];
          setJobs(previousState);
          setHistoryIndex(historyIndex - 1);
          
          const currentState = history[historyIndex];
          const changedJobs = previousState.filter((prevJob: any) => {
              const currentJob = currentState.find((cj: any) => cj.id === prevJob.id);
              return currentJob && currentJob.stage !== prevJob.stage;
          });

          for (const job of changedJobs) {
              await supabase.from("jobs").update({ stage: job.stage }).eq("id", job.id);
          }
      }
  };

  const handleRedo = async () => {
      if (historyIndex < history.length - 1) {
          const nextState = history[historyIndex + 1];
          setJobs(nextState);
          setHistoryIndex(historyIndex + 1);

          const currentState = history[historyIndex];
          const changedJobs = nextState.filter((nxtJob: any) => {
              const currentJob = currentState.find((cj: any) => cj.id === nxtJob.id);
              return currentJob && currentJob.stage !== nxtJob.stage;
          });

          for (const job of changedJobs) {
              await supabase.from("jobs").update({ stage: job.stage }).eq("id", job.id);
          }
      }
  };

  const filteredJobs = jobs.filter(j => {
    // 1. Search filter
    const search = searchQuery.toLowerCase();
    const companyName = j.quotes?.customers?.company_name || "";
    const matchesSearch = !search ||
      j.title?.toLowerCase().includes(search) ||
      (j.job_number && j.job_number.toString().includes(search)) ||
      companyName.toLowerCase().includes(search);
    if (!matchesSearch) return false;

    // 2. Date filter — operates on the chosen date field
    if (dateWindow.from || dateWindow.to) {
      const raw = j[dateField];
      if (!raw) return false; // job has no date in this field → drop it
      const d = new Date(raw);
      if (dateWindow.from && d < dateWindow.from) return false;
      if (dateWindow.to   && d > dateWindow.to)   return false;
    }
    return true;
  });

  const totalBoardValue = filteredJobs.reduce((sum, j) => sum + (j.quotes?.total_amount || 0), 0);

  const scrollToStage = (stageName: string) => {
    const el = document.getElementById(`column-${stageName}`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  async function updateStage(e: React.MouseEvent, job: any, direction: 'next' | 'back') {
    e.stopPropagation(); 
    
    // SMART MATCH: Find exactly where this job is right now, even if DB has old names
    const currentCoreStage = stages.find(s => {
        const stageStr = (job.stage || "").toLowerCase();
        if (s.name === "Incoming") return stageStr.includes("incoming") || stageStr.includes("new");
        if (s.name === "Artwork") return stageStr.includes("art") || stageStr.includes("proof");
        if (s.name === "Sourcing") return stageStr.includes("buy") || stageStr.includes("order") || stageStr.includes("source") || stageStr.includes("receive");
        if (s.name === "Printing") return stageStr.includes("print");
        if (s.name === "Pressing") return stageStr.includes("press");
        if (s.name === "Dispatch") return stageStr.includes("deliver") || stageStr.includes("ship") || stageStr.includes("dispatch") || stageStr.includes("finish") || stageStr.includes("pack");
        if (s.name === "Billing") return stageStr.includes("invoice") || stageStr.includes("bill");
        if (s.name === "Paid") return stageStr.includes("paid");
        return stageStr === s.name.toLowerCase();
    })?.name || "Incoming";

    const currentIndex = stageNames.indexOf(currentCoreStage);
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex >= 0 && nextIndex < stageNames.length) {
      const nextStage = stageNames[nextIndex];
      const newJobsState = jobs.map(j => j.id === job.id ? { ...j, stage: nextStage } : j);
      setJobs(newJobsState);
      saveHistoryState(newJobsState);
      await executeStageChange(job, nextStage);
    }
  }

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    e.currentTarget.classList.add("opacity-50", "scale-95");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedJobId(null);
    e.currentTarget.classList.remove("opacity-50", "scale-95");
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    if (!draggedJobId) return;
    const job = jobs.find(j => j.id === draggedJobId);
    if (!job || job.stage === targetStage) return;

    const newJobsState = jobs.map(j => j.id === draggedJobId ? { ...j, stage: targetStage } : j);
    setJobs(newJobsState);
    saveHistoryState(newJobsState);
    await executeStageChange(job, targetStage);
  };

  async function executeStageChange(job: any, targetStage: string) {
    try {
      await supabase.from("job_logs").insert([{ job_id: job.id, from_stage: job.stage, to_stage: targetStage }]);
      await supabase.from("jobs").update({ stage: targetStage, updated_at: new Date() }).eq("id", job.id);
      if (targetStage === "Dispatch") setJobToNotify(job);
    } catch (error) {
      console.error("Error updating stage:", error);
      loadJobs(); 
    }
  }

  async function handleScheduleTask(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleDate || !scheduleTask) return;
    try {
      await supabase.from('todos').insert([{
        job_id: editingJob.id, task: scheduleTask, target_date: scheduleDate,
        target_time: scheduleTime || null, duration_minutes: 60, is_completed: false, is_deleted: false
      }]);
      alert("Task Synced to Calendar & To-Do List!");
      setScheduleTask(""); setScheduleDate(""); setScheduleTime("");
    } catch(err) { alert("Error scheduling task."); }
  }

  const handlePickupWA = () => {
    const cleanPhone = jobToNotify?.quotes?.customers?.phone?.replace(/\D/g, '');
    if (!cleanPhone) { alert("No phone number found."); return; }
    const text = encodeURIComponent(`📦 *ORDER READY* 📦\n\nHi ${jobToNotify?.quotes?.customers?.contact_name || 'there'},\n\nGreat news! Your custom order for *${jobToNotify?.quotes?.customers?.company_name || 'your company'}* (Order #${jobToNotify.job_number}) is finished and ready for pickup.\n\nPlease let us know what time you'd like to swing by the shop.\n\nThank you!\n- YAYA SPORTS INC.`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    setJobToNotify(null); 
  };

  const handlePickupEmail = () => {
    const email = jobToNotify?.quotes?.customers?.email;
    if (!email) { alert("No email found."); return; }
    const subject = encodeURIComponent(`Your YAYA SPORTS Order #${jobToNotify.job_number} is Ready!`);
    const body = encodeURIComponent(`Hi ${jobToNotify?.quotes?.customers?.contact_name || 'there'},\n\nGreat news! Your custom production order for ${jobToNotify?.quotes?.customers?.company_name || 'your company'} (Order #${jobToNotify.job_number}) is finished and ready for pickup.\n\nPlease let us know what time you plan to stop by the shop.\n\nThank you,\n\nYAYA SPORTS INC.\n613-666-YAYA`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    setJobToNotify(null); 
  };

  async function handleManualUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await supabase.from("jobs").update({
      job_number: formData.get("job_number"), title: formData.get("title"),
      due_date: formData.get("due_date"), technical_notes: formData.get("technical_notes"),
    }).eq("id", editingJob.id);
    setEditingJob(null);
    loadJobs();
  }

  async function handleDeleteJob(jobId: string, quoteId: string) {
    const confirmed = window.confirm("⚠️ DELETE THIS ORDER?");
    if (!confirmed) return;
    setEditingJob(null); 
    try {
      await supabase.from("job_logs").delete().eq("job_id", jobId);
      await supabase.from("jobs").delete().eq("id", jobId);
      if (quoteId) {
        const { data: items } = await supabase.from("quote_items").select("id").eq("quote_id", quoteId);
        if (items && items.length > 0) {
          const itemIds = items.map(i => i.id);
          await supabase.from("quote_item_variants").delete().in("quote_item_id", itemIds);
          await supabase.from("quote_items").delete().eq("quote_id", quoteId);
        }
        await supabase.from("quotes").delete().eq("id", quoteId);
      }
      loadJobs();
    } catch (error) { alert("Error deleting."); }
  }

  // --- FILE ATTACHMENT UPLOAD LOGIC ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      alert("Only PDF, JPEG, PNG, or SVG files are allowed.");
      return;
    }
    
    setIsUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingJob.id}-${Math.random()}.${fileExt}`;
      const { error } = await supabase.storage.from('job-attachments').upload(fileName, file);
      if (error) throw error;
      
      const { data: publicUrlData } = supabase.storage.from('job-attachments').getPublicUrl(fileName);
      const url = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from('jobs').update({ attachment_url: url }).eq('id', editingJob.id);
      if (updateError) throw updateError;

      setEditingJob({ ...editingJob, attachment_url: url });
      setJobs(jobs.map(j => j.id === editingJob.id ? { ...j, attachment_url: url } : j));
      alert("File attached to job successfully!");
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleRemoveAttachment = async () => {
    const confirm = window.confirm("Remove this attachment?");
    if (!confirm) return;
    try {
        const { error } = await supabase.from('jobs').update({ attachment_url: null }).eq('id', editingJob.id);
        if (error) throw error;
        setEditingJob({ ...editingJob, attachment_url: null });
        setJobs(jobs.map(j => j.id === editingJob.id ? { ...j, attachment_url: null } : j));
    } catch(err) {
        alert("Failed to remove attachment.");
    }
  };

  const getJobTitle = (job: any) => {
    const items = job.quotes?.quote_items || [];
    if (items.length === 1) return `${items[0].quantity}x ${items[0].description}`;
    return job.title || "Untitled Job";
  };

  return (
    <div className="h-[calc(100vh-70px)] flex flex-col bg-slate-50 dark:bg-[#0f1115] text-slate-900 dark:text-white overflow-hidden relative font-sans transition-colors duration-300">
      
      {/* HEADER */}
      <div className="px-4 md:px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 z-10 flex flex-col gap-4 shrink-0 transition-colors duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex justify-between w-full md:w-auto md:gap-12">
             <div>
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Board Value</div>
               <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter italic">${totalBoardValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
             </div>
             <div className="text-right">
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Output</div>
               <div className="text-xl font-black text-slate-900 dark:text-white tracking-tighter italic">{filteredJobs.length} Jobs</div>
             </div>
          </div>
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center w-full md:w-auto">
            {/* Date preset chips */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl">
              {([
                { id: "today",        label: "Today" },
                { id: "week",         label: "7d" },
                { id: "month",        label: "30d" },
                { id: "after_import", label: "After Apr 7" },
                { id: "all",          label: "All" },
                { id: "custom",       label: "Custom" },
              ] as const).map(p => (
                <button
                  key={p.id}
                  onClick={() => setDatePreset(p.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    datePreset === p.id
                      ? "bg-sky-500 text-white shadow"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date field selector — created_at vs due_date */}
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value as any)}
              className="bg-slate-100 dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 outline-none focus:border-sky-500"
              title="Which date the filter checks against"
            >
              <option value="created_at">By Created</option>
              <option value="due_date">By Due Date</option>
            </select>

            {/* Custom range pickers — only visible in custom mode */}
            {datePreset === "custom" && (
              <div className="flex gap-1 items-center">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-slate-100 dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl py-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 outline-none focus:border-sky-500"
                />
                <span className="text-slate-400 text-[10px] font-black">→</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-slate-100 dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl py-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 outline-none focus:border-sky-500"
                />
              </div>
            )}

            <input
              type="text" placeholder="Search Job #..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-100 dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl py-3 px-5 text-sm w-full md:w-[280px] focus:border-sky-500 outline-none transition-all placeholder-slate-400 dark:placeholder-slate-600 font-bold text-slate-900 dark:text-white shadow-inner"
            />
          </div>
        </div>

        {/* TOP FILTER NAVIGATION */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 snap-x">
          {stages.map(s => {
            // SMART MATCH: Ensure accurate counts
            const count = filteredJobs.filter(j => {
                const stageStr = (j.stage || "").toLowerCase();
                if (s.name === "Incoming") return stageStr.includes("incoming") || stageStr.includes("new");
                if (s.name === "Artwork") return stageStr.includes("art") || stageStr.includes("proof");
                if (s.name === "Sourcing") return stageStr.includes("buy") || stageStr.includes("order") || stageStr.includes("source") || stageStr.includes("receive");
                if (s.name === "Printing") return stageStr.includes("print");
                if (s.name === "Pressing") return stageStr.includes("press");
                if (s.name === "Dispatch") return stageStr.includes("deliver") || stageStr.includes("ship") || stageStr.includes("dispatch") || stageStr.includes("finish") || stageStr.includes("pack");
                if (s.name === "Billing") return stageStr.includes("invoice") || stageStr.includes("bill");
                if (s.name === "Paid") return stageStr.includes("paid");
                return stageStr === s.name.toLowerCase();
            }).length;

            return (
            <button 
              key={s.name} 
              onClick={() => scrollToStage(s.name)} 
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm hover:scale-105 active:scale-95 snap-start ${s.color}`}
            >
              {s.label} <span className="opacity-70 ml-1">({count})</span>
            </button>
          )})}
        </div>
      </div>

      {/* THE DRAG & DROP BOARD */}
      <div className="flex-grow flex gap-6 p-4 md:p-6 overflow-x-auto snap-x snap-mandatory bg-slate-100 dark:bg-[#08090a] custom-scrollbar transition-colors duration-300">
        {stages.map((stage) => {
          
          // SMART MATCH: Catch legacy names and unhide jobs
          const columnJobs = filteredJobs.filter(j => {
              const stageStr = (j.stage || "").toLowerCase();
              if (stage.name === "Incoming") return stageStr.includes("incoming") || stageStr.includes("new");
              if (stage.name === "Artwork") return stageStr.includes("art") || stageStr.includes("proof");
              if (stage.name === "Sourcing") return stageStr.includes("buy") || stageStr.includes("order") || stageStr.includes("source") || stageStr.includes("receive");
              if (stage.name === "Printing") return stageStr.includes("print");
              if (stage.name === "Pressing") return stageStr.includes("press");
              if (stage.name === "Dispatch") return stageStr.includes("deliver") || stageStr.includes("ship") || stageStr.includes("dispatch") || stageStr.includes("finish") || stageStr.includes("pack");
              if (stage.name === "Billing") return stageStr.includes("invoice") || stageStr.includes("bill");
              if (stage.name === "Paid") return stageStr.includes("paid");
              return stageStr === stage.name.toLowerCase();
          });

          return (
            <div 
              id={`column-${stage.name}`} 
              key={stage.name} 
              className={`snap-start w-[85vw] md:w-[320px] flex-shrink-0 flex flex-col rounded-2xl transition-colors duration-300 ${draggedJobId ? 'bg-slate-200 dark:bg-slate-900/30' : ''}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.name)}
            >
              {/* COLUMN HEADER */}
              <div className={`p-4 mb-4 rounded-xl flex justify-between items-center shrink-0 shadow-sm border ${stage.color}`}>
                <h3 className="font-black text-[10px] uppercase tracking-[0.1em]">{stage.label}</h3>
                <span className="text-[10px] bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded font-black">{columnJobs.length}</span>
              </div>

              {/* COLUMN JOBS */}
              <div className="flex-grow flex flex-col gap-4 overflow-y-auto pr-2 pb-20 custom-scrollbar">
                {columnJobs.map((job) => (
                  <div 
                    key={job.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, job.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white dark:bg-slate-900 border-t-[4px] ${stage.accent} p-5 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all group cursor-grab active:cursor-grabbing border-b border-l border-r border-slate-200 dark:border-slate-800`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <button onClick={() => setEditingJob(job)} className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-sky-500 dark:hover:text-sky-400 transition-colors bg-slate-50 dark:bg-black/40 px-2 py-1 rounded">#{job.job_number} ✎</button>
                      <span className="text-[8px] px-2 py-1 bg-slate-100 dark:bg-white/5 rounded font-black text-slate-500">DUE: {job.due_date}</span>
                    </div>
                    <div onClick={() => setEditingJob(job)} className="font-black text-lg mb-1 text-slate-900 dark:text-white leading-none cursor-pointer group-hover:text-sky-500 dark:group-hover:text-sky-400 truncate">{job.quotes?.customers?.company_name || "Internal"}</div>
                    <div className="text-[10px] font-black text-slate-500 mb-4 uppercase truncate">{getJobTitle(job)}</div>
                    
                    <div className="flex justify-between items-center mt-2 border-t border-slate-100 dark:border-white/5 pt-4">
                        <button onClick={(e) => updateStage(e, job, 'back')} className={`px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black rounded-lg transition hover:bg-slate-200 dark:hover:bg-slate-700 uppercase`}>← Back</button>
                        <button onClick={(e) => updateStage(e, job, 'next')} className={`px-4 py-2 ${stage.color} text-[9px] font-black rounded-lg transition hover:scale-105 uppercase shadow-sm`}>Move →</button>
                    </div>
                  </div>
                ))}
                
                {columnJobs.length === 0 && (
                  <div className="h-24 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 flex items-center justify-center opacity-70 bg-white/50 dark:bg-transparent">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Clear</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 🚀 PICKUP NOTIFICATION MODAL */}
      {jobToNotify && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[60]" onClick={() => setJobToNotify(null)}>
          <div className="bg-white dark:bg-[#0f1115] border border-blue-200 dark:border-blue-500/30 rounded-2xl w-full max-w-md shadow-2xl dark:shadow-[0_0_50px_rgba(37,99,235,0.15)] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center border-b border-slate-100 dark:border-white/5">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-500/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-blue-500"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white italic">Order Ready!</h2>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mt-2">{jobToNotify.quotes?.customers?.company_name || 'Client'} • Order #{jobToNotify.job_number}</p>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-black/50 space-y-3">
              <div className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest text-center mb-4">Notify Client for Pickup</div>
              <button onClick={handlePickupWA} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all flex items-center justify-center shadow-md">
                Send WhatsApp
              </button>
              <button onClick={handlePickupEmail} className="w-full bg-sky-600 hover:bg-sky-500 text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all shadow-md">
                Send Email
              </button>
              <button onClick={() => setJobToNotify(null)} className="w-full bg-transparent hover:bg-slate-200 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
                Skip Notification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - EDIT JOB INFORMATION */}
      {editingJob && !jobToNotify && (
        <div className="fixed inset-0 bg-slate-900/80 dark:bg-black/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-8 z-50">
          <div className="bg-white dark:bg-slate-900 border-0 md:border border-slate-200 dark:border-white/10 rounded-none md:rounded-[2.5rem] w-full h-full md:h-[90vh] md:max-w-7xl flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-white/5 shrink-0">
              <div className="flex items-center gap-4">
                  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white italic leading-none">{editingJob.quotes?.customers?.company_name || "Internal Job"}</h2>
                  <div className="text-sky-600 dark:text-sky-500 font-black text-[11px] uppercase tracking-widest bg-sky-100 dark:bg-sky-500/10 px-3 py-1 rounded border border-sky-200 dark:border-sky-500/20">Order #{editingJob.job_number}</div>
              </div>
              <button onClick={() => { setEditingJob(null); setShowMobileIntel(false); }} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-black uppercase bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 px-5 py-3 rounded-lg transition-colors">Close ×</button>
            </div>

            {/* Modal Content Split */}
            <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                
                {/* Left: Interactive Specs & Breakdown */}
                <div className="flex-[1.5] p-6 md:p-8 overflow-y-auto custom-scrollbar border-r border-slate-200 dark:border-white/5 bg-white dark:bg-[#050505] relative">
                    
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Production Specifications</h3>
                    
                    {/* Dynamic Mockup Logic */}
                    {!editingJob.front_view && !editingJob.design_proof ? (
                      <div className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center mb-10 relative group shadow-inner">
                          <i className="material-icons-round text-slate-300 dark:text-slate-700 text-[80px] mb-4 group-hover:text-sky-500 transition-colors duration-500 drop-shadow-sm">design_services</i>
                          <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest text-[10px] text-center mb-6">
                              No Mockup Found for this Order
                          </p>
                          <Link href={`/mockup-v2?jobId=${editingJob.id}`} className="bg-sky-600 hover:bg-sky-500 text-white px-8 py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-lg hover:shadow-sky-500/30 hover:scale-[1.02] transition-all">
                              + Create Mockup For Customer
                          </Link>
                      </div>
                    ) : (
                      <div className="w-full flex gap-4 mb-10 overflow-x-auto pb-4 custom-scrollbar snap-x">
                        {(editingJob.front_view || editingJob.design_proof) && (
                          <div className="min-w-[300px] w-full max-w-[400px] snap-start bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-col items-center shadow-md">
                             <div className="w-full aspect-[4/5] bg-slate-200 dark:bg-black rounded-2xl flex items-center justify-center overflow-hidden mb-3 relative">
                                <img src={editingJob.front_view || editingJob.design_proof} alt="Front View" className="object-contain h-full w-full drop-shadow-xl hover:scale-105 transition-transform duration-500 cursor-zoom-in" onClick={() => window.open(editingJob.front_view || editingJob.design_proof, '_blank')} />
                             </div>
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Front View</span>
                          </div>
                        )}
                        {editingJob.back_view && (
                          <div className="min-w-[300px] w-full max-w-[400px] snap-start bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-col items-center shadow-md">
                             <div className="w-full aspect-[4/5] bg-slate-200 dark:bg-black rounded-2xl flex items-center justify-center overflow-hidden mb-3 relative">
                                <img src={editingJob.back_view} alt="Back View" className="object-contain h-full w-full drop-shadow-xl hover:scale-105 transition-transform duration-500 cursor-zoom-in" onClick={() => window.open(editingJob.back_view, '_blank')} />
                             </div>
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Back View</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ADDITIVE: File Upload Section for Jobs */}
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 mt-8">Job Attachments & Files</h3>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-white/5 p-6 shadow-sm mb-10">
                        {editingJob.attachment_url ? (
                            <div className="flex items-center justify-between bg-white dark:bg-black border border-slate-200 dark:border-white/10 p-4 rounded-xl">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="text-2xl">📎</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">Attached Design File</span>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <a href={editingJob.attachment_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors">View</a>
                                    <button onClick={handleRemoveAttachment} className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">Remove</button>
                                </div>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center relative hover:border-sky-500 transition-colors bg-white dark:bg-transparent">
                                <input type="file" accept=".pdf, .png, .jpg, .jpeg, .svg" onChange={handleFileUpload} disabled={isUploadingFile} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <span className="text-3xl mb-2">📁</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {isUploadingFile ? "Uploading File..." : "Click or Drag to Attach PDF, PNG, JPG, SVG"}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 mt-2">File will be visible to client on their portal</span>
                            </div>
                        )}
                    </div>

                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Garment Breakdown</h3>
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-white/5 p-6 shadow-sm">
                      {editingJob.quotes?.quote_items?.map((qItem: any) => (
                          <div key={qItem.id} className="mb-8 last:mb-0 border-b border-slate-200 dark:border-white/5 last:border-0 pb-6">
                            
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center">
                                {renderGarmentIcon(qItem.description, "#38bdf8")}
                                <span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{qItem.description}</span>
                              </div>
                              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800/50 shadow-sm">{qItem.quantity} PCS</span>
                            </div>
                            
                            <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                              <div className="min-w-[500px]">
                                <div className="grid grid-cols-8 gap-2 text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase text-center mb-2 tracking-widest"><div className="col-span-2 text-left pl-3">Color Info</div><div>S</div><div>M</div><div>L</div><div>XL</div><div>2XL</div><div>3XL</div></div>
                                {qItem.quote_item_variants?.map((v: any) => {
                                  const hex = getColorHex(v.color);
                                  return (
                                  <div key={v.id} className="grid grid-cols-8 gap-2 text-sm font-black text-center bg-white dark:bg-black/60 rounded-xl p-3 mb-2 border border-slate-200 dark:border-white/5 items-center shadow-sm dark:shadow-none">
                                    <div className="col-span-2 text-left text-slate-900 dark:text-white uppercase truncate pl-2 flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" style={{backgroundColor: hex}}></div>
                                        {v.color}
                                    </div>
                                    {["s", "m", "l", "xl", "xxl", "xxxl"].map(size => (
                                        <div key={size} className={v[size] > 0 ? "text-red-600 dark:text-red-500 font-black text-xl drop-shadow-sm" : "text-slate-300 dark:text-slate-800 font-bold"}>
                                            {v[size] || '-'}
                                        </div>
                                    ))}
                                  </div>
                                )})}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>

                </div>

                {/* Right: Data, Scheduling & Timeline */}
                <div className="flex-1 shrink-0 bg-slate-50 dark:bg-slate-950 flex flex-col h-full overflow-y-auto custom-scrollbar">
                    
                    <div className="p-6 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-transparent shadow-sm">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Quick Move Stage</h3>
                        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
                            {stages.map(s => {
                                const isActive = editingJob.stage === s.name;
                                return (
                                    <button 
                                        key={s.name}
                                        type="button"
                                        onClick={(e) => { 
                                            e.preventDefault(); 
                                            executeStageChange(editingJob, s.name); 
                                            setEditingJob({...editingJob, stage: s.name}); 
                                            const newJobsState = jobs.map(j => j.id === editingJob.id ? { ...j, stage: s.name } : j);
                                            setJobs(newJobsState);
                                            saveHistoryState(newJobsState);
                                        }}
                                        className={`py-2.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border shadow-sm flex items-center justify-center text-center ${isActive ? s.color + ' ring-2 ring-sky-500 scale-105 shadow-md' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-white/5 hover:border-slate-400 dark:hover:border-slate-600 opacity-70 hover:opacity-100'}`}
                                    >
                                        {s.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-6 border-b border-slate-200 dark:border-white/5">
                        <h3 className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><span className="text-lg">🗓</span> Schedule Action</h3>
                        <form onSubmit={handleScheduleTask} className="space-y-3">
                            <input 
                                type="text" required value={scheduleTask} onChange={e=>setScheduleTask(e.target.value)} 
                                placeholder="Task (e.g. Pressing)" 
                                className="w-full bg-white dark:bg-black border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors shadow-inner" 
                            />
                            <div className="flex gap-2">
                                <input 
                                    type="date" required value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} 
                                    className="flex-1 bg-white dark:bg-black border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors shadow-inner" 
                                    style={{colorScheme: 'dark'}}
                                />
                                <input 
                                    type="time" value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)} 
                                    className="w-32 bg-white dark:bg-black border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-3 text-xs font-bold text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors shadow-inner" 
                                    style={{colorScheme: 'dark'}}
                                />
                            </div>
                            <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest py-3.5 rounded-lg transition-colors shadow-md mt-2">
                                + Send to To-Do List
                            </button>
                        </form>
                    </div>

                    <form onSubmit={handleManualUpdate} className="p-6 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-transparent shadow-sm">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Order Meta</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Job Name</label>
                                <input name="title" defaultValue={editingJob.title} className="w-full bg-slate-50 dark:bg-black border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Due Date</label>
                                <input name="due_date" type="date" defaultValue={editingJob.due_date} className="w-full bg-slate-50 dark:bg-black border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-sky-500 outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Technical Notes</label>
                                <textarea name="technical_notes" defaultValue={editingJob.technical_notes} rows={3} className="w-full bg-slate-50 dark:bg-black border border-slate-300 dark:border-slate-800 rounded-lg px-4 py-2 text-xs text-slate-900 dark:text-white focus:border-sky-500 outline-none transition-colors custom-scrollbar" placeholder="Add production notes here..." />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button type="submit" className="flex-1 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:bg-slate-600 text-white text-[9px] font-black uppercase tracking-widest py-3 rounded-lg transition-colors">Save Meta</button>
                            <button type="button" onClick={() => handleDeleteJob(editingJob.id, editingJob.quotes?.id)} className="px-4 bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/40 text-red-600 dark:text-red-500 border border-red-200 dark:border-red-500/20 text-[9px] font-black uppercase rounded-lg transition-colors"><i className="material-icons-round text-sm">delete</i></button>
                        </div>
                    </form>

                    <div className="p-6">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Production Timeline</h3>
                        <div className="space-y-5 pb-6">
                           {jobLogs.map((log, i) => (
                             <div key={i} className="relative pl-6 border-l border-slate-300 dark:border-slate-800/50">
                                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
                                <div className="text-xs font-black text-slate-900 dark:text-white leading-none mb-1.5 uppercase tracking-tighter">{log.to_stage}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{new Date(log.created_at).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</div>
                             </div>
                           ))}
                        </div>
                    </div>

                </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}