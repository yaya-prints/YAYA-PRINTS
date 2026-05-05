"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export default function SourcingCommandCenter() {
  const [buyList, setBuyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // --- ADDITIVE: PREMIUM VIEW TOGGLE ---
  const [viewMode, setViewMode] = useState<"job" | "bulk">("job");

  useEffect(() => {
    loadBuyList();
  }, []);

  async function loadBuyList() {
    setLoading(true);
    const { data, error } = await supabase
      .from("quote_items")
      .select(`
        *,
        quote_item_variants (*),
        quotes!inner (
          status,
          jobs (id, job_number, title, stage),
          customers (company_name)
        )
      `)
      .eq("quotes.status", "Approved")
      .neq("garment_status", "Received")
      .order("created_at", { ascending: true });

    if (error) console.error("Purchasing DB Error:", error);
    if (data) setBuyList(data);
    setLoading(false);
  }

  // --- THE AUTO-SYNC ENGINE ---
  async function checkAndAdvanceJobStage(quoteId: string, jobId: string) {
    const { data: allItems } = await supabase.from("quote_items").select("garment_status").eq("quote_id", quoteId);
    if (!allItems) return;

    const allOrdered = allItems.every(i => i.garment_status === 'Ordered / In Transit' || i.garment_status === 'Received');
    const allReceived = allItems.every(i => i.garment_status === 'Received');

    if (allReceived) {
      await supabase.from("jobs").update({ stage: "Received" }).eq("id", jobId);
      await supabase.from("job_logs").insert([{ job_id: jobId, from_stage: "System Auto", to_stage: "Received" }]);
    } else if (allOrdered) {
      await supabase.from("jobs").update({ stage: "Ordered" }).eq("id", jobId);
      await supabase.from("job_logs").insert([{ job_id: jobId, from_stage: "System Auto", to_stage: "Ordered" }]);
    }
  }

  async function handleMarkOrdered(e: React.FormEvent<HTMLFormElement>, item: any) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const brand = formData.get("brand") as string;
    const supplier = formData.get("supplier") as string;
    const tracking = formData.get("tracking") as string;

    await supabase.from("quote_items").update({ 
      garment_status: 'Ordered / In Transit', 
      brand, supplier, tracking_number: tracking 
    }).eq("id", item.id);

    if (item.quotes?.jobs?.[0]?.id) {
      await checkAndAdvanceJobStage(item.quote_id, item.quotes.jobs[0].id);
    }

    loadBuyList();
  }

  async function handleMarkReceived(item: any) {
    await supabase.from("quote_items").update({ garment_status: 'Received' }).eq("id", item.id);
    
    if (item.quotes?.jobs?.[0]?.id) {
      await checkAndAdvanceJobStage(item.quote_id, item.quotes.jobs[0].id);
    }
    loadBuyList();
  }

  const filteredList = buyList.filter(item => 
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.quotes?.customers?.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.quotes?.jobs?.[0]?.job_number?.toString().includes(searchQuery)
  );

  const needsOrdering = filteredList.filter(i => i.garment_status === 'Needs Ordering' || !i.garment_status);
  const inTransit = filteredList.filter(i => i.garment_status === 'Ordered / In Transit');

  // --- ADDITIVE: PREMIUM BULK AGGREGATOR ENGINE ---
  // This calculates identical shirts across multiple jobs to build a master wholesale PO
  const masterBuyList = useMemo(() => {
    const aggregated: Record<string, any> = {};
    
    needsOrdering.forEach(item => {
      const key = item.description.toLowerCase().trim();
      
      if (!aggregated[key]) {
        aggregated[key] = {
           description: item.description,
           total_qty: 0,
           jobs: new Set(),
           variants: {}
        };
      }
      
      aggregated[key].total_qty += item.quantity;
      if (item.quotes?.jobs?.[0]?.job_number) {
          aggregated[key].jobs.add(item.quotes.jobs[0].job_number);
      }

      // Aggregate matrices across jobs
      item.quote_item_variants?.forEach((v: any) => {
         const colorKey = v.color || "Unknown";
         if (!aggregated[key].variants[colorKey]) {
             aggregated[key].variants[colorKey] = {s:0, m:0, l:0, xl:0, xxl:0, xxxl:0};
         }
         aggregated[key].variants[colorKey].s += (v.s || 0);
         aggregated[key].variants[colorKey].m += (v.m || 0);
         aggregated[key].variants[colorKey].l += (v.l || 0);
         aggregated[key].variants[colorKey].xl += (v.xl || 0);
         aggregated[key].variants[colorKey].xxl += (v.xxl || 0);
         aggregated[key].variants[colorKey].xxxl += (v.xxxl || 0);
      });
    });
    
    // Convert Sets to arrays for rendering
    return Object.values(aggregated).map(v => ({ ...v, jobs: Array.from(v.jobs) }));
  }, [needsOrdering]);

  // --- KPI CALCULATIONS ---
  const totalPendingUnits = needsOrdering.reduce((sum, i) => sum + i.quantity, 0);
  const totalInboundUnits = inTransit.reduce((sum, i) => sum + i.quantity, 0);
  const uniqueStylesNeeded = Object.keys(masterBuyList).length;

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-10 max-w-[1600px] mx-auto min-h-screen text-white bg-black font-sans pb-12 md:pb-32 selection:bg-red-500 selection:text-white">

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-5 md:mb-10 border-b border-white/10 pb-5 md:pb-8 gap-4 md:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none">Purchasing & Sourcing</h1>
          <p className="text-slate-500 text-[11px] md:text-[10px] font-black uppercase tracking-widest md:tracking-[0.3em] mt-3 md:mt-4 ml-1">Live Blank Garment Procurement</p>
        </div>
        <div className="w-full xl:w-[400px]">
          <input
            type="text" placeholder="Search Garment, Job #, or Client..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-white/10 p-4 rounded-xl text-sm md:text-xs font-bold outline-none focus:border-red-500 transition shadow-inner min-h-[48px]"
          />
        </div>
      </div>

      {/* --- ADDITIVE: GLOBAL PROCUREMENT HUD --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem] shadow-lg relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Units Pending PO</p>
              <p className="text-4xl font-black tracking-tighter text-red-500">{totalPendingUnits} <span className="text-sm text-slate-600">PCS</span></p>
          </div>
          <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem] shadow-lg relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Inbound Receiving (In Transit)</p>
              <p className="text-4xl font-black tracking-tighter text-amber-500">{totalInboundUnits} <span className="text-sm text-slate-600">PCS</span></p>
          </div>
          <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem] shadow-lg relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Unique Garment Styles Needed</p>
              <p className="text-4xl font-black tracking-tighter text-sky-500">{uniqueStylesNeeded} <span className="text-sm text-slate-600">STYLES</span></p>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* RED COLUMN: TO BUY LIST */}
        <div className="bg-slate-900/40 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col h-[800px] overflow-hidden">
          
          <div className="bg-red-500/10 border-b border-red-500/20 p-6 px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 backdrop-blur-md">
            <h2 className="text-sm font-black text-red-400 uppercase tracking-widest">Needs Ordering</h2>
            
            {/* --- ADDITIVE: BULK/JOB VIEW TOGGLE --- */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                <button 
                    onClick={() => setViewMode("job")} 
                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'job' ? 'bg-red-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    By Job
                </button>
                <button 
                    onClick={() => setViewMode("bulk")} 
                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'bulk' ? 'bg-red-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    Bulk Master PO 🚀
                </button>
            </div>
          </div>
          
          <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50 text-red-500 text-xs font-black uppercase tracking-widest animate-pulse">Syncing Procurement DB...</div>}
            
            {/* --- VIEW MODE: BULK AGGREGATOR --- */}
            {viewMode === "bulk" && (
                <div className="animate-in fade-in space-y-6">
                    {masterBuyList.map((item, idx) => (
                        <div key={idx} className="bg-black border border-white/10 p-6 rounded-2xl shadow-lg relative group hover:border-red-500/30 transition-colors">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500/50 group-hover:bg-red-500 transition-colors"></div>
                            
                            <div className="flex justify-between items-start mb-6 pl-4 border-b border-white/5 pb-4">
                              <div>
                                <div className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-3">
                                  {item.description}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Required For Jobs:</span>
                                  {item.jobs.map((jobNum: string) => (
                                      <span key={jobNum} className="text-[9px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold tracking-widest">#{jobNum}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right bg-white/5 px-5 py-3 rounded-xl border border-white/5 shrink-0">
                                <div className="text-3xl font-black text-red-400 leading-none">{item.total_qty}</div>
                                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Total Pcs</div>
                              </div>
                            </div>

                            <div className="pl-4">
                              <p className="text-[9px] font-black uppercase text-red-500 tracking-widest mb-3">Consolidated Matrix</p>
                              <div className="grid grid-cols-8 gap-1 text-[8px] font-black text-slate-500 uppercase text-center mb-2 tracking-widest bg-white/5 py-2 rounded-lg">
                                <div className="col-span-2 text-left pl-3">Color</div>
                                <div>S</div><div>M</div><div>L</div><div>XL</div><div>2XL</div><div>3XL</div>
                              </div>
                              {Object.entries(item.variants).map(([color, sizes]: any) => (
                                <div key={color} className="grid grid-cols-8 gap-1 text-[11px] font-bold text-center border-b border-white/5 py-2 last:border-0 hover:bg-white/5 transition-colors rounded-lg">
                                  <div className="col-span-2 text-left pl-3 text-blue-400 uppercase tracking-tighter">{color}</div>
                                  <div className={sizes.s > 0 ? "text-white font-black scale-110" : "text-slate-800"}>{sizes.s || '-'}</div>
                                  <div className={sizes.m > 0 ? "text-white font-black scale-110" : "text-slate-800"}>{sizes.m || '-'}</div>
                                  <div className={sizes.l > 0 ? "text-white font-black scale-110" : "text-slate-800"}>{sizes.l || '-'}</div>
                                  <div className={sizes.xl > 0 ? "text-white font-black scale-110" : "text-slate-800"}>{sizes.xl || '-'}</div>
                                  <div className={sizes.xxl > 0 ? "text-white font-black scale-110" : "text-slate-800"}>{sizes.xxl || '-'}</div>
                                  <div className={sizes.xxxl > 0 ? "text-white font-black scale-110" : "text-slate-800"}>{sizes.xxxl || '-'}</div>
                                </div>
                              ))}
                              
                              <div className="mt-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex justify-between items-center">
                                  <span className="text-[10px] font-black uppercase text-red-400 tracking-widest">Bulk PO Instructions</span>
                                  <span className="text-[9px] font-bold text-slate-400">Order from Vendor -&gt; Switch to "By Job" view to mark items as Ordered</span>
                              </div>
                            </div>
                        </div>
                    ))}
                    {masterBuyList.length === 0 && !loading && <div className="text-center text-slate-600 text-xs font-black uppercase mt-20 tracking-widest">All caught up.</div>}
                </div>
            )}

            {/* --- VIEW MODE: STANDARD JOB-BY-JOB --- */}
            {viewMode === "job" && (
                <div className="animate-in fade-in space-y-6">
                    {needsOrdering.map(item => (
                    <div key={item.id} className="bg-black border border-white/10 p-6 rounded-2xl shadow-lg relative group overflow-hidden hover:border-red-500/30 transition-colors">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>
                        
                        <div className="flex justify-between items-start mb-6 pl-4 border-b border-white/5 pb-4">
                        <div>
                            <div className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2">
                            {item.quotes?.customers?.company_name || "Unknown Client"}
                            </div>
                            <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-slate-300 uppercase tracking-widest">{item.description}</span>
                            <span className="text-[9px] px-2.5 py-0.5 rounded border border-red-500/20 bg-red-500/10 text-red-400 font-bold tracking-widest uppercase">Job #{item.quotes?.jobs?.[0]?.job_number}</span>
                            </div>
                        </div>
                        <div className="text-right bg-white/5 px-4 py-2 rounded-xl border border-white/5 shrink-0">
                            <div className="text-2xl font-black text-red-400 leading-none">{item.quantity}</div>
                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Total Pcs</div>
                        </div>
                        </div>
                        
                        <div className="pl-4 mb-6">
                        <div className="grid grid-cols-8 gap-1 text-[8px] font-black text-slate-600 uppercase text-center mb-2 tracking-widest bg-white/5 py-2 rounded-lg">
                            <div className="col-span-2 text-left pl-3">Color</div>
                            <div>S</div><div>M</div><div>L</div><div>XL</div><div>2XL</div><div>3XL</div>
                        </div>
                        {item.quote_item_variants?.map((v: any) => (
                            <div key={v.id} className="grid grid-cols-8 gap-1 text-[11px] font-bold text-center border-b border-white/5 py-2 last:border-0 hover:bg-white/5 transition-colors rounded-lg">
                            <div className="col-span-2 text-left pl-3 text-blue-400 uppercase tracking-tighter">{v.color}</div>
                            <div className={v.s > 0 ? "text-white scale-110" : "text-slate-800"}>{v.s || '-'}</div>
                            <div className={v.m > 0 ? "text-white scale-110" : "text-slate-800"}>{v.m || '-'}</div>
                            <div className={v.l > 0 ? "text-white scale-110" : "text-slate-800"}>{v.l || '-'}</div>
                            <div className={v.xl > 0 ? "text-white scale-110" : "text-slate-800"}>{v.xl || '-'}</div>
                            <div className={v.xxl > 0 ? "text-white scale-110" : "text-slate-800"}>{v.xxl || '-'}</div>
                            <div className={v.xxxl > 0 ? "text-white scale-110" : "text-slate-800"}>{v.xxxl || '-'}</div>
                            </div>
                        ))}
                        </div>

                        <form onSubmit={(e) => handleMarkOrdered(e, item)} className="pl-4">
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div>
                            <label className="block text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">Brand</label>
                            <input name="brand" defaultValue={item.brand || "Gildan"} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-white outline-none focus:border-red-500 transition" />
                            </div>
                            <div>
                            <label className="block text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">Supplier</label>
                            <input name="supplier" defaultValue={item.supplier !== 'TBD' ? item.supplier : ''} placeholder="e.g. SanMar" required className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-white outline-none focus:border-red-500 transition" />
                            </div>
                            <div>
                            <label className="block text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">Tracking / PO #</label>
                            <input name="tracking" placeholder="Optional" className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-white outline-none focus:border-red-500 transition" />
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/30 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg">
                            Log Purchase / Mark Ordered →
                        </button>
                        </form>
                    </div>
                    ))}
                    {needsOrdering.length === 0 && !loading && <div className="text-center text-slate-600 text-xs font-black uppercase mt-20 tracking-widest">All caught up.</div>}
                </div>
            )}
          </div>
        </div>

        {/* AMBER COLUMN: RECEIVING DOCK */}
        <div className="bg-slate-900/40 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col h-[800px] overflow-hidden">
          <div className="bg-amber-500/10 border-b border-amber-500/20 p-6 px-10 flex justify-between items-center backdrop-blur-md shrink-0 h-[89px]">
            <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest">Receiving Dock (In Transit)</h2>
          </div>
          
          <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar relative">
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50 text-amber-500 text-xs font-black uppercase tracking-widest animate-pulse">Scanning Dock...</div>}
            
            {inTransit.map(item => (
              <div key={item.id} className="bg-black border border-amber-500/20 p-6 rounded-2xl shadow-lg relative overflow-hidden group">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-amber-500"></div>
                
                <div className="flex justify-between items-start mb-6 pl-4 border-b border-white/5 pb-4">
                  <div>
                    <div className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2 line-through decoration-amber-500/30 opacity-90">
                      {item.quotes?.customers?.company_name || "Unknown Client"}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-slate-300 uppercase tracking-widest line-through decoration-amber-500/30">{item.description}</span>
                      <span className="text-[9px] px-2.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-400 font-bold tracking-widest uppercase">Job #{item.quotes?.jobs?.[0]?.job_number}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-amber-400 leading-none">{item.quantity}</div>
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Total Pcs</div>
                  </div>
                </div>
                
                <div className="pl-4 grid grid-cols-3 gap-4 mb-6 border-b border-white/5 pb-6">
                  <div>
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Brand</div>
                    <div className="text-xs font-bold text-white mt-1">{item.brand}</div>
                  </div>
                  <div>
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Supplier</div>
                    <div className="text-xs font-bold text-amber-400 mt-1">{item.supplier}</div>
                  </div>
                  <div>
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tracking #</div>
                    <div className="text-xs font-mono text-white mt-1 truncate pr-2">{item.tracking_number || "N/A"}</div>
                  </div>
                </div>

                <div className="pl-4">
                   <button onClick={() => handleMarkReceived(item)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-emerald-900/40">
                     Box Arrived — Mark Received ✓
                   </button>
                </div>
              </div>
            ))}
            {inTransit.length === 0 && !loading && <div className="text-center text-slate-600 text-xs font-black uppercase mt-20 tracking-widest">Dock is empty.</div>}
          </div>
        </div>

      </div>
    </div>
  );
}