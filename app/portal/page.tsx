"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// --- CLIENT-FACING PIPELINE MAPPER ---
const getClientStage = (internalStage: string) => {
  const stageMap: Record<string, { step: number, label: string, color: string }> = {
    "Incoming": { step: 1, label: "Order Received", color: "text-slate-500" },
    "Artwork in Approval": { step: 1, label: "Artwork Proofing", color: "text-amber-500" },
    "Artwork": { step: 1, label: "Artwork Proofing", color: "text-amber-500" },
    "To Buy": { step: 2, label: "Sourcing Garments", color: "text-sky-500" },
    "Sourcing": { step: 2, label: "Sourcing Garments", color: "text-sky-500" },
    "Ordered": { step: 2, label: "Garments Ordered", color: "text-sky-500" },
    "Received": { step: 2, label: "Prepping for Run", color: "text-indigo-500" },
    "Staged": { step: 2, label: "Prepping for Run", color: "text-indigo-500" },
    "To Print": { step: 3, label: "In Print Queue", color: "text-fuchsia-500" },
    "Printing": { step: 3, label: "Printing in Progress", color: "text-fuchsia-500" },
    "To Press": { step: 3, label: "In Press Queue", color: "text-fuchsia-500" },
    "Pressing": { step: 3, label: "Pressing in Progress", color: "text-fuchsia-500" },
    "Finishing": { step: 3, label: "Quality Control", color: "text-teal-500" },
    "To Deliver / Pick Up": { step: 4, label: "Ready for Delivery/Pickup", color: "text-emerald-500" },
    "Dispatch": { step: 4, label: "Dispatched", color: "text-emerald-500" },
    "To Invoice": { step: 4, label: "Order Complete", color: "text-emerald-500" },
    "Billing": { step: 4, label: "Order Complete", color: "text-emerald-500" },
    "Paid": { step: 4, label: "Order Complete", color: "text-emerald-500" },
    "Completed": { step: 4, label: "Order Complete", color: "text-emerald-500" }
  };
  return stageMap[internalStage] || { step: 1, label: "Processing", color: "text-slate-500" };
};

const COLOR_HEX_MAP: Record<string, string> = {
    "Antique Cherry Red": "#7C1C29", "Antique Sapphire": "#126B88", "Ash": "#D7D7D7", "Ash Grey": "#D7D7D7",
    "Azalea": "#F089B2", "Black": "#111111", "Cardinal Red": "#8A1529", 
    "Carolina Blue": "#7BAFD4", "Charcoal": "#4F5254", "Charcoal Grey": "#4F5254", "Cherry Red": "#B80F2A", 
    "Dark Chocolate": "#35231D", "Dark Heather": "#4B4F55", "Forest Green": "#182C25", 
    "Garnet": "#5F121F", "Gold": "#FFC72C", "Heather Dark Green": "#2d4235", 
    "Heather Dark Maroon": "#5d1e2e", "Heather Dark Navy": "#2b3447", 
    "Heather Deep Royal": "#3b5ba5", "Heather Scarlet Red": "#b93d47", 
    "Heliconia": "#DB3E79", "Indigo Blue": "#475D74", "Irish Green": "#009E60", 
    "Light Blue": "#ADD8E6", "Light Pink": "#FFB6C1", "Maroon": "#500000", 
    "Navy": "#000080", "Purple": "#6A0DAD", "Red": "#E60000", "Royal": "#4169E1", 
    "Safety Green": "#CEFF00", "Sand": "#C2B280", "Sapphire": "#0F52BA", 
    "Sport Grey": "#9E9E9E", "White": "#FFFFFF"
  };

export default function B2BClientPortal() {
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // --- AUTH STATE ---
  const [loggedInClient, setLoggedInClient] = useState<any>(null);
  const [emailInput, setEmailInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isRestoringAuth, setIsRestoringAuth] = useState(true); // ADDITIVE: Prevents flash on reload

  // --- DASHBOARD STATE ---
  const [activeTab, setActiveTab] = useState<"active" | "history" | "billing" | "new" | "vault">("active");
  const [clientQuotes, setClientQuotes] = useState<any[]>([]);
  const [clientJobs, setClientJobs] = useState<any[]>([]);

  // --- ARTWORK APPROVAL STATE ---
  const [approvingJob, setApprovingJob] = useState<any>(null);
  const [signatureName, setSignatureName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // --- REORDER STATE ---
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // --- PAYMENT PROCESSING STATE ---
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);

  // --- NEW ORDER SUBMISSION STATE ---
  const [newOrderItems, setNewOrderItems] = useState([
      { description: "", color: "", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }
  ]);
  const [newOrderFrontPrint, setNewOrderFrontPrint] = useState("");
  const [newOrderBackPrint, setNewOrderBackPrint] = useState("");
  const [newOrderNotes, setNewOrderNotes] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  
  const [upsellPolyBag, setUpsellPolyBag] = useState(false);
  const [blindDropShip, setBlindDropShip] = useState(false);
  const [aiSuggestionAdded, setAiSuggestionAdded] = useState(false);
  
  // --- ADDITIVE: RUSH ORDER STATE ---
  const [turnaroundTier, setTurnaroundTier] = useState<"standard" | "expedited" | "lightning">("standard");

  // ESC closes artwork-approval modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && approvingJob) setApprovingJob(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [approvingJob]);

// --- ADDITIVE: STRIPE SUCCESS HANDLER ---
  useEffect(() => {
      // Check if the URL has ?success=true in it (meaning they just paid on Stripe)
      const query = new URLSearchParams(window.location.search);
      const isSuccess = query.get("success");
      const paidQuoteId = query.get("quote_id");

      if (isSuccess && paidQuoteId) {
          // Clean the URL so the success message doesn't trigger on refresh
          window.history.replaceState(null, '', window.location.pathname);
          
          // Update Supabase to mark it as paid
          const markAsPaid = async () => {
              try {
                  // Fetch the quote to get the exact amount to update
                  const { data: quote } = await supabase.from("quotes").select("*").eq("id", paidQuoteId).single();
                  
                  if (quote) {
                      const balanceDue = (quote.total_amount * 1.13) - (quote.amount_paid || 0);
                      const newAmountPaid = (quote.amount_paid || 0) + balanceDue;
                      
                      await supabase.from("quotes").update({ amount_paid: newAmountPaid }).eq("id", paidQuoteId);
                      
                      // ADDITIVE: 1. Log the payment to the internal system (job_logs)
                      const { data: linkedJob } = await supabase.from("jobs").select("id").eq("quote_id", paidQuoteId).single();
                      if (linkedJob) {
                          await supabase.from("job_logs").insert([{
                              job_id: linkedJob.id,
                              from_stage: "Billing",
                              to_stage: "Paid",
                              notes: `💳 System Notification: A payment of $${balanceDue.toFixed(2)} was successfully processed via Stripe.`
                          }]);
                      }

                      // ADDITIVE: 2. Trigger the email notification to info@yayasports.ca
                      try {
                          await fetch("/api/notify-payment", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                  clientName: loggedInClient?.company_name || "A client",
                                  amount: balanceDue,
                                  poRef: paidQuoteId.split('-')[0].toUpperCase()
                              })
                          });
                      } catch (emailErr) {
                          console.error("Failed to trigger email:", emailErr);
                      }

                      // Show success message
                      alert("Payment successful! Your invoice has been marked as paid via Stripe.");
                      
                      // Refresh the client data
                      if (loggedInClient) {
                          fetchClientData(loggedInClient.id);
                      }
                  }
              } catch (err) {
                  console.error("Error updating successful payment:", err);
              }
          };
          
          markAsPaid();
      }
  }, [loggedInClient]);

// --- ADDITIVE: RESTORE AUTH ON MOUNT ---
  useEffect(() => {
    const storedAuth = localStorage.getItem('yaya_b2b_auth');
    if (storedAuth) {
      try {
        const clientData = JSON.parse(storedAuth);
        setLoggedInClient(clientData);
        fetchClientData(clientData.id);
      } catch (e) {
        localStorage.removeItem('yaya_b2b_auth');
      }
    }
    setIsRestoringAuth(false);
  }, []);

  // --- UNIVERSAL THEME SYNC ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('yaya-theme');
    const isLight = savedTheme === 'light';
    setIsLightMode(isLight);
    
    if (isLight) {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleUniversalTheme = () => {
      const newMode = !isLightMode;
      setIsLightMode(newMode);
      localStorage.setItem('yaya-theme', newMode ? 'light' : 'dark');
      
      if (newMode) {
          document.documentElement.classList.remove('dark');
      } else {
          document.documentElement.classList.add('dark');
      }
      
      window.dispatchEvent(new Event('themeChange'));
  };

  // --- AUTHENTICATION LOGIC ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError("");

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .ilike("email", emailInput.trim())
        .eq("portal_pin", pinInput.trim())
        .single();

      if (error || !data) {
        setAuthError("Invalid Email or PIN. Please try again.");
      } else {
        setLoggedInClient(data);
        localStorage.setItem('yaya_b2b_auth', JSON.stringify(data)); // ADDITIVE
        fetchClientData(data.id);
      }
    } catch (err) {
      setAuthError("An error occurred connecting to the portal.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setLoggedInClient(null);
    localStorage.removeItem('yaya_b2b_auth'); // ADDITIVE
    setClientQuotes([]);
    setClientJobs([]);
    setEmailInput("");
    setPinInput("");
    setActiveTab("active");
  };

  // --- DATA FETCHING LOGIC ---
  const fetchClientData = async (customerId: string) => {
    try {
      const { data: quotesData } = await supabase
        .from("quotes")
        .select(`*, quote_items(description, quantity, unit_price, quote_item_variants(color, xs, s, m, l, xl, xxl, xxxl, xxxxl, xxxxxl, regular_price, unit_price))`)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      
      if (quotesData) setClientQuotes(quotesData);

      const quoteIds = quotesData ? quotesData.map(q => q.id) : [];
      if (quoteIds.length > 0) {
        const { data: jobsData } = await supabase
            .from("jobs")
            .select("*")
            .in("quote_id", quoteIds)
            .order("created_at", { ascending: false });
        if (jobsData) setClientJobs(jobsData);
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
    }
  };

  // --- DIGITAL SIGNATURE ENGINE ---
  const handleApproveArtwork = async () => {
      if (!signatureName.trim() || !agreedToTerms || !approvingJob) return;
      setIsApproving(true);
      
      try {
          const timestamp = new Date().toISOString();
          const { error: jobError } = await supabase.from("jobs").update({
              stage: "Printing",
              artwork_approved_by: signatureName,
              artwork_approved_at: timestamp,
              updated_at: timestamp
          }).eq("id", approvingJob.id);

          if (jobError) throw jobError;

          await supabase.from("job_logs").insert([{
              job_id: approvingJob.id,
              from_stage: "Artwork",
              to_stage: "Printing",
              notes: `Artwork digitally signed and approved by ${signatureName} via B2B Portal.`
          }]);

          setClientJobs(prev => prev.map(j => j.id === approvingJob.id ? { ...j, stage: "Printing", artwork_approved_by: signatureName, artwork_approved_at: timestamp } : j));
          
          setApprovingJob(null);
          setSignatureName("");
          setAgreedToTerms(false);

      } catch (err) {
          console.error("Error signing artwork:", err);
          alert("A server error occurred while processing your signature. Please try again.");
      } finally {
          setIsApproving(false);
      }
  };

  // --- 1-CLICK REORDER ENGINE ---
  const handleRequestReorder = async (historicalQuote: any) => {
      if (!loggedInClient) return;
      setReorderingId(historicalQuote.id);
      
      try {
          const { data: newQuote, error: qError } = await supabase.from("quotes").insert([{
              customer_id: loggedInClient.id,
              total_amount: historicalQuote.total_amount,
              status: "Draft",
              notes: `Reorder requested via Client Portal. Originally referenced PO: ${historicalQuote.id.split('-')[0].toUpperCase()}`,
              internal_notes: "Auto-generated from B2B Portal 1-Click Reorder."
          }]).select().single();

          if (qError) throw qError;

          for (const item of historicalQuote.quote_items || []) {
              const { data: newItem, error: iError } = await supabase.from("quote_items").insert([{
                  quote_id: newQuote.id,
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: item.unit_price || 0
              }]).select().single();

              if (iError) throw iError;

              if (item.quote_item_variants && item.quote_item_variants.length > 0) {
                  const variantsToInsert = item.quote_item_variants.map((v: any) => ({
                      quote_item_id: newItem.id,
                      color: v.color,
                      xs: v.xs || 0, s: v.s || 0, m: v.m || 0, l: v.l || 0, 
                      xl: v.xl || 0, xxl: v.xxl || 0, xxxl: v.xxxl || 0, 
                      xxxxl: v.xxxxl || 0, xxxxxl: v.xxxxxl || 0,
                      regular_price: v.regular_price || 0,
                      unit_price: v.unit_price || 0
                  }));

                  const { error: vError } = await supabase.from("quote_item_variants").insert(variantsToInsert);
                  if (vError) throw vError;
              }
          }

          alert("Reorder request successfully submitted! Our team will review the draft and initiate production shortly.");
          fetchClientData(loggedInClient.id);
          
      } catch (err: any) {
          console.error("Reorder Error:", err);
          alert("Failed to submit reorder. Please contact your account manager.");
      } finally {
          setReorderingId(null);
      }
  };

  // --- INVOICE PAYMENT ENGINE (STRIPE INTEGRATION) ---
  const handlePayInvoice = async (quote: any) => {
      if (!loggedInClient) return;
      setProcessingPaymentId(quote.id);

      try {
          const balanceDue = (quote.total_amount * 1.13) - (quote.amount_paid || 0);
          
          // 1. Ask our backend to create a secure Stripe page
          const response = await fetch("/api/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  quoteId: quote.id,
                  amountDue: balanceDue,
                  clientName: loggedInClient.company_name,
                  poRef: quote.id.split('-')[0].toUpperCase()
              }),
          });

          const data = await response.json();

          if (!response.ok) {
              throw new Error(data.error || "Failed to create checkout session");
          }

          // 2. Redirect the user to the secure Stripe page
          if (data.url) {
              window.location.href = data.url; 
          }

      } catch (err) {
          console.error("Payment Error:", err);
          alert("Failed to connect to Stripe. Please try again.");
          setProcessingPaymentId(null);
      } 
      // We don't set processing to null in the 'finally' block anymore because 
      // the page is redirecting away to Stripe!
  };

  // --- NEW ORDER SUBMISSION ENGINE ---
  const handleGarmentChange = (index: number, field: string, value: string | number) => {
      const updated = [...newOrderItems];
      (updated[index] as any)[field] = value;
      setNewOrderItems(updated);
  };

  const handleAddGarmentItem = () => {
      setNewOrderItems([...newOrderItems, { description: "", color: "", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }]);
  };

  const handleRemoveGarmentItem = (index: number) => {
      if (newOrderItems.length > 1) {
          const updated = [...newOrderItems];
          updated.splice(index, 1);
          setNewOrderItems(updated);
      }
  };

  // AI Suggestion Logic based on current garments
  const getAiSuggestion = () => {
      const allText = newOrderItems.map(i => i.description.toLowerCase()).join(' ');
      
      if (allText.includes('hoodie') || allText.includes('fleece') || allText.includes('sweat')) {
          return {
              title: "Matching Embroidered Dad Hats",
              desc: "Clients ordering fleece often pair them with premium embroidered caps.",
              item: "Premium Dad Hat (Custom Embroidery)",
              color: "Matching",
              icon: "🧢"
          };
      }
      if (allText.includes('shirt') || allText.includes('tee')) {
          return {
              title: "Custom Printed Canvas Totes",
              desc: "A high-ROI add-on for retail, staff, or events. Heavyweight canvas.",
              item: "Canvas Tote Bag (1-Color Print)",
              color: "Natural",
              icon: "🛍️"
          };
      }
      
      return {
          title: "Custom Embroidered Beanies",
          desc: "Perfect seasonal add-on to maximize your brand's physical reach.",
          item: "Knit Beanie (Embroidered)",
          color: "Black",
          icon: "🧶"
      };
  };

  const aiSuggestion = getAiSuggestion();
  
  const currentTotalQty = newOrderItems.reduce((acc, item) => 
      acc + (item.xs + item.s + item.m + item.l + item.xl + item.xxl + item.xxxl), 0
  );

  const applyAiSuggestion = () => {
      setNewOrderItems([
          ...newOrderItems, 
          { description: aiSuggestion.item, color: aiSuggestion.color, xs: 0, s: 0, m: 0, l: Math.max(25, currentTotalQty), xl: 0, xxl: 0, xxxl: 0 }
      ]);
      setAiSuggestionAdded(true);
  };

  const handleSubmitNewOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loggedInClient) return;

      const totalRequestedQty = newOrderItems.reduce((acc, item) => 
          acc + (item.xs + item.s + item.m + item.l + item.xl + item.xxl + item.xxxl), 0
      );

      if (totalRequestedQty === 0) {
          alert("Please specify a quantity greater than 0 for at least one size.");
          return;
      }

      setIsSubmittingOrder(true);

      try {
          const dropShipNote = blindDropShip ? "\n\n[!] BLIND DROP-SHIP REQUESTED: Ship directly to end-customer using white-label packing slips. Do not include YAYA Prints branding." : "";
          const rushNote = turnaroundTier === "lightning" ? "\n\n[⚡] LIGHTNING RUSH REQUESTED: Apply +40% Premium Fee." : turnaroundTier === "expedited" ? "\n\n[🚀] EXPEDITED RUSH REQUESTED: Apply +15% Premium Fee." : "\n\nStandard Turnaround (14 Days).";

          const { data: newQuote, error: qError } = await supabase.from("quotes").insert([{
              customer_id: loggedInClient.id,
              total_amount: 0, // Shop owner will price it
              status: "Draft",
              notes: `Client Notes: ${newOrderNotes}\nFront Print: ${newOrderFrontPrint}\nBack Print: ${newOrderBackPrint}`,
              internal_notes: "New Custom Order Request submitted via B2B Portal." + dropShipNote + rushNote
          }]).select().single();

          if (qError) throw qError;

          for (const item of newOrderItems) {
              const itemTotalQty = item.xs + item.s + item.m + item.l + item.xl + item.xxl + item.xxxl;
              if (itemTotalQty === 0) continue;

              const { data: newItem, error: iError } = await supabase.from("quote_items").insert([{
                  quote_id: newQuote.id,
                  description: item.description || "Custom Apparel",
                  quantity: itemTotalQty,
                  unit_price: 0
              }]).select().single();

              if (iError) throw iError;

              const { error: vError } = await supabase.from("quote_item_variants").insert([{
                  quote_item_id: newItem.id,
                  color: item.color || "As Specified",
                  xs: item.xs, s: item.s, m: item.m, l: item.l, 
                  xl: item.xl, xxl: item.xxl, xxxl: item.xxxl, 
                  xxxxl: 0, xxxxxl: 0,
                  regular_price: 0,
                  unit_price: 0
              }]);

              if (vError) throw vError;
          }

          const premiumItems = [];
          if (upsellPolyBag) premiumItems.push("Premium Finish: Individual Poly-Bagging & Size Stickers (Est. +$0.85/ea)");

          for (const pItemDesc of premiumItems) {
              await supabase.from("quote_items").insert([{
                  quote_id: newQuote.id,
                  description: pItemDesc,
                  quantity: totalRequestedQty, 
                  unit_price: 0
              }]);
          }

          alert("Your new order request has been submitted successfully! Our team will review it and provide a quote shortly.");
          
          setNewOrderItems([{ description: "", color: "", xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }]);
          setNewOrderFrontPrint("");
          setNewOrderBackPrint("");
          setNewOrderNotes("");
          setUpsellPolyBag(false);
          setBlindDropShip(false);
          setAiSuggestionAdded(false);
          setTurnaroundTier("standard");
          
          fetchClientData(loggedInClient.id);
          setActiveTab("history");

      } catch (err: any) {
          console.error("Submit Order Error:", err);
          alert("Failed to submit order request. Please try again or contact support.");
      } finally {
          setIsSubmittingOrder(false);
      }
  };

  // --- THEME ---
  const theme = {
      bgMain: isLightMode ? "bg-slate-50" : "bg-[#050505]",
      textMain: isLightMode ? "text-slate-900" : "text-white",
      bgPanel: isLightMode ? "bg-white" : "bg-[#0f1115]",
      border: isLightMode ? "border-slate-200" : "border-white/5",
      textMuted: isLightMode ? "text-slate-500" : "text-slate-400",
      textStrong: isLightMode ? "text-slate-900" : "text-white",
      inputBg: isLightMode ? "bg-slate-50 border-slate-300 text-slate-900" : "bg-black border-slate-800 text-white",
  };

  // ============================================================================
  // VIP STATUS CALCULATOR
  // ============================================================================
  const totalInvoices = clientQuotes.filter(q => q.status === "Approved");
  const totalSpend = totalInvoices.reduce((sum, q) => sum + (q.total_amount * 1.13), 0);
  const totalBalance = totalInvoices.reduce((sum, q) => sum + ((q.total_amount * 1.13) - (q.amount_paid || 0)), 0);
  
  const getVipTier = (spend: number) => {
      if (spend >= 15000) return { name: "BLACK CARD", color: isLightMode ? "text-slate-900" : "text-white", bg: isLightMode ? "bg-slate-900" : "bg-white", next: null, progress: 100 };
      if (spend >= 5000) return { name: "GOLD", color: "text-amber-500", bg: "bg-amber-500", next: 15000, progress: (spend/15000)*100 };
      if (spend >= 1000) return { name: "SILVER", color: "text-slate-400", bg: "bg-slate-400", next: 5000, progress: (spend/5000)*100 };
      return { name: "BRONZE", color: "text-amber-700", bg: "bg-amber-700", next: 1000, progress: (spend/1000)*100 };
  };
  const vipStatus = loggedInClient ? getVipTier(totalSpend) : null;

  // ============================================================================
  // VIEW: SECURE LOGIN GATEWAY
  // ============================================================================
  if (isRestoringAuth) {
      return (
          <div className={`min-h-screen ${theme.bgMain} flex items-center justify-center`}>
              <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      );
  }

  if (!loggedInClient) {
      return (
          <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans flex items-center justify-center p-4 selection:bg-sky-500 selection:text-white transition-colors duration-300`}>
              <div className={`w-full max-w-md ${theme.bgPanel} border ${theme.border} rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden`}>
                  
                  <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                  
                  <div className="text-center mb-8 relative z-10">
                      <h1 className="text-2xl font-black uppercase tracking-tighter italic leading-none mb-2">B2B <span className="text-sky-500">Portal</span></h1>
                      <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${theme.textMuted}`}>Secure Client Gateway</p>
                  </div>

                  <form onSubmit={handleLogin} className="flex flex-col gap-4 relative z-10">
                      <div>
                          <label className={`text-[9px] font-black uppercase tracking-widest block mb-1.5 ${theme.textMuted} pl-1`}>Account Email</label>
                          <input 
                              type="email" 
                              required
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              className={`w-full rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-sky-500 transition-colors shadow-inner border ${theme.inputBg}`}
                              placeholder="client@company.com"
                          />
                      </div>
                      <div>
                          <div className="flex justify-between items-end mb-1.5 px-1">
                              <label className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>Secure PIN</label>
                          </div>
                          <input 
                              type="password" 
                              required
                              maxLength={4}
                              value={pinInput}
                              onChange={(e) => setPinInput(e.target.value)}
                              className={`w-full rounded-xl px-4 py-3 text-center text-lg tracking-[1em] font-black outline-none focus:border-sky-500 transition-colors shadow-inner border ${theme.inputBg}`}
                              placeholder="••••"
                          />
                      </div>

                      {authError && (
                          <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest p-2 rounded-lg text-center">
                              {authError}
                          </div>
                      )}

                      <button 
                          type="submit" 
                          disabled={isLoading}
                          className={`w-full mt-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)] ${isLoading ? 'bg-sky-800 text-sky-400 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-400 text-white'}`}
                      >
                          {isLoading ? 'Authenticating...' : 'Access Portal →'}
                      </button>
                  </form>
              </div>
          </div>
      );
  }

  // ============================================================================
  // VIEW: CLIENT DASHBOARD
  // ============================================================================
  const activeJobs = clientJobs.filter(j => !["Dispatch", "Billing", "Paid", "Completed"].includes(j.stage));

  return (
      <div className={`min-h-screen ${theme.bgMain} ${theme.textMain} font-sans selection:bg-sky-500 selection:text-white transition-colors duration-300 pb-16`}>
          
          {/* PORTAL HEADER (COMPACT) */}
          <div className={`${theme.bgPanel} border-b ${theme.border} px-4 md:px-6 py-3 sticky top-0 z-50 shadow-sm transition-colors duration-300`}>
              <div className="max-w-[1400px] mx-auto flex flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                      <div>
                          <h1 className="text-lg md:text-xl font-black uppercase tracking-tighter italic leading-none">
                              Welcome, <span className="text-sky-500">{loggedInClient.company_name}</span>
                          </h1>
                          <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 ${theme.textMuted}`}>
                              {loggedInClient.contact_name} • Portal
                          </p>
                      </div>
                      
                      <button onClick={toggleUniversalTheme} className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-black text-[8px] uppercase tracking-widest transition-colors ml-2 ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
                          {isLightMode ? '🌙 Dark' : '☀️ Light'}
                      </button>
                  </div>

                  <button
                      onClick={handleLogout}
                      className={`px-4 py-2.5 sm:py-1.5 rounded-lg text-[11px] sm:text-[9px] font-black uppercase tracking-widest border transition-colors min-h-[40px] sm:min-h-0 active:scale-95 ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-slate-500'}`}
                  >
                      Logout
                  </button>
              </div>
          </div>

          <div className="max-w-[1400px] mx-auto p-3 md:p-5 flex flex-col gap-4">
              
              {/* VIP STATUS BANNER (COMPACT) */}
              {vipStatus && (
                  <div className={`${theme.bgPanel} border ${theme.border} p-4 md:p-5 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden transition-colors`}>
                      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                      <div className="flex-1 w-full relative z-10 flex items-center gap-3">
                          <h2 className={`text-xl font-black uppercase tracking-tighter italic m-0 ${vipStatus.color}`}>{vipStatus.name}</h2>
                          <div className={`h-4 w-px ${theme.border}`}></div>
                          <span className={`text-[10px] font-bold ${theme.textMuted}`}>Spend: ${totalSpend.toFixed(2)}</span>
                      </div>
                      <div className="flex-[1.5] w-full relative z-10">
                          <div className="flex justify-between text-[8px] font-black uppercase tracking-widest mb-1">
                              <span className={vipStatus.color}>{vipStatus.name}</span>
                              <span className={theme.textMuted}>{vipStatus.next ? getVipTier(vipStatus.next).name : 'MAX'}</span>
                          </div>
                          <div className={`w-full h-1.5 rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-slate-800'} overflow-hidden`}>
                              <div className={`h-full rounded-full transition-all duration-1000 ${vipStatus.bg}`} style={{ width: `${vipStatus.progress}%` }}></div>
                          </div>
                          {vipStatus.next && (
                              <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 text-right ${theme.textMuted}`}>
                                  ${(vipStatus.next - totalSpend).toFixed(2)} to next tier
                              </p>
                          )}
                      </div>
                  </div>
              )}

              {/* NAVIGATION TABS (COMPACT) */}
              <div className="flex gap-2 border-b border-inherit pb-2 overflow-x-auto no-scrollbar items-center">
                  <button onClick={() => setActiveTab("active")} className={`px-4 py-2.5 sm:py-2 rounded-full text-[11px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[40px] sm:min-h-0 active:scale-95 ${activeTab === 'active' ? 'bg-sky-500/20 text-sky-500 border-sky-500/50' : (isLightMode ? 'bg-white text-slate-500 border-slate-200 hover:border-slate-300' : 'bg-black/40 text-slate-500 border-white/5 hover:text-white')}`}>
                      Live Orders ({activeJobs.length})
                  </button>
                  <button onClick={() => setActiveTab("history")} className={`px-4 py-2.5 sm:py-2 rounded-full text-[11px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[40px] sm:min-h-0 active:scale-95 ${activeTab === 'history' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' : (isLightMode ? 'bg-white text-slate-500 border-slate-200 hover:border-slate-300' : 'bg-black/40 text-slate-500 border-white/5 hover:text-white')}`}>
                      Order History
                  </button>
                  <button onClick={() => setActiveTab("billing")} className={`px-4 py-2.5 sm:py-2 rounded-full text-[11px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[40px] sm:min-h-0 active:scale-95 ${activeTab === 'billing' ? 'bg-indigo-500/20 text-indigo-500 border-indigo-500/50' : (isLightMode ? 'bg-white text-slate-500 border-slate-200 hover:border-slate-300' : 'bg-black/40 text-slate-500 border-white/5 hover:text-white')}`}>
                      Billing & Invoices
                  </button>
                  <button onClick={() => setActiveTab("vault")} className={`px-4 py-2.5 sm:py-2 rounded-full text-[11px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[40px] sm:min-h-0 active:scale-95 ${activeTab === 'vault' ? 'bg-fuchsia-500/20 text-fuchsia-500 border-fuchsia-500/50' : (isLightMode ? 'bg-white text-slate-500 border-slate-200 hover:border-slate-300' : 'bg-black/40 text-slate-500 border-white/5 hover:text-white')}`}>
                      📁 Brand Vault
                  </button>
                  
                  <button onClick={() => setActiveTab("new")} className={`px-4 py-2.5 sm:py-2 rounded-full text-[11px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border shadow-sm min-h-[40px] sm:min-h-0 active:scale-95 ml-auto ${activeTab === 'new' ? 'bg-sky-600 text-white border-sky-500' : (isLightMode ? 'bg-slate-800 text-white hover:bg-slate-700 border-slate-800' : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700')}`}>
                      + New Order
                  </button>
              </div>

              {/* TAB CONTENT: ACTIVE ORDERS (COMPACT PIZZA TRACKER) */}
              {activeTab === "active" && (
                  <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3 mb-1">
                          <div className={`${theme.bgPanel} border ${theme.border} p-4 rounded-xl shadow-sm relative overflow-hidden transition-colors flex items-center justify-between`}>
                              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                              <p className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>Active</p>
                              <p className="text-2xl font-black tracking-tighter text-sky-500">{activeJobs.length}</p>
                          </div>
                          <div className={`${theme.bgPanel} border ${theme.border} p-4 rounded-xl shadow-sm relative overflow-hidden transition-colors flex items-center justify-between`}>
                              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                              <p className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>Historical</p>
                              <p className="text-2xl font-black tracking-tighter text-emerald-500">{totalInvoices.length}</p>
                          </div>
                      </div>

                      {activeJobs.length === 0 ? (
                          <div className={`p-8 flex flex-col items-center justify-center text-center border-2 border-dashed rounded-xl transition-colors ${isLightMode ? 'border-slate-300 bg-slate-50/50 text-slate-500' : 'border-slate-800 bg-black/20 text-slate-500'}`}>
                              <span className="text-3xl mb-2 opacity-50">✨</span>
                              <h3 className="font-black uppercase tracking-widest text-sm mb-1">No Active Orders</h3>
                              <p className="text-[10px] font-bold opacity-70 max-w-xs">You're all caught up! Submit a new order to track it here.</p>
                              <button 
                                  onClick={() => setActiveTab("new")}
                                  className={`mt-4 px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm ${isLightMode ? 'bg-white border border-slate-200 text-sky-600 hover:border-sky-500' : 'bg-[#0f1115] border border-white/10 text-sky-400 hover:border-sky-500'}`}
                              >
                                  + Start Project
                              </button>
                          </div>
                      ) : (
                          activeJobs.map(job => {
                              const clientStatus = getClientStage(job.stage);
                              const jobQuote = clientQuotes.find(q => q.id === job.quote_id);
                              const hasPaid = jobQuote && (jobQuote.amount_paid || 0) > 0;
                              
                              return (
                                  <div key={job.id} className={`${theme.bgPanel} border ${theme.border} rounded-xl p-4 md:p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden transition-colors`}>
                                      
                                      <div className="flex justify-between items-start border-b border-inherit pb-3">
                                          <div>
                                              <span className={`text-[9px] font-black uppercase tracking-widest mb-0.5 block ${theme.textMuted}`}>Order #{job.job_number}</span>
                                              <h3 className="text-lg md:text-xl font-black uppercase tracking-tighter">{job.title}</h3>
                                          </div>
                                          <div className="flex flex-col items-end gap-1.5">
                                              <div className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'}`}>
                                                  Est: <span className="text-sky-500">{job.due_date ? new Date(job.due_date).toLocaleDateString() : 'TBD'}</span>
                                              </div>
                                              {hasPaid && (
                                                  <div className="px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-sm flex items-center gap-1">
                                                      <span>✓</span> Payment Secured
                                                  </div>
                                              )}
                                          </div>
                                      </div>

                                      {/* DYNAMIC STATUS BADGE */}
                                      <div className="mb-4 flex items-center gap-2">
                                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-black border-white/10'} ${clientStatus.color}`}>
                                              Status: {clientStatus.label}
                                          </span>
                                      </div>

                                      {/* COMPACT PROGRESS TRACKER */}
                                      <div className="relative pt-2 pb-3">
                                          <div className={`absolute top-[18px] left-[12.5%] right-[12.5%] h-1 rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-slate-800'}`}></div>
                                          <div className="absolute top-[18px] left-[12.5%] h-1 rounded-full bg-sky-500 transition-all duration-700" style={{ width: `${(clientStatus.step - 1) * 25}%` }}></div>

                                          <div className="flex justify-between relative z-10">
                                              {[
                                                  { num: 1, label: "Artwork" },
                                                  { num: 2, label: "Prep" },
                                                  { num: 3, label: "Production" },
                                                  { num: 4, label: "Dispatch" }
                                              ].map((step) => {
                                                  const isPast = clientStatus.step > step.num;
                                                  const isCurrent = clientStatus.step === step.num;

                                                  return (
                                                      <div key={step.num} className="flex flex-col items-center w-1/4">
                                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-[3px] transition-all duration-500 ${
                                                              isPast ? 'bg-sky-500 border-sky-500 text-white' : 
                                                              isCurrent ? (isLightMode ? 'bg-white border-sky-500 text-sky-500' : 'bg-black border-sky-500 text-sky-500') + ' shadow-[0_0_10px_rgba(14,165,233,0.5)] scale-110' : 
                                                              (isLightMode ? 'bg-slate-100 border-slate-300 text-slate-400' : 'bg-slate-900 border-slate-700 text-slate-500')
                                                          }`}>
                                                              {isPast ? '✓' : step.num}
                                                          </div>
                                                          <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest text-center mt-2 transition-colors ${
                                                              isCurrent ? clientStatus.color : 
                                                              isPast ? (isLightMode ? 'text-slate-800' : 'text-slate-300') : 
                                                              (isLightMode ? 'text-slate-400' : 'text-slate-600')
                                                          }`}>
                                                              {step.label}
                                                          </span>
                                                      </div>
                                                  )
                                              })}
                                          </div>
                                      </div>

                                      {/* COMPACT ATTACHMENT */}
                                      {job.attachment_url && (
                                          <div className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${isLightMode ? 'bg-sky-50 border-sky-200' : 'bg-sky-500/10 border-sky-500/30'}`}>
                                              <div className="flex items-center gap-2">
                                                  <span className="text-xl">📎</span>
                                                  <div>
                                                      <h4 className="text-[9px] font-black text-sky-600 dark:text-sky-500 uppercase tracking-widest">Production File</h4>
                                                  </div>
                                              </div>
                                              <a href={job.attachment_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-[8px] font-black uppercase tracking-widest transition-all">
                                                  View
                                              </a>
                                          </div>
                                      )}

                                      {/* COMPACT ARTWORK APPROVAL BANNER */}
                                      {clientStatus.step === 1 && job.stage === "Artwork" && (
                                          <div className={`p-3 rounded-lg border flex flex-col sm:flex-row items-center justify-between gap-3 ${isLightMode ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/10 border-amber-500/30'}`}>
                                              <div>
                                                  <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">Action Required</h4>
                                                  <p className={`text-[9px] font-bold ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>Sign off on proof to begin production.</p>
                                              </div>
                                              <button 
                                                  onClick={() => setApprovingJob(job)}
                                                  className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-md text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap"
                                              >
                                                  Review →
                                              </button>
                                          </div>
                                      )}

                                      {/* COMPACT + VISIBLE ORDER SPECIFICS */}
                                      {jobQuote && jobQuote.quote_items && jobQuote.quote_items.length > 0 && (
                                          <div className={`p-4 rounded-lg border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-white/5'}`}>
                                              <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${theme.textMuted}`}>Order Specifics</h4>
                                              <div className="flex flex-col gap-3">
                                                  {jobQuote.quote_items.map((item: any, i: number) => (
                                                      <div key={i} className="flex flex-col">
                                                          <span className={`text-sm md:text-base font-black uppercase tracking-tight ${theme.textMain}`}>
                                                              <span className="text-sky-500 mr-2">{item.quantity}x</span>{item.description}
                                                          </span>
                                                          {item.quote_item_variants && item.quote_item_variants.map((v: any, vi: number) => {
                                                              const sizes = [];
                                                              if (v.xs > 0) sizes.push(`XS:${v.xs}`);
                                                              if (v.s > 0) sizes.push(`S:${v.s}`);
                                                              if (v.m > 0) sizes.push(`M:${v.m}`);
                                                              if (v.l > 0) sizes.push(`L:${v.l}`);
                                                              if (v.xl > 0) sizes.push(`XL:${v.xl}`);
                                                              if (v.xxl > 0) sizes.push(`2XL:${v.xxl}`);
                                                              if (v.xxxl > 0) sizes.push(`3XL:${v.xxxl}`);
                                                              
                                                              if (sizes.length === 0) return null;
                                                              
                                                              return (
                                                                  <div key={vi} className={`mt-2 ml-0 sm:ml-4 p-2.5 rounded-md border flex flex-wrap items-center gap-2 md:gap-3 ${isLightMode ? 'bg-white border-slate-200' : 'bg-black/40 border-white/10'}`}>
                                                                      <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>
                                                                          Color: <span className={theme.textMain}>{v.color}</span>
                                                                      </span>
                                                                      <span className={`hidden sm:block w-px h-3 ${isLightMode ? 'bg-slate-300' : 'bg-slate-700'}`}></span>
                                                                      <span className={`text-[10px] font-bold tracking-wide ${theme.textMain}`}>
                                                                          Sizes: <span className="text-sky-500">{sizes.join(', ')}</span>
                                                                      </span>
                                                                  </div>
                                                              );
                                                          })}
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      )}

                                      {/* COMPACT ACTION BUTTONS */}
                                      <div className={`flex flex-col sm:flex-row gap-2 pt-2 border-t ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                                          
                                          {hasPaid ? (
                                              <div className="flex-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-default">
                                                  <span>✓</span> Paid
                                              </div>
                                          ) : (
                                              <button 
                                                  onClick={() => {
                                                      if (jobQuote) {
                                                          setActiveTab("billing");
                                                      } else {
                                                          alert("No payment details found for this order.");
                                                      }
                                                  }}
                                                  className="flex-[1.5] px-2 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all text-center leading-tight shadow-sm"
                                              >
                                                  Pay For Order To Move To Production
                                              </button>
                                          )}

                                          <div className="flex-1 relative group flex">
                                              {hasPaid ? (
                                                  <Link 
                                                      href={`/portal/invoices/${jobQuote?.id}`}
                                                      className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all border ${
                                                          isLightMode ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-transparent border-white/20 text-white hover:bg-white/5'
                                                      }`}
                                                  >
                                                      View Invoice
                                                  </Link>
                                              ) : (
                                                  <button 
                                                      disabled={true}
                                                      className="flex-1 px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all border bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500"
                                                  >
                                                      Invoice Locked
                                                  </button>
                                              )}
                                              
                                              {!hasPaid && (
                                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-36 p-1.5 bg-slate-900 text-white text-[8px] font-bold text-center rounded shadow-xl z-10 pointer-events-none">
                                                      Invoice available after payment.
                                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                  </div>
                                              )}
                                          </div>

                                          <Link 
                                              href={`/portal/quotes/${jobQuote?.id}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`flex-1 flex items-center justify-center text-center px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all border ${
                                                  isLightMode ? 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                                              }`}
                                          >
                                              PO View
                                          </Link>

                                          <button 
                                              onClick={() => setApprovingJob(job)}
                                              className={`flex-1 px-3 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all border ${
                                                  isLightMode ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-600 hover:bg-fuchsia-100' : 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20'
                                              }`}
                                          >
                                              Proof View
                                          </button>
                                      </div>

                                  </div>
                              )
                          })
                      )}
                  </div>
              )}

              {/* TAB CONTENT: THE BRAND VAULT (COMPACT) */}
              {activeTab === "vault" && (
                  <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                      <div className={`${theme.bgPanel} border ${theme.border} rounded-xl p-5 shadow-sm transition-colors`}>
                          <div className={`border-b ${isLightMode ? 'border-slate-200' : 'border-white/5'} pb-3 mb-4`}>
                              <h2 className="text-lg font-black uppercase tracking-tighter italic text-fuchsia-500">The Brand Vault</h2>
                              <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${theme.textMuted}`}>Securely stored digital assets.</p>
                          </div>

                          {loggedInClient?.brand_vault_url ? (
                              <div className={`p-6 rounded-lg border-2 border-fuchsia-500/30 flex flex-col items-center justify-center text-center ${isLightMode ? 'bg-fuchsia-50' : 'bg-fuchsia-500/5'}`}>
                                  <span className="text-3xl mb-2">🗄️</span>
                                  <h3 className="text-sm font-black uppercase tracking-widest mb-1 text-fuchsia-500">Asset Directory</h3>
                                  <p className={`text-[10px] font-bold mb-4 ${theme.textMuted} max-w-sm`}>Access your high-res vector logos, embroidery files, and guidelines.</p>
                                  <a href={loggedInClient.brand_vault_url} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-sm">
                                      Access Secure Drive →
                                  </a>
                              </div>
                          ) : (
                             <div className={`p-6 text-center border-2 border-dashed rounded-lg text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'border-slate-300 text-slate-500' : 'border-slate-800 text-slate-500'}`}>
                                 Your Brand Vault is being provisioned.
                             </div>
                          )}
                      </div>
                  </div>
              )}

              {/* TAB CONTENT: HISTORY & REORDER (COMPACT) */}
              {activeTab === "history" && (
                  <div className="flex flex-col gap-3">
                      {clientQuotes.filter(q => q.status === "Approved" || q.status === "Draft").map(quote => (
                          <div key={quote.id} className={`${theme.bgPanel} border ${theme.border} rounded-lg p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors`}>
                              <div className="flex-grow">
                                  <div className="flex items-center gap-2 mb-2">
                                      <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>PO: {quote.id.split('-')[0].toUpperCase()}</span>
                                      <button 
                                          title="Copy PO Number"
                                          onClick={() => {
                                              navigator.clipboard.writeText(quote.id.split('-')[0].toUpperCase());
                                          }}
                                          className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded transition-colors cursor-pointer ${isLightMode ? 'bg-sky-100 text-sky-600' : 'bg-sky-500/20 text-sky-400'}`}
                                      >
                                          📋
                                      </button>
                                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${isLightMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{new Date(quote.created_at).toLocaleDateString()}</span>
                                      {quote.status === "Draft" && (
                                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-500 border-amber-500/30">Processing</span>
                                      )}
                                  </div>
                                  <div className={`flex flex-col border-l-2 pl-2 mt-1 ${isLightMode ? 'border-slate-300' : 'border-slate-700'}`}>
                                      {quote.quote_items?.map((item: any, i: number) => (
                                          <span key={i} className={`text-[10px] font-bold uppercase truncate ${theme.textMain}`}>
                                              <span className="text-sky-500 mr-1">{item.quantity}x</span>{item.description}
                                          </span>
                                      ))}
                                  </div>
                              </div>
                              <div className={`shrink-0 flex flex-col items-end gap-2 w-full md:w-auto border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 ${isLightMode ? 'border-slate-200' : 'border-slate-800'}`}>
                                  {quote.status === "Approved" ? (
                                      <>
                                          <span className="text-lg font-black">${(quote.total_amount * 1.13).toFixed(2)}</span>
                                          <div className="flex flex-row gap-2 w-full md:w-auto">
                                              <Link 
                                                  href={`/quotes/${quote.id}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className={`flex-1 flex items-center justify-center text-center px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm transition-all border ${isLightMode ? 'bg-white border-slate-200 text-slate-700' : 'bg-transparent border-white/10 text-white'}`}
                                              >
                                                  PO
                                              </Link>
                                              <button 
                                                  onClick={() => handleRequestReorder(quote)} 
                                                  disabled={reorderingId === quote.id}
                                                  className={`flex-[2] px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm transition-all border ${reorderingId === quote.id ? 'bg-sky-600 text-white cursor-wait border-sky-500' : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'}`}
                                              >
                                                  {reorderingId === quote.id ? 'Wait...' : '↻ Reorder'}
                                              </button>
                                          </div>
                                      </>
                                  ) : (
                                      <span className={`text-[9px] font-black uppercase tracking-widest ${theme.textMuted}`}>Pricing TBD</span>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              )}

              {/* TAB CONTENT: BILLING & PAYMENTS (COMPACT) */}
              {activeTab === "billing" && (
                  <div className="flex flex-col gap-3">
                      {clientQuotes.filter(q => q.status === "Approved").map(quote => {
                          const totalWithTax = quote.total_amount * 1.13;
                          const balance = totalWithTax - (quote.amount_paid || 0);
                          const isPaid = balance <= 0.01;

                          return (
                              <div key={quote.id} className={`${theme.bgPanel} border rounded-lg p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${
                                  isPaid 
                                      ? (isLightMode ? 'border-emerald-500/30 bg-emerald-50' : 'border-emerald-500/30 bg-emerald-950/10') 
                                      : (isLightMode ? 'border-red-500/30 bg-red-50' : 'border-red-500/30 bg-red-950/10')
                              }`}>
                                  <div>
                                      <span className={`text-[9px] font-black uppercase tracking-widest mb-0.5 block ${theme.textMuted}`}>PO REF: {quote.id.split('-')[0].toUpperCase()}</span>
                                      <h3 className={`text-sm font-black uppercase tracking-tighter ${isPaid ? 'text-emerald-500' : 'text-red-500'}`}>
                                          {isPaid ? 'Paid' : 'Balance Due'}
                                      </h3>
                                  </div>
                                  <div className="flex items-center justify-end gap-3 w-full md:w-auto">
                                      <div className="flex flex-col items-end">
                                          <span className={`text-lg font-black ${isPaid ? 'text-emerald-500' : 'text-red-500'}`}>
                                              ${isPaid ? '0.00' : balance.toFixed(2)}
                                          </span>
                                          <span className={`text-[8px] font-bold uppercase tracking-widest ${theme.textMuted}`}>
                                              Total: ${totalWithTax.toFixed(2)}
                                          </span>
                                      </div>
                                      
                                      {!isPaid ? (
                                          <button 
                                              onClick={() => handlePayInvoice(quote)}
                                              disabled={processingPaymentId === quote.id}
                                              className={`w-full md:w-auto px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm transition-all whitespace-nowrap ${processingPaymentId === quote.id ? 'bg-red-800 text-red-300 cursor-wait border-none' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                                          >
                                              {processingPaymentId === quote.id ? 'Wait...' : 'Pay Stripe'}
                                          </button>
                                      ) : (
                                          <Link 
                                              href={`/invoices/${quote.id}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`w-full md:w-auto px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm transition-all whitespace-nowrap text-center bg-emerald-600 hover:bg-emerald-500 text-white`}
                                          >
                                              Receipt
                                          </Link>
                                      )}
                                  </div>
                              </div>
                          )
                      })}
                      
                      {clientQuotes.filter(q => q.status === "Approved").length === 0 && (
                          <div className={`p-5 text-center border-2 border-dashed rounded-lg text-[10px] font-black uppercase tracking-widest mt-2 ${isLightMode ? 'border-slate-300 text-slate-500' : 'border-slate-800 text-slate-500'}`}>
                              No billing history available.
                          </div>
                      )}
                  </div>
              )}

              {/* ============================================================================ */}
              {/* TAB CONTENT: SUBMIT NEW ORDER FORM (COMPACT) */}
              {/* ============================================================================ */}
              {activeTab === "new" && (
                  <form onSubmit={handleSubmitNewOrder} className="flex flex-col gap-4 animate-in fade-in duration-300">
                      
                      {/* PROMO BANNER (COMPACT) */}
                      <div className={`relative overflow-hidden rounded-xl border p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 transition-all ${isLightMode ? 'bg-gradient-to-br from-fuchsia-50 to-sky-50 border-fuchsia-200' : 'bg-gradient-to-br from-fuchsia-900/20 to-sky-900/20 border-fuchsia-500/30'}`}>
                          <div className="absolute -top-12 -right-12 w-32 h-32 bg-fuchsia-500/20 rounded-full blur-2xl pointer-events-none"></div>
                          <div className="relative z-10 flex-1">
                              <span className="inline-block px-2 py-0.5 bg-fuchsia-500 text-white text-[7px] font-black uppercase tracking-widest rounded mb-1.5 shadow-sm">New</span>
                              <h2 className="text-lg font-black uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-sky-500 mb-1">
                                  3D Design Studio
                              </h2>
                              <p className={`text-[10px] font-bold leading-relaxed max-w-sm ${theme.textMuted}`}>
                                  Drag, drop, and scale your artwork visually instead of typing details.
                              </p>
                          </div>
                          <div className="relative z-10 w-full md:w-auto">
                              <Link 
                                  href="/portal/studio" 
                                  className="block w-full text-center px-5 py-2.5 bg-white dark:bg-black text-black dark:text-white border border-transparent hover:border-fuchsia-500 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] shadow-md transition-all"
                              >
                                  Launch Studio ✨
                              </Link>
                          </div>
                      </div>

                      {/* Step 1: Garments */}
                      <div className={`${theme.bgPanel} border ${theme.border} rounded-xl p-4 md:p-5 shadow-sm transition-colors`}>
                          <div className={`border-b ${isLightMode ? 'border-slate-200' : 'border-white/5'} pb-2 mb-3`}>
                              <h2 className="text-sm font-black uppercase tracking-tighter italic">1. Garments</h2>
                          </div>

                          <div className="flex flex-col gap-3">
                              {newOrderItems.map((item, idx) => {
                                  const rowTotal = item.xs + item.s + item.m + item.l + item.xl + item.xxl + item.xxxl;
                                  return (
                                      <div key={idx} className={`p-3 rounded-lg border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'} relative group transition-colors`}>
                                          {newOrderItems.length > 1 && (
                                              <button type="button" onClick={() => handleRemoveGarmentItem(idx)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-black shadow opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-400">
                                                  ×
                                              </button>
                                          )}

                                          <div className="flex flex-col md:flex-row gap-3 mb-2">
                                              <div className="flex-[2]">
                                                  <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Type/Brand</label>
                                                  <input 
                                                      type="text" required value={item.description} onChange={(e) => handleGarmentChange(idx, 'description', e.target.value)}
                                                      placeholder="e.g. Gildan 5000 T-Shirt"
                                                      className={`w-full rounded-md px-3 py-1.5 text-xs font-bold outline-none shadow-inner border ${theme.inputBg}`}
                                                  />
                                              </div>
                                              <div className="flex-1">
                                                  <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Color</label>
                                                  <input 
                                                      type="text" required value={item.color} onChange={(e) => handleGarmentChange(idx, 'color', e.target.value)}
                                                      placeholder="e.g. Black"
                                                      className={`w-full rounded-md px-3 py-1.5 text-xs font-bold outline-none shadow-inner border ${theme.inputBg}`}
                                                  />
                                              </div>
                                          </div>

                                          <div>
                                              <label className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Quantities</label>
                                              <div className="flex flex-wrap gap-1.5 items-center">
                                                  {["xs", "s", "m", "l", "xl", "xxl", "xxxl"].map((sz) => (
                                                      <div key={sz} className="flex-1 min-w-[40px]">
                                                          <div className={`text-[7px] font-black text-center mb-0.5 uppercase ${theme.textMuted}`}>{sz}</div>
                                                          <input 
                                                              type="number" min="0" value={(item as any)[sz] || ""} onChange={(e) => handleGarmentChange(idx, sz, parseInt(e.target.value) || 0)}
                                                              className={`w-full rounded bg-transparent px-1 py-1 text-center text-xs font-black outline-none shadow-inner border focus:border-sky-500 ${theme.inputBg}`}
                                                          />
                                                      </div>
                                                  ))}
                                                  <div className="flex-1 min-w-[45px] flex flex-col justify-end h-full">
                                                      <div className={`text-[7px] font-black text-center mb-0.5 uppercase text-sky-500`}>Total</div>
                                                      <div className={`w-full rounded px-1 py-1 text-center text-xs font-black border border-sky-500/30 bg-sky-500/10 text-sky-500`}>{rowTotal}</div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  )
                              })}
                          </div>
                          
                          <button type="button" onClick={handleAddGarmentItem} className={`mt-3 w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-dashed transition-colors ${isLightMode ? 'border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-sky-400 hover:text-sky-600' : 'border-slate-700 text-slate-400 hover:bg-black/60 hover:border-sky-500 hover:text-sky-400'}`}>
                              + Add Row
                          </button>
                      </div>

                      {/* Step 2: Print */}
                      <div className={`${theme.bgPanel} border ${theme.border} rounded-xl p-4 md:p-5 shadow-sm transition-colors`}>
                          <div className={`border-b ${isLightMode ? 'border-slate-200' : 'border-white/5'} pb-2 mb-3`}>
                              <h2 className="text-sm font-black uppercase tracking-tighter italic">2. Decoration Specs</h2>
                          </div>

                          <div className="flex flex-col md:flex-row gap-3 mb-3">
                              <div className="flex-1">
                                  <label className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Front Details</label>
                                  <textarea 
                                      rows={2} value={newOrderFrontPrint} onChange={(e) => setNewOrderFrontPrint(e.target.value)}
                                      placeholder="Left chest logo..."
                                      className={`w-full rounded-lg px-3 py-2 text-xs outline-none shadow-inner border custom-scrollbar ${theme.inputBg}`}
                                  />
                              </div>
                              <div className="flex-1">
                                  <label className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Back Details</label>
                                  <textarea 
                                      rows={2} value={newOrderBackPrint} onChange={(e) => setNewOrderBackPrint(e.target.value)}
                                      placeholder="Large center back..."
                                      className={`w-full rounded-lg px-3 py-2 text-xs outline-none shadow-inner border custom-scrollbar ${theme.inputBg}`}
                                  />
                              </div>
                          </div>

                          <div className="mb-3">
                              <label className={`text-[9px] font-black uppercase tracking-widest block mb-1 ${theme.textMuted}`}>Additional Notes</label>
                              <textarea 
                                  rows={1} value={newOrderNotes} onChange={(e) => setNewOrderNotes(e.target.value)}
                                  placeholder="Deadlines, questions?"
                                  className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none shadow-inner border custom-scrollbar ${theme.inputBg}`}
                              />
                          </div>

                          <div>
                              <div className={`border border-dashed rounded-lg p-3 text-center transition-colors ${isLightMode ? 'border-slate-300 bg-slate-50' : 'border-slate-700 bg-black/40'}`}>
                                  <input type="file" multiple className={`block w-full text-xs ${theme.textMuted} file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-sky-500/10 file:text-sky-500 cursor-pointer`} />
                              </div>
                          </div>
                      </div>

                      {/* Step 3: UPSELLS */}
                      <div className={`${theme.bgPanel} border ${theme.border} rounded-xl p-4 md:p-5 shadow-sm transition-colors`}>
                          <div className={`border-b ${isLightMode ? 'border-slate-200' : 'border-white/5'} pb-2 mb-3`}>
                              <h2 className="text-sm font-black uppercase tracking-tighter italic text-sky-500">3. Retail Finishes</h2>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              <div 
                                  onClick={() => setUpsellPolyBag(!upsellPolyBag)}
                                  className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${upsellPolyBag ? 'bg-sky-500/10 border-sky-500' : (isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5')}`}
                              >
                                  <div className="flex justify-between items-start mb-2">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${upsellPolyBag ? 'bg-sky-500 text-white' : (isLightMode ? 'bg-slate-200 text-slate-500' : 'bg-slate-800 text-slate-400')}`}>🛍️</div>
                                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${upsellPolyBag ? 'bg-sky-500 border-sky-500 text-white' : (isLightMode ? 'border-slate-300 text-transparent' : 'border-slate-600 text-transparent')}`}>✓</div>
                                  </div>
                                  <h4 className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${theme.textMain}`}>Poly-Bagging</h4>
                                  <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500`}>+ $0.85/ea</span>
                              </div>
                          </div>
                      </div>

                      {/* Step 4: SHIPPING */}
                      <div className={`${theme.bgPanel} border ${theme.border} rounded-xl p-4 md:p-5 shadow-sm transition-colors`}>
                          <label className={`flex items-center gap-3 cursor-pointer group p-3 border-2 rounded-lg transition-all ${blindDropShip ? 'bg-indigo-500/10 border-indigo-500' : (isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5')}`}>
                              <input 
                                  type="checkbox" 
                                  checked={blindDropShip}
                                  onChange={(e) => setBlindDropShip(e.target.checked)}
                                  className="peer sr-only"
                              />
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${blindDropShip ? 'bg-indigo-500 border-indigo-500' : (isLightMode ? 'border-slate-300' : 'border-slate-600')}`}>
                                  {blindDropShip && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" stroke="currentColor" d="M5 13l4 4L19 7"></path></svg>}
                              </div>
                              <div>
                                  <span className={`text-[10px] font-black uppercase tracking-widest block mb-0.5 ${theme.textMain}`}>Blind Drop-Shipping</span>
                                  <span className={`text-[9px] font-bold ${theme.textMuted}`}>Ship white-label directly to my customer.</span>
                              </div>
                          </label>
                      </div>

                      {/* Step 5: TURNAROUND */}
                      <div className={`${theme.bgPanel} border ${theme.border} rounded-xl p-4 md:p-5 shadow-sm transition-colors`}>
                          <div className={`border-b ${isLightMode ? 'border-slate-200' : 'border-white/5'} pb-2 mb-3`}>
                              <h2 className="text-sm font-black uppercase tracking-tighter italic text-amber-500">4. Speed</h2>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {[
                                  { id: 'standard', title: 'Standard', time: '14 Days', fee: 'Free', icon: '📦', color: 'amber-500' },
                                  { id: 'expedited', title: 'Priority', time: '7 Days', fee: '+15%', icon: '🚀', color: 'amber-500' },
                                  { id: 'lightning', title: 'Lightning', time: '3 Days', fee: '+40%', icon: '⚡', color: 'red-500' }
                              ].map(tier => (
                                  <div key={tier.id} onClick={() => setTurnaroundTier(tier.id as any)} className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col ${turnaroundTier === tier.id ? `bg-${tier.color}/10 border-${tier.color}` : (isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5')}`}>
                                      <div className="flex justify-between items-start mb-2">
                                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${turnaroundTier === tier.id ? `bg-${tier.color} text-white` : (isLightMode ? 'bg-slate-200' : 'bg-slate-800')}`}>{tier.icon}</div>
                                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${turnaroundTier === tier.id ? `bg-${tier.color} border-${tier.color} text-white` : (isLightMode ? 'border-slate-300 text-transparent' : 'border-slate-600 text-transparent')}`}>✓</div>
                                      </div>
                                      <h4 className={`text-[10px] font-black uppercase tracking-widest mb-1 ${theme.textMain}`}>{tier.title}</h4>
                                      <div className="flex justify-between items-center mt-auto pt-2 border-t border-inherit">
                                          <span className={`text-[9px] font-black uppercase ${theme.textStrong}`}>{tier.time}</span>
                                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-${tier.color}/10 text-${tier.color}`}>{tier.fee}</span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* AI SUGGESTION */}
                      {!aiSuggestionAdded && currentTotalQty > 0 && (
                          <div className={`${isLightMode ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-900/10 border-indigo-500/30'} border rounded-xl p-3 shadow-sm relative overflow-hidden transition-colors`}>
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-10">
                                  <div>
                                      <div className="flex items-center gap-1.5 mb-1">
                                          <span>{aiSuggestion.icon}</span>
                                          <h4 className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Pairs With</h4>
                                      </div>
                                      <h3 className={`text-xs font-black uppercase tracking-tighter ${theme.textMain}`}>{aiSuggestion.title}</h3>
                                  </div>
                                  <button type="button" onClick={applyAiSuggestion} className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                                      + Bundle {Math.max(25, currentTotalQty)}
                                  </button>
                              </div>
                          </div>
                      )}

                      {/* Submission Footer */}
                      <div className={`${theme.bgPanel} border ${theme.border} rounded-xl p-3 shadow-sm flex justify-between items-center sticky bottom-2 z-40 transition-colors`}>
                          <div className="flex flex-col">
                              <span className={`text-[8px] font-black uppercase tracking-widest ${theme.textMuted}`}>Total Qty</span>
                              <span className="text-lg font-black text-emerald-500">{currentTotalQty}</span>
                          </div>
                          <button 
                              type="submit" 
                              disabled={isSubmittingOrder}
                              className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] shadow-sm transition-all ${isSubmittingOrder ? 'bg-sky-800 text-sky-400 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white'}`}
                          >
                              {isSubmittingOrder ? 'Submitting...' : 'Submit Request →'}
                          </button>
                      </div>
                  </form>
              )}

          </div>

          {/* ============================================================================ */}
          {/* MODAL: DIGITAL ARTWORK APPROVAL ENGINE (COMPACT) */}
          {/* ============================================================================ */}
          {approvingJob && (
              <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-5 animate-in fade-in duration-200">
                  <div className={`${theme.bgPanel} border ${theme.border} rounded-xl w-full max-w-2xl p-4 shadow-2xl relative flex flex-col max-h-[90vh] transition-colors`}>
                      <div className={`flex justify-between items-start border-b ${isLightMode ? 'border-slate-200' : 'border-white/10'} pb-2 mb-3 shrink-0`}>
                          <div>
                              <h2 className={`text-base font-black uppercase italic tracking-tighter leading-none ${theme.textMain}`}>Artwork Approval</h2>
                              <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${theme.textMuted}`}>#{approvingJob.job_number} • {approvingJob.title}</p>
                          </div>
                          <button onClick={() => setApprovingJob(null)} className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded border ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'}`}>Close</button>
                      </div>
                      
                      <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-4">
                          {(() => {
                              let catalogueItems = [];
                              try {
                                  if (approvingJob.design_proof) {
                                      catalogueItems = JSON.parse(approvingJob.design_proof);
                                  }
                              } catch (e) { console.error("Catalogue parse error", e); }

                              if (catalogueItems && catalogueItems.length > 0) {
                                  return (
                                      <div className="flex flex-col gap-8 mb-6">
                                          {catalogueItems.map((item: any, idx: number) => (
                                              <div key={idx} className="flex flex-col gap-2.5">
                                                  <div className="flex items-center gap-2 px-1">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                                                      <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.textMuted}`}>{item.title}</h3>
                                                  </div>
                                                  <div className={`w-full rounded-xl overflow-hidden border shadow-xl ${isLightMode ? 'bg-white border-slate-200' : 'bg-black border-white/10'}`}>
                                                      <img src={item.url} alt={item.title} className="w-full h-auto" />
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  );
                              }

                              // Fallback for legacy jobs with only basic mockups
                              return (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                      <div className="flex flex-col gap-1.5">
                                          <h3 className={`text-[9px] font-black uppercase tracking-widest text-center ${theme.textMuted}`}>Front Proof</h3>
                                          <div className={`w-full rounded-lg aspect-square flex items-center justify-center p-2 border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'}`}>
                                              {approvingJob.front_mockup ? <img src={approvingJob.front_mockup} alt="Front View" className="max-h-full object-contain rounded drop-shadow" /> : <span className={`text-[9px] font-black uppercase ${theme.textMuted}`}>No Front Print</span>}
                                          </div>
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                          <h3 className={`text-[9px] font-black uppercase tracking-widest text-center ${theme.textMuted}`}>Back Proof</h3>
                                          <div className={`w-full rounded-lg aspect-square flex items-center justify-center p-2 border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'}`}>
                                              {approvingJob.back_mockup ? <img src={approvingJob.back_mockup} alt="Back View" className="max-h-full object-contain rounded drop-shadow" /> : <span className={`text-[9px] font-black uppercase ${theme.textMuted}`}>No Back Print</span>}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })()}

                          <div className={`p-3 rounded-lg border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-white/10'}`}>
                              {approvingJob.stage === "Artwork" ? (
                                  <>
                                      <label className="flex items-start gap-2 cursor-pointer group mb-2">
                                          <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="peer sr-only"/>
                                          <div className={`w-4 h-4 mt-0.5 rounded border-2 flex shrink-0 items-center justify-center ${agreedToTerms ? 'bg-sky-500 border-sky-500' : (isLightMode ? 'border-slate-300' : 'border-slate-600')}`}>
                                              {agreedToTerms && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                          </div>
                                          <span className={`text-[9px] font-bold leading-tight ${theme.textMuted}`}>I confirm spelling, layout, and print dimensions are correct. Once signed, this job cannot be altered.</span>
                                      </label>
                                      <div>
                                          <input type="text" value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder="Type Full Name to Sign" className={`w-full rounded-md px-2 py-1.5 text-xs font-bold outline-none focus:border-sky-500 border ${theme.inputBg}`}/>
                                      </div>
                                  </>
                              ) : (
                                  <div className="text-center py-2">
                                      <div className="text-xl mb-1">✅</div>
                                      <h3 className={`text-[10px] font-black uppercase text-emerald-500`}>Approved</h3>
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className={`border-t pt-3 mt-3 shrink-0 flex gap-2 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                          {approvingJob.stage === "Artwork" && (
                              <button onClick={handleApproveArtwork} disabled={!agreedToTerms || !signatureName.trim() || isApproving} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${(!agreedToTerms || !signatureName.trim() || isApproving) ? 'bg-slate-300 text-slate-500' : 'bg-emerald-600 text-white'}`}>
                                  {isApproving ? '...' : 'Sign & Approve'}
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          )}

      </div>
  );
}