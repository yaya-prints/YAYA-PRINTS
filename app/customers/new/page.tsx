"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function NewCustomer() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function saveCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    await supabase.from("customers").insert([
      {
        company_name: formData.get("company_name"),
        contact_name: formData.get("contact_name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        address: formData.get("address"),
        lead_source: formData.get("lead_source"),
        website: formData.get("website"),
        date_found: formData.get("date_found"),
      }
    ]);

    router.push("/customers");
    router.refresh();
  }

  return (
    <div className="p-4 md:p-10 max-w-2xl mx-auto min-h-screen font-sans">
      
      <div className="mb-10 border-b border-white/10 pb-6 mt-4">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic leading-none text-white">Add New Client</h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4 ml-1">Establish New Relationship Profile</p>
      </div>
      
      <form onSubmit={saveCustomer} className="bg-slate-900/50 rounded-[2rem] shadow-2xl border border-white/5 p-6 md:p-10 flex flex-col gap-6">
        
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Company Name *</label>
          <input required name="company_name" type="text" className="w-full bg-black border border-slate-800 text-white font-bold rounded-2xl p-4 focus:border-blue-500 focus:outline-none transition-colors" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Contact Person</label>
            <input name="contact_name" type="text" className="w-full bg-black border border-slate-800 text-white font-bold rounded-2xl p-4 focus:border-blue-500 focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Phone</label>
            <input name="phone" type="text" className="w-full bg-black border border-slate-800 text-white font-bold rounded-2xl p-4 focus:border-blue-500 focus:outline-none transition-colors" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Email</label>
            <input name="email" type="email" className="w-full bg-black border border-slate-800 text-white font-bold rounded-2xl p-4 focus:border-blue-500 focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Website</label>
            <input name="website" type="text" placeholder="www.example.com" className="w-full bg-black border border-slate-800 text-white placeholder-slate-700 font-bold rounded-2xl p-4 focus:border-blue-500 focus:outline-none transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Full Address</label>
          <textarea name="address" rows={2} className="w-full bg-black border border-slate-800 text-white placeholder-slate-700 font-bold rounded-2xl p-4 focus:border-blue-500 focus:outline-none transition-colors" placeholder="123 Print Street, City, State, Zip"></textarea>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Lead Source</label>
            <select name="lead_source" className="w-full bg-black border border-slate-800 text-white font-bold rounded-2xl p-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none cursor-pointer">
              <option value="">Select...</option>
              <option value="Google Search">Google Search</option>
              <option value="Referral / Word of Mouth">Referral / Word of Mouth</option>
              <option value="Social Media">Social Media (Instagram/Facebook)</option>
              <option value="Walk-in">Walk-in</option>
              <option value="D2D">D2D</option>
              <option value="Website">Website</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">Date Found</label>
            <input name="date_found" type="date" defaultValue={today} className="w-full bg-black border border-slate-800 text-white font-bold rounded-2xl p-4 focus:border-blue-500 focus:outline-none transition-colors" />
          </div>
        </div>

        <button disabled={loading} type="submit" className="mt-8 bg-blue-600 text-white text-xs font-black uppercase tracking-[0.3em] py-5 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] disabled:opacity-50">
          {loading ? "Decrypting..." : "Create Client Profile →"}
        </button>
        
      </form>
    </div>
  );
}