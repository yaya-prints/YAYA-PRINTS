"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

const GILDAN_COLORS = ["White", "Black", "Navy", "Sport Grey", "Red", "Royal", "Dark Heather", "Charcoal", "Forest Green", "Gold", "Maroon", "Safety Pink", "Safety Orange"];
const SIZES = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl"];

// --- DYNAMIC COLOR ENGINE ---
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
const renderGarmentIcon = (description: string, colorHex: string) => {
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

// --- REVIEW LINK ---
const GOOGLE_REVIEW_LINK = "https://www.google.com/search?newwindow=1&sca_esv=5cb8f0632b7ab272&sxsrf=ANbL-n7iNlUbBZjUa4TM12siOcgLb-C_Mw%3A1776024637339&q=YAYA%20PRINTS%20-%20T-SHIRT%20PRINTING%20%26%20EMBROIDERY&stick=H4sIAAAAAAAAAONgU1I1qLAwM0kzMTFJM08xMjAzTkyzMqiwNDNOSzU2MrRIsUhKNk9JW8SqHekY6agQEOTpFxKsoKsQohvs4RkUAhHw9HNXUFNw9XUK8vd0cQ2KBAA4tNCKVwAAAA&mat=CdZMizuI6cWP&ved=2ahUKEwjYwPusj-mTAxW9ETQIHeusILwQrMcEegQILRAC&sei=S_zbaYz0EJ7vruEP97bcmQ4#lrd=0x864f444f7d2063af:0x963fe3218d8bc7df,3,,,,";

export default function AccountsReceivable() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<any[]>([]);
  
  // --- MODALS ---
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | string>("");
  const [historyModal, setHistoryModal] = useState<any>(null);
  const [editModal, setEditModal] = useState<any>(null);
  const [viewModal, setViewModal] = useState<any>(null);

  // --- FILTER & SEARCH STATE ---
  const [activeTab, setActiveTab] = useState<"all" | "unpaid" | "partial" | "past_due" | "paid">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState<string | null>(null); // when set, shows only this client's invoices

  // --- THEME STATE ---
  const [isLightMode, setIsLightMode] = useState<boolean>(false);

  // --- EDIT MODAL CUSTOMER STATE ---
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // --- ADDITIVE: SYNC, TOAST, CONFIRM DIALOG ---
  const [syncStatus, setSyncStatus] = useState<"live" | "polling" | "connecting">("connecting");
  const [toast, setToast] = useState<{type: "success"|"error"|"info"; message: string} | null>(null);
  const showToast = (type: "success"|"error"|"info", message: string) => {
    setToast({type, message});
    setTimeout(() => setToast(null), 3500);
  };
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel: string; danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    loadInvoices();
    loadCatalog();
    loadCustomers();

    // REALTIME SYNC — payments logged anywhere appear here
    const channel = supabase
      .channel('invoices-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => loadInvoices())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => loadInvoices())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSyncStatus('polling');
      });
    const poll = setInterval(loadInvoices, 60000);
    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    if (savedTheme === 'light') setIsLightMode(true);
  }, []);

  // Global ESC handler to close modals (topmost first)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmDialog) { setConfirmDialog(null); return; }
      if (paymentModal) { setPaymentModal(null); return; }
      if (historyModal) { setHistoryModal(null); return; }
      if (editModal) { setEditModal(null); return; }
      if (viewModal) { setViewModal(null); return; }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [paymentModal, historyModal, editModal, viewModal, confirmDialog]);

  async function loadCatalog() {
    const { data: cat } = await supabase.from("catalog_items").select("*").order('name');
    if (cat) setCatalog(cat);
  }

  async function loadCustomers() {
    const { data } = await supabase.from("customers").select("id, company_name").order("company_name");
    if (data) setCustomers(data);
  }

  async function loadInvoices() {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotes")
      .select(`
        id, 
        title,
        total_amount, 
        amount_paid, 
        payment_status,
        payment_history,
        created_at,
        notes,
        internal_notes,
        customers (company_name, contact_name, email, phone),
        jobs (id, job_number, title, stage),
        quote_items (id, description, quantity, unit_price, regular_price, quote_item_variants (id, color, xs, s, m, l, xl, xxl, xxxl, xxxxl, xxxxxl, regular_price, unit_price))
      `)
      .eq("status", "Approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("A/R DB ERROR:", error);
      showToast("error", "Database error: " + error.message);
    }
    if (data) setInvoices(data);
    setLoading(false);
  }

  // --- MATH CALCS ---
  const totalReceivables = invoices.reduce((sum, inv) => sum + (inv.total_amount * 1.13), 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
  const totalOutstanding = totalReceivables - totalCollected;

  // --- FILTER & SEARCH LOGIC ---
  const filteredInvoices = invoices.filter(inv => {
    const balance = (inv.total_amount * 1.13) - (inv.amount_paid || 0);
    const daysOld = (new Date().getTime() - new Date(inv.created_at).getTime()) / (1000 * 3600 * 24);

    // 1. Client filter (highest priority — when set, ignore everything else except search)
    if (clientFilter && (inv.customers?.company_name || "") !== clientFilter) return false;

    // 2. Check Tabs
    let tabMatch = true;
    if (activeTab === "paid") tabMatch = balance <= 0.01;
    if (activeTab === "unpaid") tabMatch = balance > 0.01 && (inv.amount_paid || 0) === 0;
    if (activeTab === "partial") tabMatch = balance > 0.01 && (inv.amount_paid || 0) > 0;
    if (activeTab === "past_due") tabMatch = balance > 0.01 && daysOld > 30;

    // 2. Check Search Query
    let searchMatch = true;
    if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const clientName = (inv.customers?.company_name || "").toLowerCase();
        const contactName = (inv.customers?.contact_name || "").toLowerCase();
        const jobNum = String(inv.jobs?.[0]?.job_number || "").toLowerCase();
        const dateStr = new Date(inv.created_at).toLocaleDateString().toLowerCase();
        const itemsMatch = (inv.quote_items || []).some((item: any) => (item.description || "").toLowerCase().includes(query));

        searchMatch = clientName.includes(query) || contactName.includes(query) || jobNum.includes(query) || dateStr.includes(query) || itemsMatch;
    }

    return tabMatch && searchMatch;
  });

  // --- PAYMENT LOGIC ---
  async function handleLogPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentModal || !paymentAmount) return;

    const amountToAdd = parseFloat(paymentAmount as string);
    const newTotalPaid = (paymentModal.amount_paid || 0) + amountToAdd;
    const grandTotalWithTax = paymentModal.total_amount * 1.13;

    let newStatus = "Partial";
    if (newTotalPaid >= grandTotalWithTax - 0.01) newStatus = "Paid in Full";
    if (newTotalPaid === 0) newStatus = "Unpaid";

    const newPaymentRecord = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        amount: amountToAdd
    };

    const currentHistory = paymentModal.payment_history || [];
    const updatedHistory = [...currentHistory, newPaymentRecord];

    await supabase.from("quotes").update({ 
        amount_paid: newTotalPaid, 
        payment_status: newStatus,
        payment_history: updatedHistory
    }).eq("id", paymentModal.id);

    if (newStatus === "Paid in Full" && paymentModal.jobs?.[0]) {
       await supabase.from("jobs").update({ stage: "Paid" }).eq("id", paymentModal.jobs[0].id);
    }

    setPaymentModal(null);
    setPaymentAmount("");
    loadInvoices();
  }

  async function handleReversePayment(paymentIdToReverse: string, amountToReverse: number) {
    setConfirmDialog({
      title: "Reverse this payment?",
      message: "The amount will be added back to their outstanding balance.",
      confirmLabel: "Reverse Payment",
      danger: true,
      onConfirm: async () => {
        const currentHistory = historyModal.payment_history || [];
        const updatedHistory = currentHistory.filter((p: any) => p.id !== paymentIdToReverse);
        const newTotalPaid = Math.max(0, (historyModal.amount_paid || 0) - amountToReverse);
        const grandTotalWithTax = historyModal.total_amount * 1.13;

        let newStatus = "Partial";
        if (newTotalPaid >= grandTotalWithTax - 0.01) newStatus = "Paid in Full";
        if (newTotalPaid === 0) newStatus = "Unpaid";

        try {
            await supabase.from("quotes").update({
                amount_paid: newTotalPaid,
                payment_status: newStatus,
                payment_history: updatedHistory
            }).eq("id", historyModal.id);

            if (historyModal.jobs?.[0] && newStatus !== "Paid in Full") {
               await supabase.from("jobs").update({ stage: "Billing" }).eq("id", historyModal.jobs[0].id);
            }

            setHistoryModal({
                ...historyModal,
                amount_paid: newTotalPaid,
                payment_status: newStatus,
                payment_history: updatedHistory
            });
            loadInvoices();
            showToast("success", `Reversed $${amountToReverse.toFixed(2)}`);
        } catch (error: any) {
            showToast("error", "Could not reverse: " + error.message);
        }
      }
    });
  }

  async function handleDirectReverse(inv: any) {
    setConfirmDialog({
      title: `Reset Invoice #${inv.jobs?.[0]?.job_number || ''}?`,
      message: "This clears ALL payment records and resets the invoice to UNPAID.",
      confirmLabel: "Reset to Unpaid",
      danger: true,
      onConfirm: async () => {
        try {
            await supabase.from("quotes").update({
                amount_paid: 0,
                payment_status: "Unpaid",
                payment_history: []
            }).eq("id", inv.id);

            if (inv.jobs?.[0]) {
               await supabase.from("jobs").update({ stage: "Billing" }).eq("id", inv.jobs[0].id);
            }

            loadInvoices();
            showToast("success", "Invoice reset to unpaid");
        } catch (error: any) {
            showToast("error", "Could not reset: " + error.message);
        }
      }
    });
  }

  async function handleDeleteOrder(quoteId: string, jobId?: string) {
    setConfirmDialog({
      title: "DELETE this order permanently?",
      message: "This removes the order, invoice, and all line items. This cannot be undone.",
      confirmLabel: "Delete Forever",
      danger: true,
      onConfirm: async () => {
        try {
          if (jobId) {
            await supabase.from("job_logs").delete().eq("job_id", jobId);
            await supabase.from("jobs").delete().eq("id", jobId);
          }
          const { data: items } = await supabase.from("quote_items").select("id").eq("quote_id", quoteId);
          if (items && items.length > 0) {
            const itemIds = items.map(i => i.id);
            await supabase.from("quote_item_variants").delete().in("quote_item_id", itemIds);
            await supabase.from("quote_items").delete().eq("quote_id", quoteId);
          }
          await supabase.from("quotes").delete().eq("id", quoteId);
          loadInvoices();
          showToast("success", "Order deleted");
        } catch (error: any) {
          showToast("error", "Could not delete: " + error.message);
        }
      }
    });
  }

  // --- EDIT ORDER LOGIC (WITH GENERAL ITEM SUPPORT) ---
  const openEditModal = (inv: any) => {
    const mappedItems = (inv.quote_items || []).map((item: any) => {
      const hasVariants = item.quote_item_variants && item.quote_item_variants.length > 0;
      return {
            ...item,
            type: hasVariants ? "apparel" : "general",
            searchQuery: item.description,
            showDropdown: false,
            
            regular_total: hasVariants ? 0 : (item.quantity * (item.regular_price || item.unit_price || 0)),
            unit_total: hasVariants ? 0 : (item.quantity * (item.unit_price || 0)),
            variants: hasVariants
                  ? JSON.parse(JSON.stringify(item.quote_item_variants))
                  : [],
        sides: "Single Sided"
      };
    });

    if (mappedItems.length === 0) {
      mappedItems.push({ 
        id: `new_${Date.now()}`, type: "apparel", searchQuery: "", description: "", showDropdown: false,
        variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] 
      });
    }

    setEditModal({
      ...inv,
      editedItems: mappedItems,
      editedNotes: inv.notes || "",
      editedInternalNotes: inv.internal_notes || "",
      reassignCustomerId: inv.customer_id,
      editedTitle: inv.title || "" 
    });
    setCustomerSearch(inv.customers?.company_name || "");
  };

  const handleEditItemChange = (itemIdx: number, field: string, value: any) => {
    const newItems = [...editModal.editedItems];
    newItems[itemIdx][field] = value;
    setEditModal({ ...editModal, editedItems: newItems });
  };

  const handleEditVariantChange = (itemIdx: number, varIdx: number, field: string, value: any) => {
    const newItems = [...editModal.editedItems];
    newItems[itemIdx].variants[varIdx][field] = value;
    setEditModal({ ...editModal, editedItems: newItems });
  };

  const handleAddItemRow = (type: "apparel" | "general" = "apparel") => {
    if (type === "general") {
      setEditModal({
        ...editModal,
        editedItems: [...editModal.editedItems, { 
          id: `new_${Date.now()}`, description: "", type: "general", searchQuery: "", showDropdown: false, 
          quantity: 1, regular_total: 0, unit_total: 0, variants: [], sides: "Single Sided"
        }]
      });
    } else {
      setEditModal({
        ...editModal,
        editedItems: [...editModal.editedItems, { 
          id: `new_${Date.now()}`, description: "", type: "apparel", searchQuery: "", showDropdown: false, 
          variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] 
        }]
      });
    }
  };

  const addColorVariant = (itemIdx: number) => {
    const newItems = [...editModal.editedItems];
    const lastVar = newItems[itemIdx].variants[newItems[itemIdx].variants.length - 1];
    newItems[itemIdx].variants.push({ 
        id: `new_var_${Date.now()}`,
        color: "White", 
        xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, 
        regular_price: lastVar ? lastVar.regular_price : 0, 
        unit_price: lastVar ? lastVar.unit_price : 0 
    });
    setEditModal({ ...editModal, editedItems: newItems });
  };

  const handleRemoveItemRow = (index: number) => {
    const newItems = [...editModal.editedItems];
    newItems.splice(index, 1);
    setEditModal({ ...editModal, editedItems: newItems });
  };

  const handleRemoveVariantRow = (itemIdx: number, varIdx: number) => {
    const newItems = [...editModal.editedItems];
    newItems[itemIdx].variants.splice(varIdx, 1);
    setEditModal({ ...editModal, editedItems: newItems });
  };

  const selectProduct = (itemIdx: number, product: any) => {
    const newItems = [...editModal.editedItems];
    newItems[itemIdx].description = product.name; 
    newItems[itemIdx].searchQuery = product.name; 
    newItems[itemIdx].showDropdown = false; 

    if (product.category === "Print Media" || product.category === "Misc" || product.category === "Services" || product.category === "Design" || product.category === "Custom Insert" || product.category === "Upsells") {
      newItems[itemIdx].type = "general";
      newItems[itemIdx].quantity = 1;
      newItems[itemIdx].unit_total = product.default_price;
      newItems[itemIdx].regular_total = product.default_price;
      newItems[itemIdx].variants = []; 
      newItems[itemIdx].sides = "Single Sided";
    } else {
      newItems[itemIdx].type = "apparel";
      if (!newItems[itemIdx].variants || newItems[itemIdx].variants.length === 0) {
        newItems[itemIdx].variants = [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: product.default_price, unit_price: product.default_price }];
      } else {
        newItems[itemIdx].variants = newItems[itemIdx].variants.map((v: any) => ({
          ...v, unit_price: product.default_price, regular_price: product.default_price 
        }));
      }
    }
    setEditModal({ ...editModal, editedItems: newItems });
  };

  const calculateVariantQty = (v: any) => v.xs + v.s + v.m + v.l + v.xl + v.xxl + v.xxxl + v.xxxxl + v.xxxxxl;
  const calculateVariantTotalValue = (v: any) => calculateVariantQty(v) * v.unit_price;
  const calculateItemTotalValue = (item: any) => {
    if (item.type === "general") return item.unit_total || 0;
    return (item.variants || []).reduce((sum: number, v: any) => sum + calculateVariantTotalValue(v), 0);
  };

  const handleSaveOrderEdits = async () => {
    try {
      let newSubtotal = 0;
      editModal.editedItems.forEach((item: any) => {
        newSubtotal += calculateItemTotalValue(item);
      });

      await supabase.from("quotes").update({
        total_amount: newSubtotal,
        notes: editModal.editedNotes,
        internal_notes: editModal.editedInternalNotes,
        title: editModal.editedTitle,
        customer_id: editModal.reassignCustomerId
      }).eq("id", editModal.id);

      for (const item of editModal.editedItems) {
        if (!item.description?.trim() && !item.searchQuery?.trim()) continue;

        const finalDescriptionToSave = item.description || item.searchQuery;
        let currentItemId = item.id;
            if (item.type === "general") {
              const unitPrice = item.quantity > 0 ? (item.unit_total / item.quantity) : 0;
              const regularPrice = item.quantity > 0 ? (item.regular_total / item.quantity) : 0;
              const finalDescription = item.sides && item.sides !== "Single Sided" ? `${finalDescriptionToSave} (${item.sides})` : finalDescriptionToSave;
              if (item.id.toString().startsWith('new_')) {
                const { data: insertedItem, error: iError } = await supabase.from("quote_items").insert([{
                  quote_id: editModal.id, description: finalDescription, quantity: item.quantity, unit_price: unitPrice, regular_price: regularPrice
                }]).select().single();
                if (iError) throw iError;
                currentItemId = insertedItem.id;
              } else {
                await supabase.from("quote_items").update({
                  description: finalDescription, quantity: item.quantity, unit_price: unitPrice, regular_price: regularPrice
                }).eq("id", item.id);
              }
          if (!item.id.toString().startsWith('new_')) {
             await supabase.from("quote_item_variants").delete().eq("quote_item_id", item.id);
          }
        } else {
          const itemTotalQty = (item.variants || []).reduce((sum: number, v: any) => sum + calculateVariantQty(v), 0);
          
          if (item.id.toString().startsWith('new_')) {
            const { data: insertedItem, error: iError } = await supabase.from("quote_items").insert([{
              quote_id: editModal.id,
              description: finalDescriptionToSave,
              quantity: itemTotalQty,
              unit_price: item.variants[0]?.unit_price || 0
            }]).select().single();
            if (iError) throw iError;
            currentItemId = insertedItem.id;
          } else {
            await supabase.from("quote_items").update({
              description: finalDescriptionToSave,
              quantity: itemTotalQty,
              unit_price: item.variants[0]?.unit_price || 0
            }).eq("id", item.id);
          }

          for (const v of (item.variants || [])) {
             const variantData = {
               quote_item_id: currentItemId, color: v.color, regular_price: v.regular_price, unit_price: v.unit_price,
               xs: v.xs, s: v.s, m: v.m, l: v.l, xl: v.xl, xxl: v.xxl, xxxl: v.xxxl, xxxxl: v.xxxxl, xxxxxl: v.xxxxxl
             };
             
             if (!v.id || v.id.toString().startsWith('new_')) {
               await supabase.from("quote_item_variants").insert([variantData]);
             } else {
               await supabase.from("quote_item_variants").update(variantData).eq("id", v.id);
             }
          }
        }
      }

      const originalItemIds = editModal.quote_items.map((i: any) => i.id);
      const currentItemIds = editModal.editedItems.filter((i: any) => !i.id.toString().startsWith('new_')).map((i: any) => i.id);
      const deletedItemIds = originalItemIds.filter((id: any) => !currentItemIds.includes(id));
      
      if (deletedItemIds.length > 0) {
          await supabase.from("quote_item_variants").delete().in("quote_item_id", deletedItemIds);
          await supabase.from("quote_items").delete().in("id", deletedItemIds);
      }

      setEditModal(null);
      loadInvoices();

    } catch (err: any) {
      showToast("error", "Could not save: " + err.message);
    }
  };

  const formatItemSummary = (items: any[]) => {
    if (!items || items.length === 0) return "No items detailed";
    return items.map(i => {
        let total = 0;
        if (i.quote_item_variants && i.quote_item_variants.length > 0) {
            total = i.quote_item_variants.reduce((sum: number, v: any) => sum + v.xs + v.s + v.m + v.l + v.xl + v.xxl + v.xxxl + v.xxxxl + v.xxxxxl, 0);
        }
        return `${total > 0 ? total : i.quantity}x ${i.description}`;
    }).join(" • ");
  };

  const sendReviewRequestWA = (inv: any) => {
    const cleanPhone = inv.customers?.phone?.replace(/\D/g, '');
    if (!cleanPhone) { showToast("info", "No phone number for this customer"); return; }
    const text = encodeURIComponent(`Hi ${inv.customers?.contact_name || 'there'}!\n\nThank you so much for choosing YAYA Prints for Job #${inv.jobs?.[0]?.job_number || "TBD"}.\n\nIf you love how your custom gear turned out, we would be incredibly grateful if you left us a quick 5-star review on Google! It helps our small business grow.\n\nLeave a review here:\n⭐ ${GOOGLE_REVIEW_LINK}\n\nThank you again for your business!`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  // --- THEME CLASSES ---
  const theme = {
      bgMain: isLightMode ? "bg-slate-50" : "bg-[#0f1115]",
      textMain: isLightMode ? "text-slate-900" : "text-white",
      bgPanel: isLightMode ? "bg-white" : "bg-slate-900",
      bgSubPanel: isLightMode ? "bg-slate-50" : "bg-slate-900/50",
      border: isLightMode ? "border-slate-200" : "border-white/5",
      borderLight: isLightMode ? "border-slate-200" : "border-white/10",
      textMuted: isLightMode ? "text-slate-500" : "text-slate-500",
      textStrong: isLightMode ? "text-slate-900" : "text-white",
      inputBg: isLightMode ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-black border-emerald-500/30 text-white",
      inputStandard: isLightMode ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-sky-500" : "bg-black border-slate-700 text-white focus:border-sky-500",
  };

  const filteredCustomersForModal = customers.filter(c => 
    c.company_name?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // ---- AGING BUCKETS — standard A/R aging ----
  const agingBuckets = (() => {
    const buckets = { current: 0, b30: 0, b60: 0, b90: 0 };
    invoices.forEach(inv => {
      const balance = (inv.total_amount * 1.13) - (inv.amount_paid || 0);
      if (balance <= 0.01) return;
      const days = (Date.now() - new Date(inv.created_at).getTime()) / (1000 * 3600 * 24);
      if (days <= 30) buckets.current += balance;
      else if (days <= 60) buckets.b30 += balance;
      else if (days <= 90) buckets.b60 += balance;
      else buckets.b90 += balance;
    });
    return buckets;
  })();

  // ---- TOP OWING CLIENTS (compact panel) ----
  const topOwers = (() => {
    const byClient: Record<string, { name: string; amount: number; oldestDays: number; count: number }> = {};
    invoices.forEach(inv => {
      const balance = (inv.total_amount * 1.13) - (inv.amount_paid || 0);
      if (balance <= 0.01) return;
      const name = inv.customers?.company_name || "Unknown";
      const days = Math.floor((Date.now() - new Date(inv.created_at).getTime()) / (1000 * 3600 * 24));
      if (!byClient[name]) byClient[name] = { name, amount: 0, oldestDays: 0, count: 0 };
      byClient[name].amount += balance;
      byClient[name].oldestDays = Math.max(byClient[name].oldestDays, days);
      byClient[name].count += 1;
    });
    return Object.values(byClient).sort((a, b) => b.amount - a.amount).slice(0, 5);
  })();

  // ---- LAST PAYMENT DATE (across whole ledger) ----
  const lastPaymentDate = (() => {
    let latest: Date | null = null;
    invoices.forEach(inv => {
      (inv.payment_history || []).forEach((p: any) => {
        const d = new Date(p.date);
        if (!latest || d > latest) latest = d;
      });
    });
    return latest;
  })();

  // Helper for line-item math used in View Modal
  const lineItemTotals = (item: any) => {
    let qty = 0, regularTotal = 0, lineTotal = 0;
    if (item.quote_item_variants && item.quote_item_variants.length > 0) {
      item.quote_item_variants.forEach((v: any) => {
        const vQty = (v.xs||0)+(v.s||0)+(v.m||0)+(v.l||0)+(v.xl||0)+(v.xxl||0)+(v.xxxl||0)+(v.xxxxl||0)+(v.xxxxxl||0);
        qty += vQty;
        regularTotal += (v.regular_price || v.unit_price || 0) * vQty;
        lineTotal    += (v.unit_price || 0) * vQty;
      });
    } else {
      qty = item.quantity || 0;
      regularTotal = (item.regular_price || item.unit_price || 0) * qty;
      lineTotal    = (item.unit_price || 0) * qty;
    }
    const discount = regularTotal - lineTotal;
    const discountPct = regularTotal > 0 ? Math.round((discount / regularTotal) * 100) : 0;
    return { qty, regularTotal, lineTotal, discount, discountPct };
  };

  return (
    <div className={`p-3 sm:p-4 md:p-10 max-w-[1600px] mx-auto min-h-screen ${theme.bgMain} ${theme.textMain} font-sans pb-8 md:pb-32 transition-colors duration-300`}>
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-end mb-5 md:mb-8 border-b ${theme.borderLight} pb-5 md:pb-6 mt-2 md:mt-4 gap-3 md:gap-4`}>
        <div className="w-full md:w-auto">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className={`text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none ${theme.textStrong}`}>Accounts Receivable</h1>
            <span
              className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 px-2 py-1 rounded-full border ${
                syncStatus === 'live'
                  ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                  : syncStatus === 'polling'
                    ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
                    : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
              }`}
              title={syncStatus === 'live' ? 'Realtime sync active — payments logged anywhere appear here instantly' : syncStatus === 'polling' ? 'Polling every 60s' : 'Connecting…'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'live' ? 'bg-emerald-500 animate-pulse' : syncStatus === 'polling' ? 'bg-amber-500' : 'bg-slate-400 animate-pulse'}`}></span>
              {syncStatus === 'live' ? 'Live' : syncStatus === 'polling' ? 'Poll' : '...'}
            </span>
          </div>
          <p className={`text-[11px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.3em] mt-3 md:mt-4 ml-1 ${theme.textMuted}`}>
            Financial Ledger & Cash Flow
            {lastPaymentDate && <> · Last payment {(lastPaymentDate as Date).toLocaleDateString()}</>}
          </p>
        </div>
        {clientFilter && (
          <button onClick={() => setClientFilter(null)} className={`w-full md:w-auto px-4 py-3 md:py-2 rounded-lg text-[11px] md:text-[10px] font-black uppercase tracking-widest border transition-colors flex items-center gap-2 justify-center min-h-[44px] md:min-h-0 active:scale-95 ${isLightMode ? 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100' : 'bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20'}`}>
            <span>👤 {clientFilter}</span>
            <span className="opacity-70">✕ clear</span>
          </button>
        )}
      </div>

      {/* FINANCIAL KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-8 mb-5 md:mb-8">
        <div className={`${theme.bgPanel} border ${theme.border} p-5 sm:p-6 md:p-8 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] shadow-xl dark:shadow-2xl relative overflow-hidden transition-colors`}>
          <div className={`text-[11px] md:text-[10px] font-black uppercase tracking-widest mb-2 ${theme.textMuted}`}>Total Booked (Inc. Tax)</div>
          <div className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter ${theme.textStrong}`}>${totalReceivables.toFixed(2)}</div>
        </div>
        <div className={`${theme.bgPanel} border ${theme.border} p-5 sm:p-6 md:p-8 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] shadow-xl dark:shadow-2xl relative overflow-hidden transition-colors`}>
          <div className={`text-[11px] md:text-[10px] font-black uppercase tracking-widest mb-2 ${isLightMode ? 'text-emerald-600' : 'text-emerald-500/60'}`}>Cash Collected</div>
          <div className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter ${isLightMode ? 'text-emerald-500' : 'text-emerald-400'}`}>${totalCollected.toFixed(2)}</div>
        </div>
        <div className={`${theme.bgPanel} border ${theme.border} p-5 sm:p-6 md:p-8 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] shadow-xl dark:shadow-2xl relative overflow-hidden border-b-4 border-b-red-500/50 transition-colors ${isLightMode ? 'bg-red-50' : ''}`}>
          <div className={`text-[11px] md:text-[10px] font-black uppercase tracking-widest mb-2 ${isLightMode ? 'text-red-600' : 'text-red-500/60'}`}>Outstanding Balance</div>
          <div className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter ${isLightMode ? 'text-red-500' : 'text-red-400'}`}>${totalOutstanding.toFixed(2)}</div>
        </div>
      </div>

      {/* AGING BUCKETS + TOP OWERS */}
      {!loading && totalOutstanding > 0.01 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
          {/* Aging buckets — 2/3 */}
          <div className={`lg:col-span-2 ${theme.bgPanel} border ${theme.border} p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-inherit">
              <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.textMuted}`}>📊 Aging Receivables</h3>
              <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>By invoice age</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Current",   subtitle: "0-30 days",  amount: agingBuckets.current, color: "emerald" },
                { label: "31-60 d",   subtitle: "warming",    amount: agingBuckets.b30,     color: "amber" },
                { label: "61-90 d",   subtitle: "follow up",  amount: agingBuckets.b60,     color: "orange" },
                { label: "90+ days",  subtitle: "collect now",amount: agingBuckets.b90,     color: "red" },
              ].map(b => (
                <div key={b.label} className={`p-4 rounded-xl border ${b.amount > 0 ? `border-${b.color}-500/30 bg-${b.color}-500/5` : (isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/5 bg-black/40')}`}>
                  <div className={`text-[8px] font-black uppercase tracking-widest ${b.amount > 0 ? `text-${b.color}-600 dark:text-${b.color}-400` : theme.textMuted}`}>{b.label}</div>
                  <div className={`text-xl md:text-2xl font-black tracking-tighter mt-1 ${b.amount > 0 ? `text-${b.color}-500` : (isLightMode ? 'text-slate-300' : 'text-slate-700')}`}>
                    ${b.amount.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </div>
                  <div className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${theme.textMuted}`}>{b.subtitle}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top owers — 1/3 */}
          <div className={`${theme.bgPanel} border ${theme.border} p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-inherit">
              <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.textMuted}`}>💰 Top Owing Clients</h3>
            </div>
            {topOwers.length === 0 ? (
              <div className={`text-center py-6 text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>All paid up</div>
            ) : (
              <div className="flex flex-col gap-2">
                {topOwers.map(c => (
                  <button
                    key={c.name}
                    onClick={() => setClientFilter(c.name)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-all hover:-translate-y-0.5 ${isLightMode ? 'bg-slate-50 border-slate-200 hover:border-rose-300' : 'bg-black/40 border-white/5 hover:border-rose-500/40'}`}
                    title="Click to filter to this client's invoices"
                  >
                    <div className="flex flex-col overflow-hidden">
                      <span className={`text-[11px] font-black uppercase truncate ${theme.textStrong}`}>{c.name}</span>
                      <span className={`text-[8px] font-bold uppercase tracking-widest ${c.oldestDays > 60 ? 'text-red-500' : c.oldestDays > 30 ? 'text-amber-500' : theme.textMuted}`}>
                        {c.count} invoice{c.count > 1 ? 's' : ''} · oldest {c.oldestDays}d
                      </span>
                    </div>
                    <span className="text-sm font-black text-rose-500 shrink-0">${c.amount.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* (was: empty placeholder, this comment block kept to preserve location) */}

      {/* FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 lg:pb-0 w-full lg:w-auto">
              <button onClick={() => setActiveTab("all")} className={`px-5 sm:px-6 py-3 sm:py-2.5 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[44px] sm:min-h-0 active:scale-95 ${activeTab === 'all' ? (isLightMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-black border-white') : (isLightMode ? 'bg-white text-slate-500 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-700')}`}>
                All Invoices
              </button>
              <button onClick={() => setActiveTab("unpaid")} className={`px-5 sm:px-6 py-3 sm:py-2.5 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[44px] sm:min-h-0 active:scale-95 ${activeTab === 'unpaid' ? (isLightMode ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-rose-500/20 text-rose-400 border-rose-500/50') : (isLightMode ? 'bg-white text-slate-500 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-700')}`}>
                Unpaid (0$)
              </button>
              <button onClick={() => setActiveTab("partial")} className={`px-5 sm:px-6 py-3 sm:py-2.5 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[44px] sm:min-h-0 active:scale-95 ${activeTab === 'partial' ? (isLightMode ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-amber-500/20 text-amber-400 border-amber-500/50') : (isLightMode ? 'bg-white text-slate-500 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-700')}`}>
                Partially Paid
              </button>
              <button onClick={() => setActiveTab("past_due")} className={`px-5 sm:px-6 py-3 sm:py-2.5 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[44px] sm:min-h-0 active:scale-95 ${activeTab === 'past_due' ? (isLightMode ? 'bg-red-100 text-red-700 border-red-300' : 'bg-red-500/20 text-red-400 border-red-500/50') : (isLightMode ? 'bg-white text-slate-500 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-700')}`}>
                30+ Days Past Due
              </button>
              <button onClick={() => setActiveTab("paid")} className={`px-5 sm:px-6 py-3 sm:py-2.5 rounded-full text-[11px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[44px] sm:min-h-0 active:scale-95 ${activeTab === 'paid' ? (isLightMode ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50') : (isLightMode ? 'bg-white text-slate-500 border-slate-200' : 'bg-slate-900 text-slate-400 border-slate-700')}`}>
                Fully Paid
              </button>
          </div>
          
          {/* SEARCH BAR */}
          <div className="w-full lg:w-80 relative shrink-0">
              <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Job #, Client, Items..." 
                  className={`w-full rounded-full pl-10 pr-5 py-2.5 text-sm font-bold outline-none border transition-colors shadow-inner ${theme.inputStandard}`}
              />
              <svg className={`absolute left-3.5 top-3 w-4 h-4 ${theme.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
      </div>

      {/* LEDGER TABLE */}
      <div className={`${theme.bgSubPanel} rounded-[2rem] md:rounded-[3rem] border ${theme.border} shadow-xl dark:shadow-2xl overflow-hidden transition-colors`}>
        
        <div className={`hidden md:grid grid-cols-12 gap-4 p-6 border-b ${theme.borderLight} text-[10px] font-black uppercase tracking-[0.2em] px-10 ${isLightMode ? 'bg-slate-100 text-slate-500' : 'bg-black/40 text-slate-500'}`}>
          <div className="col-span-5">Order Information</div>
          <div className="col-span-2 text-right">Invoice Total</div>
          <div className="col-span-2 text-right">Balance Due</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        <div className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/5'}`}>
          {loading ? (
            <div className={`p-10 md:p-20 text-center font-black uppercase tracking-widest ${theme.textMuted}`}>Syncing Ledger...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className={`p-10 md:p-20 text-center font-black uppercase tracking-widest italic ${theme.textMuted}`}>No invoices found matching criteria.</div>
          ) : (
            filteredInvoices.map((inv) => {
              const grandTotalWithTax = inv.total_amount * 1.13;
              const balance = grandTotalWithTax - (inv.amount_paid || 0);
              const progress = grandTotalWithTax > 0 ? ((inv.amount_paid || 0) / grandTotalWithTax) * 100 : 0;
              const jobId = inv.jobs?.[0]?.id;
              const daysOld = (new Date().getTime() - new Date(inv.created_at).getTime()) / (1000 * 3600 * 24);
              const isPastDue = balance > 0 && daysOld > 30;
              
              return (
                <div 
                  key={inv.id} 
                  onClick={(e) => {
                    if ((e.target as Element)?.closest('button, a')) return;
                    setViewModal(inv);
                  }}
                  className={`flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-4 p-6 md:px-10 items-start md:items-center transition-colors group cursor-pointer relative overflow-hidden hover:scale-[1.005] active:scale-[0.995] transform duration-150 ${
                    isPastDue 
                        ? (isLightMode ? 'bg-red-50/50 hover:bg-red-50' : 'bg-red-950/20 hover:bg-red-950/40') 
                        : (isLightMode ? 'bg-white hover:bg-slate-50' : 'hover:bg-white/5')
                }`}>
                  
                  {isPastDue && <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>}

                  <div className="md:col-span-5 w-full min-w-0 relative z-10 flex flex-col justify-center">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.2em] border flex-shrink-0 ${isLightMode ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>
                              JOB #{inv.jobs?.[0]?.job_number || "N/A"}
                          </span>
                          <button
                              onClick={(e) => { e.stopPropagation(); setClientFilter(inv.customers?.company_name || null); }}
                              title="Click to filter to this client"
                              className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.2em] border flex-shrink-0 shadow-sm truncate max-w-[160px] cursor-pointer transition-colors ${isLightMode ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'}`}>
                              {inv.customers?.company_name || "Unknown Client"}
                          </button>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] border flex-shrink-0 ${isLightMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                              {new Date(inv.created_at).toLocaleDateString()} · {Math.floor(daysOld)}d ago
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] border flex-shrink-0 ${
                              inv.payment_status === "Paid in Full" 
                                  ? (isLightMode ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20') 
                                  : inv.payment_status === "Partial" 
                                      ? (isLightMode ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/20')
                                      : (isLightMode ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-rose-500/10 text-rose-400 border-rose-500/20')
                          }`}>
                           {inv.payment_status || "UNPAID"}
                          </span>
                      </div>

                      <div className="text-xl md:text-2xl font-black uppercase tracking-tighter truncate" title={inv.title || inv.customers?.company_name}>
                          {inv.title || inv.customers?.company_name || "Unknown Client"}
                      </div>
                      
                      {inv.quote_items && inv.quote_items.length > 0 && (
                          <div className={`text-sm font-bold uppercase tracking-widest truncate mt-1 ${theme.textMuted}`} title={formatItemSummary(inv.quote_items)}>
                              {inv.quote_items.slice(0, 2).map((i: any) => {
                                  let total = 0;
                                  if (i.quote_item_variants && i.quote_item_variants.length > 0) {
                                      total = i.quote_item_variants.reduce((sum: number, v: any) => sum + v.xs + v.s + v.m + v.l + v.xl + v.xxl + v.xxxl + v.xxxxl + v.xxxxxl, 0);
                                  }
                                  return `${total > 0 ? total : i.quantity}x ${i.description}`;
                              }).join(" • ")}
                              {inv.quote_items.length > 2 && (
                                  <span className={`ml-2 ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}>
                                      • +{inv.quote_items.length - 2} MORE ITEM{inv.quote_items.length - 2 > 1 ? 'S' : ''}
                                  </span>
                              )}
                          </div>
                      )}
                  </div>

                  {/* COL 4 & 5: FINANCIALS */}
                  <div className={`flex justify-between w-full md:contents mt-4 md:mt-0 p-4 md:p-0 rounded-xl md:rounded-none relative z-10 ${isLightMode ? 'bg-slate-50 md:bg-transparent border md:border-none border-slate-200' : 'bg-black/40 md:bg-transparent border md:border-none border-white/5'}`}>
                    <div className="md:col-span-2 text-left md:text-right">
                      <div className={`text-[9px] font-black uppercase tracking-widest md:hidden mb-1 ${theme.textMuted}`}>Total (CAD)</div>
                      <div className={`text-lg font-black tracking-tighter ${theme.textStrong}`}>${grandTotalWithTax.toFixed(2)}</div>
                    </div>
                    <div className="md:col-span-2 text-right flex flex-col md:items-end justify-center">
                      <div className={`text-[9px] font-black uppercase tracking-widest md:hidden mb-1 ${theme.textMuted}`}>Balance Due</div>
                      <div className={`text-lg font-black tracking-tighter ${balance > 0 ? (isLightMode ? 'text-red-500' : 'text-red-400') : (isLightMode ? 'text-emerald-500' : 'text-emerald-500')}`}>
                        ${balance.toFixed(2)}
                      </div>
                      {isPastDue && (
                          <div className="text-[8px] font-black bg-red-500 text-white px-2 py-0.5 rounded shadow-sm tracking-widest mt-1 animate-pulse">
                              30+ DAYS PAST DUE
                          </div>
                      )}
                    </div>
                  </div>

                  {/* COL 6: ACTIONS & PROGRESS BAR */}
                  <div className="md:col-span-3 flex flex-col justify-center md:items-end w-full mt-4 md:mt-0 relative z-10">
                    <div className="flex flex-nowrap items-center gap-1.5 justify-end w-full">
                      <Link href={`/invoices/${inv.id}`} className={`flex-none px-3 h-8 flex items-center justify-center rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isLightMode ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20'}`} title="View Invoice">
                        View
                      </Link>
                      
                      <button onClick={() => openEditModal(inv)} className={`flex-none w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isLightMode ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`} title="Edit Order">
                         <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      </button>

                      <button onClick={() => sendReviewRequestWA(inv)} className={`flex-none w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isLightMode ? 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200' : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'}`} title="Request Google Review">
                         ⭐
                      </button>

                      {inv.payment_history && inv.payment_history.length > 0 && (
                          <button onClick={() => setHistoryModal(inv)} className={`flex-none w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isLightMode ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`} title="Payment History">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3"></path></svg>
                          </button>
                      )}

                      {inv.amount_paid > 0 && (
                        <button onClick={() => handleDirectReverse(inv)} className={`flex-none px-3 h-8 flex items-center justify-center rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isLightMode ? 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200' : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'}`} title="Undo Payment">
                          Undo
                        </button>
                      )}

                      {balance > 0 && (
                        <button onClick={() => setPaymentModal(inv)} className={`flex-none px-4 h-8 flex items-center justify-center rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm ${isLightMode ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'}`}>
                          Pay
                        </button>
                      )}
                      
                      <button onClick={() => handleDeleteOrder(inv.id, jobId)} className={`flex-none w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isLightMode ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'}`} title="Delete Order">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                    <div className={`w-full mt-2 h-1 rounded-full overflow-hidden border ${isLightMode ? 'bg-slate-200 border-slate-300' : 'bg-black border-white/5'}`}>
                      <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>

                </div>
            );
            })
          )}
        </div>
      </div>

      {/* --- INVOICE VIEW MODAL (SPLIT LAYOUT) --- */}
      {viewModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-0 md:p-8 z-[70]" onClick={() => setViewModal(null)}>
          <div className={`${theme.bgPanel} border-0 md:border ${theme.borderLight} rounded-none md:rounded-[2.5rem] w-full h-full md:h-[90vh] md:max-w-7xl flex flex-col shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden`} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className={`flex justify-between items-center p-6 border-b ${theme.borderLight} shrink-0 ${isLightMode ? 'bg-slate-50' : 'bg-black/40'}`}>
              <div className="flex items-center gap-4">
                  <h2 className={`text-2xl md:text-4xl font-black uppercase tracking-tighter italic leading-none ${theme.textStrong}`}>
                    {viewModal.customers?.company_name || "Unknown Client"}
                  </h2>
                  <div className={`font-black text-[11px] uppercase tracking-widest px-3 py-1 rounded border ${isLightMode ? 'text-sky-600 bg-sky-100 border-sky-200' : 'text-sky-400 bg-sky-500/10 border-sky-500/20'}`}>
                    Invoice #{viewModal.jobs?.[0]?.job_number || viewModal.id.split('-')[0].toUpperCase()}
                  </div>
              </div>
              <button onClick={() => setViewModal(null)} className={`text-xs font-black uppercase px-5 py-3 rounded-lg transition-colors ${isLightMode ? 'text-slate-500 hover:text-slate-900 bg-slate-200 hover:bg-slate-300' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}`}>
                Close ×
              </button>
            </div>

            {/* Modal Content Split */}
            <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                
                {/* Left: Garment Breakdown */}
                <div className={`flex-[1.5] p-6 md:p-8 overflow-y-auto custom-scrollbar border-r ${theme.borderLight} ${theme.bgPanel} relative`}>
                    <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-6 ${theme.textMuted}`}>Order Specifications</h3>
                    
                    <div className={`rounded-[2rem] border p-6 shadow-sm ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                      {viewModal.quote_items?.map((qItem: any) => {
                        const totals = lineItemTotals(qItem);
                        const hasDiscount = totals.discount > 0.01;
                        return (
                          <div key={qItem.id} className={`mb-8 last:mb-0 border-b last:border-0 pb-6 ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>

                            <div className="flex justify-between items-start mb-3 gap-3 flex-wrap">
                              <div className="flex items-center min-w-0">
                                {renderGarmentIcon(qItem.description, isLightMode ? "#0284c7" : "#38bdf8")}
                                 <span className={`text-xl md:text-2xl font-black uppercase tracking-tighter truncate ${theme.textStrong}`}>{qItem.description}</span>
                              </div>
                              <span className={`text-lg font-black px-5 py-2 rounded-xl border shadow-sm shrink-0 ${isLightMode ? 'text-emerald-600 bg-emerald-100 border-emerald-300' : 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50'}`}>
                                {totals.qty || qItem.quantity} PCS
                              </span>
                            </div>

                            {/* PER-LINE PRICING BREAKDOWN */}
                            <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 rounded-xl border ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-white/5'}`}>
                              <div>
                                <div className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${theme.textMuted}`}>Quoted price</div>
                                <div className={`text-sm font-black ${theme.textStrong}`}>${(totals.qty > 0 ? totals.regularTotal / totals.qty : 0).toFixed(2)} <span className={`text-[8px] font-bold ${theme.textMuted}`}>each</span></div>
                              </div>
                              <div>
                                <div className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${hasDiscount ? 'text-emerald-600 dark:text-emerald-400' : theme.textMuted}`}>Invoiced @</div>
                                <div className={`text-sm font-black ${hasDiscount ? 'text-emerald-500' : theme.textStrong}`}>${(totals.qty > 0 ? totals.lineTotal / totals.qty : 0).toFixed(2)} <span className={`text-[8px] font-bold ${theme.textMuted}`}>each</span></div>
                              </div>
                              {hasDiscount && (
                                <div>
                                  <div className={`text-[8px] font-black uppercase tracking-widest mb-0.5 text-amber-600 dark:text-amber-400`}>Discount</div>
                                  <div className="text-sm font-black text-amber-500">-${totals.discount.toFixed(2)} <span className="text-[8px] font-bold opacity-70">({totals.discountPct}%)</span></div>
                                </div>
                              )}
                              <div className={hasDiscount ? '' : 'col-span-2 md:col-span-2'}>
                                <div className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${theme.textMuted}`}>Line total</div>
                                <div className={`text-sm font-black ${theme.textStrong}`}>${totals.lineTotal.toFixed(2)} <span className={`text-[8px] font-bold ${theme.textMuted}`}>(pre-tax)</span></div>
                              </div>
                            </div>

                            <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                              <div className="min-w-[500px]">
                                {(!qItem.quote_item_variants || qItem.quote_item_variants.length === 0) ? (
                                   <div className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted} p-4 text-center border rounded-xl border-dashed ${isLightMode ? 'border-slate-300' : 'border-slate-700'}`}>
                                     Print Media / General Item — No Size Breakdown Required
                                   </div>
                                ) : (
                                  <>
                                    <div className={`grid grid-cols-8 gap-2 text-[10px] font-black uppercase text-center mb-2 tracking-widest ${theme.textMuted}`}>
                                      <div className="col-span-2 text-left pl-3">Color Info</div><div>S</div><div>M</div><div>L</div><div>XL</div><div>2XL</div><div>3XL</div>
                                    </div>
                                    {qItem.quote_item_variants.map((v: any) => {
                                      const hex = getColorHex(v.color);
                                      return (
                                      <div key={v.id} className={`grid grid-cols-8 gap-2 text-sm font-black text-center rounded-xl p-3 mb-2 border items-center shadow-sm dark:shadow-none ${isLightMode ? 'bg-white border-slate-200' : 'bg-black/60 border-white/5'}`}>
                                        <div className={`col-span-2 text-left uppercase truncate pl-2 flex items-center gap-2 ${theme.textStrong}`}>
                                            <div className={`w-4 h-4 rounded-full border shrink-0 ${isLightMode ? 'border-slate-300' : 'border-slate-700'}`} style={{backgroundColor: hex}}></div>
                                            {v.color}
                                         </div>
                                        {["s", "m", "l", "xl", "xxl", "xxxl"].map(size => (
                                            <div key={size} className={v[size] > 0 ? (isLightMode ? "text-red-600 font-black text-xl drop-shadow-sm" : "text-red-500 font-black text-xl drop-shadow-sm") : (isLightMode ? "text-slate-300 font-bold" : "text-slate-800 font-bold")}>
                                                {v[size] || '-'}
                                            </div>
                                        ))}
                                      </div>
                                    )})}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </div>

                {/* Right: Financial Ledger */}
                <div className={`flex-1 shrink-0 flex flex-col h-full overflow-y-auto custom-scrollbar ${isLightMode ? 'bg-slate-50' : 'bg-[#0f1115]'}`}>
                    
                    {/* Financial Summary */}
                    <div className={`p-6 border-b shadow-sm ${theme.borderLight} ${isLightMode ? 'bg-white' : 'bg-transparent'}`}>
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${theme.textMuted}`}>Financial Ledger</h3>

                        {/* QUOTED-vs-INVOICED summary (only if discount given) */}
                        {(() => {
                          const totalRegular = (viewModal.quote_items || []).reduce((sum: number, q: any) => sum + lineItemTotals(q).regularTotal, 0);
                          const totalInvoiced = viewModal.total_amount || 0;
                          const totalDiscount = totalRegular - totalInvoiced;
                          if (totalDiscount < 0.5) return null;
                          const pct = totalRegular > 0 ? Math.round((totalDiscount / totalRegular) * 100) : 0;
                          return (
                            <div className={`mb-4 p-3 rounded-xl border ${isLightMode ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/30'}`}>
                              <div className="text-[8px] font-black uppercase tracking-widest mb-1 text-amber-600 dark:text-amber-400">Discount Given</div>
                              <div className="flex items-end justify-between">
                                <div className={`text-xs font-bold ${theme.textMuted}`}>
                                  Quoted at <span className={`line-through ${theme.textStrong}`}>${totalRegular.toFixed(2)}</span> · Invoiced at <span className={`font-black ${theme.textStrong}`}>${totalInvoiced.toFixed(2)}</span>
                                </div>
                                <div className="text-xl font-black text-amber-500">-{pct}%</div>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center">
                                <span className={`text-xs font-bold uppercase tracking-widest ${theme.textMuted}`}>Subtotal</span>
                                <span className={`text-lg font-black ${theme.textStrong}`}>${(viewModal.total_amount || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className={`text-xs font-bold uppercase tracking-widest ${theme.textMuted}`}>HST (13%)</span>
                                <span className={`text-lg font-black ${theme.textStrong}`}>${((viewModal.total_amount || 0) * 0.13).toFixed(2)}</span>
                            </div>
                            <div className={`flex justify-between items-center pt-3 border-t ${theme.borderLight}`}>
                                <span className={`text-xs font-black uppercase tracking-widest ${theme.textStrong}`}>Total (CAD)</span>
                                <span className={`text-2xl font-black ${theme.textStrong}`}>${((viewModal.total_amount || 0) * 1.13).toFixed(2)}</span>
                            </div>
                            <div className={`flex justify-between items-center pt-3 border-t ${theme.borderLight}`}>
                                <span className={`text-xs font-black uppercase tracking-widest ${isLightMode ? 'text-emerald-600' : 'text-emerald-500'}`}>Amount Paid</span>
                                <span className={`text-2xl font-black ${isLightMode ? 'text-emerald-600' : 'text-emerald-500'}`}>${(viewModal.amount_paid || 0).toFixed(2)}</span>
                            </div>
                            
                            {((viewModal.total_amount || 0) * 1.13) - (viewModal.amount_paid || 0) > 0.01 && (
                            <div className={`flex justify-between items-center pt-3 border-t ${theme.borderLight} mt-2`}>
                                <span className={`text-xs font-black uppercase tracking-widest ${isLightMode ? 'text-red-600' : 'text-red-500'}`}>Balance Due</span>
                                <span className={`text-3xl font-black tracking-tighter ${isLightMode ? 'text-red-600' : 'text-red-500'}`}>${(((viewModal.total_amount || 0) * 1.13) - (viewModal.amount_paid || 0)).toFixed(2)}</span>
                            </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <button onClick={() => { setViewModal(null); openEditModal(viewModal); }} className={`py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${isLightMode ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}>
                                Edit Order
                            </button>
                            <button onClick={() => { setViewModal(null); setPaymentModal(viewModal); }} className={`py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${isLightMode ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'}`}>
                                Log Payment
                            </button>
                            <Link href={`/invoices/${viewModal.id}`} className={`col-span-2 py-3 flex items-center justify-center rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${isLightMode ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20'}`}>
                                Open Full Invoice
                            </Link>
                        </div>
                    </div>

                    {/* Payment History timeline */}
                    <div className="p-6">
                        <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${theme.textMuted}`}>Payment Timeline</h3>
                        {(!viewModal.payment_history || viewModal.payment_history.length === 0) ? (
                            <div className={`text-center py-8 rounded-xl border border-dashed ${isLightMode ? 'border-slate-300 text-slate-400' : 'border-slate-800 text-slate-600'}`}>
                                <span className="text-[10px] font-black uppercase tracking-widest">No Payments Logged</span>
                            </div>
                        ) : (
                            <div className="space-y-4 pb-6">
                               {viewModal.payment_history.map((log: any, i: number) => (
                                <div key={i} className={`relative pl-6 border-l ${isLightMode ? 'border-emerald-200' : 'border-emerald-900/50'}`}>
                                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                    <div className={`text-sm font-black leading-none mb-1.5 uppercase tracking-tighter ${isLightMode ? 'text-emerald-600' : 'text-emerald-400'}`}>+ ${parseFloat(log.amount).toFixed(2)}</div>
                                    <div className={`text-[9px] font-bold uppercase tracking-widest ${theme.textMuted}`}>{new Date(log.date).toLocaleString([], {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit'})}</div>
                                </div>
                               ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT ORDER MODAL (WITH MATRIX AND GENERAL SUPPORT) --- */}
      {editModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-[70] animate-in fade-in duration-200">
          <div className={`${theme.bgPanel} border ${theme.border} rounded-[2rem] w-full max-w-6xl p-6 md:p-8 shadow-2xl relative flex flex-col max-h-[90vh]`}>
            <div className="flex justify-between items-start border-b border-inherit pb-4 mb-4 shrink-0">
                <div>
                    <h2 className={`text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none ${theme.textStrong}`}>Edit Order & Invoice</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${theme.textMuted}`}>Job #{editModal.jobs?.[0]?.job_number || "N/A"} • {editModal.customers?.company_name}</p>
                </div>
                <button onClick={() => setEditModal(null)} className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'}`}>Close</button>
            </div>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-6">
                
                {/* --- ORDER NAME / TITLE BLOCK --- */}
                <div className={`p-5 rounded-2xl border shadow-sm ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                    <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${theme.textMuted}`}>Base Project Name (Universal)</label>
                    <input 
                        type="text"
                        placeholder="e.g. XYZ CONSTRUCTION"
                        value={editModal.editedTitle || ""}
                        onChange={(e) => setEditModal({...editModal, editedTitle: e.target.value})}
                        className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-sky-500 ${theme.inputStandard}`}
                    />
                </div>

                {/* NOTES SECTION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${theme.textMuted}`}>Public Invoice Notes</label>
                        <textarea 
                            rows={3} 
                            value={editModal.editedNotes} 
                            onChange={(e) => setEditModal({...editModal, editedNotes: e.target.value})}
                            placeholder="Notes visible to client on the invoice..."
                            className={`w-full rounded-xl px-4 py-3 text-sm focus:border-sky-500 outline-none transition-colors shadow-inner border custom-scrollbar ${theme.inputStandard}`} 
                        />
                    </div>
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${theme.textMuted}`}>Internal Shop Notes</label>
                        <textarea 
                            rows={3} 
                            value={editModal.editedInternalNotes} 
                            onChange={(e) => setEditModal({...editModal, editedInternalNotes: e.target.value})}
                            placeholder="Private notes for production team..."
                            className={`w-full rounded-xl px-4 py-3 text-sm focus:border-sky-500 outline-none transition-colors shadow-inner border custom-scrollbar ${theme.inputStandard}`} 
                        />
                    </div>
                </div>

                {/* LINE ITEMS SECTION (USING MATRIX AND GENERAL LAYOUT) */}
                <div>
                    <div className="flex justify-between items-end mb-3 border-b border-inherit pb-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest ${theme.textStrong}`}>Product Line Items</label>
                        <div className="flex gap-2">
                          <button onClick={() => handleAddItemRow("apparel")} className="text-[9px] font-black uppercase tracking-widest bg-sky-500/10 text-sky-500 border border-sky-500/30 px-3 py-1.5 rounded-lg hover:bg-sky-500 hover:text-white transition-colors shadow-sm">
                              + Add Apparel
                          </button>
                          <button onClick={() => handleAddItemRow("general")} className="text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-500 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-500 hover:text-white transition-colors shadow-sm">
                              + Add General Item
                          </button>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        {editModal.editedItems.map((item: any, iIdx: number) => (
                            <div key={item.id} className={`flex flex-col gap-4 p-5 rounded-[1.5rem] border shadow-sm ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-slate-800'}`}>
                                
                                <div className="flex justify-between items-start w-full gap-4">
                                    <div className="flex-1 relative">
                                        <label className={`text-[9px] font-black uppercase tracking-widest mb-1.5 block ${theme.textMuted}`}>Product Description / Catalog Search</label>
                                        <input 
                                            type="text" 
                                            value={item.description !== undefined ? item.description : item.searchQuery} 
                                            onFocus={() => handleEditItemChange(iIdx, "showDropdown", true)}
                                            onChange={(e) => {
                                                handleEditItemChange(iIdx, 'description', e.target.value);
                                                handleEditItemChange(iIdx, 'showDropdown', true);
                                            }}
                                            placeholder="e.g. Gildan 5000 T-Shirt"
                                            className={`w-full rounded-lg px-4 py-3 text-sm font-bold outline-none border focus:border-sky-500 shadow-inner ${theme.inputStandard}`} 
                                        />
                                        {item.showDropdown && (item.description || "").length > 0 && (
                                            <div className={`absolute z-50 top-full left-0 w-full mt-2 border rounded-xl max-h-60 overflow-y-auto shadow-2xl backdrop-blur-xl custom-scrollbar ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                                                {catalog.filter(p => p.name.toLowerCase().includes((item.description || "").toLowerCase())).map(p => (
                                                <button key={p.id} type="button" onClick={() => selectProduct(iIdx, p)} className={`w-full text-left p-4 border-b last:border-0 transition-colors group ${isLightMode ? 'border-slate-100 hover:bg-blue-50' : 'border-white/5 hover:bg-blue-600'}`}>
                                                    <div className={`text-xs font-black uppercase tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{p.name}</div>
                                                    <div className={`text-[9px] mt-1 uppercase font-bold ${isLightMode ? 'text-slate-500 group-hover:text-blue-600' : 'text-slate-400 group-hover:text-white'}`}>Default Price: ${p.default_price} | {p.category}</div>
                                                </button>
                                                ))}
                                                <button type="button" onClick={() => handleEditItemChange(iIdx, "showDropdown", false)} className={`w-full text-center p-3 text-[10px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-100 text-slate-500 hover:text-slate-900' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>
                                                    Close Suggestions
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => handleRemoveItemRow(iIdx)} className="p-3 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-colors shrink-0 mt-5" title="Remove Product">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>

                                <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                                  
                                  {item.type === "general" ? (
                                    <div className={`flex flex-col md:grid md:grid-cols-5 gap-4 p-4 rounded-xl border transition-all mt-4 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                                      <div>
                                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Quantity</label>
                                        <input type="number" value={item.quantity} onChange={(e) => handleEditItemChange(iIdx, "quantity", parseInt(e.target.value) || 0)} className={`w-full rounded-md p-3 text-xs font-black outline-none border shadow-sm ${theme.inputStandard}`} placeholder="Qty" />
                                      </div>
                                      <div>
                                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Print Sides</label>
                                        <select value={item.sides || "Single Sided"} onChange={(e) => handleEditItemChange(iIdx, "sides", e.target.value)} className={`w-full rounded-md p-3 text-xs font-black outline-none border shadow-sm ${theme.inputStandard}`}>
                                          <option value="Single Sided">Single Sided</option>
                                          <option value="Double Sided">Double Sided</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Regular Total Price</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-3 text-[10px] font-black text-slate-400">$</span>
                                          <input type="number" step="0.01" value={item.regular_total} onChange={(e) => handleEditItemChange(iIdx, "regular_total", parseFloat(e.target.value) || 0)} className={`w-full border rounded-md p-3 pl-6 text-xs font-black line-through text-slate-400 outline-none shadow-sm ${theme.inputStandard}`} placeholder="Reg Total" />
                                        </div>
                                      </div>
                                      <div>
                                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Special Total Price</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-3 text-[10px] font-black text-emerald-500/50">$</span>
                                          <input type="number" step="0.01" value={item.unit_total} onChange={(e) => handleEditItemChange(iIdx, "unit_total", parseFloat(e.target.value) || 0)} className={`w-full border border-emerald-500/30 rounded-md p-3 pl-6 text-xs font-black text-emerald-500 outline-none focus:border-emerald-500 transition shadow-sm ${isLightMode ? 'bg-emerald-50' : 'bg-slate-900'}`} placeholder="Special Total" />
                                        </div>
                                      </div>
                                      <div className="flex flex-col justify-center items-end pr-2">
                                        <div className={`text-[8px] font-black uppercase tracking-widest ${theme.textMuted}`}>Unit Price</div>
                                        <div className="text-sm font-black text-sky-500">
                                          ${item.quantity > 0 ? (item.unit_total / item.quantity).toFixed(2) : "0.00"} <span className="text-[10px]">/ ea</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="hidden md:grid grid-cols-12 gap-2 text-[8px] font-black uppercase tracking-widest px-2 min-w-[950px] text-slate-500">
                                        <div className="col-span-2 text-left">Color</div>
                                        <div>XS</div><div>S</div><div>M</div><div>L</div><div>XL</div><div>2XL</div><div>3XL</div>
                                        <div className="col-span-1 text-center">Reg Price</div>
                                        <div className="col-span-1 text-right">Unit Price</div>
                                        <div className="col-span-1 text-center">Delete</div>
                                      </div>

                                      {item.variants.map((v: any, vIdx: number) => {
                                        const swatchHex = getColorHex(v.color);
                                        
                                        return (
                                        <div key={v.id || vIdx} className={`flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-2 md:items-center p-4 md:p-2 rounded-xl border md:border-none shadow-sm md:shadow-none min-w-0 md:min-w-[950px] mb-2 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
                                          
                                          <div className="md:col-span-2 w-full flex items-center gap-2">
                                            <div className="text-[8px] font-black uppercase mb-1 md:hidden pl-1 text-slate-500">Color</div>
                                            <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0 shadow-sm" style={{backgroundColor: swatchHex}}></div>
                                            <input 
                                              list={`colors-${iIdx}-${vIdx}`} 
                                              value={v.color} 
                                              onChange={(e) => handleEditVariantChange(iIdx, vIdx, "color", e.target.value)} 
                                              className={`w-full rounded-lg p-2 md:p-0 text-xs font-black uppercase outline-none border md:border-none focus:border-sky-500 ${isLightMode ? 'bg-slate-50 md:bg-transparent border-slate-300 text-slate-900' : 'bg-black md:bg-transparent border-slate-700 text-white'}`} 
                                              placeholder="Color"
                                            />
                                            <datalist id={`colors-${iIdx}-${vIdx}`}>{GILDAN_COLORS.map(c => <option key={c} value={c} />)}</datalist>
                                          </div>

                                          <div className="grid grid-cols-3 md:contents gap-2 w-full">
                                            {SIZES.slice(0, 7).map(size => (
                                              <div key={size} className="relative">
                                                <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-1 text-[7px] font-black uppercase md:hidden z-10 border rounded ${isLightMode ? 'bg-white text-slate-500 border-slate-200' : 'bg-black text-slate-500 border-slate-800'}`}>{size}</div>
                                                <input 
                                                  type="number" 
                                                  value={v[size]} 
                                                  onChange={(e) => handleEditVariantChange(iIdx, vIdx, size, parseInt(e.target.value) || 0)} 
                                                  className={`w-full rounded-lg p-2 text-center text-xs font-black outline-none transition shadow-inner border focus:border-sky-500 ${theme.inputStandard}`} 
                                                />
                                              </div>
                                            ))}
                                          </div>

                                          <div className="md:col-span-1 w-full">
                                            <div className="text-[8px] font-black uppercase mb-1 md:hidden pl-1 text-slate-500">Reg Price</div>
                                            <div className="relative">
                                              <span className="absolute left-2 top-2 text-[9px] font-black text-slate-400">$</span>
                                              <input 
                                                type="number" step="0.01" value={v.regular_price} 
                                                onChange={(e) => handleEditVariantChange(iIdx, vIdx, "regular_price", parseFloat(e.target.value) || 0)} 
                                                className={`w-full rounded-lg p-2 pl-5 text-center text-xs font-black line-through outline-none shadow-inner border ${theme.inputStandard}`} 
                                              />
                                            </div>
                                          </div>

                                          <div className="md:col-span-1 w-full">
                                            <div className="text-[8px] font-black uppercase mb-1 md:hidden pl-1 text-slate-500">Unit Price</div>
                                            <div className="relative">
                                              <span className="absolute left-2 top-2 text-[9px] font-black text-emerald-500/50">$</span>
                                              <input 
                                                type="number" step="0.01" value={v.unit_price} 
                                                onChange={(e) => handleEditVariantChange(iIdx, vIdx, "unit_price", parseFloat(e.target.value) || 0)} 
                                                className={`w-full rounded-lg p-2 pl-5 text-center text-xs font-black outline-none focus:border-emerald-500 transition shadow-inner border ${isLightMode ? 'bg-emerald-50/50 border-emerald-300 text-emerald-700' : 'bg-black border-emerald-500/30 text-emerald-400'}`} 
                                              />
                                            </div>
                                          </div>
                                          
                                          <div className="md:col-span-1 w-full flex justify-end md:justify-center items-center">
                                              <button onClick={() => handleRemoveVariantRow(iIdx, vIdx)} className={`p-2 rounded border transition-colors ${isLightMode ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border-red-200' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20'}`} title="Delete Color Variant">
                                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                              </button>
                                          </div>

                                          <div className={`flex justify-between items-center md:hidden mt-2 pt-3 border-t ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Row Total</span>
                                            <div className="font-black text-lg tracking-tighter">
                                              ${calculateVariantTotalValue(v).toFixed(2)}
                                            </div>
                                          </div>
                                        </div>
                                      )})}
                                    </>
                                  )}
                                </div>
                                
                                <div className={`flex flex-col sm:flex-row justify-between items-center mt-2 border-t pt-4 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                                  {item.type === "apparel" ? (
                                    <button type="button" onClick={() => addColorVariant(iIdx)} className={`w-full sm:w-auto px-5 py-3 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${isLightMode ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'}`}>
                                      + Add Color
                                    </button>
                                  ) : (
                                    <div></div>
                                  )}
                                  <div className={`mt-3 sm:mt-0 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-white/5'}`}>
                                    <span className="text-slate-500">Item Total:</span> <span className={`text-lg ml-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>${calculateItemTotalValue(item).toFixed(2)}</span>
                                  </div>
                                </div>

                            </div>
                        ))}
                    </div>
                </div>

            </div>

            <div className="border-t border-inherit pt-4 mt-4 shrink-0 flex gap-4">
                <button onClick={() => setEditModal(null)} className={`flex-1 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'border-slate-200 hover:bg-slate-100 text-slate-800' : 'border-slate-800 hover:bg-slate-800 text-white'}`}>
                    Discard Changes
                </button>
                <button onClick={handleSaveOrderEdits} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                    Save Order Updates
                </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG PAYMENT MODAL */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-50 animate-in fade-in duration-200" onClick={() => setPaymentModal(null)}>
          <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'} border rounded-[2rem] md:rounded-[3rem] w-full max-w-lg p-6 md:p-10 shadow-2xl relative`} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPaymentModal(null)} className={`absolute top-6 right-6 md:right-8 text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-full ${isLightMode ? 'text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200' : 'text-slate-500 hover:text-white bg-black/40'}`}>Close ×</button>
            <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tighter italic mb-2 mt-4 md:mt-0 ${theme.textStrong}`}>Record Payment</h2>
            
            <form onSubmit={handleLogPayment} className="space-y-6 mt-6 md:mt-8">
              <div>
                <label className={`block text-[10px] font-black uppercase mb-3 tracking-widest pl-1 ${theme.textMuted}`}>Payment Received (CAD)</label>
                <div className="relative">
                  <span className={`absolute left-4 md:left-6 top-4 md:top-5 text-lg md:text-xl font-black ${isLightMode ? 'text-emerald-500' : 'text-emerald-500/50'}`}>$</span>
                  <input type="number" step="0.01" max={(paymentModal.total_amount * 1.13) - paymentModal.amount_paid} required autoFocus value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className={`w-full p-4 md:p-5 pl-10 md:pl-12 rounded-2xl text-xl md:text-2xl font-black outline-none focus:border-emerald-500 transition shadow-inner border ${theme.inputBg}`} />
                </div>
                <div className="flex justify-between mt-3 px-1 gap-2">
                  <button type="button" onClick={() => setPaymentAmount(((paymentModal.total_amount * 1.13) - paymentModal.amount_paid) / 2)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200' : 'bg-white/5 text-blue-500 hover:bg-blue-500/10'}`}>50% Deposit</button>
                  <button type="button" onClick={() => setPaymentAmount((paymentModal.total_amount * 1.13) - paymentModal.amount_paid)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200' : 'bg-white/5 text-emerald-500 hover:bg-emerald-500/10'}`}>Pay in Full</button>
                </div>
              </div>
              <button type="submit" className="w-full py-4 md:py-5 bg-emerald-600 text-white text-[10px] md:text-xs font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-emerald-500 active:scale-95 transition-all shadow-lg">Log Payment to Ledger</button>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT HISTORY MODAL */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-[60] animate-in fade-in duration-200" onClick={() => setHistoryModal(null)}>
          <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'} border rounded-[2rem] w-full max-w-md p-6 md:p-8 shadow-2xl relative flex flex-col max-h-[80vh]`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-inherit pb-4 mb-4 shrink-0">
                <div>
                    <h2 className={`text-xl font-black uppercase tracking-tighter italic leading-none ${theme.textStrong}`}>Payment History</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${theme.textMuted}`}>Job #{historyModal.jobs?.[0]?.job_number || "N/A"}</p>
                </div>
                <button onClick={() => setHistoryModal(null)} className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'}`}>Close</button>
            </div>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {historyModal.payment_history?.map((payment: any, index: number) => (
                    <div key={payment.id} className={`flex justify-between items-center p-4 rounded-xl border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-slate-800'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center font-black text-xs shrink-0">
                                {index + 1}
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>Deposit Logged</span>
                                <span className={`text-xs font-bold ${theme.textStrong}`}>
                                    {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(payment.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-lg font-black text-emerald-500">${parseFloat(payment.amount).toFixed(2)}</span>
                            <button 
                                onClick={() => handleReversePayment(payment.id, parseFloat(payment.amount))}
                                className={`p-2 rounded-lg border transition-colors ${isLightMode ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border-red-200' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20'}`}
                                title="Reverse Payment"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t border-inherit pt-4 mt-4 shrink-0 flex justify-between items-center">
                <span className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>Total Paid</span>
                <span className="text-2xl font-black text-emerald-500">${(historyModal.amount_paid || 0).toFixed(2)}</span>
            </div>
        </div>
        </div>
      )}

      {/* ============ CONFIRM DIALOG ============ */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmDialog(null)}>
          <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl max-w-md w-full p-6 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
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