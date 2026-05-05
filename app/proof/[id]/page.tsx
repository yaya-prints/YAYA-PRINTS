"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function ClientProofPortal() {
  const params = useParams();
  const proofId = params.id as string;

  const [jobData, setJobData] = useState<any>(null);
  const [mockups, setMockups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    async function loadJobData() {
      if (!proofId) return;
      setLoading(true);
      // Fetch the job using the unique proof_link_id. We pull design_proof which contains the JSON array.
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          id, 
          title, 
          stage, 
          design_proof,
          front_view, 
          back_view,
          quotes (
            customers (company_name)
          )
        `)
        .eq("proof_link_id", proofId)
        .single();

      if (data) {
        setJobData(data);
        if (data.stage === "Approved" || data.stage === "In Production") {
          setIsApproved(true);
        }

        // Safely parse the JSON array of mockups
        let parsedMockups: { title: string; url: string }[] = [];
        try {
            parsedMockups = JSON.parse(data.design_proof || "[]");
        } catch(e) {
            // Fallback for old single-URL string records
            if (data.design_proof && data.design_proof.startsWith("http")) {
                parsedMockups = [{ title: "Design Proof", url: data.design_proof }];
            }
        }

        // Final fallback just in case JSON parsing failed but old columns exist
        if (parsedMockups.length === 0) {
            if (data.front_view) parsedMockups.push({ title: "Front View", url: data.front_view });
            if (data.back_view) parsedMockups.push({ title: "Back View", url: data.back_view });
        }

        setMockups(parsedMockups);
      }
      setLoading(false);
    }
    loadJobData();
  }, [proofId]);

  const handleApprove = async () => {
    const confirmApprove = window.confirm("Are you sure you want to approve this design for production? Once approved, changes cannot be made.");
    if (!confirmApprove) return;

    setApproving(true);
    try {
      const { error } = await supabase.from("jobs").update({ stage: "Approved" }).eq("id", jobData.id);
      if (error) throw error;
      setIsApproved(true);
    } catch (err: any) {
      alert("Error approving design: " + err.message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-sky-600 tracking-widest uppercase animate-pulse text-sm">
        Loading Presentation...
      </div>
    );
  }

  if (!jobData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-rose-600 tracking-widest uppercase text-sm">
        Invalid or Expired Link
      </div>
    );
  }

  const customerName = jobData.quotes?.customers?.company_name || "Valued Client";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-sky-500 selection:text-white">
      
      {/* Client Header */}
      <div className="border-b border-slate-200 bg-white/90 p-4 md:px-8 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md shadow-sm">
        <h1 className="text-2xl font-black uppercase tracking-tighter leading-none italic text-slate-900">YAYA PRINTS</h1>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Prepared For</div>
          <div className="text-xs font-bold text-slate-800">{customerName}</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-12 pb-32">
        
        {/* Status Banner */}
        {isApproved ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-6 rounded-2xl mb-8 text-center shadow-sm">
                <svg className="w-12 h-12 mx-auto mb-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-1">Design Approved</h2>
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">This order is currently in our production queue.</p>
            </div>
        ) : (
            <div className="mb-10 text-center">
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-3 text-slate-900">Please Review Your Design</h2>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500 max-w-2xl mx-auto">
                    Review the digital mockups below. If everything looks perfect, click approve to send this directly to the shop floor for production.
                </p>
            </div>
        )}

        {/* Dynamic Mockup Display Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mb-12 max-w-5xl mx-auto">
            {mockups.map((mockup: any, idx: number) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xl hover:shadow-2xl hover:border-slate-300 transition-all duration-300">
                    <div className="text-[10px] font-black uppercase tracking-widest text-sky-600 mb-3 text-center">{mockup.title}</div>
                    {/* Removed the dark background class from the image to eliminate pixelation halos */}
                    <img src={mockup.url} alt={mockup.title} className="w-full h-auto rounded-xl" />
                </div>
            ))}
        </div>

        {/* Action Footer */}
        {!isApproved && (
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 border-t border-slate-200 p-4 md:p-6 backdrop-blur-xl z-50 flex justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={handleApprove}
                    disabled={approving}
                    className="w-full max-w-md bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black uppercase text-sm tracking-widest transition-all shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:shadow-[0_10px_25px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1"
                >
                    {approving ? "Processing..." : "Approve & Sign Off"}
                </button>
            </div>
        )}

      </div>
    </div>
  );
}