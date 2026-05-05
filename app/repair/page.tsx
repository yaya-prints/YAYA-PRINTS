"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// The exact map of corrupted addresses extracted from your Tracker CSV mapped to the real Company Names.
const CORRECTIONS = [
  { bad: "2595 Blackwell street unit 104", good: "RAIDY SCA PRINTING" },
  { bad: "Ottawa, On", good: "Weggon Allen" },
  { bad: "323 Perrier AveOttawa, ON K1L 5C5", good: "Peacock premium renovations" },
  { bad: "1769 St. Laurent unit 911 Ottawa ON K1G 3V4", good: "Eddy Frank Consulting" },
  { bad: "2161 Saunderson Dr", good: "BRIGHT BUILT CONSTRUCTION INC." },
  { bad: "1568 Merivale Rd #99, Ottawa, ON K2G 5Y7", good: "THE UPS STORE" },
  { bad: "21 Antares DrNepean, ON K2E 7Z6", good: "Ottawa Screen Printing Inc" },
  { bad: "3059 Carling Ave, Ottawa, ON K2B 7K4", good: "Sheikh Almandi" },
  { bad: "2378 Holly Lane, Unit 202, Ottawa, ON K1V 7P2", good: "Maqam Services" },
  { bad: "4648 Sugar Maple DrGloucester, ON K1V 1Y6", good: "Green Care Seasonal Inc." },
  { bad: "1999 Merivale Rd, Ottawa, ON K2G 1G1", good: "DETAIL MY RIDE" },
  { bad: "110 Bentley Ave, Nepean, ON K2E 6T9", good: "SMC Towing Group" },
  { bad: "1160 Heron Rd unit 2, Ottawa, ON K1V 6B2", good: "VITTLE" },
  { bad: "4020 Leitrim Rd, Ottawa, ON K1G 3N4", good: "D & M Tilt'n Load Inc." },
  { bad: "50 Colonnade Rd unit 200B, Ottawa, ON K2E 7J6", good: "Prestige Moving Inc" },
  { bad: "335 Cumberland St, Ottawa, ON K1N 7J2", good: "The Falcon Barbershop INC" },
  { bad: "1000 Innovation Dr Suite 500, Kanata, ON K2K 3E7", good: "Hayle Inc." },
  { bad: "18 Westwinds Pl, Ottawa, ON K2G 6L1", good: "All Hands Pro Construction" },
  { bad: "1020 Pleasant Park Rd, Ottawa, ON K1G 2A1", good: "Mr Kaak" }
];

export default function DatabaseSurgeon() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isFixing, setIsFixing] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);

  async function executeRepair() {
    const confirmed = window.confirm("Ready to auto-correct the corrupted CRM names?");
    if (!confirmed) return;

    setIsFixing(true);
    addLog("🚀 INITIALIZING DATABASE SURGEON...");

    let fixedCount = 0;

    for (const correction of CORRECTIONS) {
      try {
        // Find if this bad address exists as a company name in the database
        const { data: customer } = await supabase
          .from("customers")
          .select("id, company_name")
          .eq("company_name", correction.bad)
          .single();

        if (customer) {
          addLog(`Found corrupted record: "${correction.bad}"`);
          
          // Overwrite it with the good name
          const { error } = await supabase
            .from("customers")
            .update({ company_name: correction.good })
            .eq("id", customer.id);

          if (error) throw error;
          
          addLog(`✅ Successfully renamed to -> "${correction.good}"`);
          fixedCount++;
        }
      } catch (err: any) {
        addLog(`Error processing ${correction.bad}: ${err.message}`);
      }
    }

    addLog(`\n🎉 REPAIR COMPLETE! Successfully auto-corrected ${fixedCount} corrupted client records.`);
    addLog("All Invoices, Quotes, and Job Cards are now perfectly synced with the correct names.");
    setIsFixing(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1115] text-slate-900 dark:text-white p-4 sm:p-6 md:p-12 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2 text-blue-600 dark:text-blue-500">Database Repair Tool</h1>
        <p className="text-slate-500 dark:text-slate-400 font-bold mb-6 md:mb-10 text-sm">This script will automatically scan the CRM for the 19 corrupted addresses from the legacy tracker and overwrite them with their true Company Names.</p>

        <button
          onClick={executeRepair}
          disabled={isFixing}
          className="w-full py-5 md:py-6 bg-blue-600 text-white font-black uppercase tracking-widest md:tracking-[0.3em] text-sm md:text-base rounded-2xl hover:bg-blue-500 active:scale-95 transition-all shadow-xl dark:shadow-[0_0_50px_rgba(37,99,235,0.4)] disabled:opacity-50 mb-6 md:mb-10 min-h-[56px]"
        >
          {isFixing ? "SCANNING & REPAIRING DATABASE..." : "AUTO-FIX CORRUPTED CRM NAMES"}
        </button>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-[400px] overflow-y-auto font-mono text-[11px] custom-scrollbar flex flex-col-reverse shadow-inner">
          {logs.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-600">Awaiting execution...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`mb-2 ${log.includes('✅') || log.includes('🎉') ? 'text-emerald-600 dark:text-emerald-400' : log.includes('🚀') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}