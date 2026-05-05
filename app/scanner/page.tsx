"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Scanner } from "@yudiel/react-qr-scanner";

export default function MobileWarehouseScanner() {
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  
  // Scanner & Data State
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [location, setLocation] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual Add State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);

  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    if (savedTheme === 'light') setIsLightMode(true);
  }, []);

  // --- FETCH LOCATION & INVENTORY ---
  useEffect(() => {
    if (!scannedId) return;

    async function fetchLocationData() {
      setLoading(true);
      setErrorMsg(null);

      // 1. Find the Location by QR ID
      const { data: locData, error: locError } = await supabase
        .from("warehouse_locations")
        .select("*")
        .eq("qr_id", scannedId)
        .single();

      if (locError || !locData) {
        setErrorMsg("Unrecognized QR Code. Location not found in system.");
        setLoading(false);
        return;
      }

      setLocation(locData);

      // 2. Find all inventory sitting in this location
      const { data: invData, error: invError } = await supabase
        .from("warehouse_inventory")
        .select("*")
        .eq("location_id", locData.id)
        .order("created_at", { ascending: false });

      if (invData) setInventory(invData);
      setLoading(false);
    }

    fetchLocationData();
  }, [scannedId]);

  // --- MANUAL ADD TO INVENTORY LOGIC ---
  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!location || !newItemDesc || newItemQty < 1) return;

    const { data, error } = await supabase.from("warehouse_inventory").insert([{
      location_id: location.id,
      item_type: "Manual Entry / Extra",
      description: newItemDesc,
      quantity: newItemQty
    }]).select().single();

    if (error) {
      alert("Error adding item: " + error.message);
    } else {
      setInventory([data, ...inventory]); // Add to top of list
      setNewItemDesc("");
      setNewItemQty(1);
      setShowAddForm(false);
    }
  }

  // --- DELETE ITEM LOGIC ---
  async function handleRemoveItem(itemId: string) {
    if (!window.confirm("Remove this item from the location?")) return;
    
    await supabase.from("warehouse_inventory").delete().eq("id", itemId);
    setInventory(inventory.filter(i => i.id !== itemId));
  }

  // --- RESET SCANNER ---
  const resetScanner = () => {
    setScannedId(null);
    setLocation(null);
    setInventory([]);
    setErrorMsg(null);
    setShowAddForm(false);
  };

  return (
    <div className={`min-h-screen ${isLightMode ? 'bg-slate-50 text-slate-900' : 'bg-[#0f1115] text-white'} font-sans p-4 md:p-10 transition-colors duration-300 pb-32`}>
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-6 mt-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none">WMS Scanner</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3 ml-1">Live Inventory Uplink</p>
        </div>
      </div>

      {/* SCANNER VIEW */}
      {!scannedId ? (
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="inline-block px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-widest animate-pulse">
              Camera Active - Awaiting QR Scan
            </div>
          </div>
          
          <div className={`overflow-hidden rounded-[2rem] border-4 ${isLightMode ? 'border-slate-300' : 'border-slate-800'} shadow-2xl`}>
            <Scanner 
                onScan={(result) => {
                  if (result && result.length > 0) {
                    setScannedId(result[0].rawValue);
                  }
                }} 
                onError={(error) => console.log(error)}
            />
          </div>
          <p className="text-center text-[10px] font-bold text-slate-500 mt-6 uppercase tracking-widest">
            Point camera at a YAYA Location QR Code
          </p>
        </div>
      ) : (
        /* LOCATION DETAILS VIEW */
        <div className="max-w-3xl mx-auto animate-in fade-in zoom-in duration-300">
          
          {loading ? (
             <div className="text-center py-20 font-black uppercase tracking-widest text-slate-500 animate-pulse">Accessing Database...</div>
          ) : errorMsg ? (
             <div className="text-center py-20">
                 <div className="text-red-500 font-black uppercase tracking-widest mb-4">{errorMsg}</div>
                 <button onClick={resetScanner} className="px-6 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Try Again</button>
             </div>
          ) : location && (
            <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/5'} border p-6 md:p-8 rounded-[2rem] shadow-2xl relative`}>
                
                {/* LOCATION INFO HEADER */}
                <div className="flex justify-between items-start mb-8 pb-6 border-b border-inherit">
                    <div>
                        <div className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 px-3 py-1 rounded inline-block ${isLightMode ? 'bg-slate-100 text-slate-500' : 'bg-black text-slate-400'}`}>
                            ZONE: {location.zone}
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter">{location.name}</h2>
                        <div className="text-[9px] font-mono text-slate-500 mt-1">ID: {location.qr_id}</div>
                    </div>
                    <button onClick={resetScanner} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${isLightMode ? 'bg-slate-100 border-slate-300 hover:bg-slate-200' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'}`}>
                        Scan New
                    </button>
                </div>

                {/* INVENTORY LIST */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Contents</h3>
                        <button onClick={() => setShowAddForm(!showAddForm)} className="text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-blue-500 hover:text-white transition-colors shadow-sm">
                            + Manual Override
                        </button>
                    </div>

                    {showAddForm && (
                        <form onSubmit={handleManualAdd} className={`mb-6 p-4 rounded-xl border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-slate-800'} flex flex-col md:flex-row gap-3`}>
                            <input 
                                required placeholder="Item Description (e.g. Extra Black L Hoodie)" 
                                value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)}
                                className={`flex-grow p-3 rounded-lg text-xs font-bold outline-none border focus:border-blue-500 ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`}
                            />
                            <div className="flex gap-3">
                                <input 
                                    type="number" min="1" required placeholder="Qty" 
                                    value={newItemQty} onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                                    className={`w-24 p-3 text-center rounded-lg text-xs font-bold outline-none border focus:border-blue-500 ${isLightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'}`}
                                />
                                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Add</button>
                            </div>
                        </form>
                    )}

                    {inventory.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Location is currently empty.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {inventory.map(item => (
                                <div key={item.id} className={`flex justify-between items-center p-4 rounded-xl border ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-black text-blue-500 shrink-0">
                                            {item.quantity}
                                        </div>
                                        <div>
                                            <div className="font-black text-sm uppercase tracking-tight">{item.description}</div>
                                            <div className="text-[8px] font-black uppercase text-slate-500 tracking-widest mt-0.5">{item.item_type}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveItem(item.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Remove Item">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}