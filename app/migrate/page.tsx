"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function JsonMigrationEngine() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm("Ready to inject orders.json into your live Database?");
    if (!confirmed) return;

    setIsInjecting(true);
    addLog("📁 JSON File loaded. Verifying data structure...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        
        if (!Array.isArray(data)) throw new Error("JSON is not an array of orders.");
        
        setTotalOrders(data.length);
        addLog(`🎯 Successfully validated ${data.length} clean historical orders from JSON.`);
        
        await processJsonOrders(data);
      } catch (err: any) {
        addLog(`❌ FATAL ERROR reading JSON: ${err.message}`);
        setIsInjecting(false);
      }
    };
    reader.readAsText(file);
  };

  async function processJsonOrders(orders: any[]) {
    let count = 0;

    for (const order of orders) {
      try {
        const jobNum = order.job_number || 0;
        const clientName = order.client_name || "Unknown Client";
        const dbDate = order.date || new Date().toISOString().split('T')[0];

        // Status mapping from JSON to Database standard
        let dbStatus = "Unpaid";
        let dbStage = order.stage || "Printing";
        if (order.status === "Fully Paid") { dbStatus = "Paid in Full"; dbStage = "Paid"; }
        else if (order.status === "Part-Paid") { dbStatus = "Partial"; dbStage = "Finishing"; }

        const totalAmount = parseFloat(order.total_amount) || 0;
        const amountPaid = parseFloat(order.amount_paid) || 0;

        addLog(`⏳ Injecting: Job #${jobNum} - ${clientName}`);

        // 1. Create or Find Customer
        let customerId;
        const { data: existingCust } = await supabase.from("customers").select("id").eq("company_name", clientName).single();
        if (existingCust) {
          customerId = existingCust.id;
        } else {
          const { data: newCust, error: custErr } = await supabase.from("customers").insert([{
            company_name: clientName,
            email: order.email || `${clientName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@legacy.com`
          }]).select().single();
          if (custErr) throw custErr;
          customerId = newCust.id;
        }

        // 2. Create the Quote (Financial Ledger)
        const { data: quote, error: quoteErr } = await supabase.from("quotes").insert([{
          customer_id: customerId,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          payment_status: dbStatus,
          status: "Approved",
          created_at: new Date(dbDate).toISOString()
        }]).select().single();
        if (quoteErr) throw quoteErr;

        // 3. Inject Items and Variants
        let totalItemsQty = 0;
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            const qty = parseInt(item.qty) || 0;
            if (qty === 0) continue;
            totalItemsQty += qty;

            // Insert Item
            const { data: qItem, error: itemErr } = await supabase.from("quote_items").insert([{
              quote_id: quote.id,
              description: item.desc,
              quantity: qty,
              unit_price: parseFloat(item.price) || 0,
              garment_status: dbStage === "Paid" ? "Received" : "Ordered / In Transit",
              brand: "Gildan"
            }]).select().single();
            if (itemErr) throw itemErr;

            // Insert Variants
            if (item.variants && Array.isArray(item.variants)) {
              for (const v of item.variants) {
                await supabase.from("quote_item_variants").insert([{
                  quote_item_id: qItem.id,
                  color: v.color || "Standard",
                  unit_price: parseFloat(item.price) || 0,
                  s: v.s || 0, m: v.m || 0, l: v.l || 0, xl: v.xl || 0, xxl: v.xxl || 0, xxxl: v.xxxl || 0
                }]);
              }
            }
          }
        }

        // 4. Create Job Card
        await supabase.from("jobs").insert([{
          quote_id: quote.id,
          job_number: jobNum,
          title: `${totalItemsQty}x MULTI-ITEM ORDER`,
          stage: dbStage,
          due_date: new Date(dbDate).toISOString().split('T')[0]
        }]);

        count++;
        setProgress(count);

      } catch (err: any) {
        addLog(`❌ ERROR on Job #${order.job_number}: ${err.message}`);
      }
    }

    addLog("✅ ALL ORDERS SUCCESSFULLY MIGRATED TO THE NEW SYSTEM.");
    setIsInjecting(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1115] text-slate-900 dark:text-white p-6 md:p-12 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 text-emerald-600 dark:text-emerald-500">JSON Data Importer</h1>
        <p className="text-slate-500 dark:text-slate-400 font-bold mb-10 text-sm">Upload the <b>orders.json</b> file. This guarantees 100% data integrity.</p>

        <div className="w-full relative border-2 border-dashed border-emerald-400 dark:border-emerald-500/50 rounded-[2rem] p-10 bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all text-center mb-10 shadow-sm">
           <input 
             type="file" 
             accept=".json"
             disabled={isInjecting}
             onChange={handleFileUpload}
             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
           />
           <div className="text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest text-lg">
             {isInjecting ? "Injecting Clean JSON Data..." : "Click or Drag orders.json Here"}
           </div>
        </div>

        {totalOrders > 0 && (
          <div className="mb-10">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              <span>Migration Progress</span>
              <span>{progress} / {totalOrders} Orders Injected</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-300 dark:border-white/5">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${(progress / totalOrders) * 100}%` }}></div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-[400px] overflow-y-auto font-mono text-[10px] custom-scrollbar flex flex-col-reverse shadow-inner">
          {logs.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-600">Awaiting file upload...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`mb-2 ${log.includes('✅') || log.includes('🎯') ? 'text-emerald-600 dark:text-emerald-400' : log.includes('❌') ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}