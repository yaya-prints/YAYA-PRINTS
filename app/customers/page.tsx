"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ============================================================================
// CONSTANTS — PIPELINE, FILTERS, TIERS
// ============================================================================
const PIPELINE_STAGES = [
  { id: "Cold Lead", label: "Cold Leads", short: "Cold", color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/30", ring: "ring-slate-500/40", filters: ["All", "Untouched", "Contacted"] },
  { id: "Meeting Booked", label: "Meetings / Pitches", short: "Meetings", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", ring: "ring-amber-500/40", filters: ["All", "To Follow Up", "Followed Up"] },
  { id: "Quoting", label: "Active Quoting", short: "Quoting", color: "text-fuchsia-500", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30", ring: "ring-fuchsia-500/40", filters: ["All", "Drafting", "Sent"] },
  { id: "Active VIP", label: "Active Clients", short: "Active", color: "text-sky-500", bg: "bg-sky-500/10", border: "border-sky-500/30", ring: "ring-sky-500/40", filters: ["All", "Ordered", "Not Ordered"] }
];

const PRODUCTION_FILTERS = ["All", "Incoming", "Artwork in Approval", "To Buy", "To Print", "To Press", "To Deliver / Pick Up", "To Invoice", "Paid"];

const DB_STAGE_MAP: Record<string, string> = {
  "Incoming": "Incoming",
  "Artwork in Approval": "Artwork",
  "To Buy": "Sourcing",
  "To Print": "Printing",
  "To Press": "Pressing",
  "To Deliver / Pick Up": "Dispatch",
  "To Invoice": "Billing",
  "Paid": "Paid"
};

const VIP_TIERS = [
  { id: "Standard", label: "Standard", discount: 0, color: "text-slate-500 bg-slate-100 border-slate-300 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700" },
  { id: "Bronze", label: "Bronze VIP", discount: 5, color: "text-orange-700 bg-orange-100 border-orange-200 dark:text-orange-500 dark:bg-orange-900/30 dark:border-orange-500/30" },
  { id: "Silver", label: "Silver VIP", discount: 10, color: "text-slate-600 bg-slate-200 border-slate-300 dark:text-slate-300 dark:bg-slate-700 dark:border-slate-600" },
  { id: "Gold", label: "Gold VIP", discount: 15, color: "text-amber-600 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-500/30" },
  { id: "Black Card", label: "Black Card", discount: 20, color: "text-slate-900 bg-slate-200 border-slate-400 dark:text-white dark:bg-slate-900 dark:border-slate-700" }
];

const BATTLE_STAGES: { id: string; label: string; color: string }[] = [
  { id: "Cold Lead",      label: "Contacted",  color: "slate" },
  { id: "Meeting Booked", label: "Interested", color: "amber" },
  { id: "Quoting",        label: "Quoted",     color: "fuchsia" },
  { id: "Quoting",        label: "Sampled",    color: "violet" },
  { id: "Active VIP",     label: "Won",        color: "emerald" },
];
const GILDAN_COLORS = ["White", "Black", "Navy", "Sport Grey", "Red", "Royal", "Dark Heather", "Charcoal", "Forest Green", "Gold", "Maroon", "Safety Pink", "Safety Orange"];
const SIZES = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl"];

// Smart search filters
const SMART_FILTERS = [
  { id: "rotting", label: "🔥 Rotting (>5d)", test: (c: any, q: any[]) => { const d = c.last_contacted_at ? new Date(c.last_contacted_at) : new Date(c.created_at); return Math.floor((Date.now() - d.getTime()) / 86400000) >= 5 && c.lead_status !== 'Active VIP'; } },
  { id: "vip", label: "👑 VIP Only", test: (c: any) => c.vip_tier && c.vip_tier !== "Standard" },
  { id: "owes", label: "💸 Has Balance", test: (c: any, q: any[]) => q.filter(qt => qt.customer_id === c.id && qt.status === "Approved").reduce((s, qt) => s + ((qt.total_amount * 1.13) - (qt.amount_paid || 0)), 0) > 0 },
  { id: "highvalue", label: "💎 High LTV ($1k+)", test: (c: any, q: any[]) => q.filter(qt => qt.customer_id === c.id && qt.status === "Approved").reduce((s, qt) => s + (qt.total_amount * 1.13), 0) >= 1000 },
  { id: "hot", label: "🌶️ Hot Lead (4-5)", test: (c: any) => (c.lead_heat || 0) >= 4 },
];

// ============================================================================
// TOAST SYSTEM (inline, no deps)
// ============================================================================
type ToastType = "success" | "error" | "info" | "undo";
interface Toast { id: string; type: ToastType; message: string; undo?: () => void; }

export default function ClientCRM() {
  // ==========================================================================
  // CORE STATE (all preserved from original)
  // ==========================================================================
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [density, setDensity] = useState<"comfy" | "compact">("comfy");

  // Data
  const [clients, setClients] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSmartFilters, setActiveSmartFilters] = useState<string[]>([]);

  // Views
  const [viewMode, setViewMode] = useState<"overview" | "leads" | "production" | "queue" | "directory" | "library">("library");
  const [dossierTab, setDossierTab] = useState<"pitch" | "quote" | "orders" | "settings" | "brand">("pitch");

  // Column filters
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    "Cold Lead": "All", "Meeting Booked": "All", "Quoting": "All", "Active VIP": "All", "Production": "All"
  });

  // Modals
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddRetailOpen, setIsAddRetailOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; } | null>(null);

  // Bulk select (directory)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Forms
  const [newClient, setNewClient] = useState({ company_name: "", contact_name: "", email: "", phone: "", portal_pin: "", lead_status: "Cold Lead", website: "", address: "", lead_source: "", date_found: new Date().toISOString().split('T')[0] });
  const [newRetail, setNewRetail] = useState({ contact_name: "", phone: "", email: "", company_name: "", lead_source: "", lead_status: "Cold Lead", date_found: new Date().toISOString().split('T')[0] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Toast system
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((type: ToastType, message: string, undo?: () => void) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, type, message, undo }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), type === "undo" ? 8000 : 3500);
  }, []);
  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));

  // Quick-task
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskDate, setQuickTaskDate] = useState("");
  const [isSchedulingTask, setIsSchedulingTask] = useState(false);

  // New quote (dossier)
  const [quoteItems, setQuoteItems] = useState<any[]>([{ searchQuery: "", description: "", showDropdown: false, variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] }]);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);

  // ============================================================================
  // BRAND LIBRARY — logos and documents per customer
  // ============================================================================
  const [customerDocuments, setCustomerDocuments] = useState<any[]>([]); // for the currently-selected client
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");
  const [pendingDocType, setPendingDocType] = useState<string>("Other");
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [librarySort, setLibrarySort] = useState<"name" | "recent" | "ltv">("name");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "with-logo" | "without-logo">("all");

  const DOC_TYPES = ["Brand Guidelines", "Vector / Source Artwork", "Contract / Agreement", "PO / Receipt", "Other"];
  const MAX_LOGO_BYTES = 10 * 1024 * 1024;     // 10 MB
  const MAX_DOC_BYTES = 50 * 1024 * 1024;      // 50 MB

  // True when the URL or file looks like a PDF (logos can now be PDFs)
  const isPdfUrl = (url?: string | null): boolean => {
    if (!url) return false;
    return /\.pdf(\?.*)?$/i.test(url) || url.toLowerCase().includes("pdf");
  };
  // Filename extracted from a public URL (used as the visible label for PDF logos)
  const filenameFromUrl = (url?: string | null): string => {
    if (!url) return "";
    try {
      const clean = url.split("?")[0];
      const last = clean.substring(clean.lastIndexOf("/") + 1);
      return decodeURIComponent(last);
    } catch { return "logo.pdf"; }
  };

  // Force-download a logo using fetch+blob so the browser respects the filename
  // (the `download` HTML attribute is ignored on cross-origin URLs like Supabase).
  // Filename format: "{Company Name} Logo.{ext}"
  const downloadLogo = async (url: string, companyName: string) => {
    if (!url) return;
    try {
      const ext = isPdfUrl(url) ? "pdf" :
        (filenameFromUrl(url).split(".").pop() || "png").toLowerCase();
      const safeCompany = (companyName || "Customer").trim();
      const fname = `${safeCompany} Logo.${ext}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch logo");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Free memory after a tick
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: any) {
      console.error("[downloadLogo]", err);
      toast("error", "Could not download logo");
    }
  };

  // Upload a logo for a client. Replaces any existing logo.
  const handleLogoUpload = useCallback(async (clientId: string, file: File) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast("error", "Logo must be under 10 MB");
      return;
    }
    const isImg = /^image\//.test(file.type) || /\.(svg|png|jpg|jpeg|webp|gif)$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isImg && !isPdf) {
      toast("error", "Logo must be an image (PNG, JPG, SVG, WEBP) or a PDF");
      return;
    }
    setIsUploadingLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${clientId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("customer-logos")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("customer-logos").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: dbErr } = await supabase
        .from("customers")
        .update({ logo_url: url, logo_uploaded_at: new Date().toISOString() })
        .eq("id", clientId);
      if (dbErr) throw dbErr;
      // Update local cache so UI reflects immediately
      setClients((prev: any[]) => prev.map(c => c.id === clientId ? { ...c, logo_url: url } : c));
      if (selectedClient?.id === clientId) {
        setSelectedClient((prev: any) => prev ? { ...prev, logo_url: url } : prev);
      }
      toast("success", "Logo uploaded");
    } catch (err: any) {
      console.error("[logo upload]", err);
      toast("error", err?.message || "Logo upload failed");
    } finally {
      setIsUploadingLogo(false);
    }
  }, [selectedClient]);

  // Remove a logo
  const handleLogoRemove = useCallback(async (clientId: string) => {
    if (!confirm("Remove this logo?")) return;
    try {
      await supabase.from("customers").update({ logo_url: null, logo_uploaded_at: null }).eq("id", clientId);
      setClients((prev: any[]) => prev.map(c => c.id === clientId ? { ...c, logo_url: null } : c));
      if (selectedClient?.id === clientId) {
        setSelectedClient((prev: any) => prev ? { ...prev, logo_url: null } : prev);
      }
      toast("success", "Logo removed");
    } catch (err: any) {
      toast("error", err?.message || "Could not remove logo");
    }
  }, [selectedClient]);

  // Load all documents for the currently-selected client
  const loadCustomerDocuments = useCallback(async (clientId: string) => {
    if (!clientId) return;
    const { data, error } = await supabase
      .from("customer_documents")
      .select("*")
      .eq("customer_id", clientId)
      .order("uploaded_at", { ascending: false });
    if (error) {
      console.error("[load docs]", error);
      return;
    }
    setCustomerDocuments(data || []);
  }, []);

  // Upload a document (any file type, original bytes preserved)
  const handleDocumentUpload = useCallback(async (clientId: string, file: File, docType: string) => {
    if (!file || !clientId) return;
    if (file.size > MAX_DOC_BYTES) {
      toast("error", `File must be under ${MAX_DOC_BYTES / 1024 / 1024} MB`);
      return;
    }
    setIsUploadingDoc(true);
    try {
      // Sanitize the filename for the storage key but keep the original for display
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${clientId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("customer-documents")
        .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("customer_documents").insert([{
        customer_id: clientId,
        file_url: path,                 // store the storage key, not a public URL (private bucket)
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
        doc_type: docType,
      }]);
      if (dbErr) throw dbErr;
      await loadCustomerDocuments(clientId);
      toast("success", `Uploaded ${file.name}`);
    } catch (err: any) {
      console.error("[doc upload]", err);
      toast("error", err?.message || "Upload failed");
    } finally {
      setIsUploadingDoc(false);
    }
  }, [loadCustomerDocuments]);

  // Generate a signed download URL and trigger a download (preserves original bytes + filename)
  const handleDocumentDownload = useCallback(async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("customer-documents")
        .createSignedUrl(doc.file_url, 60); // valid 60s
      if (error || !data?.signedUrl) throw error || new Error("Could not sign URL");
      // Force browser to download with original filename
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.file_name || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("[doc download]", err);
      toast("error", err?.message || "Download failed");
    }
  }, []);

  // Delete a document (storage + DB row)
  const handleDocumentDelete = useCallback(async (doc: any) => {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    try {
      await supabase.storage.from("customer-documents").remove([doc.file_url]);
      await supabase.from("customer_documents").delete().eq("id", doc.id);
      setCustomerDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast("success", "Document deleted");
    } catch (err: any) {
      toast("error", err?.message || "Delete failed");
    }
  }, []);

  // Toggle "share with customer"
  const handleDocumentToggleShare = useCallback(async (doc: any) => {
    try {
      const next = !doc.is_shared_with_customer;
      await supabase.from("customer_documents").update({ is_shared_with_customer: next }).eq("id", doc.id);
      setCustomerDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, is_shared_with_customer: next } : d));
    } catch (err: any) {
      toast("error", err?.message || "Update failed");
    }
  }, []);

  // When a client is selected, load their documents
  useEffect(() => {
    if (selectedClient?.id) {
      loadCustomerDocuments(selectedClient.id);
    } else {
      setCustomerDocuments([]);
    }
  }, [selectedClient?.id, loadCustomerDocuments]);

  // Helper: human-readable file size
  const formatBytes = (bytes: number): string => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  // Helper: file-type icon by mime
  const docTypeIcon = (mime: string, name: string): string => {
    const m = (mime || "").toLowerCase();
    const n = (name || "").toLowerCase();
    if (m.startsWith("image/")) return "🖼";
    if (m.includes("pdf") || n.endsWith(".pdf")) return "📕";
    if (m.includes("zip") || n.endsWith(".zip") || n.endsWith(".rar")) return "🗜";
    if (m.includes("word") || n.endsWith(".doc") || n.endsWith(".docx")) return "📝";
    if (m.includes("sheet") || n.endsWith(".xls") || n.endsWith(".xlsx") || n.endsWith(".csv")) return "📊";
    if (n.endsWith(".ai") || n.endsWith(".eps") || n.endsWith(".psd") || n.endsWith(".svg")) return "🎨";
    if (m.startsWith("video/")) return "🎬";
    if (m.startsWith("audio/")) return "🎵";
    return "📄";
  };


  // Quick order (global)
  const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
  const [qoCustomerSearch, setQoCustomerSearch] = useState("");
  const [qoShowDropdown, setQoShowDropdown] = useState(false);
  const [qoSelectedCustomerId, setQoSelectedCustomerId] = useState("");
  const [qoItems, setQoItems] = useState<any[]>([{ description: "", searchQuery: "", showDropdown: false, variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] }]);
  const [isSavingQo, setIsSavingQo] = useState(false);

  // AI parser
  const [aiOrderText, setAiOrderText] = useState("");
  const [isParsingAI, setIsParsingAI] = useState(false);

  // Production ordering
  const [orderedJobs, setOrderedJobs] = useState<any[]>([]);
  const draggedJobIdx = useRef<number | null>(null);
  const dragOverJobIdx = useRef<number | null>(null);

  // Quick-note state (dossier floating button)
  const [quickNote, setQuickNote] = useState("");
  const [showQuickNote, setShowQuickNote] = useState(false);

  // Autosave indicator (dossier battle plan)
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Command palette search
  const [commandQuery, setCommandQuery] = useState("");

  // Smart filters visibility (collapsed by default to reduce clutter)
  const [showFilters, setShowFilters] = useState(false);


  // ==========================================================================
  // THEME SYNC
  // ==========================================================================
  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    const savedDensity = localStorage.getItem('yaya-density') as "comfy" | "compact" | null;
    const isLight = savedTheme === 'light';
    setIsLightMode(isLight);
    if (savedDensity) setDensity(savedDensity);
    if (isLight) document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
  }, []);

  const toggleUniversalTheme = () => {
    const newMode = !isLightMode;
    setIsLightMode(newMode);
    localStorage.setItem('yaya-theme', newMode ? 'light' : 'dark');
    if (newMode) document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
    window.dispatchEvent(new Event('themeChange'));
  };

  const toggleDensity = () => {
    const next = density === "comfy" ? "compact" : "comfy";
    setDensity(next);
    localStorage.setItem('yaya-density', next);
  };

  // ==========================================================================
  // KEYBOARD SHORTCUTS (new)
  // ==========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes everything
      if (e.key === "Escape") {
        if (isCommandOpen) { setIsCommandOpen(false); return; }
        if (confirmDialog) { setConfirmDialog(null); return; }
        if (isAddClientOpen) { setIsAddClientOpen(false); return; }
        if (isAddRetailOpen) { setIsAddRetailOpen(false); return; }
        if (isQuickOrderOpen) { setIsQuickOrderOpen(false); return; }
        if (selectedClient) { setSelectedClient(null); return; }
      }

      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.tagName === "SELECT");

      // Cmd+K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandOpen(true);
        return;
      }

      if (isTyping) return;

      // "/" focuses search
      if (e.key === "/" && !selectedClient) {
        e.preventDefault();
        const searchInput = document.getElementById("crm-global-search") as HTMLInputElement | null;
        searchInput?.focus();
        return;
      }

      // "n" — new B2B lead
      if (e.key === "n" && !selectedClient) {
        e.preventDefault();
        generatePin();
        setIsAddClientOpen(true);
        return;
      }

      // "q" — quick order
      if (e.key === "q" && !selectedClient) {
        e.preventDefault();
        setIsQuickOrderOpen(true);
        return;
      }

      // "r" — retail lead
      if (e.key === "r" && !selectedClient) {
        e.preventDefault();
        setIsAddRetailOpen(true);
        return;
      }

      // 1-4 — switch views
      if (!selectedClient) {
        if (e.key === "1") { setViewMode("overview"); return; }
        if (e.key === "2") { setViewMode("leads"); return; }
        if (e.key === "3") { setViewMode("production"); return; }
        if (e.key === "4") { setViewMode("library"); return; }
        if (e.key === "5") { setViewMode("directory"); return; }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommandOpen, confirmDialog, isAddClientOpen, isAddRetailOpen, isQuickOrderOpen, selectedClient]);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: clientsData, error: cError } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (cError) throw cError;
      if (clientsData) setClients(clientsData);

      const { data: quotesData, error: qError } = await supabase.from("quotes").select("id, customer_id, created_at, total_amount, amount_paid, status, quote_items(description, quantity, quote_item_variants(color, xs, s, m, l, xl, xxl, xxxl, xxxxl, xxxxxl))");
      if (qError) throw qError;
      if (quotesData) setQuotes(quotesData);

      const { data: jobsData, error: jError } = await supabase.from("jobs").select("*");
      if (jError) throw jError;
      if (jobsData) setJobs(jobsData);

      const { data: catData, error: catError } = await supabase.from("catalog_items").select("*").order('name');
      if (catError) throw catError;
      if (catData) setCatalog(catData);
    } catch (error) {
      console.error("Error fetching CRM data:", error);
      toast("error", "Failed to load CRM data. Check connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  // Sync active jobs for production queue
  useEffect(() => {
    const active = jobs.filter(j => !["Dispatch", "Billing", "Paid", "Completed", "Delivered"].includes(j.stage));
    active.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    setOrderedJobs(active);
  }, [jobs]);

  // ==========================================================================
  // JOB PRIORITY (preserved)
  // ==========================================================================
  const handleJobDropSort = async () => {
    if (draggedJobIdx.current === null || dragOverJobIdx.current === null) return;
    const newOrdered = [...orderedJobs];
    const draggedItem = newOrdered.splice(draggedJobIdx.current, 1)[0];
    newOrdered.splice(dragOverJobIdx.current, 0, draggedItem);
    setOrderedJobs(newOrdered);
    try {
      for (let i = 0; i < newOrdered.length; i++) {
        await supabase.from("jobs").update({ sort_order: i + 1 }).eq("id", newOrdered[i].id);
      }
    } catch (err) { console.error("Error saving job order:", err); }
    draggedJobIdx.current = null;
    dragOverJobIdx.current = null;
  };

  const handlePriorityChange = async (jobId: string, newPositionZeroIndexed: number) => {
    const currentIdx = orderedJobs.findIndex(j => j.id === jobId);
    if (currentIdx === -1 || currentIdx === newPositionZeroIndexed) return;
    const newOrdered = [...orderedJobs];
    const [movedItem] = newOrdered.splice(currentIdx, 1);
    newOrdered.splice(newPositionZeroIndexed, 0, movedItem);
    setOrderedJobs(newOrdered);
    try {
      for (let i = 0; i < newOrdered.length; i++) {
        await supabase.from("jobs").update({ sort_order: i + 1 }).eq("id", newOrdered[i].id);
      }
      toast("success", `Job moved to priority #${newPositionZeroIndexed + 1}`);
    } catch (err) { console.error("Error saving job order:", err); }
  };


  // ==========================================================================
  // COMPUTATIONS (memoized — replaces per-render recalc)
  // ==========================================================================
  const getClientFinancials = useCallback((clientId: string) => {
    const clientQuotes = quotes.filter(q => q.customer_id === clientId && q.status === "Approved");
    const lifetimeSpend = clientQuotes.reduce((sum, q) => sum + (q.total_amount * 1.13), 0);
    const outstandingBalance = clientQuotes.reduce((sum, q) => sum + ((q.total_amount * 1.13) - (q.amount_paid || 0)), 0);
    const orderCount = clientQuotes.length;
    const aov = orderCount > 0 ? lifetimeSpend / orderCount : 0;
    return { lifetimeSpend, outstandingBalance, orderCount, aov };
  }, [quotes]);

  const getVipTierConfig = (tierId: string) => VIP_TIERS.find(t => t.id === tierId) || VIP_TIERS[0];

  const checkLeadRot = useCallback((client: any) => {
    if (!client.created_at && !client.last_contacted_at) return false;
    const dateToCompare = client.last_contacted_at ? new Date(client.last_contacted_at) : new Date(client.created_at);
    const daysSinceContact = Math.floor((new Date().getTime() - dateToCompare.getTime()) / 86400000);
    return daysSinceContact >= 5 && client.lead_status !== 'Active VIP';
  }, []);

  const daysSinceContact = useCallback((client: any) => {
    const d = client.last_contacted_at ? new Date(client.last_contacted_at) : new Date(client.created_at);
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }, []);

  // ==========================================================================
  // ACTIONS — ADD/EDIT/DELETE (preserved + improved)
  // ==========================================================================
  const generatePin = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setNewClient(prev => ({ ...prev, portal_pin: pin }));
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("customers").insert([{
        company_name: newClient.company_name, contact_name: newClient.contact_name, email: newClient.email, phone: newClient.phone,
        website: newClient.website, address: newClient.address, lead_source: newClient.lead_source, date_found: newClient.date_found,
        portal_pin: newClient.portal_pin || "1234", lead_status: newClient.lead_status,
        vip_tier: "Standard", discount_percent: 0, brand_vault_url: "", last_contacted_at: new Date().toISOString()
      }]);
      if (error) throw error;
      setIsAddClientOpen(false);
      setNewClient({ company_name: "", contact_name: "", email: "", phone: "", portal_pin: "", lead_status: "Cold Lead", website: "", address: "", lead_source: "", date_found: new Date().toISOString().split('T')[0] });
      fetchData();
      toast("success", `✓ ${newClient.company_name} added to pipeline`);
    } catch (err) {
      toast("error", "Failed to add client. Email must be unique.");
    } finally { setIsSubmitting(false); }
  };

  const handleAddRetail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("customers").insert([{
        company_name: newRetail.company_name || newRetail.contact_name, contact_name: newRetail.contact_name,
        email: newRetail.email || null, phone: newRetail.phone, lead_source: newRetail.lead_source, date_found: newRetail.date_found,
        portal_pin: "0000", lead_status: newRetail.lead_status, vip_tier: "Standard", discount_percent: 0,
        brand_vault_url: "", last_contacted_at: new Date().toISOString()
      }]);
      if (error) throw error;
      setIsAddRetailOpen(false);
      setNewRetail({ contact_name: "", phone: "", email: "", company_name: "", lead_source: "", lead_status: "Cold Lead", date_found: new Date().toISOString().split('T')[0] });
      fetchData();
      toast("success", `✓ Retail lead ${newRetail.contact_name} added`);
    } catch (err) {
      toast("error", "Failed to add retail customer.");
    } finally { setIsSubmitting(false); }
  };

  const handleUpdateClientSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setIsSavingSettings(true);
    setAutosaveState("saving");
    try {
      const { error } = await supabase.from("customers").update({
        vip_tier: selectedClient.vip_tier, discount_percent: selectedClient.discount_percent, brand_vault_url: selectedClient.brand_vault_url,
        owner_name: selectedClient.owner_name, best_reach_time: selectedClient.best_reach_time, interest_notes: selectedClient.interest_notes,
        uniforms_history: selectedClient.uniforms_history, discussed_price: selectedClient.discussed_price,
        potential_quantity: selectedClient.potential_quantity, estimated_cost: selectedClient.estimated_cost,
        lead_heat: selectedClient.lead_heat, lead_battle_stage: selectedClient.lead_battle_stage,
        last_contacted_at: new Date().toISOString(),
        pain_price: selectedClient.pain_price, pain_quality: selectedClient.pain_quality,
        pain_speed: selectedClient.pain_speed, pain_service: selectedClient.pain_service
      }).eq("id", selectedClient.id);
      if (error) throw error;
      setClients(clients.map(c => c.id === selectedClient.id ? { ...c, ...selectedClient, last_contacted_at: new Date().toISOString() } : c));
      setAutosaveState("saved");
      toast("success", "✓ Intelligence saved");
      setTimeout(() => setAutosaveState("idle"), 2000);
    } catch (err) {
      toast("error", "Failed to update client settings.");
      setAutosaveState("idle");
    } finally { setIsSavingSettings(false); }
  };

  const copyLoginDetails = (client: any) => {
    const magicLink = `${window.location.origin}/portal?auto_email=${encodeURIComponent(client.email)}&auto_pin=${client.portal_pin}`;
    const text = `Welcome to the YAYA Prints B2B Portal!\n\nAccess your live order tracking, brand vault, and 1-click quote approvals right here:\n\n✨ SECURE MAGIC LINK (1-Click Login):\n🔗 ${magicLink}\n\n(If you need to log in manually from another device, your PIN is: ${client.portal_pin})`;
    navigator.clipboard.writeText(text);
    toast("success", `📋 Magic link copied for ${client.company_name}`);
  };

  const generateAIPitchEmail = (client: any) => {
    if (!client.email) return "#";
    const targetName = client.owner_name ? client.owner_name.split(' ')[0] : "Team";
    const subject = encodeURIComponent(`Elevating ${client.company_name}'s Custom Apparel`);
    let painPoints: string[] = [];
    if (client.pain_price) painPoints.push("pricing structures");
    if (client.pain_quality) painPoints.push("inconsistent garment quality");
    if (client.pain_speed) painPoints.push("unreliable turnaround times");
    if (client.pain_service) painPoints.push("lack of communication");
    let painText = "";
    if (painPoints.length > 0) {
      const formattedPains = painPoints.join(", ").replace(/,([^,]*)$/, ' and$1');
      painText = `I know dealing with ${formattedPains} from previous suppliers can be incredibly frustrating. `;
    }
    let priceText = client.discussed_price > 0 ? `Based on our chat, we can comfortably execute your vision within the $${client.discussed_price} budget we discussed. ` : "";
    const body = encodeURIComponent(`Hi ${targetName},\n\nIt was great connecting about ${client.company_name}'s apparel needs.\n\n${painText}${priceText}At YAYA Prints, we've built a custom B2B infrastructure specifically to solve these issues for businesses like yours. I'd love to put together a visual matrix quote for you to review.\n\nLet me know if you have a few minutes on ${client.best_reach_time || 'Tuesday'} to lock in the details.\n\nBest,\n- YAYA Prints`);
    return `mailto:${client.email}?subject=${subject}&body=${body}`;
  };

  const handleLoginAsClient = () => {
    if (!selectedClient) return;
    navigator.clipboard.writeText(`${selectedClient.email}\n${selectedClient.portal_pin}`);
    toast("info", `Credentials copied. Portal opening in new tab.`);
    window.open('/portal', '_blank');
  };

  // One-click reminder: creates a todo N days out and stamps last_contacted_at
  const handleQuickReminder = async (days: number) => {
    if (!selectedClient) return;
    const target = new Date();
    target.setDate(target.getDate() + days);
    const targetDate = target.toISOString().split('T')[0];
    try {
      const { error } = await supabase.from("todos").insert([{
        task: `Follow up: ${selectedClient.company_name}`,
        target_date: targetDate,
        target_time: "09:00:00",
        duration_minutes: 15,
        is_deleted: false,
        is_completed: false
      }]);
      if (error) throw error;
      // Also stamp last_contacted_at so rotting logic resets
      const nowISO = new Date().toISOString();
      await supabase.from("customers").update({ last_contacted_at: nowISO }).eq("id", selectedClient.id);
      setClients(clients.map(c => c.id === selectedClient.id ? { ...c, last_contacted_at: nowISO } : c));
      setSelectedClient({ ...selectedClient, last_contacted_at: nowISO });
      toast("success", `⏰ Reminder set for ${days}d out`);
    } catch (err: any) {
      toast("error", `Failed to set reminder: ${err.message}`);
    }
  };

  const handleScheduleAttack = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim() || !selectedClient) return;
    setIsSchedulingTask(true);
    try {
      const { error } = await supabase.from("todos").insert([{
        task: `[LEAD FOLLOW-UP] ${quickTaskTitle} - ${selectedClient.company_name}`,
        target_date: quickTaskDate || new Date().toISOString().split('T')[0],
        target_time: "09:00:00", duration_minutes: 30, is_deleted: false, is_completed: false
      }]);
      if (error) throw error;
      toast("success", "⚔️ Attack scheduled on Action Board");
      setQuickTaskTitle(""); setQuickTaskDate("");
    } catch (err: any) {
      toast("error", `Failed to schedule: ${err.message}`);
    } finally { setIsSchedulingTask(false); }
  };


  // ==========================================================================
  // DOSSIER QUOTE ENGINE (preserved)
  // ==========================================================================
  const handleQuoteItemChange = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...quoteItems]; (updated[index] as any)[field] = value; setQuoteItems(updated);
  };
  const handleAddQuoteItem = () => setQuoteItems([...quoteItems, { searchQuery: "", description: "", showDropdown: false, variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] }]);
  const handleRemoveQuoteItem = (index: number) => { if (quoteItems.length > 1) { const u = [...quoteItems]; u.splice(index, 1); setQuoteItems(u); } };
  const addQuoteColorVariant = (itemIdx: number) => {
    const n = [...quoteItems]; const last = n[itemIdx].variants[n[itemIdx].variants.length - 1];
    n[itemIdx].variants.push({ color: "White", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: last.regular_price, unit_price: last.unit_price });
    setQuoteItems(n);
  };
  const updateQuoteVariant = (itemIdx: number, varIdx: number, field: string, value: any) => {
    const n = [...quoteItems]; n[itemIdx].variants[varIdx][field] = value; setQuoteItems(n);
  };
  const selectQuoteProduct = (itemIdx: number, product: any) => {
    const n = [...quoteItems];
    n[itemIdx].description = product.name; n[itemIdx].searchQuery = product.name; n[itemIdx].showDropdown = false;
    const dm = selectedClient && selectedClient.discount_percent ? (100 - selectedClient.discount_percent) / 100 : 1;
    const dp = parseFloat((product.default_price * dm).toFixed(2));
    n[itemIdx].variants = n[itemIdx].variants.map((v: any) => ({ ...v, regular_price: product.default_price, unit_price: dp }));
    setQuoteItems(n);
  };
  const handleAddMissingCatalogItem = async (itemIdx: number, itemName: string) => {
    try {
      const { data: ci, error } = await supabase.from("catalog_items").insert([{ name: itemName, default_price: 0, category: "Custom Insert" }]).select().single();
      if (error) throw error;
      setCatalog(prev => [...prev, ci].sort((a, b) => a.name.localeCompare(b.name)));
      selectQuoteProduct(itemIdx, ci);
      toast("success", `✓ Added "${itemName}" to catalog`);
    } catch (err) { toast("error", "Failed to add catalog item."); }
  };

  const calcVarQty = (v: any) => v.xs + v.s + v.m + v.l + v.xl + v.xxl + v.xxxl + v.xxxxl + v.xxxxxl;
  const calcVarTotal = (v: any) => calcVarQty(v) * v.unit_price;
  const calcItemTotal = (item: any) => item.variants.reduce((sum: number, v: any) => sum + calcVarTotal(v), 0);
  const calcQuoteGrandTotal = () => quoteItems.reduce((sum, item) => sum + calcItemTotal(item), 0);

  const handleSaveMatrixQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setIsCreatingQuote(true);
    try {
      const { data: quote, error: qError } = await supabase.from("quotes").insert([{ customer_id: selectedClient.id, total_amount: calcQuoteGrandTotal(), status: "Approved", internal_notes: "Generated via CRM Dossier." }]).select().single();
      if (qError) throw qError;
      let totalUnits = 0;
      for (const item of quoteItems) {
        const itemTotalQty = item.variants.reduce((sum: number, v: any) => sum + calcVarQty(v), 0);
        if (itemTotalQty === 0) continue;
        totalUnits += itemTotalQty;
        const { data: qItem, error: iError } = await supabase.from("quote_items").insert([{ quote_id: quote.id, description: item.description, quantity: itemTotalQty, unit_price: item.variants[0].unit_price }]).select().single();
        if (iError) throw iError;
        const variantEntries = item.variants.map((v: any) => ({
          quote_item_id: qItem.id, color: v.color, regular_price: v.regular_price, unit_price: v.unit_price,
          xs: v.xs, s: v.s, m: v.m, l: v.l, xl: v.xl, xxl: v.xxl, xxxl: v.xxxl, xxxxl: v.xxxxl, xxxxxl: v.xxxxxl
        }));
        const { error: vError } = await supabase.from("quote_item_variants").insert(variantEntries);
        if (vError) throw vError;
      }
      const jobNum = Math.floor(1000 + Math.random() * 9000);
      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);
      await supabase.from("jobs").insert([{ quote_id: quote.id, job_number: jobNum, title: `${totalUnits}x MATRIX ORDER`, stage: "Incoming", due_date: dueDate.toISOString().split('T')[0] }]);
      toast("success", "✅ Order approved & sent to shop floor");
      setQuoteItems([{ searchQuery: "", description: "", showDropdown: false, variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] }]);
      setDossierTab("orders");
      fetchData();
    } catch (err: any) { toast("error", "Failed to save quote: " + err.message);
    } finally { setIsCreatingQuote(false); }
  };

  // ==========================================================================
  // QUICK ORDER ENGINE (preserved)
  // ==========================================================================
  const addQoLineItem = () => setQoItems([...qoItems, { description: "", searchQuery: "", showDropdown: false, variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] }]);
  const addQoColorVariant = (itemIdx: number) => {
    const n = [...qoItems]; const last = n[itemIdx].variants[n[itemIdx].variants.length - 1];
    n[itemIdx].variants.push({ color: "White", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: last.regular_price, unit_price: last.unit_price });
    setQoItems(n);
  };
  const updateQoItem = (itemIdx: number, field: string, value: any) => { const n = [...qoItems]; n[itemIdx][field] = value; setQoItems(n); };
  const updateQoVariant = (itemIdx: number, varIdx: number, field: string, value: any) => { const n = [...qoItems]; n[itemIdx].variants[varIdx][field] = value; setQoItems(n); };
  const selectQoProduct = (itemIdx: number, product: any) => {
    const n = [...qoItems]; n[itemIdx].description = product.name; n[itemIdx].searchQuery = product.name; n[itemIdx].showDropdown = false;
    const cust = clients.find(c => c.id === qoSelectedCustomerId);
    const dm = cust && cust.discount_percent ? (100 - cust.discount_percent) / 100 : 1;
    const dp = parseFloat((product.default_price * dm).toFixed(2));
    n[itemIdx].variants = n[itemIdx].variants.map((v: any) => ({ ...v, regular_price: product.default_price, unit_price: dp }));
    setQoItems(n);
  };
  const calcQoVarQty = (v: any) => v.xs + v.s + v.m + v.l + v.xl + v.xxl + v.xxxl + v.xxxxl + v.xxxxxl;
  const calcQoVarTotal = (v: any) => calcQoVarQty(v) * v.unit_price;
  const calcQoItemTotal = (item: any) => item.variants.reduce((sum: number, v: any) => sum + calcQoVarTotal(v), 0);
  const calcQoGrandTotal = () => qoItems.reduce((sum, item) => sum + calcQoItemTotal(item), 0);
  const calcQoTotalSavings = () => qoItems.reduce((sum, item) => sum + item.variants.reduce((vSum: number, v: any) => vSum + calcQoVarQty(v) * (Math.max(0, v.regular_price - v.unit_price)), 0), 0);

  const handleSaveQuickOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qoSelectedCustomerId) return toast("error", "Please select a customer first.");
    setIsSavingQo(true);
    try {
      const { data: quote, error: qError } = await supabase.from("quotes").insert([{ customer_id: qoSelectedCustomerId, total_amount: calcQoGrandTotal(), status: "Approved", internal_notes: "Generated via Global Quick Order." }]).select().single();
      if (qError) throw qError;
      let totalUnits = 0;
      for (const item of qoItems) {
        if (!item.description.trim()) continue;
        const itemTotalQty = item.variants.reduce((sum: number, v: any) => sum + calcQoVarQty(v), 0);
        if (itemTotalQty === 0) continue;
        totalUnits += itemTotalQty;
        const { data: qItem, error: iError } = await supabase.from("quote_items").insert([{ quote_id: quote.id, description: item.description, quantity: itemTotalQty, unit_price: item.variants[0].unit_price }]).select().single();
        if (iError) throw iError;
        const variantEntries = item.variants.map((v: any) => ({
          quote_item_id: qItem.id, color: v.color, regular_price: v.regular_price, unit_price: v.unit_price,
          xs: v.xs, s: v.s, m: v.m, l: v.l, xl: v.xl, xxl: v.xxl, xxxl: v.xxxl, xxxxl: v.xxxxl, xxxxxl: v.xxxxxl
        }));
        const { error: vError } = await supabase.from("quote_item_variants").insert(variantEntries);
        if (vError) throw vError;
      }
      const jobNum = Math.floor(1000 + Math.random() * 9000);
      const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);
      await supabase.from("jobs").insert([{ quote_id: quote.id, job_number: jobNum, title: `${totalUnits}x QUICK ORDER`, stage: "Incoming", due_date: dueDate.toISOString().split('T')[0] }]);
      toast("success", "✅ Order approved & sent to shop floor");
      setIsQuickOrderOpen(false);
      setQoItems([{ description: "", searchQuery: "", showDropdown: false, variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] }]);
      setQoSelectedCustomerId(""); setQoCustomerSearch("");
      fetchData();
    } catch (err: any) { toast("error", "Failed to save Quick Order: " + err.message);
    } finally { setIsSavingQo(false); }
  };

  const handleAIParseOrder = async () => {
    if (!aiOrderText.trim()) return;
    setIsParsingAI(true);
    try {
      const res = await fetch('/api/parse-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: aiOrderText }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reach AI parser");
      if (data.items && Array.isArray(data.items)) {
        const cust = clients.find(c => c.id === qoSelectedCustomerId);
        const dm = cust && cust.discount_percent ? (100 - cust.discount_percent) / 100 : 1;
        const newQoItems = data.items.map((aiItem: any) => {
          const aiDescLower = (aiItem.description || "").toLowerCase();
          const matched = catalog.find(p => p.name.toLowerCase().includes(aiDescLower) || aiDescLower.includes(p.name.toLowerCase()));
          const basePrice = matched ? matched.default_price : 0;
          const dp = parseFloat((basePrice * dm).toFixed(2));
          const getQty = (val: any) => { const p = parseInt(val); return isNaN(p) ? 0 : p; };
          return {
            description: matched ? matched.name : (aiItem.description || "Custom Garment"),
            searchQuery: matched ? matched.name : (aiItem.description || "Custom Garment"),
            showDropdown: !matched,
            variants: [{
              color: aiItem.color || "Black",
              xs: getQty(aiItem.sizes?.xs), s: getQty(aiItem.sizes?.s), m: getQty(aiItem.sizes?.m), l: getQty(aiItem.sizes?.l),
              xl: getQty(aiItem.sizes?.xl), xxl: getQty(aiItem.sizes?.xxl), xxxl: getQty(aiItem.sizes?.xxxl),
              xxxxl: getQty(aiItem.sizes?.xxxxl), xxxxxl: getQty(aiItem.sizes?.xxxxxl),
              regular_price: basePrice, unit_price: dp
            }]
          };
        });
        setQoItems(newQoItems);
        setAiOrderText("");
        toast("success", `🪄 AI extracted ${newQoItems.length} items`);
      }
    } catch (err: any) {
      toast("error", "AI Parsing failed: " + (err.message || "Unknown error"));
    } finally { setIsParsingAI(false); }
  };


  // ==========================================================================
  // FORMATTERS & DRAG HANDLERS
  // ==========================================================================
  const formatItemSummary = (input: any) => {
    // Accept an items array directly, or a job/quote object with a .quote_items array
    const items = Array.isArray(input) ? input : (input && Array.isArray(input.quote_items) ? input.quote_items : null);
    if (!items || items.length === 0) return "No items";
    return items.map((i: any) => {
      let total = 0;
      if (Array.isArray(i.quote_item_variants)) {
        total = i.quote_item_variants.reduce((sum: number, v: any) => sum + (v.xs || 0) + (v.s || 0) + (v.m || 0) + (v.l || 0) + (v.xl || 0) + (v.xxl || 0) + (v.xxxl || 0) + (v.xxxxl || 0) + (v.xxxxxl || 0), 0);
      }
      return `${total > 0 ? total : (i.quantity || 0)}x ${i.description || "Item"}`;
    }).join(" • ");
  };

  const handleDragStart = (e: React.DragEvent, clientId: string) => { e.dataTransfer.setData("clientId", clientId); };
  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const clientId = e.dataTransfer.getData("clientId");
    if (!clientId) return;
    const cur = clients.find(c => c.id === clientId);
    if (!cur || cur.lead_status === targetStage) return;
    try {
      setClients(clients.map(c => c.id === clientId ? { ...c, lead_status: targetStage } : c));
      await supabase.from("customers").update({ lead_status: targetStage }).eq("id", clientId);
      toast("success", `✓ ${cur.company_name} → ${targetStage}`);
    } catch (err) { fetchData(); }
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleJobDragStart = (e: React.DragEvent, jobId: string) => { e.dataTransfer.setData("jobId", jobId); };
  const handleJobStageDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("jobId");
    if (!jobId) return;
    try {
      setJobs(jobs.map(j => j.id === jobId ? { ...j, stage: targetStage } : j));
      await supabase.from("jobs").update({ stage: targetStage }).eq("id", jobId);
    } catch (err) { fetchData(); }
  };

  // ADDITIVE: Manual Payment Override for CRM
  const handleOverridePayment = async (quoteId: string, isPaid: boolean, quoteTotal: number) => {
    const newAmount = isPaid ? quoteTotal * 1.13 : 0;
    try {
      setQuotes(quotes.map(q => q.id === quoteId ? { ...q, amount_paid: newAmount } : q));
      await supabase.from("quotes").update({ amount_paid: newAmount }).eq("id", quoteId);
      toast("success", `Marked as ${isPaid ? 'Paid' : 'Unpaid'}`);
    } catch (err) { toast("error", "Failed to override payment"); }
  };

  // ADDITIVE: Inline Job Stage Edit & Manual Payment Override
  const handleUpdateJobStageInline = async (jobId: string, newStage: string) => {
    try {
      setJobs(jobs.map(j => j.id === jobId ? { ...j, stage: newStage } : j));
      await supabase.from("jobs").update({ stage: newStage }).eq("id", jobId);
      toast("success", `Order moved to ${newStage}`);
    } catch (err) { toast("error", "Failed to update stage"); }
  };

  // ==========================================================================
  // FILTERING — search + smart filters combined
  // ==========================================================================
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const q = searchQuery.toLowerCase();
      if (q && !(c.company_name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))) return false;
      for (const fid of activeSmartFilters) {
        const f = SMART_FILTERS.find(sf => sf.id === fid);
        if (f && !f.test(c, quotes)) return false;
      }
      return true;
    });
  }, [clients, searchQuery, activeSmartFilters, quotes]);

  const qoFilteredCustomers = clients.filter(c => c.company_name?.toLowerCase().includes(qoCustomerSearch.toLowerCase()));

  // ==========================================================================
  // THEME TOKENS
  // ==========================================================================
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

  // ==========================================================================
  // METRICS
  // ==========================================================================
  const globalTotalClients = clients.length;
  const globalOutstanding = quotes.filter(q => q.status === "Approved").reduce((sum, q) => sum + ((q.total_amount * 1.13) - (q.amount_paid || 0)), 0);
  const globalLTV = quotes.filter(q => q.status === "Approved").reduce((sum, q) => sum + (q.total_amount * 1.13), 0);
  const globalWeightedPipeline = clients.reduce((sum, client) => {
    const price = parseFloat(client.discussed_price) || 0;
    let mult = 0;
    if (client.lead_status === 'Cold Lead') mult = 0.10;
    else if (client.lead_status === 'Meeting Booked') mult = 0.30;
    else if (client.lead_status === 'Quoting') mult = 0.60;
    return sum + (price * mult);
  }, 0);

  const activeJobsList = selectedClient ? jobs.filter(j => {
    const ids = quotes.filter(q => q.customer_id === selectedClient.id).map(q => q.id);
    return ids.includes(j.quote_id) && !["Dispatch", "Billing", "Paid", "Completed"].includes(j.stage);
  }) : [];

  const totalLeadsCount = filteredClients.filter(c => ["Cold Lead", "Meeting Booked", "Quoting", "Active VIP"].includes(c.lead_status || "Active VIP")).length;
  const activeProductionCount = orderedJobs.length;

  // ⚠️ SMART INBOX — what needs attention TODAY
  const rottingLeads = useMemo(() => clients.filter(c => checkLeadRot(c) && c.lead_status !== 'Active VIP').sort((a, b) => daysSinceContact(b) - daysSinceContact(a)).slice(0, 5), [clients, checkLeadRot, daysSinceContact]);
  const overdueJobs = useMemo(() => orderedJobs.filter(j => j.due_date && new Date(j.due_date) < new Date()).slice(0, 5), [orderedJobs]);
  const arOwedClients = useMemo(() => clients.map(c => ({ c, fin: getClientFinancials(c.id) })).filter(x => x.fin.outstandingBalance > 0).sort((a, b) => b.fin.outstandingBalance - a.fin.outstandingBalance).slice(0, 5), [clients, getClientFinancials]);
  const attentionCount = rottingLeads.length + overdueJobs.length + arOwedClients.length;


  // ==========================================================================
  // RENDER HELPERS — reusable card components inline
  // ==========================================================================
  const LeadCard = ({ client, compact = false }: { client: any, compact?: boolean }) => {
    const { lifetimeSpend, aov, outstandingBalance } = getClientFinancials(client.id);
    const vip = getVipTierConfig(client.vip_tier || "Standard");
    const isRotting = checkLeadRot(client);
    const days = daysSinceContact(client);
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, client.id)}
        onClick={() => { setSelectedClient(client); setDossierTab("pitch"); }}
        className={`group ${compact ? 'p-2' : 'p-3'} rounded-xl border ${theme.border} cursor-pointer transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-sky-500/50 ${isLightMode ? 'bg-slate-50' : 'bg-slate-900/40'} relative`}
      >
        {isRotting && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center shadow-lg ring-2 ring-red-500/30" title={`${days} days no contact`}>
            {days}d
          </div>
        )}
        <div className="flex justify-between items-start mb-1.5">
          <div className="flex items-center gap-1.5 pr-2 overflow-hidden">
            <h4 className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-black uppercase tracking-tighter truncate ${isRotting ? 'text-red-500' : theme.textStrong}`}>{client.company_name}</h4>
          </div>
          {client.vip_tier && client.vip_tier !== "Standard" && (
            <span className={`shrink-0 text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded border ${vip.color}`}>{vip.label}</span>
          )}
        </div>
        {!compact && (
          <span className={`text-[9px] font-bold truncate block ${theme.textMuted}`}>{client.contact_name}</span>
        )}
        <div className="flex gap-3 mt-1.5 border-t border-inherit pt-1.5">
          <div className="flex flex-col">
            <span className={`text-[7px] font-black uppercase tracking-widest ${theme.textMuted}`}>LTV</span>
            <span className={`text-[9px] font-black ${theme.textStrong}`}>${lifetimeSpend.toFixed(0)}</span>
          </div>
          <div className="flex flex-col border-l border-inherit pl-3">
            <span className={`text-[7px] font-black uppercase tracking-widest ${theme.textMuted}`}>AOV</span>
            <span className={`text-[9px] font-black ${theme.textStrong}`}>${aov.toFixed(0)}</span>
          </div>
          {outstandingBalance > 0 && (
            <div className="flex flex-col border-l border-inherit pl-3">
              <span className="text-[7px] font-black uppercase tracking-widest text-red-500">A/R</span>
              <span className="text-[9px] font-black text-red-500">${outstandingBalance.toFixed(0)}</span>
            </div>
          )}
        </div>
        {/* Quick actions (hover) */}
        <div className={`mt-2 pt-2 border-t border-inherit flex gap-1 ${compact ? 'hidden group-hover:flex' : 'flex'}`}>
          {client.phone && (
            <a href={`tel:${client.phone}`} onClick={(e) => e.stopPropagation()} className="flex-1 text-center py-1 rounded-md text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors" title="Call">📞 Call</a>
          )}
          {client.email && (
            <a href={generateAIPitchEmail(client)} onClick={(e) => e.stopPropagation()} className="flex-1 text-center py-1 rounded-md text-[8px] font-black uppercase tracking-widest bg-sky-500/10 text-sky-500 hover:bg-sky-500 hover:text-white transition-colors" title="AI Pitch Email">✨ Pitch</a>
          )}
        </div>
      </div>
    );
  };

  const JobCard = ({ job, index, showBadge = true }: { job: any, index: number, showBadge?: boolean }) => {
    const quote = quotes.find(q => q.id === job.quote_id);
    const client = clients.find(c => c.id === quote?.customer_id);
    const amount = quote ? quote.total_amount * 1.13 : 0;
    const stageLower = (job.stage || '').toLowerCase();
    const isOverdue = job.due_date && new Date(job.due_date) < new Date();
    let badgeColor = "bg-slate-500/10 text-slate-500 border-slate-500/30";
    if (stageLower.includes('art') || stageLower.includes('proof')) badgeColor = "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/30";
    else if (stageLower.includes('print') || stageLower.includes('press')) badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/30";
    else if (stageLower.includes('finish') || stageLower.includes('pack')) badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/30";
    else if (stageLower.includes('read') || stageLower.includes('done')) badgeColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
    return (
      <div
        draggable
        onDragStart={(e) => handleJobDragStart(e, job.id)}
        onClick={() => { if (client) { setSelectedClient(client); setDossierTab("orders"); } }}
        className={`p-3 rounded-xl border ${theme.border} cursor-grab active:cursor-grabbing transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-emerald-500/50 ${isLightMode ? 'bg-slate-50' : 'bg-slate-900/40'} relative`}
      >
        <div className={`absolute -top-3 -left-3 w-7 h-7 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-black shadow-[0_0_10px_rgba(16,185,129,0.5)] border-2 ${isLightMode ? 'border-white' : 'border-[#0f1115]'} z-20`}>{index + 1}</div>
        {isOverdue && <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[7px] font-black uppercase shadow-lg">Overdue</div>}
        <div className="flex justify-between items-center mb-1 pl-2">
          <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textStrong}`}>#{job.job_number}</span>
          {showBadge && <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${badgeColor}`}>{job.stage}</span>}
        </div>
        <div className="mb-2 pl-2">
          <h4 className={`text-[11px] font-black uppercase tracking-tighter truncate ${theme.textStrong}`}>{client?.company_name || "Unknown"}</h4>
          <p className={`text-[9px] font-bold truncate ${theme.textMuted}`}>{job.title}</p>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-inherit pt-2 mt-1 pl-2">
          <p className={`text-[8px] font-bold leading-tight line-clamp-2 ${isLightMode ? 'text-emerald-700' : 'text-emerald-400/80'}`}>{formatItemSummary(quote?.quote_items)}</p>
          <div className="flex justify-between items-end mt-1">
            <span className={`text-[7px] font-black uppercase tracking-widest ${isOverdue ? 'text-red-500' : theme.textMuted}`}>Due: {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'TBD'}</span>
            <span className={`text-[10px] font-black ${theme.textStrong}`}>${amount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Command palette items
  const commandItems = useMemo(() => {
    const q = commandQuery.toLowerCase();
    const items: any[] = [
      { type: "action", label: "➕ New B2B Lead", hint: "N", run: () => { generatePin(); setIsAddClientOpen(true); setIsCommandOpen(false); } },
      { type: "action", label: "🧾 Quick Order", hint: "Q", run: () => { setIsQuickOrderOpen(true); setIsCommandOpen(false); } },
      { type: "action", label: "👤 New Retail Lead", hint: "R", run: () => { setIsAddRetailOpen(true); setIsCommandOpen(false); } },
      { type: "nav", label: "📊 Overview", hint: "1", run: () => { setViewMode("overview"); setIsCommandOpen(false); } },
      { type: "nav", label: "🎯 Leads Pipeline", hint: "2", run: () => { setViewMode("leads"); setIsCommandOpen(false); } },
      { type: "nav", label: "🏭 Production Floor", hint: "3", run: () => { setViewMode("production"); setIsCommandOpen(false); } },
      { type: "nav", label: "🔥 Priority Queue", hint: "Q", run: () => { window.location.href = "/queue"; } },
      { type: "nav", label: "🎨 Brand Library", hint: "4", run: () => { setViewMode("library"); setIsCommandOpen(false); } },
      { type: "nav", label: "📋 Data Table", hint: "5", run: () => { setViewMode("directory"); setIsCommandOpen(false); } },
      { type: "nav", label: "🌓 Toggle Theme", run: () => { toggleUniversalTheme(); setIsCommandOpen(false); } },
      { type: "nav", label: density === "comfy" ? "📐 Compact Density" : "📐 Comfortable Density", run: () => { toggleDensity(); setIsCommandOpen(false); } },
    ];
    const clientResults = clients
      .filter(c => !q || c.company_name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q))
      .slice(0, 10)
      .map(c => ({ type: "client", label: `👥 ${c.company_name}`, hint: c.lead_status, run: () => { setSelectedClient(c); setDossierTab("pitch"); setIsCommandOpen(false); } }));
    const filtered = q ? items.filter(i => i.label.toLowerCase().includes(q)) : items;
    return [...filtered, ...clientResults];
  }, [commandQuery, clients, density, generatePin, toggleUniversalTheme]);


  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans flex flex-col selection:bg-sky-500 selection:text-white pb-20 transition-colors duration-300 overflow-x-hidden`}>

      {/* ==================== TOASTS ==================== */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-sm flex items-center gap-3 animate-in slide-in-from-right-4 fade-in
            ${t.type === "success" ? "bg-emerald-500 border-emerald-400 text-white" :
              t.type === "error" ? "bg-red-500 border-red-400 text-white" :
              t.type === "undo" ? "bg-slate-900 border-slate-700 text-white" :
              "bg-sky-500 border-sky-400 text-white"}`}>
            <span className="text-[11px] font-black uppercase tracking-wide flex-1">{t.message}</span>
            {t.undo && (
              <button onClick={() => { t.undo?.(); dismissToast(t.id); }} className="px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-[9px] font-black uppercase tracking-widest">Undo</button>
            )}
            <button onClick={() => dismissToast(t.id)} className="text-white/70 hover:text-white text-xs font-black">✕</button>
          </div>
        ))}
      </div>

      {/* ==================== CONFIRM DIALOG ==================== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmDialog(null)}>
          <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl max-w-md w-full p-6 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`text-lg font-black uppercase tracking-tighter mb-2 ${theme.textStrong}`}>{confirmDialog.title}</h3>
            <p className={`text-sm ${theme.textMuted} mb-6`}>{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDialog(null)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${theme.border} ${theme.textMuted} hover:${theme.textStrong} transition-colors`}>Cancel</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md ${confirmDialog.danger ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'}`}>{confirmDialog.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== COMMAND PALETTE (⌘K) ==================== */}
      {isCommandOpen && (
        <div className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 p-4 animate-in fade-in duration-150" onClick={() => setIsCommandOpen(false)}>
          <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden`} onClick={(e) => e.stopPropagation()}>
            <div className={`p-4 border-b ${theme.border} flex items-center gap-3`}>
              <span className="text-lg">⌘</span>
              <input
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Search actions, clients, views..."
                className={`flex-1 bg-transparent outline-none text-sm font-bold ${theme.textStrong}`}
              />
              <kbd className={`text-[9px] font-black px-2 py-1 rounded border ${theme.border} ${theme.textMuted}`}>ESC</kbd>
            </div>
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {commandItems.length === 0 ? (
                <div className={`p-6 text-center text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>No results</div>
              ) : (
                commandItems.map((item, i) => (
                  <button key={i} onClick={item.run} className={`w-full flex items-center justify-between px-4 py-3 border-b ${theme.border} last:border-b-0 hover:bg-sky-500/10 transition-colors text-left`}>
                    <span className={`text-sm font-bold ${theme.textStrong}`}>{item.label}</span>
                    {item.hint && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${theme.bgSubPanel} ${theme.textMuted}`}>{item.hint}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== HEADER ==================== */}
      <div className={`border-b ${theme.border} ${theme.bgPanel} p-3 md:p-4 flex flex-col md:flex-row gap-3 justify-between items-center z-40 sticky top-0 shadow-sm transition-colors duration-300`}>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className={`text-xl font-black uppercase tracking-tighter leading-none italic ${theme.textStrong}`}>YAYA <span className="text-sky-500">CRM</span></h1>
            <span className={`text-[8px] font-black ${theme.textMuted} uppercase tracking-widest`}>Client Intelligence</span>
          </div>
          <div className="flex gap-1 ml-2">
            <button onClick={toggleUniversalTheme} className={`hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded border font-black text-[9px] uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`} title="Toggle Theme">
              {isLightMode ? '🌙' : '☀️'}
            </button>
            <button onClick={toggleDensity} className={`hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded border font-black text-[9px] uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`} title="Toggle Density">
              {density === "comfy" ? "📏" : "📐"}
            </button>
            <button onClick={() => setIsCommandOpen(true)} className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded border font-black text-[9px] uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`} title="Command Palette (⌘K)">
              ⌘ K
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/todos" className={`px-3 py-2.5 rounded-lg text-[11px] sm:text-[9px] font-black uppercase tracking-widest border transition-colors min-h-[40px] sm:min-h-0 active:scale-95 ${isLightMode ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50' : 'bg-black border-slate-700 text-slate-300 hover:text-white'}`}>
            To-Do List
          </Link>
          <Link href="/shop-floor" className={`px-3 py-2.5 rounded-lg text-[11px] sm:text-[9px] font-black uppercase tracking-widest border transition-colors min-h-[40px] sm:min-h-0 active:scale-95 ${isLightMode ? 'bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100' : 'bg-sky-900/20 border-sky-800 text-sky-400 hover:bg-sky-900/40'}`}>
            Shop Floor
          </Link>
        </div>
      </div>

      <div className="flex-grow w-full px-3 md:px-6 py-4 md:py-6 flex flex-col gap-4">

        {/* ==================== GLOBAL KPI STRIP ==================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Network Clients", value: globalTotalClients, color: "sky", prefix: "" },
            { label: "Accounts Receivable", value: globalOutstanding, color: globalOutstanding > 0 ? "red" : "emerald", prefix: "$", decimals: 2 },
            { label: "Gross LTV", value: globalLTV, color: "fuchsia", prefix: "$", decimals: 2 },
            { label: "Weighted Pipeline", value: globalWeightedPipeline, color: "amber", prefix: "$", decimals: 2 },
          ].map((k, i) => (
            <div key={i} className={`${theme.bgPanel} border ${theme.border} p-4 rounded-2xl shadow-sm relative overflow-hidden transition-colors flex flex-col justify-center`}>
              <div className={`absolute top-0 right-0 w-24 h-24 bg-${k.color}-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none`}></div>
              <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${theme.textMuted}`}>{k.label}</p>
              <p className={`text-2xl font-black tracking-tighter text-${k.color}-500`}>{k.prefix}{typeof k.value === "number" ? k.value.toFixed(k.decimals || 0) : k.value}</p>
            </div>
          ))}
        </div>

        {/* ==================== ATTENTION INBOX (new, appears only when there's stuff) ==================== */}
        {attentionCount > 0 && viewMode === "overview" && (
          <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl p-4 shadow-sm animate-in slide-in-from-top-2 duration-300`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <h3 className={`text-[11px] font-black uppercase tracking-widest ${theme.textStrong}`}>Needs Your Attention</h3>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500 text-white">{attentionCount}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Rotting Leads */}
              <div className={`rounded-xl p-3 border ${isLightMode ? 'bg-red-50 border-red-200' : 'bg-red-900/10 border-red-500/20'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-500">🔥 Rotting Leads</span>
                  <span className="text-[10px] font-black text-red-500">{rottingLeads.length}</span>
                </div>
                {rottingLeads.length === 0 ? (
                  <p className={`text-[9px] font-bold ${theme.textMuted}`}>All leads recently touched ✓</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {rottingLeads.map(c => (
                      <button key={c.id} onClick={() => { setSelectedClient(c); setDossierTab("pitch"); }} className={`text-left px-2 py-1.5 rounded-md text-[10px] font-bold flex justify-between items-center hover:bg-red-500/10 transition-colors ${theme.textStrong}`}>
                        <span className="truncate">{c.company_name}</span>
                        <span className="text-[9px] font-black text-red-500 shrink-0 ml-2">{daysSinceContact(c)}d</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Overdue Jobs */}
              <div className={`rounded-xl p-3 border ${isLightMode ? 'bg-amber-50 border-amber-200' : 'bg-amber-900/10 border-amber-500/20'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">⏰ Overdue Jobs</span>
                  <span className="text-[10px] font-black text-amber-500">{overdueJobs.length}</span>
                </div>
                {overdueJobs.length === 0 ? (
                  <p className={`text-[9px] font-bold ${theme.textMuted}`}>No overdue jobs ✓</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {overdueJobs.map(j => {
                      const q = quotes.find(q => q.id === j.quote_id);
                      const c = clients.find(c => c.id === q?.customer_id);
                      return (
                        <button key={j.id} onClick={() => { if (c) { setSelectedClient(c); setDossierTab("orders"); } }} className={`text-left px-2 py-1.5 rounded-md text-[10px] font-bold flex justify-between items-center hover:bg-amber-500/10 transition-colors ${theme.textStrong}`}>
                          <span className="truncate">#{j.job_number} {c?.company_name}</span>
                          <span className="text-[9px] font-black text-amber-500 shrink-0 ml-2">{j.stage}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* A/R Owed */}
              <div className={`rounded-xl p-3 border ${isLightMode ? 'bg-rose-50 border-rose-200' : 'bg-rose-900/10 border-rose-500/20'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">💸 Outstanding A/R</span>
                  <span className="text-[10px] font-black text-rose-500">{arOwedClients.length}</span>
                </div>
                {arOwedClients.length === 0 ? (
                  <p className={`text-[9px] font-bold ${theme.textMuted}`}>All paid up ✓</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {arOwedClients.map(({ c, fin }) => (
                      <button key={c.id} onClick={() => { setSelectedClient(c); setDossierTab("pitch"); }} className={`text-left px-2 py-1.5 rounded-md text-[10px] font-bold flex justify-between items-center hover:bg-rose-500/10 transition-colors ${theme.textStrong}`}>
                        <span className="truncate">{c.company_name}</span>
                        <span className="text-[9px] font-black text-rose-500 shrink-0 ml-2">${fin.outstandingBalance.toFixed(0)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* ==================== ACTION BAR ==================== */}
        <div className={`flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center ${theme.bgPanel} border ${theme.border} rounded-2xl p-3 shadow-sm transition-colors`}>
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar">
            <div className={`flex flex-wrap rounded-lg p-1 border ${theme.border} ${isLightMode ? 'bg-slate-100' : 'bg-black/40'}`}>
              {[
                { id: "overview", label: "Overview", count: null, color: "sky" },
                { id: "leads", label: "Leads", count: totalLeadsCount, color: "amber" },
                { id: "production", label: "Production", count: activeProductionCount, color: "emerald" },
                { id: "queue", label: "Priority Queue", count: activeProductionCount, color: "rose" },
                { id: "library", label: "Brand Library", count: clients.length, color: "fuchsia" },
                { id: "directory", label: "Data Table", count: null, color: "violet" },
              ].map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => {
                    if (v.id === "queue") {
                      window.location.href = "/queue";
                      return;
                    }
                    setViewMode(v.id);
                  }}
                  className={`px-3 md:px-4 py-2 rounded-md text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    viewMode === v.id
                      ? `bg-${v.color}-500/20 text-${v.color}-500 border border-${v.color}-500/50 shadow-sm`
                      : `${theme.textMuted} hover:${theme.textStrong} border border-transparent`
                  }`}
                  title={v.id === "queue" ? "Open dedicated Priority Queue page" : undefined}
                >
                  {v.label}{v.count !== null ? ` (${v.count})` : ""}{v.id === "queue" ? " ↗" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <input
                id="crm-global-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search... (press /)"
                className={`w-full sm:w-64 rounded-xl px-3 py-2 text-xs font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black ${theme.textMuted} hover:${theme.textStrong}`}>✕</button>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setIsQuickOrderOpen(true)} className="flex-1 sm:flex-none px-3 md:px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md transition-all border border-blue-500 bg-blue-600 text-white hover:bg-blue-500 whitespace-nowrap" title="Quick Order (Q)">⚡ Quick Order</button>
              <button onClick={() => setIsAddRetailOpen(true)} className="flex-1 sm:flex-none px-3 md:px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md transition-all border border-amber-500 bg-amber-600 text-white hover:bg-amber-500 whitespace-nowrap" title="Retail Lead (R)">+ Retail</button>
              <button onClick={() => { generatePin(); setIsAddClientOpen(true); }} className="flex-1 sm:flex-none px-3 md:px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md transition-all border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500 whitespace-nowrap" title="B2B Lead (N)">+ B2B</button>
            </div>
          </div>
        </div>

        {/* ==================== SMART FILTER CHIPS (collapsible) ==================== */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border flex items-center gap-2 ${
                activeSmartFilters.length > 0
                  ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                  : `${theme.bgPanel} ${theme.border} ${theme.textMuted} hover:${theme.textStrong}`
              }`}
            >
              <span>{showFilters ? '▾' : '▸'} Filters</span>
              {activeSmartFilters.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[8px]">{activeSmartFilters.length}</span>
              )}
            </button>
            {activeSmartFilters.length > 0 && (
              <button onClick={() => setActiveSmartFilters([])} className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted} hover:text-red-500 transition-colors`}>Clear all</button>
            )}
            <span className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted} ml-auto`}>
              {filteredClients.length} of {clients.length} clients
            </span>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-1">
              {SMART_FILTERS.map(f => {
                const active = activeSmartFilters.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveSmartFilters(prev => active ? prev.filter(x => x !== f.id) : [...prev, f.id])}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all border ${active ? 'bg-sky-500 text-white border-sky-400 shadow-md' : `${theme.bgPanel} ${theme.border} ${theme.textMuted} hover:${theme.textStrong}`}`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ==================== MAIN CONTENT ==================== */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-sky-500 border-t-transparent animate-spin"></div>
            <span className="text-sky-500 font-black uppercase tracking-widest text-[10px]">Initializing CRM Database…</span>
          </div>
        ) : (
          <>
            {/* ============ VIEW: OVERVIEW — Executive Dashboard ============ */}
            {viewMode === "overview" && (
              <div className="flex flex-col gap-4 animate-in fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* TOP VIP CLIENTS BY LTV */}
                  <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl p-5 shadow-sm`}>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-inherit">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👑</span>
                        <h3 className={`text-[11px] font-black uppercase tracking-widest ${theme.textStrong}`}>Top Clients by LTV</h3>
                      </div>
                      <button onClick={() => setViewMode("directory")} className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted} hover:${theme.textStrong}`}>View all →</button>
                    </div>
                    {(() => {
                      const ranked = clients
                        .map(c => ({ c, fin: getClientFinancials(c.id) }))
                        .filter(x => x.fin.lifetimeSpend > 0)
                        .sort((a, b) => b.fin.lifetimeSpend - a.fin.lifetimeSpend)
                        .slice(0, 6);
                      if (ranked.length === 0) {
                        return <div className={`text-center py-8 text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>No clients with orders yet</div>;
                      }
                      return (
                        <div className="flex flex-col gap-2">
                          {ranked.map(({ c, fin }, i) => {
                            const vip = getVipTierConfig(c.vip_tier || "Standard");
                            return (
                              <button
                                key={c.id}
                                onClick={() => { setSelectedClient(c); setDossierTab("orders"); }}
                                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-all hover:border-sky-500/50 hover:-translate-y-0.5 hover:shadow-md ${theme.border} ${isLightMode ? 'bg-slate-50' : 'bg-slate-900/40'}`}
                              >
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <span className={`text-[9px] font-black w-5 h-5 rounded flex items-center justify-center shrink-0 ${i < 3 ? 'bg-amber-500/20 text-amber-500' : `${theme.bgSubPanel} ${theme.textMuted}`}`}>{i + 1}</span>
                                  <div className="flex flex-col overflow-hidden">
                                    <span className={`text-[11px] font-black uppercase truncate ${theme.textStrong}`}>{c.company_name}</span>
                                    <span className={`text-[9px] font-bold truncate ${theme.textMuted}`}>
                                      {vip.label} · {fin.orderCount || 0} orders
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className={`text-sm font-black ${theme.textStrong}`}>${fin.lifetimeSpend >= 1000 ? (fin.lifetimeSpend/1000).toFixed(1)+'k' : fin.lifetimeSpend.toFixed(0)}</div>
                                  <div className={`text-[8px] font-black uppercase tracking-widest ${theme.textMuted}`}>LTV</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* RECENT LEADS */}
                  <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl p-5 shadow-sm`}>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-inherit">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">✨</span>
                        <h3 className={`text-[11px] font-black uppercase tracking-widest ${theme.textStrong}`}>Recently Added Leads</h3>
                      </div>
                      <button onClick={() => setViewMode("leads")} className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted} hover:${theme.textStrong}`}>Pipeline →</button>
                    </div>
                    {(() => {
                      const recent = [...clients]
                        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                        .slice(0, 6);
                      if (recent.length === 0) {
                        return (
                          <div className={`text-center py-8 ${theme.textMuted}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-3">No leads yet</p>
                            <button onClick={() => { generatePin(); setIsAddClientOpen(true); }} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 transition-colors">+ Add Your First Lead</button>
                          </div>
                        );
                      }
                      return (
                        <div className="flex flex-col gap-2">
                          {recent.map(c => {
                            const stageObj = PIPELINE_STAGES.find(s => s.id === (c.lead_status || 'Active VIP')) || PIPELINE_STAGES[0];
                            const days = Math.floor((Date.now() - new Date(c.created_at || Date.now()).getTime()) / 86400000);
                            return (
                              <button
                                key={c.id}
                                onClick={() => { setSelectedClient(c); setDossierTab("pitch"); }}
                                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-all hover:border-sky-500/50 hover:-translate-y-0.5 hover:shadow-md ${theme.border} ${isLightMode ? 'bg-slate-50' : 'bg-slate-900/40'}`}
                              >
                                <div className="flex flex-col overflow-hidden pr-2">
                                  <span className={`text-[11px] font-black uppercase truncate ${theme.textStrong}`}>{c.company_name}</span>
                                  <span className={`text-[9px] font-bold truncate ${theme.textMuted}`}>{c.contact_name || 'No contact'} · {days === 0 ? 'Today' : `${days}d ago`}</span>
                                </div>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-widest shrink-0 ${stageObj.bg} ${stageObj.color} ${stageObj.border}`}>{stageObj.short || stageObj.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* QUICK PIPELINE SNAPSHOT */}
                <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl p-5 shadow-sm`}>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-inherit">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📊</span>
                      <h3 className={`text-[11px] font-black uppercase tracking-widest ${theme.textStrong}`}>Pipeline Snapshot</h3>
                    </div>
                    <button onClick={() => setViewMode("leads")} className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted} hover:${theme.textStrong}`}>Open Kanban →</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PIPELINE_STAGES.map(stage => {
                      const count = filteredClients.filter(c => (c.lead_status || 'Active VIP') === stage.id).length;
                      return (
                        <button
                          key={stage.id}
                          onClick={() => setViewMode("leads")}
                          className={`p-4 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${stage.border} ${stage.bg} text-left`}
                        >
                          <p className={`text-[8px] font-black uppercase tracking-widest ${stage.color} mb-1`}>{stage.label}</p>
                          <p className={`text-3xl font-black tracking-tighter ${stage.color}`}>{count}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}


            {/* ============ VIEW: LEADS ============ */}
            {viewMode === "leads" && (
              <div className="flex flex-col h-full animate-in fade-in">
                <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar items-start w-full snap-x h-[calc(100vh-280px)] min-h-[500px]">
                  {PIPELINE_STAGES.slice(0, 3).map((stage) => {
                    let stageClients = filteredClients.filter((c) => (c.lead_status || 'Active VIP') === stage.id);
                    const activeFilter = columnFilters[stage.id];
                    if (activeFilter !== "All") {
                      stageClients = stageClients.filter(c => {
                        if (stage.id === "Cold Lead") {
                          if (activeFilter === "Untouched") return !c.last_contacted_at || c.last_contacted_at === c.created_at;
                          if (activeFilter === "Contacted") return c.last_contacted_at && c.last_contacted_at !== c.created_at;
                        }
                        if (stage.id === "Meeting Booked") {
                          if (activeFilter === "To Follow Up") return checkLeadRot(c);
                          if (activeFilter === "Followed Up") return !checkLeadRot(c);
                        }
                        if (stage.id === "Quoting") {
                          const hasDraft = quotes.some(q => q.customer_id === c.id && q.status === 'Draft');
                          if (activeFilter === "Drafting") return hasDraft;
                          if (activeFilter === "Sent") return !hasDraft;
                        }
                        return true;
                      });
                    }
                    return (
                      <div key={stage.id} className={`w-[320px] shrink-0 snap-start flex flex-col h-full rounded-[1.5rem] p-3 border shadow-sm ${theme.bgPanel} ${theme.border} transition-colors group/dropzone`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, stage.id)}>
                        <div className="flex justify-between items-center mb-2 shrink-0 px-1 pt-1">
                          <h3 className={`text-[9px] font-black uppercase tracking-[0.2em] ${stage.color}`}>{stage.label}</h3>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${stage.bg} ${stage.color} ${stage.border}`}>{stageClients.length}</span>
                        </div>
                        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2 mb-2 border-b border-inherit shrink-0">
                          {stage.filters.map(f => (
                            <button key={f} onClick={() => setColumnFilters(prev => ({ ...prev, [stage.id]: f }))} className={`shrink-0 px-2 py-1 rounded text-[7px] font-black uppercase tracking-widest transition-colors ${columnFilters[stage.id] === f ? 'bg-sky-500 text-white shadow-sm' : (isLightMode ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10')}`}>{f}</button>
                          ))}
                        </div>
                        <div className={`flex flex-col gap-2.5 flex-grow overflow-y-auto custom-scrollbar pr-1 border-2 border-dashed border-transparent group-hover/dropzone:border-sky-500/30 rounded-xl transition-colors`}>
                          {stageClients.map(client => <LeadCard key={client.id} client={client} compact={density === "compact"} />)}
                          {stageClients.length === 0 && <div className={`text-center p-4 border-2 border-dashed border-inherit rounded-xl text-[8px] font-black uppercase tracking-widest ${theme.textMuted} mt-1`}>No Leads Here</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ============ VIEW: PRODUCTION ============ */}
            {viewMode === "production" && (
              <div className="flex flex-col gap-4 animate-in fade-in h-full">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 shrink-0">
                  {[
                    { label: "Incoming", key: "Incoming", color: "blue" },
                    { label: "Artwork", key: "Artwork in Approval", color: "fuchsia" },
                    { label: "To Buy", key: "To Buy", color: "amber" },
                    { label: "To Print", key: "To Print", color: "indigo" },
                    { label: "To Press", key: "To Press", color: "violet" },
                    { label: "To Deliver", key: "To Deliver / Pick Up", color: "teal" },
                  ].map((s: any) => (
                    <div key={s.key} className={`${theme.bgPanel} border ${theme.border} rounded-2xl p-3`}>
                      <p className={`text-[8px] font-black uppercase tracking-widest ${theme.textMuted}`}>{s.label}</p>
                      <p className={`text-2xl font-black tracking-tighter text-${s.color}-500`}>{orderedJobs.filter(j => j.stage === DB_STAGE_MAP[s.key]).length}</p>
                    </div>
                  ))}
                </div>
                <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar items-start w-full snap-x flex-1">
                  {PRODUCTION_FILTERS.filter(f => f !== "All").map(stageName => {
                    const targetDbStage = DB_STAGE_MAP[stageName];
                    const stageJobs = orderedJobs.filter(j => j.stage === targetDbStage);
                    let colColor = { text: "text-slate-500", bg: "bg-slate-500/5", border: "border-slate-500/20", badgeBg: "bg-slate-500/10", dropzone: "group-hover/dropzone:border-slate-500/30" };
                    if (stageName === "Incoming") colColor = { text: "text-blue-500", bg: "bg-blue-500/5", border: "border-blue-500/20", badgeBg: "bg-blue-500/10", dropzone: "group-hover/dropzone:border-blue-500/40" };
                    else if (stageName === "Artwork in Approval") colColor = { text: "text-fuchsia-500", bg: "bg-fuchsia-500/5", border: "border-fuchsia-500/20", badgeBg: "bg-fuchsia-500/10", dropzone: "group-hover/dropzone:border-fuchsia-500/40" };
                    else if (stageName === "To Buy") colColor = { text: "text-orange-500", bg: "bg-orange-500/5", border: "border-orange-500/20", badgeBg: "bg-orange-500/10", dropzone: "group-hover/dropzone:border-orange-500/40" };
                    else if (stageName === "To Print") colColor = { text: "text-indigo-500", bg: "bg-indigo-500/5", border: "border-indigo-500/20", badgeBg: "bg-indigo-500/10", dropzone: "group-hover/dropzone:border-indigo-500/40" };
                    else if (stageName === "To Press") colColor = { text: "text-violet-500", bg: "bg-violet-500/5", border: "border-violet-500/20", badgeBg: "bg-violet-500/10", dropzone: "group-hover/dropzone:border-violet-500/40" };
                    else if (stageName === "To Deliver / Pick Up") colColor = { text: "text-teal-500", bg: "bg-teal-500/5", border: "border-teal-500/20", badgeBg: "bg-teal-500/10", dropzone: "group-hover/dropzone:border-teal-500/40" };
                    else if (stageName === "To Invoice") colColor = { text: "text-rose-500", bg: "bg-rose-500/5", border: "border-rose-500/20", badgeBg: "bg-rose-500/10", dropzone: "group-hover/dropzone:border-rose-500/40" };
                    else if (stageName === "Paid") colColor = { text: "text-emerald-500", bg: "bg-emerald-500/5", border: "border-emerald-500/20", badgeBg: "bg-emerald-500/10", dropzone: "group-hover/dropzone:border-emerald-500/40" };
                    return (
                      <div key={stageName} className={`w-[300px] shrink-0 snap-start flex flex-col h-full rounded-[1.5rem] p-3 border shadow-sm transition-colors group/dropzone ${isLightMode ? 'bg-white' : colColor.bg} ${colColor.border}`} onDragOver={handleDragOver} onDrop={(e) => handleJobStageDrop(e, targetDbStage)}>
                        <div className="flex justify-between items-center mb-3 shrink-0 px-1 pt-1 border-b border-inherit pb-2">
                          <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${colColor.text}`}>{stageName}</h3>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${colColor.badgeBg} ${colColor.text} ${colColor.border}`}>{stageJobs.length}</span>
                        </div>
                        <div className={`flex flex-col gap-3 flex-grow overflow-y-auto custom-scrollbar pl-3 pt-3 pr-2 pb-2 border-2 border-dashed border-transparent ${colColor.dropzone} rounded-xl transition-colors`}>
                          {stageJobs.map((job) => {
                            const globalIdx = orderedJobs.findIndex(oj => oj.id === job.id);
                            return <JobCard key={job.id} job={job} index={globalIdx} showBadge={false} />;
                          })}
                          {stageJobs.length === 0 && <div className={`text-center p-4 border-2 border-dashed border-inherit rounded-xl text-[8px] font-black uppercase tracking-widest ${theme.textMuted} mt-1`}>Drag Job Here</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ============ VIEW: MASTER PRIORITY QUEUE ============ */}
            {viewMode === "queue" && (
              <div className={`flex flex-col gap-4 animate-in fade-in h-full`}>
                <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl p-5 shadow-sm`}>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-inherit">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🔥</span>
                      <div>
                        <h3 className={`text-lg font-black uppercase tracking-widest ${theme.textStrong}`}>Master Priority Queue</h3>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>All active jobs across all stages. Set the priority number below.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {orderedJobs.map((job, index) => {
                      const quote = quotes.find(q => q.id === job.quote_id);
                      const client = clients.find(c => c.id === quote?.customer_id);
                      return (
                        <div key={job.id} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800'} transition-all hover:border-rose-500/50 shadow-sm`}>
                          <div className="flex items-center gap-3 w-32 shrink-0">
                            <label className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>Priority #</label>
                            <input 
                              type="number" 
                              min="1" 
                              max={orderedJobs.length}
                              value={index + 1}
                              onChange={(e) => {
                                const newPos = parseInt(e.target.value) - 1;
                                if (!isNaN(newPos) && newPos >= 0 && newPos < orderedJobs.length) {
                                  handlePriorityChange(job.id, newPos);
                                }
                              }}
                              className={`w-16 rounded-lg p-2 text-center text-sm font-black outline-none transition shadow-inner border focus:border-rose-500 ${theme.inputBg}`}
                            />
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[11px] font-black uppercase tracking-tight truncate ${theme.textStrong}`}>{client?.company_name || "Unknown"}</span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest bg-rose-500/10 text-rose-500 border-rose-500/30`}>#{job.job_number}</span>
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${theme.bgSubPanel} ${theme.textMuted}`}>{job.stage}</span>
                            </div>
                            <p className={`text-[10px] font-bold truncate ${theme.textMuted}`}>{job.title}</p>
                            <p className={`text-[9px] font-bold mt-1 text-emerald-500 truncate`}>{formatItemSummary(quote?.quote_items)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className={`text-[9px] font-black uppercase tracking-widest ${job.due_date && new Date(job.due_date) < new Date() ? 'text-red-500' : theme.textMuted}`}>
                              Due: {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'TBD'}
                            </div>
                            <div className={`text-sm font-black mt-1 ${theme.textStrong}`}>
                              ${(quote ? quote.total_amount * 1.13 : 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {orderedJobs.length === 0 && (
                      <div className={`text-center py-10 ${theme.textMuted}`}>
                        <span className="text-3xl block mb-2">🌴</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">No active jobs in the queue</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============ VIEW: DIRECTORY (with bulk select) ============ */}
            {/* ============ BRAND LIBRARY (visual grid view) ============ */}
            {viewMode === "library" && (
              <div className="space-y-4 animate-in fade-in">
                {/* Library toolbar */}
                <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl p-3 flex flex-col md:flex-row gap-2 items-stretch md:items-center justify-between shadow-sm`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>Filter:</span>
                    {[
                      { id: "all",         label: "All Clients" },
                      { id: "with-logo",   label: "With Logo" },
                      { id: "without-logo",label: "Missing Logo" },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setLibraryFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          libraryFilter === f.id
                            ? "bg-fuchsia-500/20 text-fuchsia-500 border border-fuchsia-500/50"
                            : `${theme.textMuted} hover:${theme.textStrong} border border-transparent`
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>Sort:</span>
                    <select
                      value={librarySort}
                      onChange={(e) => setLibrarySort(e.target.value as any)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold outline-none border ${theme.inputBg}`}
                    >
                      <option value="name">A → Z</option>
                      <option value="recent">Recently Added</option>
                      <option value="ltv">Highest Spend</option>
                    </select>
                  </div>
                </div>

                {/* Logo grid */}
                {(() => {
                  let displayed = filteredClients.slice();
                  if (libraryFilter === "with-logo")    displayed = displayed.filter((c: any) => !!c.logo_url);
                  if (libraryFilter === "without-logo") displayed = displayed.filter((c: any) => !c.logo_url);
                  if (librarySort === "name")    displayed.sort((a: any, b: any) => (a.company_name || "").localeCompare(b.company_name || ""));
                  if (librarySort === "recent")  displayed.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
                  if (librarySort === "ltv")     displayed.sort((a: any, b: any) => getClientFinancials(b.id).lifetimeSpend - getClientFinancials(a.id).lifetimeSpend);
                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {displayed.map((client: any) => {
                          const fin = getClientFinancials(client.id);
                          const stage = client.lead_status || "Active VIP";
                          const stageObj = PIPELINE_STAGES.find(s => s.id === stage) || PIPELINE_STAGES[3];
                          return (
                            <div
                              key={client.id}
                              onClick={() => { setSelectedClient(client); setDossierTab("brand"); }}
                              className={`group cursor-pointer rounded-2xl border ${theme.border} ${theme.bgPanel} overflow-hidden hover:border-fuchsia-500/60 hover:shadow-lg transition-all`}
                            >
                              <div className={`aspect-square relative flex items-center justify-center bg-white border-b ${theme.border} overflow-hidden`}>
                                {client.logo_url ? (
                                  isPdfUrl(client.logo_url) ? (
                                    <object
                                      data={`${client.logo_url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                                      type="application/pdf"
                                      className="w-full h-full pointer-events-none"
                                      style={{ backgroundColor: "white" }}
                                    >
                                      <div className="flex flex-col items-center justify-center gap-2 text-center w-full h-full">
                                        <div className="text-6xl leading-none">📕</div>
                                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">PDF Logo</div>
                                      </div>
                                    </object>
                                  ) : (
                                    <img src={client.logo_url} alt={client.company_name} className="max-w-full max-h-full object-contain p-3" />
                                  )
                                ) : (
                                  <div className="text-center text-slate-400">
                                    <div className="text-3xl font-black uppercase tracking-tighter italic mb-1 opacity-50">
                                      {(client.company_name || "?").slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="text-[8px] font-black uppercase tracking-widest">No Logo</div>
                                  </div>
                                )}
                                {/* Download button — fetches as blob so the filename is forced and Adobe doesn't hijack the download */}
                                {client.logo_url && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); downloadLogo(client.logo_url, client.company_name); }}
                                    className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white text-slate-700 hover:bg-violet-500 hover:text-white flex items-center justify-center shadow-md text-[12px] font-black border border-slate-200 transition-all opacity-0 group-hover:opacity-100"
                                    title={`Download ${client.company_name} Logo`}
                                  >
                                    ⬇
                                  </button>
                                )}
                                <div className={`absolute top-2 right-2 text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border ${stageObj.bg} ${stageObj.color} ${stageObj.border}`}>
                                  {stageObj.label}
                                </div>
                              </div>
                              <div className="p-3">
                                <div className={`text-[11px] font-black uppercase tracking-tight truncate ${theme.textStrong}`}>{client.company_name}</div>
                                <div className={`text-[9px] font-bold tracking-tight truncate mt-0.5 ${theme.textMuted}`}>
                                  ${fin.lifetimeSpend.toFixed(0)} LTV
                                  {fin.outstandingBalance > 0 && <span className="text-rose-500 ml-2">${fin.outstandingBalance.toFixed(0)} due</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {displayed.length === 0 && (
                        <div className={`p-12 text-center ${theme.bgPanel} border ${theme.border} rounded-2xl`}>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted} mb-3`}>No clients match these filters</p>
                          <button onClick={() => { setLibraryFilter("all"); setSearchQuery(""); }} className="px-4 py-2 rounded-lg bg-fuchsia-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-600 transition-colors">Reset Filters</button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {viewMode === "directory" && (
              <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl overflow-hidden shadow-sm animate-in fade-in`}>
                {selectedIds.size > 0 && (
                  <div className={`p-3 flex items-center justify-between ${isLightMode ? 'bg-sky-50 border-b border-sky-200' : 'bg-sky-500/10 border-b border-sky-500/30'}`}>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${isLightMode ? 'text-sky-700' : 'text-sky-400'}`}>{selectedIds.size} selected</span>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedIds(new Set())} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${theme.border} ${theme.textMuted} hover:${theme.textStrong}`}>Clear</button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b ${theme.border} ${theme.bgSubPanel}`}>
                        <th className={`p-3 text-[9px] font-black uppercase tracking-widest ${theme.textMuted} w-8`}>
                          <input type="checkbox" checked={filteredClients.length > 0 && selectedIds.size === filteredClients.length} onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredClients.map(c => c.id)) : new Set())} className="w-4 h-4 cursor-pointer accent-sky-500" />
                        </th>
                        <th className={`p-3 text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>Brand & Contact</th>
                        <th className={`p-3 text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>Stage / Tier</th>
                        <th className={`p-3 text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>LTV / AOV</th>
                        <th className={`p-3 text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>A/R Balance</th>
                        <th className={`p-3 text-[9px] font-black uppercase tracking-widest ${theme.textMuted} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {filteredClients.map(client => {
                        const { lifetimeSpend, aov, outstandingBalance } = getClientFinancials(client.id);
                        const vip = getVipTierConfig(client.vip_tier || "Standard");
                        const statusObj = PIPELINE_STAGES.find(s => s.id === (client.lead_status || 'Active VIP')) || PIPELINE_STAGES[3];
                        const isRotting = checkLeadRot(client);
                        const isSel = selectedIds.has(client.id);
                        return (
                          <tr key={client.id} className={`border-b ${theme.border} hover:${isLightMode ? 'bg-slate-50' : 'bg-slate-900/40'} transition-colors group cursor-pointer ${isSel ? (isLightMode ? 'bg-sky-50' : 'bg-sky-500/5') : ''}`} onClick={() => { setSelectedClient(client); setDossierTab("pitch"); }}>
                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={isSel} onChange={() => { const n = new Set(selectedIds); if (isSel) n.delete(client.id); else n.add(client.id); setSelectedIds(n); }} className="w-4 h-4 cursor-pointer accent-sky-500" />
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                {client.logo_url ? (
                                  isPdfUrl(client.logo_url) ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); downloadLogo(client.logo_url, client.company_name); }}
                                      className={`w-9 h-9 rounded-lg border ${theme.border} ${isLightMode ? 'bg-white' : 'bg-slate-950/40'} shrink-0 flex items-center justify-center hover:border-violet-500 hover:bg-violet-50 transition-all relative group/logo`}
                                      title={`Download ${client.company_name} Logo`}
                                    >
                                      <span className="text-base group-hover/logo:opacity-30 transition-opacity">📕</span>
                                      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black text-violet-600 opacity-0 group-hover/logo:opacity-100 transition-opacity">⬇</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); downloadLogo(client.logo_url, client.company_name); }}
                                      className={`w-9 h-9 rounded-lg border ${theme.border} ${isLightMode ? 'bg-white' : 'bg-slate-950/40'} shrink-0 flex items-center justify-center hover:border-violet-500 transition-all relative group/logo overflow-hidden`}
                                      title={`Download ${client.company_name} Logo`}
                                    >
                                      <img src={client.logo_url} alt="" className="max-w-full max-h-full object-contain group-hover/logo:opacity-30 transition-opacity" />
                                      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-black text-violet-600 opacity-0 group-hover/logo:opacity-100 transition-opacity bg-white/60">⬇</span>
                                    </button>
                                  )
                                ) : (
                                  <div className={`w-9 h-9 rounded-lg border ${theme.border} ${isLightMode ? 'bg-slate-50' : 'bg-slate-950/40'} shrink-0 flex items-center justify-center`}>
                                    <span className={`text-[10px] font-black uppercase italic tracking-tighter ${theme.textMuted}`}>
                                      {(client.company_name || "?").slice(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className={`font-black uppercase tracking-tight flex items-center gap-2 ${theme.textStrong}`}>
                                    {isRotting && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                                    <span className="truncate">{client.company_name}</span>
                                  </span>
                                  <span className={`text-[10px] font-bold ${theme.textMuted} truncate`}>{client.email || client.phone}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest border ${statusObj.bg} ${statusObj.color} ${statusObj.border}`}>{statusObj.label}</span>
                                {client.vip_tier && client.vip_tier !== "Standard" && <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest border ${vip.color}`}>{vip.label}</span>}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className={`font-black ${theme.textStrong}`}>${lifetimeSpend.toFixed(2)} <span className={`text-[8px] font-bold ${theme.textMuted} ml-1`}>LTV</span></span>
                                <span className={`text-[10px] font-bold ${theme.textMuted}`}>${aov.toFixed(0)} AVG</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className={`font-black ${outstandingBalance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>${outstandingBalance.toFixed(2)}</span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                {client.phone && <a href={`tel:${client.phone}`} className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${isLightMode ? 'bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-500' : 'bg-slate-900 border-slate-700 hover:bg-emerald-500/10 hover:border-emerald-500'}`} title="Call">📞</a>}
                                {client.email && <a href={generateAIPitchEmail(client)} className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${isLightMode ? 'bg-white border-slate-200 hover:bg-sky-50 hover:border-sky-500' : 'bg-slate-900 border-slate-700 hover:bg-sky-500/10 hover:border-sky-500'}`} title="AI Pitch">✨</a>}
                                <button onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setDossierTab("pitch"); }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${isLightMode ? 'bg-white border-slate-200 hover:border-sky-500' : 'bg-slate-900 border-slate-700 hover:border-sky-500'}`}>Open →</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredClients.length === 0 && (
                    <div className="p-10 text-center">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted} mb-3`}>No clients found</p>
                      <button onClick={() => { setSearchQuery(""); setActiveSmartFilters([]); }} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 transition-colors">Clear Filters</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>


      {/* ==================== DOSSIER SLIDE-OUT (SALES COCKPIT) ==================== */}
      {selectedClient && (() => {
        const fin = getClientFinancials(selectedClient.id);
        const vipCfg = getVipTierConfig(selectedClient.vip_tier);
        const isRotting = checkLeadRot(selectedClient);
        const daysQuiet = daysSinceContact(selectedClient);
        const stage = selectedClient.lead_status || "Cold Lead";
        const clientQuotes = quotes.filter((q: any) => q.customer_id === selectedClient.id);
        const clientJobs = activeJobsList;
        const heatLevel = selectedClient.lead_heat || 0;

        // Smart default tab: cold/meeting -> pitch, quoting -> quote, active -> orders
        const smartDefault = stage === "Active VIP" ? "orders" : stage === "Quoting" ? "quote" : "pitch";
        const currentTab = ["pitch", "quote", "orders", "settings", "brand"].includes(dossierTab) ? dossierTab : smartDefault;

        // Tab emphasis by stage
        const tabEmphasis: Record<string, string> = {
          "Cold Lead": "pitch",
          "Meeting Booked": "pitch",
          "Quoting": "quote",
          "Active VIP": "orders",
        };
        const emphasizedTab = tabEmphasis[stage] || "pitch";

        return (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedClient(null)}></div>
          <div className={`relative w-full max-w-6xl h-full ${theme.bgPanel} border-l ${theme.border} shadow-2xl flex flex-col animate-in slide-in-from-right duration-300`}>

            {/* ========== COMMAND HEADER ========== */}
            <div className={`shrink-0 relative overflow-hidden ${isLightMode ? "bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950" : "bg-gradient-to-br from-black via-slate-950 to-sky-950/50"}`}>
              {/* Decorative glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none"></div>
              <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl translate-y-1/2 pointer-events-none"></div>

              <div className="relative z-10 px-5 md:px-7 pt-5 md:pt-6 pb-4">
                {/* Top row: stage badge + close */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-[0.25em] px-2.5 py-1 rounded-md border ${stage === "Active VIP" ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-300" : stage === "Quoting" ? "bg-amber-500/15 border-amber-400/40 text-amber-300" : stage === "Meeting Booked" ? "bg-sky-500/15 border-sky-400/40 text-sky-300" : "bg-slate-500/15 border-slate-400/40 text-slate-300"}`}>
                      ● {stage}
                    </span>
                    {vipCfg.label !== "Standard" && (
                      <span className={`text-[9px] font-black uppercase tracking-[0.25em] px-2.5 py-1 rounded-md border ${vipCfg.color}`}>
                        ★ {vipCfg.label}
                      </span>
                    )}
                    {isRotting && (
                      <span className="text-[9px] font-black uppercase tracking-[0.25em] px-2.5 py-1 rounded-md bg-red-500/90 border border-red-400 text-white animate-pulse">
                        🔥 {daysQuiet}d quiet
                      </span>
                    )}
                    {heatLevel >= 4 && (
                      <span className="text-[9px] font-black uppercase tracking-[0.25em] px-2.5 py-1 rounded-md bg-orange-500/15 border border-orange-400/40 text-orange-300">
                        🌡 Hot Lead
                      </span>
                    )}
                    {autosaveState !== "idle" && (
                      <span className={`text-[9px] font-black uppercase tracking-[0.25em] px-2 py-1 rounded ${autosaveState === "saving" ? "text-slate-400" : "text-emerald-400"}`}>
                        {autosaveState === "saving" ? "⏳ Saving..." : "✓ Saved"}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelectedClient(null)} className="shrink-0 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/5" title="Close (Esc)">
                    Close ✕
                  </button>
                </div>

                {/* Company name + contact */}
                <div className="flex items-center gap-4">
                  {selectedClient.logo_url ? (
                    <div className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl bg-white p-2 flex items-center justify-center shadow-lg overflow-hidden">
                      {isPdfUrl(selectedClient.logo_url) ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-3xl">📕</span>
                          <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">PDF</span>
                        </div>
                      ) : (
                        <img src={selectedClient.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setDossierTab("brand")}
                      className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl bg-white/5 border border-white/10 hover:border-violet-400/60 hover:bg-violet-500/10 flex items-center justify-center transition-colors group"
                      title="Upload logo (Brand & Files tab)"
                    >
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/40 group-hover:text-violet-300 text-center px-1 leading-tight">
                        Add<br/>Logo
                      </span>
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter leading-none text-white mb-2 truncate">
                      {selectedClient.company_name}
                    </h2>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      {selectedClient.contact_name || "No Contact Name"}
                      {selectedClient.owner_name ? ` • Owner: ${selectedClient.owner_name}` : ""}
                      {selectedClient.lead_source ? ` • via ${selectedClient.lead_source}` : ""}
                    </p>
                  </div>
                </div>

                {/* KPI Strip - 4 quick stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mt-5">
                  <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-3 hover:border-white/20 transition-colors">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Lifetime</p>
                    <p className="text-xl md:text-2xl font-black text-white leading-none">${fin.lifetimeSpend >= 1000 ? (fin.lifetimeSpend/1000).toFixed(1) + "k" : fin.lifetimeSpend.toFixed(0)}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-3 hover:border-white/20 transition-colors">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Avg Order</p>
                    <p className="text-xl md:text-2xl font-black text-white leading-none">${fin.aov >= 1000 ? (fin.aov/1000).toFixed(1) + "k" : fin.aov.toFixed(0)}</p>
                  </div>
                  <div className={`backdrop-blur border rounded-xl p-3 transition-colors ${fin.outstandingBalance > 0 ? "bg-red-500/10 border-red-400/30 hover:border-red-400/50" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
                    <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${fin.outstandingBalance > 0 ? "text-red-300" : "text-slate-400"}`}>A/R Owed</p>
                    <p className={`text-xl md:text-2xl font-black leading-none ${fin.outstandingBalance > 0 ? "text-red-400" : "text-white"}`}>${fin.outstandingBalance.toFixed(0)}</p>
                  </div>
                  <div className="bg-sky-500/10 backdrop-blur border border-sky-400/30 rounded-xl p-3 hover:border-sky-400/50 transition-colors">
                    <p className="text-[8px] font-black uppercase tracking-widest text-sky-300 mb-1">Discount</p>
                    <p className="text-xl md:text-2xl font-black text-sky-300 leading-none">{selectedClient.discount_percent || 0}%</p>
                  </div>
                </div>

                {/* PRIMARY CTAs - Huge, unmistakable */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3 mt-4">
                  <a href={`tel:${selectedClient.phone}`} className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg group ${selectedClient.phone ? "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white hover:scale-[1.02] active:scale-95" : "bg-slate-800 text-slate-500 cursor-not-allowed pointer-events-none"}`}>
                    <span className="text-lg">📞</span>
                    <span className="hidden md:inline">Call Now</span>
                    <span className="md:hidden">{selectedClient.phone || "No Phone"}</span>
                  </a>
                  <a href={generateAIPitchEmail(selectedClient)} className={`flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg group relative overflow-hidden ${selectedClient.email ? "bg-gradient-to-br from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white hover:scale-[1.02] active:scale-95" : "bg-slate-800 text-slate-500 cursor-not-allowed pointer-events-none"}`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    <span className="text-lg relative z-10">✨</span>
                    <span className="relative z-10 hidden md:inline">Send AI Pitch</span>
                    <span className="relative z-10 md:hidden">AI Pitch</span>
                  </a>
                  <button onClick={() => { setDossierTab("quote"); setTimeout(() => { const el = document.getElementById("quote-builder"); el?.scrollIntoView({ behavior: "smooth" }); }, 100); }} className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 hover:from-fuchsia-400 hover:to-fuchsia-500 text-white hover:scale-[1.02] active:scale-95">
                    <span className="text-lg">💰</span>
                    <span>Build Quote</span>
                  </button>
                </div>

                {/* Secondary actions bar */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <button onClick={() => copyLoginDetails(selectedClient)} className="px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors">📋 Copy Portal Login</button>
                  <button onClick={() => setShowQuickNote(v => !v)} className="px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors">📝 Quick Note</button>
                  <button onClick={() => handleQuickReminder(3)} className="px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-500/15 border border-amber-400/30 text-amber-300 hover:bg-amber-500 hover:text-white transition-colors" title="Create a follow-up todo 3 days from now and reset contact timer">⏰ Remind +3d</button>
                  <button onClick={() => handleQuickReminder(7)} className="px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-500/15 border border-amber-400/30 text-amber-300 hover:bg-amber-500 hover:text-white transition-colors" title="Create a follow-up todo 1 week from now and reset contact timer">⏰ Remind +7d</button>
                  <a href={`mailto:${selectedClient.email}`} className={`px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border transition-colors ${selectedClient.email ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white" : "bg-white/5 border-white/5 text-slate-600 pointer-events-none"}`}>✉️ Plain Email</a>
                  {selectedClient.website && (
                    <a href={selectedClient.website.startsWith("http") ? selectedClient.website : `https://${selectedClient.website}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors">🌐 Website</a>
                  )}
                  <button onClick={handleLoginAsClient} className="ml-auto px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500 hover:text-white transition-colors">👁️ Login As Client</button>
                </div>

                {/* Quick Note inline */}
                {showQuickNote && (
                  <div className="mt-3 p-3 rounded-xl border bg-amber-500/10 border-amber-400/30 animate-in slide-in-from-top-2">
                    <textarea value={quickNote} onChange={(e) => setQuickNote(e.target.value)} placeholder="Type a quick note (auto-timestamped)..." className="w-full p-2.5 rounded-lg bg-slate-900/50 border border-amber-400/20 text-xs font-bold h-20 resize-none custom-scrollbar text-white outline-none focus:border-amber-400 placeholder:text-slate-500" autoFocus />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => { setShowQuickNote(false); setQuickNote(""); }} className="px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white">Cancel</button>
                      <button onClick={() => {
                        const existing = selectedClient.interest_notes || "";
                        const stamp = new Date().toLocaleString();
                        setSelectedClient({ ...selectedClient, interest_notes: `[${stamp}] ${quickNote}\n\n${existing}` });
                        setQuickNote(""); setShowQuickNote(false);
                        toast("success", "Note added. Save in Pitch tab to persist.");
                        setDossierTab("pitch");
                      }} className="px-3 py-1 rounded bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-amber-400">Add to Notes</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ========== SMART TABS (4 tabs, emphasized by stage) ========== */}
            <div className={`flex border-b ${theme.border} px-3 md:px-5 shrink-0 ${isLightMode ? "bg-white" : "bg-slate-950/60"} overflow-x-auto no-scrollbar`}>
              {[
                { id: "pitch",    label: "Pitch Mode",  icon: "🎯", color: "sky" },
                { id: "quote",    label: "New Quote",    icon: "💰", color: "emerald" },
                { id: "orders",   label: `Orders & History (${clientJobs.length + clientQuotes.length})`, icon: "📦", color: "fuchsia" },
                { id: "brand",    label: `Brand & Files${customerDocuments.length ? ` (${customerDocuments.length})` : ""}`, icon: "🎨", color: "violet" },
                { id: "settings", label: "Settings",     icon: "⚙️", color: "slate" },
              ].map((t: any) => {
                const active = currentTab === t.id;
                const isEmphasis = t.id === emphasizedTab;
                return (
                  <button key={t.id} onClick={() => setDossierTab(t.id as any)} className={`relative whitespace-nowrap py-3.5 px-3 md:px-5 text-[10px] md:text-[11px] font-black uppercase tracking-widest border-b-2 transition-all ${active ? `border-${t.color}-500 text-${t.color}-500` : `border-transparent ${theme.textMuted} hover:${theme.textStrong}`}`}>
                    <span className="mr-1.5">{t.icon}</span>{t.label}
                    {isEmphasis && !active && (
                      <span className={`absolute top-2 right-1 w-1.5 h-1.5 rounded-full bg-${t.color}-500 animate-pulse`}></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ========== CONTENT ========== */}
            <div className="flex-grow overflow-y-auto custom-scrollbar relative">

              {/* ============ PITCH MODE ============ */}
              {currentTab === "pitch" && (
                <form onSubmit={handleUpdateClientSettings} className="p-5 md:p-7 space-y-6 animate-in fade-in">

                  {/* Battle Progress Bar */}
                  <div className={`p-5 rounded-2xl border ${isLightMode ? "bg-gradient-to-br from-sky-50 to-white border-sky-200" : "bg-gradient-to-br from-sky-950/30 to-slate-950/50 border-sky-900/40"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className={`text-[9px] font-black uppercase tracking-[0.3em] mb-0.5 ${theme.textMuted}`}>Sales Progress</p>
                        <p className={`text-sm font-black ${theme.textStrong}`}>{stage}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[9px] font-black uppercase tracking-[0.3em] mb-0.5 ${theme.textMuted}`}>Lead Heat</p>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button" onClick={() => setSelectedClient({...selectedClient, lead_heat: n})} className="text-lg leading-none transition-transform hover:scale-125">
                              {n <= heatLevel ? "🔥" : "·"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1 relative">
                      {BATTLE_STAGES.map((bs, idx) => {
                        const currentIdx = BATTLE_STAGES.findIndex(s => s.id === stage);
                        const isActive = idx === currentIdx;
                        const isPast = currentIdx >= 0 && idx < currentIdx;
                        return (
                          <div key={`${bs.label}-${idx}`} className="flex-1 flex flex-col items-center relative z-10">
                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs font-black transition-all ${isActive ? `bg-${bs.color}-500 text-white shadow-lg scale-110 ring-4 ring-${bs.color}-500/20` : isPast ? `bg-${bs.color}-500/80 text-white` : isLightMode ? "bg-slate-200 text-slate-400" : "bg-slate-800 text-slate-600"}`}>
                              {isPast ? "✓" : idx + 1}
                            </div>
                            <p className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest mt-2 text-center leading-tight ${isActive ? `text-${bs.color}-500` : isPast ? theme.textStrong : theme.textMuted}`}>
                              {bs.label}
                            </p>
                          </div>
                        );
                      })}
                      <div className={`absolute top-4 md:top-5 left-0 right-0 h-0.5 ${isLightMode ? "bg-slate-200" : "bg-slate-800"} -z-0`}></div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5">
                      {BATTLE_STAGES.map((bs, idx) => (
                        <button key={`${bs.label}-${idx}`} type="button" onClick={() => setSelectedClient({...selectedClient, lead_status: bs.id})} className={`px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${stage === bs.id ? `bg-${bs.color}-500 text-white shadow-md` : isLightMode ? "bg-white border border-slate-200 hover:bg-slate-50" : "bg-slate-900 border border-white/10 hover:bg-slate-800"} ${stage !== bs.id ? theme.textMuted : ""}`}>
                          {bs.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PITCH SCRIPT - The star of the show */}
                  <div className={`p-5 md:p-6 rounded-2xl border-2 ${isLightMode ? "bg-gradient-to-br from-fuchsia-50 via-white to-sky-50 border-fuchsia-300" : "bg-gradient-to-br from-fuchsia-950/20 via-slate-950/50 to-sky-950/20 border-fuchsia-500/40"} shadow-xl`}>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <h3 className={`text-lg md:text-xl font-black uppercase italic tracking-tighter ${theme.textStrong}`}>🎯 Your Pitch Script</h3>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted} mt-0.5`}>Tap pain points below → script updates live</p>
                      </div>
                      <a href={generateAIPitchEmail(selectedClient)} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-br from-fuchsia-500 to-sky-500 text-white hover:scale-[1.02] transition-all shadow-lg">✨ Email This Pitch</a>
                    </div>

                    {/* Pain point toggles */}
                    <div>
                      <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${theme.textMuted}`}>Competitor Weaknesses (Select 1-4)</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
                        {[
                          { key: "pain_price", label: "Price", icon: "💵" },
                          { key: "pain_quality", label: "Quality", icon: "⭐" },
                          { key: "pain_speed", label: "Speed", icon: "⚡" },
                          { key: "pain_service", label: "Service", icon: "🤝" },
                        ].map(p => {
                          const active = selectedClient[p.key];
                          return (
                            <button key={p.key} type="button" onClick={() => setSelectedClient({...selectedClient, [p.key]: !active})} className={`p-3 rounded-xl border-2 text-xs font-black uppercase tracking-widest transition-all ${active ? "bg-red-500 border-red-600 text-white shadow-lg scale-[1.02]" : isLightMode ? "bg-white border-slate-200 text-slate-600 hover:border-red-300" : "bg-slate-900 border-white/10 text-slate-400 hover:border-red-500/40"}`}>
                              <div className="text-2xl mb-1">{p.icon}</div>
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Generated script */}
                    <div className={`p-5 rounded-xl border ${isLightMode ? "bg-white border-slate-200 shadow-inner" : "bg-black/40 border-white/10"}`}>
                      <p className={`text-[9px] font-black uppercase tracking-widest mb-3 ${theme.textMuted}`}>Live Script</p>
                      <div className={`text-sm md:text-base font-medium leading-relaxed ${theme.textStrong} space-y-2`}>
                        <p>Hey <strong className="text-fuchsia-500">{selectedClient.contact_name || "there"}</strong>, this is [Your Name] from YAYA Prints.</p>
                        <p>I noticed <strong>{selectedClient.company_name}</strong> could use better uniforms — and I know companies like yours are often frustrated with their current supplier when it comes to {[
                          selectedClient.pain_price && "pricing",
                          selectedClient.pain_quality && "quality",
                          selectedClient.pain_speed && "turnaround speed",
                          selectedClient.pain_service && "service responsiveness",
                        ].filter(Boolean).join(", ") || "[select pain points above]"}.</p>
                        <p>We've helped similar businesses lock in <strong className="text-emerald-500">{selectedClient.discount_percent || 15}% off retail</strong> with a dedicated account manager and {selectedClient.pain_speed ? "5-day turnaround" : "zero-hassle reorders"}.</p>
                        <p className={theme.textMuted}>Got 3 minutes for me to show you what we can do?</p>
                      </div>
                    </div>
                  </div>

                  {/* Conversation Narrative + Next Attack — side by side on desktop */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className={`p-5 rounded-2xl border ${isLightMode ? "bg-white border-slate-200" : "bg-slate-900/40 border-white/5"}`}>
                      <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textStrong}`}>
                        💬 Conversation Narrative
                      </label>
                      <p className={`text-[9px] font-bold mb-3 ${theme.textMuted}`}>Everything you know about this client. Saves with profile.</p>
                      <textarea
                        value={selectedClient.interest_notes || ""}
                        onChange={(e) => setSelectedClient({...selectedClient, interest_notes: e.target.value})}
                        className={`w-full rounded-xl p-3 text-xs font-medium outline-none shadow-inner border resize-none custom-scrollbar h-40 ${theme.inputBg}`}
                        placeholder="Last call 10/15 - they mentioned switching suppliers next quarter. Key decision maker is Sarah in HR..."
                      />
                    </div>

                    <div className={`p-5 rounded-2xl border ${isLightMode ? "bg-amber-50 border-amber-200" : "bg-amber-950/20 border-amber-500/20"}`}>
                      <label className="text-[10px] font-black uppercase tracking-widest block mb-2 text-amber-600 dark:text-amber-400">
                        ⚔️ Schedule Next Attack
                      </label>
                      <p className={`text-[9px] font-bold mb-3 ${theme.textMuted}`}>Creates a dated task in your To-Do list.</p>
                      <div className="space-y-2">
                        <input type="text" value={quickTaskTitle} onChange={(e) => setQuickTaskTitle(e.target.value)} placeholder="e.g. Call Sarah re: uniforms" className={`w-full rounded-xl p-3 text-xs font-bold outline-none shadow-inner border ${theme.inputBg}`} />
                        <input type="date" value={quickTaskDate} onChange={(e) => setQuickTaskDate(e.target.value)} className={`w-full rounded-xl p-3 text-xs font-bold outline-none shadow-inner border ${theme.inputBg}`} />
                        <button type="button" onClick={handleScheduleAttack} disabled={!quickTaskTitle || !quickTaskDate} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all">
                          + Schedule Attack
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Save Profile - sticky-ish primary action */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-50">
                      {isSubmitting ? "Saving..." : "💾 Save Battle Plan"}
                    </button>
                  </div>
                </form>
              )}

              {/* ============ NEW QUOTE (Matrix Builder) ============ */}
              {currentTab === "quote" && (
                <div id="quote-builder" className="animate-in fade-in">
                  <div className={`sticky top-0 z-20 px-5 md:px-7 py-4 border-b ${theme.border} ${isLightMode ? "bg-gradient-to-r from-emerald-50 to-white" : "bg-gradient-to-r from-emerald-950/30 to-slate-950/80"} backdrop-blur`}>
                    <div className="flex justify-between items-center flex-wrap gap-3">
                      <div>
                        <h3 className={`text-lg md:text-xl font-black uppercase italic tracking-tighter ${theme.textStrong}`}>💰 New Matrix Quote</h3>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted} mt-0.5`}>
                          Customer: <span className="text-emerald-500">{selectedClient.company_name}</span>
                          {selectedClient.discount_percent > 0 && <> • Auto-applying <span className="text-emerald-500">{selectedClient.discount_percent}% {vipCfg.label}</span> tier</>}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 md:p-7 space-y-5 pb-32">
                    {quoteItems.map((item, iIdx) => (
                      <div key={iIdx} className={`${theme.bgPanel} border ${theme.border} p-5 rounded-2xl shadow-lg relative`}>
                        <button type="button" onClick={() => handleRemoveQuoteItem(iIdx)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-xs font-black transition-colors flex items-center justify-center">✕</button>
                        <div className="flex flex-col md:grid md:grid-cols-2 gap-4 mb-4 border-b border-inherit pb-4">
                          <div className="relative w-full z-30">
                            <label className={`text-[9px] font-black uppercase tracking-widest block mb-1 pl-1 ${theme.textMuted}`}>Product</label>
                            <input
                              placeholder="Search catalog..."
                              className={`w-full ${theme.inputBg} border p-3 rounded-xl text-sm font-bold outline-none transition shadow-inner`}
                              value={item.description}
                              onFocus={() => handleQuoteItemChange(iIdx, "showDropdown", true)}
                              onChange={(e) => { handleQuoteItemChange(iIdx, "description", e.target.value); handleQuoteItemChange(iIdx, "searchQuery", e.target.value); handleQuoteItemChange(iIdx, "showDropdown", true); }}
                            />
                            {item.showDropdown && item.description.length > 0 && (
                              <div className={`absolute top-full left-0 w-full mt-2 border rounded-xl max-h-60 overflow-y-auto shadow-2xl ${isLightMode ? "bg-white border-slate-200" : "bg-slate-800 border-white/10"}`}>
                                {catalog.filter(p => p.name.toLowerCase().includes(item.description.toLowerCase())).map(p => (
                                  <button key={p.id} type="button" onClick={() => selectQuoteProduct(iIdx, p)} className={`w-full text-left p-3 border-b transition-colors ${isLightMode ? "hover:bg-emerald-50 border-slate-100" : "hover:bg-emerald-600 border-white/5"}`}>
                                    <div className={`text-xs font-black uppercase tracking-tight ${theme.textStrong}`}>{p.name}</div>
                                    <div className="text-[9px] text-emerald-500 mt-1 uppercase font-bold">${p.default_price} | {p.category}</div>
                                  </button>
                                ))}
                                {catalog.filter(p => p.name.toLowerCase().includes(item.description.toLowerCase())).length === 0 && (
                                  <button type="button" onClick={() => handleAddMissingCatalogItem(iIdx, item.description)} className="w-full text-left p-3 bg-emerald-500/10 border-b border-emerald-500/30 hover:bg-emerald-500/20 transition-colors">
                                    <div className="text-xs font-black uppercase tracking-tight text-emerald-500">+ Add "{item.description}" to Catalog</div>
                                  </button>
                                )}
                                <button type="button" onClick={() => handleQuoteItemChange(iIdx, "showDropdown", false)} className={`w-full text-center p-2 text-[9px] font-black uppercase tracking-widest transition-colors ${isLightMode ? "bg-slate-100 text-slate-500 hover:text-slate-900" : "bg-slate-900 text-slate-500 hover:text-white"}`}>Close</button>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-row justify-between items-end md:flex-col md:justify-end md:text-right w-full">
                            <div className={`text-[9px] font-black uppercase tracking-widest md:mb-1 pr-1 ${theme.textMuted}`}>Line Subtotal</div>
                            <div className={`text-2xl md:text-4xl font-black tracking-tighter leading-none ${theme.textStrong}`}>${calcItemTotal(item).toFixed(2)}</div>
                          </div>
                        </div>

                        <div className="space-y-2 w-full overflow-x-auto">
                          <div className={`hidden md:grid grid-cols-12 gap-1.5 text-[8px] font-black uppercase text-center tracking-widest mb-2 px-1 min-w-[1000px] ${theme.textMuted}`}>
                            <div className="col-span-1 text-left">Color</div>
                            <div>XS</div><div>S</div><div>M</div><div>L</div><div>XL</div><div>2XL</div><div>3XL</div><div>4XL</div><div>5XL</div>
                            <div className="col-span-1">Reg</div><div className="col-span-1 text-right">Disc</div>
                          </div>
                          {item.variants.map((v: any, vIdx: number) => (
                            <div key={vIdx} className={`flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-1.5 md:items-center p-4 md:p-2 rounded-xl border w-full min-w-[320px] md:min-w-[1000px] ${isLightMode ? "bg-slate-50 border-slate-200 hover:border-emerald-300" : "bg-black/40 border-white/5 hover:border-emerald-500/30"}`}>
                              <div className="flex-1 md:col-span-1">
                                <div className="text-[8px] text-slate-500 font-black uppercase mb-1 md:hidden pl-1">Color</div>
                                <input list={`q-colors-${iIdx}-${vIdx}`} value={v.color} onChange={(e) => updateQuoteVariant(iIdx, vIdx, "color", e.target.value)} className="w-full bg-transparent border-none rounded-md p-1.5 md:p-0 text-xs font-black text-emerald-500 uppercase outline-none" placeholder="Color" />
                                <datalist id={`q-colors-${iIdx}-${vIdx}`}>{GILDAN_COLORS.map(c => <option key={c} value={c} />)}</datalist>
                              </div>
                              <div className="grid grid-cols-3 md:contents gap-1.5 w-full">
                                {SIZES.map(size => (
                                  <div key={size} className="relative">
                                    <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-1 text-[7px] font-black uppercase text-slate-500 md:hidden z-10 border rounded ${isLightMode ? "bg-white border-slate-200" : "bg-black border-slate-800"}`}>{size}</div>
                                    <input type="number" value={v[size]} onChange={(e) => updateQuoteVariant(iIdx, vIdx, size, parseInt(e.target.value) || 0)} className={`w-full border rounded-md p-1.5 text-center text-xs font-black outline-none transition shadow-sm ${theme.inputBg}`} />
                                  </div>
                                ))}
                              </div>
                              <div className="flex flex-row md:contents gap-3 w-full border-t border-inherit pt-3 md:pt-0">
                                <div className="flex-1 md:col-span-1">
                                  <div className="text-[8px] text-slate-500 font-black uppercase mb-1 md:hidden pl-1">Regular</div>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1.5 text-[9px] font-black text-slate-400">$</span>
                                    <input type="number" step="0.01" value={v.regular_price} onChange={(e) => updateQuoteVariant(iIdx, vIdx, "regular_price", parseFloat(e.target.value) || 0)} className={`w-full border rounded-md p-1.5 pl-5 text-center text-xs font-black line-through outline-none shadow-sm text-slate-400 ${theme.inputBg}`} />
                                  </div>
                                </div>
                                <div className="flex-1 md:col-span-1">
                                  <div className="text-[8px] text-slate-500 font-black uppercase mb-1 md:hidden pl-1">Discount</div>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1.5 text-[9px] font-black text-emerald-500/50">$</span>
                                    <input type="number" step="0.01" value={v.unit_price} onChange={(e) => updateQuoteVariant(iIdx, vIdx, "unit_price", parseFloat(e.target.value) || 0)} className={`w-full border border-emerald-500/30 rounded-md p-1.5 pl-5 text-center text-xs font-black text-emerald-500 outline-none focus:border-emerald-500 transition shadow-sm ${isLightMode ? "bg-emerald-50" : "bg-slate-900"}`} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="flex flex-col-reverse sm:flex-row justify-between items-center px-0 md:px-2 pt-4 gap-4">
                            <button type="button" onClick={() => addQuoteColorVariant(iIdx)} className={`w-full sm:w-auto px-4 py-3 md:py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${isLightMode ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700" : "bg-slate-800 hover:bg-slate-700 border-transparent text-white"}`}>+ Add Color</button>
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                              Units: <span className={`ml-2 text-xs ${theme.textStrong}`}>{item.variants.reduce((sum: number, v: any) => sum + calcVarQty(v), 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-center mt-6">
                      <button type="button" onClick={handleAddQuoteItem} className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-dashed transition-all ${isLightMode ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50" : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/5"}`}>
                        + Add Product Line
                      </button>
                    </div>
                  </div>

                  {/* Sticky Grand Total */}
                  <div className="sticky bottom-0 left-0 w-full bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 md:p-6 shadow-[0_-10px_40px_rgba(16,185,129,0.4)] flex flex-col md:flex-row justify-between items-center gap-4 md:px-7 z-40">
                    <div className="flex justify-between w-full md:w-auto md:gap-8">
                      <div>
                        <div className="text-[8px] md:text-[9px] font-black text-emerald-100 uppercase mb-1 tracking-[0.3em]">Quote Total</div>
                        <div className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none">${calcQuoteGrandTotal().toFixed(2)}</div>
                      </div>
                    </div>
                    <button onClick={handleSaveMatrixQuote} disabled={isSubmitting} className="w-full md:w-auto bg-white text-emerald-600 px-6 md:px-12 py-4 rounded-xl font-black uppercase text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                      {isSubmitting ? "Saving..." : "Approve & Send →"}
                    </button>
                  </div>
                </div>
              )}

              {/* ============ ORDERS & HISTORY ============ */}
              {currentTab === "orders" && (
                <div className="p-5 md:p-7 space-y-6 animate-in fade-in">
                  {/* Active Jobs */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`text-base md:text-lg font-black uppercase italic tracking-tight ${theme.textStrong}`}>📦 Active Jobs ({clientJobs.length})</h3>
                      {clientJobs.length > 0 && (
                        <Link href="/ShopFloor" className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${isLightMode ? "bg-white border-slate-200 hover:bg-fuchsia-50 text-slate-700 hover:text-fuchsia-600" : "bg-slate-900 border-white/10 hover:bg-fuchsia-900/20 text-slate-300"}`}>Shop Floor →</Link>
                      )}
                    </div>
                    {clientJobs.length === 0 ? (
                      <div className={`p-8 text-center border-2 border-dashed rounded-2xl ${theme.textMuted} ${theme.border}`}>
                        <div className="text-3xl mb-2">📦</div>
                        <p className="text-xs font-black uppercase tracking-widest">No Active Production</p>
                        <button onClick={() => setDossierTab("quote")} className="mt-3 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">+ Create Quote</button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientJobs.map((j: any) => {
                          const jobQuote = clientQuotes.find(q => q.id === j.quote_id);
                          const hasPaid = jobQuote && (jobQuote.amount_paid || 0) >= (jobQuote.total_amount || 0);

                          return (
                          <div key={j.id} className={`p-4 rounded-2xl border ${isLightMode ? "bg-white border-slate-200 hover:border-fuchsia-300" : "bg-slate-900/40 border-white/5 hover:border-fuchsia-500/30"} shadow-sm transition-colors`}>
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              <div>
                                <p className={`text-sm font-black uppercase tracking-tight ${theme.textStrong}`}>{j.po_number || `Job #${j.id.slice(0,6)}`}</p>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>Priority: {j.priority || "—"} • Est: {j.estimated_delivery ? new Date(j.estimated_delivery).toLocaleDateString() : "TBD"}</p>
                              </div>
                              <select 
                                value={j.stage || "Incoming"} 
                                onChange={(e) => handleUpdateJobStageInline(j.id, e.target.value)}
                                className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border outline-none cursor-pointer transition-colors ${j.stage === "Shipped" || j.stage === "Paid" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-500" : "bg-sky-500/15 border-sky-500/40 text-sky-500"}`}
                              >
                                {["Incoming", "Artwork in Approval", "To Buy", "To Print", "To Press", "To Deliver / Pick Up", "To Invoice", "Paid", "Dispatch", "Completed"].map(s => (
                                  <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
                                ))}
                              </select>
                            </div>
                            <div className={`text-xs font-bold ${theme.textMuted} leading-relaxed line-clamp-2`}>{formatItemSummary(j.quote_items || j)}</div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-inherit">
                              <div className="flex items-center gap-3">
                                <p className={`text-sm font-black ${theme.textStrong}`}>${(jobQuote?.total_amount ? jobQuote.total_amount * 1.13 : j.total_amount || 0).toFixed(2)}</p>
                                {jobQuote && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOverridePayment(jobQuote.id, !hasPaid, jobQuote.total_amount);
                                    }}
                                    className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded border transition-colors ${hasPaid ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30" : "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30"}`}
                                    title="Manually override Paid/Unpaid"
                                  >
                                    {hasPaid ? "✓ PAID" : "✕ UNPAID"}
                                  </button>
                                )}
                              </div>
                              <Link href={`/ShopFloor?job=${j.id}`} className="text-[10px] font-black uppercase tracking-widest text-fuchsia-500 hover:text-fuchsia-400">Track →</Link>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>

                  {/* Quote History */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`text-base md:text-lg font-black uppercase italic tracking-tight ${theme.textStrong}`}>📜 Quote History ({clientQuotes.length})</h3>
                      <button onClick={() => setDossierTab("quote")} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">+ New Quote</button>
                    </div>
                    {clientQuotes.length === 0 ? (
                      <div className={`p-8 text-center border-2 border-dashed rounded-2xl ${theme.textMuted} ${theme.border}`}>
                        <div className="text-3xl mb-2">📜</div>
                        <p className="text-xs font-black uppercase tracking-widest">No Quotes Yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {clientQuotes.map((q: any) => (
                          <div key={q.id} className={`p-4 rounded-xl border flex items-center justify-between gap-3 flex-wrap ${isLightMode ? "bg-white border-slate-200 hover:border-emerald-300" : "bg-slate-900/40 border-white/5 hover:border-emerald-500/30"} shadow-sm transition-colors`}>
                            <div>
                              <p className={`text-xs font-black uppercase tracking-tight ${theme.textStrong}`}>{q.po_number || `Quote #${q.id.slice(0,6)}`}</p>
                              <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>
                                {q.created_at ? new Date(q.created_at).toLocaleDateString() : "—"}
                                {q.status && <> • <span className={q.status === "Approved" ? "text-emerald-500" : q.status === "Sent" ? "text-sky-500" : "text-amber-500"}>{q.status}</span></>}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className={`text-base font-black ${theme.textStrong}`}>${(q.total_amount || 0).toFixed(2)}</p>
                              <button onClick={() => toast("info", "PDF generation coming soon.")} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-sky-500/10 text-sky-500 hover:bg-sky-500 hover:text-white transition-colors">PDF</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============ SETTINGS ============ */}
              {currentTab === "brand" && (
                <div className="p-5 md:p-7 space-y-6 animate-in fade-in">
                  {/* ============ LOGO SECTION ============ */}
                  <div className={`rounded-2xl border ${theme.border} ${theme.bgPanel} overflow-hidden`}>
                    <div className={`px-5 py-3 border-b ${theme.border} flex items-center justify-between`}>
                      <div>
                        <h3 className={`text-[14px] font-black uppercase italic tracking-tight ${theme.textStrong}`}>Logo</h3>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted} mt-0.5`}>The brand mark used across quotes, mockups, and the directory</p>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col md:flex-row gap-5 items-start">
                      <div className={`w-40 h-40 rounded-2xl border-2 border-dashed ${theme.border} ${isLightMode ? "bg-slate-50" : "bg-slate-950/40"} flex items-center justify-center shrink-0 overflow-hidden`}>
                        {selectedClient.logo_url ? (
                          isPdfUrl(selectedClient.logo_url) ? (
                            <object
                              data={`${selectedClient.logo_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                              type="application/pdf"
                              className="w-full h-full"
                            >
                              <a
                                href={selectedClient.logo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-2 text-center group"
                              >
                                <span className="text-6xl group-hover:scale-110 transition-transform">📕</span>
                                <span className={`text-[8px] font-black uppercase tracking-widest ${theme.textMuted} px-2 truncate max-w-[140px]`}>
                                  {filenameFromUrl(selectedClient.logo_url)}
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-violet-500 underline">Click to view</span>
                              </a>
                            </object>
                          ) : (
                            <img src={selectedClient.logo_url} alt="logo" className="max-w-full max-h-full object-contain p-2" />
                          )
                        ) : (
                          <div className={`text-center ${theme.textMuted}`}>
                            <div className="text-4xl font-black uppercase italic tracking-tighter opacity-30 mb-1">
                              {(selectedClient.company_name || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="text-[8px] font-black uppercase tracking-widest">No Logo</div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-3">
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*,application/pdf,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload(selectedClient.id, file);
                            if (e.target) e.target.value = "";
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => logoFileInputRef.current?.click()}
                            disabled={isUploadingLogo}
                            className="px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                          >
                            {isUploadingLogo ? "Uploading..." : selectedClient.logo_url ? "Replace Logo" : "Upload Logo"}
                          </button>
                          {selectedClient.logo_url && (
                            <>
                              <a
                                href={selectedClient.logo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`px-4 py-2.5 rounded-lg border ${theme.border} ${theme.textMuted} hover:${theme.textStrong} text-[10px] font-black uppercase tracking-widest transition-all`}
                              >
                                View Full Size
                              </a>
                              <button
                                onClick={() => downloadLogo(selectedClient.logo_url, selectedClient.company_name)}
                                className="px-4 py-2.5 rounded-lg bg-violet-500/10 border border-violet-500/40 text-violet-500 hover:bg-violet-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                ⬇ Download
                              </button>
                              <button
                                onClick={() => handleLogoRemove(selectedClient.id)}
                                className="px-4 py-2.5 rounded-lg border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 text-[10px] font-black uppercase tracking-widest transition-all"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                        <p className={`text-[9px] font-bold ${theme.textMuted}`}>
                          PNG, JPG, SVG, WEBP, or PDF. Up to 10 MB. Original quality preserved — no compression.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ============ DOCUMENTS SECTION ============ */}
                  <div className={`rounded-2xl border ${theme.border} ${theme.bgPanel} overflow-hidden`}>
                    <div className={`px-5 py-3 border-b ${theme.border} flex items-center justify-between gap-3 flex-wrap`}>
                      <div>
                        <h3 className={`text-[14px] font-black uppercase italic tracking-tight ${theme.textStrong}`}>
                          Documents <span className={`${theme.textMuted} font-normal text-[11px] ml-1`}>({customerDocuments.length})</span>
                        </h3>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted} mt-0.5`}>Brand guidelines, contracts, vector files — anything for this client</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={pendingDocType}
                          onChange={(e) => setPendingDocType(e.target.value)}
                          className={`px-3 py-2 rounded-lg text-[10px] font-bold outline-none border ${theme.inputBg}`}
                        >
                          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input
                          ref={docFileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && selectedClient.id) handleDocumentUpload(selectedClient.id, file, pendingDocType);
                            if (e.target) e.target.value = "";
                          }}
                        />
                        <button
                          onClick={() => docFileInputRef.current?.click()}
                          disabled={isUploadingDoc}
                          className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                        >
                          {isUploadingDoc ? "Uploading..." : "+ Upload Document"}
                        </button>
                      </div>
                    </div>

                    {/* Filter chips */}
                    <div className={`px-5 py-2 border-b ${theme.border} flex gap-1.5 flex-wrap items-center`}>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted} mr-1`}>Filter:</span>
                      {["all", ...DOC_TYPES].map(t => {
                        const count = t === "all" ? customerDocuments.length : customerDocuments.filter(d => d.doc_type === t).length;
                        return (
                          <button
                            key={t}
                            onClick={() => setDocTypeFilter(t)}
                            className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
                              docTypeFilter === t
                                ? "bg-violet-500/20 text-violet-500 border border-violet-500/50"
                                : `${theme.textMuted} hover:${theme.textStrong} border border-transparent`
                            }`}
                          >
                            {t === "all" ? "All" : t} {count > 0 && <span className="opacity-60">({count})</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Documents list */}
                    <div className="divide-y divide-current/10">
                      {(() => {
                        const docs = docTypeFilter === "all" ? customerDocuments : customerDocuments.filter(d => d.doc_type === docTypeFilter);
                        if (docs.length === 0) {
                          return (
                            <div className={`p-12 text-center ${theme.textMuted}`}>
                              <div className="text-4xl mb-3 opacity-40">📁</div>
                              <p className="text-[10px] font-black uppercase tracking-widest">
                                {customerDocuments.length === 0 ? "No documents yet — upload your first one above" : "No documents match this filter"}
                              </p>
                            </div>
                          );
                        }
                        return docs.map(doc => (
                          <div key={doc.id} className={`p-4 flex items-center gap-4 hover:${isLightMode ? "bg-slate-50" : "bg-slate-900/40"} transition-colors`}>
                            <div className="text-3xl shrink-0">{docTypeIcon(doc.mime_type, doc.file_name)}</div>
                            <div className="flex-1 min-w-0">
                              <div className={`font-black tracking-tight truncate ${theme.textStrong}`}>{doc.file_name}</div>
                              <div className={`text-[10px] font-bold ${theme.textMuted} flex items-center gap-2 flex-wrap mt-0.5`}>
                                <span className="px-2 py-0.5 rounded bg-violet-500/15 text-violet-500 text-[8px] font-black uppercase tracking-widest">{doc.doc_type || "Other"}</span>
                                <span>{formatBytes(doc.file_size_bytes || 0)}</span>
                                <span>•</span>
                                <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                                {doc.is_shared_with_customer && (
                                  <span className="text-emerald-500 font-black uppercase text-[8px] tracking-widest">✓ Shared with Customer</span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => handleDocumentDownload(doc)}
                                className={`px-3 py-2 rounded-lg border ${theme.border} ${theme.textMuted} hover:${theme.textStrong} text-[9px] font-black uppercase tracking-widest transition-colors`}
                                title="Download original file"
                              >
                                ⬇ Download
                              </button>
                              <button
                                onClick={() => handleDocumentToggleShare(doc)}
                                className={`px-3 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-colors ${
                                  doc.is_shared_with_customer
                                    ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                                    : `${theme.border} ${theme.textMuted} hover:${theme.textStrong}`
                                }`}
                                title="Toggle sharing with customer"
                              >
                                {doc.is_shared_with_customer ? "Shared" : "Private"}
                              </button>
                              <button
                                onClick={() => handleDocumentDelete(doc)}
                                className="px-3 py-2 rounded-lg border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 text-[9px] font-black uppercase tracking-widest transition-colors"
                                title="Delete document"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {currentTab === "settings" && (
                <form onSubmit={handleUpdateClientSettings} className="p-5 md:p-7 space-y-5 animate-in fade-in">
                  {/* Brand Vault */}
                  <div className={`p-5 rounded-2xl border ${isLightMode ? "bg-white border-slate-200" : "bg-slate-900/40 border-white/5"}`}>
                    <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${theme.textStrong}`}>🎨 Brand Vault</h3>
                    <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Brand Assets URL (Dropbox / Drive / Figma)</label>
                    <input type="url" value={selectedClient.brand_vault_url || ""} onChange={(e) => setSelectedClient({...selectedClient, brand_vault_url: e.target.value})} className={`w-full rounded-xl p-3 text-xs font-bold outline-none shadow-inner border ${theme.inputBg}`} placeholder="https://drive.google.com/..." />
                  </div>

                  {/* VIP Discount */}
                  <div className={`p-5 rounded-2xl border ${isLightMode ? "bg-sky-50 border-sky-200" : "bg-sky-950/20 border-sky-500/20"}`}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 text-sky-600 dark:text-sky-400">💎 VIP Discount Engine</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Tier</label>
                        <select value={selectedClient.vip_tier || "Standard"} onChange={(e) => {
                          const tier = VIP_TIERS.find(t => t.id === e.target.value);
                          setSelectedClient({...selectedClient, vip_tier: e.target.value, discount_percent: tier?.discount ?? 0});
                        }} className={`w-full rounded-xl p-3 text-xs font-bold outline-none shadow-inner border cursor-pointer ${theme.inputBg}`}>
                          {VIP_TIERS.map(t => <option key={t.id} value={t.id}>{t.label} ({t.discount}%)</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Custom Discount %</label>
                        <input type="number" min="0" max="50" value={selectedClient.discount_percent || 0} onChange={(e) => setSelectedClient({...selectedClient, discount_percent: parseInt(e.target.value) || 0})} className={`w-full rounded-xl p-3 text-xs font-bold outline-none shadow-inner border ${theme.inputBg}`} />
                      </div>
                    </div>
                  </div>

                  {/* Credentials */}
                  <div className={`p-5 rounded-2xl border ${isLightMode ? "bg-white border-slate-200" : "bg-slate-900/40 border-white/5"}`}>
                    <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${theme.textStrong}`}>🔐 Account Credentials</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Email (Login)</label>
                        <input type="email" value={selectedClient.email || ""} onChange={(e) => setSelectedClient({...selectedClient, email: e.target.value})} className={`w-full rounded-xl p-3 text-xs font-bold outline-none shadow-inner border ${theme.inputBg}`} />
                      </div>
                      <div>
                        <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Portal PIN</label>
                        <div className="flex gap-2">
                          <input type="text" maxLength={4} value={selectedClient.portal_pin || ""} onChange={(e) => setSelectedClient({...selectedClient, portal_pin: e.target.value})} className={`flex-1 rounded-xl p-3 text-center text-lg tracking-[0.5em] font-mono font-black outline-none shadow-inner border ${theme.inputBg}`} />
                          <button type="button" onClick={() => setSelectedClient({...selectedClient, portal_pin: String(Math.floor(1000 + Math.random() * 9000))})} className={`px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border ${isLightMode ? "bg-slate-100 hover:bg-slate-200 border-slate-200" : "bg-slate-800 hover:bg-slate-700 border-white/10"} ${theme.textStrong}`}>↻</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-50">
                      {isSubmitting ? "Saving..." : "💾 Save Settings"}
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="p-5 rounded-2xl border border-red-500/30 bg-red-500/5">
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-2 text-red-500">⚠️ Danger Zone</h3>
                    <p className={`text-[10px] font-bold mb-3 ${theme.textMuted}`}>Permanently deleting destroys portal access and removes from pipeline. Historical quotes remain intact.</p>
                    <button type="button" onClick={() => setConfirmDialog({
                      title: "Delete Client Record?",
                      message: `This will permanently remove ${selectedClient.company_name}. Quotes are preserved for accounting.`,
                      confirmLabel: "Delete Permanently",
                      danger: true,
                      onConfirm: async () => {
                        try {
                          await supabase.from("customers").delete().eq("id", selectedClient.id);
                          toast("success", `${selectedClient.company_name} deleted.`);
                          setSelectedClient(null);
                          fetchData();
                        } catch { toast("error", "Failed to delete."); }
                      }
                    })} className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[9px] font-black uppercase tracking-widest">Delete Client Record</button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
        );
      })()}

      {isAddClientOpen && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200" onClick={() => setIsAddClientOpen(false)}>
          <div className={`${theme.bgPanel} border ${theme.border} rounded-[2rem] w-full max-w-2xl p-6 md:p-8 shadow-2xl relative flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-inherit pb-4 mb-6">
              <div>
                <h2 className={`text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none ${theme.textStrong}`}>Add New B2B Lead</h2>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${theme.textMuted}`}>Create their profile and assign to the pipeline.</p>
              </div>
              <button onClick={() => setIsAddClientOpen(false)} className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'}`}>Close ✕</button>
            </div>

            <form onSubmit={handleAddClient} className="flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Company Name</label>
                  <input type="text" required value={newClient.company_name} onChange={(e) => setNewClient({...newClient, company_name: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} placeholder="e.g. Acme Corp" />
                </div>
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Primary Contact Name</label>
                  <input type="text" required value={newClient.contact_name} onChange={(e) => setNewClient({...newClient, contact_name: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} placeholder="e.g. John Doe" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Email (Login ID)</label>
                  <input type="email" required value={newClient.email} onChange={(e) => setNewClient({...newClient, email: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} placeholder="john@acme.com" />
                </div>
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Phone Number</label>
                  <input type="tel" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} placeholder="(555) 555-5555" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Website</label>
                  <input type="text" value={newClient.website} onChange={(e) => setNewClient({...newClient, website: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} placeholder="www.example.com" />
                </div>
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Address</label>
                  <input type="text" value={newClient.address} onChange={(e) => setNewClient({...newClient, address: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} placeholder="123 Print Street" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Lead Source</label>
                  <select value={newClient.lead_source} onChange={(e) => setNewClient({...newClient, lead_source: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border cursor-pointer ${theme.inputBg}`}>
                    <option value="">Select...</option>
                    <option value="Google Search">Google Search</option>
                    <option value="Referral / Word of Mouth">Referral / Word of Mouth</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="D2D">D2D</option>
                    <option value="Website">Website</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Date Found</label>
                  <input type="date" value={newClient.date_found} onChange={(e) => setNewClient({...newClient, date_found: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`p-4 rounded-2xl border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/30 border-white/5'}`}>
                  <label className={`text-[10px] font-black uppercase tracking-widest block mb-3 ${theme.textStrong}`}>Pipeline Stage</label>
                  <select value={newClient.lead_status} onChange={(e) => setNewClient({...newClient, lead_status: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none shadow-inner border cursor-pointer ${theme.inputBg}`}>
                    {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className={`p-4 rounded-2xl border ${isLightMode ? 'bg-sky-50 border-sky-200' : 'bg-sky-900/10 border-sky-900/30'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-sky-500">Portal PIN</label>
                    <button type="button" onClick={generatePin} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border transition-colors ${isLightMode ? 'bg-white border-sky-300 text-sky-600 hover:bg-sky-100' : 'bg-sky-900/50 border-sky-700 text-sky-400 hover:bg-sky-800'}`}>↻ Regen</button>
                  </div>
                  <input type="text" required maxLength={4} minLength={4} value={newClient.portal_pin} onChange={(e) => setNewClient({...newClient, portal_pin: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-center text-xl tracking-[1em] font-mono font-black outline-none transition-colors shadow-inner border focus:border-sky-500 ${isLightMode ? 'bg-white border-sky-300 text-sky-700' : 'bg-black border-sky-700 text-sky-400'}`} placeholder="1234" />
                </div>
              </div>

              <div className="border-t border-inherit pt-5 mt-2 flex gap-3">
                <button type="button" onClick={() => setIsAddClientOpen(false)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'border-slate-200 hover:bg-slate-100 text-slate-800' : 'border-slate-800 hover:bg-slate-800 text-white'}`}>Cancel</button>
                <button type="submit" disabled={isSubmitting || !newClient.email || !newClient.portal_pin} className={`flex-[2] py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isSubmitting || !newClient.email || !newClient.portal_pin ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600 border-none' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)]'}`}>
                  {isSubmitting ? 'Saving...' : 'Create Lead Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD RETAIL LEAD                                       */}
      {/* ============================================================ */}
      {isAddRetailOpen && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200" onClick={() => setIsAddRetailOpen(false)}>
          <div className={`${theme.bgPanel} border ${theme.border} rounded-[2rem] w-full max-w-md p-6 md:p-8 shadow-2xl relative flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-inherit pb-4 mb-6">
              <div>
                <h2 className={`text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none ${theme.textStrong}`}>Add Retail Lead</h2>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${theme.textMuted}`}>Quick add for DMs, walk-ins, and socials.</p>
              </div>
              <button onClick={() => setIsAddRetailOpen(false)} className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'}`}>Close ✕</button>
            </div>

            <form onSubmit={handleAddRetail} className="flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-2">
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Full Name <span className="text-red-500">*</span></label>
                <input type="text" required value={newRetail.contact_name} onChange={(e) => setNewRetail({...newRetail, contact_name: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-amber-500 ${theme.inputBg}`} placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Phone Number <span className="text-red-500">*</span></label>
                <input type="tel" required value={newRetail.phone} onChange={(e) => setNewRetail({...newRetail, phone: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-amber-500 ${theme.inputBg}`} placeholder="(555) 555-5555" />
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Email (Optional)</label>
                <input type="email" value={newRetail.email} onChange={(e) => setNewRetail({...newRetail, email: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-amber-500 ${theme.inputBg}`} placeholder="john@example.com" />
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Brand/Company (Optional)</label>
                <input type="text" value={newRetail.company_name} onChange={(e) => setNewRetail({...newRetail, company_name: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-amber-500 ${theme.inputBg}`} placeholder="Leave blank if personal order" />
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Lead Source</label>
                <select value={newRetail.lead_source} onChange={(e) => setNewRetail({...newRetail, lead_source: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border cursor-pointer focus:border-amber-500 ${theme.inputBg}`}>
                  <option value="">Select...</option>
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Word of Mouth">Word of Mouth</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="border-t border-inherit pt-5 mt-2">
                <button type="submit" disabled={isSubmitting || !newRetail.contact_name || !newRetail.phone} className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md ${isSubmitting || !newRetail.contact_name || !newRetail.phone ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600 border-none' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]'}`}>
                  {isSubmitting ? 'Saving...' : 'Add Retail Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: QUICK ORDER (GLOBAL)                                   */}
      {/* ============================================================ */}
      {isQuickOrderOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsQuickOrderOpen(false)}></div>

          <div className={`relative w-full max-w-6xl h-full ${theme.bgPanel} border-l ${theme.border} shadow-2xl flex flex-col animate-in slide-in-from-right duration-300`}>
            <div className={`p-6 md:p-8 border-b ${theme.border} flex justify-between items-start shrink-0`}>
              <div>
                <h2 className={`text-2xl md:text-3xl font-black uppercase italic tracking-tighter leading-none ${theme.textStrong}`}>Quick Order Matrix</h2>
                <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${theme.textMuted}`}>Instantly draft a proposal for any client.</p>
              </div>
              <button onClick={() => setIsQuickOrderOpen(false)} className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'}`}>Close ✕</button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-8 pb-32">
              <form id="quick-order-form" onSubmit={handleSaveQuickOrder} className="space-y-6 max-w-5xl mx-auto">

                {/* Customer Search */}
                <div className={`p-4 md:p-6 rounded-2xl border ${theme.border} shadow-sm relative z-40 ${isLightMode ? 'bg-slate-50' : 'bg-slate-900/50'}`}>
                  <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 pl-1 ${theme.textMuted}`}>Search Existing Customer</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type customer name to search..."
                      value={qoCustomerSearch}
                      onChange={(e) => { setQoCustomerSearch(e.target.value); setQoShowDropdown(true); setQoSelectedCustomerId(""); }}
                      onFocus={() => setQoShowDropdown(true)}
                      className={`w-full ${theme.inputBg} border ${qoSelectedCustomerId ? 'border-emerald-500/50' : ''} p-3 rounded-xl text-sm font-bold outline-none transition`}
                    />
                    {qoSelectedCustomerId && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Selected</div>
                    )}
                    {qoShowDropdown && qoCustomerSearch.length > 0 && !qoSelectedCustomerId && (
                      <div className={`absolute top-full left-0 w-full mt-2 border rounded-xl max-h-60 overflow-y-auto shadow-2xl z-50 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/10'}`}>
                        {qoFilteredCustomers.map(c => (
                          <button key={c.id} type="button" onClick={() => { setQoSelectedCustomerId(c.id); setQoCustomerSearch(c.company_name); setQoShowDropdown(false); }} className={`w-full text-left p-3 border-b transition-colors ${isLightMode ? 'hover:bg-blue-50 border-slate-100' : 'hover:bg-blue-600 border-white/5'}`}>
                            <div className={`text-xs font-black uppercase tracking-tight ${theme.textStrong}`}>{c.company_name}</div>
                            {c.vip_tier && c.vip_tier !== "Standard" && (
                              <div className={`text-[8px] font-black mt-0.5 ${theme.textMuted}`}>{(VIP_TIERS.find(t => t.id === c.vip_tier)?.label) || c.vip_tier} • {c.discount_percent || 0}% OFF</div>
                            )}
                          </button>
                        ))}
                        {qoFilteredCustomers.length === 0 && (
                          <div className={`p-4 text-center text-xs font-bold ${theme.textMuted}`}>No customer found. Add them as a lead first.</div>
                        )}
                        <button type="button" onClick={() => setQoShowDropdown(false)} className={`w-full text-center p-2 text-[9px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-100 text-slate-500 hover:text-slate-900' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>Close</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Magic Parser */}
                <div className={`p-4 md:p-6 rounded-2xl border border-sky-500/30 bg-sky-500/5 shadow-sm relative z-30`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest block pl-1 text-sky-500">🪄 Paste Client Message</label>
                      <p className="text-[9px] font-bold text-sky-600/70 dark:text-sky-400/70 pl-1 mb-2">AI will instantly extract garments, colors, and sizes.</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <textarea
                      value={aiOrderText}
                      onChange={(e) => setAiOrderText(e.target.value)}
                      placeholder="e.g., 'Need 3 Small Black T-Shirts and 3 Medium Black Sweaters...'"
                      className={`w-full sm:flex-1 h-14 min-h-[56px] rounded-xl p-3 text-xs font-medium outline-none transition shadow-inner border focus:border-sky-500 custom-scrollbar ${theme.inputBg}`}
                    />
                    <button
                      type="button"
                      onClick={handleAIParseOrder}
                      disabled={isParsingAI || !aiOrderText.trim()}
                      className="sm:w-32 h-14 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md transition-all border border-sky-500 bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {isParsingAI ? 'Thinking...' : 'AI Auto-Fill'}
                    </button>
                  </div>
                </div>

                {/* Line Items */}
                {qoItems.map((item, iIdx) => (
                  <div key={iIdx} className={`${theme.bgPanel} border ${theme.border} p-4 md:p-6 rounded-2xl shadow-lg relative`}>
                    <div className="flex flex-col md:grid md:grid-cols-2 gap-4 mb-4 border-b border-inherit pb-4">
                      <div className="relative w-full z-30">
                        <label className={`text-[9px] font-black uppercase tracking-widest block mb-1 pl-1 ${theme.textMuted}`}>Product</label>
                        <input
                          placeholder="Search catalog or type custom..."
                          className={`w-full ${theme.inputBg} border p-3 rounded-xl text-sm font-bold outline-none transition shadow-inner`}
                          value={item.description}
                          onFocus={() => updateQoItem(iIdx, "showDropdown", true)}
                          onChange={(e) => { updateQoItem(iIdx, "description", e.target.value); updateQoItem(iIdx, "searchQuery", e.target.value); updateQoItem(iIdx, "showDropdown", true); }}
                        />
                        {item.showDropdown && item.description.length > 0 && (
                          <div className={`absolute top-full left-0 w-full mt-2 border rounded-xl max-h-60 overflow-y-auto shadow-2xl ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/10'}`}>
                            {catalog.filter(p => p.name.toLowerCase().includes(item.description.toLowerCase())).map(p => (
                              <button key={p.id} type="button" onClick={() => selectQoProduct(iIdx, p)} className={`w-full text-left p-3 border-b transition-colors group ${isLightMode ? 'hover:bg-blue-50 border-slate-100' : 'hover:bg-blue-600 border-white/5'}`}>
                                <div className={`text-xs font-black uppercase tracking-tight ${theme.textStrong}`}>{p.name}</div>
                                <div className="text-[9px] text-blue-500 mt-1 uppercase font-bold">${p.default_price} | {p.category}</div>
                              </button>
                            ))}
                            {catalog.filter(p => p.name.toLowerCase().includes(item.description.toLowerCase())).length === 0 && (
                              <button type="button" onClick={async () => {
                                try {
                                  const { data: newItem, error } = await supabase.from("catalog_items").insert([{ name: item.description, default_price: 0, category: "Custom Insert" }]).select().single();
                                  if (error) throw error;
                                  setCatalog(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
                                  selectQoProduct(iIdx, newItem);
                                  toast("success", `Added "${item.description}" to catalog.`);
                                } catch { toast("error", "Failed to add catalog item."); }
                              }} className="w-full text-left p-3 bg-emerald-500/10 border-b border-emerald-500/30 hover:bg-emerald-500/20 transition-colors">
                                <div className="text-xs font-black uppercase tracking-tight text-emerald-500">+ Add "{item.description}" to Catalog</div>
                                <div className="text-[9px] text-emerald-400 mt-1 uppercase font-bold">Creates a new reusable product</div>
                              </button>
                            )}
                            <button type="button" onClick={() => updateQoItem(iIdx, "showDropdown", false)} className={`w-full text-center p-2 text-[9px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-100 text-slate-500 hover:text-slate-900' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>Close</button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row justify-between items-end md:flex-col md:justify-end md:text-right w-full">
                        <div className={`text-[9px] font-black uppercase tracking-widest md:mb-1 pr-1 ${theme.textMuted}`}>Subtotal</div>
                        <div className={`text-2xl md:text-4xl font-black tracking-tighter leading-none ${theme.textStrong}`}>${calcQoItemTotal(item).toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="space-y-2 w-full overflow-x-auto">
                      <div className={`hidden md:grid grid-cols-12 gap-1.5 text-[8px] font-black uppercase text-center tracking-widest mb-2 px-1 min-w-[1000px] ${theme.textMuted}`}>
                        <div className="col-span-1 text-left">Color</div>
                        <div>XS</div><div>S</div><div>M</div><div>L</div><div>XL</div><div>2XL</div><div>3XL</div><div>4XL</div><div>5XL</div>
                        <div className="col-span-1">Reg</div><div className="col-span-1 text-right">Disc</div>
                      </div>

                      {item.variants.map((v: any, vIdx: number) => (
                        <div key={vIdx} className={`flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-1.5 md:items-center p-4 md:p-2 rounded-xl border w-full min-w-[320px] md:min-w-[1000px] ${isLightMode ? 'bg-slate-50 border-slate-200 hover:border-blue-300' : 'bg-black/40 border-white/5 hover:border-blue-500/30'}`}>
                          <div className="flex-1 md:col-span-1">
                            <div className="text-[8px] text-slate-500 font-black uppercase mb-1 md:hidden pl-1">Color</div>
                            <input list={`qo-colors-${iIdx}-${vIdx}`} value={v.color} onChange={(e) => updateQoVariant(iIdx, vIdx, "color", e.target.value)} className="w-full bg-transparent border-none rounded-md p-1.5 md:p-0 text-xs font-black text-blue-500 uppercase outline-none" placeholder="Color" />
                            <datalist id={`qo-colors-${iIdx}-${vIdx}`}>{GILDAN_COLORS.map(c => <option key={c} value={c} />)}</datalist>
                          </div>

                          <div className="grid grid-cols-3 md:contents gap-1.5 w-full">
                            {SIZES.map(size => (
                              <div key={size} className="relative">
                                <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-1 text-[7px] font-black uppercase text-slate-500 md:hidden z-10 border rounded ${isLightMode ? 'bg-white border-slate-200' : 'bg-black border-slate-800'}`}>{size}</div>
                                <input type="number" value={v[size]} onChange={(e) => updateQoVariant(iIdx, vIdx, size, parseInt(e.target.value) || 0)} className={`w-full border rounded-md p-1.5 text-center text-xs font-black outline-none transition shadow-sm ${theme.inputBg}`} />
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-row md:contents gap-3 w-full border-t border-inherit pt-3 md:pt-0">
                            <div className="flex-1 md:col-span-1">
                              <div className="text-[8px] text-slate-500 font-black uppercase mb-1 md:hidden pl-1">Regular</div>
                              <div className="relative">
                                <span className="absolute left-2 top-1.5 text-[9px] font-black text-slate-400">$</span>
                                <input type="number" step="0.01" value={v.regular_price} onChange={(e) => updateQoVariant(iIdx, vIdx, "regular_price", parseFloat(e.target.value) || 0)} className={`w-full border rounded-md p-1.5 pl-5 text-center text-xs font-black line-through outline-none shadow-sm text-slate-400 ${theme.inputBg}`} />
                              </div>
                            </div>
                            <div className="flex-1 md:col-span-1">
                              <div className="text-[8px] text-slate-500 font-black uppercase mb-1 md:hidden pl-1">Discount</div>
                              <div className="relative">
                                <span className="absolute left-2 top-1.5 text-[9px] font-black text-emerald-500/50">$</span>
                                <input type="number" step="0.01" value={v.unit_price} onChange={(e) => updateQoVariant(iIdx, vIdx, "unit_price", parseFloat(e.target.value) || 0)} className={`w-full border border-emerald-500/30 rounded-md p-1.5 pl-5 text-center text-xs font-black text-emerald-500 outline-none focus:border-emerald-500 transition shadow-sm ${isLightMode ? 'bg-emerald-50' : 'bg-slate-900'}`} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex flex-col-reverse sm:flex-row justify-between items-center px-0 md:px-2 pt-4 gap-4">
                        <button type="button" onClick={() => addQoColorVariant(iIdx)} className={`w-full sm:w-auto px-4 py-3 md:py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${isLightMode ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-transparent text-white'}`}>+ Add Color</button>
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                          Units: <span className={`ml-2 text-xs ${theme.textStrong}`}>{item.variants.reduce((sum: number, v: any) => sum + calcQoVarQty(v), 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-center mt-6">
                  <button type="button" onClick={addQoLineItem} className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-dashed transition-all ${isLightMode ? 'border-slate-300 text-slate-500 hover:bg-slate-100' : 'border-slate-700 text-slate-400 hover:bg-white/5'}`}>
                    + Add Another Product
                  </button>
                </div>
              </form>
            </div>

            <div className="absolute bottom-0 left-0 w-full bg-blue-600 p-4 md:p-6 shadow-[0_-10px_40px_rgba(37,99,235,0.3)] flex flex-col md:flex-row justify-between items-center gap-4 md:px-12 z-50">
              <div className="flex justify-between w-full md:w-auto md:gap-12">
                <div>
                  <div className="text-[8px] md:text-[9px] font-black text-blue-200 uppercase mb-1 md:mb-1.5 tracking-[0.2em] md:tracking-[0.3em]">Grand Total</div>
                  <div className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none">${calcQoGrandTotal().toFixed(2)}</div>
                </div>
                <div className="border-l border-white/20 pl-4 md:pl-12 flex flex-col justify-center text-right md:text-left">
                  <div className="text-[8px] md:text-[9px] font-black text-emerald-200 uppercase tracking-widest mb-1">Savings</div>
                  <div className="text-lg font-black text-emerald-100 italic">-${calcQoTotalSavings().toFixed(2)}</div>
                </div>
              </div>
              <button onClick={handleSaveQuickOrder} disabled={isSavingQo || !qoSelectedCustomerId} className="w-full md:w-auto bg-white text-blue-600 px-6 md:px-12 py-4 rounded-xl font-black uppercase text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                {isSavingQo ? "Saving..." : "Save Proposal →"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
