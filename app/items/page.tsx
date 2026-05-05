"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface CatalogItem {
  id: string | number;
  name: string;
  category: string;
  default_price: number;
  price_1_11: number;
  price_12_23: number;
  price_24_71: number;
  price_72_143: number;
  price_144_287: number;
  price_288_plus: number;
  isNew?: boolean;
}

export default function AdminItemsManager() {
  const router = useRouter();
  
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [originalItems, setOriginalItems] = useState<CatalogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Undo Engine State
  const [history, setHistory] = useState<CatalogItem[][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: "success"|"error"|"info"} | null>(null);

  const showToast = useCallback((msg: string, type: "success"|"error"|"info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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

  // --- LOAD DATA ---
  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("catalog_items").select("*").order('category').order('name');
    if (error) {
      showToast("Error loading catalog", "error");
    } else if (data) {
      const formattedData = data.map(item => ({
        ...item,
        price_1_11: item.price_1_11 || 0,
        price_12_23: item.price_12_23 || 0,
        price_24_71: item.price_24_71 || 0,
        price_72_143: item.price_72_143 || 0,
        price_144_287: item.price_144_287 || 0,
        price_288_plus: item.price_288_plus || 0,
      }));
      setItems(formattedData);
      setOriginalItems(JSON.parse(JSON.stringify(formattedData)));
      setHistory([JSON.parse(JSON.stringify(formattedData))]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- UNDO ENGINE (CMD+Z) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        setHistory(prevHistory => {
          if (prevHistory.length > 1) {
            const newHistory = [...prevHistory];
            newHistory.pop(); // Remove current state
            const previousState = newHistory[newHistory.length - 1];
            setItems(JSON.parse(JSON.stringify(previousState)));
            showToast("Undid last action", "info");
            return newHistory;
          }
          return prevHistory;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showToast]);

  // --- DATA MUTATION ---
  const handleItemChange = (index: number, field: keyof CatalogItem, value: string | number) => {
    const newItems = [...items];
    const actualIndex = items.findIndex(i => i.id === filteredItems[index].id);
    
    if (actualIndex !== -1) {
      (newItems[actualIndex] as any)[field] = value;
      setItems(newItems);
      
      // Save to history after a short delay (debounce) to avoid saving every keystroke
      clearTimeout((window as any).undoTimeout);
      (window as any).undoTimeout = setTimeout(() => {
        setHistory(prev => [...prev, JSON.parse(JSON.stringify(newItems))].slice(-20)); // Keep last 20 states
      }, 500);
    }
  };

  const handleAddNewItem = () => {
    const newItem: CatalogItem = {
      id: `new-${Date.now()}`,
      name: "New Item",
      category: "Print Media",
      default_price: 0,
      price_1_11: 0,
      price_12_23: 0,
      price_24_71: 0,
      price_72_143: 0,
      price_144_287: 0,
      price_288_plus: 0,
      isNew: true
    };
    const newItems = [newItem, ...items];
    setItems(newItems);
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(newItems))].slice(-20));
    setSearchQuery(""); // Clear search to see the new item
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const itemsToUpdate: any[] = [];
      const itemsToInsert: any[] = [];

      items.forEach(item => {
        const { isNew, id, ...rest } = item;
        // If it's a newly created item, it goes to the insert array (without the fake ID)
        if (isNew || (typeof id === 'string' && id.startsWith('new-'))) {
          itemsToInsert.push(rest);
        } else {
          // Existing items go to the update array
          itemsToUpdate.push({ id, ...rest });
        }
      });

      // 1. Upsert existing items
      if (itemsToUpdate.length > 0) {
        const { error: updateError } = await supabase.from("catalog_items").upsert(itemsToUpdate);
        if (updateError) throw updateError;
      }

      // 2. Insert brand new items
      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase.from("catalog_items").insert(itemsToInsert);
        if (insertError) throw insertError;
      }
      
      showToast("All changes saved successfully!", "success");
      await loadData(); // Reload to get real database IDs for new items
    } catch (err: any) {
      showToast("Error saving: " + err.message, "error");
    }
    setIsSaving(false);
  };

  // --- DERIVED STATE ---
  const hasUnsavedChanges = JSON.stringify(items) !== JSON.stringify(originalItems);
  
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const theme = {
      bgMain: isLightMode ? "bg-slate-50" : "bg-[#0a0a0b]",
      textMain: isLightMode ? "text-slate-900" : "text-slate-200",
      bgPanel: isLightMode ? "bg-white" : "bg-[#111113]",
      border: isLightMode ? "border-slate-200" : "border-slate-800",
      borderHighlight: isLightMode ? "border-sky-300 bg-sky-50" : "border-sky-500/50 bg-sky-900/20",
      textMuted: isLightMode ? "text-slate-500" : "text-slate-500",
      textStrong: isLightMode ? "text-slate-900" : "text-white",
      inputBg: isLightMode ? "bg-transparent border-transparent hover:border-slate-300 focus:border-sky-500 focus:bg-white" : "bg-transparent border-transparent hover:border-slate-700 focus:border-sky-500 focus:bg-[#1a1a1d]",
      thBg: isLightMode ? "bg-slate-100" : "bg-[#1a1a1d]",
  };

  return (
    <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans flex flex-col pb-24 transition-colors duration-300`}>
      
      {/* HEADER */}
      <div className={`border-b ${theme.border} ${theme.bgPanel} px-6 py-4 flex flex-col md:flex-row gap-4 justify-between items-center z-40 sticky top-0 shadow-sm transition-colors duration-300`}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg border transition-colors ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-black border-slate-800 text-slate-400 hover:text-white'}`}>
             ← Back
          </button>
          <div className="flex flex-col">
            <h1 className={`text-xl font-black uppercase tracking-tighter leading-none italic ${theme.textStrong}`}>Catalog <span className="text-sky-500">Manager</span></h1>
            <span className={`text-[8px] font-black ${theme.textMuted} uppercase tracking-widest flex items-center gap-2`}>
              Inventory & Pricing 
              <span className="bg-slate-500/20 px-1.5 py-0.5 rounded text-slate-400">CMD+Z TO UNDO</span>
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            <input 
              type="text"
              placeholder="Search items or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full md:w-64 rounded-lg px-4 py-2 text-xs font-bold outline-none transition-colors border focus:border-sky-500 ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-black border-slate-800'}`}
            />
            <button onClick={toggleTheme} className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-black text-[9px] uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
                {isLightMode ? '🌙' : '☀️'}
            </button>
            <button onClick={handleAddNewItem} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm whitespace-nowrap shrink-0`}>
                + New Item
            </button>
        </div>
      </div>

      {/* SPREADSHEET */}
      <div className="flex-grow w-full px-6 py-6 max-w-[1600px] mx-auto overflow-x-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className={`${theme.bgPanel} border ${theme.border} rounded-xl shadow-sm overflow-hidden min-w-[1200px]`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`${theme.thBg} text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>
                  <th className={`p-3 border-b ${theme.border} w-48`}>Category</th>
                  <th className={`p-3 border-b ${theme.border} w-64`}>Item Name</th>
                  <th className={`p-3 border-b ${theme.border} text-right border-r border-r-slate-500/20`}>Default $</th>
                  <th className={`p-3 border-b ${theme.border} text-right`}>1-11</th>
                  <th className={`p-3 border-b ${theme.border} text-right`}>12-23</th>
                  <th className={`p-3 border-b ${theme.border} text-right`}>24-71</th>
                  <th className={`p-3 border-b ${theme.border} text-right`}>72-143</th>
                  <th className={`p-3 border-b ${theme.border} text-right`}>144-287</th>
                  <th className={`p-3 border-b ${theme.border} text-right`}>288+</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold">
                {filteredItems.map((item, idx) => {
                  const originalItem = originalItems.find(o => o.id === item.id);
                  const isRowEdited = JSON.stringify(item) !== JSON.stringify(originalItem);

                  return (
                    <tr key={item.id} className={`border-b ${theme.border} transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${item.isNew ? 'bg-emerald-500/5' : ''}`}>
                      <td className="p-1 border-r border-transparent focus-within:border-sky-500">
                        <select 
                          value={item.category}
                          onChange={(e) => handleItemChange(idx, "category", e.target.value)}
                          className={`w-full p-2 rounded outline-none border ${item.category !== originalItem?.category ? theme.borderHighlight : theme.inputBg}`}
                        >
                          <option value="Apparel">Apparel</option>
                          <option value="Headwear">Headwear</option>
                          <option value="Misc">Misc</option>
                          <option value="Design">Design</option>
                          <option value="Services">Services</option>
                          <option value="Upsells">Upsells</option>
                          <option value="Custom Insert">Custom Insert</option>
                          <option value="Print Media">Print Media</option>
                        </select>
                      </td>
                      <td className="p-1 border-r border-transparent focus-within:border-sky-500">
                        <input 
                          type="text" 
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                          className={`w-full p-2 rounded outline-none border ${item.name !== originalItem?.name ? theme.borderHighlight : theme.inputBg}`}
                        />
                      </td>
                      <td className="p-1 border-r border-r-slate-500/20 focus-within:border-sky-500">
                        <input 
                          type="number" step="0.01" 
                          value={item.default_price}
                          onChange={(e) => handleItemChange(idx, "default_price", parseFloat(e.target.value) || 0)}
                          className={`w-full p-2 text-right rounded outline-none border ${item.default_price !== originalItem?.default_price ? theme.borderHighlight : theme.inputBg}`}
                        />
                      </td>
                      {['price_1_11', 'price_12_23', 'price_24_71', 'price_72_143', 'price_144_287', 'price_288_plus'].map((tierField) => (
                        <td key={tierField} className="p-1 border-r border-transparent focus-within:border-sky-500">
                          <input 
                            type="number" step="0.01" 
                            value={(item as any)[tierField]}
                            onChange={(e) => handleItemChange(idx, tierField as keyof CatalogItem, parseFloat(e.target.value) || 0)}
                            className={`w-full p-2 text-right rounded outline-none border ${(item as any)[tierField] !== (originalItem as any)?.[tierField] ? theme.borderHighlight : theme.inputBg} ${isLightMode ? 'text-sky-700' : 'text-sky-400'}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredItems.length === 0 && (
              <div className="p-12 text-center flex flex-col items-center">
                <span className={`text-[10px] font-black uppercase tracking-widest ${theme.textMuted}`}>No items found</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLOATING ACTION BAR FOR UNSAVED CHANGES */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-sky-600 border-2 border-sky-400 text-white px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(14,165,233,0.4)] flex items-center gap-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-sky-200">Unsaved Changes Detected</span>
            <span className="text-sm font-bold">You have pending catalog updates.</span>
          </div>
          <div className="flex gap-3 shrink-0">
            <button 
              onClick={() => {
                setItems(JSON.parse(JSON.stringify(originalItems)));
                setHistory([JSON.parse(JSON.stringify(originalItems))]);
              }}
              className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-sky-800/50 hover:bg-sky-800 text-white transition-colors"
            >
              Discard
            </button>
            <button 
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white text-sky-600 hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Publish to Live Database'}
            </button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[200] animate-in slide-in-from-top-4 fade-in duration-300 ${
          toast.type === "success" ? "bg-emerald-600" :
          toast.type === "error" ? "bg-rose-600" : "bg-sky-600"
        } text-white px-5 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2`}>
          {toast.type === "success" && <span>✓</span>}
          {toast.type === "error" && <span>!</span>}
          <span>{toast.msg}</span>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.5); }
      `}</style>
    </div>
  );
}