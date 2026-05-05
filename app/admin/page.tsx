"use client";

import { useState } from "react";

export default function AdminGateway() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // YOUR MASTER STAFF PASSWORD
    const MASTER_PASSWORD = "YAYA";

    if (passcode === MASTER_PASSWORD) {
      // Set the secure cookie that the Middleware bouncer is looking for
      document.cookie = `yaya_master_key=true; path=/; max-age=2592000; SameSite=Lax`; // Expires in 30 days
      
      // Redirect to the internal OS (To-Do List)
      window.location.href = "/todos";
    } else {
      setError("Unauthorized. Invalid Master Key.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex items-center justify-center p-4 selection:bg-sky-500">
      <div className="w-full max-w-md bg-[#0f1115] border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        
        {/* Security Aesthetics */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sky-500 to-transparent opacity-50"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="text-center mb-10 relative z-10">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-6 shadow-inner">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic leading-none mb-2">YAYA <span className="text-sky-500">OS</span></h1>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Internal Command Center</p>
        </div>

        <form onSubmit={handleAdminLogin} className="flex flex-col gap-6 relative z-10">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest block mb-2 text-slate-400 text-center">Enter Master Key</label>
            <input 
              type="password" 
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full rounded-2xl px-5 py-4 text-center text-2xl tracking-[0.5em] font-black outline-none transition-colors shadow-inner border bg-black border-slate-800 text-white focus:border-sky-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-widest p-3 rounded-xl text-center animate-in fade-in">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading || !passcode}
            className={`w-full mt-2 py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(14,165,233,0.2)] hover:shadow-[0_0_30px_rgba(14,165,233,0.4)] ${isLoading || !passcode ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white'}`}
          >
            {isLoading ? 'Decrypting...' : 'Initialize OS →'}
          </button>
        </form>

        <div className="mt-8 text-center relative z-10 border-t border-white/5 pt-6">
           <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">
             Restricted Access. Unauthorized entry attempts are logged and monitored.
           </p>
        </div>
      </div>
    </div>
  );
}