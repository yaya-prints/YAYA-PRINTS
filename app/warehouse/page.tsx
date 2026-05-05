"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { QRCodeCanvas } from "qrcode.react"; 

const ZONES = ["Blank Inventory", "Work In Progress", "Finished Goods", "Extras / Retail", "Shipping Staging"];

export default function WarehouseManager() {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLightMode, setIsLightMode] = useState<boolean>(false);

  // Form State
  const [newName, setNewName] = useState("");
  const [newZone, setNewZone] = useState("Blank Inventory");

  // Edit & Print State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editZoneValue, setEditZoneValue] = useState("Blank Inventory");
  const [printTarget, setPrintTarget] = useState<any>(null);

  useEffect(() => {
    loadLocations();
    const savedTheme = localStorage.getItem('yaya-theme');
    if (savedTheme === 'light') setIsLightMode(true);

    // Clears the print state AFTER the print dialog is closed
    const handleAfterPrint = () => {
      setPrintTarget(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Trigger print dialog only AFTER the React state has updated and rendered the label
  useEffect(() => {
    if (printTarget) {
      const timer = setTimeout(() => {
        window.print();
      }, 150); // Gives DOM time to paint the physical label dimensions
      return () => clearTimeout(timer);
    }
  }, [printTarget]);

  async function loadLocations() {
    setLoading(true);
    const { data, error } = await supabase
      .from("warehouse_locations")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setLocations(data);
    if (error) console.error("WMS Load Error:", error);
    setLoading(false);
  }

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newName) return;

    const qrId = `YAYA-${newZone.substring(0,1)}-${Date.now().toString().slice(-6)}`;

    const { error } = await supabase.from("warehouse_locations").insert([
      { name: newName, zone: newZone, qr_id: qrId }
    ]);

    if (!error) {
      setNewName("");
      loadLocations();
    } else {
      alert("Error adding location: " + error.message);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editNameValue.trim()) return;
    const { error } = await supabase.from("warehouse_locations").update({ name: editNameValue, zone: editZoneValue }).eq("id", id);
    
    if (error) {
      alert("Error updating location: " + error.message);
    } else {
      setEditingId(null);
      loadLocations();
    }
  }

  async function handleDeleteLocation(id: string) {
    if (!window.confirm("Permanently remove this location QR code?")) return;
    await supabase.from("warehouse_locations").delete().eq("id", id);
    loadLocations();
  }

  const handlePrintAll = () => {
    setPrintTarget(null); 
    setTimeout(() => window.print(), 100);
  };

  const handlePrintSingle = (loc: any) => {
    setPrintTarget(loc); // Setting this triggers the useEffect above to call window.print()
  };

  return (
    <div className={`min-h-screen ${isLightMode ? 'bg-slate-50 text-slate-900' : 'bg-[#0f1115] text-white'} font-sans p-4 md:p-10 transition-colors duration-300`}>
      
      <style jsx global>{`
        @media print {
          nav, header, footer, .no-print, .main-ui-wrapper { display: none !important; }
          
          ${printTarget ? `
            /* STRICT PHYSICAL PRINTER MEASUREMENTS */
            @page { 
              size: 2.25in 1.25in landscape !important; 
              margin: 0 !important; 
            }
            
            /* Nuke everything on the page including injected OS icons */
            body * { visibility: hidden !important; }
            body, html { margin: 0 !important; padding: 0 !important; background: white !important; width: 100vw !important; height: 100vh !important; }
            
            /* Only show the exact thermal container */
            .thermal-print-container, .thermal-print-container * { 
                visibility: visible !important; 
            }
          ` : `
            /* ORIGINAL STANDARD GRID PRINTING */
            .print-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 20px !important; }
            .label-card { border: 1px solid #000 !important; page-break-inside: avoid; padding: 20px !important; text-align: center; }
            body { background: white !important; color: black !important; }
            .thermal-print-container { display: none !important; }
          `}
        }
      `}</style>

      {/* --- BULLETPROOF THERMAL RENDERER (SIDE-BY-SIDE LAYOUT) --- */}
      {printTarget && (
        <div 
          className="thermal-print-container fixed z-[9999]"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100vw', // Ensures it respects the 2.25in paper width
            height: '100vh', // Ensures it respects the 1.25in paper height
            display: 'flex',
            flexDirection: 'row', 
            alignItems: 'center',
            justifyContent: 'flex-start',
            backgroundColor: 'white',
            padding: '0.1in',
            boxSizing: 'border-box',
            gap: '0.1in' // Exact gap between QR code and text
          }}
        >
           {/* QR Code - Locked to the left, 0.8 inches tall/wide */}
           <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <QRCodeCanvas 
                value={printTarget.qr_id} 
                size={200} 
                style={{ width: '0.8in', height: '0.8in', display: 'block' }} 
                level="H" 
                includeMargin={false} 
              />
           </div>

           {/* Text Stack Container - Anchored to the right */}
           <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              width: '100%',
              overflow: 'hidden'
           }}>
             {/* Zone Name - Sleek, Bold, Wraps if too long */}
             <div style={{
                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                fontSize: '11pt',
                fontWeight: 900,
                textTransform: 'uppercase',
                color: 'black',
                marginBottom: '2px',
                lineHeight: 1.1,
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                width: '100%'
             }}>
               {printTarget.zone}
             </div>
             
             {/* Location Name - Massive, Bold, Wraps if too long */}
             <div style={{
                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                fontSize: '18pt',
                fontWeight: 900,
                textTransform: 'uppercase',
                color: 'black',
                letterSpacing: '-0.5px',
                lineHeight: 1,
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                width: '100%'
             }}>
               {printTarget.name}
             </div>
           </div>
        </div>
      )}

      {/* MAIN UI WRAPPER */}
      <div className={`main-ui-wrapper ${printTarget ? 'no-print' : ''}`}>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-5 md:mb-10 border-b border-white/10 pb-5 md:pb-8 no-print gap-4 md:gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none">Warehouse Mapping</h1>
            <p className="text-slate-500 text-[11px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.3em] mt-3 md:mt-4 ml-1">QR Location Engine & Stock Control</p>
          </div>
          <button onClick={handlePrintAll} className="w-full md:w-auto bg-white text-black px-8 py-3.5 md:py-3 rounded-xl font-black uppercase text-[12px] md:text-[10px] tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all min-h-[48px] md:min-h-0">
            Print All Labels
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          <div className="lg:col-span-1 no-print">
              <form onSubmit={handleAddLocation} className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/5'} border p-6 rounded-[2rem] shadow-xl space-y-6`}>
                  <h3 className="text-sm font-black uppercase tracking-widest border-b border-inherit pb-3">Register New Bin/Shelf</h3>
                  
                  <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 block mb-2 tracking-widest">Location Name</label>
                      <input 
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g. Shelf A-1 or Box 42" 
                          className={`w-full p-4 rounded-xl text-sm font-bold outline-none border focus:border-blue-600 transition ${isLightMode ? 'bg-slate-50 border-slate-300' : 'bg-black border-slate-800 text-white'}`}
                      />
                  </div>

                  <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 block mb-2 tracking-widest">Warehouse Zone</label>
                      <select 
                          value={newZone}
                          onChange={(e) => setNewZone(e.target.value)}
                          className={`w-full p-4 rounded-xl text-sm font-bold outline-none border focus:border-blue-600 transition appearance-none ${isLightMode ? 'bg-slate-50 border-slate-300' : 'bg-black border-slate-800 text-white'}`}
                      >
                          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                      </select>
                  </div>

                  <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-xl shadow-lg transition-all active:scale-95">
                      Generate QR Label
                  </button>
              </form>
          </div>

          <div className="lg:col-span-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 print-grid">
                  {loading ? (
                      <div className="col-span-full text-center py-20 font-black uppercase tracking-widest text-slate-500 animate-pulse">Initializing Warehouse Map...</div>
                  ) : locations.length === 0 ? (
                      <div className="col-span-full text-center py-20 border-2 border-dashed border-white/10 rounded-[2rem] font-black uppercase tracking-widest text-slate-500">No registered locations found.</div>
                  ) : (
                      locations.map((loc) => (
                          <div key={loc.id} className={`label-card relative group p-6 rounded-[2rem] border transition-all ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/5 shadow-2xl'}`}>
                              
                              <div className="flex flex-col items-center text-center">
                                  {editingId !== loc.id && (
                                    <div className={`text-[10px] font-black uppercase tracking-[0.3em] mb-4 px-3 py-1 rounded-full ${isLightMode ? 'bg-slate-100 text-slate-500' : 'bg-black text-slate-500'}`}>
                                        {loc.zone}
                                    </div>
                                  )}
                                  
                                  <div className="bg-white p-4 rounded-2xl shadow-inner mb-4">
                                      <QRCodeCanvas value={loc.qr_id} size={140} level="H" includeMargin={false} />
                                  </div>

                                  <div className={`text-2xl font-black uppercase tracking-tighter w-full ${isLightMode ? 'text-black' : 'text-white'}`}>
                                      {editingId === loc.id ? (
                                          <div className="flex flex-col gap-2 w-full mt-2 no-print">
                                              <select 
                                                  value={editZoneValue} 
                                                  onChange={(e) => setEditZoneValue(e.target.value)}
                                                  className={`w-full p-2 text-[10px] font-black uppercase tracking-widest rounded-lg border outline-none ${isLightMode ? 'bg-white border-blue-300 focus:border-blue-600' : 'bg-black border-blue-500/50 focus:border-blue-500 text-white'}`}
                                              >
                                                  {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                              </select>
                                              <div className="flex gap-2 items-center justify-center w-full">
                                                  <input 
                                                      autoFocus
                                                      value={editNameValue} 
                                                      onChange={(e) => setEditNameValue(e.target.value)}
                                                      className={`w-full p-2 text-sm rounded-lg border outline-none text-center ${isLightMode ? 'bg-white border-blue-300 focus:border-blue-600' : 'bg-black border-blue-500/50 focus:border-blue-500 text-white'}`}
                                                  />
                                                  <button onClick={() => handleSaveEdit(loc.id)} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-500 shrink-0">
                                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                  </button>
                                              </div>
                                          </div>
                                      ) : (
                                          loc.name
                                      )}
                                  </div>
                                  
                                  <div className="text-[10px] font-mono text-slate-500 mt-1 uppercase">ID: {loc.qr_id}</div>
                              </div>

                              <div className="no-print absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex flex-col gap-2 transition-all">
                                  <button 
                                      onClick={() => handlePrintSingle(loc)}
                                      className="p-2 text-sky-500 hover:bg-sky-500/10 rounded-lg transition-all shadow-sm bg-black/20" title="Print This Label (2.25x1.25)"
                                  >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                  </button>
                                  <button 
                                      onClick={() => { setEditingId(loc.id); setEditNameValue(loc.name); setEditZoneValue(loc.zone); }}
                                      className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all shadow-sm bg-black/20" title="Edit Shelf & Zone"
                                  >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                  </button>
                                  <button 
                                      onClick={() => handleDeleteLocation(loc.id)}
                                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all shadow-sm bg-black/20" title="Delete Location"
                                  >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                  </button>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
        </div>
      </div>

    </div>
  );
}