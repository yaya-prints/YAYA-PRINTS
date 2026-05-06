"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { parseYayaMeta } from "@/lib/yaya-meta";
import Link from "next/link";
import { useRouter } from "next/navigation";

// --- GILDAN DATA FOR MODAL ---
const GILDAN_COLORS = ["White", "Black", "Navy", "Sport Grey", "Red", "Royal", "Dark Heather", "Charcoal", "Forest Green", "Gold", "Maroon", "Safety Pink", "Safety Orange"];
const SIZES = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl"];

// SYNCED WITH CRM AND SHOP FLOOR
const DB_STAGE_MAP: Record<string, string> = {
  "Incoming": "Incoming",
  "Artwork": "Artwork in Approval",
  "Sourcing": "To Buy",
  "Printing": "To Print",
  "Pressing": "To Press",
  "Dispatch": "To Deliver / Pick Up",
  "Billing": "To Invoice",
  "Paid": "Paid"
};

// --- DYNAMIC COLOR HEX GENERATOR ---
const getColorHex = (colorName: string): string => {
  if (!colorName) return "#cccccc"; 
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
  return "#cccccc"; 
};

export default function QuotesList() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- THEME STATE ---
  const [isLightMode, setIsLightMode] = useState<boolean>(false);

  // --- EDIT MODAL STATE ---
  const [editModal, setEditModal] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  // --- SMART CUSTOMER SEARCH FOR EDIT MODAL ---
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // --- WMS ASSIGNMENT STATE ---
  const [assignmentModal, setAssignmentModal] = useState<any>(null);
  const [warehouseLocations, setWarehouseLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  // --- LIST UX STATE (search / filter / realtime sync) ---
  const [listSearch, setListSearch] = useState("");
  const [listFilter, setListFilter] = useState<"all" | "draft" | "sent" | "approved" | "production" | "done">("all");
  const [syncStatus, setSyncStatus] = useState<"live" | "polling" | "connecting">("connecting");
  const [lastSyncAt, setLastSyncAt] = useState<number>(Date.now());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null); // overflow menu

  // --- In-page confirm dialog (replaces window.confirm) ---
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel: string; danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // --- Lightweight toast instead of alert() ---
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const showToast = (type: "success" | "error" | "info", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    loadQuotes();
    loadCatalog();
    loadWarehouseLocations();
    loadCustomers();

    // REALTIME SYNC — quotes approved/edited on other devices appear instantly
    const channel = supabase
      .channel('quotes-list-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        loadQuotes();
        setLastSyncAt(Date.now());
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        loadQuotes();
        setLastSyncAt(Date.now());
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSyncStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSyncStatus('polling');
      });

    // FALLBACK: poll every 30s in case realtime drops
    const poll = setInterval(() => { loadQuotes(); setLastSyncAt(Date.now()); }, 30000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    if (savedTheme === 'light') setIsLightMode(true);
  }, []);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const onClick = () => setOpenMenuId(null);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [openMenuId]);

  // --- ESCAPE KEY LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
         if (confirmDialog) { setConfirmDialog(null); return; }
         if (openMenuId) { setOpenMenuId(null); return; }
         if (assignmentModal) {
            setAssignmentModal(null);
            return;
         }
         if (editModal) {
             if (hasChanges) {
                const confirmDiscard = window.confirm("⚠️ You have unsaved changes. Are you sure you want to discard them?");
                if (confirmDiscard) {
                    setEditModal(null);
                    setHasChanges(false);
                }
             } else {
                setEditModal(null);
             }
         }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editModal, hasChanges, assignmentModal, confirmDialog, openMenuId]);

  async function loadCustomers() {
    const { data } = await supabase.from("customers").select("id, company_name").order("company_name");
    if (data) setCustomers(data);
  }

  async function loadCatalog() {
    const { data: cat } = await supabase.from("catalog_items").select("*").order('name');
    if (cat) setCatalog(cat);
  }

  async function loadWarehouseLocations() {
    const { data } = await supabase.from("warehouse_locations").select("*").order("name");
    if (data) setWarehouseLocations(data);
  }

  async function loadQuotes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotes")
      .select(`
        *,
        customers (company_name),
        quote_items (id, description, quantity, unit_price, regular_price, quote_item_variants (id, color, xs, s, m, l, xl, xxl, xxxl, xxxxl, xxxxxl, regular_price, unit_price)),
        jobs (id, job_number, title, stage)
      `)
      .order("created_at", { ascending: false });

    if (data) setQuotes(data);
    if (error) console.error("Error loading quotes:", error);
    setLoading(false);
  }

  async function handleApprove(quote: any) {
    setConfirmDialog({
      title: "Start production?",
      message: `Approve quote for ${quote.customers?.company_name || "this client"} and create a Job Card on the shop floor? This locks the quote.`,
      confirmLabel: "Approve & Start",
      danger: false,
      onConfirm: () => doApprove(quote),
    });
  }

  async function doApprove(quote: any) {
    try {
      await supabase.from("quotes").update({ status: "Approved" }).eq("id", quote.id);
      const jobNum = Math.floor(1000 + Math.random() * 9000);

      let smartTitle = "Custom Apparel Order";
      if (quote.title) {
        smartTitle = `${quote.title} — ${formatItemSummary(quote.quote_items)}`;
      } else if (quote.quote_items && quote.quote_items.length > 0) {
        if (quote.quote_items.length === 1) {
          smartTitle = `${quote.quote_items[0].quantity}x ${quote.quote_items[0].description}`;
        } else {
          const totalUnits = quote.quote_items.reduce((sum: number, i: any) => sum + i.quantity, 0);
          smartTitle = `${totalUnits}x MULTI-ITEM ORDER`;
        }
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const { data: newJob, error: jobError } = await supabase.from("jobs").insert([{
        quote_id: quote.id,
        job_number: jobNum,
        title: smartTitle,
        stage: "Incoming",
        due_date: dueDate.toISOString().split('T')[0]
      }]).select().single();

      if (jobError) throw jobError;

      if (newJob) {
        await supabase.from("job_logs").insert([{
          job_id: newJob.id,
          from_stage: "Quote Draft",
          to_stage: "Incoming"
        }]);
      }
      showToast("success", `✓ Approved — Job #${jobNum} created on shop floor`);
      loadQuotes();
    } catch (err: any) {
      showToast("error", "Error approving quote: " + err.message);
    }
  }

  function handleDeleteQuote(quote: any) {
    setConfirmDialog({
      title: "Delete this quote?",
      message: `Permanently delete quote #${quote.id.split('-')[0].toUpperCase()} for ${quote.customers?.company_name || "Unknown"}? All line items, variants, and linked jobs will be removed. This cannot be undone.`,
      confirmLabel: "Delete Forever",
      danger: true,
      onConfirm: () => doDeleteQuote(quote.id),
    });
  }

  async function doDeleteQuote(quoteId: string) {
    try {
      const { data: items } = await supabase.from("quote_items").select("id").eq("quote_id", quoteId);
      if (items && items.length > 0) {
        const itemIds = items.map(i => i.id);
        await supabase.from("quote_item_variants").delete().in("quote_item_id", itemIds);
        await supabase.from("quote_items").delete().eq("quote_id", quoteId);
      }
      await supabase.from("quotes").delete().eq("id", quoteId);
      await supabase.from("jobs").delete().eq("quote_id", quoteId);
      showToast("success", "Quote deleted");
      loadQuotes();
    } catch (error) {
      showToast("error", "Database Error: Could not delete quote.");
    }
  }

  // --- NEW FEATURE: Duplicate a quote (saves tons of retyping on repeat orders) ---
  async function handleDuplicateQuote(quote: any) {
    try {
      // 1. Duplicate the quote header
      const { data: newQuote, error: qErr } = await supabase.from("quotes").insert([{
        customer_id: quote.customer_id,
        title: quote.title ? `${quote.title} (Copy)` : null,
        total_amount: quote.total_amount,
        notes: quote.notes,
        internal_notes: quote.internal_notes,
        status: "Draft"
      }]).select().single();
      if (qErr) throw qErr;

      // 2. Duplicate each line item + its variants
      for (const item of (quote.quote_items || [])) {
        const { data: newItem, error: iErr } = await supabase.from("quote_items").insert([{
          quote_id: newQuote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          regular_price: item.regular_price ?? item.unit_price ?? 0
        }]).select().single();
        if (iErr) throw iErr;

        for (const v of (item.quote_item_variants || [])) {
          // Strip id so supabase assigns a new one
          const { id: _vid, quote_item_id: _qiid, ...clean } = v;
          await supabase.from("quote_item_variants").insert([{
            ...clean,
            quote_item_id: newItem.id
          }]);
        }
      }

      showToast("success", "✓ Quote duplicated as Draft");
      loadQuotes();
    } catch (err: any) {
      showToast("error", "Could not duplicate: " + err.message);
    }
  }

  // --- NEW FEATURE: Mark as Sent (track when you've sent a quote to the client) ---
  async function handleMarkSent(quote: any) {
    try {
      await supabase.from("quotes").update({ status: "Sent" }).eq("id", quote.id);
      showToast("success", "Marked as Sent to client");
      loadQuotes();
    } catch (err: any) {
      showToast("error", "Could not update status");
    }
  }

  // --- NEW FEATURE: Copy shareable PO link to clipboard ---
  async function handleCopyLink(quote: any) {
    const url = `${window.location.origin}/quotes/${quote.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("success", "Link copied — paste into email/text");
    } catch {
      showToast("error", "Could not copy link");
    }
  }

  // --- WMS LOGIC: ASSIGN ORDER TO SHELF ---
  async function handleAssignToLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!assignmentModal || !selectedLocationId) return;

    try {
      // Calculate total items in this order
      const totalUnits = assignmentModal.quote_items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0;
      
      // Insert into warehouse_inventory
      const { error: invError } = await supabase.from("warehouse_inventory").insert([{
        location_id: selectedLocationId,
        job_id: assignmentModal.jobs?.[0]?.id || null,
        item_type: "Finished Order",
        description: `Order #${assignmentModal.id.split('-')[0].toUpperCase()} - ${assignmentModal.customers?.company_name}`,
        quantity: totalUnits
      }]);

      if (invError) throw invError;

      // Update Job Stage to "Packaged & Shelved"
      if (assignmentModal.jobs?.[0]?.id) {
        await supabase.from("jobs").update({ stage: "Packaged & Shelved" }).eq("id", assignmentModal.jobs[0].id);
      }

      showToast("success", "Order assigned to shelf");
      setAssignmentModal(null);
      loadQuotes();
    } catch (err: any) {
      showToast("error", "Error assigning location: " + err.message);
    }
  }

  // --- EDIT MODAL LOGIC ---
  const openEditModal = (quote: any) => {
    const mappedItems = (quote.quote_items || []).map((item: any) => {
      const hasVariants = item.quote_item_variants && item.quote_item_variants.length > 0;
      return {
        ...item,
        type: hasVariants ? "apparel" : "general",
        searchQuery: item.description, // Initial setup
        showDropdown: false,
        regular_total: hasVariants ? 0 : (item.quantity * (item.unit_price || 0)),
        unit_total: hasVariants ? 0 : (item.quantity * (item.unit_price || 0)),
        variants: hasVariants 
                  ? JSON.parse(JSON.stringify(item.quote_item_variants))
                  : [] 
      };
    });

    if (mappedItems.length === 0) {
      mappedItems.push({ 
        id: `new_${Date.now()}`, description: "", type: "apparel", searchQuery: "", showDropdown: false,
        variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] 
      });
    }

    setEditModal({
      ...quote,
      editedItems: mappedItems,
      editedNotes: quote.notes || "",
      editedInternalNotes: quote.internal_notes || "",
      reassignCustomerId: quote.customer_id,
      editedTitle: quote.title || ""
    });
    setCustomerSearch(quote.customers?.company_name || "");
    setHasChanges(false);
  };

  const handleEditItemChange = (itemIdx: number, field: string, value: any) => {
    const newItems = [...editModal.editedItems];
    newItems[itemIdx][field] = value;
    setEditModal({ ...editModal, editedItems: newItems });
    setHasChanges(true);
  };

  const handleEditVariantChange = (itemIdx: number, varIdx: number, field: string, value: any) => {
    const newItems = [...editModal.editedItems];
    newItems[itemIdx].variants[varIdx][field] = value;
    setEditModal({ ...editModal, editedItems: newItems });
    setHasChanges(true);
  };

  const handleAddItemRow = (type: "apparel" | "general" = "apparel") => {
    if (type === "general") {
      setEditModal({
        ...editModal,
        editedItems: [...editModal.editedItems, { 
          id: `new_${Date.now()}`, description: "", type: "general", searchQuery: "", showDropdown: false, 
          quantity: 1, regular_total: 0, unit_total: 0, variants: [] 
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
    setHasChanges(true);
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
    setHasChanges(true);
  };

  const handleRemoveItemRow = (index: number) => {
    const newItems = [...editModal.editedItems];
    newItems.splice(index, 1);
    setEditModal({ ...editModal, editedItems: newItems });
    setHasChanges(true);
  };

  const handleRemoveVariantRow = (itemIdx: number, varIdx: number) => {
    const newItems = [...editModal.editedItems];
    newItems[itemIdx].variants.splice(varIdx, 1);
    setEditModal({ ...editModal, editedItems: newItems });
    setHasChanges(true);
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
    setHasChanges(true);
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
        customer_id: editModal.reassignCustomerId, // Updates the customer linked to this quote
        title: editModal.editedTitle
      }).eq("id", editModal.id);

      for (const item of editModal.editedItems) {
        if (!item.description.trim() && (!item.searchQuery || !item.searchQuery.trim())) continue;

        const finalDescriptionToSave = item.description || item.searchQuery;
        let currentItemId = item.id;
        
        if (item.type === "general") {
          const unitPrice = item.quantity > 0 ? (item.unit_total / item.quantity) : 0;
          // regular_total → regular_price per unit. Falls back to unit_price if regular_total is missing/zero.
          const regularPrice = item.quantity > 0 && (item.regular_total ?? 0) > 0
            ? (item.regular_total / item.quantity)
            : unitPrice;
          if (item.id.toString().startsWith('new_')) {
            const { data: insertedItem, error: iError } = await supabase.from("quote_items").insert([{
              quote_id: editModal.id, description: finalDescriptionToSave, quantity: item.quantity, unit_price: unitPrice, regular_price: regularPrice
            }]).select().single();
            if (iError) throw iError;
            currentItemId = insertedItem.id;
          } else {
            await supabase.from("quote_items").update({
              description: finalDescriptionToSave, quantity: item.quantity, unit_price: unitPrice, regular_price: regularPrice
            }).eq("id", item.id);
          }
          if (!item.id.toString().startsWith('new_')) {
             await supabase.from("quote_item_variants").delete().eq("quote_item_id", item.id);
          }
        } else {
          const itemTotalQty = (item.variants || []).reduce((sum: number, v: any) => sum + calculateVariantQty(v), 0);
          // For apparel the unit_price/regular_price on the parent item mirror the first variant —
          // keeps the customer-facing display consistent with general items.
          const apparelUnitPrice    = item.variants[0]?.unit_price    ?? 0;
          const apparelRegularPrice = item.variants[0]?.regular_price ?? apparelUnitPrice;

          if (item.id.toString().startsWith('new_')) {
            const { data: insertedItem, error: iError } = await supabase.from("quote_items").insert([{
              quote_id: editModal.id,
              description: finalDescriptionToSave,
              quantity: itemTotalQty,
              unit_price: apparelUnitPrice,
              regular_price: apparelRegularPrice
            }]).select().single();
            if (iError) throw iError;
            currentItemId = insertedItem.id;
          } else {
            await supabase.from("quote_items").update({
              description: finalDescriptionToSave,
              quantity: itemTotalQty,
              unit_price: apparelUnitPrice,
              regular_price: apparelRegularPrice
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

      showToast("success", "Saved");
      setEditModal(null);
      setHasChanges(false);
      loadQuotes();

    } catch (err: any) {
      showToast("error", "Error saving edits: " + err.message);
    }
  };

  const formatItemSummary = (items: any[]) => {
    if (!items || items.length === 0) return "No items detailed";
    return items.map(i => {
        let total = 0;
        if (i.quote_item_variants) {
            total = i.quote_item_variants.reduce((sum: number, v: any) => sum + v.xs + v.s + v.m + v.l + v.xl + v.xxl + v.xxxl + v.xxxxl + v.xxxxxl, 0);
        }
        return `${total > 0 ? total : i.quantity}x ${i.description}`;
    }).join(" • ");
  };

  const filteredCustomers = customers.filter(c =>
    c.company_name?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // ---------- LIST COMPUTATIONS (filter, search, pipeline metrics, staleness) ----------

  // A quote is "stale" if status = Sent and it's been >7 days — time to chase the client
  const STALE_DAYS = 7;
  const isStale = (q: any) => {
    if (q.status !== "Sent") return false;
    const sentDate = new Date(q.updated_at || q.created_at || 0);
    return (Date.now() - sentDate.getTime()) / 86400000 > STALE_DAYS;
  };

  const matchesListFilter = (q: any) => {
    const jobStage = q.jobs?.[0]?.stage;
    switch (listFilter) {
      case "all": return true;
      case "draft": return q.status === "Draft";
      case "sent": return q.status === "Sent";
      case "approved": return q.status === "Approved" && (!jobStage || jobStage === "Incoming");
      case "production": return q.status === "Approved" && jobStage && !["Incoming","Billing","Paid"].includes(jobStage);
      case "done": return q.status === "Approved" && (jobStage === "Billing" || jobStage === "Paid");
      default: return true;
    }
  };

  const matchesListSearch = (q: any) => {
    if (!listSearch.trim()) return true;
    const s = listSearch.toLowerCase();
    return (
      (q.customers?.company_name || "").toLowerCase().includes(s) ||
      (q.title || "").toLowerCase().includes(s) ||
      (q.id || "").toLowerCase().includes(s) ||
      (q.quote_items || []).some((i: any) => (i.description || "").toLowerCase().includes(s))
    );
  };

  const visibleQuotes = quotes.filter(q => matchesListFilter(q) && matchesListSearch(q));

  // Pipeline metrics (based on unfiltered quotes — they're business-level totals)
  const totalPipelineValue = quotes
    .filter(q => q.status !== "Approved" || (q.jobs?.[0]?.stage && !["Billing","Paid"].includes(q.jobs[0].stage)))
    .reduce((sum, q) => sum + (q.total_amount || 0), 0);
  const draftCount = quotes.filter(q => q.status === "Draft").length;
  const sentCount = quotes.filter(q => q.status === "Sent").length;
  const approvedCount = quotes.filter(q => q.status === "Approved" && (!q.jobs?.[0]?.stage || q.jobs[0].stage === "Incoming")).length;
  const productionCount = quotes.filter(q => q.status === "Approved" && q.jobs?.[0]?.stage && !["Incoming","Billing","Paid"].includes(q.jobs[0].stage)).length;
  const doneCount = quotes.filter(q => q.status === "Approved" && ["Billing","Paid"].includes(q.jobs?.[0]?.stage || "")).length;
  const staleCount = quotes.filter(isStale).length;

  return (
    <div className={`min-h-screen ${isLightMode ? 'bg-slate-50 text-slate-900' : 'bg-[#0f1115] text-white'} font-sans p-3 sm:p-4 md:p-10 max-w-[1600px] mx-auto pb-8 md:pb-32 transition-colors duration-300`}>

      {/* ============ HEADER ============ */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-end mb-5 md:mb-8 border-b ${isLightMode ? 'border-slate-200' : 'border-white/10'} pb-5 md:pb-8 mt-2 md:mt-4 gap-4 md:gap-6`}>
        <div className="w-full md:w-auto">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 md:mb-4 flex-wrap">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none">Quotes & Proposals</h1>
            {/* SYNC STATUS */}
            <span
              className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 px-2 py-1 rounded-full border ${
                syncStatus === 'live'
                  ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
                  : syncStatus === 'polling'
                    ? 'text-amber-500 bg-amber-500/10 border-amber-500/30'
                    : 'text-slate-400 bg-slate-500/10 border-slate-500/30'
              }`}
              title={
                syncStatus === 'live' ? 'Realtime sync active — changes on other devices appear instantly' :
                syncStatus === 'polling' ? 'Realtime disconnected — polling every 30s' :
                'Connecting…'
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'live' ? 'bg-emerald-500 animate-pulse' : syncStatus === 'polling' ? 'bg-amber-500' : 'bg-slate-400 animate-pulse'}`}></span>
              {syncStatus === 'live' ? 'Live' : syncStatus === 'polling' ? 'Poll' : '...'}
            </span>
          </div>
          <p className="text-slate-500 text-[11px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.3em] ml-1">Pipeline & Estimations</p>
        </div>
        <Link href="/quotes/new" className="w-full md:w-auto text-center bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white px-8 py-4 md:py-3 rounded-xl font-black uppercase text-[12px] md:text-xs tracking-widest transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 min-h-[52px] md:min-h-0 flex items-center justify-center active:scale-95">
          + New Quote
        </Link>
      </div>

      {/* ============ PIPELINE SUMMARY ============ */}
      {!loading && quotes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className={`p-4 rounded-2xl border ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/10'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline Value</p>
            <p className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-500 mt-1">${totalPipelineValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            <p className={`text-[10px] sm:text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>active quotes + jobs</p>
          </div>
          <div className={`p-4 rounded-2xl border ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/10'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Awaiting Response</p>
            <p className="text-2xl md:text-3xl font-black tracking-tighter text-amber-500 mt-1">{sentCount}</p>
            <p className={`text-[10px] sm:text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>sent to clients</p>
          </div>
          <button
            onClick={() => setListFilter(listFilter === "production" ? "all" : "production")}
            className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 ${listFilter === "production" ? 'ring-2 ring-sky-500' : ''} ${isLightMode ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-900/50 border-white/10 hover:border-white/20'}`}
          >
            <p className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>In Production</p>
            <p className="text-2xl md:text-3xl font-black tracking-tighter text-sky-500 mt-1">{productionCount}</p>
            <p className={`text-[10px] sm:text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>on the shop floor</p>
          </button>
          <button
            onClick={() => {
              if (staleCount === 0) return;
              setListFilter("sent");
              showToast("info", `Showing ${sentCount} sent quote${sentCount > 1 ? 's' : ''}. Those marked ⏰ have been waiting >${STALE_DAYS} days.`);
            }}
            disabled={staleCount === 0}
            className={`p-4 rounded-2xl border text-left transition-all ${staleCount > 0 ? 'hover:-translate-y-0.5 cursor-pointer' : 'cursor-default opacity-60'} ${staleCount > 0 ? (isLightMode ? 'bg-red-50 border-red-200' : 'bg-red-950/20 border-red-500/30') : (isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/10')}`}
          >
            <p className={`text-[9px] font-black uppercase tracking-widest ${staleCount > 0 ? 'text-red-500' : (isLightMode ? 'text-slate-500' : 'text-slate-400')}`}>Needs Chasing</p>
            <p className={`text-2xl md:text-3xl font-black tracking-tighter mt-1 ${staleCount > 0 ? 'text-red-500' : (isLightMode ? 'text-slate-300' : 'text-slate-600')}`}>{staleCount}</p>
            <p className={`text-[10px] sm:text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>sent &gt;{STALE_DAYS}d ago</p>
          </button>
        </div>
      )}

      {/* ============ SEARCH + FILTER CHIPS ============ */}
      {!loading && quotes.length > 0 && (
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search quote #, client, project, item…"
              className={`w-full text-xs font-bold rounded-xl pl-10 pr-10 py-3 border outline-none transition-colors ${isLightMode ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-500' : 'bg-slate-900/50 border-white/10 text-slate-200 placeholder:text-slate-500 focus:border-sky-500'}`}
            />
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-base ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>🔍</span>
            {listSearch && (
              <button onClick={() => setListSearch("")} className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black ${isLightMode ? 'text-slate-400 hover:text-slate-900' : 'text-slate-500 hover:text-white'}`}>✕</button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: "all",         label: "All",         count: quotes.length,  color: "slate" },
              { id: "draft",       label: "Draft",       count: draftCount,     color: "slate" },
              { id: "sent",        label: "Sent",        count: sentCount,      color: "amber" },
              { id: "approved",    label: "Approved",    count: approvedCount,  color: "emerald" },
              { id: "production",  label: "In Prod",     count: productionCount,color: "sky" },
              { id: "done",        label: "Done",        count: doneCount,      color: "violet" },
            ].map(chip => {
              const active = listFilter === chip.id;
              const disabled = chip.count === 0 && chip.id !== "all";
              return (
                <button
                  key={chip.id}
                  onClick={() => setListFilter(chip.id as any)}
                  disabled={disabled}
                  className={`shrink-0 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${
                    active
                      ? `bg-${chip.color}-500 text-white border-${chip.color}-400 shadow-md`
                      : disabled
                        ? (isLightMode ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' : 'bg-slate-900/30 border-slate-800 text-slate-700 cursor-not-allowed')
                        : (isLightMode ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-400' : 'bg-slate-900/50 border-white/10 text-slate-400 hover:border-white/20')
                  }`}
                >
                  {chip.label}
                  {chip.count > 0 && <span className={`text-[9px] px-1 rounded ${active ? 'bg-white/20' : (isLightMode ? 'bg-slate-200' : 'bg-white/10')}`}>{chip.count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 font-black uppercase tracking-widest mt-20 animate-pulse">Syncing Pipeline...</div>
      ) : quotes.length === 0 ? (
        <div className={`text-center font-black uppercase tracking-widest mt-20 border-2 border-dashed py-20 rounded-[2rem] ${isLightMode ? 'border-slate-300 text-slate-500' : 'border-white/10 text-slate-500'}`}>
          <p className="text-lg mb-2">Pipeline is empty</p>
          <p className="text-[10px] mb-6 opacity-70">No quotes yet — create your first one</p>
          <Link href="/quotes/new" className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md">+ New Quote</Link>
        </div>
      ) : visibleQuotes.length === 0 ? (
        <div className={`text-center font-black uppercase tracking-widest mt-12 border-2 border-dashed py-16 rounded-[2rem] ${isLightMode ? 'border-slate-300 text-slate-500' : 'border-white/10 text-slate-500'}`}>
          <p className="text-sm">No quotes match your filter</p>
          <button onClick={() => { setListFilter("all"); setListSearch(""); }} className="mt-4 text-[10px] underline hover:text-sky-500 transition-colors">Reset filters</button>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-5 max-w-[1600px] w-full mx-auto">
          {visibleQuotes.map((quote) => {
            const isApproved = quote.status === "Approved";
            const rawStage = quote.jobs?.[0]?.stage || "Incoming";
            const displayStage = DB_STAGE_MAP[rawStage] || rawStage;
            const stale = isStale(quote);
            // Pull metadata saved by /quotes/new-v2 — null for legacy quotes
            const meta = parseYayaMeta(quote.internal_notes);

            // Workflow state — 1/5, 2/5, etc.
            const workflowStep = quote.status === "Draft" ? 1 : quote.status === "Sent" ? 2 : isApproved && rawStage === "Incoming" ? 3 : isApproved && !["Incoming","Billing","Paid"].includes(rawStage) ? 4 : 5;

            return (
              <div key={quote.id} className={`border p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-lg flex flex-col gap-4 transition-all overflow-hidden relative ${
                stale
                  ? (isLightMode ? 'bg-white border-red-300 hover:bg-red-50/40' : 'bg-slate-900/50 border-red-500/30 hover:bg-red-950/10')
                  : isApproved
                    ? (isLightMode ? 'bg-white border-emerald-200 hover:bg-emerald-50/40' : 'bg-slate-900/50 border-emerald-500/20 hover:bg-slate-900')
                    : (isLightMode ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-slate-900/50 border-white/5 hover:bg-slate-900')
              }`}>

                {/* STALE FLAG STRIP */}
                {stale && (
                  <div className={`-mx-5 md:-mx-6 -mt-5 md:-mt-6 px-5 md:px-6 py-2 text-[9px] font-black uppercase tracking-widest border-b flex items-center gap-2 ${isLightMode ? 'bg-red-50 border-red-100 text-red-600' : 'bg-red-950/30 border-red-500/20 text-red-400'}`}>
                    <span>⏰</span>
                    Sent &gt;{STALE_DAYS} days ago — no response yet. Consider following up.
                  </div>
                )}

                {/* TOP ROW: badges + menu */}
                <div className="flex items-start gap-3 w-full">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-[0.2em] border ${isLightMode ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>
                        #{quote.id.split('-')[0].toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-[0.2em] border ${isLightMode ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                        {quote.customers?.company_name || "Unknown Client"}
                      </span>
                      {/* Status badge with step indicator */}
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.2em] border flex items-center gap-1 ${
                        isApproved
                          ? (isLightMode ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30')
                          : quote.status === "Sent"
                            ? (isLightMode ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/30')
                            : (isLightMode ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-700/50 text-slate-300 border-slate-600')
                      }`}>
                        {isApproved ? displayStage : quote.status}
                        <span className="opacity-60 font-mono">{workflowStep}/5</span>
                      </span>
                      {/* New-v2 metadata chips — only render for orders saved through the new page */}
                      {meta?.rushOrder && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.2em] border flex items-center gap-1 ${isLightMode ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                          ⚡ Rush
                        </span>
                      )}
                      {meta?.printMethod && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.2em] border ${isLightMode ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-violet-500/10 text-violet-400 border-violet-500/30'}`}>
                          {meta.printMethod}
                        </span>
                      )}
                      {(meta?.files?.length ?? 0) > 0 && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.2em] border flex items-center gap-1 ${isLightMode ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-sky-500/10 text-sky-400 border-sky-500/30'}`} title={`${meta!.files!.length} attached`}>
                          📎 {meta!.files!.length}
                        </span>
                      )}
                    </div>

                    <div className="text-lg md:text-2xl font-black uppercase tracking-tighter truncate" title={quote.title || quote.customers?.company_name}>
                      {quote.title || quote.customers?.company_name || "Unknown Client"}
                    </div>

                    {quote.quote_items && quote.quote_items.length > 0 && (
                      <div className={`text-xs font-bold uppercase tracking-widest truncate mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`} title={formatItemSummary(quote.quote_items)}>
                        {quote.quote_items.slice(0, 2).map((i: any) => {
                          let total = 0;
                          if (i.quote_item_variants) {
                            total = i.quote_item_variants.reduce((sum: number, v: any) => sum + v.xs + v.s + v.m + v.l + v.xl + v.xxl + v.xxxl + v.xxxxl + v.xxxxxl, 0);
                          }
                          return `${total > 0 ? total : i.quantity}x ${i.description}`;
                        }).join(" • ")}
                        {quote.quote_items.length > 2 && (
                          <span className={`ml-2 ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}>
                            + {quote.quote_items.length - 2} more
                          </span>
                        )}
                      </div>
                    )}

                    <div className={`text-xl md:text-2xl font-black mt-2 ${isLightMode ? 'text-emerald-600' : 'text-emerald-400'}`}>${(quote.total_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                  </div>

                  {/* OVERFLOW MENU */}
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === quote.id ? null : quote.id)}
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg font-black transition-colors ${openMenuId === quote.id ? (isLightMode ? 'bg-slate-200 border-slate-300' : 'bg-slate-700 border-slate-600') : (isLightMode ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700')}`}
                      title="More actions"
                    >
                      ⋯
                    </button>
                    {openMenuId === quote.id && (
                      <div className={`absolute right-0 top-full mt-2 min-w-[200px] rounded-xl border shadow-2xl z-20 overflow-hidden ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                        {quote.status === "Draft" && (
                          <button onClick={() => { handleMarkSent(quote); setOpenMenuId(null); }} className={`w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${isLightMode ? 'hover:bg-amber-50 text-amber-700' : 'hover:bg-amber-500/10 text-amber-400'}`}>
                            <span>✉️</span> Mark as Sent
                          </button>
                        )}
                        <button onClick={() => { handleCopyLink(quote); setOpenMenuId(null); }} className={`w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${isLightMode ? 'hover:bg-sky-50 text-sky-700' : 'hover:bg-sky-500/10 text-sky-400'}`}>
                          <span>🔗</span> Copy Shareable Link
                        </button>
                        <button onClick={() => { handleDuplicateQuote(quote); setOpenMenuId(null); }} className={`w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${isLightMode ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-700 text-slate-300'}`}>
                          <span>📋</span> Duplicate Quote
                        </button>
                        <div className={`border-t ${isLightMode ? 'border-slate-200' : 'border-slate-700'}`}></div>
                        <button onClick={() => { handleDeleteQuote(quote); setOpenMenuId(null); }} className={`w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${isLightMode ? 'hover:bg-red-50 text-red-600' : 'hover:bg-red-500/10 text-red-400'}`}>
                          <span>🗑️</span> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ACTION ROW */}
                <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full">

                  {/* ASSIGN SHELF - only when approved */}
                  {isApproved && (
                    <button
                      onClick={() => setAssignmentModal(quote)}
                      className={`text-center text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap ${isLightMode ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20'}`}
                    >
                      📦 Assign Shelf
                    </button>
                  )}

                  <Link
                    href={`/quotes/${quote.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-center text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap ${isLightMode ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200' : 'text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20'}`}
                  >
                    👁️ View PO
                  </Link>

                  <button
                    onClick={() => openEditModal(quote)}
                    className={`text-center text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap ${isLightMode ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'}`}
                  >
                    ✏️ Edit
                  </button>

                  {/* Primary action - fills remaining space */}
                  {!isApproved ? (
                    <button
                      onClick={() => handleApprove(quote)}
                      className="sm:ml-auto bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <span>Approve & Start Production</span>
                      <span className="text-base">→</span>
                    </button>
                  ) : (
                    <Link
                      href="/shop-floor"
                      className={`sm:ml-auto text-center px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border whitespace-nowrap flex items-center justify-center gap-2 ${isLightMode ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'}`}
                    >
                      <span>▶ On Shop Floor</span>
                    </Link>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* --- EDIT QUOTE MODAL --- */}
      {editModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-[70] animate-in fade-in duration-200">
          <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'} border rounded-[2rem] w-full max-w-6xl p-6 md:p-8 shadow-2xl relative flex flex-col max-h-[90vh]`}>
            <div className={`flex justify-between items-start border-b pb-4 mb-4 shrink-0 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                <div>
                    <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none">Edit Quote / Draft</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-2 text-slate-500">QUOTE #{editModal.id.split('-')[0].toUpperCase()} • {editModal.customers?.company_name}</p>
                </div>
                <button onClick={() => {
                    if (hasChanges) {
                        if (window.confirm("⚠️ You have unsaved changes. Are you sure you want to discard them?")) {
                            setEditModal(null);
                        }
                    } else {
                        setEditModal(null);
                    }
                }} className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'}`}>Close</button>
            </div>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-6">
                
                {/* --- ORDER NAME / TITLE BLOCK --- */}
                <div className={`p-5 rounded-2xl border shadow-sm ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                    <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-500">Base Project Name (Auto-appends items)</label>
                    <input 
                        type="text"
                        placeholder="e.g. XYZ CONSTRUCTION"
                        value={editModal.editedTitle}
                        onChange={(e) => {
                            setEditModal({...editModal, editedTitle: e.target.value});
                            setHasChanges(true);
                        }}
                        className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-sky-500 mb-3 ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`}
                    />
                    <div className={`text-[10px] font-bold uppercase tracking-widest p-3 rounded-lg border ${isLightMode ? 'bg-sky-50 border-sky-100 text-slate-500' : 'bg-sky-500/10 border-sky-500/20 text-slate-400'}`}>
                        Auto-Generated Order Name: <br/>
                        <span className={`text-xs mt-1 block ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}>
                            {editModal.editedTitle || "PROJECT NAME"} — {editModal.editedItems.map((i: any) => `${i.variants.reduce((sum: number, v: any) => sum + v.xs + v.s + v.m + v.l + v.xl + v.xxl + v.xxxl + v.xxxxl + v.xxxxxl, 0)}x ${i.description || i.searchQuery || "Item"}`).join(" • ")}
                        </span>
                    </div>
                </div>

                {/* --- CUSTOMER REASSIGNMENT BLOCK --- */}
                <div className={`p-5 rounded-2xl border shadow-sm ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 text-sky-500">Customer Details</h3>
                    
                    {/* Reassign / Smart Search */}
                    <div className="relative w-full max-w-md">
                        <div className="flex justify-between items-center mb-2">
                           <label className={`text-[10px] font-black uppercase tracking-widest text-slate-500`}>Change / Reassign Client</label>
                        </div>
                        <input 
                            type="text"
                            placeholder={editModal.customers?.company_name || "Search to reassign..."}
                            value={customerSearch}
                            onChange={(e) => {
                                setCustomerSearch(e.target.value);
                                setShowCustomerDropdown(true);
                                setEditModal({...editModal, reassignCustomerId: ""});
                                setHasChanges(true);
                            }}
                            onFocus={() => setShowCustomerDropdown(true)}
                            className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-sky-500 ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'} ${editModal.reassignCustomerId ? 'border-emerald-500' : ''}`}
                        />
                        {editModal.reassignCustomerId && (
                            <div className="absolute right-3 top-[38px] text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Will Reassign</div>
                        )}
                        
                        {showCustomerDropdown && customerSearch.length > 0 && !editModal.reassignCustomerId && (
                            <div className={`absolute top-full left-0 w-full mt-2 border rounded-xl max-h-48 overflow-y-auto shadow-2xl z-50 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                                {filteredCustomers.map(c => (
                                    <button 
                                        key={c.id} type="button" 
                                        onClick={() => { 
                                            setEditModal({...editModal, reassignCustomerId: c.id}); 
                                            setCustomerSearch(c.company_name); 
                                            setShowCustomerDropdown(false); 
                                            setHasChanges(true);
                                        }} 
                                        className={`w-full text-left p-3 border-b transition-colors ${isLightMode ? 'border-slate-100 hover:bg-sky-50' : 'border-white/5 hover:bg-sky-900/40'}`}
                                    >
                                        <div className={`text-xs font-black uppercase tracking-tight ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{c.company_name}</div>
                                    </button>
                                ))}
                                {filteredCustomers.length === 0 && (
                                    <div className="p-4 text-center flex flex-col items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-500">No client found.</span>
                                    </div>
                                )}
                                <button type="button" onClick={() => setShowCustomerDropdown(false)} className={`w-full text-center p-2 text-[9px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-100 text-slate-500 hover:text-slate-900' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>Close</button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-500">Public Invoice Notes</label>
                        <textarea 
                            rows={3} 
                            value={editModal.editedNotes} 
                            onChange={(e) => { setEditModal({...editModal, editedNotes: e.target.value}); setHasChanges(true); }}
                            placeholder="Notes visible to client on the invoice..."
                            className={`w-full rounded-xl px-4 py-3 text-sm focus:border-sky-500 outline-none transition-colors shadow-inner border custom-scrollbar resize-none ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} 
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-500">Internal Shop Notes</label>
                        <textarea 
                            rows={3} 
                            value={editModal.editedInternalNotes} 
                            onChange={(e) => { setEditModal({...editModal, editedInternalNotes: e.target.value}); setHasChanges(true); }}
                            placeholder="Private notes for production team..."
                            className={`w-full rounded-xl px-4 py-3 text-sm focus:border-sky-500 outline-none transition-colors shadow-inner border custom-scrollbar resize-none ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} 
                        />
                    </div>
                </div>

                <div>
                    <div className={`flex justify-between items-end mb-3 border-b pb-2 ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
                        <label className="text-[10px] font-black uppercase tracking-widest">Product Line Items</label>
                        <div className="flex gap-2">
                          <button onClick={() => handleAddItemRow("apparel")} className={`text-[9px] font-black uppercase tracking-widest border px-3 py-1.5 rounded-lg transition-colors shadow-sm ${isLightMode ? 'bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-500 hover:text-white' : 'bg-sky-500/10 text-sky-500 border-sky-500/30 hover:bg-sky-500 hover:text-white'}`}>
                              + Add Apparel
                          </button>
                          <button onClick={() => handleAddItemRow("general")} className={`text-[9px] font-black uppercase tracking-widest border px-3 py-1.5 rounded-lg transition-colors shadow-sm ${isLightMode ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-500 hover:text-white' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 hover:bg-indigo-500 hover:text-white'}`}>
                              + Add General Item
                          </button>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        {editModal.editedItems.map((item: any, iIdx: number) => (
                            <div key={item.id} className={`flex flex-col gap-4 p-5 rounded-[1.5rem] border shadow-sm ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-slate-800'}`}>
                                
                                <div className="flex justify-between items-start w-full gap-4">
                                    <div className="flex-1 relative">
                                        <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block text-slate-500">Product Description / Catalog Search</label>
                                        <textarea 
                                            rows={2}
                                            value={item.description !== undefined ? item.description : item.searchQuery} 
                                            onFocus={() => handleEditItemChange(iIdx, "showDropdown", true)}
                                            onChange={(e) => {
                                                handleEditItemChange(iIdx, 'description', e.target.value);
                                                handleEditItemChange(iIdx, 'showDropdown', true);
                                            }}
                                            placeholder="e.g. Gildan 5000 T-Shirt"
                                            className={`w-full rounded-lg px-4 py-3 text-sm font-bold outline-none border focus:border-sky-500 shadow-inner resize-none custom-scrollbar ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`} 
                                        />
                                        {item.showDropdown && item.description?.length > 0 && (
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
                                    <button onClick={() => handleRemoveItemRow(iIdx)} className={`p-3 rounded-lg border transition-colors shrink-0 mt-5 ${isLightMode ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border-red-200' : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-red-500/20'}`} title="Remove Product">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>

                                {/* CONDITIONAL UI: APPAREL MATRIX VS GENERAL ITEM */}
                                <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                                  {item.type === "general" ? (
                                    <div className={`flex flex-col md:grid md:grid-cols-4 gap-4 p-4 rounded-xl border transition-all mt-4 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                                      <div>
                                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 text-slate-500`}>Quantity</label>
                                        <input type="number" value={item.quantity} onChange={(e) => handleEditItemChange(iIdx, "quantity", parseInt(e.target.value) || 0)} className={`w-full rounded-md p-3 text-xs font-black outline-none border shadow-sm ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} placeholder="Qty" />
                                      </div>
                                      <div>
                                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 text-slate-500`}>Regular Total Price</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-3 text-[10px] font-black text-slate-400">$</span>
                                          <input type="number" step="0.01" value={item.regular_total} onChange={(e) => handleEditItemChange(iIdx, "regular_total", parseFloat(e.target.value) || 0)} className={`w-full border rounded-md p-3 pl-6 text-xs font-black line-through text-slate-400 outline-none shadow-sm ${isLightMode ? 'bg-white border-slate-300' : 'bg-black border-slate-700'}`} placeholder="Reg Total" />
                                        </div>
                                      </div>
                                      <div>
                                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 text-slate-500`}>Special Total Price</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-3 text-[10px] font-black text-emerald-500/50">$</span>
                                          <input type="number" step="0.01" value={item.unit_total} onChange={(e) => handleEditItemChange(iIdx, "unit_total", parseFloat(e.target.value) || 0)} className={`w-full border border-emerald-500/30 rounded-md p-3 pl-6 text-xs font-black text-emerald-500 outline-none focus:border-emerald-500 transition shadow-sm ${isLightMode ? 'bg-emerald-50' : 'bg-slate-900'}`} placeholder="Special Total" />
                                        </div>
                                      </div>
                                      <div className="flex flex-col justify-center items-end pr-2">
                                        <div className={`text-[8px] font-black uppercase tracking-widest text-slate-500`}>Unit Price</div>
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
                                                  className={`w-full rounded-lg p-2 text-center text-xs font-black outline-none transition shadow-inner border focus:border-sky-500 ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black border-slate-700 text-white'}`} 
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
                                                className={`w-full rounded-lg p-2 pl-5 text-center text-xs font-black line-through outline-none shadow-inner border ${isLightMode ? 'bg-slate-50 border-slate-300 text-slate-400' : 'bg-black border-slate-700 text-slate-500'}`} 
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
                <button onClick={() => {
                    if (hasChanges) {
                        if (window.confirm("⚠️ You have unsaved changes. Are you sure you want to discard them?")) {
                            setEditModal(null);
                        }
                    } else {
                        setEditModal(null);
                    }
                }} className={`flex-1 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'border-slate-200 hover:bg-slate-100 text-slate-800' : 'border-slate-800 hover:bg-slate-800 text-white'}`}>
                    Discard Changes
                </button>
                <button onClick={handleSaveOrderEdits} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                    Save Order Updates
                </button>
            </div>
          </div>
        </div>
      )}

      {/* --- WMS ASSIGNMENT MODAL --- */}
      {assignmentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-[80] animate-in fade-in duration-200" onClick={() => setAssignmentModal(null)}>
          <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'} border rounded-[2rem] w-full max-w-lg p-6 md:p-8 shadow-2xl relative`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-inherit pb-4 mb-6">
                <div>
                    <h2 className={`text-xl font-black uppercase italic tracking-tighter leading-none ${isLightMode ? 'text-slate-900' : 'text-white'}`}>Shelve Order</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-2 text-slate-500">Assign physical location for pickup</p>
                </div>
                <button onClick={() => setAssignmentModal(null)} className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-black/40 border-white/10 text-slate-500'}`}>Close</button>
            </div>
            
            <form onSubmit={handleAssignToLocation} className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 block mb-2 tracking-widest">Select Physical Location</label>
                <select 
                    required
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className={`w-full p-4 rounded-xl text-sm font-bold outline-none border focus:border-indigo-500 transition appearance-none ${isLightMode ? 'bg-slate-50 border-slate-300 text-black' : 'bg-black border-slate-800 text-white'}`}
                >
                    <option value="" disabled>-- Select Shelf / Bin --</option>
                    {warehouseLocations.map(loc => (
                        <option key={loc.id} value={loc.id}>[{loc.zone}] - {loc.name}</option>
                    ))}
                </select>
              </div>

              <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-xl shadow-lg transition-all active:scale-95">
                  Confirm Drop-off
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============ CONFIRM DIALOG ============ */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmDialog(null)}>
          <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`text-lg font-black uppercase italic tracking-tighter mb-2 ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{confirmDialog.title}</h3>
            <p className={`text-sm leading-relaxed mb-6 ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>{confirmDialog.message}</p>
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