// Shared parser for the YAYA-META sentinel embedded in `quotes.internal_notes`.
// /quotes/new-v2 saves a `<!--YAYA-META {...} -->` JSON block at the end of
// internal_notes; /quotes/[id] and /quotes (list) read it back so they stay in
// sync with whatever fields the order page captures.
//
// If the sentinel is absent (older quote, or one created via /quotes/new), the
// parser returns null and consumers fall back to whatever they had before.

export type YayaMeta = {
  v?: number;
  orderNumber?: string;
  orderType?: string;
  salesRep?: string;
  paymentStatus?: string;
  depositPercent?: number;
  deliveryMethod?: string;
  rushOrder?: boolean;
  printMethod?: string;
  printLocations?: string[];
  numColors?: number;
  printNotes?: string;
  specialInstructions?: string;
  packagingNotes?: string;
  qcNotes?: string;
  pricing?: {
    subtotal?: number; setupFees?: number; addOnCharges?: number;
    rushFee?: number; shippingFee?: number;
    grandTotal?: number; depositAmount?: number; totalUnits?: number;
  };
  files?: { name: string; url: string; status: string; isImage?: boolean }[];
  workflowSteps?: { id: string; label: string; completedAt: number | null }[];
};

export function parseYayaMeta(internalNotes: string | null | undefined): YayaMeta | null {
  if (!internalNotes) return null;
  const m = internalNotes.match(/<!--YAYA-META\s+([\s\S]*?)\s*-->/);
  if (!m) return null;
  try { return JSON.parse(m[1]) as YayaMeta; }
  catch { return null; }
}
