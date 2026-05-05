"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function PublicRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    // 1. Create the Customer First
    const { data: customer, error: cError } = await supabase
      .from("customers")
      .insert([{
        company_name: formData.get("company_name"),
        contact_name: formData.get("contact_name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        lead_source: "Web Request"
      }])
      .select()
      .single();

    if (customer) {
      // 2. Create the Draft Quote
      await supabase.from("quotes").insert([{
        customer_id: customer.id,
        status: "Draft",
        total_amount: 0 // To be filled by you later
      }]);
    }

    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="text-6xl mb-6">🚀</div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">Request Received.</h1>
          <p className="text-slate-400 font-medium">The team at YAYA PRINTS is reviewing your specs. We'll be in touch shortly to finalize your quote.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl mt-6 sm:mt-12">
        <div className="mb-6 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter italic border-l-4 sm:border-l-8 border-blue-600 pl-4 sm:pl-6">
            Get a Quote
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-3 sm:mt-4 ml-5 sm:ml-8">
            Custom Printing & Branding — YAYA PRINTS
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900/50 border border-white/5 p-5 sm:p-7 md:p-10 rounded-2xl sm:rounded-3xl shadow-2xl space-y-5 sm:space-y-8">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
            <div>
              <label className="block text-[11px] sm:text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Company / Brand Name</label>
              <input required name="company_name" type="text" placeholder="e.g. YAYA Sports" className="w-full bg-black border border-slate-800 p-4 rounded-xl text-white text-base focus:border-blue-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-[11px] sm:text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Your Name</label>
              <input required name="contact_name" type="text" placeholder="John Doe" className="w-full bg-black border border-slate-800 p-4 rounded-xl text-white text-base focus:border-blue-600 outline-none transition" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
            <div>
              <label className="block text-[11px] sm:text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Email Address</label>
              <input required name="email" type="email" inputMode="email" autoComplete="email" placeholder="john@example.com" className="w-full bg-black border border-slate-800 p-4 rounded-xl text-white text-base focus:border-blue-600 outline-none transition" />
            </div>
            <div>
              <label className="block text-[11px] sm:text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Phone Number</label>
              <input required name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="613-000-0000" className="w-full bg-black border border-slate-800 p-4 rounded-xl text-white text-base focus:border-blue-600 outline-none transition" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] sm:text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">What are we making? (Items, Qty, Details)</label>
            <textarea required name="details" rows={4} placeholder="e.g. 50x Black Hoodies with gold logo on chest..." className="w-full bg-black border border-slate-800 p-4 rounded-xl text-white text-base focus:border-blue-600 outline-none transition italic"></textarea>
          </div>

          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 sm:py-5 rounded-2xl font-black uppercase tracking-tighter text-base sm:text-lg shadow-xl shadow-blue-900/20 transition-all active:scale-95 min-h-[56px]">
            {loading ? "Sending..." : "Submit Quote Request →"}
          </button>
        </form>
      </div>
    </div>
  );
}