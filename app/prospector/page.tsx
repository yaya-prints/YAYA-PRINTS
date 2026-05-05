"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function LeadProspector() {
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  
  // --- ADVANCED APOLLO-STYLE FILTERS ---
  const [industryQuery, setIndustryQuery] = useState("");
  const [keywordQuery, setKeywordQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("Ottawa, ON");
  
  const [isSearching, setIsSearching] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [addedLeadIds, setAddedLeadIds] = useState<string[]>([]);
  
  // --- PAGINATION STATE ---
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  // --- PROSPECT DOSSIER STATE ---
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [dossierTab, setDossierTab] = useState<"intel" | "mockup">("intel");
  const [leadNotes, setLeadNotes] = useState("");
  
  // --- PERSONNEL & FOLLOW-UP STATE ---
  const [ownerName, setOwnerName] = useState("");
  const [bestReachTime, setBestReachTime] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");

  // --- MANUAL LOGO OVERRIDE STATE ---
  const [manualLogoUrl, setManualLogoUrl] = useState("");
  const [stolenLogoDataUrl, setStolenLogoDataUrl] = useState<string | null>(null);

  // --- PRE-CRM BATTLE PLAN STATE ---
  const [leadHeat, setLeadHeat] = useState<number>(1);
  const [discussedPrice, setDiscussedPrice] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [painPoints, setPainPoints] = useState({ price: false, quality: false, speed: false, service: false });
  
  // --- DYNAMIC APPAREL MULTI-ITEM BUILDER ---
  const [prospectItems, setProspectItems] = useState<any[]>([
      { description: "", color: "", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, price: "", notes: "" }
  ]);

  // --- THEME SYNC ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    const isLight = savedTheme === 'light';
    setIsLightMode(isLight);
    if (isLight) document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
  }, []);

  // ESC closes prospect dossier
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedProspect) setSelectedProspect(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedProspect]);

  const toggleUniversalTheme = () => {
      const newMode = !isLightMode;
      setIsLightMode(newMode);
      localStorage.setItem('yaya-theme', newMode ? 'light' : 'dark');
      if (newMode) document.documentElement.classList.remove('dark');
      else document.documentElement.classList.add('dark');
      window.dispatchEvent(new Event('themeChange'));
  };

  // --- MULTI-ITEM HELPER FUNCTIONS ---
  const addProspectItem = () => {
      setProspectItems([...prospectItems, { description: "", color: "", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, price: "", notes: "" }]);
  };
  
  const updateProspectItem = (index: number, field: string, value: string | number) => {
      const newItems = [...prospectItems];
      newItems[index][field] = value;
      setProspectItems(newItems);
  };
  
  const removeProspectItem = (index: number) => {
      if (prospectItems.length > 1) {
          const newItems = [...prospectItems];
          newItems.splice(index, 1);
          setProspectItems(newItems);
      }
  };

  // --- LIVE GOOGLE PLACES API "SUPER SEARCH" WITH PAGINATION ---
  const handleSearch = async (e?: React.FormEvent | null, isLoadMore = false) => {
      if (e) e.preventDefault();
      if (!industryQuery || !locationQuery) {
          alert("Industry and Location are required.");
          return;
      }
      
      setIsSearching(true);
      if (!isLoadMore) {
          setLeads([]);
          setNextPageToken(null);
      }

      try {
          const combinedSearch = `${industryQuery} ${keywordQuery}`.trim();
          
          let url = `/api/places?query=${encodeURIComponent(combinedSearch)}&location=${encodeURIComponent(locationQuery)}`;
          if (isLoadMore && nextPageToken) {
              url += `&pagetoken=${nextPageToken}`;
          }

          const response = await fetch(url);
          const data = await response.json();
          
          if (data.leads && data.leads.length > 0) {
              if (isLoadMore) {
                  setLeads(prev => [...prev, ...data.leads]);
              } else {
                  setLeads(data.leads);
              }
              setNextPageToken(data.next_page_token || null);
          } else if (data.leads && data.leads.length === 0 && !isLoadMore) {
              alert("No businesses found matching those exact filters. Try broadening your keywords.");
          } else if (data.error) {
              alert("API Error: " + data.error);
          }
      } catch (error) {
          console.error("Search error:", error);
          alert("An error occurred while scanning the area.");
      } finally {
          setIsSearching(false);
      }
  };

  // --- LIVE HUNTER.IO DEEP SCAN ---
  const handleDeepScan = async (leadId: string, domain: string) => {
      if (!domain) {
          alert("This business has no website listed. Cannot scan for emails.");
          return;
      }

      setScanningId(leadId);

      try {
          const response = await fetch(`/api/hunter?domain=${encodeURIComponent(domain)}`);
          const data = await response.json();

          const updateLead = (lead: any) => lead.id === leadId ? { ...lead, email: data.email || "No public email found", contact_name: data.contact_name || "Manager" } : lead;
          
          setLeads(currentLeads => currentLeads.map(updateLead));
          
          if (selectedProspect && selectedProspect.id === leadId) {
              setSelectedProspect(updateLead(selectedProspect));
          }
      } catch (error) {
          console.error("Scan error:", error);
          alert("Failed to scan domain. Check your Hunter API key.");
      } finally {
          setScanningId(null);
      }
  };

  // --- BULLETPROOF AGGRESSIVE BLOB DOWNLOADER WITH FAILSAFES ---
  const handleDownloadLogo = async (domain: string, companyName: string) => {
      let targetUrl = `https://logo.clearbit.com/${domain}`;
      
      if (manualLogoUrl) {
          targetUrl = manualLogoUrl;
          if (targetUrl.startsWith('//')) {
              targetUrl = `https:${targetUrl}`;
          } else if (targetUrl.startsWith('/')) {
              targetUrl = `https://${domain || 'unknown.com'}${targetUrl}`;
          }
      } else if (!domain) {
          alert("No domain available. Please paste the exact image address in the box.");
          return;
      }

      const fileName = `${(companyName || 'Lead').replace(/[^a-zA-Z0-9]/g, '_').trim()}_Logo.png`;

      const forceDownloadAndCapture = async (urlToFetch: string) => {
          const response = await fetch(urlToFetch);
          if (!response.ok) throw new Error("Fetch failed");
          const blob = await response.blob();
          
          // Trigger Physical Download
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = blobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          
          setTimeout(() => {
              window.URL.revokeObjectURL(blobUrl);
              document.body.removeChild(a);
          }, 100);

          // Convert to DataURL for the bridge to Mockup Engine
          const reader = new FileReader();
          reader.onloadend = () => {
              setStolenLogoDataUrl(reader.result as string);
              setManualLogoUrl(""); 
          };
          reader.readAsDataURL(blob);
      };

      try {
          // Attempt 1: Direct fetch
          await forceDownloadAndCapture(targetUrl);
      } catch (err1) {
          try {
              // Attempt 2: High-tier raw proxy
              await forceDownloadAndCapture(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
          } catch (err2) {
              try {
                  // Attempt 3: Alternative proxy
                  await forceDownloadAndCapture(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
              } catch (err3) {
                  // Total failure: Open in new tab so user can manually save
                  alert("Highly restrictive firewall detected (e.g. Wix). Opening image in a new tab. Right-click, 'Save Image As', then use the Manual Upload button in the Mockup tab.");
                  window.open(targetUrl, '_blank');
              }
          }
      }
  };

  // --- MANUAL LOGO UPLOAD FALLBACK ---
  const handleManualLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          setStolenLogoDataUrl(reader.result as string);
          setManualLogoUrl(""); // Clear the input box to avoid confusion
      };
      reader.readAsDataURL(file);
  };


  // --- CALL LOGGING ENGINE ---
  const logCallAction = (action: string) => {
      const timestamp = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
      const newLog = `[${timestamp}] ${action}\n`;
      setLeadNotes(prev => prev ? newLog + prev : newLog);
  };

  // --- 1-CLICK CRM SYNC ---
  const handlePushToCRM = async (lead: any) => {
      if (addedLeadIds.includes(lead.id)) return;

      const finalEmail = lead.email && lead.email.includes('@') 
        ? lead.email 
        : `lead_${Math.floor(Math.random() * 10000)}@${lead.domain || "unknown-business.com"}`;

      let totalQty = 0;
      let totalPrice = 0;
      let matrixLog = "Apparel Request Matrix:\n";
      
      prospectItems.forEach(item => {
          const q = (item.xs || 0) + (item.s || 0) + (item.m || 0) + (item.l || 0) + (item.xl || 0) + (item.xxl || 0) + (item.xxxl || 0);
          const p = parseFloat(item.price) || 0;
          
          if (item.description || q > 0) {
              totalQty += q;
              totalPrice += (p * q); 
              
              const sizeLog = ["xs", "s", "m", "l", "xl", "xxl", "xxxl"]
                  .filter(sz => item[sz] > 0)
                  .map(sz => `${sz.toUpperCase()}: ${item[sz]}`)
                  .join(', ');

              const itemNotes = item.notes ? ` (Notes: ${item.notes})` : '';
              matrixLog += `• ${q}x ${item.color} ${item.description} [Sizes: ${sizeLog}] @ $${p.toFixed(2)}/ea${itemNotes}\n`;
          }
      });

      let finalNotes = leadNotes;
      if (followUpDate) {
          finalNotes = `[SCHEDULED FOLLOW-UP: ${followUpDate} @ ${followUpTime || 'Any time'}]\n\n` + finalNotes;
      }

      const finalDiscussedPrice = parseFloat(discussedPrice) > 0 ? parseFloat(discussedPrice) : totalPrice;

      try {
          const { error } = await supabase.from("customers").insert([{
              company_name: lead.company_name,
              contact_name: ownerName || lead.contact_name || "Manager",
              email: finalEmail,
              phone: lead.phone || "",
              portal_pin: Math.floor(1000 + Math.random() * 9000).toString(),
              lead_status: "Cold Lead",
              vip_tier: "Standard",
              discount_percent: 0,
              brand_vault_url: "",
              owner_name: ownerName,
              best_reach_time: bestReachTime,
              interest_notes: finalNotes,
              uniforms_history: matrixLog,
              potential_quantity: totalQty,
              discussed_price: finalDiscussedPrice,
              estimated_cost: parseFloat(estimatedCost) || 0,
              lead_heat: leadHeat,
              pain_price: painPoints.price,
              pain_quality: painPoints.quality,
              pain_speed: painPoints.speed,
              pain_service: painPoints.service
          }]);

          if (error) throw error;
          
          setAddedLeadIds([...addedLeadIds, lead.id]);
          alert(`Success! ${lead.company_name} is now in your CRM Pipeline with a projected value of $${finalDiscussedPrice.toFixed(2)}.`);
          setSelectedProspect(null); 
      } catch (err: any) {
          console.error("Error pushing to CRM:", err);
          alert(`Failed to push lead: ${err.message || "Database rejected entry."}`);
      }
  };

  const theme = {
      bgMain: isLightMode ? "bg-slate-50" : "bg-[#0f1115]",
      textMain: isLightMode ? "text-slate-900" : "text-slate-200",
      bgPanel: isLightMode ? "bg-white" : "bg-slate-950",
      bgSubPanel: isLightMode ? "bg-slate-50" : "bg-slate-900/50",
      border: isLightMode ? "border-slate-200" : "border-slate-800",
      textMuted: isLightMode ? "text-slate-500" : "text-[#686a6c]",
      textStrong: isLightMode ? "text-slate-900" : "text-white",
      inputBg: isLightMode ? "bg-white border-slate-300 text-slate-900 focus:border-fuchsia-500" : "bg-black border-slate-700 text-white focus:border-fuchsia-500",
  };

  return (
    <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans flex flex-col selection:bg-fuchsia-500 selection:text-white pb-20 transition-colors duration-300 overflow-x-hidden`}>
      
      {/* HEADER */}
      <div className={`border-b ${theme.border} ${theme.bgPanel} p-4 md:px-8 flex flex-col md:flex-row gap-4 justify-between items-center z-40 sticky top-0 shadow-sm transition-colors duration-300`}>
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className={`text-2xl font-black uppercase tracking-tighter leading-none italic ${theme.textStrong}`}>YAYA <span className="text-fuchsia-500">PROSPECTOR</span></h1>
            <span className={`text-[9px] font-black ${theme.textMuted} uppercase tracking-widest`}>Lead Generation Engine</span>
          </div>
          <button onClick={toggleUniversalTheme} className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-widest transition-colors ml-4 ${isLightMode ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
              {isLightMode ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
        
        <div className="flex items-center gap-3">
            <Link href="/customers" className={`px-4 py-2.5 rounded-lg text-[11px] sm:text-[9px] font-black uppercase tracking-widest border transition-colors min-h-[40px] sm:min-h-0 active:scale-95 ${isLightMode ? 'bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100' : 'bg-sky-900/20 border-sky-800 text-sky-400 hover:bg-sky-900/40'}`}>
                Open CRM
            </Link>
        </div>
      </div>

      <div className="flex-grow max-w-[1600px] w-full mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">
          
          {/* --- APOLLO-STYLE LEFT SIDEBAR FILTERS --- */}
          <div className={`w-full lg:w-80 shrink-0 flex flex-col gap-4 sticky top-[90px] h-fit`}>
              <div className={`${theme.bgPanel} border ${theme.border} rounded-2xl p-5 shadow-xl`}>
                  <div className="flex justify-between items-center mb-6">
                      <h2 className={`text-sm font-black uppercase tracking-widest ${theme.textStrong}`}>Find Prospects</h2>
                      <button onClick={() => {setIndustryQuery(""); setKeywordQuery("");}} className={`text-[9px] font-bold uppercase hover:text-fuchsia-500 ${theme.textMuted}`}>Clear All</button>
                  </div>

                  <form onSubmit={(e) => handleSearch(e, false)} className="flex flex-col gap-5">
                      
                      <div>
                          <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Industry / Niche <span className="text-red-500">*</span></label>
                          <div className="relative">
                              <span className="absolute left-3 top-2.5 text-slate-400">🏢</span>
                              <input 
                                  type="text" required value={industryQuery} onChange={e => setIndustryQuery(e.target.value)}
                                  placeholder="e.g. Construction..." 
                                  className={`w-full rounded-xl pl-10 pr-4 py-3 text-xs font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} 
                              />
                          </div>
                      </div>

                      <div>
                          <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 ${theme.textMuted}`}>Location <span className="text-red-500">*</span></label>
                          <div className="relative">
                              <span className="absolute left-3 top-2.5 text-slate-400">📍</span>
                              <input 
                                  type="text" required value={locationQuery} onChange={e => setLocationQuery(e.target.value)}
                                  placeholder="e.g. Ottawa, ON" 
                                  className={`w-full rounded-xl pl-10 pr-4 py-3 text-xs font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} 
                              />
                          </div>
                      </div>

                      <div>
                          <label className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Keywords</label>
                          <p className="text-[8px] font-bold text-slate-500 mb-2">Forces results to include specific services.</p>
                          <div className="relative">
                              <span className="absolute left-3 top-2.5 text-slate-400">🔑</span>
                              <input 
                                  type="text" value={keywordQuery} onChange={e => setKeywordQuery(e.target.value)}
                                  placeholder="e.g. Commercial, Roofing..." 
                                  className={`w-full rounded-xl pl-10 pr-4 py-3 text-xs font-bold outline-none transition-colors shadow-inner border ${theme.inputBg}`} 
                              />
                          </div>
                      </div>

                      <button type="submit" disabled={isSearching} className={`w-full mt-4 py-4 rounded-xl text-[12px] md:text-[10px] font-black uppercase tracking-widest transition-all min-h-[52px] active:scale-95 ${isSearching ? 'bg-slate-500 text-white cursor-wait border-none' : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(217,70,239,0.3)]'}`}>
                          {isSearching ? 'Scanning Network...' : 'Search Prospects'}
                      </button>
                  </form>
              </div>
          </div>

          {/* --- RIGHT SIDE: RESULTS GRID --- */}
          <div className="flex-1 flex flex-col gap-4">
              
              <div className={`p-4 border-b border-inherit flex justify-between items-center ${theme.textStrong}`}>
                  <h2 className="text-sm font-black uppercase tracking-widest">
                      {leads.length > 0 ? `Found ${leads.length} Target Prospects` : 'Awaiting Search Parameters'}
                  </h2>
              </div>

              {leads.length === 0 && !isSearching && (
                  <div className={`flex flex-col items-center justify-center p-20 text-center border-2 border-dashed rounded-[2rem] ${theme.border} ${theme.bgPanel}`}>
                      <span className="text-4xl mb-4 opacity-50">🎯</span>
                      <h3 className={`text-lg font-black uppercase tracking-widest ${theme.textMuted}`}>Ready to Prospect</h3>
                      <p className={`text-xs font-bold mt-2 ${theme.textMuted}`}>Enter your target niche and location in the sidebar to begin.</p>
                  </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {leads.map((lead, index) => {
                      const isAdded = addedLeadIds.includes(lead.id);
                      const hasScanned = !!lead.email;
                      const isScanning = scanningId === lead.id;
                      
                      return (
                          <div 
                              key={lead.id} 
                              onClick={() => {
                                  setSelectedProspect(lead);
                                  setDossierTab("intel");
                                  setLeadNotes(""); 
                                  setOwnerName(lead.contact_name || "");
                                  setBestReachTime("");
                                  setFollowUpDate("");
                                  setFollowUpTime("");
                                  setManualLogoUrl("");
                                  setStolenLogoDataUrl(null);
                                  setLeadHeat(1);
                                  setDiscussedPrice("");
                                  setEstimatedCost("");
                                  setPainPoints({ price: false, quality: false, speed: false, service: false });
                                  setProspectItems([{ description: "", color: "", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, price: "", notes: "" }]);
                              }}
                              className={`${theme.bgPanel} border ${isAdded ? 'border-emerald-500/50 bg-emerald-500/5' : theme.border} rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all flex flex-col h-full animate-in fade-in zoom-in-95 group cursor-pointer hover:border-fuchsia-500/50`}
                          >
                              
                              <div className="flex justify-between items-start mb-4 gap-3">
                                  <div className="flex items-center gap-3 w-full overflow-hidden">
                                      
                                      {/* SEQUENTIAL NUMBERING & GHOST LAYER IMAGE */}
                                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
                                          <span className="text-xl font-black text-slate-300 absolute z-0">{index + 1}</span>
                                          {lead.domain && (
                                              <img 
                                                  src={`https://logo.clearbit.com/${lead.domain}`} 
                                                  alt={`${lead.company_name} logo`}
                                                  className="w-full h-full object-contain p-1 relative z-10 bg-white transition-opacity duration-300"
                                                  onError={(e) => { e.currentTarget.style.opacity = '0'; }}
                                              />
                                          )}
                                      </div>
                                      
                                      <div className="flex flex-col min-w-0">
                                          <h3 className={`text-sm font-black uppercase tracking-tight truncate group-hover:text-fuchsia-500 transition-colors ${theme.textStrong}`} title={lead.company_name}>{lead.company_name}</h3>
                                          <p className={`text-[9px] font-bold uppercase truncate ${theme.textMuted}`}>📍 {lead.formatted_address}</p>
                                      </div>
                                  </div>
                                  
                                  {isAdded ? (
                                      <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">In CRM</span>
                                  ) : (
                                      <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-slate-500/10 text-slate-500 border border-slate-500/30">Net New</span>
                                  )}
                              </div>

                              <div className="flex gap-2 mb-4">
                                  <div className={`flex-1 p-2 rounded-lg border flex flex-col justify-center pl-3 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-slate-800'}`}>
                                      <span className={`text-[8px] font-black uppercase ${theme.textMuted}`}>Direct Line</span>
                                      <span className={`text-[10px] font-bold truncate mt-0.5 ${theme.textStrong}`}>{lead.phone || "--"}</span>
                                  </div>
                                  <a 
                                      href={`https://maps.google.com/?q=${encodeURIComponent(lead.company_name + ' ' + lead.formatted_address)}`}
                                      target="_blank" rel="noopener noreferrer"
                                      onClick={(e) => { e.stopPropagation(); logCallAction(`⭐ Checked Google Reviews from Grid`); }}
                                      className={`flex-[1.5] p-2 rounded-lg border flex flex-col justify-center items-center hover:border-amber-500 transition-colors group/maps ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-slate-800'}`}
                                  >
                                      <span className={`text-[8px] font-black uppercase ${theme.textMuted} group-hover/maps:text-amber-500 transition-colors flex items-center gap-1`}>
                                          Google Rating
                                      </span>
                                      <span className="text-[11px] font-black text-amber-500 mt-0.5 flex items-center gap-1">
                                          ⭐ {lead.rating !== undefined ? `${lead.rating} (${lead.user_ratings_total || 0} Reviews)` : "No Reviews"} ↗
                                      </span>
                                  </a>
                              </div>
                              
                              <div className="flex-grow flex flex-col justify-end">
                                  {hasScanned ? (
                                      <div className={`flex flex-col gap-1 p-3 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 mb-4`}>
                                          <div className="flex items-center gap-2 text-[10px] font-bold text-fuchsia-500 truncate">
                                              <span className="text-xs">✉️</span> {lead.email}
                                          </div>
                                          <div className={`flex items-center gap-2 text-[10px] font-bold truncate ${theme.textStrong}`}>
                                              <span className="text-xs">👤</span> {lead.contact_name}
                                          </div>
                                      </div>
                                  ) : (
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); handleDeepScan(lead.id, lead.domain); }}
                                          disabled={isScanning || !lead.domain}
                                          className={`w-full py-2.5 mb-4 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-colors ${isScanning ? 'bg-fuchsia-500/20 text-fuchsia-500 border-fuchsia-500/30 cursor-wait' : !lead.domain ? 'bg-slate-100 dark:bg-slate-900 border-transparent text-slate-400 cursor-not-allowed' : 'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/30 hover:bg-fuchsia-500 hover:text-white'}`}
                                      >
                                          {isScanning ? 'Decrypting Contact...' : '🔍 Extract Contact Info'}
                                      </button>
                                  )}

                                  <div className="flex gap-2">
                                      <button 
                                          onClick={(e) => { 
                                              e.stopPropagation(); 
                                              setSelectedProspect(lead); 
                                              setDossierTab("intel");
                                              setLeadNotes(""); 
                                              setOwnerName(lead.contact_name || "");
                                              setBestReachTime("");
                                              setFollowUpDate("");
                                              setFollowUpTime("");
                                              setManualLogoUrl("");
                                              setStolenLogoDataUrl(null);
                                              setLeadHeat(1);
                                              setDiscussedPrice("");
                                              setEstimatedCost("");
                                              setPainPoints({ price: false, quality: false, speed: false, service: false });
                                              setProspectItems([{ description: "", color: "", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0, price: "", notes: "" }]); 
                                          }}
                                          className={`flex-[2] py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-inherit ${isLightMode ? 'bg-white hover:bg-slate-50 text-slate-900' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md'}`}
                                      >
                                          Open Dossier →
                                      </button>
                                      {lead.website && (
                                          <a 
                                              href={lead.website} target="_blank" rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()} 
                                              className={`flex-1 flex items-center justify-center py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-transparent border-slate-700 text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                              title="Open Website"
                                          >
                                              ↗ Site
                                          </a>
                                      )}
                                  </div>
                              </div>
                          </div>
                      )
                  })}
              </div>
              
              {/* PAGINATION COMPONENT */}
              {nextPageToken && !isSearching && (
                  <button 
                      onClick={() => handleSearch(null, true)}
                      className={`w-full mt-4 py-4 rounded-2xl border-2 border-dashed font-black uppercase text-[10px] tracking-[0.2em] transition-all hover:-translate-y-1 hover:shadow-lg ${isLightMode ? 'border-fuchsia-300 text-fuchsia-600 hover:bg-fuchsia-50 hover:border-fuchsia-400' : 'border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/50'}`}
                  >
                      Load Next 20 Prospects ↓
                  </button>
              )}
              {isSearching && leads.length > 0 && (
                  <div className="w-full mt-4 py-4 rounded-2xl text-center font-black uppercase text-[10px] tracking-[0.2em] text-fuchsia-500 animate-pulse">
                      Retrieving More Data...
                  </div>
              )}

          </div>
      </div>

      {/* ============================================================================ */}
      {/* 💎 FULL-SCREEN PROSPECT DOSSIER (SLIDE-OUT WIDESCREEN) */}
      {/* ============================================================================ */}
      {selectedProspect && (
          <div className="fixed inset-0 z-[100] flex justify-end">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedProspect(null)}></div>
              
              <div className={`relative w-full max-w-[1400px] h-full ${theme.bgPanel} border-l ${theme.border} shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar`}>
                  
                  <div className={`p-8 border-b ${theme.border} shrink-0 relative overflow-hidden bg-black/5 dark:bg-white/5`}>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                      
                      <div className="flex justify-between items-start mb-6 relative z-10">
                          <div className="pr-8 flex gap-4 items-center">
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
                                  <span className="text-2xl absolute z-0">🏢</span>
                                  {selectedProspect.domain && (
                                      <img 
                                          src={`https://logo.clearbit.com/${selectedProspect.domain}`} 
                                          alt="logo"
                                          className="w-full h-full object-contain p-2 relative z-10 bg-white transition-opacity duration-300"
                                          onError={(e) => { e.currentTarget.style.opacity = '0'; }}
                                      />
                                  )}
                              </div>
                              <div>
                                  <h2 className={`text-3xl font-black uppercase italic tracking-tighter leading-none mb-2 ${theme.textStrong}`}>{selectedProspect.company_name}</h2>
                                  <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>📍 {selectedProspect.formatted_address}</p>
                              </div>
                          </div>
                          <button onClick={() => setSelectedProspect(null)} className={`shrink-0 text-[10px] font-black uppercase tracking-[0.3em] transition-colors px-3 py-2 rounded-lg border ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'}`}>Close ✕</button>
                      </div>

                      {/* ACTION HUD WITH AUTO-LOGGING & QUICK LINKS */}
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10 mb-4">
                          <a href={`tel:${selectedProspect.phone}`} onClick={() => logCallAction(`🟢 📞 Dialed Mobile: ${selectedProspect.phone || 'No Number'}`)} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-slate-200 hover:border-emerald-500' : 'bg-black border-slate-800 hover:border-emerald-500'}`}>
                             <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">📞</div>
                             <div className="min-w-0">
                               <p className="text-[8px] font-black uppercase opacity-50">Dial</p>
                               <p className={`text-sm font-black truncate ${theme.textStrong}`}>{selectedProspect.phone || "No Phone"}</p>
                             </div>
                          </a>
                          
                          {selectedProspect.email ? (
                              <a href={`mailto:${selectedProspect.email}`} onClick={() => logCallAction(`✉️ Drafted Email to ${selectedProspect.email}`)} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-slate-200 hover:border-sky-500' : 'bg-black border-slate-800 hover:border-sky-500'}`}>
                                 <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500 group-hover:bg-sky-500 group-hover:text-white transition-colors">✉️</div>
                                 <div className="min-w-0">
                                   <p className="text-[8px] font-black uppercase opacity-50">Email</p>
                                   <p className={`text-sm font-black truncate ${theme.textStrong}`}>{selectedProspect.email}</p>
                                 </div>
                              </a>
                          ) : (
                              <button onClick={() => handleDeepScan(selectedProspect.id, selectedProspect.domain)} disabled={scanningId === selectedProspect.id || !selectedProspect.domain} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group ${isLightMode ? 'bg-fuchsia-50 border-fuchsia-200' : 'bg-fuchsia-500/5 border-fuchsia-500/20'}`}>
                                 <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-500">🔍</div>
                                 <div className="text-left">
                                   <p className={`text-sm font-black ${theme.textStrong}`}>{scanningId === selectedProspect.id ? 'Decrypting...' : 'Extract Email'}</p>
                                 </div>
                              </button>
                          )}

                          <a href={selectedProspect.website} target="_blank" rel="noopener noreferrer" onClick={() => logCallAction(`🌐 Visited Website`)} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-slate-200 hover:border-fuchsia-500' : 'bg-black border-slate-800 hover:border-fuchsia-500'}`}>
                             <div className="w-8 h-8 rounded-full bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 group-hover:bg-fuchsia-500 group-hover:text-white transition-colors">🌐</div>
                             <div className="min-w-0"><p className="text-[8px] font-black uppercase opacity-50">Website</p><p className={`text-sm font-black truncate ${theme.textStrong}`}>View Site</p></div>
                          </a>

                          <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedProspect.company_name + ' ' + selectedProspect.formatted_address)}`} target="_blank" rel="noopener noreferrer" onClick={() => logCallAction(`⭐ Checked Google Reviews`)} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-slate-200 hover:border-amber-500' : 'bg-black border-slate-800 hover:border-amber-500'}`}>
                             <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">⭐</div>
                             <div className="min-w-0">
                                 <p className="text-[8px] font-black uppercase opacity-50">Google Rating</p>
                                 <p className={`text-sm font-black truncate ${theme.textStrong}`}>{selectedProspect.rating !== undefined ? `${selectedProspect.rating} (${selectedProspect.user_ratings_total || 0})` : "No Reviews"}</p>
                             </div>
                          </a>
                      </div>

                      {/* --- FULL WIDTH LOGO SNIPER BAR (INTEGRATED & COMPACT) --- */}
                      <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-2xl border transition-all relative z-10 ${isLightMode ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-950/10 border-indigo-900/30'}`}>
                          <div className="flex items-center justify-between w-full sm:w-auto pr-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0">📥</div>
                                  <div className="text-left min-w-0">
                                    <p className="text-[8px] font-black uppercase opacity-50 text-indigo-500 whitespace-nowrap">Identity Theft</p>
                                    <p className={`text-sm font-black truncate text-indigo-500`}>Logo Sniper</p>
                                  </div>
                              </div>
                          </div>
                          
                          <div className={`flex flex-1 w-full rounded-xl overflow-hidden border transition-colors shadow-inner focus-within:border-indigo-500 ${isLightMode ? 'bg-white border-indigo-300' : 'bg-black border-indigo-700/50'}`}>
                              <button 
                                 onClick={async () => {
                                    try {
                                        const text = await navigator.clipboard.readText();
                                        setManualLogoUrl(text);
                                    } catch (err) {
                                        alert("Clipboard API blocked. Just click the box and press Ctrl+V / Cmd+V to paste.");
                                    }
                                 }}
                                 className={`px-3 py-3 sm:py-2 text-[9px] font-black uppercase tracking-widest transition-colors shrink-0 border-r ${isLightMode ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200' : 'bg-indigo-900/40 text-indigo-400 hover:bg-indigo-900/60 border-indigo-700/50'}`}
                                 title="Paste from clipboard"
                              >
                                 📋 Paste
                              </button>
                              
                              <input 
                                  type="text" 
                                  placeholder="Image URL (e.g. //site.com/logo.png)..." 
                                  value={manualLogoUrl}
                                  onChange={e => setManualLogoUrl(e.target.value)}
                                  className={`flex-1 w-full px-3 py-3 sm:py-2 text-[11px] font-bold outline-none bg-transparent ${isLightMode ? 'text-indigo-900 placeholder-indigo-300' : 'text-indigo-100 placeholder-indigo-800'}`} 
                              />
                              
                              <button 
                                 onClick={() => handleDownloadLogo(selectedProspect.domain, selectedProspect.company_name)} 
                                 className={`px-6 py-3 sm:py-2 flex items-center justify-center text-white text-[10px] uppercase tracking-widest font-black bg-indigo-600 hover:bg-indigo-500 transition-colors shrink-0`}
                              >
                                  Extract ↓
                              </button>
                          </div>
                      </div>

                      {/* --- DOSSIER TAB NAVIGATION --- */}
                      <div className="flex border-t border-inherit pt-6 mt-2 gap-4">
                          <button onClick={() => setDossierTab("intel")} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border ${dossierTab === 'intel' ? (isLightMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-black border-white') : (isLightMode ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50' : 'bg-slate-900/50 text-slate-500 border-slate-700 hover:bg-slate-800')}`}>
                              Intel & Strategy
                          </button>
                          <button onClick={() => setDossierTab("mockup")} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border ${dossierTab === 'mockup' ? (isLightMode ? 'bg-sky-600 text-white border-sky-600' : 'bg-sky-500 text-white border-sky-500') : (isLightMode ? 'bg-white text-sky-600/70 border-sky-200 hover:bg-sky-50' : 'bg-sky-900/10 text-sky-500/70 border-sky-900/30 hover:bg-sky-900/20')}`}>
                              Branded Mockup Deck {stolenLogoDataUrl ? '✨' : '🔒'}
                          </button>
                      </div>
                  </div>

                  <div className="p-8 pt-0 flex-grow flex flex-col gap-6 overflow-y-auto">
                      
                      {/* =========================================
                          TAB: INTEL & STRATEGY (The Standard View)
                          ========================================= */}
                      {dossierTab === "intel" && (
                          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                              <div className={`p-6 rounded-3xl border shadow-sm flex flex-col gap-4 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                                   <h3 className={`text-[10px] font-black uppercase tracking-widest ${theme.textStrong}`}>Key Personnel & Follow-up</h3>
                                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                       <div>
                                           <label className="text-[8px] font-black uppercase opacity-50 block mb-1.5">Decision Maker Name</label>
                                           <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Who are you speaking to?" className={`w-full p-3 rounded-xl border ${theme.inputBg} text-xs font-bold outline-none`} />
                                       </div>
                                       <div>
                                           <label className="text-[8px] font-black uppercase opacity-50 block mb-1.5">Best Time to Reach</label>
                                           <input value={bestReachTime} onChange={e => setBestReachTime(e.target.value)} placeholder="e.g. Tuesdays at 9AM" className={`w-full p-3 rounded-xl border ${theme.inputBg} text-xs font-bold outline-none`} />
                                       </div>
                                       <div>
                                           <label className="text-[8px] font-black uppercase opacity-50 block mb-1.5">Follow-up Date</label>
                                           <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.inputBg} text-xs font-bold outline-none`} style={{ colorScheme: isLightMode ? 'light' : 'dark' }} />
                                       </div>
                                       <div>
                                           <label className="text-[8px] font-black uppercase opacity-50 block mb-1.5">Follow-up Time</label>
                                           <input type="time" value={followUpTime} onChange={e => setFollowUpTime(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.inputBg} text-xs font-bold outline-none`} style={{ colorScheme: isLightMode ? 'light' : 'dark' }} />
                                       </div>
                                   </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                      <label className={`text-[10px] font-black uppercase tracking-widest block mb-3 ${theme.textMuted}`}>1-Click Call Logging</label>
                                      <div className="grid grid-cols-2 gap-2">
                                          <button onClick={() => logCallAction("🟢 📞 Client Answered")} className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'}`}>Answered</button>
                                          <button onClick={() => logCallAction("🎙️ ⏺️ Left Voice Message")} className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100' : 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20'}`}>Left Voicemail</button>
                                          <button onClick={() => logCallAction("🔴 ❌ Client Did Not Answer")} className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'}`}>No Answer</button>
                                          <button onClick={() => logCallAction("📅 🔄 Follow Up Later")} className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${isLightMode ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>Follow Up</button>
                                      </div>
                                      
                                      {/* --- PRE-CRM BATTLE PLAN --- */}
                                      <div className={`mt-6 p-5 rounded-2xl border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-slate-800'}`}>
                                          <h3 className={`text-[10px] font-black uppercase tracking-widest mb-4 ${theme.textStrong}`}>The Deal Potential (Optional)</h3>
                                          <div className="grid grid-cols-2 gap-4 mb-4">
                                              <div><label className="text-[8px] font-black uppercase opacity-50 block mb-1">Discussed Price</label>
                                              <input type="number" value={discussedPrice} onChange={e => setDiscussedPrice(e.target.value)} className={`w-full p-3 rounded-xl border ${theme.inputBg} text-xs font-bold`} placeholder="Total Revenue" /></div>
                                              <div><label className="text-[8px] font-black uppercase text-fuchsia-500 block mb-1">Est. Cost (Blanks/Print)</label>
                                              <input type="number" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} className={`w-full p-3 rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/5 text-fuchsia-500 text-xs font-bold outline-none focus:ring-1 focus:ring-fuchsia-500`} placeholder="Your Cost" /></div>
                                          </div>
                                          
                                          {parseFloat(discussedPrice) > 0 && parseFloat(estimatedCost) > 0 && (
                                              <div className="flex items-center justify-between p-3 rounded-xl border border-inherit bg-black/5 dark:bg-white/5 mt-2 animate-in fade-in">
                                                  <div className="flex items-center gap-4">
                                                      <div>
                                                          <p className="text-[8px] font-black uppercase tracking-widest opacity-50">Gross Profit</p>
                                                          <p className={`text-sm font-black ${(parseFloat(discussedPrice) - parseFloat(estimatedCost)) > 0 ? 'text-emerald-500' : 'text-red-500'}`}>${(parseFloat(discussedPrice) - parseFloat(estimatedCost)).toFixed(2)}</p>
                                                      </div>
                                                      <div className="w-px h-6 bg-slate-300 dark:bg-slate-700"></div>
                                                      <div>
                                                          <p className="text-[8px] font-black uppercase tracking-widest opacity-50">Margin %</p>
                                                          <p className={`text-sm font-black ${(((parseFloat(discussedPrice) - parseFloat(estimatedCost)) / parseFloat(discussedPrice)) * 100) >= 50 ? 'text-emerald-500' : (((parseFloat(discussedPrice) - parseFloat(estimatedCost)) / parseFloat(discussedPrice)) * 100) >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                                                              {(((parseFloat(discussedPrice) - parseFloat(estimatedCost)) / parseFloat(discussedPrice)) * 100).toFixed(1)}%
                                                          </p>
                                                      </div>
                                                  </div>
                                              </div>
                                          )}

                                          <div className="mt-4 border-t border-inherit pt-4">
                                              <label className="text-[8px] font-black uppercase opacity-50 block mb-2">Identify Competitor Pain Points</label>
                                              <div className="grid grid-cols-2 gap-2 mb-4">
                                                  {['price', 'quality', 'speed', 'service'].map(pain => (
                                                      <button
                                                          key={pain} type="button"
                                                          onClick={() => setPainPoints(prev => ({...prev, [pain]: !(prev as any)[pain]}))}
                                                          className={`p-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${(painPoints as any)[pain] ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-transparent border-inherit opacity-50 hover:opacity-100'}`}
                                                      >
                                                          {(painPoints as any)[pain] ? '🎯 ' : '○ '}{pain}
                                                      </button>
                                                  ))}
                                              </div>

                                              <div className="flex items-center gap-2 mt-4">
                                                 <span className="text-[8px] font-black uppercase opacity-50">Lead Heat:</span>
                                                 <div className="flex gap-1">
                                                   {[1,2,3,4,5].map(h => (
                                                     <button key={h} type="button" onClick={() => setLeadHeat(h)} className={`w-4 h-4 rounded-sm transition-all ${leadHeat >= h ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-800'}`}></button>
                                                   ))}
                                                 </div>
                                              </div>

                                              {(painPoints.price || painPoints.quality || painPoints.speed || painPoints.service) && (
                                                  <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 mt-4 animate-in fade-in">
                                                      <p className="text-[8px] font-black uppercase tracking-widest text-sky-500 mb-2">Generated Pitch Script</p>
                                                      <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 leading-relaxed italic">
                                                          "I completely understand your frustration with your current supplier's {[
                                                                  painPoints.price ? "pricing structures" : "",
                                                                  painPoints.quality ? "inconsistent garment quality" : "",
                                                                  painPoints.speed ? "unreliable turnaround times" : "",
                                                                  painPoints.service ? "lack of communication" : ""
                                                              ].filter(Boolean).join(", ").replace(/,([^,]*)$/, ' and$1')
                                                          }. At YAYA, our custom B2B infrastructure guarantees {[
                                                                  painPoints.price ? "transparent wholesale matrix pricing" : "",
                                                                  painPoints.quality ? "retail-ready premium blanks" : "",
                                                                  painPoints.speed ? "a strict 7-day production turnaround" : "",
                                                                  painPoints.service ? "a dedicated 24/7 tracking portal" : ""
                                                              ].filter(Boolean).join(", ").replace(/,([^,]*)$/, ' and$1')
                                                          } so you never have to deal with that again."
                                                      </p>
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  </div>

                                  <div>
                                      <label className={`text-[10px] font-black uppercase opacity-50 block mb-2`}>Call Notes & Discussion Ledger</label>
                                      <textarea 
                                          value={leadNotes} onChange={e => setLeadNotes(e.target.value)} 
                                          placeholder="Auto-logs will appear here. You can also type manual notes..." 
                                          className={`w-full p-4 rounded-2xl border ${theme.inputBg} text-xs font-medium h-full min-h-[300px] leading-relaxed custom-scrollbar outline-none`} 
                                      />
                                  </div>
                              </div>

                              {/* --- XS-3XL APPAREL REQUEST MATRIX --- */}
                              <div className={`p-6 rounded-3xl border shadow-sm flex flex-col gap-6 ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                                  
                                  <div className="flex justify-between items-center border-b border-inherit pb-3">
                                      <h3 className={`text-[10px] font-black uppercase tracking-widest ${theme.textStrong}`}>Apparel Request Matrix</h3>
                                      <button 
                                          type="button" 
                                          onClick={addProspectItem} 
                                          className="text-[9px] font-black uppercase tracking-widest text-fuchsia-500 bg-fuchsia-500/10 px-3 py-1.5 rounded-lg border border-fuchsia-500/30 hover:bg-fuchsia-500 hover:text-white transition-colors"
                                      >
                                          + Add Item
                                      </button>
                                  </div>
                                  
                                  <div className="flex flex-col gap-4">
                                      {prospectItems.map((item, idx) => (
                                          <div key={idx} className={`p-4 rounded-xl border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-slate-700'}`}>
                                              <div className="flex justify-between items-center mb-2">
                                                  <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>Line Item #{idx + 1}</span>
                                                  {prospectItems.length > 1 && (
                                                      <button onClick={() => removeProspectItem(idx)} className="text-red-500 hover:text-red-400 text-[10px] font-black uppercase tracking-widest">Remove</button>
                                                  )}
                                              </div>
                                              
                                              <div className="flex flex-col md:grid md:grid-cols-12 gap-3 w-full mt-2">
                                                  <div className="col-span-2">
                                                      <input type="text" placeholder="Product (e.g. Hoodies)" value={item.description} onChange={e => updateProspectItem(idx, 'description', e.target.value)} className={`w-full p-2.5 rounded-lg border ${theme.inputBg} text-xs font-bold outline-none`} />
                                                  </div>
                                                  <div className="col-span-2">
                                                      <input type="text" placeholder="Color" value={item.color} onChange={e => updateProspectItem(idx, 'color', e.target.value)} className={`w-full p-2.5 rounded-lg border ${theme.inputBg} text-xs font-bold outline-none`} />
                                                  </div>
                                                  
                                                  {/* XS-3XL Size Grid */}
                                                  <div className="col-span-4 grid grid-cols-7 gap-1">
                                                      {["xs", "s", "m", "l", "xl", "xxl", "xxxl"].map(sz => (
                                                          <div key={sz} className="relative">
                                                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[7px] font-black uppercase text-slate-500">{sz}</div>
                                                              <input type="number" min="0" placeholder="0" value={item[sz] === 0 ? "" : item[sz]} onChange={e => updateProspectItem(idx, sz, parseInt(e.target.value) || 0)} className={`w-full p-2 text-center rounded-lg border ${theme.inputBg} text-xs font-bold outline-none appearance-none`} />
                                                          </div>
                                                      ))}
                                                  </div>

                                                  <div className="col-span-1 flex items-end">
                                                      <div className="relative w-full mt-2 md:mt-0">
                                                        <span className="absolute left-2 top-2.5 text-[9px] font-black text-fuchsia-500">$</span>
                                                        <input type="number" step="0.01" placeholder="Price" value={item.price} onChange={e => updateProspectItem(idx, 'price', e.target.value)} className={`w-full p-2.5 pl-5 rounded-lg border border-fuchsia-500/50 bg-fuchsia-500/5 text-fuchsia-500 text-xs font-bold outline-none focus:ring-1 focus:ring-fuchsia-500`} />
                                                      </div>
                                                  </div>

                                                  <div className="col-span-3 flex items-end">
                                                      <input type="text" placeholder="Line item notes (fabric, fit)..." value={item.notes} onChange={e => updateProspectItem(idx, 'notes', e.target.value)} className={`w-full p-2.5 rounded-lg border ${theme.inputBg} text-xs font-bold outline-none`} />
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* =========================================
                          TAB: BRANDED MOCKUP DECK
                          ========================================= */}
                      {dossierTab === "mockup" && (
                          <div className={`p-8 rounded-3xl border shadow-2xl flex flex-col items-center justify-center animate-in fade-in duration-500 min-h-[500px] relative overflow-hidden ${isLightMode ? 'bg-slate-100 border-slate-300' : 'bg-[#0f1115] border-white/10'}`}>
                              
                              <div className="absolute inset-0 bg-sky-500/5 rounded-3xl pointer-events-none"></div>

                              {!stolenLogoDataUrl ? (
                                  <div className="flex flex-col items-center text-center z-10 w-full max-w-lg">
                                      <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-4xl mb-4 shadow-inner">🔒</div>
                                      <h3 className={`text-2xl font-black uppercase tracking-tighter italic ${theme.textStrong}`}>Mockup Engine Locked</h3>
                                      <p className={`text-xs font-bold mt-2 mb-8 ${theme.textMuted}`}>
                                          Extract a logo first using the <span className="text-indigo-500 font-black">Identity Sniper</span> tool, or manually upload a logo image from your computer to unlock the bridge.
                                      </p>
                                      
                                      <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md inline-flex items-center gap-2 border border-slate-700">
                                          <span>⬆️ Upload Local Logo</span>
                                          <input type="file" accept="image/*" className="hidden" onChange={handleManualLogoUpload} />
                                      </label>
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center text-center z-10 w-full max-w-2xl animate-in zoom-in-95">
                                      <div className="flex flex-col items-center mb-8">
                                          <div className="w-40 h-40 rounded-3xl bg-white border border-slate-200 shadow-xl p-6 rotate-3 hover:rotate-0 transition-transform mb-6">
                                              <img src={stolenLogoDataUrl} alt="Stolen Logo" className="w-full h-full object-contain filter drop-shadow-md" />
                                          </div>
                                          <label className="cursor-pointer bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-slate-300 dark:border-slate-700">
                                              <span>Replace Logo</span>
                                              <input type="file" accept="image/*" className="hidden" onChange={handleManualLogoUpload} />
                                          </label>
                                      </div>

                                      <h3 className={`text-3xl font-black uppercase tracking-tighter italic mb-4 ${theme.textStrong}`}>Logo Extracted & Ready</h3>
                                      <p className={`text-sm font-bold mb-10 max-w-lg ${theme.textMuted}`}>
                                          The logo has been secured. Send it to the Mockup Engine to build out the custom 4-way presentation deck with full drag-and-drop control.
                                      </p>
                                      
                                      <button 
                                          onClick={() => {
                                              localStorage.setItem('yaya_transferred_logo', stolenLogoDataUrl);
                                              window.open('/mockup-v2', '_blank');
                                          }}
                                          className="w-full max-w-md py-5 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(14,165,233,0.4)] bg-sky-600 hover:bg-sky-500 text-white hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(14,165,233,0.6)]"
                                      >
                                          🏗️ Send to Mockup Engine →
                                      </button>
                                  </div>
                              )}
                          </div>
                      )}

                  </div>

                  {/* PUSH TO CRM FOOTER */}
                  <div className={`p-6 border-t shrink-0 ${theme.bgPanel} ${theme.border}`}>
                      <button 
                          onClick={() => handlePushToCRM(selectedProspect)}
                          disabled={addedLeadIds.includes(selectedProspect.id)}
                          className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-lg ${addedLeadIds.includes(selectedProspect.id) ? 'bg-slate-500 text-white cursor-not-allowed border-none' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:-translate-y-1'}`}
                      >
                          {addedLeadIds.includes(selectedProspect.id) ? '✓ Pushed to CRM' : '+ Push Qualified Lead to CRM'}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}