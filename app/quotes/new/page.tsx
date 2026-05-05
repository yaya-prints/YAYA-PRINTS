"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

const GILDAN_COLORS = ["White", "Black", "Navy", "Sport Grey", "Red", "Royal", "Dark Heather", "Charcoal", "Forest Green", "Gold", "Maroon", "Safety Pink", "Safety Orange"];
const SIZES = ["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xxxxl", "xxxxxl"];

export default function NewQuoteMatrix() {
  const router = useRouter();
  
  // --- THEME STATE ---
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  
  // --- DATA STATES ---
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  
  // --- MISSING STATES FIXED: SMART CUSTOMER SEARCH & CREATION ---
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);
  const [newClient, setNewClient] = useState({ company_name: "", contact_name: "", email: "", phone: "" });

  const [items, setItems] = useState<any[]>([{ 
    description: "", type: "apparel",
    showDropdown: false, sides: "Single Sided",
    variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] 
  }]);

  // --- THEME SYNC ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    const isLight = savedTheme === 'light';
    setIsLightMode(isLight);
    if (isLight) {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
  }, []);

  // ESC closes add-client modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAddClientOpen) setIsAddClientOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isAddClientOpen]);

  const toggleTheme = () => {
      const newMode = !isLightMode;
      setIsLightMode(newMode);
      localStorage.setItem('yaya-theme', newMode ? 'light' : 'dark');
      if (newMode) {
          document.documentElement.classList.remove('dark');
      } else {
          document.documentElement.classList.add('dark');
      }
      window.dispatchEvent(new Event('themeChange'));
  };

  useEffect(() => {
    async function loadData() {
      const { data: c } = await supabase.from("customers").select("id, company_name");
      const { data: cat } = await supabase.from("catalog_items").select("*").order('name');
      if (c) setCustomers(c);
      if (cat) setCatalog(cat);
    }
    loadData();
  }, []);

  const filteredCustomers = customers.filter(c => 
      c.company_name?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // --- QUICK ADD CLIENT ENGINE ---
  const handleAddClient = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmittingClient(true);
      try {
          const { data, error } = await supabase.from("customers").insert([{
              company_name: newClient.company_name || newClient.contact_name,
              contact_name: newClient.contact_name,
              email: newClient.email || null,
              phone: newClient.phone || null,
              lead_status: "Quoting",
              lead_source: "Manual Quote",
              portal_pin: Math.floor(1000 + Math.random() * 9000).toString(),
              vip_tier: "Standard",
              discount_percent: 0
          }]).select().single();

          if (error) throw error;
          
          // Update local state to include new client and auto-select them
          setCustomers([data, ...customers]);
          setSelectedCustomerId(data.id);
          setCustomerSearch(data.company_name);
          setIsAddClientOpen(false);
          setNewClient({ company_name: "", contact_name: "", email: "", phone: "" });
      } catch (err: any) {
          alert("Failed to add client: " + err.message);
      } finally {
          setIsSubmittingClient(false);
      }
  };

  const addLineItem = (type: "apparel" | "general" = "apparel") => {
    if (type === "general") {
      setItems([...items, { 
        description: "", type: "general", showDropdown: false,
        quantity: 1, regular_total: 0, unit_total: 0, variants: [], sides: "Single Sided"
      }]);
    } else {
      setItems([...items, { 
        description: "", type: "apparel", showDropdown: false, sides: "Single Sided",
        variants: [{ color: "Black", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, regular_price: 0, unit_price: 0 }] 
      }]);
    }
  };

  const addColorVariant = (itemIdx: number) => {
    const newItems = [...items];
    const lastVar = newItems[itemIdx].variants[newItems[itemIdx].variants.length - 1];
    newItems[itemIdx].variants.push({ 
        color: "White", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, xxxxl: 0, xxxxxl: 0, 
        regular_price: lastVar.regular_price, unit_price: lastVar.unit_price 
    });
    setItems(newItems);
  };

  const updateItem = (itemIdx: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[itemIdx][field] = value;
    setItems(newItems);
  };

  const updateVariant = (itemIdx: number, varIdx: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[itemIdx].variants[varIdx][field] = value;
    setItems(newItems);
  };

  const selectProduct = (itemIdx: number, product: any) => {
    const newItems = [...items];
    newItems[itemIdx].description = product.name;
    newItems[itemIdx].showDropdown = false;
    
    // Auto-switch to General layout for Print Media and non-apparel items
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
    setItems(newItems);
  };

  // Math Functions
  const calculateVariantQty = (v: any) => v.xs + v.s + v.m + v.l + v.xl + v.xxl + v.xxxl + v.xxxxl + v.xxxxxl;
  const calculateVariantTotalValue = (v: any) => calculateVariantQty(v) * v.unit_price;
  const calculateVariantSavings = (v: any) => calculateVariantQty(v) * (Math.max(0, v.regular_price - v.unit_price));
  
  const calculateItemTotalValue = (item: any) => {
    if (item.type === "general") return item.unit_total || 0;
    return item.variants.reduce((sum: number, v: any) => sum + calculateVariantTotalValue(v), 0);
  };
  
  const calculateItemSavings = (item: any) => {
    if (item.type === "general") return Math.max(0, (item.regular_total || 0) - (item.unit_total || 0));
    return item.variants.reduce((vSum: number, v: any) => vSum + calculateVariantSavings(v), 0);
  };
  
  const calculateItemTotalUnits = (item: any) => {
    if (item.type === "general") return item.quantity || 0;
    return item.variants.reduce((vSum: number, v: any) => vSum + calculateVariantQty(v), 0);
  };

  const calculateGrandTotal = () => items.reduce((sum, item) => sum + calculateItemTotalValue(item), 0);
  const calculateTotalUnits = () => items.reduce((sum, item) => sum + calculateItemTotalUnits(item), 0);
  const calculateTotalSavings = () => items.reduce((sum, item) => sum + calculateItemSavings(item), 0);

  async function saveQuote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    try {
      const custId = selectedCustomerId; 
      if (!custId) throw new Error("Please select or create a customer.");

      // 1. INSTANTLY APPROVE QUOTE
      const { data: quote, error: qError } = await supabase.from("quotes").insert([{ 
        customer_id: custId, total_amount: calculateGrandTotal(), status: "Approved", internal_notes: "Generated via Matrix Quote." 
      }]).select().single();

      if (qError) throw qError;

      let totalUnits = 0;
      for (const item of items) {
        if (!item.description.trim()) continue;

        // Append sides to description so it persists to DB (matches invoices flow)
        const descWithSides = item.sides && item.sides !== "Single Sided"
          ? `${item.description} (${item.sides})`
          : item.description;

        if (item.type === "general") {
          if (item.quantity === 0) continue;
          totalUnits += item.quantity;
          const unitPrice = item.quantity > 0 ? (item.unit_total / item.quantity) : 0;
          
          const { error: iError } = await supabase.from("quote_items").insert([{
            quote_id: quote.id, description: descWithSides, quantity: item.quantity, unit_price: unitPrice
          }]);
          if (iError) throw iError;
        } else {
          const itemTotalQty = item.variants.reduce((sum: number, v: any) => sum + calculateVariantQty(v), 0);
          if (itemTotalQty === 0) continue;
          totalUnits += itemTotalQty;
          
          const { data: qItem, error: iError } = await supabase.from("quote_items").insert([{
            quote_id: quote.id, description: descWithSides, quantity: itemTotalQty, unit_price: item.variants[0].unit_price
          }]).select().single();

          if (iError) throw iError;

          const variantEntries = item.variants.map((v: any) => ({
            quote_item_id: qItem.id, color: v.color, regular_price: v.regular_price, unit_price: v.unit_price,
            xs: v.xs, s: v.s, m: v.m, l: v.l, xl: v.xl, xxl: v.xxl, xxxl: v.xxxl, xxxxl: v.xxxxl, xxxxxl: v.xxxxxl
          }));
          
          const { error: vError } = await supabase.from("quote_item_variants").insert(variantEntries);
          if (vError) throw vError;
        }
      }

      // 2. AUTO-DISPATCH TO SHOP FLOOR (SYNCED WITH PRODUCTION BOARD)
      const jobNum = Math.floor(1000 + Math.random() * 9000);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); 
      await supabase.from("jobs").insert([{ 
          quote_id: quote.id, 
          job_number: jobNum, 
          title: `${totalUnits}x MATRIX ORDER`, 
          stage: "Incoming", 
          due_date: dueDate.toISOString().split('T')[0] 
      }]);

      router.push("/quotes");
      router.refresh();
    } catch (err: any) {
      alert("Error saving: " + err.message);
      setLoading(false);
    }
  }

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

  return (
    <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans flex flex-col pb-48 transition-colors duration-300`}>
      
      {/* HEADER */}
      <div className={`border-b ${theme.border} ${theme.bgPanel} p-4 flex flex-col md:flex-row gap-4 justify-between items-center z-40 sticky top-0 shadow-sm transition-colors duration-300`}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg border transition-colors ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-black border-slate-800 text-slate-400 hover:text-white'}`}>
             ← Back
          </button>
          <div className="flex flex-col">
            <h1 className={`text-xl font-black uppercase tracking-tighter leading-none italic ${theme.textStrong}`}>YAYA <span className="text-sky-500">MATRIX</span></h1>
            <span className={`text-[8px] font-black ${theme.textMuted} uppercase tracking-widest`}>Rapid Quote Builder</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
                {isLightMode ? '🌙 Dark' : '☀️ Light'}
            </button>
            <button type="button" onClick={() => addLineItem("apparel")} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors border border-sky-500 bg-sky-600 text-white hover:bg-sky-500 shadow-sm whitespace-nowrap`}>
                + Add Apparel
            </button>
            <button type="button" onClick={() => addLineItem("general")} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors border border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm whitespace-nowrap`}>
                + Add General Item
            </button>
        </div>
      </div>

      <div className="flex-grow w-full px-4 md:px-6 py-6 flex flex-col gap-6 max-w-[1400px] mx-auto">
          <form onSubmit={saveQuote} className="space-y-6">
            
            {/* ACCOUNT SELECTION (COMPACT) */}
            <div className={`${theme.bgPanel} p-5 md:p-6 rounded-2xl border ${theme.border} shadow-sm relative z-40 flex flex-col md:flex-row gap-4 items-end`}>
               <div className="relative w-full">
                   <div className="flex justify-between items-center mb-2">
                       <label className={`text-[9px] font-black uppercase tracking-widest pl-1 ${theme.textMuted}`}>Select or Create Customer</label>
                   </div>
                   <input 
                       type="text"
                       placeholder="Type client company name..."
                       value={customerSearch}
                       onChange={(e) => {
                           setCustomerSearch(e.target.value);
                           setShowCustomerDropdown(true);
                           setSelectedCustomerId(""); 
                       }}
                       onFocus={() => setShowCustomerDropdown(true)}
                       className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${theme.inputBg} ${selectedCustomerId ? 'border-emerald-500/50' : ''}`}
                   />
                   {selectedCustomerId && (
                       <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-3 text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Selected</div>
                   )}
                   
                   {showCustomerDropdown && customerSearch.length > 0 && !selectedCustomerId && (
                       <div className={`absolute top-full left-0 w-full mt-2 border rounded-xl max-h-60 overflow-y-auto shadow-2xl z-50 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                           {filteredCustomers.map(c => (
                               <button 
                                   key={c.id} type="button" 
                                   onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.company_name); setShowCustomerDropdown(false); }} 
                                   className={`w-full text-left p-4 border-b transition-colors ${isLightMode ? 'border-slate-100 hover:bg-sky-50' : 'border-white/5 hover:bg-sky-900/40'}`}
                               >
                                   <div className={`text-xs font-black uppercase tracking-tight ${theme.textStrong}`}>{c.company_name}</div>
                               </button>
                           ))}
                           {filteredCustomers.length === 0 && (
                               <div className="p-4 text-center flex flex-col items-center gap-2">
                                   <span className={`text-[10px] font-bold ${theme.textMuted}`}>No client found.</span>
                               </div>
                           )}
                           <button type="button" onClick={() => setShowCustomerDropdown(false)} className={`w-full text-center p-2 text-[9px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-100 text-slate-500 hover:text-slate-900' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>Close</button>
                       </div>
                   )}
               </div>
               
               <button type="button" onClick={() => setIsAddClientOpen(true)} className={`w-full md:w-auto px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-sm border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500 whitespace-nowrap shrink-0`}>
                   + Create New
               </button>
            </div>

            {/* DYNAMIC LINE ITEMS (COMPACT) */}
            {items.map((item, iIdx) => (
              <div key={iIdx} className={`${theme.bgPanel} border ${theme.border} p-5 md:p-6 rounded-2xl shadow-sm relative animate-in fade-in slide-in-from-bottom-4 duration-300`}>
                
                <div className="flex flex-col md:grid md:grid-cols-2 gap-4 mb-6 border-b border-inherit pb-6">
                   <div className="relative w-full z-30">
                     <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 pl-1 ${theme.textMuted}`}>Product Description & Style</label>
                     <input 
                       placeholder="Search catalog or type description..." 
                       className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`}
                       value={item.description}
                       onFocus={() => updateItem(iIdx, "showDropdown", true)}
                       onChange={(e) => {
                           updateItem(iIdx, "description", e.target.value);
                           updateItem(iIdx, "showDropdown", true);
                       }}
                     />
                     {item.showDropdown && item.description.length > 0 && (
                       <div className={`absolute top-full left-0 w-full mt-2 border rounded-xl max-h-60 overflow-y-auto shadow-2xl z-50 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                         {catalog.filter(p => p.name.toLowerCase().includes(item.description.toLowerCase())).map(p => (
                           <button key={p.id} type="button" onClick={() => selectProduct(iIdx, p)} className={`w-full text-left p-3 border-b transition-colors group ${isLightMode ? 'border-slate-100 hover:bg-sky-50' : 'border-white/5 hover:bg-sky-900/40'}`}>
                             <div className={`text-xs font-black uppercase tracking-tight ${theme.textStrong}`}>{p.name}</div>
                             <div className={`text-[9px] font-bold mt-1 uppercase ${isLightMode ? 'text-sky-600' : 'text-sky-400'}`}>Default: ${p.default_price} | {p.category}</div>
                           </button>
                         ))}
                         <button type="button" onClick={() => updateItem(iIdx, "showDropdown", false)} className={`w-full text-center p-2 text-[9px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-100 text-slate-500 hover:text-slate-900' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>Close</button>
                       </div>
                     )}
                   </div>
                   
                   <div className="flex flex-row justify-between items-end md:flex-col md:justify-end md:text-right w-full p-4 md:p-0 rounded-xl md:rounded-none">
                       <div className={`text-[9px] font-black uppercase tracking-widest md:mb-1 pr-1 ${theme.textMuted}`}>Line Subtotal</div>
                       <div className={`text-3xl md:text-4xl font-black tracking-tighter leading-none ${theme.textStrong}`}>${calculateItemTotalValue(item).toFixed(2)}</div>
                   </div>
                </div>

                {/* CONDITIONAL UI: APPAREL MATRIX VS GENERAL ITEM */}
                <div className="space-y-3 w-full overflow-x-auto">
                  
                  {item.type === "general" ? (
                    <div className={`flex flex-col md:grid md:grid-cols-5 gap-4 p-4 rounded-xl border transition-all ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                      <div>
                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Quantity</label>
                        <input type="number" value={item.quantity} onChange={(e) => updateItem(iIdx, "quantity", parseInt(e.target.value) || 0)} className={`w-full rounded-md p-3 text-xs font-black outline-none border shadow-sm ${theme.inputBg}`} placeholder="Qty" />
                      </div>
                      <div>
                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Print Sides</label>
                        <select value={item.sides || "Single Sided"} onChange={(e) => updateItem(iIdx, "sides", e.target.value)} className={`w-full rounded-md p-3 text-xs font-black outline-none border shadow-sm ${theme.inputBg}`}>
                          <option value="Single Sided">Single Sided</option>
                          <option value="Double Sided">Double Sided</option>
                        </select>
                      </div>
                      <div>
                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Regular Total Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-[10px] font-black text-slate-400">$</span>
                          <input type="number" step="0.01" value={item.regular_total} onChange={(e) => updateItem(iIdx, "regular_total", parseFloat(e.target.value) || 0)} className={`w-full border rounded-md p-3 pl-6 text-xs font-black line-through text-slate-400 outline-none shadow-sm ${theme.inputBg}`} placeholder="Reg Total" />
                        </div>
                      </div>
                      <div>
                        <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Special Total Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-[10px] font-black text-emerald-500/50">$</span>
                          <input type="number" step="0.01" value={item.unit_total} onChange={(e) => updateItem(iIdx, "unit_total", parseFloat(e.target.value) || 0)} className={`w-full border border-emerald-500/30 rounded-md p-3 pl-6 text-xs font-black text-emerald-500 outline-none focus:border-emerald-500 transition shadow-sm ${isLightMode ? 'bg-emerald-50' : 'bg-slate-900'}`} placeholder="Special Total" />
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
                      {/* PRINT SIDES SELECTOR FOR APPAREL */}
                      <div className={`flex items-center gap-3 mb-3 px-1`}>
                        <label className={`text-[8px] font-black uppercase tracking-widest ${theme.textMuted}`}>Print Sides</label>
                        <select value={item.sides || "Single Sided"} onChange={(e) => updateItem(iIdx, "sides", e.target.value)} className={`rounded-md px-3 py-2 text-[10px] font-black outline-none border shadow-sm ${theme.inputBg}`}>
                          <option value="Single Sided">Single Sided</option>
                          <option value="Double Sided">Double Sided</option>
                        </select>
                      </div>

                      {/* DESKTOP MATRIX HEADERS */}
                      <div className={`hidden md:grid grid-cols-12 gap-1.5 text-[8px] font-black uppercase text-center tracking-widest mb-2 px-1 min-w-[1000px] ${theme.textMuted}`}>
                        <div className="col-span-1 text-left">Color</div>
                        <div>XS</div><div>S</div><div>M</div><div>L</div><div>XL</div><div>2XL</div><div>3XL</div><div>4XL</div><div>5XL</div>
                        <div className="col-span-1">Reg Price</div><div className="col-span-1 text-right">Disc Price</div>
                      </div>

                      {item.variants.map((v: any, vIdx: number) => (
                        <div key={vIdx} className={`flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-1.5 md:items-center p-4 md:p-2 rounded-xl border w-full min-w-[320px] md:min-w-[1000px] transition-all ${isLightMode ? 'bg-slate-50 border-slate-200 hover:border-sky-300' : 'bg-black/40 border-white/5 hover:border-sky-500/30'}`}>
                          
                          <div className="flex-1 md:col-span-1">
                            <div className={`text-[8px] font-black uppercase mb-1 md:hidden pl-1 ${theme.textMuted}`}>Color</div>
                            <input list={`colors-${iIdx}-${vIdx}`} value={v.color} onChange={(e) => updateVariant(iIdx, vIdx, "color", e.target.value)} className="w-full bg-transparent border-none rounded-md p-1.5 md:p-0 text-xs font-black text-sky-500 uppercase outline-none" placeholder="Color" />
                            <datalist id={`colors-${iIdx}-${vIdx}`}>{GILDAN_COLORS.map(c => <option key={c} value={c} />)}</datalist>
                          </div>

                          <div className="grid grid-cols-3 md:contents gap-1.5 w-full">
                            {SIZES.map(size => (
                              <div key={size} className="relative">
                                <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-1 text-[7px] font-black uppercase md:hidden z-10 border rounded ${isLightMode ? 'bg-white border-slate-200 text-slate-500' : 'bg-black border-slate-800 text-slate-400'}`}>{size}</div>
                                <input type="number" min="0" value={v[size]} onChange={(e) => updateVariant(iIdx, vIdx, size, parseInt(e.target.value) || 0)} className={`w-full rounded-md p-2 text-center text-xs font-black outline-none transition shadow-sm border ${theme.inputBg}`} />
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-row md:contents gap-3 w-full border-t border-inherit pt-3 md:pt-0">
                            <div className="flex-1 md:col-span-1 relative">
                                <div className={`text-[8px] font-black uppercase mb-1 md:hidden pl-1 ${theme.textMuted}`}>Reg Price</div>
                                <span className="absolute left-2 top-[22px] md:top-2 text-[9px] font-black text-slate-400">$</span>
                                <input type="number" step="0.01" value={v.regular_price} onChange={(e) => updateVariant(iIdx, vIdx, "regular_price", parseFloat(e.target.value) || 0)} className={`w-full border rounded-md p-2 pl-5 text-center text-xs font-black line-through outline-none shadow-sm text-slate-400 ${theme.inputBg}`} />
                            </div>
                            <div className="flex-1 md:col-span-1 relative">
                                <div className={`text-[8px] font-black uppercase mb-1 md:hidden pl-1 ${theme.textMuted}`}>Disc Price</div>
                                <span className="absolute left-2 top-[22px] md:top-2 text-[9px] font-black text-emerald-500/50">$</span>
                                <input type="number" step="0.01" value={v.unit_price} onChange={(e) => updateVariant(iIdx, vIdx, "unit_price", parseFloat(e.target.value) || 0)} className={`w-full border border-emerald-500/30 rounded-md p-2 pl-5 text-center text-xs font-black text-emerald-500 outline-none focus:border-emerald-500 transition shadow-sm ${isLightMode ? 'bg-emerald-50' : 'bg-slate-900'}`} />
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex flex-col-reverse sm:flex-row justify-between items-center px-0 md:px-2 pt-4 gap-4">
                        <button type="button" onClick={() => addColorVariant(iIdx)} className={`w-full sm:w-auto px-4 py-3 md:py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-transparent text-white'}`}>
                            + Add Color
                        </button>
                        <div className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>
                           Units: <span className={`ml-2 text-sm ${theme.textStrong}`}>{item.variants.reduce((sum:number, v:any) => sum + calculateVariantQty(v), 0)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </form>
      </div>

      {/* GLOBAL TOTAL STICKY BAR */}
      <div className="fixed bottom-0 left-0 w-full bg-blue-600 p-4 md:p-6 shadow-[0_-10px_40px_rgba(37,99,235,0.3)] flex flex-col md:flex-row justify-between items-center gap-4 md:px-12 z-50">
          <div className="flex justify-between w-full md:w-auto md:gap-12">
              <div>
                  <div className="text-[8px] md:text-[9px] font-black text-blue-200 uppercase mb-1 tracking-widest">Grand Total (CAD)</div>
                  <div className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none">${calculateGrandTotal().toFixed(2)}</div>
              </div>
              <div className="border-l border-white/20 pl-4 md:pl-8 flex flex-col justify-center text-right md:text-left">
                  <div className="text-[8px] md:text-[9px] font-black text-emerald-200 uppercase tracking-widest mb-1">Total Savings</div>
                  <div className="text-lg font-black text-emerald-100 italic">-${calculateTotalSavings().toFixed(2)}</div>
              </div>
          </div>
          <button onClick={(e) => saveQuote(e as any)} disabled={loading || !selectedCustomerId} className="w-full md:w-auto bg-white text-blue-600 px-8 py-4 rounded-xl font-black uppercase text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Approving & Sending to Floor..." : "Approve & Start Order →"}
          </button>
      </div>

      {/* --- NEW CLIENT MODAL --- */}
      {isAddClientOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsAddClientOpen(false)}>
            <div className={`${theme.bgPanel} border ${theme.border} rounded-[2rem] w-full max-w-md p-6 md:p-8 shadow-2xl relative flex flex-col`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start border-b border-inherit pb-4 mb-6">
                    <div>
                        <h2 className={`text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none ${theme.textStrong}`}>New Client</h2>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${theme.textMuted}`}>Quick add for quoting</p>
                    </div>
                    <button onClick={() => setIsAddClientOpen(false)} className={`text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'}`}>Close ✕</button>
                </div>
                
                <form onSubmit={handleAddClient} className="flex flex-col gap-5">
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Company / Brand Name <span className="text-red-500">*</span></label>
                        <input type="text" required value={newClient.company_name} onChange={(e) => setNewClient({...newClient, company_name: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-blue-500 ${theme.inputBg}`} placeholder="e.g. Acme Corp" />
                    </div>
                    
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Contact Name <span className="text-red-500">*</span></label>
                        <input type="text" required value={newClient.contact_name} onChange={(e) => setNewClient({...newClient, contact_name: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-blue-500 ${theme.inputBg}`} placeholder="e.g. John Doe" />
                    </div>

                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Email (Optional)</label>
                        <input type="email" value={newClient.email} onChange={(e) => setNewClient({...newClient, email: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-blue-500 ${theme.inputBg}`} placeholder="john@example.com" />
                    </div>

                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Phone (Optional)</label>
                        <input type="tel" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} className={`w-full rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors shadow-inner border focus:border-blue-500 ${theme.inputBg}`} placeholder="(555) 555-5555" />
                    </div>

                    <div className="border-t border-inherit pt-5 mt-2">
                        <button type="submit" disabled={isSubmittingClient || !newClient.company_name || !newClient.contact_name} className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md ${isSubmittingClient || !newClient.company_name || !newClient.contact_name ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600 border-none' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'}`}>
                            {isSubmittingClient ? 'Saving...' : 'Create & Select Client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}