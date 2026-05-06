"use client";

/* =====================================================================================
   /MY-DAY  —  PERSONAL DAY PLANNER
   =====================================================================================

   ⚠️  RUN THIS SQL IN YOUR SUPABASE SQL EDITOR BEFORE USING THIS PAGE
   --------------------------------------------------------------------------------------

   -- 1. Main personal-task table (separate from production /todos table)
   create table if not exists my_day_tasks (
     id uuid primary key default gen_random_uuid(),
     created_at timestamptz default now() not null,
     updated_at timestamptz default now() not null,

     -- core fields
     title text not null,
     notes text,                                  -- longer description
     target_date date not null,                   -- which day it lives on
     target_time time,                            -- null = unscheduled (in the pool)
     duration_minutes integer default 30,

     -- status
     is_completed boolean default false not null,
     completed_at timestamptz,
     is_deleted boolean default false not null,

     -- categorization
     category text default 'personal',            -- personal | work | admin | sales | production | health | other
     priority text default 'normal',              -- low | normal | high | urgent
     energy text,                                 -- low | medium | high  (energy required to do this)

     -- linking to existing CRM data (both nullable)
     job_id uuid references jobs(id) on delete set null,
     customer_id uuid references customers(id) on delete set null,

     -- subtasks: stored as jsonb array of { id, title, done }
     subtasks jsonb default '[]'::jsonb,

     -- recurrence
     recurrence text default 'none',              -- none | daily | weekdays | weekly | monthly
     recurrence_parent uuid                       -- if this is a generated instance, points to template
       references my_day_tasks(id) on delete cascade,

     -- ordering inside a day for unscheduled pool / Priority tab (lower = higher priority)
     sort_order integer default 0
   );

   -- (already enforced by app: lower sort_order = higher priority in the "Priority" tab.
   --  Quick Capture writes the task type as a prefix in the title, e.g.
   --  "To Press · Auto Master Roofing — 24x Hoodies", so no extra column is needed.)

   -- ── ADDITIONAL COLUMNS FOR FEATURES (run once) ───────────────────────────────
   -- Tracks when the user "started" a task and how long it actually took, so we can
   -- compare estimated vs actual time and self-tune duration estimates.
   alter table my_day_tasks add column if not exists started_at    timestamptz;
   alter table my_day_tasks add column if not exists actual_minutes integer;

   -- For the "I'm in the shop" item-level checklist on production tasks:
   -- the existing `subtasks` jsonb column is reused — each subtask represents
   -- one garment piece (or one item line). No additional column needed.

   create index if not exists idx_my_day_tasks_date on my_day_tasks(target_date) where is_deleted = false;
   create index if not exists idx_my_day_tasks_recurrence on my_day_tasks(recurrence) where recurrence <> 'none';

   -- 2. Daily review table (one row per day, captures end-of-day reflection)
   create table if not exists my_day_reviews (
     id uuid primary key default gen_random_uuid(),
     review_date date not null unique,
     wins text,
     blockers text,
     mood integer,           -- 1-5
     energy integer,         -- 1-5
     tomorrow_focus text,
     created_at timestamptz default now() not null,
     updated_at timestamptz default now() not null
   );

   -- 3. Auto-update updated_at on row changes
   create or replace function set_updated_at() returns trigger as $$
   begin new.updated_at := now(); return new; end;
   $$ language plpgsql;

   drop trigger if exists trg_my_day_tasks_updated on my_day_tasks;
   create trigger trg_my_day_tasks_updated before update on my_day_tasks
     for each row execute function set_updated_at();

   drop trigger if exists trg_my_day_reviews_updated on my_day_reviews;
   create trigger trg_my_day_reviews_updated before update on my_day_reviews
     for each row execute function set_updated_at();

   ===================================================================================== */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "personal",   label: "Personal",   color: "violet"  },
  { id: "work",       label: "Work",       color: "blue"    },
  { id: "admin",      label: "Admin",      color: "slate"   },
  { id: "sales",      label: "Sales",      color: "emerald" },
  { id: "production", label: "Production", color: "orange"  },
  { id: "health",     label: "Health",     color: "rose"    },
  { id: "other",      label: "Other",      color: "amber"   },
];

const CATEGORY_CLASSES: Record<string, { bg: string; text: string; ring: string; chip: string }> = {
  violet:  { bg: "bg-violet-500/10",  text: "text-violet-400",  ring: "ring-violet-500/40",  chip: "bg-violet-500" },
  blue:    { bg: "bg-blue-500/10",    text: "text-blue-400",    ring: "ring-blue-500/40",    chip: "bg-blue-500" },
  slate:   { bg: "bg-slate-500/10",   text: "text-slate-400",   ring: "ring-slate-500/40",   chip: "bg-slate-500" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/40", chip: "bg-emerald-500" },
  orange:  { bg: "bg-orange-500/10",  text: "text-orange-400",  ring: "ring-orange-500/40",  chip: "bg-orange-500" },
  rose:    { bg: "bg-rose-500/10",    text: "text-rose-400",    ring: "ring-rose-500/40",    chip: "bg-rose-500" },
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-400",   ring: "ring-amber-500/40",   chip: "bg-amber-500" },
};

const PRIORITIES = [
  { id: "low",    label: "Low",    color: "text-slate-400" },
  { id: "normal", label: "Normal", color: "text-sky-400" },
  { id: "high",   label: "High",   color: "text-amber-400" },
  { id: "urgent", label: "Urgent", color: "text-red-400" },
];

const ENERGY_LEVELS = [
  { id: "low",    icon: "🌑", label: "Low" },
  { id: "medium", icon: "🌗", label: "Med" },
  { id: "high",   icon: "🌕", label: "High" },
];

const RECURRENCE_OPTIONS = [
  { id: "none",     label: "Once" },
  { id: "daily",    label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly",   label: "Weekly" },
  { id: "monthly",  label: "Monthly" },
];

// ─── JOB PIPELINE ────────────────────────────────────────────────────────────────
// Maps internal job stage → an action verb you'd put on a calendar
const STAGE_VERB: Record<string, string> = {
  "Incoming":  "Review",
  "Artwork":   "Artwork",
  "Sourcing":  "Source",
  "Ordered":   "Track",
  "Received":  "Receive",
  "Staged":    "Stage",
  "Printing":  "Print",
  "Pressing":  "Press",
  "Finishing": "Finish",
  "Dispatch":  "Dispatch",
  "Billing":   "Bill",
  "Paid":      "Close",
};

// "Next-action" stages — the things you actually physically do day-to-day
const NEXT_ACTION_STAGES = ["Artwork", "Printing", "Pressing", "Finishing", "Dispatch"];

const STAGE_COLORS: Record<string, { bg: string; text: string; ring: string; chip: string; cat: string }> = {
  Incoming:  { bg: "bg-slate-500/10",   text: "text-slate-400",   ring: "ring-slate-500/40",   chip: "bg-slate-500",   cat: "production" },
  Artwork:   { bg: "bg-fuchsia-500/10", text: "text-fuchsia-400", ring: "ring-fuchsia-500/40", chip: "bg-fuchsia-500", cat: "production" },
  Sourcing:  { bg: "bg-amber-500/10",   text: "text-amber-400",   ring: "ring-amber-500/40",   chip: "bg-amber-500",   cat: "production" },
  Ordered:   { bg: "bg-amber-500/10",   text: "text-amber-400",   ring: "ring-amber-500/40",   chip: "bg-amber-500",   cat: "production" },
  Received:  { bg: "bg-amber-500/10",   text: "text-amber-400",   ring: "ring-amber-500/40",   chip: "bg-amber-500",   cat: "production" },
  Staged:    { bg: "bg-amber-500/10",   text: "text-amber-400",   ring: "ring-amber-500/40",   chip: "bg-amber-500",   cat: "production" },
  Printing:  { bg: "bg-pink-500/10",    text: "text-pink-400",    ring: "ring-pink-500/40",    chip: "bg-pink-500",    cat: "production" },
  Pressing:  { bg: "bg-red-500/10",     text: "text-red-400",     ring: "ring-red-500/40",     chip: "bg-red-500",     cat: "production" },
  Finishing: { bg: "bg-teal-500/10",    text: "text-teal-400",    ring: "ring-teal-500/40",    chip: "bg-teal-500",    cat: "production" },
  Dispatch:  { bg: "bg-indigo-500/10",  text: "text-indigo-400",  ring: "ring-indigo-500/40",  chip: "bg-indigo-500",  cat: "production" },
  Billing:   { bg: "bg-blue-500/10",    text: "text-blue-400",    ring: "ring-blue-500/40",    chip: "bg-blue-500",    cat: "admin" },
  Paid:      { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/40", chip: "bg-emerald-500", cat: "admin" },
};

// ─── QUICK CAPTURE TASK TYPES ────────────────────────────────────────────────────
// The 6 task types a user picks per job in the Quick Capture flow.
// `category` decides how the task is colored on the timeline.
const QUICK_TASK_TYPES = [
  { id: "To Purchase", label: "To Purchase", color: "amber",   category: "production" },
  { id: "To Approve",  label: "To Approve",  color: "fuchsia", category: "production" },
  { id: "To Print",    label: "To Print",    color: "pink",    category: "production" },
  { id: "To Press",    label: "To Press",    color: "red",     category: "production" },
  { id: "To Deliver",  label: "To Deliver",  color: "indigo",  category: "production" },
  { id: "To Invoice",  label: "To Invoice",  color: "blue",    category: "admin"      },
];

const TASK_TYPE_CLASSES: Record<string, { bg: string; text: string; ring: string; chip: string; border: string }> = {
  amber:   { bg: "bg-amber-500/10",   text: "text-amber-500",   ring: "ring-amber-500/40",   chip: "bg-amber-500",   border: "border-amber-500/40" },
  fuchsia: { bg: "bg-fuchsia-500/10", text: "text-fuchsia-500", ring: "ring-fuchsia-500/40", chip: "bg-fuchsia-500", border: "border-fuchsia-500/40" },
  pink:    { bg: "bg-pink-500/10",    text: "text-pink-500",    ring: "ring-pink-500/40",    chip: "bg-pink-500",    border: "border-pink-500/40" },
  red:     { bg: "bg-red-500/10",     text: "text-red-500",     ring: "ring-red-500/40",     chip: "bg-red-500",     border: "border-red-500/40" },
  indigo:  { bg: "bg-indigo-500/10",  text: "text-indigo-500",  ring: "ring-indigo-500/40",  chip: "bg-indigo-500",  border: "border-indigo-500/40" },
  blue:    { bg: "bg-blue-500/10",    text: "text-blue-500",    ring: "ring-blue-500/40",    chip: "bg-blue-500",    border: "border-blue-500/40" },
};

// Sum of all quote_items.quantity → used for "1 minute per item" duration.
function totalItemsForJob(job: any): number {
  if (!job?.quotes?.quote_items) return 0;
  return job.quotes.quote_items.reduce((s: number, qi: any) => s + (Number(qi.quantity) || 0), 0);
}

// Default duration: 1 minute per item, never less than 5, capped at 8h.
function defaultDurationForJob(job: any): number {
  const items = totalItemsForJob(job);
  if (items <= 0) return 30;
  return Math.max(5, Math.min(8 * 60, items));
}

// Parse free-text time input like "930pm", "9:30pm", "21:30", "9pm", optionally
// followed by "-90" to override duration in minutes.
// Returns null if input is empty / un-parseable.
function parseTimeInput(raw: string): { time: string | null; duration: number | null } | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;

  // split off duration override after "-"
  let timePart = s;
  let durationOverride: number | null = null;
  const dashIdx = s.indexOf("-");
  if (dashIdx >= 0) {
    timePart = s.slice(0, dashIdx);
    const durStr = s.slice(dashIdx + 1).replace(/[^\d.]/g, "");
    if (durStr) {
      const n = parseFloat(durStr);
      if (!isNaN(n) && n > 0) durationOverride = Math.round(n);
    }
  }

  // Now parse time. Supports: "930pm", "9:30pm", "9pm", "21:30", "0930", "9", "12"
  let h = 0, m = 0, ampm: "am" | "pm" | null = null;
  const ampmMatch = timePart.match(/(am|pm)$/);
  if (ampmMatch) {
    ampm = ampmMatch[1] as "am" | "pm";
    timePart = timePart.slice(0, -2);
  }
  // Strip colons
  const digits = timePart.replace(/[^\d]/g, "");
  if (!digits) {
    // No time given but maybe just "-90" → treat as no-time, only duration override
    if (durationOverride !== null) return { time: null, duration: durationOverride };
    return null;
  }

  if (digits.length <= 2) {
    h = parseInt(digits); m = 0;
  } else if (digits.length === 3) {
    h = parseInt(digits.slice(0, 1)); m = parseInt(digits.slice(1));
  } else if (digits.length === 4) {
    h = parseInt(digits.slice(0, 2)); m = parseInt(digits.slice(2));
  } else {
    return null;
  }

  if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null;

  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  // No ampm + h ≤ 7 → assume PM (work-day heuristic). e.g. "5" → 5pm. "12" stays 12pm.
  if (!ampm && h >= 1 && h <= 7) h += 12;

  return {
    time: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`,
    duration: durationOverride,
  };
}

// ─── DEPENDENCY ORDER ─────────────────────────────────────────────────────────────
// Production tasks for the same job follow a natural sequence. When user moves /
// completes one, we suggest cascading the change to later stages.
const DEPENDENCY_ORDER: string[] = [
  "To Approve",
  "To Purchase",
  "To Print",
  "To Press",
  "To Deliver",
  "To Invoice",
];
// Look up a task's "stage rank" purely from the title prefix. Returns -1 if not a
// known production task type.
function taskTypeRank(t: Task): number {
  for (let i = 0; i < DEPENDENCY_ORDER.length; i++) {
    if (t.title.startsWith(DEPENDENCY_ORDER[i])) return i;
  }
  return -1;
}
function taskTypeLabel(t: Task): string | null {
  const r = taskTypeRank(t);
  return r >= 0 ? DEPENDENCY_ORDER[r] : null;
}

// ─── SHORTHAND PARSER ─────────────────────────────────────────────────────────────
// "roof press 930pm-90"  →  { jobMatch: "roof", taskType: "To Press", time: "21:30:00", duration: 90 }
// "auto master print"     →  { jobMatch: "auto master", taskType: "To Print" }
// "prestige invoice"      →  { jobMatch: "prestige", taskType: "To Invoice" }
//
// The parser scans tokens RIGHT-to-LEFT, peeling off optional time, then task
// keyword (any of: purchase/buy, approve, print, press, deliver/ship, invoice/bill).
// Whatever's left is the customer/job search query.
const TASK_KEYWORDS: Record<string, string> = {
  purchase: "To Purchase", buy: "To Purchase", source: "To Purchase",
  approve: "To Approve", artwork: "To Approve", proof: "To Approve",
  print: "To Print",
  press: "To Press",
  deliver: "To Deliver", ship: "To Deliver", dispatch: "To Deliver",
  invoice: "To Invoice", bill: "To Invoice",
};
function parseShorthand(input: string): {
  jobMatch: string;
  taskType: string | null;
  time: string | null;
  duration: number | null;
} | null {
  const raw = input.trim();
  if (!raw) return null;
  const tokens = raw.split(/\s+/);
  if (tokens.length < 2) return null; // need at least "<job> <task>"

  // Try last token as time
  let time: string | null = null;
  let duration: number | null = null;
  let consumedTime = false;
  const parsedTime = parseTimeInput(tokens[tokens.length - 1]);
  if (parsedTime && (parsedTime.time || parsedTime.duration !== null)) {
    time = parsedTime.time;
    duration = parsedTime.duration;
    consumedTime = true;
  }

  const remaining = consumedTime ? tokens.slice(0, -1) : tokens;
  if (remaining.length < 2) return null;

  // Try last remaining token as task keyword
  const lastTok = remaining[remaining.length - 1].toLowerCase();
  const taskType = TASK_KEYWORDS[lastTok] || null;
  if (!taskType) return null;

  const jobMatch = remaining.slice(0, -1).join(" ").toLowerCase().trim();
  if (!jobMatch) return null;

  return { jobMatch, taskType, time, duration };
}

// ─── ITEM CHECKLIST HELPERS ──────────────────────────────────────────────────────
// Build `subtasks` from quote_items grouped by description. Each garment line
// becomes ONE subtask with a counter (e.g., "Hoodies — 0 / 24"). User taps the
// row in shop mode to bump it; checkbox completes when all units done.
function buildItemSubtasks(job: { quotes?: { quote_items?: { description?: string; quantity?: number }[] } | null }): Subtask[] {
  if (!job?.quotes?.quote_items) return [];
  const out: Subtask[] = [];
  for (const qi of job.quotes.quote_items) {
    const qty = Number(qi.quantity) || 0;
    if (qty <= 0) continue;
    const name = (qi.description || "").replace(/\s*\([^)]+\)\s*$/, "").trim() || "Item";
    out.push({
      id: Math.random().toString(36).slice(2),
      title: `${name} — 0 / ${qty}`,
      done: false,
    });
  }
  return out;
}
// Read "Hoodies — 12 / 24" → { name: "Hoodies", done: 12, total: 24 }
function parseItemSubtask(s: Subtask): { name: string; done: number; total: number } | null {
  const m = s.title.match(/^(.+?)\s*[—\-]\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!m) return null;
  return { name: m[1].trim(), done: parseInt(m[2]) || 0, total: parseInt(m[3]) || 0 };
}
function bumpItemSubtask(s: Subtask, delta: number): Subtask {
  const parsed = parseItemSubtask(s);
  if (!parsed) return s;
  const next = Math.max(0, Math.min(parsed.total, parsed.done + delta));
  return {
    ...s,
    title: `${parsed.name} — ${next} / ${parsed.total}`,
    done: next >= parsed.total && parsed.total > 0,
  };
}
function itemChecklistProgress(subtasks: Subtask[]): { done: number; total: number } | null {
  if (!subtasks?.length) return null;
  let done = 0, total = 0, anyParsed = false;
  for (const s of subtasks) {
    const p = parseItemSubtask(s);
    if (p) { done += p.done; total += p.total; anyParsed = true; }
  }
  return anyParsed && total > 0 ? { done, total } : null;
}

// Build a short item summary from quote_items: "24x Hoodies + 12x Tees"
function summarizeItems(quoteItems: any[] | undefined | null, maxLen = 40): string {
  if (!quoteItems || quoteItems.length === 0) return "";
  const parts = quoteItems
    .map((qi: any) => {
      const qty = qi.quantity || 0;
      // Strip "(Single Sided)" / "(Double Sided)" parens from description
      const name = (qi.description || "").replace(/\s*\([^)]+\)\s*$/, "").trim();
      return qty > 0 && name ? `${qty}x ${name}` : "";
    })
    .filter(Boolean);
  if (parts.length === 0) return "";
  let summary = parts.join(" + ");
  if (summary.length > maxLen) summary = summary.slice(0, maxLen - 1) + "…";
  return summary;
}

// Build the auto-title: "Press Prestige Moving — 24x Hoodies"
function buildJobTaskTitle(job: any): string {
  const verb = STAGE_VERB[job.stage] || job.stage || "Do";
  const customer = job.quotes?.customers?.company_name || job.title || `#${job.job_number}`;
  const items = summarizeItems(job.quotes?.quote_items);
  return items ? `${verb} ${customer} — ${items}` : `${verb} ${customer}`;
}

// Hours displayed on the day timeline
const TIMELINE_START_HOUR = 6;   // 6am
const TIMELINE_END_HOUR   = 23;  // 11pm
const PIXELS_PER_HOUR     = 56;

// localStorage cache keys (offline fallback)
const LS_TASK_CACHE = "myday-task-cache-v1";
const LS_QUEUE      = "myday-write-queue-v1";

// ─── TYPES ────────────────────────────────────────────────────────────────────────
type Subtask = { id: string; title: string; done: boolean };

type Task = {
  id: string;
  title: string;
  notes: string | null;
  target_date: string;
  target_time: string | null;
  duration_minutes: number;
  is_completed: boolean;
  completed_at: string | null;
  is_deleted: boolean;
  category: string;
  priority: string;
  energy: string | null;
  job_id: string | null;
  customer_id: string | null;
  subtasks: Subtask[];
  recurrence: string;
  recurrence_parent: string | null;
  sort_order: number;
  // time-tracking (optional columns — see SQL header)
  started_at?: string | null;
  actual_minutes?: number | null;
  // joined data
  jobs?: { job_number: string; title: string } | null;
  customers?: { company_name: string } | null;
};

type Review = {
  review_date: string;
  wins: string;
  blockers: string;
  mood: number | null;
  energy: number | null;
  tomorrow_focus: string;
};

type WriteOp =
  | { kind: "insert"; table: string; payload: any; tempId: string }
  | { kind: "update"; table: string; id: string; payload: any }
  | { kind: "upsert"; table: string; payload: any; onConflict: string }
  | { kind: "delete"; table: string; id: string };

// ─── HELPERS ──────────────────────────────────────────────────────────────────────
const todayISO   = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local TZ
const yesterdayISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString("en-CA"); };
const fmtDayHeader = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
};
const minsFromTime = (t: string | null): number => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const timeFromMins = (mins: number): string => {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}:00`;
};
const fmt12hr = (t: string | null): string => {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr); const m = mStr;
  const am = h < 12; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${am ? "AM" : "PM"}`;
};

// Quick-capture parser: extracts time, date, duration, priority hints from a single string
function parseQuickCapture(input: string): {
  title: string;
  target_time: string | null;
  target_date: string;
  duration_minutes: number;
  priority: string;
  category: string;
} {
  let s = input.trim();
  const today = todayISO();
  let target_date = today;
  let target_time: string | null = null;
  let duration_minutes = 30;
  let priority = "normal";
  let category = "personal";

  // Date keywords
  if (/\btoday\b/i.test(s)) { s = s.replace(/\btoday\b/gi, "").trim(); }
  if (/\btomorrow\b/i.test(s)) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    target_date = d.toLocaleDateString("en-CA");
    s = s.replace(/\btomorrow\b/gi, "").trim();
  }
  // "next monday" etc.
  const dowMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const dowMatch = s.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (dowMatch) {
    const targetDow = dowMap[dowMatch[1].toLowerCase()];
    const d = new Date();
    let delta = (targetDow + 7 - d.getDay()) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    target_date = d.toLocaleDateString("en-CA");
    s = s.replace(dowMatch[0], "").trim();
  }

  // Time: "at 3pm", "at 9:30am", "@ 14:00"
  const timeMatch = s.match(/\b(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1]); const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    target_time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`;
    s = s.replace(timeMatch[0], "").trim();
  }

  // Duration: "for 45m", "for 2h", "for 1.5h"
  const durMatch = s.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(h|hr|hour|hours|m|min|mins|minutes)\b/i);
  if (durMatch) {
    const n = parseFloat(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    duration_minutes = unit.startsWith("h") ? Math.round(n * 60) : Math.round(n);
    s = s.replace(durMatch[0], "").trim();
  }

  // Priority hashtags
  if (/!{2,}|#urgent\b/i.test(s)) { priority = "urgent"; s = s.replace(/!{2,}|#urgent/gi, "").trim(); }
  else if (/!|#high\b/i.test(s)) { priority = "high"; s = s.replace(/!|#high/gi, "").trim(); }
  else if (/#low\b/i.test(s)) { priority = "low"; s = s.replace(/#low/gi, "").trim(); }

  // Category hashtag
  for (const c of CATEGORIES) {
    const re = new RegExp(`#${c.id}\\b`, "i");
    if (re.test(s)) { category = c.id; s = s.replace(re, "").trim(); break; }
  }

  return { title: s.replace(/\s+/g, " ").trim() || "Untitled task", target_time, target_date, duration_minutes, priority, category };
}

// ─── WRITE QUEUE (offline support) ────────────────────────────────────────────────
function loadQueue(): WriteOp[] {
  try { return JSON.parse(localStorage.getItem(LS_QUEUE) || "[]"); } catch { return []; }
}
function saveQueue(q: WriteOp[]) {
  try { localStorage.setItem(LS_QUEUE, JSON.stringify(q)); } catch {}
}
async function flushQueue(onProgress?: () => void): Promise<{ ok: number; failed: number }> {
  const q = loadQueue();
  if (q.length === 0) return { ok: 0, failed: 0 };
  let ok = 0, failed = 0;
  const remaining: WriteOp[] = [];
  for (const op of q) {
    try {
      if (op.kind === "insert") {
        const { error } = await supabase.from(op.table).insert([op.payload]);
        if (error) throw error;
      } else if (op.kind === "update") {
        const { error } = await supabase.from(op.table).update(op.payload).eq("id", op.id);
        if (error) throw error;
      } else if (op.kind === "upsert") {
        const { error } = await supabase.from(op.table).upsert(op.payload, { onConflict: op.onConflict });
        if (error) throw error;
      } else if (op.kind === "delete") {
        const { error } = await supabase.from(op.table).delete().eq("id", op.id);
        if (error) throw error;
      }
      ok++;
    } catch {
      failed++;
      remaining.push(op);
    }
    onProgress?.();
  }
  saveQueue(remaining);
  return { ok, failed };
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────────
export default function MyDayPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [review, setReview] = useState<Review>({ review_date: todayISO(), wins: "", blockers: "", mood: null, energy: null, tomorrow_focus: "" });
  const [jobs, setJobs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [queueDepth, setQueueDepth] = useState(0);
  const [loading, setLoading] = useState(true);

  // UI state
  const [captureInput, setCaptureInput] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  // Tracks ids of tasks with an in-flight DB write. fetchTasks() consults this
  // set so refetches (post-insert, realtime, autoPack…) never overwrite a row
  // whose update is still on the wire — that was the cause of the
  // "time reverts when I add another job" bug. Stored in a ref so it doesn't
  // trigger re-renders.
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const [showReview, setShowReview] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  // Left-rail view tabs: pool (capture + unscheduled) vs priority (drag-reorder list)
  const [leftTab, setLeftTab] = useState<"pool" | "priority">("pool");

  // Job picker state
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState<"next" | "all" | "due">("next");
  const [pickerSearch, setPickerSearch] = useState("");
  const [scheduleJobModal, setScheduleJobModal] = useState<any | null>(null); // job being detail-scheduled

  // Drag state — null means nothing dragging; otherwise this is the job being dragged
  const [draggingJob, setDraggingJob] = useState<any | null>(null);
  const [dropHint, setDropHint] = useState<{ kind: "time" | "pool"; time?: string } | null>(null);
  // When the user grabs an already-scheduled task to move it. Tracked here
  // (rather than via dataTransfer) so the drop preview can read it during
  // dragOver. Cleared in dragEnd / drop handlers.
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  // Timeline view: hourly calendar grid vs. flat list. Persisted so the
  // user's choice survives reloads.
  const [timelineView, setTimelineView] = useState<"calendar" | "list">(() => {
    if (typeof window === "undefined") return "calendar";
    return (localStorage.getItem("yaya-myday-view") as "calendar" | "list") || "calendar";
  });
  useEffect(() => {
    try { localStorage.setItem("yaya-myday-view", timelineView); } catch {}
  }, [timelineView]);

  // Shop mode (full-screen big-button view of today's scheduled tasks)
  const [shopMode, setShopMode] = useState(false);

  // Dependency-cascade prompt (when user moves/completes a production task and there
  // are downstream tasks for the same job that should shift)
  const [depPrompt, setDepPrompt] = useState<{
    sourceTask: Task;
    affected: Task[];
    deltaMs: number;     // how much later/earlier downstream tasks should move
    kind: "move" | "complete";
  } | null>(null);

  // QR code modal — shows a printable QR that toggles a task complete when scanned.
  const [qrTask, setQrTask] = useState<Task | null>(null);

  // Toast notifications (ephemeral feedback)
  const [toast, setToast] = useState<{ kind: "ok" | "info" | "warn"; msg: string } | null>(null);
  const showToast = useCallback((kind: "ok" | "info" | "warn", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ─── ONLINE/OFFLINE DETECTION ─────────────────────────────────────────────────
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online",  updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online",  updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    setQueueDepth(loadQueue().length);
  }, []);

  // Auto-flush queue when we come back online
  useEffect(() => {
    if (!isOnline) return;
    (async () => {
      const result = await flushQueue();
      if (result.ok > 0) await fetchTasks(selectedDate);
      setQueueDepth(loadQueue().length);
    })();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── VOICE DETECTION ──────────────────────────────────────────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  // ─── DATA FETCH ───────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async (date: string) => {
    setLoading(true);
    try {
      // Try server first
      const { data, error } = await supabase
        .from("my_day_tasks")
        .select(`
          *,
          jobs ( job_number, title ),
          customers ( company_name )
        `)
        .eq("target_date", date)
        .eq("is_deleted", false)
        .order("target_time", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true });

      if (error) throw error;
      const fetched = (data || []) as Task[];

      // RECONCILE — never wholesale-overwrite local state. Two rules:
      //   1. Any row whose id is in pendingIdsRef has an in-flight write; trust
      //      the local optimistic copy until that write resolves, otherwise
      //      a stale DB read clobbers the user's edit.
      //   2. Optimistic temp-id rows (recently inserted, real id not yet
      //      assigned) are preserved until a refetch returns a row that
      //      replaces them (matched by tempId or the realtime sub).
      // Without this, "edit time → save → add another job → refetch" would
      // revert the time edit because the refetch raced the update.
      setTasks(prev => {
        const fetchedIds = new Set(fetched.map(t => t.id));
        const merged: Task[] = fetched.map(f => {
          if (pendingIdsRef.current.has(f.id)) {
            const local = prev.find(p => p.id === f.id);
            return local ?? f;
          }
          return f;
        });
        const optimisticTemps = prev.filter(p =>
          typeof p.id === "string" && p.id.startsWith("tmp-") && !fetchedIds.has(p.id)
        );
        return [...merged, ...optimisticTemps];
      });

      // Cache for offline
      try {
        const cache = JSON.parse(localStorage.getItem(LS_TASK_CACHE) || "{}");
        cache[date] = fetched;
        localStorage.setItem(LS_TASK_CACHE, JSON.stringify(cache));
      } catch {}
    } catch {
      // Offline / error → fall back to cache
      try {
        const cache = JSON.parse(localStorage.getItem(LS_TASK_CACHE) || "{}");
        if (cache[date]) setTasks(cache[date]);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReview = useCallback(async (date: string) => {
    try {
      const { data } = await supabase.from("my_day_reviews").select("*").eq("review_date", date).maybeSingle();
      if (data) {
        setReview(data);
      } else {
        setReview({ review_date: date, wins: "", blockers: "", mood: null, energy: null, tomorrow_focus: "" });
      }
    } catch {
      setReview({ review_date: date, wins: "", blockers: "", mood: null, energy: null, tomorrow_focus: "" });
    }
  }, []);

  const fetchLinks = useCallback(async () => {
    try {
      const [jRes, cRes] = await Promise.all([
        supabase.from("jobs")
          .select("id, job_number, title, stage, due_date, created_at, updated_at, quotes(customers(id, company_name, contact_name), quote_items(description, quantity))")
          .not("stage", "in", '("Paid","Completed")')
          .order("updated_at", { ascending: false })
          .limit(150),
        supabase.from("customers").select("id, company_name").order("company_name").limit(200),
      ]);
      if (jRes.data) setJobs(jRes.data);
      if (cRes.data) setCustomers(cRes.data);
    } catch {}
  }, []);

  useEffect(() => { fetchTasks(selectedDate); fetchReview(selectedDate); }, [selectedDate, fetchTasks, fetchReview]);
  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  // ─── QR-SCAN COMPLETION (?complete=<task-id>) ─────────────────────────────────
  // When a task QR is scanned (or visited), the URL has ?complete=<id>. We toggle
  // that task complete (if not already), show a toast, then strip the param.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const completeId = url.searchParams.get("complete");
    if (!completeId) return;

    (async () => {
      // Fetch the row directly (it may be on a different date than the one shown)
      const { data, error } = await supabase
        .from("my_day_tasks")
        .select("*, jobs(job_number, title), customers(company_name)")
        .eq("id", completeId)
        .maybeSingle();
      if (error || !data) {
        showToast("warn", "QR task not found");
      } else if (data.is_completed) {
        showToast("info", `Already done: ${data.title.slice(0, 60)}`);
      } else {
        const nowIso = new Date().toISOString();
        let actual_minutes: number | null = null;
        if (data.started_at) {
          actual_minutes = Math.round((Date.parse(nowIso) - Date.parse(data.started_at)) / 60_000);
        } else if (data.target_time) {
          const startMs = new Date(`${data.target_date}T${data.target_time}`).getTime();
          const diff = (Date.parse(nowIso) - startMs) / 60_000;
          if (diff > 0 && diff < 24 * 60) actual_minutes = Math.round(diff);
        }
        await supabase.from("my_day_tasks").update({
          is_completed: true,
          completed_at: nowIso,
          ...(actual_minutes ? { actual_minutes } : {}),
        }).eq("id", completeId);
        showToast("ok", `✓ ${data.title.slice(0, 60)}`);
        // Refresh the day view if relevant
        if (data.target_date === selectedDate) fetchTasks(selectedDate);
      }
      // Strip the query param without reloading
      url.searchParams.delete("complete");
      window.history.replaceState({}, "", url.toString());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime sync
  useEffect(() => {
    const ch = supabase.channel("my-day-sync").on("postgres_changes",
      { event: "*", schema: "public", table: "my_day_tasks" },
      () => fetchTasks(selectedDate)
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedDate, fetchTasks]);

  // ─── RECURRING TASK SPAWNER ───────────────────────────────────────────────────
  // On mount + when date is "today", expand recurring templates that haven't yet spawned for today.
  useEffect(() => {
    if (selectedDate !== todayISO()) return;
    (async () => {
      try {
        const today = todayISO();
        const { data: templates } = await supabase
          .from("my_day_tasks")
          .select("*")
          .neq("recurrence", "none")
          .is("recurrence_parent", null)
          .eq("is_deleted", false);
        if (!templates) return;

        const dow = new Date(today + "T12:00:00").getDay(); // 0..6
        const dom = new Date(today + "T12:00:00").getDate();
        const weekday = dow >= 1 && dow <= 5;

        const { data: existing } = await supabase
          .from("my_day_tasks")
          .select("recurrence_parent")
          .eq("target_date", today)
          .not("recurrence_parent", "is", null);

        const alreadySpawned = new Set((existing || []).map((r: any) => r.recurrence_parent));

        const toCreate = templates.filter((t: any) => {
          if (alreadySpawned.has(t.id)) return false;
          if (t.recurrence === "daily") return true;
          if (t.recurrence === "weekdays") return weekday;
          if (t.recurrence === "weekly") return new Date(t.target_date + "T12:00:00").getDay() === dow;
          if (t.recurrence === "monthly") return new Date(t.target_date + "T12:00:00").getDate() === dom;
          return false;
        });

        if (toCreate.length === 0) return;
        const rows = toCreate.map((t: any) => ({
          title: t.title, notes: t.notes, target_date: today, target_time: t.target_time,
          duration_minutes: t.duration_minutes, category: t.category, priority: t.priority,
          energy: t.energy, job_id: t.job_id, customer_id: t.customer_id,
          subtasks: t.subtasks, recurrence: "none", recurrence_parent: t.id,
        }));
        await supabase.from("my_day_tasks").insert(rows);
        fetchTasks(today);
      } catch (e) { console.error("Recurrence spawn failed", e); }
    })();
  }, [selectedDate, fetchTasks]);

  // ─── WRITE HELPERS (queue if offline) ─────────────────────────────────────────
  const enqueueOrRun = async (op: WriteOp): Promise<boolean> => {
    // Mark the target row as pending so any concurrent fetchTasks() doesn't
    // clobber the local optimistic value with a stale DB read.
    const pendingId = (op.kind === "update" || op.kind === "delete") ? op.id : null;
    if (pendingId) pendingIdsRef.current.add(pendingId);

    if (!navigator.onLine) {
      const q = loadQueue(); q.push(op); saveQueue(q); setQueueDepth(q.length);
      if (pendingId) pendingIdsRef.current.delete(pendingId);
      return false;
    }
    try {
      if (op.kind === "insert") {
        const { error } = await supabase.from(op.table).insert([op.payload]);
        if (error) throw error;
      } else if (op.kind === "update") {
        const { error } = await supabase.from(op.table).update(op.payload).eq("id", op.id);
        if (error) throw error;
      } else if (op.kind === "upsert") {
        const { error } = await supabase.from(op.table).upsert(op.payload, { onConflict: op.onConflict });
        if (error) throw error;
      } else if (op.kind === "delete") {
        const { error } = await supabase.from(op.table).delete().eq("id", op.id);
        if (error) throw error;
      }
      return true;
    } catch {
      const q = loadQueue(); q.push(op); saveQueue(q); setQueueDepth(q.length);
      return false;
    } finally {
      if (pendingId) pendingIdsRef.current.delete(pendingId);
    }
  };

  // ─── ACTIONS ──────────────────────────────────────────────────────────────────
  const addFromQuickCapture = async () => {
    if (!captureInput.trim()) return;
    const parsed = parseQuickCapture(captureInput);
    const tempId = "tmp-" + Math.random().toString(36).slice(2);
    const optimistic: Task = {
      id: tempId, title: parsed.title, notes: null,
      target_date: parsed.target_date, target_time: parsed.target_time,
      duration_minutes: parsed.duration_minutes, is_completed: false, completed_at: null, is_deleted: false,
      category: parsed.category, priority: parsed.priority, energy: null,
      job_id: null, customer_id: null, subtasks: [], recurrence: "none", recurrence_parent: null, sort_order: 0,
    };
    setTasks(prev => [...prev, optimistic]);
    setCaptureInput("");

    const synced = await enqueueOrRun({ kind: "insert", table: "my_day_tasks", payload: { ...optimistic, id: undefined }, tempId });
    if (synced) {
      // refetch to pick up real id
      if (parsed.target_date === selectedDate) fetchTasks(selectedDate);
    }
  };

  // ─── STRUCTURED QUICK CAPTURE (job bubble + task-type bubble + optional time) ──
  // Inserts both a my_day_tasks row AND a synced production todos row, just like
  // the job picker. Time can be null (= goes to unscheduled pool).
  const quickCaptureFromBubbles = async (args: {
    job: any;
    taskType: typeof QUICK_TASK_TYPES[number];
    time: string | null;
    duration: number;
  }) => {
    const { job, taskType, time, duration } = args;
    const customer = job.quotes?.customers?.company_name || job.title || `#${job.job_number}`;
    const items = summarizeItems(job.quotes?.quote_items);
    // Encode task type into the title so it stays visible everywhere without a schema change.
    const title = items
      ? `${taskType.label} · ${customer} — ${items}`
      : `${taskType.label} · ${customer}`;
    const customer_id = job.quotes?.customers?.id || null;

    // Build an item-level checklist for hands-on production tasks (Print, Press,
    // Deliver). Approval / Purchase / Invoice are admin tasks → no checklist.
    const physicalTask = ["To Print", "To Press", "To Deliver"].includes(taskType.id);
    const subtasks: Subtask[] = physicalTask ? buildItemSubtasks(job) : [];

    const tempId = "tmp-" + Math.random().toString(36).slice(2);
    const optimistic: Task = {
      id: tempId, title, notes: null,
      target_date: selectedDate, target_time: time,
      duration_minutes: duration, is_completed: false, completed_at: null, is_deleted: false,
      category: taskType.category, priority: "normal", energy: null,
      job_id: job.id, customer_id,
      subtasks, recurrence: "none", recurrence_parent: null,
      // New unscheduled rows go to the bottom of the priority list by default
      sort_order: time ? 0 : (Math.max(0, ...tasks.filter(t => !t.target_time).map(t => t.sort_order || 0)) + 1),
      jobs: { job_number: job.job_number, title: job.title } as any,
      customers: customer_id ? { company_name: customer } as any : null,
    };
    setTasks(prev => [...prev, optimistic]);

    const myDayPayload = {
      title, notes: null,
      target_date: selectedDate, target_time: time,
      duration_minutes: duration, category: taskType.category,
      priority: "normal", energy: null,
      job_id: job.id, customer_id,
      subtasks,
      sort_order: optimistic.sort_order,
    };
    const todosPayload = {
      task: title,
      job_id: job.id,
      target_date: selectedDate,
      target_time: time,
      duration_minutes: duration,
      is_completed: false,
      is_deleted: false,
    };

    const [r1] = await Promise.all([
      enqueueOrRun({ kind: "insert", table: "my_day_tasks", payload: myDayPayload, tempId }),
      enqueueOrRun({ kind: "insert", table: "todos",        payload: todosPayload,  tempId: tempId + "-prod" }),
    ]);
    if (r1) await fetchTasks(selectedDate);
  };

  // ─── PRIORITY TAB: reorder unscheduled tasks (drag-and-drop) ──────────────────
  // We rewrite sort_order on every task in the new visual order so that the list
  // stays stable across reloads and across all clients via realtime.
  const reorderTasks = async (orderedIds: string[]) => {
    // Optimistic local update
    const order = new Map(orderedIds.map((id, i) => [id, i]));
    setTasks(prev =>
      prev.map(t => order.has(t.id) ? { ...t, sort_order: order.get(t.id)! } : t)
    );
    // Persist (one update per row — small N, acceptable). Queued offline.
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      // Skip optimistic temp ids — they'll get the right order on the next refetch.
      if (id.startsWith("tmp-")) continue;
      await enqueueOrRun({ kind: "update", table: "my_day_tasks", id, payload: { sort_order: i } });
    }
  };

  // ─── AUTO-PACK THE POOL ───────────────────────────────────────────────────────
  // Walks the unscheduled pool (in priority order) and assigns each task to the
  // earliest open slot on the timeline today, starting from `now` (or from the
  // shift start of 8 AM if it's earlier). Greedy bin-packing — does NOT touch
  // already-scheduled tasks.
  const autoPackPool = async () => {
    const SHIFT_START_HOUR = 8;   // 8 AM
    const SHIFT_END_HOUR   = TIMELINE_END_HOUR; // 11 PM (already a constant)

    type Interval = { start: number; end: number };
    const isToday2 = selectedDate === todayISO();
    const nowFloor = isToday2
      ? Math.max(SHIFT_START_HOUR * 60, Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 15) * 15)
      : SHIFT_START_HOUR * 60;
    const dayEnd = SHIFT_END_HOUR * 60 + 60;

    const busy: Interval[] = tasks
      .filter(t => t.target_time && !t.is_deleted)
      .map(t => {
        const start = minsFromTime(t.target_time);
        return { start, end: start + (t.duration_minutes || 30) };
      })
      .sort((a, b) => a.start - b.start);

    const pool = unscheduledTasks; // already sorted by sort_order
    if (pool.length === 0) {
      showToast("info", "Nothing in the pool to pack");
      return;
    }

    const updates: { id: string; time: string }[] = [];
    let cursor = nowFloor;
    for (const t of pool) {
      const dur = t.duration_minutes || 30;
      let placed = false;
      while (!placed) {
        let conflict: Interval | null = null;
        for (const b of busy) {
          if (cursor < b.end && cursor + dur > b.start) {
            conflict = b; break;
          }
        }
        if (conflict) {
          cursor = conflict.end;
        } else {
          if (cursor + dur > dayEnd) break;
          const snapped = Math.ceil(cursor / 15) * 15;
          if (snapped + dur > dayEnd) break;
          updates.push({ id: t.id, time: timeFromMins(snapped) });
          const interval = { start: snapped, end: snapped + dur };
          const idx = busy.findIndex(b => b.start > interval.start);
          if (idx === -1) busy.push(interval); else busy.splice(idx, 0, interval);
          cursor = interval.end;
          placed = true;
        }
      }
      if (!placed) break;
    }

    if (updates.length === 0) {
      showToast("warn", "No room left in the day to pack tasks");
      return;
    }

    const updateMap = new Map(updates.map(u => [u.id, u.time]));
    setTasks(prev => prev.map(t => updateMap.has(t.id) ? { ...t, target_time: updateMap.get(t.id)! } : t));

    for (const u of updates) {
      if (u.id.startsWith("tmp-")) continue;
      await enqueueOrRun({ kind: "update", table: "my_day_tasks", id: u.id, payload: { target_time: u.time } });
    }
    showToast("ok", `Packed ${updates.length} task${updates.length > 1 ? "s" : ""} into the day`);
  };

  // ─── DEPENDENCY CASCADE ───────────────────────────────────────────────────────
  // When user moves a production task to a new time, downstream tasks (To Press
  // after To Print, etc., for the same job) often need to shift too. We compute
  // the affected list and prompt — never apply automatically.
  const cascadeDependencies = (sourceTask: Task, newTime: string) => {
    if (!sourceTask.job_id || !sourceTask.target_time) return;
    const oldStart = minsFromTime(sourceTask.target_time);
    const newStart = minsFromTime(newTime);
    const deltaMs = (newStart - oldStart) * 60_000;
    if (deltaMs === 0) return;

    const myRank = taskTypeRank(sourceTask);
    if (myRank < 0) return;

    const affected = tasks.filter(t =>
      t.id !== sourceTask.id &&
      t.job_id === sourceTask.job_id &&
      t.target_time &&
      !t.is_completed &&
      !t.is_deleted &&
      taskTypeRank(t) > myRank
    );

    if (affected.length === 0) return;

    setDepPrompt({ sourceTask, affected, deltaMs, kind: "move" });
  };

  // Apply or dismiss the dependency prompt
  const applyDependencyShift = async (shouldShift: boolean) => {
    const prompt = depPrompt;
    if (!prompt) return;
    setDepPrompt(null);
    if (!shouldShift) return;

    setTasks(prev => prev.map(t => {
      const a = prompt.affected.find(x => x.id === t.id);
      if (!a || !a.target_time) return t;
      const old = new Date(`${a.target_date}T${a.target_time}`);
      old.setTime(old.getTime() + prompt.deltaMs);
      const newTime = old.toTimeString().slice(0, 8);
      return { ...t, target_time: newTime };
    }));

    for (const a of prompt.affected) {
      if (!a.target_time) continue;
      const old = new Date(`${a.target_date}T${a.target_time}`);
      old.setTime(old.getTime() + prompt.deltaMs);
      const newTime = old.toTimeString().slice(0, 8);
      await enqueueOrRun({ kind: "update", table: "my_day_tasks", id: a.id, payload: { target_time: newTime } });
    }
    showToast("ok", `Shifted ${prompt.affected.length} downstream task${prompt.affected.length > 1 ? "s" : ""}`);
  };


  const toggleComplete = async (task: Task) => {
    const next = !task.is_completed;
    const nowIso = new Date().toISOString();

    // ─── EST vs ACTUAL TIME TRACKING ──────────────────────────────────────────
    let actual_minutes: number | null | undefined = undefined;
    if (next) {
      let startMs: number | null = null;
      if (task.started_at) {
        startMs = new Date(task.started_at).getTime();
      } else if (task.target_time && task.target_date === todayISO()) {
        startMs = new Date(`${task.target_date}T${task.target_time}`).getTime();
      }
      if (startMs) {
        const diff = (Date.parse(nowIso) - startMs) / 60000;
        if (diff > 0 && diff < 24 * 60) actual_minutes = Math.round(diff);
      }
    } else {
      actual_minutes = null;
    }

    setTasks(prev => prev.map(t => t.id === task.id ? {
      ...t,
      is_completed: next,
      completed_at: next ? nowIso : null,
      ...(actual_minutes !== undefined ? { actual_minutes } : {}),
    } : t));

    const payload: any = { is_completed: next, completed_at: next ? nowIso : null };
    if (actual_minutes !== undefined) payload.actual_minutes = actual_minutes;

    await enqueueOrRun({ kind: "update", table: "my_day_tasks", id: task.id, payload });

    // ─── SUGGEST DEPENDENCY ───────────────────────────────────────────────────
    if (next && task.job_id) {
      const myRank = taskTypeRank(task);
      if (myRank >= 0) {
        const downstream = tasks
          .filter(t =>
            t.id !== task.id &&
            t.job_id === task.job_id &&
            !t.is_completed &&
            !t.is_deleted &&
            taskTypeRank(t) > myRank
          )
          .sort((a, b) => taskTypeRank(a) - taskTypeRank(b));
        if (downstream.length > 0) {
          showToast("ok", `${taskTypeLabel(task)} done — next: ${taskTypeLabel(downstream[0])}`);
        }
      }
    }
  };

  // ─── START TASK (begin the timer for est-vs-actual tracking) ──────────────────
  const startTask = async (task: Task) => {
    if (task.started_at || task.is_completed) return;
    const nowIso = new Date().toISOString();
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, started_at: nowIso } : t));
    await enqueueOrRun({ kind: "update", table: "my_day_tasks", id: task.id, payload: { started_at: nowIso } });
  };

  // ─── ITEM CHECKLIST: bump one subtask up or down ──────────────────────────────
  const bumpItemSubtaskAction = async (task: Task, subtaskId: string, delta: number) => {
    const updated = (task.subtasks || []).map(s => s.id === subtaskId ? bumpItemSubtask(s, delta) : s);
    const allDone = updated.length > 0 && updated.every(s => s.done);

    setTasks(prev => prev.map(t => t.id === task.id ? {
      ...t,
      subtasks: updated,
      ...(allDone && !t.is_completed ? { is_completed: true, completed_at: new Date().toISOString() } : {}),
    } : t));

    const payload: any = { subtasks: updated };
    if (allDone && !task.is_completed) {
      payload.is_completed = true;
      payload.completed_at = new Date().toISOString();
    }
    await enqueueOrRun({ kind: "update", table: "my_day_tasks", id: task.id, payload });

    if (allDone && !task.is_completed) {
      showToast("ok", `${taskTypeLabel(task) || "Task"} complete`);
    }
  };

  const deleteTask = async (task: Task) => {
    setTasks(prev => prev.filter(t => t.id !== task.id));
    await enqueueOrRun({ kind: "update", table: "my_day_tasks", id: task.id, payload: { is_deleted: true } });
  };

  const updateTask = async (task: Task, patch: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...patch } : t));
    // strip joined data + id from payload
    const cleanPatch: any = { ...patch };
    delete cleanPatch.jobs; delete cleanPatch.customers; delete cleanPatch.id;
    await enqueueOrRun({ kind: "update", table: "my_day_tasks", id: task.id, payload: cleanPatch });

    // ─── Trigger dependency cascade prompt ──────────────────────────────────────
    if (
      "target_time" in patch &&
      patch.target_time &&
      task.target_time &&
      patch.target_time !== task.target_time &&
      task.job_id
    ) {
      cascadeDependencies(task, patch.target_time);
    }
  };

  const carryOverFromYesterday = async () => {
    try {
      const y = yesterdayISO();
      const { data: incomplete } = await supabase
        .from("my_day_tasks")
        .select("*")
        .eq("target_date", y).eq("is_completed", false).eq("is_deleted", false)
        .is("recurrence_parent", null);
      if (!incomplete || incomplete.length === 0) {
        alert("Nothing to carry over from yesterday.");
        return;
      }
      if (!confirm(`Carry over ${incomplete.length} incomplete task${incomplete.length > 1 ? "s" : ""} from yesterday to today?`)) return;
      await supabase.from("my_day_tasks").update({ target_date: todayISO() }).in("id", incomplete.map((t: any) => t.id));
      fetchTasks(selectedDate);
    } catch (e) { console.error(e); alert("Carry-over failed."); }
  };

  // ─── SCHEDULE JOB FROM PICKER ─────────────────────────────────────────────────
  // Creates BOTH a my_day_tasks row (linked to job) AND a production todos row
  // so the shop floor sees the same task. Either can be null = unscheduled.
  const scheduleJobFromPicker = async (
    job: any,
    opts: { date?: string; time?: string | null; duration?: number; titleOverride?: string; notes?: string; energy?: string | null; priority?: string }
  ) => {
    const date = opts.date || selectedDate;
    const time = opts.time === undefined ? null : opts.time; // explicit null = unscheduled
    const duration = opts.duration ?? 60;
    const title = opts.titleOverride || buildJobTaskTitle(job);
    const customer_id = job.quotes?.customers?.id || null;
    const stageInfo = STAGE_COLORS[job.stage] || STAGE_COLORS.Incoming;

    // 1) Optimistic insert into my_day_tasks
    const tempId = "tmp-" + Math.random().toString(36).slice(2);
    const optimistic: Task = {
      id: tempId, title, notes: opts.notes ?? null,
      target_date: date, target_time: time,
      duration_minutes: duration, is_completed: false, completed_at: null, is_deleted: false,
      category: stageInfo.cat, priority: opts.priority ?? "normal", energy: opts.energy ?? null,
      job_id: job.id, customer_id,
      subtasks: [], recurrence: "none", recurrence_parent: null, sort_order: 0,
      jobs: { job_number: job.job_number, title: job.title } as any,
      customers: customer_id ? { company_name: job.quotes?.customers?.company_name || "" } as any : null,
    };
    if (date === selectedDate) setTasks(prev => [...prev, optimistic]);

    // 2) Send both inserts in parallel (queued if offline)
    const myDayPayload = {
      title, notes: opts.notes ?? null,
      target_date: date, target_time: time,
      duration_minutes: duration, category: stageInfo.cat,
      priority: opts.priority ?? "normal", energy: opts.energy ?? null,
      job_id: job.id, customer_id,
    };
    const todosPayload = {
      task: title,
      job_id: job.id,
      target_date: date,
      target_time: time,
      duration_minutes: duration,
      is_completed: false,
      is_deleted: false,
    };

    const [r1, r2] = await Promise.all([
      enqueueOrRun({ kind: "insert", table: "my_day_tasks", payload: myDayPayload, tempId }),
      enqueueOrRun({ kind: "insert", table: "todos",        payload: todosPayload,  tempId: tempId + "-prod" }),
    ]);

    // Refetch to swap in real ID + joined data
    if (r1 && date === selectedDate) await fetchTasks(selectedDate);

    if (!r1 && !r2) {
      // both queued — let user know
      console.warn("Both writes queued for offline retry");
    }
    return r1 && r2;
  };

  // ─── DERIVED VIEWS ────────────────────────────────────────────────────────────
  const scheduledTasks = useMemo(() => tasks.filter(t => t.target_time), [tasks]);
  const unscheduledTasks = useMemo(
    () => tasks
      .filter(t => !t.target_time && !t.is_completed)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [tasks]
  );
  // Priority list: every active task on this day (incl. scheduled), ordered by sort_order.
  // Used by the Priority Tab so user can stack-rank everything they have to do today.
  const priorityList = useMemo(
    () => tasks
      .filter(t => !t.is_completed && !t.is_deleted)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [tasks]
  );
  const completedToday = useMemo(() => tasks.filter(t => t.is_completed).length, [tasks]);
  const totalToday = tasks.length;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  const isToday = selectedDate === todayISO();

  // ─── KPI DERIVED VALUES (top + bottom strips) ─────────────────────────────
  const scheduledHrs = useMemo(
    () => Math.round(tasks.filter(t => t.target_time).reduce((s, t) => s + (t.duration_minutes || 0), 0) / 6) / 10,
    [tasks]
  );
  const remainingHrs = useMemo(
    () => Math.round(tasks.filter(t => t.target_time && !t.is_completed).reduce((s, t) => s + (t.duration_minutes || 0), 0) / 6) / 10,
    [tasks]
  );
  const rushJobsCount = useMemo(
    () => tasks.filter(t => !t.is_completed && (t.priority === "urgent" || t.priority === "high")).length,
    [tasks]
  );
  const pickupsTodayCount = useMemo(
    () => tasks.filter(t => !t.is_completed && (t.category === "delivery" || /pickup|deliver/i.test(t.title || ""))).length,
    [tasks]
  );
  const overdueItemsCount = useMemo(() => {
    if (!isToday) return 0;
    const nowMins = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
    return tasks.filter(t => {
      if (t.is_completed || !t.target_time) return false;
      const m = minsFromTime(t.target_time);
      return m + (t.duration_minutes || 0) < nowMins;
    }).length;
  }, [tasks, isToday]);
  const utilizationPct = useMemo(() => {
    const cap = 8; // 8h workday
    return Math.min(100, Math.round((scheduledHrs / cap) * 100));
  }, [scheduledHrs]);
  const pickupsTodayDelivery = useMemo(
    () => tasks.filter(t => !t.is_completed && /pickup/i.test(t.title || "")).length,
    [tasks]
  );
  const deliveriesTodayCount = useMemo(
    () => tasks.filter(t => !t.is_completed && /deliver/i.test(t.title || "")).length,
    [tasks]
  );

  // ─── VOICE CAPTURE ────────────────────────────────────────────────────────────
  const recognitionRef = useRef<any>(null);
  const startVoiceCapture = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice input is not supported in this browser. Try Chrome or Edge."); return; }
    if (voiceListening) { recognitionRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.continuous = false; rec.interimResults = true;
    rec.onstart = () => setVoiceListening(true);
    rec.onend = () => setVoiceListening(false);
    rec.onerror = () => setVoiceListening(false);
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setCaptureInput(txt);
    };
    recognitionRef.current = rec; rec.start();
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1115] text-slate-900 dark:text-slate-200">

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
          <div>
            <div className="text-[10px] sm:text-[9px] font-black uppercase tracking-widest sm:tracking-[0.4em] text-slate-400 dark:text-slate-500 mb-1">
              {fmtDayHeader(selectedDate)}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-black dark:text-white leading-none">
              {isToday ? "My Day" : selectedDate === yesterdayISO() ? "Yesterday" : "Day View"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* connection / queue */}
            <div className={`text-[10px] sm:text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-full border ${
              isOnline
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-500 border-amber-500/30"
            }`}>
              {isOnline ? "● Online" : "○ Offline"}
              {queueDepth > 0 && <span className="ml-2 opacity-70">{queueDepth} queued</span>}
            </div>

            {/* date controls */}
            <button onClick={() => { const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() - 1); setSelectedDate(d.toLocaleDateString("en-CA")); }}
              className="px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 min-h-[44px] sm:min-h-0 active:scale-95">←</button>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[12px] sm:text-[11px] font-black border-none outline-none min-h-[44px] sm:min-h-0" />
            <button onClick={() => { const d = new Date(selectedDate + "T12:00:00"); d.setDate(d.getDate() + 1); setSelectedDate(d.toLocaleDateString("en-CA")); }}
              className="px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 min-h-[44px] sm:min-h-0 active:scale-95">→</button>
            <button onClick={() => setSelectedDate(todayISO())}
              className="px-3 py-2.5 rounded-lg bg-sky-600 text-white text-[11px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-sky-500 min-h-[44px] sm:min-h-0 active:scale-95">Today</button>

            {isToday && (
              <button onClick={carryOverFromYesterday}
                className="px-3 py-2.5 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/30 text-[11px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/20 min-h-[44px] sm:min-h-0 active:scale-95">
                ↻ Carry Over
              </button>
            )}

            <button onClick={() => setShowJobPicker(true)}
              className="px-3 py-2.5 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/30 text-[11px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-orange-500/20 min-h-[44px] sm:min-h-0 active:scale-95">
              + From Jobs
            </button>

            {unscheduledTasks.length > 0 && (
              <button onClick={autoPackPool}
                title="Fill open timeline gaps with pool tasks (priority order)"
                className="px-3 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[11px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 min-h-[44px] sm:min-h-0 active:scale-95">
                ⚡ Auto-Pack
              </button>
            )}

            {isToday && scheduledTasks.length > 0 && (
              <button onClick={() => setShopMode(true)}
                title="Full-screen big-button view of today's scheduled tasks"
                className="px-3 py-2.5 rounded-lg bg-pink-500/10 text-pink-500 border border-pink-500/30 text-[11px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-pink-500/20 min-h-[44px] sm:min-h-0 active:scale-95">
                🏭 Shop Mode
              </button>
            )}

            <button onClick={() => setShowReview(true)}
              className="px-3 py-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[11px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 min-h-[44px] sm:min-h-0 active:scale-95">
              Daily Review
            </button>
          </div>
        </div>

        {/* Progress strip */}
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 pb-4">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <span>{completedToday} / {totalToday} done</span>
            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-emerald-500">{progressPct}%</span>
          </div>
        </div>
      </div>

      {/* ─── TOP KPI STRIP — 7 cards ──────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 pt-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <KpiCard
            label="Daily Completion"
            valueNode={
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{progressPct}%</span>
                  <span className="text-[10px]">✨</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            }
          />
          <KpiCard label="Tasks Completed" value={String(completedToday)} icon="✓" iconBg="bg-emerald-500/15 text-emerald-500" />
          <KpiCard label="Scheduled Hrs"   value={scheduledHrs.toFixed(1)} icon="⏰" iconBg="bg-sky-500/15 text-sky-500" />
          <KpiCard label="Remaining Hrs"   value={remainingHrs.toFixed(1)} icon="⏱" iconBg="bg-violet-500/15 text-violet-500" />
          <KpiCard label="Rush Jobs"       value={String(rushJobsCount)} icon="🔥" iconBg="bg-rose-500/15 text-rose-500" />
          <KpiCard label="Pickups Today"   value={String(pickupsTodayCount)} icon="🚚" iconBg="bg-amber-500/15 text-amber-500" />
          <KpiCard label="Overdue Items"   value={String(overdueItemsCount)} icon="⚠" iconBg="bg-red-500/15 text-red-500" alert={overdueItemsCount > 0} />
        </div>
      </div>

      {/* ─── MAIN GRID — 4-column on xl: Tools | Calendar | Agenda | Details ─ */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ─── COL 1 · LEFT RAIL: POOL / PRIORITY / STATS / NOTES ─────────── */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-5">

          {/* Tab strip */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-1">
            {[
              { id: "pool",     label: "Capture & Pool", count: unscheduledTasks.length },
              { id: "priority", label: "Priority",       count: priorityList.length    },
            ].map(t => (
              <button key={t.id} onClick={() => setLeftTab(t.id as any)}
                className={`flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  leftTab === t.id
                    ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}>
                {t.label}
                <span className="ml-1.5 opacity-60">{t.count}</span>
              </button>
            ))}
          </div>

          {leftTab === "pool" ? (
            <>
              {/* Quick capture (structured) */}
              <QuickCapture
                jobs={jobs}
                onCapture={quickCaptureFromBubbles}
                voiceSupported={voiceSupported}
                voiceListening={voiceListening}
                onStartVoice={startVoiceCapture}
                voiceText={captureInput}
                clearVoiceText={() => setCaptureInput("")}
                onFreeFormCapture={() => addFromQuickCapture()}
                freeFormValue={captureInput}
                setFreeFormValue={setCaptureInput}
              />

              {/* Unscheduled pool */}
              <div
                className={`bg-white dark:bg-slate-950 border-2 border-dashed rounded-2xl p-4 shadow-sm transition-all ${
                  draggingJob && dropHint?.kind === "pool"
                    ? "border-orange-500 bg-orange-500/5"
                    : draggingJob
                      ? "border-orange-300 dark:border-orange-700"
                      : "border-slate-200 dark:border-slate-800 border-solid"
                }`}
                onDragOver={(e) => { if (draggingJob) { e.preventDefault(); setDropHint({ kind: "pool" }); } }}
                onDragLeave={() => { if (dropHint?.kind === "pool") setDropHint(null); }}
                onDrop={async (e) => {
                  if (!draggingJob) return;
                  e.preventDefault();
                  const job = draggingJob; setDraggingJob(null); setDropHint(null);
                  await scheduleJobFromPicker(job, { date: selectedDate, time: null });
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                    {draggingJob ? "Drop here for unscheduled" : "Unscheduled · Pool"}
                  </div>
                  <div className="text-[9px] font-black text-slate-400">{unscheduledTasks.length}</div>
                </div>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {unscheduledTasks.length === 0 ? (
                    <div className="text-center py-6 text-[10px] tracking-widest font-bold text-slate-300 dark:text-slate-700 uppercase">
                      {draggingJob ? "Release to add as unscheduled" : "No unscheduled tasks"}
                    </div>
                  ) : unscheduledTasks.map(t => (
                    <TaskCard key={t.id} task={t} compact onToggle={toggleComplete} onEdit={setEditingTask} onDelete={deleteTask} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Priority Tab — drag to reorder */
            <PriorityList
              tasks={priorityList}
              onReorder={reorderTasks}
              onToggle={toggleComplete}
              onEdit={setEditingTask}
              onDelete={deleteTask}
            />
          )}

          {/* Stats — always visible */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-3">Day Stats</div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Tasks" value={String(totalToday)} />
              <Stat label="Done" value={String(completedToday)} accent="emerald" />
              <Stat label="Hours" value={(tasks.reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60).toFixed(1)} accent="sky" />
            </div>
          </div>
        </div>

        {/* ─── COL 2 · CALENDAR (timeline) ────────────────────────────────── */}
        <div className="lg:col-span-8 xl:col-span-5">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Schedule</div>
              <div className="flex items-center gap-3">
                {/* View toggle — calendar vs list */}
                <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5">
                  {([
                    { id: "calendar", label: "Calendar" },
                    { id: "list",     label: "List" },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTimelineView(opt.id)}
                      className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors ${
                        timelineView === opt.id
                          ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="text-[9px] font-black text-slate-400">{scheduledTasks.length} scheduled</div>
              </div>
            </div>
            <Timeline
              view={timelineView}
              tasks={scheduledTasks}
              onToggle={toggleComplete}
              onEdit={setEditingTask}
              isToday={isToday}
              draggingJob={draggingJob}
              draggingTaskId={draggingTaskId}
              setDraggingTaskId={setDraggingTaskId}
              dropHint={dropHint}
              setDropHint={setDropHint}
              onDropJobAtTime={async (time) => {
                if (!draggingJob) return;
                const job = draggingJob; setDraggingJob(null); setDropHint(null);
                await scheduleJobFromPicker(job, { date: selectedDate, time });
              }}
              onMoveTaskToTime={async (taskId, time) => {
                const t = tasks.find(x => x.id === taskId);
                if (!t) return;
                if (t.target_time === time) return;
                await updateTask(t, { target_time: time });
              }}
            />
          </div>
        </div>

        {/* ─── COL 3 · TODAY'S AGENDA / DEADLINES / TEAM / MACHINES ─────── */}
        <div className="hidden xl:flex xl:col-span-2 flex-col gap-4 min-w-0">
          <PanelShell title="Today's Agenda" badge={String(scheduledTasks.length)}>
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Phase C — coming up next</div>
          </PanelShell>
          <PanelShell title="Urgent Deadlines" badge={String(rushJobsCount)} accent="rose">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Phase C</div>
          </PanelShell>
          <PanelShell title="Team Availability">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Phase E</div>
          </PanelShell>
          <PanelShell title="Machine Schedule">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Phase E</div>
          </PanelShell>
        </div>

        {/* ─── COL 4 · SELECTED JOB DETAILS ──────────────────────────────── */}
        <div className="hidden xl:flex xl:col-span-2 flex-col gap-4 min-w-0">
          <PanelShell title="Selected Job Details">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">Phase D — click any calendar card to see job details here.</div>
          </PanelShell>
        </div>
      </div>

      {/* ─── JOB PICKER PANEL ──────────────────────────────────────────── */}
      {showJobPicker && (
        <JobPicker
          jobs={jobs}
          filter={pickerFilter}
          setFilter={setPickerFilter}
          search={pickerSearch}
          setSearch={setPickerSearch}
          onClose={() => setShowJobPicker(false)}
          onClickJob={(job) => { setScheduleJobModal(job); }}
          onDragStart={(job) => setDraggingJob(job)}
          onDragEnd={() => { setDraggingJob(null); setDropHint(null); }}
        />
      )}

      {/* ─── SCHEDULE JOB MODAL (detailed scheduling) ──────────────────── */}
      {scheduleJobModal && (
        <ScheduleJobModal
          job={scheduleJobModal}
          defaultDate={selectedDate}
          onClose={() => setScheduleJobModal(null)}
          onSchedule={async (opts) => {
            await scheduleJobFromPicker(scheduleJobModal, opts);
            setScheduleJobModal(null);
          }}
        />
      )}

      {/* ─── EDIT MODAL ─────────────────────────────────────────────────── */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          jobs={jobs}
          customers={customers}
          onClose={() => setEditingTask(null)}
          onSave={(patch) => { updateTask(editingTask, patch); setEditingTask(null); }}
          onDelete={() => { deleteTask(editingTask); setEditingTask(null); }}
          onStart={() => { startTask(editingTask); }}
          onShowQR={() => { setQrTask(editingTask); setEditingTask(null); }}
          onBumpItem={(subtaskId, delta) => bumpItemSubtaskAction(editingTask, subtaskId, delta)}
        />
      )}

      {/* ─── DAILY REVIEW MODAL ─────────────────────────────────────────── */}
      {showReview && (
        <DailyReviewModal
          review={review}
          tasks={tasks}
          onClose={() => setShowReview(false)}
          onSave={async (r) => {
            setReview(r);
            await enqueueOrRun({ kind: "upsert", table: "my_day_reviews", payload: r, onConflict: "review_date" });
            setShowReview(false);
          }}
        />
      )}

      {/* ─── DEPENDENCY CASCADE PROMPT ──────────────────────────────────── */}
      {depPrompt && (
        <DependencyPrompt
          prompt={depPrompt}
          onConfirm={() => applyDependencyShift(true)}
          onCancel={() => applyDependencyShift(false)}
        />
      )}

      {/* ─── QR CODE MODAL ──────────────────────────────────────────────── */}
      {/* ─── BOTTOM STATS STRIP — 6 cards ─────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <BottomStatCard label="Total Scheduled Jobs" value={String(scheduledTasks.length)} sublabel="Today" icon="📋" />
          <BottomStatCard label="Production Hours"     value={scheduledHrs.toFixed(1)}        sublabel="Scheduled" icon="🕒" />
          <BottomStatCard label="Pickups Today"        value={String(pickupsTodayDelivery)}   sublabel="Scheduled" icon="🚚" />
          <BottomStatCard label="Deliveries Today"     value={String(deliveriesTodayCount)}   sublabel="Scheduled" icon="📦" />
          <BottomStatCard label="Overdue Tasks"        value={String(overdueItemsCount)}      sublabel={overdueItemsCount > 0 ? "Needs Attention" : "All Clear"} icon="⚠" alert={overdueItemsCount > 0} />
          <BottomStatCard label="Utilization"          value={`${utilizationPct}%`}            sublabel={utilizationPct < 90 ? "On Track" : "Heavy Load"} icon="📈" />
        </div>
      </div>

      {qrTask && (
        <QRTaskModal task={qrTask} onClose={() => setQrTask(null)} />
      )}

      {/* ─── SHOP MODE (full-screen takeover) ────────────────────────────── */}
      {shopMode && (
        <ShopMode
          tasks={tasks}
          onClose={() => setShopMode(false)}
          onToggle={toggleComplete}
          onStart={startTask}
          onBumpItem={bumpItemSubtaskAction}
          onShowQR={(t) => setQrTask(t)}
        />
      )}

      {/* ─── TOAST ──────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl shadow-2xl border-2 backdrop-blur-md flex items-center gap-2.5 max-w-md animate-in slide-in-from-bottom duration-200 ${
          toast.kind === "ok"   ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-500" :
          toast.kind === "warn" ? "bg-amber-500/15 border-amber-500/40 text-amber-500" :
                                  "bg-sky-500/15 border-sky-500/40 text-sky-500"
        }`}>
          <span className="text-base">{toast.kind === "ok" ? "✓" : toast.kind === "warn" ? "⚠" : "ℹ"}</span>
          <span className="text-[11px] font-black uppercase tracking-widest">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100 ml-1">×</button>
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTS ────────────────────────────────────────────────────────────────

function Stat({ label, value, accent = "slate" }: { label: string; value: string; accent?: string }) {
  const colors: Record<string, string> = {
    slate: "text-slate-700 dark:text-slate-200",
    emerald: "text-emerald-500",
    sky: "text-sky-500",
  };
  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-center">
      <div className={`text-2xl font-black tracking-tighter ${colors[accent]}`}>{value}</div>
      <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function TaskCard({ task, compact, onToggle, onEdit, onDelete }: {
  task: Task; compact?: boolean;
  onToggle: (t: Task) => void; onEdit: (t: Task) => void; onDelete: (t: Task) => void;
}) {
  const cat = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[0];
  const cls = CATEGORY_CLASSES[cat.color];
  const prio = PRIORITIES.find(p => p.id === task.priority);
  const subtaskProgress = task.subtasks?.length > 0
    ? `${task.subtasks.filter(s => s.done).length}/${task.subtasks.length}`
    : null;

  return (
    <div className={`group relative rounded-xl border ${cls.bg} border-slate-200/50 dark:border-slate-800 hover:ring-1 ${cls.ring} transition-all`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cls.chip} rounded-l-xl`}></div>
      <div className="flex items-start gap-2 p-3 pl-4">
        <button onClick={() => onToggle(task)}
          className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
            task.is_completed
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-slate-300 dark:border-slate-600 hover:border-emerald-400"
          }`}>
          {task.is_completed && <span className="text-[10px] leading-none">✓</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className={`text-xs font-bold leading-tight cursor-pointer ${task.is_completed ? "line-through opacity-50" : ""}`}
            onClick={() => onEdit(task)}>
            {task.title}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[8px] font-black uppercase tracking-widest">
            <span className={cls.text}>{cat.label}</span>
            {task.target_time && <span className="text-slate-400">{fmt12hr(task.target_time)}</span>}
            {!compact && task.duration_minutes > 0 && <span className="text-slate-400">{task.duration_minutes}m</span>}
            {task.priority !== "normal" && prio && <span className={prio.color}>● {prio.label}</span>}
            {task.energy && <span className="text-slate-400">{ENERGY_LEVELS.find(e => e.id === task.energy)?.icon}</span>}
            {subtaskProgress && <span className="text-slate-400">☑ {subtaskProgress}</span>}
            {task.recurrence_parent && <span className="text-violet-400">↻ recurring</span>}
            {task.jobs && <span className="text-orange-400 normal-case tracking-tight">#{task.jobs.job_number}</span>}
            {task.customers && <span className="text-teal-400 normal-case tracking-tight">{task.customers.company_name}</span>}
          </div>
        </div>

        <button onClick={() => onDelete(task)}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs px-1 transition-all" title="Delete">
          ×
        </button>
      </div>
    </div>
  );
}

function Timeline({ view, tasks, onToggle, onEdit, isToday, draggingJob, draggingTaskId, setDraggingTaskId, dropHint, setDropHint, onDropJobAtTime, onMoveTaskToTime }: {
  view: "calendar" | "list";
  tasks: Task[]; onToggle: (t: Task) => void; onEdit: (t: Task) => void; isToday: boolean;
  draggingJob?: any | null;
  draggingTaskId?: string | null;
  setDraggingTaskId?: (id: string | null) => void;
  dropHint?: { kind: "time" | "pool"; time?: string } | null;
  setDropHint?: (h: { kind: "time" | "pool"; time?: string } | null) => void;
  onDropJobAtTime?: (time: string) => void;
  onMoveTaskToTime?: (taskId: string, time: string) => void;
}) {
  // Render the list-view variant when requested. Falls through to the
  // calendar grid below otherwise.
  if (view === "list") {
    return (
      <TimelineListView tasks={tasks} onToggle={onToggle} onEdit={onEdit} />
    );
  }

  const hours = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) hours.push(h);

  const gridRef = useRef<HTMLDivElement>(null);

  // Convert pointer Y → time string ("HH:MM:SS"), snapped to 30-min slots
  // (so the cursor locks to :00 / :30 only, never :15 / :45).
  const yToSnappedTime = (clientY: number): string | null => {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    const totalMinutes = (y / PIXELS_PER_HOUR) * 60;
    const startMins = TIMELINE_START_HOUR * 60;
    const absMins = startMins + totalMinutes;
    const snapped = Math.round(absMins / 30) * 30;
    const clampedMin = Math.min(Math.max(snapped, startMins), (TIMELINE_END_HOUR + 1) * 60 - 30);
    return timeFromMins(clampedMin);
  };

  // Magnetic snap: if the cursor lands in the *inner core* of an existing
  // task, snap the dragged card to land directly below it. The 20% edge
  // strips on each side are deliberately left to natural 30-min snap so
  // continuous placement (drop right after the previous job) works without
  // the magnet hijacking the cursor.
  const magneticSnap = (rawTime: string, currentDragId: string | null, draggedDuration: number): string => {
    const targetMins = minsFromTime(rawTime);
    const dur = Math.max(15, draggedDuration);
    for (const p of positioned) {
      if (p.id === currentDragId) continue;
      const pStart = minsFromTime(p.target_time);
      const pEnd = pStart + (p.duration_minutes || 30);
      const length = pEnd - pStart;
      // Only engage in the centre 60% of the card. Edge 20% top + 20%
      // bottom is "free zone" so dropping right at a card boundary
      // keeps its natural 30-min snap.
      const innerStart = pStart + length * 0.2;
      const innerEnd   = pEnd   - length * 0.2;
      if (targetMins >= innerStart && targetMins < innerEnd) {
        // Snap *below* the hovered card — the "auto-tuck under the card
        // above" gesture the user asked for.
        const startBound = TIMELINE_START_HOUR * 60;
        const endBound = (TIMELINE_END_HOUR + 1) * 60 - dur;
        const clamped = Math.min(Math.max(pEnd, startBound), endBound);
        return timeFromMins(Math.round(clamped / 30) * 30);
      }
    }
    return rawTime;
  };

  // Current-time marker
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = TIMELINE_START_HOUR * 60;
  const endMins = (TIMELINE_END_HOUR + 1) * 60;
  const showNowLine = isToday && nowMins >= startMins && nowMins <= endMins;
  const nowTop = ((nowMins - startMins) / 60) * PIXELS_PER_HOUR;

  // Detect overlapping tasks to render side-by-side, AND flag each conflicting task
  type Positioned = Task & { _top: number; _height: number; _column: number; _columns: number; _conflict: boolean };
  const positioned: Positioned[] = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => minsFromTime(a.target_time) - minsFromTime(b.target_time));
    const result: Positioned[] = [];
    const lanes: { end: number }[] = [];
    for (const t of sorted) {
      const start = minsFromTime(t.target_time);
      const end = start + (t.duration_minutes || 30);
      let lane = lanes.findIndex(l => l.end <= start);
      if (lane === -1) { lanes.push({ end }); lane = lanes.length - 1; }
      else lanes[lane].end = end;
      result.push({
        ...t,
        _top: ((start - startMins) / 60) * PIXELS_PER_HOUR,
        _height: Math.max(28, (((end - start) / 60) * PIXELS_PER_HOUR) - 2),
        _column: lane,
        _columns: 0,
        _conflict: false,
      });
    }
    // Flag conflicts
    for (let i = 0; i < result.length; i++) {
      const a = result[i];
      const aStart = minsFromTime(a.target_time);
      const aEnd = aStart + (a.duration_minutes || 30);
      for (let j = 0; j < result.length; j++) {
        if (i === j) continue;
        const b = result[j];
        const bStart = minsFromTime(b.target_time);
        const bEnd = bStart + (b.duration_minutes || 30);
        if (aStart < bEnd && bStart < aEnd) { a._conflict = true; break; }
      }
    }
    const totalLanes = lanes.length || 1;
    return result.map(p => ({ ...p, _columns: totalLanes }));
  }, [tasks, startMins]);

  return (
    <div
      ref={gridRef}
      className={`relative transition-colors ${(draggingJob || draggingTaskId) ? "ring-2 ring-orange-500/40 ring-inset rounded-lg" : ""}`}
      style={{ height: (TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1) * PIXELS_PER_HOUR }}
      onDragOver={(e) => {
        if (!draggingJob && !draggingTaskId) return;
        e.preventDefault();
        const raw = yToSnappedTime(e.clientY);
        if (!raw) return;
        const draggedTask = draggingTaskId ? tasks.find(x => x.id === draggingTaskId) : null;
        const draggedDur = draggedTask?.duration_minutes ?? 60;
        const t = magneticSnap(raw, draggingTaskId ?? null, draggedDur);
        setDropHint?.({ kind: "time", time: t });
      }}
      onDragLeave={(e) => {
        if (!draggingJob && !draggingTaskId) return;
        // Only clear if leaving the grid entirely
        const rect = gridRef.current?.getBoundingClientRect();
        if (rect && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) {
          setDropHint?.(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const raw = yToSnappedTime(e.clientY);
        if (!raw) return;
        const draggedTask = draggingTaskId ? tasks.find(x => x.id === draggingTaskId) : null;
        const draggedDur = draggedTask?.duration_minutes ?? 60;
        const t = magneticSnap(raw, draggingTaskId ?? null, draggedDur);
        // A job from the picker takes precedence; otherwise this is an
        // existing task being repositioned to a new time.
        if (draggingJob) {
          onDropJobAtTime?.(t);
        } else if (draggingTaskId) {
          onMoveTaskToTime?.(draggingTaskId, t);
          setDraggingTaskId?.(null);
          setDropHint?.(null);
        }
      }}
    >
      {/* Drop preview line */}
      {draggingJob && dropHint?.kind === "time" && dropHint.time && (
        <div className="absolute left-12 md:left-14 right-0 z-30 pointer-events-none transition-all"
             style={{ top: ((minsFromTime(dropHint.time) - TIMELINE_START_HOUR * 60) / 60) * PIXELS_PER_HOUR }}>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-orange-500 -ml-1.5 ring-2 ring-white dark:ring-slate-950 shadow-[0_0_12px_rgba(249,115,22,0.7)]"></div>
            <div className="flex-1 h-0.5 bg-orange-500"></div>
            <div className="text-[9px] font-black tracking-widest text-white bg-orange-500 px-2 py-0.5 rounded ml-2 shadow-md">
              DROP @ {fmt12hr(dropHint.time)}
            </div>
          </div>
        </div>
      )}

      {/* Hour grid */}
      {hours.map((h, idx) => (
        <div key={h} className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-800 flex items-start"
          style={{ top: idx * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR }}>
          <div className="w-12 md:w-14 shrink-0 -mt-2 pl-1 text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">
            {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
          </div>
        </div>
      ))}

      {/* Now line */}
      {showNowLine && (
        <div className="absolute left-12 md:left-14 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
            <div className="flex-1 h-px bg-red-500/60"></div>
            <div className="text-[8px] font-black tracking-widest text-red-500 ml-1">{fmt12hr(timeFromMins(nowMins))}</div>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className={`absolute left-12 md:left-14 right-0 top-0 bottom-0 ${draggingJob ? "pointer-events-none" : ""}`}>
        {positioned.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-widest uppercase text-slate-300 dark:text-slate-700 pointer-events-none">
            {draggingJob ? "Drop anywhere on the timeline" : "No scheduled tasks for this day"}
          </div>
        ) : positioned.map(t => {
          const cat = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[0];
          const cls = CATEGORY_CLASSES[cat.color];
          const widthPct = 100 / Math.max(1, t._columns);
          const leftPct = t._column * widthPct;
          const itemProgress = itemChecklistProgress(t.subtasks || []);
          let actualBadge: { text: string; color: string } | null = null;
          if (t.is_completed && t.actual_minutes != null && t.duration_minutes > 0) {
            const ratio = t.actual_minutes / t.duration_minutes;
            if (ratio > 1.15) actualBadge = { text: `+${Math.round((ratio - 1) * 100)}%`, color: "text-red-400" };
            else if (ratio < 0.85) actualBadge = { text: `−${Math.round((1 - ratio) * 100)}%`, color: "text-emerald-400" };
            else actualBadge = { text: "on time", color: "text-emerald-400" };
          }
          const isDragging = draggingTaskId === t.id;
          // Don't transition the card the user is dragging — only siblings
          // animate as they make room for the move. Gives the silk-smooth
          // "auto-tucks under the card above" behaviour.
          const transitionCls = isDragging ? "" : "transition-[top,left,width,height] duration-200 ease-out";
          return (
            <div key={t.id}
              draggable={!t.is_completed}
              onDragStart={(e) => {
                if (t.is_completed) return;
                setDraggingTaskId?.(t.id);
                try { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; } catch {}
              }}
              onDragEnd={() => { setDraggingTaskId?.(null); setDropHint?.(null); }}
              onClick={() => onEdit(t)}
              className={`absolute rounded-lg ${cls.bg} ${
                t._conflict ? "ring-2 ring-red-500/70" : `ring-1 ${cls.ring}`
              } cursor-grab active:cursor-grabbing hover:scale-[1.01] hover:shadow-md ${transitionCls} overflow-hidden ${isDragging ? "opacity-40 scale-[0.98]" : ""}`}
              style={{ top: t._top, height: t._height, left: `calc(${leftPct}% + 4px)`, width: `calc(${widthPct}% - 8px)` }}>
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${cls.chip}`}></div>
              {t._conflict && (
                <div className="absolute top-0.5 right-0.5 z-10 bg-red-500 text-white text-[7px] font-black uppercase tracking-widest px-1 py-px rounded shadow-md" title="Overlaps another task">
                  ⚠ Overlap
                </div>
              )}
              {/* Card body — height-adaptive.
                  • <50px (≤30-min slot): single ellipsized line shows time +
                    duration + title + #job + customer all together. The
                    user always sees "what" and "when" even on the smallest
                    block; click opens the modal for full detail.
                  • ≥50px: title gets its own line; time chip + duration on
                    top, meta footer when the slot is tall enough. */}
              {t._height < 50 ? (
                <div className="pl-3 pr-2 py-1 h-full flex items-center gap-1.5 overflow-hidden">
                  <button onClick={(e) => { e.stopPropagation(); onToggle(t); }}
                    className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                      t.is_completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-400 hover:border-emerald-400"
                    }`}>
                    {t.is_completed && <span className="text-[8px] leading-none">✓</span>}
                  </button>
                  <span className={`text-[10px] font-black font-mono shrink-0 ${cls.text}`}>{fmt12hr(t.target_time)}</span>
                  <span className="text-[9px] opacity-50 shrink-0">·</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 shrink-0">{t.duration_minutes}m</span>
                  <span className="text-[9px] opacity-50 shrink-0">·</span>
                  <span className={`text-[10px] font-black tracking-tight truncate ${t.is_completed ? "line-through opacity-50" : ""}`}>{t.title}</span>
                  {t.jobs && <span className="text-[9px] font-black text-orange-500 shrink-0">#{t.jobs.job_number}</span>}
                </div>
              ) : (
                <div className="px-2 pl-3 py-1.5 h-full flex flex-col gap-0.5 overflow-hidden">
                  {/* Top strip: checkbox + time + duration + status chip */}
                  <div className="flex items-center gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); onToggle(t); }}
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                        t.is_completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-400 hover:border-emerald-400"
                      }`}>
                      {t.is_completed && <span className="text-[8px] leading-none">✓</span>}
                    </button>
                    <span className={`text-[10px] font-black font-mono tracking-tight ${cls.text}`}>{fmt12hr(t.target_time)}</span>
                    <span className="text-[9px] font-bold opacity-50">·</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{t.duration_minutes}m</span>
                    {itemProgress && (
                      <span className="text-[9px] font-black text-amber-500 ml-auto">☑ {itemProgress.done}/{itemProgress.total}</span>
                    )}
                    {actualBadge && !itemProgress && (
                      <span className={`text-[9px] font-black uppercase tracking-widest ml-auto ${actualBadge.color}`}>{actualBadge.text}</span>
                    )}
                    {t.started_at && !t.is_completed && (
                      <span className="text-[9px] font-black text-sky-500 animate-pulse ml-auto">● live</span>
                    )}
                  </div>
                  {/* Title */}
                  <div className={`text-[11px] font-black tracking-tight leading-tight line-clamp-2 ${t.is_completed ? "line-through opacity-50" : ""}`}>{t.title}</div>
                  {/* Meta footer — only when there's vertical room */}
                  {t._height > 64 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-black uppercase tracking-widest mt-auto">
                      <span className={cls.text}>{cat.label}</span>
                      {t.energy && <span>{ENERGY_LEVELS.find(e => e.id === t.energy)?.icon}</span>}
                      {t.jobs && <span className="text-orange-500 normal-case tracking-tight">#{t.jobs.job_number}</span>}
                      {t.customers && <span className="text-teal-500 normal-case tracking-tight truncate">{t.customers.company_name}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TIMELINE — LIST VIEW ──────────────────────────────────────────────────
// Buckets scheduled tasks into Now / Upcoming / Done. Cleaner than the
// hourly grid when the user just wants to scan their day. No drag here —
// users who want to reschedule should switch to Calendar view.
function TimelineListView({ tasks, onToggle, onEdit }: {
  tasks: Task[]; onToggle: (t: Task) => void; onEdit: (t: Task) => void;
}) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const bucketed = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => minsFromTime(a.target_time) - minsFromTime(b.target_time));
    const nowB: Task[] = [], upcomingB: Task[] = [], doneB: Task[] = [];
    for (const t of sorted) {
      if (t.is_completed) { doneB.push(t); continue; }
      const start = minsFromTime(t.target_time);
      const end = start + (t.duration_minutes || 30);
      if (start <= nowMins && nowMins < end) nowB.push(t);
      else upcomingB.push(t);
    }
    return { now: nowB, upcoming: upcomingB, done: doneB };
  }, [tasks, nowMins]);

  const renderBucket = (label: string, bucket: Task[], accent: "sky" | "slate" | "emerald") => {
    if (bucket.length === 0) return null;
    const accentCls = accent === "sky" ? "text-sky-500 border-sky-500/30 bg-sky-500/5"
      : accent === "emerald" ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
      : "text-slate-500 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40";
    return (
      <div className="mb-5 last:mb-0">
        <div className="flex items-center gap-2 mb-2">
          <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-[0.3em] border ${accentCls}`}>{label}</div>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
          <div className="text-[9px] font-black text-slate-400">{bucket.length}</div>
        </div>
        <div className="flex flex-col gap-1.5">
          {bucket.map(t => {
            const cat = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[0];
            const cls = CATEGORY_CLASSES[cat.color];
            const itemProgress = itemChecklistProgress(t.subtasks || []);
            return (
              <button
                key={t.id}
                onClick={() => onEdit(t)}
                className={`w-full text-left flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900 px-3 py-2.5 transition-colors group`}
              >
                <span onClick={(e) => { e.stopPropagation(); onToggle(t); }}
                  className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    t.is_completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-slate-600 group-hover:border-emerald-400"
                  }`}
                >
                  {t.is_completed && <span className="text-[9px] leading-none">✓</span>}
                </span>
                <div className={`shrink-0 w-1 self-stretch rounded-full ${cls.chip}`}></div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-black tracking-tight truncate ${t.is_completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>{t.title}</div>
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{fmt12hr(t.target_time)}</span>
                    <span>·</span>
                    <span>{t.duration_minutes}m</span>
                    {t.jobs && <><span>·</span><span className="text-orange-500 normal-case tracking-tight">#{t.jobs.job_number}</span></>}
                    {t.customers && <><span>·</span><span className="text-teal-500 normal-case tracking-tight truncate">{t.customers.company_name}</span></>}
                    {itemProgress && <><span>·</span><span className="text-amber-500">☑ {itemProgress.done}/{itemProgress.total}</span></>}
                    {t.started_at && !t.is_completed && <><span>·</span><span className="text-sky-500 animate-pulse">● running</span></>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 text-[10px] font-bold tracking-widest uppercase text-slate-300 dark:text-slate-700">
        No scheduled tasks for this day
      </div>
    );
  }

  return (
    <div>
      {renderBucket("Now", bucketed.now, "sky")}
      {renderBucket("Upcoming", bucketed.upcoming, "slate")}
      {renderBucket("Done", bucketed.done, "emerald")}
    </div>
  );
}

function EditTaskModal({ task, jobs, customers, onClose, onSave, onDelete, onStart, onShowQR, onBumpItem }: {
  task: Task; jobs: any[]; customers: any[];
  onClose: () => void; onSave: (patch: Partial<Task>) => void; onDelete: () => void;
  onStart?: () => void;
  onShowQR?: () => void;
  onBumpItem?: (subtaskId: string, delta: number) => void;
}) {
  const [draft, setDraft] = useState<Task>(task);
  const [newSubtask, setNewSubtask] = useState("");

  const updateSubtask = (id: string, patch: Partial<Subtask>) => {
    setDraft({ ...draft, subtasks: draft.subtasks.map(s => s.id === id ? { ...s, ...patch } : s) });
  };
  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setDraft({ ...draft, subtasks: [...(draft.subtasks || []), { id: Math.random().toString(36).slice(2), title: newSubtask, done: false }] });
    setNewSubtask("");
  };
  const removeSubtask = (id: string) => {
    setDraft({ ...draft, subtasks: draft.subtasks.filter(s => s.id !== id) });
  };

  // Detect whether the existing subtasks are item-checklist style (e.g. "Hoodies — 12 / 24")
  const itemProgress = itemChecklistProgress(draft.subtasks || []);
  const isItemChecklist = itemProgress !== null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-black dark:text-white">Edit Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-black dark:hover:text-white text-xs font-black uppercase tracking-widest">Close ✕</button>
        </div>

        {/* Quick action strip — Start / QR / Timing */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {!task.is_completed && onStart && (
            <button onClick={onStart}
              disabled={!!task.started_at}
              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                task.started_at
                  ? "bg-sky-500/10 text-sky-500 border-sky-500/30 cursor-default"
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
              }`}>
              {task.started_at ? "● Running" : "▶ Start"}
            </button>
          )}
          {onShowQR && (
            <button onClick={onShowQR}
              className="px-3 py-2 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/30 text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/20">
              ▦ QR Code
            </button>
          )}
          {task.is_completed && task.actual_minutes != null && task.duration_minutes > 0 && (
            (() => {
              const ratio = task.actual_minutes / task.duration_minutes;
              const txt = ratio > 1.15 ? `${Math.round((ratio - 1) * 100)}% over` : ratio < 0.85 ? `${Math.round((1 - ratio) * 100)}% under` : "on time";
              const color = ratio > 1.15 ? "text-red-500 bg-red-500/10 border-red-500/30" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
              return (
                <span className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${color}`}>
                  Est {task.duration_minutes}m · Actual {task.actual_minutes}m · {txt}
                </span>
              );
            })()
          )}
        </div>

        <div className="space-y-4">
          <Field label="Title">
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-sky-500" autoFocus />
          </Field>

          <Field label="Notes">
            <textarea value={draft.notes || ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={3}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-sky-500 resize-none" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" value={draft.target_date} onChange={e => setDraft({ ...draft, target_date: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-sky-500" />
            </Field>
            <Field label="Time">
              <input type="time" value={(draft.target_time || "").slice(0, 5)}
                onChange={e => setDraft({ ...draft, target_time: e.target.value ? `${e.target.value}:00` : null })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-sky-500" />
            </Field>
            <Field label="Duration (min)">
              <input type="number" min={5} step={5} value={draft.duration_minutes} onChange={e => setDraft({ ...draft, duration_minutes: parseInt(e.target.value) || 30 })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-sky-500" />
            </Field>
            <Field label="Recurrence">
              <select value={draft.recurrence} onChange={e => setDraft({ ...draft, recurrence: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-sky-500">
                {RECURRENCE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Category">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => {
                const cls = CATEGORY_CLASSES[c.color];
                const active = draft.category === c.id;
                return (
                  <button key={c.id} onClick={() => setDraft({ ...draft, category: c.id })}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                      active ? `${cls.bg} ${cls.text} ${cls.ring} ring-1 border-transparent` : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                    }`}>{c.label}</button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <div className="flex gap-1">
                {PRIORITIES.map(p => (
                  <button key={p.id} onClick={() => setDraft({ ...draft, priority: p.id })}
                    className={`flex-1 px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                      draft.priority === p.id ? `${p.color} border-current` : "text-slate-400 border-slate-200 dark:border-slate-800"
                    }`}>{p.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Energy Required">
              <div className="flex gap-1">
                {ENERGY_LEVELS.map(e => (
                  <button key={e.id} onClick={() => setDraft({ ...draft, energy: draft.energy === e.id ? null : e.id })}
                    className={`flex-1 px-2 py-2 rounded-lg text-sm font-black border transition-all ${
                      draft.energy === e.id ? "bg-amber-500/10 text-amber-500 border-amber-500/40" : "border-slate-200 dark:border-slate-800"
                    }`} title={e.label}>{e.icon}</button>
                ))}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Link to Job (optional)">
              <select value={draft.job_id || ""} onChange={e => setDraft({ ...draft, job_id: e.target.value || null })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-sky-500">
                <option value="">— None —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>#{j.job_number} — {j.title}</option>)}
              </select>
            </Field>
            <Field label="Link to Customer (optional)">
              <select value={draft.customer_id || ""} onChange={e => setDraft({ ...draft, customer_id: e.target.value || null })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-sky-500">
                <option value="">— None —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </Field>
          </div>

          {/* Subtasks */}
          <Field label={isItemChecklist ? `Item Checklist · ${itemProgress!.done} / ${itemProgress!.total}` : "Subtasks / Checklist"}>
            {isItemChecklist && (
              <div className="mb-2 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                  style={{ width: `${(itemProgress!.done / itemProgress!.total) * 100}%` }} />
              </div>
            )}
            <div className="space-y-1.5">
              {(draft.subtasks || []).map(s => {
                const itemMeta = parseItemSubtask(s);
                if (itemMeta) {
                  return (
                    <div key={s.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2">
                      <button onClick={() => onBumpItem?.(s.id, -itemMeta.total)}
                        className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                          s.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-400"
                        }`} title="Reset">{s.done && <span className="text-[8px]">✓</span>}</button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold tracking-tight ${s.done ? "line-through opacity-50" : ""}`}>
                          {itemMeta.name}
                        </div>
                        <div className="text-[9px] font-black tabular-nums text-slate-400 mt-0.5">
                          {itemMeta.done} / {itemMeta.total}
                        </div>
                      </div>
                      <button onClick={() => onBumpItem?.(s.id, -1)}
                        disabled={itemMeta.done <= 0}
                        className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-black hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                      <button onClick={() => onBumpItem?.(s.id, +1)}
                        disabled={itemMeta.done >= itemMeta.total}
                        className="w-7 h-7 rounded-lg bg-amber-500 text-white text-sm font-black hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                    </div>
                  );
                }
                return (
                  <div key={s.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2">
                    <button onClick={() => updateSubtask(s.id, { done: !s.done })}
                      className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                        s.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-400"
                      }`}>{s.done && <span className="text-[8px]">✓</span>}</button>
                    <input value={s.title} onChange={e => updateSubtask(s.id, { title: e.target.value })}
                      className={`flex-1 bg-transparent outline-none text-xs font-medium ${s.done ? "line-through opacity-50" : ""}`} />
                    <button onClick={() => removeSubtask(s.id)} className="text-slate-400 hover:text-red-500 text-xs">×</button>
                  </div>
                );
              })}
              {!isItemChecklist && (
                <div className="flex gap-2">
                  <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
                    placeholder="Add subtask…"
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-sky-500" />
                  <button onClick={addSubtask} className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700">Add</button>
                </div>
              )}
            </div>
          </Field>
        </div>

        <div className="flex gap-2 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onDelete} className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/30 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20">Delete</button>
          <div className="flex-1"></div>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
          <button onClick={() => onSave(draft)} className="px-5 py-2.5 rounded-xl bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-sky-500">Save</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function DailyReviewModal({ review, tasks, onClose, onSave }: {
  review: Review; tasks: Task[];
  onClose: () => void; onSave: (r: Review) => void;
}) {
  const [draft, setDraft] = useState<Review>(review);
  const completed = tasks.filter(t => t.is_completed);
  const carriedOver = tasks.filter(t => !t.is_completed);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-black dark:text-white">Daily Review</h2>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{fmtDayHeader(draft.review_date)}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-black dark:hover:text-white text-xs font-black uppercase tracking-widest">Close ✕</button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
            <div className="text-2xl font-black tracking-tighter text-emerald-500">{completed.length}</div>
            <div className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70 mt-1">Done</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <div className="text-2xl font-black tracking-tighter text-amber-500">{carriedOver.length}</div>
            <div className="text-[8px] font-black uppercase tracking-widest text-amber-500/70 mt-1">Carried Over</div>
          </div>
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-3 text-center">
            <div className="text-2xl font-black tracking-tighter text-sky-500">{(tasks.reduce((s, t) => s + (t.duration_minutes || 0), 0) / 60).toFixed(1)}h</div>
            <div className="text-[8px] font-black uppercase tracking-widest text-sky-500/70 mt-1">Planned</div>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Wins · What went well today?">
            <textarea value={draft.wins} onChange={e => setDraft({ ...draft, wins: e.target.value })} rows={3}
              placeholder="Closed two quotes. Finished the artwork backlog…"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 resize-none" />
          </Field>

          <Field label="Blockers · What slowed you down?">
            <textarea value={draft.blockers} onChange={e => setDraft({ ...draft, blockers: e.target.value })} rows={3}
              placeholder="Vendor didn't respond. Internet was slow…"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-amber-500 resize-none" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Mood (1–5)">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setDraft({ ...draft, mood: n })}
                    className={`flex-1 py-2 rounded-lg text-lg border transition-all ${
                      draft.mood === n ? "bg-violet-500/10 border-violet-500/40" : "border-slate-200 dark:border-slate-800"
                    }`}>{["😞", "😐", "🙂", "😀", "🤩"][n - 1]}</button>
                ))}
              </div>
            </Field>
            <Field label="Energy (1–5)">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setDraft({ ...draft, energy: n })}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${
                      draft.energy === n ? "bg-sky-500/10 text-sky-500 border-sky-500/40" : "text-slate-400 border-slate-200 dark:border-slate-800"
                    }`}>{n}</button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Tomorrow's #1 Focus">
            <input value={draft.tomorrow_focus} onChange={e => setDraft({ ...draft, tomorrow_focus: e.target.value })}
              placeholder="Ship the Anderson order"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-sky-500" />
          </Field>

          {carriedOver.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-2">{carriedOver.length} unfinished task{carriedOver.length > 1 ? "s" : ""} on this day</div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                {carriedOver.slice(0, 5).map(t => <li key={t.id}>· {t.title}</li>)}
                {carriedOver.length > 5 && <li className="text-slate-400">…and {carriedOver.length - 5} more</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
          <div className="flex-1"></div>
          <button onClick={() => onSave(draft)} className="px-5 py-2.5 rounded-xl bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-sky-500">Save Review</button>
        </div>
      </div>
    </div>
  );
}

// ─── JOB PICKER PANEL ────────────────────────────────────────────────────────────
function JobPicker({ jobs, filter, setFilter, search, setSearch, onClose, onClickJob, onDragStart, onDragEnd }: {
  jobs: any[];
  filter: "next" | "all" | "due";
  setFilter: (f: "next" | "all" | "due") => void;
  search: string;
  setSearch: (s: string) => void;
  onClose: () => void;
  onClickJob: (job: any) => void;
  onDragStart: (job: any) => void;
  onDragEnd: () => void;
}) {
  // Filter by tab
  const filtered = useMemo(() => {
    let list = jobs;
    if (filter === "next") {
      list = jobs.filter(j => NEXT_ACTION_STAGES.includes(j.stage));
    } else if (filter === "due") {
      const sevenDaysOut = new Date();
      sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
      list = jobs.filter(j => {
        if (!j.due_date) return false;
        const due = new Date(j.due_date + "T12:00:00");
        return due <= sevenDaysOut;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(j =>
        (j.job_number || "").toString().toLowerCase().includes(q) ||
        (j.title || "").toLowerCase().includes(q) ||
        (j.quotes?.customers?.company_name || "").toLowerCase().includes(q) ||
        (j.stage || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, filter, search]);

  // Group by stage
  const grouped = useMemo(() => {
    const stageOrder = ["Artwork", "Sourcing", "Ordered", "Received", "Staged", "Printing", "Pressing", "Finishing", "Dispatch", "Billing", "Incoming", "Paid"];
    const groups: Record<string, any[]> = {};
    for (const j of filtered) {
      const s = j.stage || "Incoming";
      if (!groups[s]) groups[s] = [];
      groups[s].push(j);
    }
    return stageOrder.filter(s => groups[s]?.length).map(s => ({ stage: s, jobs: groups[s] }));
  }, [filtered]);

  // ─── KEYBOARD NAV ─────────────────────────────────────────────────────────
  // Flatten the grouped list so arrow keys can walk across stage boundaries.
  // Keep stageOrder identical to `grouped` above so visual + index match.
  const flatJobs = useMemo(() => grouped.flatMap(g => g.jobs), [grouped]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Default highlight to first job; reset when the visible list changes.
  useEffect(() => {
    if (flatJobs.length === 0) { setHighlightedId(null); return; }
    if (!highlightedId || !flatJobs.find(j => j.id === highlightedId)) {
      setHighlightedId(flatJobs[0].id);
    }
  }, [flatJobs, highlightedId]);

  // Refs per job so we can scroll the highlighted one into view.
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Document-level key handler so the search input doesn't swallow arrow keys.
  // (Browsers don't move the cursor on ↑/↓ inside a single-line input, so
  //  we can safely take over those keys without breaking text editing.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't interfere if focus is in a textarea / contenteditable
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;

      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }

      if (flatJobs.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = highlightedId ? flatJobs.findIndex(j => j.id === highlightedId) : -1;
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const next = Math.max(0, Math.min(flatJobs.length - 1, (idx < 0 ? 0 : idx) + dir));
        setHighlightedId(flatJobs[next].id);
        return;
      }
      if (e.key === "Enter" && highlightedId) {
        const job = flatJobs.find(j => j.id === highlightedId);
        if (job) { e.preventDefault(); onClickJob(job); }
        return;
      }
      // Cmd/Ctrl + 1/2/3 swaps the filter tabs
      if ((e.metaKey || e.ctrlKey) && (e.key === "1" || e.key === "2" || e.key === "3")) {
        e.preventDefault();
        const map: Record<string, "next" | "all" | "due"> = { "1": "next", "2": "all", "3": "due" };
        setFilter(map[e.key]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flatJobs, highlightedId, onClickJob, onClose, setFilter]);

  // Scroll the highlighted card into view when it changes.
  useEffect(() => {
    if (!highlightedId) return;
    const el = cardRefs.current.get(highlightedId);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedId]);

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Side panel */}
      <div
        className="ml-auto h-full w-full max-w-md bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col relative animate-in slide-in-from-right duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 p-4 md:p-5 bg-gradient-to-br from-orange-500/5 to-transparent">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-black dark:text-white leading-none">Add From Jobs</h2>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1.5">Drag onto calendar · or click to schedule</p>
            </div>
            <button onClick={onClose}
              className="text-slate-400 hover:text-black dark:hover:text-white text-xs font-black uppercase tracking-widest px-2 py-1">
              Close ✕
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 mb-3">
            {[
              { id: "next", label: "Next Action" },
              { id: "all",  label: "All Stages" },
              { id: "due",  label: "Due ≤ 7d" },
            ].map(t => (
              <button key={t.id}
                onClick={() => setFilter(t.id as any)}
                className={`flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                  filter === t.id
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by customer, job#, stage…"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-medium outline-none focus:border-orange-500"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-5">
          {grouped.length === 0 ? (
            <div className="text-center py-16 text-[10px] tracking-widest font-bold text-slate-300 dark:text-slate-700 uppercase">
              No jobs match
            </div>
          ) : grouped.map(({ stage, jobs: stageJobs }) => {
            const cls = STAGE_COLORS[stage] || STAGE_COLORS.Incoming;
            return (
              <div key={stage}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className={`w-2 h-2 rounded-full ${cls.chip}`}></div>
                  <div className={`text-[9px] font-black uppercase tracking-[0.3em] ${cls.text}`}>{stage}</div>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                  <div className="text-[9px] font-black text-slate-400">{stageJobs.length}</div>
                </div>
                <div className="space-y-2">
                  {stageJobs.map((job: any) => (
                    <div
                      key={job.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(job.id, el);
                        else cardRefs.current.delete(job.id);
                      }}
                      className={`rounded-xl transition-all ${highlightedId === job.id ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950" : ""}`}
                      onMouseEnter={() => setHighlightedId(job.id)}
                    >
                      <JobPickerCard job={job} onClick={() => onClickJob(job)} onDragStart={() => onDragStart(job)} onDragEnd={onDragEnd} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-900/50 text-center">
          <div className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center justify-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[8px] font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[8px] font-mono">↵</kbd>
              Schedule
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[8px] font-mono">⌘1/2/3</kbd>
              Filter
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[8px] font-mono">esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobPickerCard({ job, onClick, onDragStart, onDragEnd }: {
  job: any;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const cls = STAGE_COLORS[job.stage] || STAGE_COLORS.Incoming;
  const verb = STAGE_VERB[job.stage] || job.stage;
  const customer = job.quotes?.customers?.company_name || job.title || `#${job.job_number}`;
  const items = summarizeItems(job.quotes?.quote_items);

  // Due date pill
  let dueLabel = "";
  let dueClass = "text-slate-400";
  if (job.due_date) {
    const due = new Date(job.due_date + "T12:00:00");
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const days = Math.ceil((due.getTime() - today0.getTime()) / 86400000);
    if (days < 0) { dueLabel = `${-days}d late`; dueClass = "text-red-500"; }
    else if (days === 0) { dueLabel = "Today"; dueClass = "text-amber-500"; }
    else if (days <= 3) { dueLabel = `${days}d`; dueClass = "text-amber-500"; }
    else if (days <= 7) { dueLabel = `${days}d`; dueClass = "text-emerald-500"; }
    else { dueLabel = `${days}d`; dueClass = "text-slate-400"; }
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        // Required for Firefox to register the drag
        e.dataTransfer.setData("text/plain", String(job.id));
        e.dataTransfer.effectAllowed = "copy";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`relative rounded-xl ${cls.bg} border border-slate-200/50 dark:border-slate-800 hover:ring-2 ${cls.ring} cursor-grab active:cursor-grabbing transition-all p-3 pl-4 group`}
      title="Drag to schedule, click for details"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cls.chip} rounded-l-xl`}></div>

      {/* Drag handle indicator (visible on hover) */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 text-[10px] font-black tracking-widest pointer-events-none">⋮⋮</div>

      <div className="flex items-start justify-between gap-2 mb-1">
        <div className={`text-[8px] font-black uppercase tracking-[0.3em] ${cls.text}`}>{verb}</div>
        <div className="flex items-center gap-2 text-[8px] font-black tracking-widest">
          <span className="text-slate-400">#{job.job_number}</span>
          {dueLabel && <span className={dueClass}>· {dueLabel}</span>}
        </div>
      </div>

      <div className="text-[13px] font-black tracking-tight text-black dark:text-white leading-tight mb-1">
        {customer}
      </div>

      {items && (
        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
          {items}
        </div>
      )}

      {job.title && customer !== job.title && (
        <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 italic truncate">
          {job.title}
        </div>
      )}
    </div>
  );
}

// ─── SCHEDULE JOB MODAL (click → detailed scheduling) ────────────────────────────
function ScheduleJobModal({ job, defaultDate, onClose, onSchedule }: {
  job: any;
  defaultDate: string;
  onClose: () => void;
  onSchedule: (opts: { date: string; time: string | null; duration: number; titleOverride?: string; notes?: string; energy?: string | null; priority?: string }) => Promise<void>;
}) {
  const cls = STAGE_COLORS[job.stage] || STAGE_COLORS.Incoming;
  const autoTitle = useMemo(() => buildJobTaskTitle(job), [job]);

  const [title, setTitle] = useState(autoTitle);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [unscheduled, setUnscheduled] = useState(false);
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [energy, setEnergy] = useState<string | null>(null);
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSchedule({
        date,
        time: unscheduled ? null : (time ? `${time}:00` : null),
        duration,
        titleOverride: title !== autoTitle ? title : undefined,
        notes: notes || undefined,
        energy,
        priority,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Job context header */}
        <div className={`relative ${cls.bg} rounded-xl p-4 mb-5 border border-slate-200/50 dark:border-slate-800`}>
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${cls.chip} rounded-l-xl`}></div>
          <div className="pl-2">
            <div className={`text-[8px] font-black uppercase tracking-[0.3em] ${cls.text} mb-1`}>{job.stage} · #{job.job_number}</div>
            <div className="text-base font-black tracking-tight text-black dark:text-white">{job.quotes?.customers?.company_name || job.title}</div>
            {summarizeItems(job.quotes?.quote_items, 60) && (
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">{summarizeItems(job.quotes?.quote_items, 60)}</div>
            )}
          </div>
        </div>

        <h2 className="text-lg font-black uppercase italic tracking-tighter text-black dark:text-white mb-4">Schedule Task</h2>

        <div className="space-y-4">
          <Field label="Task Title">
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-orange-500" />
            {title !== autoTitle && (
              <button onClick={() => setTitle(autoTitle)} className="text-[9px] text-slate-400 hover:text-orange-500 mt-1 font-black uppercase tracking-widest">↺ Reset to auto</button>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-orange-500" />
            </Field>
            <Field label={unscheduled ? "Time (skipped)" : "Time"}>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} disabled={unscheduled}
                className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-orange-500 ${unscheduled ? "opacity-40" : ""}`} />
            </Field>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={unscheduled} onChange={e => setUnscheduled(e.target.checked)} className="w-4 h-4 accent-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Unscheduled (add to pool)</span>
          </label>

          <Field label="Duration (minutes)">
            <div className="flex gap-1.5">
              {[15, 30, 60, 90, 120].map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                    duration === d ? "bg-orange-500 text-white border-orange-500" : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}>{d < 60 ? `${d}m` : `${d / 60}h`}</button>
              ))}
              <input type="number" min={5} step={5} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 60)}
                className="w-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-xs font-black text-center outline-none focus:border-orange-500" />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <div className="flex gap-1">
                {PRIORITIES.map(p => (
                  <button key={p.id} onClick={() => setPriority(p.id)}
                    className={`flex-1 px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                      priority === p.id ? `${p.color} border-current` : "text-slate-400 border-slate-200 dark:border-slate-800"
                    }`}>{p.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Energy">
              <div className="flex gap-1">
                {ENERGY_LEVELS.map(e => (
                  <button key={e.id} onClick={() => setEnergy(energy === e.id ? null : e.id)}
                    className={`flex-1 px-2 py-2 rounded-lg text-sm font-black border transition-all ${
                      energy === e.id ? "bg-amber-500/10 text-amber-500 border-amber-500/40" : "border-slate-200 dark:border-slate-800"
                    }`} title={e.label}>{e.icon}</button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Reminders for yourself…"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-orange-500 resize-none" />
          </Field>
        </div>

        <div className="flex gap-2 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
          <div className="flex-1"></div>
          <button onClick={submit} disabled={saving} className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-400 disabled:opacity-50">
            {saving ? "Scheduling…" : "Schedule Task"}
          </button>
        </div>

        <p className="text-[8px] text-slate-400 dark:text-slate-500 mt-3 text-center leading-relaxed">
          Creates a row in your day planner and a synced task on the production board.
        </p>
      </div>
    </div>
  );
}

// ─── QUICK CAPTURE (structured: job bubble + task-type bubble + optional time) ───
// Three-stage flow inside one input bar:
//   1. type letters → suggestion list of jobs/customers → pick → job bubble
//   2. pick a task type chip (To Purchase / To Print / …) → task bubble
//   3. (optional) type a time like "930pm" or "930pm-90" → press Enter to commit
// Auto-calculates duration from quote_items.quantity (1 min per item) — overridable.
function QuickCapture({
  jobs,
  onCapture,
  voiceSupported,
  voiceListening,
  onStartVoice,
  voiceText,
  clearVoiceText,
  onFreeFormCapture,
  freeFormValue,
  setFreeFormValue,
}: {
  jobs: any[];
  onCapture: (args: { job: any; taskType: typeof QUICK_TASK_TYPES[number]; time: string | null; duration: number }) => Promise<void>;
  voiceSupported: boolean;
  voiceListening: boolean;
  onStartVoice: () => void;
  voiceText: string;
  clearVoiceText: () => void;
  onFreeFormCapture: () => void;
  freeFormValue: string;
  setFreeFormValue: (v: string) => void;
}) {
  // Stage state — null means "not yet picked"
  const [job, setJob] = useState<any | null>(null);
  const [taskType, setTaskType] = useState<typeof QUICK_TASK_TYPES[number] | null>(null);

  // Search state (stage 1)
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // Time + duration state (stage 3)
  const [timeInput, setTimeInput] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [durationDirty, setDurationDirty] = useState(false); // user manually edited duration?
  const [submitting, setSubmitting] = useState(false);
  const [timeParseError, setTimeParseError] = useState(false);

  // Free-form fallback toggle (legacy "Email John tomorrow at 2pm" capture)
  const [showFreeForm, setShowFreeForm] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  // Auto-focus the time field when we get to stage 3
  useEffect(() => {
    if (job && taskType) timeRef.current?.focus();
    else if (!job) searchRef.current?.focus();
  }, [job, taskType]);

  // When a job is picked, derive the default duration from item quantities.
  useEffect(() => {
    if (job && !durationDirty) {
      setDuration(defaultDurationForJob(job));
    }
  }, [job, durationDirty]);

  // Filter the jobs list (top 6) — match against customer + job title + job number.
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) return [];
    return jobs
      .filter(j => {
        const customer = (j.quotes?.customers?.company_name || "").toLowerCase();
        const title = (j.title || "").toLowerCase();
        const num = String(j.job_number || "");
        const stage = (j.stage || "").toLowerCase();
        return customer.includes(q) || title.includes(q) || num.includes(q) || stage.includes(q);
      })
      .slice(0, 6);
  }, [jobs, search]);

  // ─── SHORTHAND DETECTION ────────────────────────────────────────────────────
  // If the user types something like "roof press 930pm-90", we parse it and offer
  // to commit in one keystroke. Returns null if the input doesn't match.
  const shorthand = useMemo(() => {
    const parsed = parseShorthand(search);
    if (!parsed) return null;
    const job = jobs.find(j => {
      const customer = (j.quotes?.customers?.company_name || "").toLowerCase();
      const title = (j.title || "").toLowerCase();
      return customer.includes(parsed.jobMatch) || title.includes(parsed.jobMatch);
    });
    if (!job) return null;
    const taskType = QUICK_TASK_TYPES.find(t => t.id === parsed.taskType);
    if (!taskType) return null;
    return { job, taskType, time: parsed.time, duration: parsed.duration };
  }, [search, jobs]);

  const reset = () => {
    setJob(null); setTaskType(null);
    setSearch(""); setTimeInput("");
    setDuration(30); setDurationDirty(false);
    setHighlight(0); setSuggestionsOpen(false);
    setTimeParseError(false);
  };

  // Commit shorthand directly — bypasses all 3 stages
  const commitShorthand = async () => {
    if (!shorthand) return;
    const dur = shorthand.duration ?? defaultDurationForJob(shorthand.job);
    setSubmitting(true);
    try {
      await onCapture({
        job: shorthand.job,
        taskType: shorthand.taskType,
        time: shorthand.time,
        duration: dur,
      });
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const pickJob = (j: any) => {
    setJob(j);
    setSearch("");
    setSuggestionsOpen(false);
  };

  const submit = async () => {
    if (!job || !taskType) return;
    let parsedTime: string | null = null;
    let durOverride: number | null = null;
    if (timeInput.trim()) {
      const parsed = parseTimeInput(timeInput);
      if (!parsed) {
        setTimeParseError(true);
        return;
      }
      parsedTime = parsed.time;
      durOverride = parsed.duration;
    }
    setTimeParseError(false);
    setSubmitting(true);
    try {
      await onCapture({
        job,
        taskType,
        time: parsedTime,
        duration: durOverride ?? duration,
      });
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const taskCls = taskType ? TASK_TYPE_CLASSES[taskType.color] : null;

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Quick Capture</div>
        <button
          onClick={() => setShowFreeForm(s => !s)}
          className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-sky-500"
        >
          {showFreeForm ? "↺ Job mode" : "✎ Free text"}
        </button>
      </div>

      {showFreeForm ? (
        /* Legacy free-text capture (preserved for personal todos like "email John") */
        <div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={freeFormValue}
              onChange={e => setFreeFormValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") onFreeFormCapture(); }}
              placeholder="Email John tomorrow at 2pm for 30m #work !"
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-sky-500"
            />
            {voiceSupported && (
              <button onClick={onStartVoice}
                className={`px-3 py-3 rounded-xl text-lg ${voiceListening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                title={voiceListening ? "Stop listening" : "Voice input"}>
                🎙
              </button>
            )}
            <button onClick={onFreeFormCapture}
              className="px-4 py-3 rounded-xl bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-sky-500 transition-all">
              Add
            </button>
          </div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
            Hints: <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">at 3pm</code>, <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">tomorrow</code>, <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">for 45m</code>, <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">#work</code>
          </div>
        </div>
      ) : (
        /* Structured bubble flow */
        <div className="space-y-3">
          {/* Bubble row — shows picked job + task type chips */}
          <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
            {job ? (
              <button
                onClick={reset}
                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/30 text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 hover:bg-orange-500/20"
                title="Clear and start over"
              >
                <span className="tracking-tight normal-case font-black">
                  {job.quotes?.customers?.company_name || job.title || `#${job.job_number}`}
                </span>
                <span className="opacity-50">#{job.job_number}</span>
                <span className="opacity-50 group-hover:opacity-100 ml-0.5">×</span>
              </button>
            ) : (
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                1. Pick a job
              </span>
            )}

            {taskType && taskCls && (
              <button
                onClick={() => { setTaskType(null); setTimeInput(""); }}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${taskCls.bg} border ${taskCls.border} text-[10px] font-black uppercase tracking-widest ${taskCls.text} hover:brightness-110`}
                title="Clear task type"
              >
                <span>{taskType.label}</span>
                <span className="opacity-50 group-hover:opacity-100 ml-0.5">×</span>
              </button>
            )}
          </div>

          {/* Stage 1 — job search */}
          {!job && (
            <div className="relative">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setSuggestionsOpen(true); setHighlight(0); }}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (shorthand) { commitShorthand(); }
                    else if (suggestions[highlight]) { pickJob(suggestions[highlight]); }
                  }
                  else if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
                  else if (e.key === "Escape") { setSearch(""); setSuggestionsOpen(false); }
                }}
                placeholder="Type a name… or shorthand: roof press 930pm-90"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-sky-500"
              />

              {/* Shorthand preview — appears above suggestions when input parses cleanly */}
              {shorthand && suggestionsOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-gradient-to-r from-sky-500/10 to-emerald-500/10 border-2 border-sky-500/40 rounded-xl shadow-2xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-sky-500">⚡ Shorthand match</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Press Enter to commit</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase tracking-widest">
                      {shorthand.job.quotes?.customers?.company_name || shorthand.job.title}
                    </span>
                    <span className="text-slate-400 text-[10px]">→</span>
                    <span className={`px-2 py-0.5 rounded ${TASK_TYPE_CLASSES[shorthand.taskType.color].bg} ${TASK_TYPE_CLASSES[shorthand.taskType.color].text} text-[10px] font-black uppercase tracking-widest`}>
                      {shorthand.taskType.label}
                    </span>
                    {shorthand.time && (
                      <>
                        <span className="text-slate-400 text-[10px]">@</span>
                        <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 text-[10px] font-black uppercase tracking-widest">
                          {fmt12hr(shorthand.time)}
                        </span>
                      </>
                    )}
                    <span className="text-slate-400 text-[10px]">·</span>
                    <span className="text-[10px] font-black text-slate-500">
                      {shorthand.duration ?? defaultDurationForJob(shorthand.job)}m
                    </span>
                  </div>
                </div>
              )}
              {suggestionsOpen && search.trim() && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                  {suggestions.map((j, idx) => {
                    const cls = STAGE_COLORS[j.stage] || STAGE_COLORS.Incoming;
                    const customer = j.quotes?.customers?.company_name || j.title || `#${j.job_number}`;
                    const items = summarizeItems(j.quotes?.quote_items, 36);
                    return (
                      <button
                        key={j.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickJob(j)}
                        onMouseEnter={() => setHighlight(idx)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors border-b last:border-b-0 border-slate-100 dark:border-slate-900 ${
                          idx === highlight ? "bg-sky-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900"
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cls.chip}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-black tracking-tight text-black dark:text-white truncate">
                            {customer}
                          </div>
                          {items && (
                            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate">{items}</div>
                          )}
                        </div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                          #{j.job_number} · {j.stage}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {suggestionsOpen && search.trim() && suggestions.length === 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  No matching jobs
                </div>
              )}
            </div>
          )}

          {/* Stage 2 — task type chips */}
          {job && !taskType && (
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">2. Pick a task</div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TASK_TYPES.map(t => {
                  const cls = TASK_TYPE_CLASSES[t.color];
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTaskType(t)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${cls.bg} ${cls.text} border-transparent hover:${cls.border} hover:ring-1 hover:${cls.ring} transition-all`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stage 3 — optional time + duration + submit */}
          {job && taskType && (
            <div className="space-y-2.5">
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                3. Time <span className="text-slate-300 dark:text-slate-600">(optional — blank goes to pool)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={timeRef}
                  type="text"
                  value={timeInput}
                  onChange={e => { setTimeInput(e.target.value); setTimeParseError(false); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") submit();
                    if (e.key === "Escape") reset();
                  }}
                  placeholder="930pm  ·  930pm-90  ·  9:30am  ·  blank = pool"
                  className={`flex-1 bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-sky-500 ${
                    timeParseError ? "border-red-500" : "border-slate-200 dark:border-slate-800"
                  }`}
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={duration}
                    onChange={e => { setDuration(parseInt(e.target.value) || 5); setDurationDirty(true); }}
                    className="w-16 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-3 text-sm font-black text-center outline-none focus:border-sky-500"
                    title="Duration in minutes"
                  />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">min</span>
                </div>
              </div>

              {/* Live preview of what will be committed */}
              <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                  {totalItemsForJob(job) > 0 && !durationDirty
                    ? <>Auto: <span className="text-slate-600 dark:text-slate-300">{totalItemsForJob(job)} items</span> × 1 min = <span className="text-slate-600 dark:text-slate-300">{duration}m</span></>
                    : <>Duration: <span className="text-slate-600 dark:text-slate-300">{duration}m</span></>
                  }
                  {timeInput.trim() && (() => {
                    const p = parseTimeInput(timeInput);
                    if (!p || (!p.time && p.duration === null)) return null;
                    return (
                      <span className="ml-2">
                        → <span className="text-sky-500">
                            {p.time ? fmt12hr(p.time) : "(no time)"}
                            {p.duration ? ` · ${p.duration}m override` : ""}
                          </span>
                      </span>
                    );
                  })()}
                </div>
                {timeParseError && (
                  <span className="text-[9px] font-bold text-red-500">Couldn&apos;t parse time</span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={reset}
                  className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <div className="flex-1" />
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-sky-500 transition-all disabled:opacity-50"
                >
                  {submitting ? "Saving…" : timeInput.trim() && parseTimeInput(timeInput)?.time ? "Schedule" : "Add to Pool"}
                </button>
              </div>
            </div>
          )}

          {/* Voice + helper hint, only on stage 1 */}
          {!job && (
            <div className="flex items-center justify-between gap-2">
              <div className="text-[9px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Letters → pick → task → time. Or shorthand: <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded text-[9px]">roof press 930pm-90</code>
              </div>
              {voiceSupported && (
                <button onClick={onStartVoice}
                  className={`px-2.5 py-1.5 rounded-lg text-sm ${voiceListening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                  title={voiceListening ? "Stop listening" : "Voice input"}>
                  🎙
                </button>
              )}
            </div>
          )}

          {/* Voice transcript preview — if user used voice while in structured mode,
              we just push the transcript into the search field */}
          {voiceText && !job && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <span className="text-amber-500">🎙</span>
              <span className="flex-1 italic">{voiceText}</span>
              <button onClick={() => { setSearch(voiceText); clearVoiceText(); }}
                className="text-[9px] font-black uppercase tracking-widest text-sky-500">Use ↑</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PRIORITY LIST (drag-and-drop reordering) ────────────────────────────────────
// Reorders by rewriting `sort_order`. Uses native HTML5 drag-and-drop so it works
// on desktop without any new dependencies. Mobile users can use the up/down buttons.
function PriorityList({
  tasks,
  onReorder,
  onToggle,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  onReorder: (orderedIds: string[]) => Promise<void>;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  // Local copy so the list moves smoothly during a drag (we commit on drop)
  const [localOrder, setLocalOrder] = useState<Task[]>(tasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Re-sync local order whenever the parent list changes (e.g. realtime / fetch)
  useEffect(() => { setLocalOrder(tasks); }, [tasks]);

  const move = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= localOrder.length) return;
    const next = [...localOrder];
    const [picked] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, picked);
    setLocalOrder(next);
    onReorder(next.map(t => t.id));
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const fromIdx = localOrder.findIndex(t => t.id === dragId);
    const toIdx   = localOrder.findIndex(t => t.id === targetId);
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); setOverId(null); return; }
    const next = [...localOrder];
    const [picked] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, picked);
    setLocalOrder(next);
    setDragId(null); setOverId(null);
    onReorder(next.map(t => t.id));
  };

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Priority · Drag to Reorder</div>
        <div className="text-[9px] font-black text-slate-400">{localOrder.length}</div>
      </div>

      {localOrder.length === 0 ? (
        <div className="text-center py-10 text-[10px] tracking-widest font-bold text-slate-300 dark:text-slate-700 uppercase">
          No tasks for this day yet
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {localOrder.map((t, idx) => {
            const cat = CATEGORIES.find(c => c.id === t.category) || CATEGORIES[0];
            const cls = CATEGORY_CLASSES[cat.color];
            const isDragging = dragId === t.id;
            const isDropTarget = overId === t.id && dragId !== t.id;
            return (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", t.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDragId(t.id);
                }}
                onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== t.id) setOverId(t.id); }}
                onDragLeave={() => { if (overId === t.id) setOverId(null); }}
                onDrop={(e) => { e.preventDefault(); handleDrop(t.id); }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                className={`group relative flex items-center gap-2 rounded-xl border ${cls.bg} border-slate-200/50 dark:border-slate-800 px-2 py-2 cursor-grab active:cursor-grabbing transition-all ${
                  isDragging ? "opacity-40" : ""
                } ${
                  isDropTarget ? "ring-2 ring-sky-500" : ""
                }`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${cls.chip} rounded-l-xl`} />

                {/* Rank number */}
                <div className="w-6 text-center text-[11px] font-black text-slate-400 tabular-nums shrink-0">
                  {idx + 1}
                </div>

                {/* Drag handle indicator */}
                <div className="text-slate-400 dark:text-slate-600 text-xs leading-none select-none shrink-0" title="Drag to reorder">⋮⋮</div>

                {/* Checkbox */}
                <button onClick={(e) => { e.stopPropagation(); onToggle(t); }}
                  className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    t.is_completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-slate-600 hover:border-emerald-400"
                  }`}>
                  {t.is_completed && <span className="text-[8px] leading-none">✓</span>}
                </button>

                {/* Title + meta (clickable to edit) */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(t)}>
                  <div className={`text-[11px] font-bold leading-tight truncate ${t.is_completed ? "line-through opacity-50" : ""}`}>
                    {t.title}
                  </div>
                  <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest mt-0.5">
                    {t.target_time
                      ? <span className="text-sky-500">{fmt12hr(t.target_time)}</span>
                      : <span className="text-slate-400">Unscheduled</span>
                    }
                    <span className="text-slate-400">{t.duration_minutes}m</span>
                    {t.jobs && <span className="text-orange-400 normal-case tracking-tight">#{t.jobs.job_number}</span>}
                  </div>
                </div>

                {/* Mobile-friendly up/down buttons */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); move(idx, idx - 1); }}
                    disabled={idx === 0}
                    className="w-5 h-4 rounded text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                    title="Move up"
                  >▲</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); move(idx, idx + 1); }}
                    disabled={idx === localOrder.length - 1}
                    className="w-5 h-4 rounded text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                    title="Move down"
                  >▼</button>
                </div>

                <button onClick={(e) => { e.stopPropagation(); onDelete(t); }}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs px-1 transition-all shrink-0" title="Delete">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-700 text-center mt-3">
        Top of list = highest priority
      </div>
    </div>
  );
}

// ─── DEPENDENCY PROMPT MODAL ──────────────────────────────────────────────────
// Asks the user whether to cascade a time change to downstream production tasks
// for the same job. Surfaces the affected task list so they can sanity-check.
function DependencyPrompt({ prompt, onConfirm, onCancel }: {
  prompt: { sourceTask: Task; affected: Task[]; deltaMs: number; kind: "move" | "complete" };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const deltaMin = Math.round(prompt.deltaMs / 60_000);
  const deltaLabel = deltaMin === 0 ? "no shift" :
    Math.abs(deltaMin) >= 60 ? `${deltaMin > 0 ? "+" : "−"}${(Math.abs(deltaMin) / 60).toFixed(1)}h` :
    `${deltaMin > 0 ? "+" : "−"}${Math.abs(deltaMin)}m`;

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onCancel}>
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-[9px] font-black uppercase tracking-[0.4em] text-amber-500 mb-2">↺ Dependency Cascade</div>
        <h2 className="text-xl font-black uppercase italic tracking-tighter text-black dark:text-white mb-1">Shift downstream tasks?</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
          You moved <span className="font-bold text-black dark:text-white">{taskTypeLabel(prompt.sourceTask) || "this task"}</span> by <span className="font-black text-amber-500">{deltaLabel}</span>.
          The following downstream task{prompt.affected.length > 1 ? "s" : ""} for the same job <span className="font-bold">should</span> usually shift too:
        </p>

        <div className="space-y-1.5 mb-5 max-h-64 overflow-y-auto">
          {prompt.affected.map(t => {
            const newTime = t.target_time
              ? (() => {
                  const d = new Date(`${t.target_date}T${t.target_time}`);
                  d.setTime(d.getTime() + prompt.deltaMs);
                  return d.toTimeString().slice(0, 5);
                })()
              : null;
            return (
              <div key={t.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 shrink-0">{taskTypeLabel(t) || "Task"}</span>
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex-1 truncate">{t.title.replace(/^[A-Za-z\s]+·\s*/, "")}</span>
                <span className="text-[9px] font-black tabular-nums text-slate-400 shrink-0">
                  {fmt12hr(t.target_time)} → <span className="text-amber-500">{newTime ? fmt12hr(newTime + ":00") : "—"}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700">
            Don&apos;t shift
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-amber-400">
            Shift {prompt.affected.length} task{prompt.affected.length > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QR TASK MODAL ───────────────────────────────────────────────────────────
// Shows a printable QR code that, when scanned, completes this task. The QR
// encodes a URL that hits /my-day?complete=<id> — handled by the page on load.
function QRTaskModal({ task, onClose }: {
  task: Task;
  onClose: () => void;
}) {
  // Read origin synchronously when available — avoids react-hooks/set-state-in-effect lint
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/my-day?complete=${task.id}`;

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const canvas = document.querySelector("#qr-task-canvas") as HTMLCanvasElement | null;
    const dataUrl = canvas?.toDataURL?.("image/png") ?? "";
    const safeTitle = task.title.replace(/[<>]/g, "");
    w.document.write(
      "<html><head><title>QR: " + safeTitle + "</title>" +
      "<style>body{font-family:-apple-system,sans-serif;padding:40px;text-align:center}" +
      "img{display:block;margin:0 auto 20px}" +
      "h1{font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px}" +
      "p{font-size:11px;color:#666;margin:4px 0}</style></head><body>" +
      '<img src="' + dataUrl + '" width="240" height="240" />' +
      "<h1>" + safeTitle + "</h1>" +
      "<p>Scan to mark complete</p>" +
      '<p style="font-size:9px;opacity:.5">' + url + "</p>" +
      "</body></html>"
    );
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 250);
  };

  return (
    <div className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
        <div className="text-[9px] font-black uppercase tracking-[0.4em] text-violet-500 mb-2">▦ Task QR Code</div>
        <h2 className="text-base font-black tracking-tight text-black dark:text-white mb-4 leading-tight">{task.title}</h2>

        <div className="bg-white p-4 rounded-xl mb-4 inline-block">
          {origin ? (
            <QRCodeCanvas
              id="qr-task-canvas"
              value={url}
              size={220}
              level="H"
              includeMargin={false}
            />
          ) : (
            <div className="w-[220px] h-[220px] bg-slate-100 animate-pulse rounded" />
          )}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Scan to mark complete</p>
        <p className="text-[8px] font-mono text-slate-300 dark:text-slate-700 mb-5 break-all">{url}</p>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700">
            Close
          </button>
          <button onClick={handlePrint} className="flex-1 px-4 py-2.5 rounded-xl bg-violet-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-violet-400">
            🖨 Print
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SHOP MODE (full-screen big-button view) ─────────────────────────────────
// Vertical stack of huge, time-ordered cards for today. Optimized for one hand
// + a phone propped on the press. Big checkbox, big start button, big +/− on
// item lines.
function ShopMode({ tasks, onClose, onToggle, onStart, onBumpItem, onShowQR }: {
  tasks: Task[];
  onClose: () => void;
  onToggle: (t: Task) => void;
  onStart: (t: Task) => void;
  onBumpItem: (task: Task, subtaskId: string, delta: number) => void;
  onShowQR: (t: Task) => void;
}) {
  // Today only. Show scheduled, then unscheduled. Hide completed at the bottom.
  const today = todayISO();
  const today2 = useMemo(() => tasks.filter(t => t.target_date === today && !t.is_deleted), [tasks, today]);
  const active = useMemo(() =>
    today2.filter(t => !t.is_completed)
      .sort((a, b) => {
        const aT = a.target_time ? minsFromTime(a.target_time) : 99999;
        const bT = b.target_time ? minsFromTime(b.target_time) : 99999;
        return aT - bT;
      }),
    [today2]
  );
  const done = useMemo(() => today2.filter(t => t.is_completed), [today2]);

  // Live clock for "now" highlighting
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(id); }, []);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Find the task that's "happening now"
  const currentTaskId = useMemo(() => {
    for (const t of active) {
      if (!t.target_time) continue;
      const start = minsFromTime(t.target_time);
      const end = start + (t.duration_minutes || 30);
      if (nowMins >= start && nowMins < end) return t.id;
    }
    return null;
  }, [active, nowMins]);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-[#0f1115] overflow-y-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b-2 border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.4em] text-pink-500">🏭 Shop Mode</div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-black dark:text-white leading-none">
              {fmtDayHeader(today)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-2xl font-black tabular-nums text-black dark:text-white leading-none">
                {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                {done.length} / {today2.length} done
              </div>
            </div>
            <button onClick={onClose}
              className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-700">
              ✕ Exit
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {active.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎉</div>
            <div className="text-2xl font-black uppercase italic tracking-tighter text-black dark:text-white">All done</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Nothing left for today</div>
          </div>
        ) : (
          active.map(t => (
            <ShopModeCard
              key={t.id}
              task={t}
              isCurrent={t.id === currentTaskId}
              onToggle={() => onToggle(t)}
              onStart={() => onStart(t)}
              onBumpItem={(sid, delta) => onBumpItem(t, sid, delta)}
              onShowQR={() => onShowQR(t)}
            />
          ))
        )}

        {/* Completed pile */}
        {done.length > 0 && (
          <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-800">
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-2">✓ Done · {done.length}</div>
            <div className="space-y-1.5">
              {done.map(t => (
                <div key={t.id} className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <span className="text-emerald-500">✓</span>
                  <span className="flex-1 text-xs font-bold line-through opacity-60 truncate">{t.title}</span>
                  {t.actual_minutes != null && (
                    <span className="text-[9px] font-black tabular-nums text-slate-400">{t.actual_minutes}m</span>
                  )}
                  <button onClick={() => onToggle(t)} className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500" title="Undo">↺</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShopModeCard({ task, isCurrent, onToggle, onStart, onBumpItem, onShowQR }: {
  task: Task;
  isCurrent: boolean;
  onToggle: () => void;
  onStart: () => void;
  onBumpItem: (subtaskId: string, delta: number) => void;
  onShowQR: () => void;
}) {
  const cat = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[0];
  const cls = CATEGORY_CLASSES[cat.color];
  const itemProgress = itemChecklistProgress(task.subtasks || []);

  // Live elapsed timer if started
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!task.started_at) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [task.started_at]);
  const elapsed = task.started_at ? Math.floor((now - Date.parse(task.started_at)) / 1000) : 0;
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;
  const overEst = task.duration_minutes > 0 && elapsedMin > task.duration_minutes;

  return (
    <div className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
      isCurrent
        ? `${cls.bg} ring-4 ring-pink-500 shadow-2xl scale-[1.01] border-transparent`
        : `${cls.bg} border-slate-200 dark:border-slate-800`
    }`}>
      <div className={`absolute left-0 top-0 bottom-0 w-2 ${cls.chip}`} />

      {isCurrent && (
        <div className="absolute top-0 right-0 bg-pink-500 text-white text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-bl-lg animate-pulse">
          ● Now
        </div>
      )}

      <div className="p-5 pl-7">
        {/* Top row: time + meta */}
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 flex-wrap">
          {task.target_time && (
            <span className="text-base font-black tracking-tighter italic text-black dark:text-white normal-case">
              {fmt12hr(task.target_time)}
            </span>
          )}
          <span className={cls.text}>· {task.duration_minutes}m</span>
          {task.jobs && <span className="text-orange-500 normal-case tracking-tight">#{task.jobs.job_number}</span>}
          {task.energy && <span>{ENERGY_LEVELS.find(e => e.id === task.energy)?.icon}</span>}
        </div>

        {/* Title — large, readable */}
        <div className="text-xl font-black tracking-tight text-black dark:text-white leading-snug mb-3">
          {task.title}
        </div>

        {/* Live timer (if running) */}
        {task.started_at && !task.is_completed && (
          <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg ${overEst ? "bg-red-500/10 text-red-500" : "bg-sky-500/10 text-sky-500"}`}>
            <span className="text-lg">●</span>
            <span className="text-[10px] font-black uppercase tracking-widest">
              {overEst ? "Over estimate" : "Running"}
            </span>
            <span className="ml-auto text-2xl font-black tabular-nums tracking-tighter">
              {String(elapsedMin).padStart(2, "0")}:{String(elapsedSec).padStart(2, "0")}
            </span>
          </div>
        )}

        {/* Item checklist */}
        {itemProgress && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                Item Checklist
              </div>
              <div className="text-[14px] font-black tabular-nums text-black dark:text-white">
                {itemProgress.done} / {itemProgress.total}
              </div>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all"
                style={{ width: `${(itemProgress.done / itemProgress.total) * 100}%` }} />
            </div>
            <div className="space-y-2">
              {(task.subtasks || []).map(s => {
                const meta = parseItemSubtask(s);
                if (!meta) return null;
                return (
                  <div key={s.id} className={`flex items-center gap-2 rounded-xl px-3 py-3 transition-all ${
                    s.done ? "bg-emerald-500/10 opacity-50" : "bg-white dark:bg-slate-900"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[15px] font-black tracking-tight ${s.done ? "line-through" : ""}`}>{meta.name}</div>
                      <div className="text-[10px] font-black tabular-nums text-slate-400">{meta.done} / {meta.total}</div>
                    </div>
                    <button
                      onClick={() => onBumpItem(s.id, -1)}
                      disabled={meta.done <= 0}
                      className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-2xl font-black hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-transform"
                      title="Decrement"
                    >−</button>
                    <button
                      onClick={() => onBumpItem(s.id, +1)}
                      disabled={meta.done >= meta.total}
                      className="w-12 h-12 rounded-xl bg-amber-500 text-white text-2xl font-black hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-transform shadow-md"
                      title="Increment"
                    >+</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Big action buttons */}
        <div className="flex gap-2">
          {!task.started_at && !task.is_completed && (
            <button onClick={onStart}
              className="flex-1 px-4 py-4 rounded-xl bg-emerald-500 text-white text-sm font-black uppercase tracking-widest hover:bg-emerald-400 active:scale-95 transition-transform shadow-md">
              ▶ Start
            </button>
          )}
          <button onClick={onToggle}
            className={`flex-1 px-4 py-4 rounded-xl text-sm font-black uppercase tracking-widest active:scale-95 transition-transform shadow-md ${
              task.is_completed
                ? "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                : "bg-sky-600 text-white hover:bg-sky-500"
            }`}>
            {task.is_completed ? "↺ Undo" : "✓ Mark Done"}
          </button>
          <button onClick={onShowQR}
            title="Show QR code"
            className="px-4 py-4 rounded-xl bg-violet-500/10 text-violet-500 border-2 border-violet-500/30 text-lg font-black hover:bg-violet-500/20 active:scale-95 transition-transform">
            ▦
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI HELPERS (top + bottom strips) ────────────────────────────────────
// Defined at module scope so they don't get re-created every render of
// MyDayPage (which would otherwise lose focus on inputs etc.).

function KpiCard({ label, value, valueNode, icon, iconBg, alert }: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  icon?: string;
  iconBg?: string;
  alert?: boolean;
}) {
  return (
    <div className={`bg-white dark:bg-slate-950 border ${alert ? "border-red-300 dark:border-red-500/40" : "border-slate-200 dark:border-slate-800"} rounded-xl p-3.5 shadow-sm flex items-center gap-3`}>
      {icon && (
        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-base ${iconBg ?? "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {valueNode ?? <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">{value}</div>}
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}

function BottomStatCard({ label, value, sublabel, icon, alert }: {
  label: string;
  value: string;
  sublabel: string;
  icon: string;
  alert?: boolean;
}) {
  return (
    <div className={`bg-white dark:bg-slate-950 border ${alert ? "border-red-300 dark:border-red-500/40" : "border-slate-200 dark:border-slate-800"} rounded-xl p-4 shadow-sm flex items-center justify-between gap-3`}>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-1.5 truncate">{label}</div>
        <div className={`text-3xl font-black tracking-tight leading-none ${alert ? "text-red-500" : "text-slate-900 dark:text-white"}`}>{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1.5 truncate">{sublabel}</div>
      </div>
      <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl ${alert ? "bg-red-500/10 text-red-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
        {icon}
      </div>
    </div>
  );
}

// Generic right-side panel container — used by Today's Agenda, Urgent
// Deadlines, Team Availability, Machine Schedule, and Selected Job Details.
function PanelShell({ title, badge, accent, children }: {
  title: string;
  badge?: string;
  accent?: "rose" | "sky" | "emerald";
  children: React.ReactNode;
}) {
  const badgeCls = accent === "rose"    ? "bg-rose-500/15 text-rose-500"
                 : accent === "sky"     ? "bg-sky-500/15 text-sky-500"
                 : accent === "emerald" ? "bg-emerald-500/15 text-emerald-500"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500";
  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300 truncate">{title}</span>
        {badge != null && (
          <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${badgeCls}`}>{badge}</span>
        )}
      </header>
      <div className="p-4">{children}</div>
    </div>
  );
}
