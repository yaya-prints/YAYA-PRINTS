"use client";

import { useState, useEffect, useRef, useCallback, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fabric } from "fabric";
import { supabase } from "@/lib/supabase";

/* ==========================================================================
   YAYA PRINTS — MOCKUP STUDIO v10
   Focus: UX polish, visual quality, client approval flow, pricing,
          and a complete rebuild of logo placement UX.
   ========================================================================== */

// ---------------------------------------------------------------------------
// COLOR DATABASES
// ---------------------------------------------------------------------------
const TSHIRT_64000_COLORS = [
  "White", "Black", "Charcoal", "Dark Heather", "Sport Grey", "Navy",
  "Off White", "Ice Grey", "Paragon", "Graphite Heather", "Heather Dark Grey",
  "Natural", "Cornsilk", "Sand", "Dark Chocolate",
  "Daisy", "Gold", "Orange", "Heather Orange",
  "Light Pink", "Azalea", "Coral Silk", "Heliconia", "Antique Heliconia", "Heather Heliconia",
  "Heather Berry", "Cherry Red", "Antique Cherry Red", "Red", "Heather Red",
  "Cardinal Red", "Heather Cardinal Red", "Maroon", "Heather Maroon",
  "Heather Radiant Orchid", "Iris", "Purple", "Heather Purple",
  "Sky", "Light Blue", "Carolina Blue", "Stone Blue", "Tropical Blue", "Sapphire",
  "Antique Sapphire", "Heather Sapphire", "Heather Galapagos Blue", "Royal",
  "Heather Royal", "Indigo Blue", "Heather Indigo", "Metro Blue", "Heather Navy",
  "Mint Green", "Pistachio", "Lime", "Kiwi", "Sage", "Irish Green",
  "Heather Irish Green", "Kelly Green", "Jade Dome", "Military Green",
  "Heather Military Green", "Forest"
];
const ALL_COLORS = TSHIRT_64000_COLORS; // Set as global fallback
const HOODIE_COLORS = [
  "White", "Black", "Charcoal", "Dark Heather", "Sport Grey", "Navy",
  "Ash", "Graphite Heather", "Sand", "Dark Chocolate",
  "Gold", "Old Gold", "Orange", "Safety Orange",
  "Light Pink", "Safety Pink", "Azalea", "Heliconia", "Cherry Red", "Antique Cherry Red", "Red", "Heather Scarlet Red", "Cardinal Red", "Garnet", "Maroon", "Heather Dark Maroon",
  "Orchid", "Violet", "Purple",
  "Light Blue", "Carolina Blue", "Sapphire", "Antique Sapphire", "Royal", "Heather Deep Royal", "Indigo Blue", "Heather Dark Navy",
  "Mint Green", "Irish Green", "Forest", "Heather Dark Green", "Military Green", "Safety Green"
];

const HAT_6506_COLORS = [
  "White","Black","Black/White","Brown/Khaki","Charcoal","Charcoal/White",
  "Heather/Black","Heather/White","Khaki","Navy","Navy/White","Red","Red/White"
];

const POLO_8800_COLORS = [
  "White", "Black", "Ash", "Carolina Blue", "Dark Heather", "Forest Green", 
  "Gold", "Graphite Heather", "Kelly Green", "Maroon", "Navy", "Purple", 
  "Red", "Royal", "Sapphire", "Sport Grey"
];

const COLOR_HEX_MAP: Record<string, string> = {
  "Antique Cherry Red":"#7C1C29","Antique Sapphire":"#126B88","Ash":"#D7D7D7",
  "Azalea":"#F089B2","Black":"#111111","Cardinal Red":"#8A1529",
  "Carolina Blue":"#7BAFD4","Charcoal":"#4F5254","Cherry Red":"#B80F2A",
  "Dark Chocolate":"#35231D","Dark Heather":"#4B4F55","Forest Green":"#182C25",
  "Garnet":"#5F121F","Gold":"#FFC72C","Heather Dark Green":"#2d4235",
  "Heather Dark Maroon":"#5d1e2e","Heather Dark Navy":"#2b3447",
  "Heather Deep Royal":"#3b5ba5","Heather Scarlet Red":"#b93d47",
  "Heliconia":"#DB3E79","Indigo Blue":"#475D74","Irish Green":"#009E60",
  "Light Blue":"#ADD8E6","Light Pink":"#FFB6C1","Maroon":"#500000",
  "Navy":"#000080","Purple":"#6A0DAD","Red":"#E60000","Royal":"#4169E1",
  "Safety Green":"#CEFF00","Sand":"#C2B280","Sapphire":"#0F52BA",
  "Sport Grey":"#9E9E9E","White":"#FFFFFF",
  "Brown":"#5C4033","Khaki":"#C3B091","Heather":"#999999",
  "Cornsilk":"#FFF8DC","Heather Radiant Orchid":"#A865B5","Heather Royal":"#4A77B4",
  "Mint Green":"#98FF98","Off White":"#F8F8FF","Paragon":"#9C9C9C",
  "Pistachio":"#93C572","Sage":"#B2AC88","Sky":"#87CEEB","Stone Blue":"#5C7893",
  "Antique Heliconia":"#D14578","Coral Silk":"#F08080","Daisy":"#FFD700",
  "Forest":"#182C25","Graphite Heather":"#454545","Heather Berry":"#8B3A62",
  "Heather Cardinal Red":"#7D2B3A","Heather Dark Grey":"#555555",
  "Heather Galapagos Blue":"#2A6E82","Heather Heliconia":"#C14B74",
  "Heather Indigo":"#384B66","Heather Irish Green":"#3A8E5D","Heather Maroon":"#5C2634",
  "Heather Military Green":"#545C44","Heather Navy":"#2F3B4C","Heather Orange":"#D86E45",
  "Heather Purple":"#5C466A","Heather Red":"#B33E4C","Heather Sapphire":"#3F7696",
  "Ice Grey":"#C4C6C8","Iris":"#5D3FD3","Jade Dome":"#00A86B","Kelly Green":"#4CBB17",
  "Kiwi":"#8EE53F","Lime":"#BFFF00","Metro Blue":"#1A3256","Military Green":"#4B5320",
  "Natural":"#EBE5D5","Orange":"#FFA500","Tropical Blue":"#00BFFF",
  "Old Gold":"#CFB53B","Safety Orange":"#FF7518","Safety Pink":"#FF1DCE",
  "Orchid":"#DA70D6","Violet":"#7851A9"
};

// Inline SVG icons — small, monochrome, currentColor so they inherit theme.
// Used in the product picker. No emojis.
const Icon = {
  Tshirt: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 3l-5 3 2 4 3-1v12h12V9l3 1 2-4-5-3-3 2c-.7.6-1.7 1-3 1s-2.3-.4-3-1L8 3z"/>
    </svg>
  ),
  Hoodie: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 4l-4 3 2 5 2-1v10h10V11l2 1 2-5-4-3"/>
      <path d="M7 4c0-.5 2-2 5-2s5 1.5 5 2v3a5 5 0 0 1-10 0V4z"/>
      <path d="M10 14h4"/>
    </svg>
  ),
  Cap: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 16c0-5 4-9 9-9s9 4 9 9"/>
      <path d="M2 16h20v2H2z"/>
      <circle cx="12" cy="10" r="1"/>
    </svg>
  ),
  Polo: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 3l-5 3 2 4 3-1v12h12V9l3 1 2-4-5-3-3 2"/>
      <path d="M10 3l2 3 2-3"/>
      <path d="M11 6v5"/>
    </svg>
  ),
  Card: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="6" width="18" height="12" rx="2"/>
      <path d="M3 10h18"/>
      <path d="M7 14h4"/>
    </svg>
  ),
  Postcard: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M14 9h4M14 12h4M14 15h3"/>
      <rect x="6" y="9" width="5" height="6" rx="1"/>
    </svg>
  ),
  Flyer: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 3h9l4 4v14H6z"/>
      <path d="M15 3v4h4"/>
      <path d="M9 12h7M9 15h7M9 18h4"/>
    </svg>
  ),
  Poster: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="5" y="3" width="14" height="18" rx="1"/>
      <path d="M8 8h8M8 12h8M8 16h5"/>
    </svg>
  ),
  Banner: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="7" width="20" height="10" rx="1"/>
      <circle cx="4.5" cy="9.5" r=".7" fill="currentColor"/>
      <circle cx="19.5" cy="9.5" r=".7" fill="currentColor"/>
      <circle cx="4.5" cy="14.5" r=".7" fill="currentColor"/>
      <circle cx="19.5" cy="14.5" r=".7" fill="currentColor"/>
      <path d="M7 12h10"/>
    </svg>
  ),
  Sticker: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" strokeDasharray="2 2"/>
      <circle cx="12" cy="12" r="6"/>
    </svg>
  ),
  YardSign: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="4" y="4" width="16" height="11" rx="1"/>
      <path d="M9 15v6M15 15v6"/>
      <path d="M7 8h10M7 11h6"/>
    </svg>
  ),
};

// Small SVG previews for the sticker shape picker buttons.
function ShapePreview({ shape, size = 18 }: { shape: string; size?: number }) {
  const stroke = "currentColor";
  const sw = 1.7;
  const common = { fill: "none", stroke, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (shape === "circle")  return <svg width={size} height={size} viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="9"/></svg>;
  if (shape === "oval")    return <svg width={size} height={size} viewBox="0 0 24 24" {...common}><ellipse cx="12" cy="12" rx="10" ry="6.5"/></svg>;
  if (shape === "square")  return <svg width={size} height={size} viewBox="0 0 24 24" {...common}><rect x="3" y="3" width="18" height="18"/></svg>;
  if (shape === "rounded") return <svg width={size} height={size} viewBox="0 0 24 24" {...common}><rect x="3" y="3" width="18" height="18" rx="5"/></svg>;
  if (shape === "rect")    return <svg width={size} height={size} viewBox="0 0 24 24" {...common}><rect x="2" y="7" width="20" height="10" rx="2"/></svg>;
  if (shape === "star")    return <svg width={size} height={size} viewBox="0 0 24 24" {...common}><path d="M12 2l2.9 6.5 7.1.7-5.3 4.9 1.5 6.9L12 17.6l-6.2 3.4 1.5-6.9L2 9.2l7.1-.7L12 2z"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="9"/></svg>;
}

const GARMENT_TYPES = [
  { id:"tshirt_64000", name:"Gildan 64000 T-Shirt", short:"T-Shirt", iconKey:"Tshirt" },
  { id:"hoodie_18500", name:"Gildan 18500 Hoodie", short:"Hoodie",  iconKey:"Hoodie" },
  { id:"hat_6506",     name:"YP Classics 6506 Hat", short:"Hat",    iconKey:"Cap" },
  { id:"polo_8800",    name:"Gildan 8800 Polo",     short:"Polo",   iconKey:"Polo" }
];

// ─── PRINT PRODUCTS ───────────────────────────────────────────────────────────
// Categorically different from garments: rectangular substrates with bleed/safe
// guides, paper stocks instead of garment colors, and procedural mockups
// (we draw them on canvas instead of fetching photographs from storage).
//
// Real-world inches → canvas pixels: we keep all products inside the existing
// 600×700 canvas. To preserve the *aspect ratio* faithfully we set a target
// "max footprint" of ~480px wide / ~520px tall and compute per-product scale.
const PRINT_PRODUCTS = [
  { id:"business_card",   name:"Business Card 3.5×2", short:"Card",     iconKey:"Card",     inches:{w:3.5, h:2.0},  hasBack:true  },
  { id:"postcard_4x6",    name:"Postcard 4×6",        short:"Postcard", iconKey:"Postcard", inches:{w:6.0, h:4.0},  hasBack:true  },
  { id:"flyer_85x11",     name:"Flyer 8.5×11",        short:"Flyer",    iconKey:"Flyer",    inches:{w:8.5, h:11.0}, hasBack:true  },
  { id:"poster_11x17",    name:"Poster 11×17",        short:"Poster",   iconKey:"Poster",   inches:{w:11.0, h:17.0}, hasBack:false },
  { id:"poster_18x24",    name:"Poster 18×24",        short:"Poster L", iconKey:"Poster",   inches:{w:18.0, h:24.0}, hasBack:false },
  { id:"banner_2x4",      name:"Banner 2×4 ft",       short:"Banner",   iconKey:"Banner",   inches:{w:48.0, h:24.0}, hasBack:false },
  { id:"banner_3x8",      name:"Banner 3×8 ft",       short:"Banner L", iconKey:"Banner",   inches:{w:96.0, h:36.0}, hasBack:false },
  { id:"sticker_3x3",     name:"Sticker 3×3",         short:"Sticker",  iconKey:"Sticker",  inches:{w:3.0, h:3.0},  hasBack:false },
  { id:"yard_sign_18x24", name:"Yard Sign 18×24",     short:"Yard Sgn", iconKey:"YardSign", inches:{w:24.0, h:18.0}, hasBack:false },
];

// Sticker die-cut shapes — applied only when the selected product is a sticker.
const STICKER_SHAPES = [
  { id:"circle",  label:"Circle"  },
  { id:"oval",    label:"Oval"    },
  { id:"square",  label:"Square"  },
  { id:"rounded", label:"Rounded" },
  { id:"rect",    label:"Rectangle" },
  { id:"star",    label:"Star"    },
];

// Paper / material stocks per print-product family. The picker replaces the
// color picker when a print product is selected. The "color" we store in
// `lockedColor` for print products is actually the stock id.
const PAPER_STOCKS = [
  { id:"Matte 14pt",       label:"Matte 14pt",       hex:"#f3f3ee", sheen:0.05, family:"card" },
  { id:"Glossy 14pt",      label:"Glossy 14pt",      hex:"#fafafa", sheen:0.35, family:"card" },
  { id:"Soft Touch",       label:"Soft Touch",       hex:"#ededea", sheen:0.02, family:"card" },
  { id:"Kraft Brown",      label:"Kraft Brown",      hex:"#c9a26b", sheen:0.04, family:"card" },
  { id:"Recycled",         label:"Recycled",         hex:"#e9e3d3", sheen:0.04, family:"card" },
  { id:"Linen",            label:"Linen",            hex:"#f1ede1", sheen:0.06, family:"card" },
  { id:"100lb Gloss",      label:"100lb Gloss",      hex:"#fdfdfd", sheen:0.30, family:"flyer" },
  { id:"100lb Matte",      label:"100lb Matte",      hex:"#f5f5f0", sheen:0.05, family:"flyer" },
  { id:"80lb Uncoated",    label:"80lb Uncoated",    hex:"#f4f1ea", sheen:0.02, family:"flyer" },
  { id:"13oz Vinyl",       label:"13oz Vinyl",       hex:"#ffffff", sheen:0.20, family:"banner" },
  { id:"Mesh Vinyl",       label:"Mesh Vinyl",       hex:"#fbfbfb", sheen:0.10, family:"banner" },
  { id:"White Vinyl",      label:"White Vinyl",      hex:"#ffffff", sheen:0.45, family:"sticker" },
  { id:"Clear Vinyl",      label:"Clear Vinyl",      hex:"#f0f4f7", sheen:0.50, family:"sticker" },
  { id:"Holographic",      label:"Holographic",      hex:"#e8e6f5", sheen:0.60, family:"sticker" },
  { id:"4mm Coroplast",    label:"4mm Coroplast",    hex:"#ffffff", sheen:0.10, family:"yard" },
];

// Map each print product to its allowed stock family (so the picker shows only
// relevant choices).
const PRINT_STOCK_FAMILY: Record<string,string> = {
  business_card:   "card",
  postcard_4x6:    "card",
  flyer_85x11:     "flyer",
  poster_11x17:    "flyer",
  poster_18x24:    "flyer",
  banner_2x4:      "banner",
  banner_3x8:      "banner",
  sticker_3x3:     "sticker",
  yard_sign_18x24: "yard",
};

// Test if a product id refers to a print product (vs a garment).
const isPrintProduct = (id: string) => PRINT_PRODUCTS.some(p => p.id === id);

// Compute the on-canvas footprint (px) of a print product preserving its
// real-world aspect ratio. Returns the rect in canvas coordinates.
// NOTE: hard-coded 600×700 because CANVAS_W / CANVAS_H are declared later in
// the module and this fn is invoked at module load time by DEFAULT_PRINT_ZONES.
const printProductFootprint = (id: string) => {
  const _W = 600, _H = 700;
  const p = PRINT_PRODUCTS.find(pp => pp.id === id);
  if (!p) return { x:0, y:0, w:_W, h:_H, cx:_W/2, cy:_H/2 };
  const aspect = p.inches.w / p.inches.h;
  const maxW = 480, maxH = 520;
  let w = maxW, h = maxW / aspect;
  if (h > maxH) { h = maxH; w = maxH * aspect; }
  const cx = _W / 2, cy = _H / 2;
  return { x: cx - w/2, y: cy - h/2, w, h, cx, cy };
};

// Print-zone defaults for print products: a single "Design" zone equal to the
// safe area (3% inset from each edge of the substrate footprint).
const buildPrintZonesFor = (id: string) => {
  const f = printProductFootprint(id);
  const inset = Math.round(Math.min(f.w, f.h) * 0.04);
  return {
    "Design": { x: Math.round(f.x + inset), y: Math.round(f.y + inset), w: Math.round(f.w - inset*2), h: Math.round(f.h - inset*2) }
  };
};

const DEFAULT_BG_PROPS = {
  hoodie_18500: { front:{ scale:0.5726, left:302, top:367 }, back:{ scale:0.5698, left:307, top:350 } },
  tshirt_64000: { front:{ scale:0.5717, left:300, top:350 }, back:{ scale:0.5335, left:300, top:350 } },
  hat_6506:     { front:{ scale:0.45,   left:300, top:350 }, back:{ scale:0.45,   left:300, top:350 } },
  polo_8800:    { front:{ scale:0.5717, left:300, top:350 }, back:{ scale:0.5335, left:300, top:350 } },
  // Print products: substrate is drawn at 1:1 by the procedural mockup, so
  // background scale = 1 and origin = canvas center (CANVAS_W/2 = 300, CANVAS_H/2 = 350).
  // We hard-code the values here because CANVAS_W / CANVAS_H are declared
  // later in the module and would otherwise trigger a "used before declaration" error.
  business_card:   { front:{ scale:1, left:300, top:350 }, back:{ scale:1, left:300, top:350 } },
  postcard_4x6:    { front:{ scale:1, left:300, top:350 }, back:{ scale:1, left:300, top:350 } },
  flyer_85x11:     { front:{ scale:1, left:300, top:350 }, back:{ scale:1, left:300, top:350 } },
  poster_11x17:    { front:{ scale:1, left:300, top:350 }, back:{ scale:1, left:300, top:350 } },
  poster_18x24:    { front:{ scale:1, left:300, top:350 }, back:{ scale:1, left:300, top:350 } },
  banner_2x4:      { front:{ scale:1, left:300, top:350 }, back:{ scale:1, left:300, top:350 } },
  banner_3x8:      { front:{ scale:1, left:300, top:350 }, back:{ scale:1, left:300, top:350 } },
  sticker_3x3:     { front:{ scale:1, left:300, top:350 }, back:{ scale:1, left:300, top:350 } },
  yard_sign_18x24: { front:{ scale:1, left:300, top:350 }, back:{ scale:1, left:300, top:350 } },
};
const DEFAULT_PRINT_ZONES = {
  hoodie_18500: {
    front:{ "Center Chest":{x:177,y:227,w:248,h:300}, "Left Chest":{x:345,y:227,w:80,h:80} },
    back: { "Back Design":{x:193,y:211,w:254,h:361} }
  },
  tshirt_64000: {
    front:{ "Center Chest":{x:174,y:180,w:252,h:341}, "Left Chest":{x:335,y:180,w:90,h:90} },
    back: { "Back Design":{x:190,y:145,w:222,h:333} }
  },
  hat_6506: {
    front:{ "Front Center":{x:196,y:283,w:209,h:116} },
    back: { "Side Panel":{x:320,y:395,w:115,h:38} }
  },
  polo_8800: {
    front:{ "Left Chest":{x:335,y:180,w:90,h:90}, "Right Chest":{x:175,y:180,w:90,h:90} },
    back: { "Back Design":{x:190,y:145,w:222,h:333}, "Upper Back":{x:250,y:145,w:100,h:100} }
  },
  // Print products — single "Design" zone covering the safe area.
  business_card:   { front: buildPrintZonesFor("business_card"),   back: buildPrintZonesFor("business_card")   },
  postcard_4x6:    { front: buildPrintZonesFor("postcard_4x6"),    back: buildPrintZonesFor("postcard_4x6")    },
  flyer_85x11:     { front: buildPrintZonesFor("flyer_85x11"),     back: buildPrintZonesFor("flyer_85x11")     },
  poster_11x17:    { front: buildPrintZonesFor("poster_11x17"),    back: buildPrintZonesFor("poster_11x17")    },
  poster_18x24:    { front: buildPrintZonesFor("poster_18x24"),    back: buildPrintZonesFor("poster_18x24")    },
  banner_2x4:      { front: buildPrintZonesFor("banner_2x4"),      back: buildPrintZonesFor("banner_2x4")      },
  banner_3x8:      { front: buildPrintZonesFor("banner_3x8"),      back: buildPrintZonesFor("banner_3x8")      },
  sticker_3x3:     { front: buildPrintZonesFor("sticker_3x3"),     back: buildPrintZonesFor("sticker_3x3")     },
  yard_sign_18x24: { front: buildPrintZonesFor("yard_sign_18x24"), back: buildPrintZonesFor("yard_sign_18x24") },
};

// Smart sizing: when user picks a preset, auto-scale the logo intelligently.
// Values are as % of canvas width, calibrated for real print sizes.
const SMART_SIZE_PCT: Record<string, number> = {
  "Left Chest": 13,     // ~3.5" wide
  "Front Center": 28,   // hat center
  "Center Chest": 42,   // ~11" wide
  "Back Design": 42,    // ~11" wide
  "Side Panel": 16,     // small hat side
};

const EXPORT_RESOLUTION_MULTIPLIER = 12;
const CANVAS_W = 600;
const CANVAS_H = 700;

const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY || "d0f51d8914e090848d677a3ea2994c06";

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------
function dataURItoBlob(dataURI: string) {
  const byteString = atob(dataURI.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i=0; i<byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type:"image/png" });
}

async function uploadToImgBB(blob: Blob, nameSuffix: string): Promise<string> {
  const formData = new FormData();
  formData.append("image", blob);
  formData.append("key", IMGBB_API_KEY);
  formData.append("name", "YAYA-" + nameSuffix);
  const response = await fetch("https://api.imgbb.com/1/upload", { method:"POST", body:formData });
  const result = await response.json();
  if (result.success) return result.data.url;
  throw new Error("Upload Failed: " + (result?.error?.message || "unknown"));
}

const getAbsoluteCoords = (obj: fabric.Object) => {
  if (!obj.group) return { left: obj.left!, top: obj.top! };
  const matrix = obj.calcTransformMatrix();
  const options = fabric.util.qrDecompose(matrix);
  return { left: options.translateX, top: options.translateY };
};

const getSwatchStyle = (colorName: string): React.CSSProperties => {
  if (!colorName) return { backgroundColor:"#cccccc" };
  if (colorName.includes("/")) {
    const parts = colorName.split("/");
    const hex1 = COLOR_HEX_MAP[parts[0]] || "#cccccc";
    const hex2 = COLOR_HEX_MAP[parts[1]] || "#cccccc";
    return { background:`linear-gradient(135deg, ${hex1} 50%, ${hex2} 50%)` };
  }
  const solidHex = COLOR_HEX_MAP[colorName] || "#cccccc";
  return { backgroundColor:solidHex, border: solidHex === "#FFFFFF" ? "1px solid #e4e4e7" : "none" };
};

// Format currency input safely
const fmtPrice = (raw: string) => {
  if (!raw) return "";
  const clean = raw.replace(/[^0-9.]/g, "");
  if (!clean) return "";
  const num = parseFloat(clean);
  if (isNaN(num)) return "";
  return `$${num.toFixed(2)}`;
};

// ---------------------------------------------------------------------------
// AI BACKGROUND REMOVAL (cached pipeline)
// ---------------------------------------------------------------------------
let aiBgPipeline: any = null;
let aiBgPipelinePromise: Promise<any> | null = null;

async function getAiPipeline() {
  if (aiBgPipeline) return aiBgPipeline;
  if (aiBgPipelinePromise) return aiBgPipelinePromise;
  aiBgPipelinePromise = (async () => {
    const { pipeline, env } = await import("@xenova/transformers");
    (env as any).allowLocalModels = false;
    aiBgPipeline = await pipeline("image-segmentation", "briaai/RMBG-1.4");
    return aiBgPipeline;
  })();
  return aiBgPipelinePromise;
}

const removeWhiteBackground = async (imgUrl: string, threshold = 240): Promise<string> => {
  try {
    const pipe = await getAiPipeline();
    const result = await pipe(imgUrl);
    let finalImage: any = null;
    if (result?.toDataURL) finalImage = result;
    else if (Array.isArray(result) && result[0]?.mask) finalImage = result[0].mask;
    else if (result?.mask) finalImage = result.mask;
    if (finalImage?.toDataURL) return finalImage.toDataURL("image/png");
  } catch (err) {
    console.warn("AI BG removal fallback triggered", err);
  }
  return new Promise((resolve) => {
    const img = new Image();
    if (imgUrl.startsWith("http")) img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(imgUrl);
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i=0; i<data.length; i+=4) {
        if (data[i] > threshold && data[i+1] > threshold && data[i+2] > threshold) data[i+3] = 0;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(imgUrl);
    img.src = imgUrl;
  });
};

const removeColorFromImage = async (imgUrl: string, targetHex: string, tolerance = 40): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    if (imgUrl.startsWith("http")) img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(imgUrl);
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const rT = parseInt(targetHex.slice(1,3), 16);
      const gT = parseInt(targetHex.slice(3,5), 16);
      const bT = parseInt(targetHex.slice(5,7), 16);
      for (let i=0; i<data.length; i+=4) {
        const d = Math.sqrt((data[i]-rT)**2 + (data[i+1]-gT)**2 + (data[i+2]-bT)**2);
        if (d < tolerance) data[i+3] = 0;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(imgUrl);
    img.src = imgUrl;
  });
};

// ---------------------------------------------------------------------------
// ZONE PREVIEW SVG — little thumbnail showing where a preset places the logo
// ---------------------------------------------------------------------------
const ZonePreviewIcon = ({ preset, active }: { preset: string; active: boolean }) => {
  const stroke = active ? "#ffffff" : "currentColor";
  const fill = active ? "#ffffff" : "currentColor";
  const opacity = active ? "1" : "0.5";
  // Generic shirt outline
  const shirt = (
    <path d="M6 9 L9 4 L15 4 L18 9 L22 10 L20 14 L18 13 L18 28 L6 28 L6 13 L4 14 L2 10 Z"
      stroke={stroke} strokeWidth="1.5" fill="none" opacity={opacity} />
  );
  const hat = (
    <path d="M4 20 L6 12 Q12 6 18 12 L20 20 Q12 22 4 20 Z M2 22 L22 22 L22 24 L2 24 Z"
      stroke={stroke} strokeWidth="1.5" fill="none" opacity={opacity} />
  );
  // Indicator position per preset
  let dot: JSX.Element | null = null;
  if (preset === "Left Chest")    dot = <circle cx="15" cy="11" r="2" fill={fill} />;
  if (preset === "Center Chest")  dot = <rect x="9" y="11" width="6" height="7" rx="1" fill={fill} />;
  if (preset === "Back Design")   dot = <rect x="9" y="10" width="6" height="10" rx="1" fill={fill} />;
  if (preset === "Front Center")  dot = <rect x="8" y="12" width="8" height="4" rx="1" fill={fill} />;
  if (preset === "Side Panel")    dot = <rect x="14" y="15" width="4" height="2" rx="0.5" fill={fill} />;
  if (preset === "No Print")      dot = <line x1="8" y1="8" x2="16" y2="18" stroke={fill} strokeWidth="1.5" />;

  const isHat = preset === "Front Center" || preset === "Side Panel";
  return (
    <svg viewBox="0 0 24 32" className="w-6 h-8 mx-auto mb-1">
      {isHat ? hat : shirt}
      {dot}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// THEME
// ---------------------------------------------------------------------------
function buildTheme(isLight: boolean) {
  return {
    bgMain: isLight ? "bg-[#fafafa]" : "bg-[#0a0a0b]",
    bgStage: isLight ? "bg-gradient-to-br from-[#f4f4f5] to-[#e4e4e7]" : "bg-gradient-to-br from-[#050505] to-[#0f0f11]",
    bgPanel: isLight ? "bg-white/95 backdrop-blur-xl" : "bg-[#0f0f11]/95 backdrop-blur-xl",
    bgSubPanel: isLight ? "bg-white" : "bg-[#0f0f11]",
    bgCard: isLight ? "bg-white" : "bg-[#16161a]",
    bgInput: isLight ? "bg-white border-zinc-200 text-zinc-900" : "bg-[#0a0a0b] border-zinc-800 text-zinc-100",
    bgInset: isLight ? "bg-zinc-50" : "bg-[#0a0a0b]",
    textMain: isLight ? "text-zinc-900" : "text-zinc-200",
    textMuted: isLight ? "text-zinc-500" : "text-zinc-500",
    textStrong: isLight ? "text-zinc-900" : "text-white",
    border: isLight ? "border-zinc-200" : "border-zinc-800/60",
    borderHard: isLight ? "border-zinc-300" : "border-zinc-700",
    shadow: isLight ? "shadow-sm" : "shadow-[0_20px_60px_rgba(0,0,0,0.4)]",
    btnPresetActive: isLight ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-900/20" : "bg-white text-black border-white",
    btnPresetInactive: isLight ? "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900" : "bg-[#16161a] text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white",
    garmentBtnActive: isLight ? "bg-white text-zinc-900 shadow-sm border border-zinc-200" : "bg-[#1f1f24] text-white border border-zinc-700",
    colorBadge: isLight ? "bg-white border-zinc-200 text-zinc-800" : "bg-[#16161a] border-zinc-700 text-white",
    ringOffset: isLight ? "ring-offset-white" : "ring-offset-zinc-900",
    tabActive: isLight ? "bg-zinc-50" : "bg-[#0a0a0b]",
    tabBar: isLight ? "bg-zinc-50/50" : "bg-black/40",
    uploadBox: isLight ? "border-zinc-300 bg-white hover:bg-sky-50 hover:border-sky-400" : "border-zinc-700 bg-[#0a0a0b] hover:bg-sky-900/10 hover:border-sky-500",
    rangeTrack: isLight ? "bg-zinc-200" : "bg-zinc-800",
    adminTerminalBg: isLight ? "bg-white/95" : "bg-black/95",
    adminTextareaBg: isLight ? "bg-zinc-50" : "bg-[#0a0a0b]",
    canvasBorderActive: isLight ? "border-sky-500 ring-4 ring-sky-100" : "border-sky-500/60 ring-4 ring-sky-500/20",
    canvasBorderInactive: isLight ? "border-zinc-200" : "border-zinc-800/50",
    disabledBtn: isLight ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" : "bg-zinc-900 text-zinc-600 cursor-not-allowed",
    nudgeBtn: isLight ? "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700 active:bg-zinc-100" : "bg-[#16161a] hover:bg-zinc-800 border-zinc-700 text-zinc-300",
  };
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
function MockupGeneratorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("jobId");

  const [isLightMode, setIsLightMode] = useState<boolean>(true);
  useEffect(() => {
    const savedTheme = localStorage.getItem("yaya-theme");
    if (savedTheme === "dark") setIsLightMode(false);
    
    // Inject Premium & Arabic Fonts dynamically
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Almarai:wght@700;800&family=Amiri:ital,wght@0,700;1,700&family=Anton&family=Bebas+Neue&family=Cairo:wght@700;900&family=Changa:wght@700;800&family=Cinzel:wght@700;900&family=Lobster&family=Oswald:wght@700;900&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Tajawal:wght@700;800&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const FONT_OPTIONS = [
    { name: "System Default", value: "sans-serif" },
    { name: "Oswald", value: "'Oswald', sans-serif" },
    { name: "Anton", value: "'Anton', sans-serif" },
    { name: "Bebas Neue", value: "'Bebas Neue', sans-serif" },
    { name: "Pacifico", value: "'Pacifico', cursive" },
    { name: "Permanent Marker", value: "'Permanent Marker', cursive" },
    { name: "Lobster", value: "'Lobster', cursive" },
    { name: "Cinzel", value: "'Cinzel', serif" },
    { name: "Playfair Display", value: "'Playfair Display', serif" },
    { name: "Cairo (Arabic)", value: "'Cairo', sans-serif" },
    { name: "Tajawal (Arabic)", value: "'Tajawal', sans-serif" },
    { name: "Amiri (Arabic)", value: "'Amiri', serif" },
    { name: "Changa (Arabic)", value: "'Changa', sans-serif" },
    { name: "Almarai (Arabic)", value: "'Almarai', sans-serif" }
  ];
  const toggleTheme = () => {
    const next = !isLightMode;
    setIsLightMode(next);
    localStorage.setItem("yaya-theme", next ? "light" : "dark");
  };
  const t = buildTheme(isLightMode);

  // Refs
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricFrontRef = useRef<fabric.Canvas | null>(null);
  const fabricBackRef = useRef<fabric.Canvas | null>(null);
  const isDraggingFront = useRef(false);
  const isDraggingBack = useRef(false);
  const clipboardRef = useRef<fabric.Object[]>([]);

  // State
  const [uploadedDesigns, setUploadedDesigns] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [textColor, setTextColor] = useState("#111111");
  const [textFont, setTextFont] = useState("sans-serif");
  const [textStrokeColor, setTextStrokeColor] = useState("#ffffff");
  const [textStrokeWidth, setTextStrokeWidth] = useState(0);
  const [textCurve, setTextCurve] = useState(0);
  const [frontTargetColor, setFrontTargetColor] = useState("#ffffff");
  const [backTargetColor, setBackTargetColor] = useState("#ffffff");
  const [colorSearchQuery, setColorSearchQuery] = useState("");

  const masterMemory = useRef<any>({
    hoodie_18500:{ front:{}, back:{} },
    tshirt_64000:{ front:{}, back:{} },
    hat_6506:    { front:{}, back:{} },
    polo_8800:   { front:{}, back:{} },
    // Print products — same shape, so the same memory/preset code works for them.
    business_card:   { front:{}, back:{} },
    postcard_4x6:    { front:{}, back:{} },
    flyer_85x11:     { front:{}, back:{} },
    poster_11x17:    { front:{}, back:{} },
    poster_18x24:    { front:{}, back:{} },
    banner_2x4:      { front:{}, back:{} },
    banner_3x8:      { front:{}, back:{} },
    sticker_3x3:     { front:{}, back:{} },
    yard_sign_18x24: { front:{}, back:{} },
  });
  const printZonesRef = useRef(JSON.parse(JSON.stringify(DEFAULT_PRINT_ZONES)));

  const [selectedGarment, setSelectedGarment] = useState<string>("tshirt_64000");
  // Die-cut shape for stickers (only used when selectedGarment === "sticker_3x3")
  const [stickerShape, setStickerShape] = useState<"circle"|"oval"|"square"|"rounded"|"rect"|"star">("circle");
  const [lockedColor, setLockedColor] = useState<string>("Black");
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const displayColor = hoverColor || lockedColor;

  const [activeTab, setActiveTab] = useState<"front"|"back">("front");
  const [previewSide, setPreviewSide] = useState<"front"|"back">("front");

  const [magicErase, setMagicErase] = useState<boolean>(true);
  const [realisticBlend, setRealisticBlend] = useState<boolean>(false);
  const [enableWatermark, setEnableWatermark] = useState<boolean>(false);
  const [catalogTheme, setCatalogTheme] = useState<"Light"|"Dark">("Light");

  // Pricing — proper quote system, not inline strings
  const [showPricingPanel, setShowPricingPanel] = useState<boolean>(false);
  const [pricing, setPricing] = useState({
    tshirt: { qty: "50",  unit: "", total: "" },
    hoodie: { qty: "50",  unit: "", total: "" },
    hat:    { qty: "50",  unit: "", total: "" },
    polo:   { qty: "50",  unit: "", total: "" },
  });
  const [quoteNotes, setQuoteNotes] = useState<string>("Prices shown are per piece before taxes. Bulk discounts available.");
  const [quoteValidDays, setQuoteValidDays] = useState<string>("30");

  const [frontLogoUrl, setFrontLogoUrl] = useState<string | null>(null);
  const [frontScale, setFrontScale] = useState<number>(25);
  const [frontX, setFrontX] = useState<number>(50);
  const [frontY, setFrontY] = useState<number>(35);
  const [activeFrontPreset, setActiveFrontPreset] = useState<string>("Left Chest");

  const [backLogoUrl, setBackLogoUrl] = useState<string | null>(null);
  const [backScale, setBackScale] = useState<number>(0);
  const [backX, setBackX] = useState<number>(50);
  const [backY, setBackY] = useState<number>(50);
  const [activeBackPreset, setActiveBackPreset] = useState<string>("Back Design");

  const activeFrontPresetRef = useRef(activeFrontPreset);
  const activeBackPresetRef = useRef(activeBackPreset);
  useEffect(() => { activeFrontPresetRef.current = activeFrontPreset; }, [activeFrontPreset]);
  useEffect(() => { activeBackPresetRef.current = activeBackPreset; }, [activeBackPreset]);

  const [adminMode, setAdminMode] = useState<boolean>(false);
  const [adminConfigOutput, setAdminConfigOutput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<string>("");
  const [catalogUrl, setCatalogUrl] = useState<string | null>(null);
  // Individual item entries that make up the catalog. Saved when the catalog is
  // generated so we can offer per-item downloads with order placeholder + watermark.
  type CatalogItem = {
    url: string;
    title: string;
    subtitle: string;
    priceKey: "tshirt" | "hoodie" | "polo" | "hat";
    price: { qty: string; unit: string; total: string } | null;
  };
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  const [jobsList, setJobsList] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isSavingToOrder, setIsSavingToOrder] = useState<boolean>(false);

  // Client approval flow
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [approvalLinkData, setApprovalLinkData] = useState<{ url: string; jobTitle: string; customer: string } | null>(null);

  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [toast, setToast] = useState<{msg:string, type:"success"|"error"|"info"} | null>(null);
  const showToast = useCallback((msg: string, type: "success"|"error"|"info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const [showBackDesignModal, setShowBackDesignModal] = useState<boolean>(false);
  const [showBgRemovalModal, setShowBgRemovalModal] = useState<boolean>(false);
  const [pendingUploadUrl, setPendingUploadUrl] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Ref mirrors for stable callbacks
  const selectedGarmentRef = useRef(selectedGarment);
  // Always-fresh ref so the procedural mockup renderer reads the current shape
  const stickerShapeRef = useRef(stickerShape);
  const adminModeRef = useRef(adminMode);
  const activeTabRef = useRef(activeTab);
  const frontLogoUrlRef = useRef(frontLogoUrl);
  const backLogoUrlRef = useRef(backLogoUrl);
  const realisticBlendRef = useRef(realisticBlend);
  const displayColorRef = useRef(displayColor);
  useEffect(() => { selectedGarmentRef.current = selectedGarment; }, [selectedGarment]);
  useEffect(() => { stickerShapeRef.current = stickerShape; }, [stickerShape]);
  useEffect(() => { adminModeRef.current = adminMode; }, [adminMode]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { frontLogoUrlRef.current = frontLogoUrl; }, [frontLogoUrl]);
  useEffect(() => { backLogoUrlRef.current = backLogoUrl; }, [backLogoUrl]);
  useEffect(() => { realisticBlendRef.current = realisticBlend; }, [realisticBlend]);
  useEffect(() => { displayColorRef.current = displayColor; }, [displayColor]);

  // Transferred logo
  useEffect(() => {
    const transferredLogo = localStorage.getItem("yaya_transferred_logo");
    if (transferredLogo) {
      setUploadedDesigns((prev) => [...prev, transferredLogo]);
      applyDesignToZone(transferredLogo, "front", "Left Chest", "tshirt_64000");
      applyDesignToZone(transferredLogo, "front", "Left Chest", "hoodie_18500");
      applyDesignToZone(transferredLogo, "front", "Front Center", "hat_6506");
      applyDesignToZone(transferredLogo, "front", "Left Chest", "polo_8800");
      localStorage.removeItem("yaya_transferred_logo");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Jobs
  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase.from("jobs")
        .select("id, job_number, title, quotes(customers(company_name))")
        .order("created_at", { ascending:false });
      if (data) {
        setJobsList(data);
        if (initialJobId) setSelectedJobId(initialJobId);
      }
    };
    fetchJobs();
  }, [initialJobId]);
  const handleGarmentChange = (garmentId: string) => {
    setSelectedGarment(garmentId);
    if (isPrintProduct(garmentId)) {
      // For print products, lockedColor stores a paper-stock id. Snap to the
      // first stock in the matching family if the current value isn't valid.
      const family = PRINT_STOCK_FAMILY[garmentId];
      const currentStock = PAPER_STOCKS.find(s => s.id === lockedColor);
      if (!currentStock || currentStock.family !== family) {
        const firstInFamily = PAPER_STOCKS.find(s => s.family === family);
        if (firstInFamily) setLockedColor(firstInFamily.id);
      }
    }
    else if (garmentId === "hoodie_18500" && !HOODIE_COLORS.includes(lockedColor)) setLockedColor("Black");
    else if (garmentId === "hat_6506" && !HAT_6506_COLORS.includes(lockedColor)) setLockedColor("Black");
    else if (garmentId === "tshirt_64000" && !TSHIRT_64000_COLORS.includes(lockedColor)) setLockedColor("Black");
    else if (garmentId === "polo_8800" && !POLO_8800_COLORS.includes(lockedColor)) setLockedColor("Black");
  };

  useEffect(() => {
    const frontZones = printZonesRef.current[selectedGarment].front;
    let currentFrontPreset = activeFrontPreset;
    if (!frontZones[currentFrontPreset]) {
      currentFrontPreset = Object.keys(frontZones)[0];
      setActiveFrontPreset(currentFrontPreset);
    }
    const frontMem = masterMemory.current[selectedGarment].front[currentFrontPreset];
    if (frontMem) {
      setFrontLogoUrl(frontMem.url);
      setFrontScale(frontMem.scalePct);
      setFrontX(frontMem.xPct);
      setFrontY(frontMem.yPct);
    } else {
      setFrontLogoUrl(null);
      setFrontScale(0);
    }
    const backZones = printZonesRef.current[selectedGarment].back;
    let currentBackPreset = activeBackPreset;
    if (!backZones[currentBackPreset]) {
      currentBackPreset = Object.keys(backZones)[0];
      setActiveBackPreset(currentBackPreset);
    }
    const backMem = masterMemory.current[selectedGarment].back[currentBackPreset];
    if (backMem) {
      setBackLogoUrl(backMem.url);
      setBackScale(backMem.scalePct);
      setBackX(backMem.xPct);
      setBackY(backMem.yPct);
    } else {
      setBackLogoUrl(null);
      setBackScale(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGarment]);

 const activeColorList = useMemo(() => {
    let list: string[] = [];
    if (isPrintProduct(selectedGarment)) {
      const family = PRINT_STOCK_FAMILY[selectedGarment];
      list = PAPER_STOCKS.filter(s => s.family === family).map(s => s.id);
    }
    if (selectedGarment === "tshirt_64000") list = TSHIRT_64000_COLORS;
    if (selectedGarment === "hoodie_18500") list = HOODIE_COLORS;
    if (selectedGarment === "hat_6506") list = HAT_6506_COLORS;
    if (selectedGarment === "polo_8800") list = POLO_8800_COLORS;
    if (colorSearchQuery.trim()) {
      const q = colorSearchQuery.toLowerCase();
      list = list.filter(c => c.toLowerCase().includes(q));
    }
    return list;
  }, [selectedGarment, colorSearchQuery]);

  const clearLogo = (side: "front"|"back") => {
    if (side === "front") {
      setFrontLogoUrl(null);
      setFrontScale(0);
      GARMENT_TYPES.forEach(g => { masterMemory.current[g.id].front = {}; });
    } else {
      setBackLogoUrl(null);
      setBackScale(0);
      GARMENT_TYPES.forEach(g => { masterMemory.current[g.id].back = {}; });
    }
    showToast(`${side === "front" ? "Front" : "Back"} design cleared`, "info");
  };

  // ------------------------- NEW: PLACEMENT CONTROLS ------------------------
  // These are the upgrades to fix "clunky logo placement"
  const nudge = (side: "front"|"back", dir: "up"|"down"|"left"|"right", big = false) => {
    const step = big ? 5 : 1; // in percent units
    if (side === "front") {
      if (dir === "up") setFrontY(v => Math.max(0, v - step));
      if (dir === "down") setFrontY(v => Math.min(100, v + step));
      if (dir === "left") setFrontX(v => Math.max(0, v - step));
      if (dir === "right") setFrontX(v => Math.min(100, v + step));
      setActiveFrontPreset("Custom");
    } else {
      if (dir === "up") setBackY(v => Math.max(0, v - step));
      if (dir === "down") setBackY(v => Math.min(100, v + step));
      if (dir === "left") setBackX(v => Math.max(0, v - step));
      if (dir === "right") setBackX(v => Math.min(100, v + step));
      setActiveBackPreset("Custom");
    }
  };

  const centerInZone = (side: "front"|"back", axis: "h"|"v"|"both") => {
    const preset = side === "front" ? activeFrontPreset : activeBackPreset;
    const zones = printZonesRef.current[selectedGarment][side];
    const zone = zones[preset];
    if (!zone) return;
    const centerXpct = ((zone.x + zone.w/2) / CANVAS_W) * 100;
    const centerYpct = ((zone.y + zone.h/2) / CANVAS_H) * 100;
    if (side === "front") {
      if (axis === "h" || axis === "both") setFrontX(centerXpct);
      if (axis === "v" || axis === "both") setFrontY(centerYpct);
    } else {
      if (axis === "h" || axis === "both") setBackX(centerXpct);
      if (axis === "v" || axis === "both") setBackY(centerYpct);
    }
  };

  const resetToPreset = (side: "front"|"back") => {
    const preset = side === "front" ? activeFrontPreset : activeBackPreset;
    const currentUrl = side === "front" ? frontLogoUrl : backLogoUrl;
    if (currentUrl) {
      applyDesignToZone(currentUrl, side, preset, selectedGarment);
    }
  };

  const fitToZone = (side: "front"|"back") => {
    const preset = side === "front" ? activeFrontPreset : activeBackPreset;
    const zones = printZonesRef.current[selectedGarment][side];
    const zone = zones[preset];
    if (!zone) return;
    const fillScalePct = (zone.w / CANVAS_W) * 100 * 0.98; // 98% so it touches edges without overflow
    if (side === "front") setFrontScale(fillScalePct);
    else setBackScale(fillScalePct);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isInput) return;

      const canvas = activeTabRef.current === "front" ? fabricFrontRef.current : fabricBackRef.current;
      if (!canvas) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcuts(v => !v);
        return;
      }

      if (e.key === "Escape") {
        // Close the topmost modal that's open
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showBgRemovalModal) { setShowBgRemovalModal(false); return; }
        if (showBackDesignModal) { setShowBackDesignModal(false); return; }
        if (showApprovalModal) { setShowApprovalModal(false); return; }
      }

      if (adminModeRef.current) {
        const isCmdCtrl = e.ctrlKey || e.metaKey;
        if (isCmdCtrl && e.key === "c") {
          const activeObjs = canvas.getActiveObjects();
          const guidesToCopy = activeObjs.filter((o: any) => o.name?.startsWith("guide-"));
          if (guidesToCopy.length > 0) clipboardRef.current = guidesToCopy;
        }
        if (isCmdCtrl && e.key === "v") {
          if (clipboardRef.current.length === 0) return;
          canvas.discardActiveObject();
          const newSelection: fabric.Object[] = [];
          const safeZones = printZonesRef.current[selectedGarmentRef.current][activeTabRef.current] as any;
          clipboardRef.current.forEach((originalObj) => {
            const coords = getAbsoluteCoords(originalObj);
            const newName = `Custom Zone ${Math.floor(Math.random()*10000)}`;
            const w = originalObj.width! * originalObj.scaleX!;
            const h = originalObj.height! * originalObj.scaleY!;
            const rect = new fabric.Rect({
              left: coords.left + 20, top: coords.top + 20, width: w, height: h,
              fill: "rgba(16,185,129,0.1)", stroke: "#10b981", strokeWidth: 2,
              selectable: true, evented: true, hasControls: true, cornerColor: "#10b981",
            });
            (rect as any).name = `guide-${newName}`;
            canvas.add(rect);
            newSelection.push(rect);
            safeZones[newName] = { x: Math.round(rect.left!), y: Math.round(rect.top!), w: Math.round(rect.width!), h: Math.round(rect.height!) };
          });
          if (newSelection.length > 1) canvas.setActiveObject(new fabric.ActiveSelection(newSelection, { canvas }));
          else if (newSelection.length === 1) canvas.setActiveObject(newSelection[0]);
          canvas.requestRenderAll();
        }
      } else {
        const activeObj = canvas.getActiveObject();
        if (activeObj && ((activeObj as any).name === "logo" || (activeObj as any).name === "custom-text")) {
          if (e.key === "Backspace" || e.key === "Delete") {
            clearLogo(activeTabRef.current);
            return;
          }
          if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            if (e.key === "ArrowUp") activeObj.set("top", activeObj.top! - step);
            if (e.key === "ArrowDown") activeObj.set("top", activeObj.top! + step);
            if (e.key === "ArrowLeft") activeObj.set("left", activeObj.left! - step);
            if (e.key === "ArrowRight") activeObj.set("left", activeObj.left! + step);
            activeObj.setCoords();
            canvas.renderAll();
            canvas.fire("object:modified", { target: activeObj });
          }
        }
        if (e.key === "Tab" && !e.shiftKey) {
          e.preventDefault();
          const next = activeTabRef.current === "front" ? "back" : "front";
          setActiveTab(next);
          setPreviewSide(next);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawSnapLine = (canvas: fabric.Canvas, x: number | null, y: number | null) => {
    if (x !== null) {
      let line = canvas.getObjects().find((o: any) => o.name === "snap-line-v") as fabric.Line;
      if (!line) {
        line = new fabric.Line([x, 0, x, 10000], { stroke:"#0ea5e9", strokeWidth:1, selectable:false, evented:false, strokeDashArray:[5,5] });
        (line as any).name = "snap-line-v";
        canvas.add(line);
      }
      line.set({ x1:x, x2:x });
    }
    if (y !== null) {
      let line = canvas.getObjects().find((o: any) => o.name === "snap-line-h") as fabric.Line;
      if (!line) {
        line = new fabric.Line([0, y, 10000, y], { stroke:"#0ea5e9", strokeWidth:1, selectable:false, evented:false, strokeDashArray:[5,5] });
        (line as any).name = "snap-line-h";
        canvas.add(line);
      }
      line.set({ y1:y, y2:y });
    }
    canvas.requestRenderAll();
  };
  const clearSnapLine = (canvas: fabric.Canvas, type: "v"|"h"|"all") => {
    if (type === "v" || type === "all") {
      const line = canvas.getObjects().find((o: any) => o.name === "snap-line-v");
      if (line) canvas.remove(line);
    }
    if (type === "h" || type === "all") {
      const line = canvas.getObjects().find((o: any) => o.name === "snap-line-h");
      if (line) canvas.remove(line);
    }
    canvas.requestRenderAll();
  };

  const drawGuides = useCallback((canvas: fabric.Canvas, side: "front"|"back") => {
    canvas.getObjects().forEach((o: any) => { if (o.name?.startsWith("guide")) canvas.remove(o); });
    const zones = printZonesRef.current[selectedGarmentRef.current]?.[side];
    if (!zones) return;

    let isLight = false;
    const currentColor = displayColorRef.current;
    if (currentColor) {
      const baseColor = currentColor.includes("/") ? currentColor.split("/")[0] : currentColor;
      const hex = COLOR_HEX_MAP[baseColor] || "#cccccc";
      const r = parseInt(hex.slice(1, 3), 16) || 200;
      const g = parseInt(hex.slice(3, 5), 16) || 200;
      const b = parseInt(hex.slice(5, 7), 16) || 200;
      isLight = (r * 0.299 + g * 0.587 + b * 0.114) > 150;
    }

    Object.entries(zones).forEach(([name, box]) => {
      const safeBox = box as {x:number, y:number, w:number, h:number};
      const guideColor = adminModeRef.current ? "#10b981" : (isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.4)");
      const rect = new fabric.Rect({
        left: safeBox.x, top: safeBox.y, width: safeBox.w, height: safeBox.h,
        fill: adminModeRef.current ? "rgba(16,185,129,0.1)" : "transparent",
        stroke: guideColor,
        strokeWidth: adminModeRef.current ? 2 : 1,
        strokeDashArray: [4,4],
        selectable: adminModeRef.current, evented: adminModeRef.current, hasControls: adminModeRef.current,
        cornerColor: "#10b981",
      });
      (rect as any).name = `guide-${name}`;
      canvas.add(rect);
      if (!adminModeRef.current) rect.sendToBack();
    });
    const bg = canvas.getObjects().find((o: any) => o.name === "background");
    if (bg) bg.sendToBack();
    canvas.renderAll();
  }, []);

  const syncAdminCoordinates = useCallback(() => {
    const output: any = { front:{}, back:{}, bgProps:{ front:{}, back:{} } };
    const getCoords = (canvas: fabric.Canvas | null, side: "front"|"back") => {
      if (!canvas) return;
      canvas.getObjects().forEach((o: any) => {
        if (o.name?.startsWith("guide-")) {
          const name = o.name.replace("guide-", "");
          const coords = getAbsoluteCoords(o);
          output[side][name] = {
            x: Math.round(coords.left),
            y: Math.round(coords.top),
            w: Math.round(o.width! * o.scaleX!),
            h: Math.round(o.height! * o.scaleY!)
          };
        }
        if (o.name === "background") {
          output.bgProps[side] = {
            scale: Number(o.scaleX!.toFixed(4)),
            left: Math.round(o.left!),
            top: Math.round(o.top!)
          };
        }
      });
    };
    getCoords(fabricFrontRef.current, "front");
    getCoords(fabricBackRef.current, "back");
    setAdminConfigOutput(JSON.stringify({ [selectedGarmentRef.current]: output }, null, 2));
  }, []);

  useEffect(() => {
    const updateCanvasAdmin = (canvas: fabric.Canvas | null) => {
      if (!canvas) return;
      canvas.selection = adminMode;
      canvas.getObjects().forEach((obj: any) => {
        if (obj.name?.startsWith("guide-")) {
          obj.set({
            fill: adminMode ? "rgba(16,185,129,0.1)" : "transparent",
            strokeWidth: adminMode ? 2 : 1,
            strokeDashArray: adminMode ? [] : [4,4],
            selectable: adminMode, evented: adminMode, hasControls: adminMode
          });
        }
        if (obj.name === "background") {
          obj.set({
            selectable: adminMode, evented: adminMode, hasControls: adminMode,
            borderColor: "#f43f5e", cornerColor: "#f43f5e", cornerSize: 12, transparentCorners: false
          });
        }
      });
      canvas.discardActiveObject();
      canvas.renderAll();
    };
    updateCanvasAdmin(fabricFrontRef.current);
    updateCanvasAdmin(fabricBackRef.current);
    if (adminMode) syncAdminCoordinates();
  }, [adminMode, syncAdminCoordinates]);

  useEffect(() => {
    const setupCanvasEvents = (
      canvasRef: React.MutableRefObject<fabric.Canvas | null>,
      side: "front"|"back",
      isDragging: React.MutableRefObject<boolean>,
      setX: (v: number) => void,
      setY: (v: number) => void,
      setScale: (v: number) => void
    ) => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.on("object:moving", (e: fabric.IEvent) => {
        isDragging.current = true;
        if (e.target && ((e.target as any).name === "logo" || (e.target as any).name === "custom-text")) {
          const target = e.target;
          const targetWidth = target.width! * target.scaleX!;
          const targetHeight = target.height! * target.scaleY!;
          const centerX = target.left! + (targetWidth/2);
          const centerY = target.top! + (targetHeight/2);
          const zones = printZonesRef.current[selectedGarmentRef.current][side];
          const SNAP_DIST = 10;
          let snappedX = false, snappedY = false;
          if (zones) {
            Object.entries(zones).forEach(([, box]) => {
              const safeBox = box as {x:number,y:number,w:number,h:number};
              const zCX = safeBox.x + (safeBox.w/2);
              const zCY = safeBox.y + (safeBox.h/2);
              if (Math.abs(centerX - zCX) < SNAP_DIST) {
                target.set({ left: zCX - (targetWidth/2) });
                drawSnapLine(canvas, zCX, null);
                snappedX = true;
              }
              if (Math.abs(centerY - zCY) < SNAP_DIST) {
                target.set({ top: zCY - (targetHeight/2) });
                drawSnapLine(canvas, null, zCY);
                snappedY = true;
              }
            });
          }
          if (!snappedX) clearSnapLine(canvas, "v");
          if (!snappedY) clearSnapLine(canvas, "h");
        }
      });
      canvas.on("selection:created", (e: any) => {
        const obj = e.selected?.[0];
        if (obj && obj.name === "custom-text" && obj.yayaTextData) {
          setCustomText(obj.yayaTextData.text);
          setTextColor(obj.yayaTextData.color);
          setTextFont(obj.yayaTextData.font);
          setTextStrokeColor(obj.yayaTextData.strokeColor);
          setTextStrokeWidth(obj.yayaTextData.strokeWidth);
          setTextCurve(obj.yayaTextData.curve);
        }
      });
      canvas.on("selection:updated", (e: any) => {
        const obj = e.selected?.[0];
        if (obj && obj.name === "custom-text" && obj.yayaTextData) {
          setCustomText(obj.yayaTextData.text);
          setTextColor(obj.yayaTextData.color);
          setTextFont(obj.yayaTextData.font);
          setTextStrokeColor(obj.yayaTextData.strokeColor);
          setTextStrokeWidth(obj.yayaTextData.strokeWidth);
          setTextCurve(obj.yayaTextData.curve);
        }
      });
      canvas.on("selection:created", (e: any) => {
        const obj = e.selected?.[0];
        if (obj && obj.name === "custom-text" && obj.yayaTextData) {
          setCustomText(obj.yayaTextData.text);
          setTextColor(obj.yayaTextData.color);
          setTextFont(obj.yayaTextData.font);
          setTextStrokeColor(obj.yayaTextData.strokeColor);
          setTextStrokeWidth(obj.yayaTextData.strokeWidth);
          setTextCurve(obj.yayaTextData.curve);
        }
      });
      canvas.on("selection:updated", (e: any) => {
        const obj = e.selected?.[0];
        if (obj && obj.name === "custom-text" && obj.yayaTextData) {
          setCustomText(obj.yayaTextData.text);
          setTextColor(obj.yayaTextData.color);
          setTextFont(obj.yayaTextData.font);
          setTextStrokeColor(obj.yayaTextData.strokeColor);
          setTextStrokeWidth(obj.yayaTextData.strokeWidth);
          setTextCurve(obj.yayaTextData.curve);
        }
      });
      canvas.on("object:modified", (e: fabric.IEvent) => {
        setTimeout(() => { isDragging.current = false; }, 50);
        clearSnapLine(canvas, "all");
        if (adminModeRef.current) syncAdminCoordinates();
        if (e.target && ((e.target as any).name === "logo" || (e.target as any).name === "custom-text")) {
          const target = e.target;
          const targetWidth = target.width! * target.scaleX!;
          const targetHeight = target.height! * target.scaleY!;
          const centerX = target.left! + (targetWidth/2);
          const centerY = target.top! + (targetHeight/2);
          if ((target as any).name === "logo") {
            setX((centerX / canvas.width!) * 100);
            setY((centerY / canvas.height!) * 100);
            setScale((targetWidth / canvas.width!) * 100);
            const activePreset = side === "front" ? activeFrontPresetRef.current : activeBackPresetRef.current;
            const currentUrl = side === "front" ? frontLogoUrlRef.current : backLogoUrlRef.current;
            if (currentUrl) {
              masterMemory.current[selectedGarmentRef.current][side][activePreset] = {
                url: currentUrl,
                scalePct: (targetWidth / canvas.width!) * 100,
                xPct: (centerX / canvas.width!) * 100,
                yPct: (centerY / canvas.height!) * 100
              };
            }
          } else if ((target as any).name === "custom-text") {
            masterMemory.current[selectedGarmentRef.current][side].textData = {
              ...(target as any).yayaTextData,
              left: target.left, top: target.top, scaleX: target.scaleX, scaleY: target.scaleY, angle: target.angle
            };
          }
        }
      });
    };
    if (frontCanvasRef.current && !fabricFrontRef.current) {
      fabricFrontRef.current = new fabric.Canvas(frontCanvasRef.current, {
        width: CANVAS_W, height: CANVAS_H, preserveObjectStacking: true, selection: false
      });
      setupCanvasEvents(fabricFrontRef, "front", isDraggingFront, setFrontX, setFrontY, setFrontScale);
    }
    if (backCanvasRef.current && !fabricBackRef.current) {
      fabricBackRef.current = new fabric.Canvas(backCanvasRef.current, {
        width: CANVAS_W, height: CANVAS_H, preserveObjectStacking: true, selection: false
      });
      setupCanvasEvents(fabricBackRef, "back", isDraggingBack, setBackX, setBackY, setBackScale);
    }
    return () => {
      fabricFrontRef.current?.dispose(); fabricFrontRef.current = null;
      fabricBackRef.current?.dispose(); fabricBackRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncAdminCoordinates]);

  const getImageUrl = (garmentId: string, color: string, side: "Front"|"Back") => {
    if (garmentId === "hoodie_18500") {
      return `https://yfwrkkgujvfmbrtpsvhw.supabase.co/storage/v1/object/public/artworks/Blanks/Gildan%2018500%20hoodies/Gildan_18500_${color.replace(/ /g,"_")}_${side}_High.jpg`;
    } else if (garmentId === "polo_8800") {
      const formattedColor = color.replace(/ /g,"_");
      return `https://yfwrkkgujvfmbrtpsvhw.supabase.co/storage/v1/object/public/artworks/Blanks/Gildan%208800%20Polo/Gildan_8800_${formattedColor}_${side}_High.jpg`;
    } else if (garmentId === "hat_6506") {
      const formattedColor = color.replace(/\//g,"-_").replace(/ /g,"_");
      const fileSide = side === "Back" ? "DirectSide" : "Front";
      return `https://yfwrkkgujvfmbrtpsvhw.supabase.co/storage/v1/object/public/artworks/Blanks/YP%20Classics%206506/YP_Classics_6506_${formattedColor}_${fileSide}_High.jpg`;
    } else {
      const formattedColor = color.replace(/ /g,"_");
      // Note: Assuming exact folder name is "Gildan 64000" based on your screenshot's breadcrumb.
      return `https://yfwrkkgujvfmbrtpsvhw.supabase.co/storage/v1/object/public/artworks/Blanks/Gildan%2064000/Gildan_64000_${formattedColor}_${side}_High.jpg`;
    }
  };

  // ─── PROCEDURAL PRINT-PRODUCT MOCKUP RENDERER ───────────────────────────────
  // For business cards / posters / flyers / banners / etc. we draw the substrate
  // mockup on an offscreen canvas (no Supabase fetch). The result is a data URL
  // that gets fed into fabric.Image.fromURL exactly like a garment photograph,
  // so all downstream logic (logo placement, guides, exports) is unchanged.
  const renderPrintProductMockup = (productId: string, stockId: string, side: "Front"|"Back"): string => {
    const product = PRINT_PRODUCTS.find(p => p.id === productId);
    if (!product) return "";
    const stock = PAPER_STOCKS.find(s => s.id === stockId) || PAPER_STOCKS[0];
    const f = printProductFootprint(productId);

    const c = document.createElement("canvas");
    c.width = CANVAS_W;
    c.height = CANVAS_H;
    const ctx = c.getContext("2d");
    if (!ctx) return "";

    // Scene background — a darker desktop / workshop surface so the substrate
    // (especially white stocks) shows clearly against it. Diagonal gradient for
    // depth, plus a faint vignette around the edges.
    const sceneGrad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    sceneGrad.addColorStop(0,   "#cbd5e1");
    sceneGrad.addColorStop(0.5, "#94a3b8");
    sceneGrad.addColorStop(1,   "#64748b");
    ctx.fillStyle = sceneGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Soft radial vignette so the corners are darker — adds focus on the substrate
    const vignette = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, Math.min(CANVAS_W, CANVAS_H) * 0.25,
      CANVAS_W / 2, CANVAS_H / 2, Math.max(CANVAS_W, CANVAS_H) * 0.75
    );
    vignette.addColorStop(0,   "rgba(0,0,0,0)");
    vignette.addColorStop(1,   "rgba(0,0,0,0.25)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Drop shadow for the substrate — stronger now that the background is darker
    ctx.save();
    ctx.shadowColor = "rgba(15,23,42,0.55)";
    ctx.shadowBlur = 36;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 18;

    // ── Substrate body ──────────────────────────────────────────────────────
    // For stickers, a separate path is drawn per shape so we can do circle /
    // oval / star / etc. die-cuts. Other products use a rounded rectangle.
    const isSticker = productId === "sticker_3x3";
    const radius = isSticker ? Math.min(f.w, f.h) * 0.18 :
                   productId === "business_card" || productId === "postcard_4x6" ? 8 :
                   productId.startsWith("poster") || productId === "flyer_85x11" ? 2 :
                   productId.startsWith("banner") ? 4 :
                   productId === "yard_sign_18x24" ? 6 : 4;

    if (isSticker) {
      // Use the current stickerShape from the closure-captured ref
      const shape = stickerShapeRef.current || "circle";
      drawStickerShape(ctx, f.x, f.y, f.w, f.h, shape);
    } else {
      drawRoundedRect(ctx, f.x, f.y, f.w, f.h, radius);
    }
    ctx.fillStyle = stock.hex;
    ctx.fill();
    ctx.restore();

    // Hairline edge so the substrate is always visible — even white-on-white.
    // Drawn AFTER the shadowed fill so the edge itself isn't shadowed.
    ctx.save();
    if (isSticker) {
      const shape = stickerShapeRef.current || "circle";
      drawStickerShape(ctx, f.x, f.y, f.w, f.h, shape);
    } else {
      drawRoundedRect(ctx, f.x, f.y, f.w, f.h, radius);
    }
    ctx.strokeStyle = "rgba(15,23,42,0.28)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // ── Stock-specific surface treatment ────────────────────────────────────
    ctx.save();
    drawRoundedRect(ctx, f.x, f.y, f.w, f.h, radius);
    ctx.clip();

    // Sheen — a diagonal highlight band scaled by stock.sheen
    if (stock.sheen > 0) {
      const sheenGrad = ctx.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.h);
      sheenGrad.addColorStop(0,    `rgba(255,255,255,${stock.sheen * 0.5})`);
      sheenGrad.addColorStop(0.45, `rgba(255,255,255,0)`);
      sheenGrad.addColorStop(1,    `rgba(0,0,0,${stock.sheen * 0.18})`);
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(f.x, f.y, f.w, f.h);
    }

    // Holographic stocks get an extra rainbow band
    if (stockId === "Holographic") {
      const rg = ctx.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.h);
      rg.addColorStop(0,   "rgba(168,85,247,0.18)");
      rg.addColorStop(0.3, "rgba(56,189,248,0.18)");
      rg.addColorStop(0.6, "rgba(34,197,94,0.18)");
      rg.addColorStop(1,   "rgba(244,114,182,0.18)");
      ctx.fillStyle = rg;
      ctx.fillRect(f.x, f.y, f.w, f.h);
    }

    // Subtle paper grain
    if (stockId.includes("Linen") || stockId === "80lb Uncoated" || stockId === "Recycled" || stockId === "Kraft Brown") {
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 1200; i++) {
        const x = f.x + Math.random() * f.w;
        const y = f.y + Math.random() * f.h;
        ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ── Product-specific embellishments ─────────────────────────────────────
    if (productId.startsWith("banner")) {
      // Grommet circles in the four corners
      const g = 12;
      [[f.x+g, f.y+g],[f.x+f.w-g,f.y+g],[f.x+g,f.y+f.h-g],[f.x+f.w-g,f.y+f.h-g]].forEach(([gx,gy]) => {
        ctx.fillStyle = "#475569";
        ctx.beginPath(); ctx.arc(gx, gy, 7, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#94a3b8";
        ctx.beginPath(); ctx.arc(gx, gy, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = stock.hex;
        ctx.beginPath(); ctx.arc(gx, gy, 2.5, 0, Math.PI*2); ctx.fill();
      });
    }

    if (productId === "yard_sign_18x24") {
      // H-frame stake stub poking out the bottom
      ctx.fillStyle = "#71717a";
      ctx.fillRect(f.x + f.w*0.35, f.y + f.h, 4, 28);
      ctx.fillRect(f.x + f.w*0.65, f.y + f.h, 4, 28);
    }

    if (productId === "sticker_3x3") {
      // Die-cut suggestion: a faint dashed outline 4px outside the substrate
      ctx.save();
      ctx.strokeStyle = "rgba(15,23,42,0.18)";
      ctx.setLineDash([4,4]);
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, f.x - 4, f.y - 4, f.w + 8, f.h + 8, radius + 4);
      ctx.stroke();
      ctx.restore();
    }

    // Side label — "Front" / "Back" pin on the bottom-right corner outside the substrate
    ctx.fillStyle = "rgba(15,23,42,0.45)";
    ctx.font = "900 9px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(side.toUpperCase(), f.x + f.w, f.y + f.h + 16);

    return c.toDataURL("image/png");
  };

  // Helper used by the procedural renderer to draw the various sticker die-cuts.
  // Each shape sets the current path on `ctx` (caller fills + clips). The shape
  // is sized to fit inside the rect (x, y, w, h).
  const drawStickerShape = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, shape: string) => {
    ctx.beginPath();
    if (shape === "circle") {
      const r = Math.min(w, h) / 2;
      ctx.arc(x + w/2, y + h/2, r, 0, Math.PI * 2);
    } else if (shape === "oval") {
      ctx.ellipse(x + w/2, y + h/2, w/2, h/2 * 0.78, 0, 0, Math.PI * 2);
    } else if (shape === "square") {
      ctx.rect(x, y, w, h);
    } else if (shape === "rounded") {
      const r = Math.min(w, h) * 0.18;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    } else if (shape === "rect") {
      // Wide rectangle — landscape badge feel
      const rh = h * 0.65;
      const ry = y + (h - rh) / 2;
      const r = Math.min(w, rh) * 0.12;
      ctx.moveTo(x + r, ry);
      ctx.lineTo(x + w - r, ry);
      ctx.quadraticCurveTo(x + w, ry, x + w, ry + r);
      ctx.lineTo(x + w, ry + rh - r);
      ctx.quadraticCurveTo(x + w, ry + rh, x + w - r, ry + rh);
      ctx.lineTo(x + r, ry + rh);
      ctx.quadraticCurveTo(x, ry + rh, x, ry + rh - r);
      ctx.lineTo(x, ry + r);
      ctx.quadraticCurveTo(x, ry, x + r, ry);
      ctx.closePath();
    } else if (shape === "star") {
      // 5-point star
      const cx = x + w/2, cy = y + h/2;
      const outer = Math.min(w, h) / 2;
      const inner = outer * 0.45;
      const pts = 5;
      for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / pts) * i - Math.PI / 2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      // Fallback: square
      ctx.rect(x, y, w, h);
    }
  };

  // Helper used by the procedural renderer
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const loadBackground = async (side: "Front"|"Back", canvasRef: React.MutableRefObject<fabric.Canvas | null>) => {
    if (!canvasRef.current) return;
    // For print products we synthesize the substrate mockup on a procedural
    // canvas instead of fetching photographs. Skip the magic-erase branch since
    // the procedural mockup already has a transparent (well, scene-gradient)
    // background and isn't a flat photo.
    const printMode = isPrintProduct(selectedGarment);
    const rawUrl = printMode
      ? renderPrintProductMockup(selectedGarment, displayColor, side)
      : getImageUrl(selectedGarment, displayColor, side);
    const shouldErase = !printMode && magicErase && displayColor !== "White";
    const finalUrl = shouldErase ? await removeWhiteBackground(rawUrl, 245) : rawUrl;
    fabric.Image.fromURL(finalUrl, (imgToApply: any, isError?: boolean) => {
      if (isError || !imgToApply) {
        console.error("Missing garment image:", rawUrl);
        showToast(`Missing file in Supabase: ${rawUrl.split('/').pop()}`, "error");
        return;
      }
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const bgProps = (DEFAULT_BG_PROPS as any)[selectedGarment][side.toLowerCase()];
      let finalScale = bgProps.scale;
      if (!finalScale) finalScale = Math.min(CANVAS_W / imgToApply.width!, CANVAS_H / imgToApply.height!);
      imgToApply.scale(finalScale);
      imgToApply.set({
        originX:"center", originY:"center",
        left: bgProps.left, top: bgProps.top,
        selectable: adminModeRef.current, evented: adminModeRef.current, hasControls: adminModeRef.current,
        borderColor: adminModeRef.current ? "#f43f5e" : undefined,
        cornerColor: adminModeRef.current ? "#f43f5e" : undefined,
        cornerSize: adminModeRef.current ? 12 : undefined,
        transparentCorners: false
      });
      (imgToApply as any).name = "background";
      const existingBg = canvas.getObjects().find((o: any) => o.name === "background");
      if (existingBg) canvas.remove(existingBg);
      canvas.add(imgToApply);
      imgToApply.sendToBack();
      drawGuides(canvas, side.toLowerCase() as "front"|"back");
      canvas.renderAll();
      if (adminModeRef.current) syncAdminCoordinates();
    }, { crossOrigin:"anonymous" });
  };

  useEffect(() => {
    loadBackground("Front", fabricFrontRef);
    loadBackground("Back", fabricBackRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayColor, selectedGarment, magicErase, stickerShape]);

  const applyDesignToZone = (url: string, side: "front"|"back", preset: string, garment: string) => {
    const garmentZones = printZonesRef.current[garment][side];
    let targetPreset = preset;
    if (!garmentZones[preset]) {
      targetPreset = Object.keys(garmentZones)[0];
      if (!targetPreset) return;
    }
    
    // Enforce strictly one logo per side to prevent ghost logos in the catalog
    masterMemory.current[garment][side] = {};
    
    const zone = garmentZones[targetPreset];
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Use smart sizing if we have a calibrated value for this preset, otherwise fall back to 95% of zone width
      const smartPct = SMART_SIZE_PCT[targetPreset];
      const maxByZone = ((zone.w * 0.95) / CANVAS_W) * 100;
      const safeScale = smartPct ? Math.min(smartPct, maxByZone) : maxByZone;
      const targetW = CANVAS_W * (safeScale / 100);
      const scale = targetW / img.width;
      const targetH = img.height * scale;
      const centerX = zone.x + (zone.w/2);
      let centerY = zone.y + (zone.h/2);
      if (targetPreset === "Back Design" || targetPreset === "Full Back" || targetPreset === "Upper Back") {
        centerY = zone.y + (targetH/2);
      }
      const xPct = (centerX / CANVAS_W) * 100;
      const yPct = (centerY / CANVAS_H) * 100;
      if (garment === selectedGarmentRef.current) {
        if (side === "front") {
          setFrontX(xPct); setFrontY(yPct); setFrontScale(safeScale); setFrontLogoUrl(url); setActiveFrontPreset(targetPreset);
        } else {
          setBackX(xPct); setBackY(yPct); setBackScale(safeScale); setBackLogoUrl(url); setActiveBackPreset(targetPreset);
        }
      }
      masterMemory.current[garment][side][targetPreset] = { url, scalePct: safeScale, xPct, yPct };
    };
    img.onerror = () => {
      console.warn("Failed to load design image for zone application", url);
    };
    img.src = url;
  };

  const updateLogoOnCanvas = (
    canvasRef: React.MutableRefObject<fabric.Canvas | null>,
    logoUrl: string | null, scalePct: number, xPct: number, yPct: number,
    isDraggingRef: React.MutableRefObject<boolean>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas || isDraggingRef.current) return;
    if (!logoUrl || scalePct === 0) {
      const existingObj = canvas.getObjects().find((o: any) => o.name === "logo");
      if (existingObj) canvas.remove(existingObj);
      canvas.renderAll();
      return;
    }
    const targetWidth = canvas.width! * (scalePct / 100);
    const existingObj = canvas.getObjects().find((o: any) => o.name === "logo") as fabric.Image;

    const applyLogoProperties = (img: fabric.Image) => {
      const newScale = targetWidth / img.width!;
      img.set({ scaleX:newScale, scaleY:newScale });
      const targetHeight = img.height! * newScale;
      const left = (canvas.width! * (xPct/100)) - (targetWidth/2);
      const top = (canvas.height! * (yPct/100)) - (targetHeight/2);
      img.set({
        left, top,
        globalCompositeOperation: realisticBlendRef.current && displayColorRef.current !== "Black" && displayColorRef.current !== "Navy" ? "multiply" : "source-over",
        shadow: realisticBlendRef.current ? new fabric.Shadow({ color:"transparent" }) : new fabric.Shadow({ color:"rgba(0,0,0,0.3)", blur:8, offsetY:4, offsetX:0 })
      });
      img.setCoords();
      canvas.renderAll();
      const side = canvasRef === fabricFrontRef ? "front" : "back";
      const isCanvasActive = activeTabRef.current === side;
      if (isCanvasActive && !adminModeRef.current) {
        img.set({ selectable:true, evented:true });
        canvas.setActiveObject(img);
      }
    };

    // @ts-ignore
    if (existingObj && existingObj.logoSrc === logoUrl) {
      applyLogoProperties(existingObj);
    } else {
      if (existingObj) canvas.remove(existingObj);
      const opts = logoUrl.startsWith("data:") ? {} : { crossOrigin:"anonymous" };
      fabric.Image.fromURL(logoUrl, (img: fabric.Image) => {
        img.set({
          transparentCorners:false, cornerColor:"#ffffff",
          cornerStrokeColor:"#0ea5e9", borderColor:"#0ea5e9", cornerSize:14,
          padding:10, cornerStyle:"circle", borderDashArray:[4,4],
          centeredScaling:true, lockUniScaling:true
        });
        (img as any).name = "logo";
        (img as any).logoSrc = logoUrl;
        img.setControlsVisibility({ mt:false, mb:false, ml:false, mr:false });
        canvas.add(img);
        img.bringToFront();
        applyLogoProperties(img);
      }, opts);
    }
  };

  useEffect(() => { updateLogoOnCanvas(fabricFrontRef, frontLogoUrl, frontScale, frontX, frontY, isDraggingFront); }, [frontLogoUrl, frontScale, frontX, frontY, selectedGarment, realisticBlend]);
  useEffect(() => { updateLogoOnCanvas(fabricBackRef, backLogoUrl, backScale, backX, backY, isDraggingBack); }, [backLogoUrl, backScale, backX, backY, selectedGarment, realisticBlend]);

  // ---------------------------------------------------------------------------
  // SMART TYPOGRAPHY ENGINE (ADD & LIVE UPDATE)
  // ---------------------------------------------------------------------------
  const applyTypography = (isLiveUpdate = false) => {
    if (!customText.trim()) return;
    const canvas = activeTab === "front" ? fabricFrontRef.current : fabricBackRef.current;
    if (!canvas) return;

    const existingObj = canvas.getActiveObject() as any;
    const isUpdating = isLiveUpdate && existingObj && existingObj.name === "custom-text";
    if (isLiveUpdate && !isUpdating) return; // Prevent rebuilding if text isn't actively selected

    let left = 300, top = 250, scaleX = 1, scaleY = 1, angle = 0;
    if (isUpdating) {
      left = existingObj.left; top = existingObj.top;
      scaleX = existingObj.scaleX; scaleY = existingObj.scaleY; angle = existingObj.angle;
    }

    const cleanFont = textFont.split(',')[0].replace(/'/g, '');
    const isArabic = /[\u0600-\u06FF]/.test(customText);
    const finalFont = (isArabic && cleanFont === "sans-serif") ? "Cairo" : cleanFont;

    let newTextObj;
    if (textCurve === 0) {
      newTextObj = new fabric.Text(customText, {
        fontFamily: finalFont, fontWeight: "900", fill: textColor,
        stroke: textStrokeWidth > 0 ? textStrokeColor : null, strokeWidth: textStrokeWidth, strokeUniform: true,
        left, top, scaleX, scaleY, angle, originX: "center", originY: "center",
        shadow: realisticBlendRef.current ? undefined : new fabric.Shadow({ color: "rgba(0,0,0,0.3)", blur: 4, offsetY: 2 }),
        globalCompositeOperation: realisticBlendRef.current ? "multiply" : "source-over",
        transparentCorners: false, cornerColor: "#ffffff", cornerStrokeColor: "#0ea5e9", borderColor: "#0ea5e9", cornerSize: 12, padding: 8
      });
    } else {
      const chars = customText.split('');
      const radius = Math.max(80, 4000 / Math.abs(textCurve)); 
      const isReverse = textCurve < 0;
      const groupItems = chars.map((char, i) => {
        const angleDegrees = (textCurve / Math.max(1, chars.length - 1)) * (i - (chars.length - 1) / 2);
        const angleRad = (angleDegrees * Math.PI) / 180;
        const x = Math.sin(angleRad) * radius;
        const y = (1 - Math.cos(angleRad)) * radius * (isReverse ? -1 : 1);
        return new fabric.Text(char, {
          fontFamily: finalFont, fontWeight: "900", fill: textColor,
          stroke: textStrokeWidth > 0 ? textStrokeColor : null, strokeWidth: textStrokeWidth, strokeUniform: true,
          left: x, top: y, angle: angleDegrees, originX: "center", originY: isReverse ? "top" : "bottom"
        });
      });
      newTextObj = new fabric.Group(groupItems, {
        left, top, scaleX, scaleY, angle, originX: "center", originY: "center",
        shadow: realisticBlendRef.current ? undefined : new fabric.Shadow({ color: "rgba(0,0,0,0.3)", blur: 4, offsetY: 2 }),
        globalCompositeOperation: realisticBlendRef.current ? "multiply" : "source-over",
        transparentCorners: false, cornerColor: "#ffffff", cornerStrokeColor: "#0ea5e9", borderColor: "#0ea5e9", cornerSize: 12, padding: 8
      });
    }

    (newTextObj as any).name = "custom-text";
    (newTextObj as any).yayaTextData = { text: customText, font: textFont, color: textColor, strokeColor: textStrokeColor, strokeWidth: textStrokeWidth, curve: textCurve };
    newTextObj.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });

    if (isUpdating) canvas.remove(existingObj);
    canvas.add(newTextObj);
    canvas.setActiveObject(newTextObj);
    canvas.renderAll();

    // Save independent memory state for this specific garment
    masterMemory.current[selectedGarmentRef.current][activeTab].textData = {
      ...(newTextObj as any).yayaTextData, left, top, scaleX, scaleY, angle
    };

    if (!isLiveUpdate) showToast("Typography added", "success");
  };

  const handleAddText = () => applyTypography(false);

  // Link UI Controls to Live Canvas Updates
  useEffect(() => { applyTypography(true); }, [customText, textColor, textFont, textStrokeColor, textStrokeWidth, textCurve]);

  // Populate UI Controls when clicking existing text on canvas
  useEffect(() => {
    const bindSelection = (canvas: fabric.Canvas | null) => {
      if (!canvas) return;
      const syncUI = (e: any) => {
        const obj = e.selected?.[0];
        if (obj && obj.name === "custom-text" && obj.yayaTextData) {
          setCustomText(obj.yayaTextData.text); setTextColor(obj.yayaTextData.color); setTextFont(obj.yayaTextData.font);
          setTextStrokeColor(obj.yayaTextData.strokeColor); setTextStrokeWidth(obj.yayaTextData.strokeWidth); setTextCurve(obj.yayaTextData.curve);
        }
      };
      canvas.on("selection:created", syncUI);
      canvas.on("selection:updated", syncUI);
      canvas.on("object:modified", (e: any) => {
        if (e.target && e.target.name === "custom-text") {
          masterMemory.current[selectedGarmentRef.current][activeTab].textData = {
            ...e.target.yayaTextData, left: e.target.left, top: e.target.top, scaleX: e.target.scaleX, scaleY: e.target.scaleY, angle: e.target.angle
          };
        }
      });
    };
    bindSelection(fabricFrontRef.current);
    bindSelection(fabricBackRef.current);
  }, [activeTab]);

  // Restore independent text when switching garments
  useEffect(() => {
    const restoreText = (side: "front"|"back", canvasRef: React.MutableRefObject<fabric.Canvas | null>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const existingText = canvas.getObjects().find((o: any) => o.name === "custom-text");
      if (existingText) canvas.remove(existingText);

      const tData = masterMemory.current[selectedGarment]?.[side]?.textData;
      if (tData) {
        let newTextObj;
        if (tData.curve === 0) {
          newTextObj = new fabric.Text(tData.text, {
            fontFamily: tData.font, fontWeight: "900", fill: tData.color,
            stroke: tData.strokeWidth > 0 ? tData.strokeColor : null, strokeWidth: tData.strokeWidth, strokeUniform: true,
            left: tData.left, top: tData.top, scaleX: tData.scaleX, scaleY: tData.scaleY, angle: tData.angle, originX: "center", originY: "center",
            shadow: realisticBlend ? undefined : new fabric.Shadow({ color: "rgba(0,0,0,0.3)", blur: 4, offsetY: 2 }),
            globalCompositeOperation: realisticBlend ? "multiply" : "source-over",
            transparentCorners: false, cornerColor: "#ffffff", cornerStrokeColor: "#0ea5e9", borderColor: "#0ea5e9", cornerSize: 12, padding: 8
          });
        } else {
          const chars = tData.text.split('');
          const radius = Math.max(80, 4000 / Math.abs(tData.curve)); 
          const isReverse = tData.curve < 0;
          const groupItems = chars.map((char: string, i: number) => {
            const angleDegrees = (tData.curve / Math.max(1, chars.length - 1)) * (i - (chars.length - 1) / 2);
            const angleRad = (angleDegrees * Math.PI) / 180;
            const x = Math.sin(angleRad) * radius;
            const y = (1 - Math.cos(angleRad)) * radius * (isReverse ? -1 : 1);
            return new fabric.Text(char, {
              fontFamily: tData.font, fontWeight: "900", fill: tData.color,
              stroke: tData.strokeWidth > 0 ? tData.strokeColor : null, strokeWidth: tData.strokeWidth, strokeUniform: true,
              left: x, top: y, angle: angleDegrees, originX: "center", originY: isReverse ? "top" : "bottom"
            });
          });
          newTextObj = new fabric.Group(groupItems, {
            left: tData.left, top: tData.top, scaleX: tData.scaleX, scaleY: tData.scaleY, angle: tData.angle, originX: "center", originY: "center",
            shadow: realisticBlend ? undefined : new fabric.Shadow({ color: "rgba(0,0,0,0.3)", blur: 4, offsetY: 2 }),
            globalCompositeOperation: realisticBlend ? "multiply" : "source-over",
            transparentCorners: false, cornerColor: "#ffffff", cornerStrokeColor: "#0ea5e9", borderColor: "#0ea5e9", cornerSize: 12, padding: 8
          });
        }
        (newTextObj as any).name = "custom-text";
        (newTextObj as any).yayaTextData = tData;
        newTextObj.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
        canvas.add(newTextObj);
      }
      canvas.renderAll();
    };
    restoreText("front", fabricFrontRef);
    restoreText("back", fabricBackRef);
  }, [selectedGarment, realisticBlend]);

  // ---------------------------------------------------------------------------
  // LIVE TYPOGRAPHY REBUILDING ENGINE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = activeTab === "front" ? fabricFrontRef.current : fabricBackRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject() as any;
    if (!activeObj || activeObj.name !== "custom-text" || !customText.trim()) return;

    // Prevent infinite loops by verifying something actually changed
    const data = activeObj.yayaTextData || {};
    if (data.text === customText && data.font === textFont && data.color === textColor &&
        data.strokeColor === textStrokeColor && data.strokeWidth === textStrokeWidth && data.curve === textCurve) {
      return;
    }

    // Capture exact position and rotation
    const left = activeObj.left;
    const top = activeObj.top;
    const scaleX = activeObj.scaleX;
    const scaleY = activeObj.scaleY;
    const angle = activeObj.angle;

    const cleanFont = textFont.split(',')[0].replace(/'/g, '');
    const isArabic = /[\u0600-\u06FF]/.test(customText);
    const finalFont = (isArabic && cleanFont === "sans-serif") ? "Cairo" : cleanFont;

    let newTextObj;
    if (textCurve === 0) {
      newTextObj = new fabric.Text(customText, {
        fontFamily: finalFont, fontWeight: "900", fill: textColor,
        stroke: textStrokeWidth > 0 ? textStrokeColor : null,
        strokeWidth: textStrokeWidth, strokeUniform: true,
        left, top, scaleX, scaleY, angle, originX: "center", originY: "center",
        shadow: realisticBlendRef.current ? undefined : new fabric.Shadow({ color: "rgba(0,0,0,0.3)", blur: 4, offsetY: 2 }),
        globalCompositeOperation: realisticBlendRef.current ? "multiply" : "source-over",
        transparentCorners: false, cornerColor: "#ffffff",
        cornerStrokeColor: "#0ea5e9", borderColor: "#0ea5e9", cornerSize: 12, padding: 8
      });
    } else {
      const chars = customText.split('');
      const radius = Math.max(80, 4000 / Math.abs(textCurve)); 
      const isReverse = textCurve < 0;
      const groupItems = chars.map((char, i) => {
        const angleDegrees = (textCurve / Math.max(1, chars.length - 1)) * (i - (chars.length - 1) / 2);
        const angleRad = (angleDegrees * Math.PI) / 180;
        const x = Math.sin(angleRad) * radius;
        const y = (1 - Math.cos(angleRad)) * radius * (isReverse ? -1 : 1);
        return new fabric.Text(char, {
          fontFamily: finalFont, fontWeight: "900", fill: textColor,
          stroke: textStrokeWidth > 0 ? textStrokeColor : null,
          strokeWidth: textStrokeWidth, strokeUniform: true,
          left: x, top: y, angle: angleDegrees,
          originX: "center", originY: isReverse ? "top" : "bottom"
        });
      });
      newTextObj = new fabric.Group(groupItems, {
        left, top, scaleX, scaleY, angle, originX: "center", originY: "center",
        shadow: realisticBlendRef.current ? undefined : new fabric.Shadow({ color: "rgba(0,0,0,0.3)", blur: 4, offsetY: 2 }),
        globalCompositeOperation: realisticBlendRef.current ? "multiply" : "source-over",
        transparentCorners: false, cornerColor: "#ffffff",
        cornerStrokeColor: "#0ea5e9", borderColor: "#0ea5e9", cornerSize: 12, padding: 8
      });
    }
    
    (newTextObj as any).name = "custom-text";
    (newTextObj as any).yayaTextData = {
      text: customText, font: textFont, color: textColor,
      strokeColor: textStrokeColor, strokeWidth: textStrokeWidth, curve: textCurve
    };
    newTextObj.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });

    // Seamlessly swap the object
    canvas.remove(activeObj);
    canvas.add(newTextObj);
    canvas.setActiveObject(newTextObj);
    canvas.renderAll();
    canvas.fire("object:modified", { target: newTextObj });

  }, [customText, textColor, textFont, textStrokeColor, textStrokeWidth, textCurve, activeTab]);

  const handleRemoveActiveLogoBg = async (side: "front"|"back") => {
    const currentUrl = side === "front" ? frontLogoUrl : backLogoUrl;
    const targetColor = side === "front" ? frontTargetColor : backTargetColor;
    if (!currentUrl) return;
    setProgress("Removing selected color...");
    try {
      const transparentUrl = await removeColorFromImage(currentUrl, targetColor);
      if (side === "front") setFrontLogoUrl(transparentUrl);
      else setBackLogoUrl(transparentUrl);
      const activePreset = side === "front" ? activeFrontPresetRef.current : activeBackPresetRef.current;
      GARMENT_TYPES.forEach((g) => {
        if (masterMemory.current[g.id][side][activePreset] && masterMemory.current[g.id][side][activePreset].url === currentUrl) {
          masterMemory.current[g.id][side][activePreset].url = transparentUrl;
        }
      });
      showToast("Color removed from design", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to remove color", "error");
    }
    setProgress("");
  };

  const convertFileToImageUrl = async (file: File): Promise<string> => {
    if (file.type === "application/pdf") {
      setProgress("Rasterizing PDF...");
      if (!(window as any).pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      }
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 12.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      setProgress("");
      return canvas.toDataURL("image/png");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") resolve(result);
        else reject(new Error("Unable to read file"));
      };
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingFile(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    // Prevent flickering when dragging over child elements
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };
  const finalizeUpload = (finalUrl: string) => {
    setUploadedDesigns((prev) => [...prev, finalUrl]);
    setPendingUploadUrl(finalUrl);
    setActiveTab("front");
    setPreviewSide("front");
    GARMENT_TYPES.forEach((g) => {
      const targetPreset = g.id === "hat_6506" ? "Front Center" : "Left Chest";
      applyDesignToZone(finalUrl, "front", targetPreset, g.id);
    });
    // Print products: single "Design" zone, same fabric pipeline.
    PRINT_PRODUCTS.forEach((p) => {
      applyDesignToZone(finalUrl, "front", "Design", p.id);
    });
    setCatalogUrl(null);
    showToast("Design uploaded successfully", "success");
    setShowBgRemovalModal(false);
    setTimeout(() => setShowBackDesignModal(true), 600);
  };

  const handleBgChoice = async (mode: "none" | "global" | "edge") => {
    if (!pendingUploadUrl) return;
    if (mode === "none") {
      finalizeUpload(pendingUploadUrl);
      return;
    }
    
    setProgress(mode === "global" ? "Removing All White..." : "Removing Edges...");
    try {
      const cleanUrl = await new Promise<string>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("No context");
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            const tolerance = 30; 
            const limit = 255 - tolerance;

            if (mode === "global") {
              for (let i = 0; i < data.length; i += 4) {
                if (data[i] > limit && data[i + 1] > limit && data[i + 2] > limit) {
                  data[i + 3] = 0;
                }
              }
            } else if (mode === "edge") {
              const isWhite = (r: number, g: number, b: number) => r > limit && g > limit && b > limit;
              const stack: [number, number][] = [];
              const visited = new Uint8Array(w * h);
              for (let x = 0; x < w; x++) { stack.push([x, 0]); stack.push([x, h - 1]); }
              for (let y = 0; y < h; y++) { stack.push([0, y]); stack.push([w - 1, y]); }
              let iterations = 0; const MAX_ITERATIONS = w * h * 4;
              while (stack.length && iterations < MAX_ITERATIONS) {
                iterations++;
                const popped = stack.pop();
                if (!popped) continue;
                const [x, y] = popped;
                if (x < 0 || x >= w || y < 0 || y >= h) continue;
                const idx = (y * w + x);
                if (visited[idx]) continue;
                visited[idx] = 1;
                const dataIdx = idx * 4;
                const r = data[dataIdx], g = data[dataIdx + 1], b = data[dataIdx + 2], a = data[dataIdx + 3];
                if (a === 0 || isWhite(r, g, b)) {
                  if (a !== 0) data[dataIdx + 3] = 0;
                  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
                }
              }
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL());
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = reject;
        img.src = pendingUploadUrl;
      });
      
      finalizeUpload(cleanUrl);
    } catch (err) {
      console.error("Local BG Removal Error:", err);
      showToast("Failed to process image. Proceeding with original.", "error");
      finalizeUpload(pendingUploadUrl);
    }
    setProgress("");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const url = await convertFileToImageUrl(file);
      setPendingUploadUrl(url);
      setShowBgRemovalModal(true);
    } catch (err) {
      console.error("Error reading dropped file:", err);
      showToast("Failed to read file. If PDF, ensure it's not password-protected.", "error");
      setProgress("");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await convertFileToImageUrl(file);
      setPendingUploadUrl(url);
      setShowBgRemovalModal(true);
    } catch (err) {
      console.error("Error reading file:", err);
      showToast("Failed to read file. If PDF, ensure it's not password-protected.", "error");
      setProgress("");
    }
    e.target.value = "";
  };

  // Handle Command/Ctrl + V to paste image directly from clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isInput) return; // Don't block normal text pasting

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1 || items[i].type === "application/pdf") {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            try {
              const url = await convertFileToImageUrl(file);
              setPendingUploadUrl(url);
              setShowBgRemovalModal(true);
              showToast("Design pasted from clipboard", "success");
            } catch (err) {
              console.error("Error reading pasted file:", err);
              showToast("Failed to read pasted file.", "error");
            }
            break; // Stop after grabbing the first image
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSameBackLogo = () => {
    if (pendingUploadUrl) {
      GARMENT_TYPES.forEach((g) => {
        if (g.id !== "hat_6506") applyDesignToZone(pendingUploadUrl, "back", "Back Design", g.id);
      });
      PRINT_PRODUCTS.forEach((p) => {
        if (p.hasBack) applyDesignToZone(pendingUploadUrl, "back", "Design", p.id);
      });
      setActiveTab("back");
      setPreviewSide("back");
      showToast("Back design applied", "success");
    }
    setShowBackDesignModal(false);
  };
  const handleNoBackPrint = () => { setShowBackDesignModal(false); };
  const handleUploadNewBackLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await convertFileToImageUrl(file);
      setUploadedDesigns((prev) => [...prev, url]);
      setActiveTab("back");
      setPreviewSide("back");
      GARMENT_TYPES.forEach((g) => {
        if (g.id !== "hat_6506") applyDesignToZone(url, "back", "Back Design", g.id);
      });
      PRINT_PRODUCTS.forEach((p) => {
        if (p.hasBack) applyDesignToZone(url, "back", "Design", p.id);
      });
      setShowBackDesignModal(false);
      showToast("Back design uploaded", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to read file", "error");
      setProgress("");
    }
    e.target.value = "";
  };

  const handleLibraryClick = (url: string) => {
    const activePreset = activeTab === "front" ? activeFrontPreset : activeBackPreset;
    GARMENT_TYPES.forEach((g) => {
      applyDesignToZone(url, activeTab, activePreset, g.id);
    });
    // Print products always use the "Design" zone — ignore the apparel preset name
    PRINT_PRODUCTS.forEach((p) => {
      if (activeTab === "back" && !p.hasBack) return;
      applyDesignToZone(url, activeTab, "Design", p.id);
    });
  };

  const handlePresetClick = (side: "front"|"back", presetName: string) => {
    if (presetName === "No Print") {
      if (side === "front") { 
        setFrontScale(0); setFrontLogoUrl(null); setActiveFrontPreset("No Print"); 
        GARMENT_TYPES.forEach(g => { masterMemory.current[g.id].front = {}; });
        PRINT_PRODUCTS.forEach(p => { masterMemory.current[p.id].front = {}; });
      } else { 
        setBackScale(0); setBackLogoUrl(null); setActiveBackPreset("No Print"); 
        GARMENT_TYPES.forEach(g => { masterMemory.current[g.id].back = {}; });
        PRINT_PRODUCTS.forEach(p => { masterMemory.current[p.id].back = {}; });
      }
      return;
    }
    const currentUrl = side === "front" ? frontLogoUrl : backLogoUrl;
    if (currentUrl) {
      GARMENT_TYPES.forEach((g) => { applyDesignToZone(currentUrl, side, presetName, g.id); });
      PRINT_PRODUCTS.forEach((p) => {
        if (side === "back" && !p.hasBack) return;
        applyDesignToZone(currentUrl, side, "Design", p.id);
      });
    } else {
      if (side === "front") setActiveFrontPreset(presetName);
      else setActiveBackPreset(presetName);
    }
  };

  const buildOfflineScene = async (garment: string, side: "front"|"back", overrideColor?: string, customMultiplier?: number): Promise<string> => {
    const useColor = overrideColor || lockedColor;
    return new Promise(async (resolve) => {
      const offlineCanvas = new fabric.StaticCanvas(null, { width:CANVAS_W, height:CANVAS_H });
      let rawUrl = "";
      if (garment === "hoodie_18500") {
        const colorPart = side === "front" ? "Front" : "Back";
        rawUrl = `https://yfwrkkgujvfmbrtpsvhw.supabase.co/storage/v1/object/public/artworks/Blanks/Gildan%2018500%20hoodies/Gildan_18500_${useColor.replace(/ /g,"_")}_${colorPart}_High.jpg`;
      } else if (garment === "polo_8800") {
        const colorPart = side === "front" ? "Front" : "Back";
        const formattedColor = useColor.replace(/ /g,"_");
        rawUrl = `https://yfwrkkgujvfmbrtpsvhw.supabase.co/storage/v1/object/public/artworks/Blanks/Gildan%208800%20Polo/Gildan_8800_${formattedColor}_${colorPart}_High.jpg`;
      } else if (garment === "hat_6506") {
        const formattedColor = useColor.replace(/\//g,"-_").replace(/ /g,"_");
        const fileSide = side === "back" ? "DirectSide" : "Front";
        rawUrl = `https://yfwrkkgujvfmbrtpsvhw.supabase.co/storage/v1/object/public/artworks/Blanks/YP%20Classics%206506/YP_Classics_6506_${formattedColor}_${fileSide}_High.jpg`;
      } else {
        const colorPart = side === "front" ? "Front" : "Back";
        const formattedColor = useColor.replace(/ /g,"_");
        rawUrl = `https://yfwrkkgujvfmbrtpsvhw.supabase.co/storage/v1/object/public/artworks/Blanks/Gildan%2064000/Gildan_64000_${formattedColor}_${colorPart}_High.jpg`;
      }
      const shouldErase = magicErase && useColor !== "White";
      const finalUrl = shouldErase ? await removeWhiteBackground(rawUrl, 245) : rawUrl;
      fabric.Image.fromURL(finalUrl, (bgImg: any, isError?: boolean) => {
        if (isError || !bgImg || typeof bgImg.scale !== "function") {
          console.warn("Failed to load background for offline scene:", finalUrl);
          return resolve("");
        }
        const bgProps = (DEFAULT_BG_PROPS as any)[garment][side];
        bgImg.scale(bgProps.scale);
        bgImg.set({ originX:"center", originY:"center", left:bgProps.left, top:bgProps.top });
        offlineCanvas.add(bgImg);
        const sideMemory = { ...masterMemory.current[garment][side] };
        if (garment === selectedGarment && !overrideColor) {
          if (side === "front" && frontLogoUrl) sideMemory[activeFrontPreset] = { url:frontLogoUrl, scalePct:frontScale, xPct:frontX, yPct:frontY };
          if (side === "back" && backLogoUrl) sideMemory[activeBackPreset] = { url:backLogoUrl, scalePct:backScale, xPct:backX, yPct:backY };
        }
        const textData = sideMemory.textData;
        delete sideMemory.textData;

        const logoPromises = Object.entries(sideMemory).map(([, data]: [string, any]) => {
          return new Promise((res) => {
            if (!data.url) return res(null);
            const opts = data.url.startsWith("data:") ? {} : { crossOrigin:"anonymous" };
            fabric.Image.fromURL(data.url, (logoImg) => {
              if (!logoImg || !logoImg.width) {
                console.warn("Skipping broken logo in offline scene:", data.url);
                return res(null);
              }
              const tw = CANVAS_W * (data.scalePct / 100);
              const ns = tw / logoImg.width!;
              logoImg.set({ scaleX:ns, scaleY:ns });
              const th = logoImg.height! * ns;
              logoImg.set({
                left:(CANVAS_W * (data.xPct/100)) - (tw/2),
                top:(CANVAS_H * (data.yPct/100)) - (th/2),
                globalCompositeOperation: realisticBlend && useColor !== "Black" && useColor !== "Navy" ? "multiply" : "source-over",
                shadow: realisticBlend ? new fabric.Shadow({ color:"transparent" }) : new fabric.Shadow({ color:"rgba(0,0,0,0.4)", blur:15, offsetY:8, offsetX:0 })
              });
              offlineCanvas.add(logoImg);
              res(null);
            }, opts);
          });
        });
        Promise.all(logoPromises).then(() => {
          if (textData) {
            let newTextObj;
            if (textData.curve === 0) {
              newTextObj = new fabric.Text(textData.text, {
                fontFamily: textData.font, fontWeight: "900", fill: textData.color,
                stroke: textData.strokeWidth > 0 ? textData.strokeColor : null, strokeWidth: textData.strokeWidth, strokeUniform: true,
                left: textData.left, top: textData.top, scaleX: textData.scaleX, scaleY: textData.scaleY, angle: textData.angle, originX: "center", originY: "center",
                shadow: realisticBlend && useColor !== "Black" && useColor !== "Navy" ? undefined : new fabric.Shadow({ color: "rgba(0,0,0,0.3)", blur: 4, offsetY: 2 }),
                globalCompositeOperation: realisticBlend && useColor !== "Black" && useColor !== "Navy" ? "multiply" : "source-over"
              });
            } else {
              const chars = textData.text.split('');
              const radius = Math.max(80, 4000 / Math.abs(textData.curve)); 
              const isReverse = textData.curve < 0;
              const groupItems = chars.map((char: string, i: number) => {
                const angleDegrees = (textData.curve / Math.max(1, chars.length - 1)) * (i - (chars.length - 1) / 2);
                const angleRad = (angleDegrees * Math.PI) / 180;
                const x = Math.sin(angleRad) * radius;
                const y = (1 - Math.cos(angleRad)) * radius * (isReverse ? -1 : 1);
                return new fabric.Text(char, {
                  fontFamily: textData.font, fontWeight: "900", fill: textData.color,
                  stroke: textStrokeWidth > 0 ? textStrokeColor : null, strokeWidth: textData.strokeWidth, strokeUniform: true,
                  left: x, top: y, angle: angleDegrees, originX: "center", originY: isReverse ? "top" : "bottom"
                });
              });
              newTextObj = new fabric.Group(groupItems, {
                left: textData.left, top: textData.top, scaleX: textData.scaleX, scaleY: textData.scaleY, angle: textData.angle, originX: "center", originY: "center",
                shadow: realisticBlend && useColor !== "Black" && useColor !== "Navy" ? undefined : new fabric.Shadow({ color: "rgba(0,0,0,0.3)", blur: 4, offsetY: 2 }),
                globalCompositeOperation: realisticBlend && useColor !== "Black" && useColor !== "Navy" ? "multiply" : "source-over"
              });
            }
            offlineCanvas.add(newTextObj);
          }

          if (enableWatermark) {
            for (let w=0; w<4; w++) {
              const wmText = new fabric.Text("YAYA PRINTS PROOF", {
                fontSize:50, fontFamily:"sans-serif", fontWeight:"900",
                fill:"rgba(255,255,255,0.2)", angle:-35, originX:"center", originY:"center",
                left:300, top:150 + (w*150)
              });
              offlineCanvas.add(wmText);
            }
          }
          offlineCanvas.renderAll();
          resolve(offlineCanvas.toDataURL({ format:"png", multiplier: customMultiplier || EXPORT_RESOLUTION_MULTIPLIER }));
        });
      }, { crossOrigin:"anonymous" });
    });
  };

  // -------------------- PREMIUM CATALOG GENERATOR --------------------
  const generateMasterCatalog = async () => {
    if (!frontLogoUrl && !backLogoUrl) { showToast("Apply at least one logo first", "error"); return; }
    setIsProcessing(true); setCatalogUrl(null);
    try {
      setProgress(`Rendering T-Shirt Front...`);
      const tf = await buildOfflineScene("tshirt_64000","front");
      setProgress(`Rendering T-Shirt Back...`);   const tb = await buildOfflineScene("tshirt_64000","back");
      setProgress(`Rendering Hoodie Front...`);
      const hf = await buildOfflineScene("hoodie_18500","front");
      setProgress(`Rendering Hoodie Back...`);    const hb = await buildOfflineScene("hoodie_18500","back");
      setProgress(`Rendering Polo Front...`);
      const pf = await buildOfflineScene("polo_8800","front");
      setProgress(`Rendering Polo Back...`);      const pb = await buildOfflineScene("polo_8800","back");
      setProgress(`Rendering Hat Front...`);
      const hatF = await buildOfflineScene("hat_6506","front");
      setProgress(`Rendering Hat Side...`);       const hatB = await buildOfflineScene("hat_6506","back");

      // Build per-garment meta with pricing if enabled
      const p = (k: "tshirt"|"hoodie"|"polo"|"hat") => {
        const row = pricing[k];
        if (!showPricingPanel) return null;
        return {
          qty: row.qty,
          unit: row.unit ? fmtPrice(row.unit) : "",
          total: row.total ? fmtPrice(row.total) : (row.qty && row.unit ? fmtPrice(String(parseFloat(row.qty) * parseFloat(row.unit.replace(/[^0-9.]/g,"")))) : "")
        };
      };

      const chartBase = "https://yfwrkkgujvfmbrtpsvhw.supabase.co/storage/v1/object/public/artworks/Blanks/Charts/";
      const compiledItems = [
        { url: tf,                                     title:"Premium Tee • Front",  subtitle:lockedColor,                                  priceKey:"tshirt" as const, price: p("tshirt") },
        { url: tb,                                     title:"Premium Tee • Back",   subtitle:lockedColor,                                  priceKey:"tshirt" as const, price: p("tshirt") },
        { url: `${chartBase}Tshirt_Colors.jpg`,        title:"Premium Tee • Colors", subtitle:"Available Color Options",                    priceKey:"tshirt" as const, price: p("tshirt") },
        { url: hf,                                     title:"Heavy Hoodie • Front", subtitle:lockedColor,                                  priceKey:"hoodie" as const, price: p("hoodie") },
        { url: hb,                                     title:"Heavy Hoodie • Back",  subtitle:lockedColor,                                  priceKey:"hoodie" as const, price: p("hoodie") },
        { url: `${chartBase}hoodie_Colors.jpg`,        title:"Heavy Hoodie • Colors",subtitle:"Available Color Options",                    priceKey:"hoodie" as const, price: p("hoodie") },
        { url: pf,                                     title:"Polo • Front",         subtitle:lockedColor,                                  priceKey:"polo" as const,   price: p("polo") },
        { url: pb,                                     title:"Polo • Back",          subtitle:lockedColor,                                  priceKey:"polo" as const,   price: p("polo") },
        { url: `${chartBase}Polo_Colors.jpg`,          title:"Polo • Colors",        subtitle:"Available Color Options",                    priceKey:"polo" as const,   price: p("polo") },
        { url: hatF,                                   title:"Trucker • Front",      subtitle:lockedColor,                                  priceKey:"hat" as const,    price: p("hat") },
        { url: hatB,                                   title:"Trucker • Side",       subtitle:lockedColor,                                  priceKey:"hat" as const,    price: p("hat") },
        { url: `${chartBase}snapcap_Colors.jpg`,       title:"Trucker • Colors",     subtitle:"Available Color Options",                    priceKey:"hat" as const,    price: p("hat") },
      ];
      // Persist for per-item downloads in the catalog viewer
      setCatalogItems(compiledItems as CatalogItem[]);

      setProgress("Stitching 8K Master Presentation...");
      const catalogCanvas = document.createElement("canvas");
      const cCtx = catalogCanvas.getContext("2d");
      if (cCtx) {
        // DOUBLE ALL DIMENSIONS FOR 8K OUTPUT
        const W = 6400; 
        const cols = 3;
        const gap = 160;
        const margin = 280;
        const colW = Math.floor((W - (margin * 2) - (gap * (cols - 1))) / cols); // ~1826px
        const cardH = showPricingPanel ? 2700 : 2300;
        // taller if pricing shown
        const rows = Math.ceil(compiledItems.length / cols);
        const headerH = 960;
        const footerH = showPricingPanel ? 1040 : 560;
        const H = headerH + (rows * (cardH + gap)) + footerH;
        catalogCanvas.width = W;
        catalogCanvas.height = H;

        const dark = catalogTheme === "Dark";
        if (dark) {
          const grad = cCtx.createLinearGradient(0, 0, 0, H);
          grad.addColorStop(0, "#09090b");
          grad.addColorStop(1, "#18181b");
          cCtx.fillStyle = grad;
        } else {
          cCtx.fillStyle = "#fafafa";
        }
        cCtx.fillRect(0, 0, W, H);

        const textColor = dark ? "#ffffff" : "#18181b";
        const mutedColor = dark ? "#a1a1aa" : "#71717a";
        const cardBg = dark ? "#18181b" : "#ffffff";
        const borderColor = dark ? "#27272a" : "#e4e4e7";
        const accentColor = "#0ea5e9";

        // ----------- HEADER -----------
        cCtx.textAlign = "left";
        cCtx.fillStyle = textColor;
        cCtx.font = "italic 900 280px system-ui, -apple-system, sans-serif";
        cCtx.fillText("YAYA PRINTS", 400, 420);

        // Accent bar
        cCtx.fillStyle = accentColor;
        cCtx.fillRect(400, 460, 640, 16);

        const activeJob = jobsList.find((j) => j.id === selectedJobId);
        const customerName = activeJob?.quotes?.customers?.company_name || "VALUED CLIENT";
        const dateStr = new Date().toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });

        cCtx.fillStyle = textColor;
        cCtx.font = "800 110px system-ui, -apple-system, sans-serif";
        cCtx.fillText(`PREPARED FOR: ${customerName.toUpperCase()}`, 400, 640);

        cCtx.fillStyle = mutedColor;
        cCtx.font = "600 84px system-ui, -apple-system, sans-serif";
        const subtitle = activeJob?.job_number ? `Quote #${activeJob.job_number}  •  ${dateStr}` : `Custom Apparel Proof  •  ${dateStr}`;
        cCtx.fillText(subtitle, 400, 770);

        if (showPricingPanel && quoteValidDays) {
          cCtx.textAlign = "right";
          cCtx.fillStyle = accentColor;
          cCtx.font = "800 76px system-ui, -apple-system, sans-serif";
          cCtx.fillText(`VALID FOR ${quoteValidDays} DAYS`, W - 400, 770);
          cCtx.textAlign = "left";
        }

        // ----------- CARDS -----------
        for (let i=0; i<compiledItems.length; i++) {
          if (!compiledItems[i].url) continue;
          const col = i % 3;
          const row = Math.floor(i / 3);
          const cardX = 280 + col * (colW + gap);
          const cardY = headerH + row * (cardH + gap);

          cCtx.shadowColor = dark ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.08)";
          cCtx.shadowBlur = 120;
          cCtx.shadowOffsetY = 60;

          const radius = 120;
          cCtx.fillStyle = cardBg;
          cCtx.beginPath();
          cCtx.moveTo(cardX + radius, cardY);
          cCtx.lineTo(cardX + colW - radius, cardY);
          cCtx.quadraticCurveTo(cardX + colW, cardY, cardX + colW, cardY + radius);
          cCtx.lineTo(cardX + colW, cardY + cardH - radius);
          cCtx.quadraticCurveTo(cardX + colW, cardY + cardH, cardX + colW - radius, cardY + cardH);
          cCtx.lineTo(cardX + radius, cardY + cardH);
          cCtx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
          cCtx.lineTo(cardX, cardY + radius);
          cCtx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
          cCtx.closePath();
          cCtx.fill();
          cCtx.shadowColor = "transparent";
          cCtx.strokeStyle = borderColor;
          cCtx.lineWidth = 6;
          cCtx.stroke();

          // Image
          const itemImg = new Image();
          if (compiledItems[i].url.startsWith("http")) {
            itemImg.crossOrigin = "anonymous"; // CRITICAL for Supabase images
          }
          
          await new Promise((resolve) => {
            itemImg.onload = resolve;
            itemImg.onerror = resolve; // Gracefully skip if chart is missing
            itemImg.src = compiledItems[i].url; // CRITICAL: Set src AFTER attaching handlers
          });

          if (!itemImg.width || itemImg.width === 0) {
            console.warn("Skipping broken catalog image:", compiledItems[i].url);
            continue; 
          }

          const imgBoxH = showPricingPanel ? 1740 : 1760;
          const imgAspect = itemImg.width / itemImg.height;
          const boxAspect = colW / imgBoxH;
          let drawW: number, drawH: number;
          const isChart = compiledItems[i].title.includes("Colors");
          const popScale = isChart ? 0.85 : 1.02; // Shrink charts to 85% to create padding inside the card
          if (imgAspect > boxAspect) { drawW = colW * popScale;
            drawH = (colW * popScale) / imgAspect; }
          else { drawH = imgBoxH * popScale;
            drawW = (imgBoxH * popScale) * imgAspect; }
          const offsetX = cardX + (colW - drawW) / 2;
          const offsetY = cardY + 40 + (imgBoxH - drawH) / 2;
          cCtx.drawImage(itemImg, offsetX, offsetY, drawW, drawH);
          // Divider
          cCtx.strokeStyle = borderColor;
          cCtx.beginPath();
          cCtx.moveTo(cardX + 100, cardY + imgBoxH);
          cCtx.lineTo(cardX + colW - 100, cardY + imgBoxH);
          cCtx.stroke();
          // Title
          cCtx.fillStyle = textColor;
          cCtx.font = "800 80px system-ui, -apple-system, sans-serif";
          cCtx.fillText(compiledItems[i].title, cardX + 100, cardY + imgBoxH + 160);
          // Subtitle
          cCtx.fillStyle = mutedColor;
          cCtx.font = "500 52px system-ui, -apple-system, sans-serif";
          cCtx.fillText(compiledItems[i].subtitle, cardX + 100, cardY + imgBoxH + 250);
          // Price row
          if (showPricingPanel && compiledItems[i].price) {
            const price = compiledItems[i].price!;
            const priceY = cardY + imgBoxH + 400;
            cCtx.fillStyle = mutedColor;
            cCtx.font = "700 44px system-ui, -apple-system, sans-serif";
            if (price.qty) cCtx.fillText(`QTY ${price.qty}`, cardX + 100, priceY);
            if (price.unit) {
              cCtx.fillStyle = textColor;
              cCtx.font = "900 64px system-ui, -apple-system, sans-serif";
              const unitText = `${price.unit} / PIECE`;
              cCtx.fillText(unitText, cardX + 100, priceY + 90);
            }
            if (price.total) {
              cCtx.textAlign = "right";
              cCtx.fillStyle = accentColor;
              cCtx.font = "900 72px system-ui, -apple-system, sans-serif";
              cCtx.fillText(price.total, cardX + colW - 100, priceY + 90);
              cCtx.fillStyle = mutedColor;
              cCtx.font = "700 40px system-ui, -apple-system, sans-serif";
              cCtx.fillText("TOTAL", cardX + colW - 100, priceY);
              cCtx.textAlign = "left";
            }
          }
        }

        // ----------- FOOTER -----------
        const footerY = headerH + rows * (cardH + gap);

        if (showPricingPanel) {
         // Totals block
          const ftOpts = ["tshirt","hoodie","polo","hat"] as const;
          let grandTotal = 0;
          ftOpts.forEach((k) => {
            const row = pricing[k];
            const n = parseFloat(row.qty) * parseFloat(row.unit.replace(/[^0-9.]/g,"") || "0");
            if (!isNaN(n)) grandTotal += n;
          });

          const panelX = 400, panelY = footerY + 80, panelW = W - 800, panelH = 640;
          cCtx.fillStyle = dark ? "#16161a" : "#ffffff";
          cCtx.shadowColor = dark ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.06)";
          cCtx.shadowBlur = 80;
          cCtx.shadowOffsetY = 40;
          cCtx.beginPath();
          cCtx.moveTo(panelX + 80, panelY);
          cCtx.lineTo(panelX + panelW - 80, panelY);
          cCtx.quadraticCurveTo(panelX + panelW, panelY, panelX + panelW, panelY + 80);
          cCtx.lineTo(panelX + panelW, panelY + panelH - 80);
          cCtx.quadraticCurveTo(panelX + panelW, panelY + panelH, panelX + panelW - 80, panelY + panelH);
          cCtx.lineTo(panelX + 80, panelY + panelH);
          cCtx.quadraticCurveTo(panelX, panelY + panelH, panelX, panelY + panelH - 80);
          cCtx.lineTo(panelX, panelY + 80);
          cCtx.quadraticCurveTo(panelX, panelY, panelX + 80, panelY);
          cCtx.closePath();
          cCtx.fill();
          cCtx.shadowColor = "transparent";
          cCtx.strokeStyle = borderColor;
          cCtx.lineWidth = 6;
          cCtx.stroke();

          cCtx.fillStyle = mutedColor;
          cCtx.font = "700 64px system-ui, -apple-system, sans-serif";
          cCtx.fillText("INVESTMENT SUMMARY", panelX + 120, panelY + 160);

          cCtx.fillStyle = textColor;
          cCtx.font = "900 180px system-ui, -apple-system, sans-serif";
          cCtx.fillText(fmtPrice(String(grandTotal)), panelX + 120, panelY + 380);

          cCtx.fillStyle = mutedColor;
          cCtx.font = "500 64px system-ui, -apple-system, sans-serif";
          const noteLines = quoteNotes.match(/.{1,70}(\s|$)/g) || [quoteNotes];
          noteLines.slice(0, 2).forEach((line, idx) => {
            cCtx.fillText(line.trim(), panelX + 120, panelY + 500 + idx * 76);
          });
        }

        // Bottom tagline
        cCtx.textAlign = "center";
        cCtx.fillStyle = textColor;
        cCtx.font = "800 90px system-ui, -apple-system, sans-serif";
        cCtx.fillText("READY TO ELEVATE YOUR BRAND? LET'S GET TO WORK.", W / 2, H - 240);
        cCtx.fillStyle = mutedColor;
        cCtx.font = "600 64px system-ui, -apple-system, sans-serif";
        cCtx.fillText("YAYA PRINTS  •  PREMIUM B2B APPAREL PRODUCTION", W / 2, H - 120);

        setCatalogUrl(catalogCanvas.toDataURL("image/jpeg", 0.98));
        showToast("Catalog ready", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Catalog generation failed", "error");
    }
    setProgress("");
    setIsProcessing(false);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadCurrentView = () => {
    const activeCanvas = activeTab === "front" ? fabricFrontRef.current : fabricBackRef.current;
    if (!activeCanvas) return;
    activeCanvas.getObjects().forEach((o: any) => { if (o.name?.startsWith("guide")) o.set("visible", false); });
    activeCanvas.discardActiveObject();
    activeCanvas.renderAll();
    const dataUrl = activeCanvas.toDataURL({ format:"jpeg", quality:1, multiplier:EXPORT_RESOLUTION_MULTIPLIER });
    activeCanvas.getObjects().forEach((o: any) => { if (o.name?.startsWith("guide")) o.set("visible", true); });
    activeCanvas.renderAll();
    downloadImage(dataUrl, `YAYA_${lockedColor.replace(/ /g,"_")}_${selectedGarment}_${activeTab}.jpg`);
showToast("Download started", "success");
  };

  // ─── PER-ITEM DOWNLOAD ────────────────────────────────────────────────────────
  // Renders a single catalog item (e.g. "Premium Tee • Front") onto a clean
  // white card with the order placeholder block beside it and a watermark in
  // the bottom-right. The watermark is positioned in the corner away from the
  // garment image so it never overlaps the actual product.
  const downloadSingleItem = async (item: CatalogItem) => {
    setProgress(`Preparing ${item.title}...`);
    setIsProcessing(true);
    try {
      // Load the garment image first so we know its aspect ratio
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Failed to load image"));
        img.src = item.url;
      });

      // Output canvas — fixed 4K-ish width for crisp prints. Tall portrait card.
      const W = 2400;
      const H = 3000;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      // ── Background: clean white ────────────────────────────────────────────
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // ── Top accent bar ─────────────────────────────────────────────────────
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(0, 0, W, 24);

      // ── Header row: brand mark + small subtitle ────────────────────────────
      ctx.textAlign = "left";
      ctx.fillStyle = "#0f172a";
      ctx.font = "italic 900 88px system-ui, -apple-system, sans-serif";
      ctx.fillText("YAYA PRINTS", 120, 200);
      ctx.fillStyle = "#64748b";
      ctx.font = "700 32px system-ui, -apple-system, sans-serif";
      ctx.letterSpacing = "4px";
      ctx.fillText("PRODUCT PROOF", 120, 248);

      // ── Garment image — centered horizontally, in the top portion ─────────
      // Reserve roughly the top 60% of the canvas for the garment, leaving the
      // bottom 40% for the order placeholder + watermark area (so watermark
      // never sits on top of the product).
      const imgAreaTop = 320;
      const imgAreaH = 1500;
      const imgAreaW = W - 240; // 120 padding each side

      // Fit-contain the garment into the area
      const ratio = Math.min(imgAreaW / img.width, imgAreaH / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const drawX = (W - drawW) / 2;
      const drawY = imgAreaTop + (imgAreaH - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // ── Item title block (sits between garment and details card) ───────────
      const titleY = imgAreaTop + imgAreaH + 100;
      ctx.textAlign = "center";
      ctx.fillStyle = "#0f172a";
      ctx.font = "italic 900 96px system-ui, -apple-system, sans-serif";
      ctx.fillText(item.title.toUpperCase(), W / 2, titleY);
      ctx.fillStyle = "#64748b";
      ctx.font = "600 36px system-ui, -apple-system, sans-serif";
      ctx.fillText(item.subtitle, W / 2, titleY + 64);

      // ── Order details placeholder card ─────────────────────────────────────
      const cardX = 200;
      const cardY = titleY + 140;
      const cardW = W - 400;
      const cardH = 540;
      // Card background
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 4;
      const r = 32;
      ctx.beginPath();
      ctx.moveTo(cardX + r, cardY);
      ctx.lineTo(cardX + cardW - r, cardY);
      ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
      ctx.lineTo(cardX + cardW, cardY + cardH - r);
      ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
      ctx.lineTo(cardX + r, cardY + cardH);
      ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
      ctx.lineTo(cardX, cardY + r);
      ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Card heading
      ctx.textAlign = "left";
      ctx.fillStyle = "#0ea5e9";
      ctx.font = "900 24px system-ui, -apple-system, sans-serif";
      ctx.fillText("ORDER DETAILS", cardX + 60, cardY + 70);

      // Resolve order metadata from the linked job (if any)
      const activeJob = jobsList.find((j) => j.id === selectedJobId);
      const customerName = activeJob?.quotes?.customers?.company_name || "VALUED CLIENT";
      const orderNumber = activeJob?.job_number ? `#${activeJob.job_number}` : "—";
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      // Two-column layout of label / value pairs
      type Row = { label: string; value: string };
      const rows: Row[] = [
        { label: "CLIENT",       value: customerName.toUpperCase() },
        { label: "ORDER",        value: orderNumber },
        { label: "GARMENT",      value: item.title },
        { label: "COLOR",        value: lockedColor },
        { label: "DATE",         value: dateStr },
      ];
      if (item.price && item.price.qty) {
        rows.push({ label: "QUANTITY", value: item.price.qty });
        if (item.price.unit) rows.push({ label: "UNIT PRICE", value: item.price.unit });
        if (item.price.total) rows.push({ label: "LINE TOTAL", value: item.price.total });
      }

      // Render rows in two columns
      const colCount = rows.length > 4 ? 2 : 1;
      const colW = (cardW - 120) / colCount;
      const rowsPerCol = Math.ceil(rows.length / colCount);
      const baseY = cardY + 130;
      const lineH = 70;
      rows.forEach((row, i) => {
        const col = Math.floor(i / rowsPerCol);
        const rowIdx = i % rowsPerCol;
        const x = cardX + 60 + col * colW;
        const y = baseY + rowIdx * lineH;
        ctx.fillStyle = "#94a3b8";
        ctx.font = "800 20px system-ui, -apple-system, sans-serif";
        ctx.fillText(row.label, x, y);
        ctx.fillStyle = "#0f172a";
        ctx.font = "700 30px system-ui, -apple-system, sans-serif";
        ctx.fillText(row.value, x, y + 36);
      });

      // ── Watermark ─────────────────────────────────────────────────────────
      // Bottom-right corner, well below the garment image so it doesn't cover
      // the product. Subtle so it doesn't fight the design.
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.textAlign = "right";
      ctx.fillStyle = "#0ea5e9";
      ctx.font = "italic 900 64px system-ui, -apple-system, sans-serif";
      ctx.fillText("YAYA PRINTS", W - 80, H - 80);
      ctx.globalAlpha = 0.08;
      ctx.font = "700 24px system-ui, -apple-system, sans-serif";
      ctx.fillText("yayaprints.com", W - 80, H - 40);
      ctx.restore();

      // ── Bottom accent bar ─────────────────────────────────────────────────
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(0, H - 12, W, 12);

      // ── Export ─────────────────────────────────────────────────────────────
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const safeTitle = item.title.replace(/[^a-z0-9]+/gi, "_");
      downloadImage(dataUrl, `YAYA_${lockedColor.replace(/ /g, "_")}_${safeTitle}.jpg`);
      showToast(`${item.title} downloaded`, "success");
    } catch (err) {
      console.error("Per-item download failed:", err);
      showToast("Failed to prepare item", "error");
    } finally {
      setProgress("");
      setIsProcessing(false);
    }
  };

  // ─── PER-GARMENT SET DOWNLOAD ─────────────────────────────────────────────────
  // Bundles a single garment's three views (Front, Back, Color Options) into one
  // nicely laid-out white-bg JPEG with header, order details, and a corner
  // watermark that doesn't sit over any of the product images.
  const downloadGarmentSet = async (priceKey: "tshirt" | "hoodie" | "polo" | "hat", garmentLabel: string) => {
    setProgress(`Preparing ${garmentLabel} set...`);
    setIsProcessing(true);
    try {
      // Pick the three items for this garment from the catalog
      const items = catalogItems.filter(i => i.priceKey === priceKey);
      if (items.length === 0) throw new Error("No items for this garment");
      // Find front, back, colors by their title suffix — order matters for layout
      const findBy = (suffix: string) => items.find(i => i.title.toLowerCase().endsWith(suffix.toLowerCase())) || null;
      const front  = findBy("Front");
      const back   = findBy("Back") || findBy("Side"); // Trucker uses "Side"
      const colors = findBy("Colors");

      // Load all three images (some may be missing — handled gracefully)
      const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => res(im);
        im.onerror = () => rej(new Error("Failed to load: " + src));
        im.src = src;
      });
      const [frontImg, backImg, colorsImg] = await Promise.all([
        front  ? loadImg(front.url)  : Promise.resolve(null),
        back   ? loadImg(back.url)   : Promise.resolve(null),
        colors ? loadImg(colors.url) : Promise.resolve(null),
      ]);

      // ── Canvas setup — landscape 4K-ish, leaves bottom strip for details ──
      const W = 3200;
      const H = 4400;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Top accent bar
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(0, 0, W, 24);

      // ── Header ─────────────────────────────────────────────────────────────
      ctx.textAlign = "left";
      ctx.fillStyle = "#0f172a";
      ctx.font = "italic 900 110px system-ui, -apple-system, sans-serif";
      ctx.fillText("YAYA PRINTS", 140, 240);
      ctx.fillStyle = "#64748b";
      ctx.font = "700 38px system-ui, -apple-system, sans-serif";
      ctx.fillText("PRODUCT SET", 140, 296);

      ctx.textAlign = "right";
      ctx.fillStyle = "#0f172a";
      ctx.font = "italic 900 80px system-ui, -apple-system, sans-serif";
      ctx.fillText(garmentLabel.toUpperCase(), W - 140, 240);
      ctx.fillStyle = "#64748b";
      ctx.font = "600 36px system-ui, -apple-system, sans-serif";
      ctx.fillText(lockedColor, W - 140, 290);

      // ── Top row: Front + Back side-by-side ────────────────────────────────
      const topY = 380;
      const topH = 1900;
      const halfW = (W - 140 * 2 - 60) / 2; // 60px gap between, 140 padding sides
      const drawInBox = (img: HTMLImageElement | null, bx: number, by: number, bw: number, bh: number, label: string) => {
        // Light card behind it
        ctx.fillStyle = "#f8fafc";
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 4;
        ctx.beginPath();
        const r = 36;
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + bw - r, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
        ctx.lineTo(bx + bw, by + bh - r);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
        ctx.lineTo(bx + r, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (img) {
          // Fit-contain inside the box with inner padding
          const padding = 60;
          const innerW = bw - padding * 2;
          const innerH = bh - padding * 2 - 80; // leave room for label at bottom
          const ratio = Math.min(innerW / img.width, innerH / img.height);
          const drawW = img.width * ratio;
          const drawH = img.height * ratio;
          const drawX = bx + (bw - drawW) / 2;
          const drawY = by + padding + (innerH - drawH) / 2;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }

        // Label at bottom of box
        ctx.textAlign = "center";
        ctx.fillStyle = "#0f172a";
        ctx.font = "900 34px system-ui, -apple-system, sans-serif";
        ctx.fillText(label.toUpperCase(), bx + bw / 2, by + bh - 30);
      };

      drawInBox(frontImg, 140,                topY, halfW, topH, "Front View");
      drawInBox(backImg,  140 + halfW + 60,   topY, halfW, topH, back?.title.endsWith("Side") ? "Side View" : "Back View");

      // ── Color options strip — full width below ────────────────────────────
      const colorsY = topY + topH + 80;
      const colorsH = 1100;
      const colorsW = W - 140 * 2;

      // Card behind colors
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 4;
      const cr = 36;
      const cx = 140, cy = colorsY, cw = colorsW, ch = colorsH;
      ctx.beginPath();
      ctx.moveTo(cx + cr, cy);
      ctx.lineTo(cx + cw - cr, cy);
      ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + cr);
      ctx.lineTo(cx + cw, cy + ch - cr);
      ctx.quadraticCurveTo(cx + cw, cy + ch, cx + cw - cr, cy + ch);
      ctx.lineTo(cx + cr, cy + ch);
      ctx.quadraticCurveTo(cx, cy + ch, cx, cy + ch - cr);
      ctx.lineTo(cx, cy + cr);
      ctx.quadraticCurveTo(cx, cy, cx + cr, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (colorsImg) {
        const padding = 60;
        const innerW = cw - padding * 2;
        const innerH = ch - padding * 2 - 80;
        const ratio = Math.min(innerW / colorsImg.width, innerH / colorsImg.height);
        const drawW = colorsImg.width * ratio;
        const drawH = colorsImg.height * ratio;
        const drawX = cx + (cw - drawW) / 2;
        const drawY = cy + padding + (innerH - drawH) / 2;
        ctx.drawImage(colorsImg, drawX, drawY, drawW, drawH);
      }
      ctx.textAlign = "center";
      ctx.fillStyle = "#0f172a";
      ctx.font = "900 34px system-ui, -apple-system, sans-serif";
      ctx.fillText("AVAILABLE COLOR OPTIONS", cx + cw / 2, cy + ch - 30);

      // ── Footer order details strip ────────────────────────────────────────
      const activeJob = jobsList.find((j) => j.id === selectedJobId);
      const customerName = activeJob?.quotes?.customers?.company_name || "VALUED CLIENT";
      const orderNumber  = activeJob?.job_number ? `#${activeJob.job_number}` : "—";
      const dateStr      = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      const footerY = colorsY + colorsH + 60;
      // Left side — labels
      ctx.textAlign = "left";
      const fxL = 140;
      const fyL = footerY + 60;
      const drawPair = (label: string, value: string, x: number, y: number) => {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "800 22px system-ui, -apple-system, sans-serif";
        ctx.fillText(label, x, y);
        ctx.fillStyle = "#0f172a";
        ctx.font = "700 32px system-ui, -apple-system, sans-serif";
        ctx.fillText(value, x, y + 38);
      };
      drawPair("CLIENT",  customerName.toUpperCase(),     fxL,         fyL);
      drawPair("ORDER",   orderNumber,                    fxL + 850,   fyL);
      drawPair("COLOR",   lockedColor,                    fxL + 1450,  fyL);
      drawPair("DATE",    dateStr,                        fxL + 2050,  fyL);

      // ── Watermark — bottom-right corner, small + subtle ──────────────────
      // Sits in the empty footer area, never over the product images.
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.textAlign = "right";
      ctx.fillStyle = "#0ea5e9";
      ctx.font = "italic 900 64px system-ui, -apple-system, sans-serif";
      ctx.fillText("YAYA PRINTS", W - 140, H - 90);
      ctx.globalAlpha = 0.08;
      ctx.font = "700 24px system-ui, -apple-system, sans-serif";
      ctx.fillText("yayaprints.com", W - 140, H - 50);
      ctx.restore();

      // Bottom accent bar
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(0, H - 14, W, 14);

      // ── Export ─────────────────────────────────────────────────────────────
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      downloadImage(dataUrl, `YAYA_${lockedColor.replace(/ /g, "_")}_${garmentLabel.replace(/ /g, "_")}_Set.jpg`);
      showToast(`${garmentLabel} set downloaded`, "success");
    } catch (err) {
      console.error("Set download failed:", err);
      showToast("Failed to prepare set", "error");
    } finally {
      setProgress("");
      setIsProcessing(false);
    }
  };

  const downloadAsPDF = async () => {
    if (!catalogUrl) return;
    setProgress("Packaging PDF Document...");
    setIsProcessing(true);
    try {
      if (!(window as any).jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const { jsPDF } = (window as any).jspdf;
      const img = new Image();
      img.src = catalogUrl;
      await new Promise(r => img.onload = r);
      
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [img.width, img.height] });
      pdf.addImage(catalogUrl, "JPEG", 0, 0, img.width, img.height);
      pdf.save(`YAYA_${lockedColor.replace(/ /g, "_")}_Catalog.pdf`);
      showToast("PDF downloaded successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to generate PDF", "error");
    }
    setProgress("");
    setIsProcessing(false);
  };

  // ------------------------ SAVE TO ORDER (UPGRADED APPROVAL FLOW) ------------------------
  const saveToOrder = async () => {
    if (!selectedJobId) { showToast("Please select an order first", "error"); return; }
    setIsSavingToOrder(true); setProgress("Preparing Presentation for Cloud...");
    try {
      const toggleGuides = (canvas: fabric.Canvas, visible: boolean) => {
        canvas.getObjects().forEach((o: any) => { if (o.name?.startsWith("guide")) o.set("visible", visible); });
        canvas.discardActiveObject(); canvas.renderAll();
      };
      if (fabricFrontRef.current) toggleGuides(fabricFrontRef.current, false);
      if (fabricBackRef.current) toggleGuides(fabricBackRef.current, false);

      const WEB_MULTIPLIER = 2;
      setProgress("Rendering T-Shirt...");  const tf = await buildOfflineScene("tshirt_64000","front", undefined, WEB_MULTIPLIER);
      const tb = await buildOfflineScene("tshirt_64000","back", undefined, WEB_MULTIPLIER);
      setProgress("Rendering Hoodie...");   const hf = await buildOfflineScene("hoodie_18500","front", undefined, WEB_MULTIPLIER); const hb = await buildOfflineScene("hoodie_18500","back", undefined, WEB_MULTIPLIER);
      setProgress("Rendering Polo...");     const pf = await buildOfflineScene("polo_8800","front", undefined, WEB_MULTIPLIER); const pb = await buildOfflineScene("polo_8800","back", undefined, WEB_MULTIPLIER);
      setProgress("Rendering Hat...");      const hatF = await buildOfflineScene("hat_6506","front", undefined, WEB_MULTIPLIER);   const hatB = await buildOfflineScene("hat_6506","back", undefined, WEB_MULTIPLIER);

      const compiledItems = [
        { url: tf,   title:"T-Shirt • Front View" }, { url: tb, title:"T-Shirt • Back View" },
        { url: hf,   title:"Hoodie • Front View" },  { url: hb, title:"Hoodie • Back View" },
        { url: pf,   title:"Polo • Front View" },    { url: pb, title:"Polo • Back View" },
        { url: hatF, title:"Trucker Hat • Front Center" }, { url: hatB, title:"Trucker Hat • Side Panel" }
      ];

      setProgress("Uploading High-Res files to cloud...");
      const uploadedUrls: {title:string, url:string}[] = [];
      for (const item of compiledItems) {
        if (item.url && item.url.length > 100) {
          try {
            // FIX: Bypass Fetch & Blob limits entirely by passing base64 string directly to ImgBB
            const base64Data = item.url.split(",")[1];
            const formData = new FormData();
            formData.append("image", base64Data);
            formData.append("key", IMGBB_API_KEY);
            formData.append("name", `YAYA-${item.title.replace(/[^a-zA-Z0-9]/g,"")}-${selectedJobId}`);

            const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
            const result = await response.json();

            if (result.success) {
              uploadedUrls.push({ title: item.title, url: result.data.url });
            } else {
              console.warn(`ImgBB rejected ${item.title}:`, result.error?.message);
            }
          } catch (uploadErr) {
            console.error(`Failed to upload ${item.title}:`, uploadErr);
          }
        }
      }

      if (fabricFrontRef.current) toggleGuides(fabricFrontRef.current, true);
      if (fabricBackRef.current) toggleGuides(fabricBackRef.current, true);

      if (uploadedUrls.length === 0) {
        throw new Error("Upload failed. If EXPORT_RESOLUTION_MULTIPLIER is 12, the files are too large for ImgBB (32MB limit). Try lowering it to 4.");
      }

      setProgress("Saving to database...");
      const generateMagicLink = () => Math.random().toString(36).substring(2,8) + Math.random().toString(36).substring(2,8);
      const newProofLinkId = generateMagicLink();

      const activeJob = jobsList.find((j) => j.id === selectedJobId);
      // Safe fallback if the quote or customer record doesn't exist
      const safeCustomerName = activeJob?.quotes ? (activeJob.quotes.customers?.company_name || "Client") : "Client";

      // Accurately map the URLs to the specific database columns required by the Portal UI
      const frontMockupUrl = uploadedUrls.find(u => u.title.includes("Front"))?.url || null;
      const backMockupUrl = uploadedUrls.find(u => u.title.includes("Back"))?.url || null;

      const updateData: any = {
        proof_link_id: newProofLinkId,
        design_proof: JSON.stringify(uploadedUrls),
        front_view: frontMockupUrl,
        front_mockup: frontMockupUrl, // Explicitly feed the Portal's artwork viewer
        back_mockup: backMockupUrl,   // Explicitly feed the Portal's artwork viewer
        proof_status: "pending_approval",
        proof_sent_at: new Date().toISOString(),
      };
      
      if (showPricingPanel) {
        updateData.proof_pricing = JSON.stringify({
          pricing, notes: quoteNotes, validDays: quoteValidDays
        });
      }

      const { error } = await supabase.from("jobs").update(updateData).eq("id", selectedJobId);
      if (error) throw error;

      const clientUrl = `${window.location.origin}/proof/${newProofLinkId}`;
      setApprovalLinkData({
        url: clientUrl,
        jobTitle: activeJob?.title || `Job #${activeJob?.job_number || ""}`,
        customer: safeCustomerName
      });
      setShowApprovalModal(true);
    } catch (err: any) {
      console.error("Save to order error:", err);
      showToast("Failed to save: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSavingToOrder(false);
      setProgress("");
    }
  };

  const copyApprovalLink = async () => {
    if (!approvalLinkData) return;
    try {
      await navigator.clipboard.writeText(approvalLinkData.url);
      showToast("Link copied to clipboard", "success");
    } catch {
      showToast("Couldn't copy — select the link manually", "error");
    }
  };

  const sendApprovalEmail = () => {
    if (!approvalLinkData) return;
    const subject = encodeURIComponent(`Your design proof is ready — ${approvalLinkData.jobTitle}`);
    const body = encodeURIComponent(
`Hi ${approvalLinkData.customer},

Your custom apparel proof is ready for review. Please take a look and let us know if everything looks perfect or if you'd like any changes:

${approvalLinkData.url}

This link lets you approve the design or request changes directly — no account needed.

Let me know if you have any questions!

Best,
Yaya Prints Team`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const activeFrontZones = printZonesRef.current[selectedGarment]?.front || {};
  const activeBackZones = printZonesRef.current[selectedGarment]?.back || {};
  const hasAnyLogo = !!(frontLogoUrl || backLogoUrl || uploadedDesigns.length > 0);
  const activeLogoUrl = activeTab === "front" ? frontLogoUrl : backLogoUrl;
  const activeLogoScale = activeTab === "front" ? frontScale : backScale;

  return (
    <div 
      className={`min-h-screen ${t.bgMain} ${t.textMain} font-sans flex flex-col selection:bg-sky-500 selection:text-white transition-colors duration-300`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* FULL-SCREEN PROCESSING OVERLAY */}
      {isProcessing && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute inset-0 border-4 border-sky-500/20 rounded-full w-24 h-24 animate-ping"></div>
            <svg className="animate-spin h-16 w-16 text-sky-500 relative z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg mb-4 text-center px-4">
            GENERATING 4K CATALOG
          </h2>
          <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-full px-6 py-3 shadow-xl">
            <p className="text-sm font-black text-sky-400 uppercase tracking-[0.2em] animate-pulse m-0">
              {progress || "Processing..."}
            </p>
          </div>
        </div>
      )}

      {/* GLOBAL DRAG OVERLAY */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-[999] bg-sky-500/90 backdrop-blur-md flex flex-col items-center justify-center m-4 rounded-[3rem] border-4 border-white/40 border-dashed animate-in fade-in duration-200 pointer-events-none shadow-[0_0_100px_rgba(14,165,233,0.5)]">
          <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-2xl backdrop-blur-xl border border-white/30">
            <svg className="w-16 h-16 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
          </div>
          <h2 className="text-5xl font-black uppercase italic tracking-tighter text-white drop-shadow-lg mb-2">Drop it like it's hot</h2>
          <p className="text-sm font-bold text-white/90 uppercase tracking-widest drop-shadow">Release to instantly upload your design</p>
        </div>
      )}

      {/* HEADER */}
      <div className={`border-b ${t.border} ${t.bgPanel} px-4 md:px-6 py-3 flex justify-between items-center z-50 shrink-0 sticky top-0 transition-colors duration-300`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => { initialJobId ? router.push("/jobs") : router.back(); }}
            className={`${t.textMuted} hover:opacity-80 transition-colors text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1`}
          >
            ← Return
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-md">Y</div>
            <h1 className={`text-lg font-black uppercase tracking-tighter leading-none italic ${t.textStrong}`}>YAYA PRINTS</h1>
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${t.bgInset} ${t.textMuted} border ${t.border}`}>Studio</span>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-black uppercase tracking-widest ${t.textMuted} px-2.5 py-1.5 rounded-md transition-colors`}>
            <input type="checkbox" checked={magicErase} onChange={(e) => setMagicErase(e.target.checked)} className="accent-sky-500 w-3 h-3" />
            Magic Erase
          </label>
          <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-black uppercase tracking-widest ${realisticBlend ? "text-sky-500" : t.textMuted} px-2.5 py-1.5 rounded-md transition-colors`}>
            <input type="checkbox" checked={realisticBlend} onChange={(e) => setRealisticBlend(e.target.checked)} className="accent-sky-500 w-3 h-3" />
            Realistic
          </label>
          <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-black uppercase tracking-widest ${enableWatermark ? "text-rose-500" : t.textMuted} px-2.5 py-1.5 rounded-md transition-colors`}>
            <input type="checkbox" checked={enableWatermark} onChange={(e) => setEnableWatermark(e.target.checked)} className="accent-rose-500 w-3 h-3" />
            🔒 Protect
          </label>
          <div className={`h-5 w-px ${t.border}`}></div>
          <button onClick={() => setShowShortcuts(true)} className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-md transition-colors ${t.textMuted} hover:${t.bgInset}`} title="Keyboard shortcuts (?)">⌨</button>
          <button onClick={toggleTheme} className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-md transition-colors ${t.textMuted} hover:${t.bgInset}`}>
            {isLightMode ? "☀" : "☾"}
          </button>
          <button onClick={() => setAdminMode(!adminMode)} className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-md transition-colors ${adminMode ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/50" : `${t.textMuted} hover:${t.bgInset}`}`}>
            {adminMode ? "● Admin" : "Admin"}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-grow overflow-hidden">

        {/* LEFT SIDEBAR */}
        <div className={`w-full md:w-[400px] ${t.bgSubPanel} border-r ${t.border} flex flex-col shrink-0 z-40 relative shadow-xl h-full transition-colors duration-300`}>

          {/* Product category tabs (Apparel | Print) + product picker */}
          <div className={`p-4 border-b ${t.border} shrink-0`}>
            {/* Top: category switcher */}
            <div className={`flex gap-1 p-1 ${t.bgInset} rounded-xl border ${t.border} mb-2`}>
              <button
                onClick={() => { if (isPrintProduct(selectedGarment)) handleGarmentChange("tshirt_64000"); }}
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!isPrintProduct(selectedGarment) ? t.garmentBtnActive : `${t.textMuted} hover:opacity-80`}`}
              >
                Apparel
              </button>
              <button
                onClick={() => { if (!isPrintProduct(selectedGarment)) handleGarmentChange("business_card"); }}
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isPrintProduct(selectedGarment) ? t.garmentBtnActive : `${t.textMuted} hover:opacity-80`}`}
              >
                Print
              </button>
            </div>

            {/* Bottom: product picker — different list per category */}
            {!isPrintProduct(selectedGarment) ? (
              <div className={`flex gap-1 p-1 ${t.bgInset} rounded-xl border ${t.border}`}>
                {GARMENT_TYPES.map((g) => {
                  const IconC = (Icon as any)[g.iconKey];
                  return (
                    <button
                      key={g.id}
                      onClick={() => handleGarmentChange(g.id)}
                      className={`flex-1 py-2.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1.5 ${selectedGarment === g.id ? t.garmentBtnActive : `${t.textMuted} hover:opacity-80`}`}
                    >
                      <IconC width={20} height={20} />
                      <span>{g.short}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {PRINT_PRODUCTS.map((p) => {
                  const IconC = (Icon as any)[p.iconKey];
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleGarmentChange(p.id)}
                      title={p.name}
                      className={`py-2.5 px-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1.5 border ${selectedGarment === p.id ? t.garmentBtnActive : `${t.textMuted} ${t.bgInset} ${t.border} hover:opacity-80`}`}
                    >
                      <IconC width={18} height={18} />
                      <span className="leading-tight">{p.short}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sticker shape picker — only when a sticker product is active */}
            {selectedGarment === "sticker_3x3" && (
              <div className={`mt-2 p-2 ${t.bgInset} rounded-xl border ${t.border}`}>
                <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-1.5`}>Die-Cut Shape</div>
                <div className="grid grid-cols-3 gap-1">
                  {STICKER_SHAPES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStickerShape(s.id as any)}
                      className={`py-1.5 px-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 border ${stickerShape === s.id ? t.garmentBtnActive : `${t.textMuted} ${t.border} hover:opacity-80`}`}
                    >
                      <ShapePreview shape={s.id} size={18} />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Color / paper-stock picker */}
          <div className={`p-4 border-b ${t.border} shrink-0`}>
            <div className="flex justify-between items-center mb-2">
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>
                {isPrintProduct(selectedGarment) ? "Paper Stock" : "Garment Color"}
              </span>
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded shadow-sm border ${t.colorBadge} flex items-center gap-1.5`}>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={
                    isPrintProduct(selectedGarment)
                      ? { background: PAPER_STOCKS.find(s => s.id === displayColor)?.hex || "#eee", border: "1px solid rgba(0,0,0,0.15)" }
                      : getSwatchStyle(displayColor)
                  }
                />
                {displayColor}
              </span>
            </div>
            <input
              type="text"
              value={colorSearchQuery}
              onChange={(e) => setColorSearchQuery(e.target.value)}
              placeholder={isPrintProduct(selectedGarment) ? "Search stocks..." : "Search colors..."}
              className={`w-full text-[10px] font-semibold px-3 py-1.5 rounded-lg outline-none border ${t.bgInput} mb-2 focus:border-sky-500`}
            />
            {isPrintProduct(selectedGarment) ? (
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {activeColorList.map((stockId) => {
                  const stock = PAPER_STOCKS.find(s => s.id === stockId);
                  if (!stock) return null;
                  const active = lockedColor === stockId;
                  return (
                    <button
                      key={stockId}
                      onClick={() => setLockedColor(stockId)}
                      title={stock.label}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left transition-all ${active ? `ring-2 ring-sky-500 ${t.bgInput}` : `${t.bgInset} ${t.border} hover:opacity-80`}`}
                    >
                      <span
                        className="w-4 h-4 rounded shrink-0 shadow-inner"
                        style={{ background: stock.hex, border: "1px solid rgba(0,0,0,0.15)" }}
                      />
                      <span className={`text-[9px] font-black uppercase tracking-tight truncate ${active ? t.textStrong : t.textMuted}`}>
                        {stock.label}
                      </span>
                    </button>
                  );
                })}
                {activeColorList.length === 0 && (
                  <div className={`col-span-2 py-3 text-center text-[9px] ${t.textMuted}`}>No stocks match</div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-1.5 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                {activeColorList.map((c) => (
                  <button
                    key={c}
                    onClick={() => setLockedColor(c)}
                    title={c}
                    className={`w-6 h-6 rounded-full shadow-sm transition-all hover:scale-110 flex-shrink-0 ${lockedColor === c ? `ring-2 ring-offset-2 ${t.ringOffset} ring-sky-500 scale-110` : ""}`}
                    style={getSwatchStyle(c)}
                  />
                ))}
                {activeColorList.length === 0 && (
                  <div className={`col-span-8 py-3 text-center text-[9px] ${t.textMuted}`}>No colors match</div>
                )}
              </div>
            )}
          </div>

          {/* Design library */}
          <div className={`px-4 pt-3 pb-3 border-b ${t.border} shrink-0 flex flex-col`}>
            <div className="flex justify-between items-center mb-2">
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>Design Library</span>
              <span className={`text-[8px] font-bold uppercase ${t.textMuted}`}>Drop to canvas</span>
            </div>
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
              <label className={`w-14 h-14 shrink-0 border-2 border-dashed ${t.uploadBox} rounded-xl cursor-pointer flex flex-col items-center justify-center transition-all group hover:border-sky-500`} title="Upload Image or PDF">
                <span className="text-lg font-black text-zinc-400 group-hover:text-sky-500 transition-colors">+</span>
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
              </label>
              {uploadedDesigns.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => handleLibraryClick(url)}
                  className="relative w-14 h-14 shrink-0 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden group cursor-pointer hover:border-sky-500 transition-colors shadow-sm bg-white"
                >
                  <img src={url} className="w-full h-full object-contain p-1" alt="design" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedDesigns((prev) => prev.filter((_, i) => i !== idx)); }}
                    className="absolute top-0 right-0 bg-red-500/90 hover:bg-red-500 text-white w-4 h-4 text-[10px] font-black flex items-center justify-center rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                  >×</button>
                </div>
              ))}
            </div>

            <div className={`mt-3 pt-3 border-t ${t.border} flex flex-col gap-3`}>
              <div className="flex justify-between items-center">
                <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>Typography Engine</span>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddText()}
                  placeholder="Type your text..."
                  className={`flex-1 text-[10px] font-bold px-2 py-1.5 rounded outline-none border ${t.bgInput} focus:border-sky-500`}
                />
                <button onClick={handleAddText} disabled={!customText.trim()} className="bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 px-3 rounded text-[9px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all">Add</button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select value={textFont} onChange={(e) => setTextFont(e.target.value)} className={`col-span-2 text-[10px] font-bold px-1 rounded outline-none border ${t.bgInput}`}>
                  {FONT_OPTIONS.map(f => <option key={f.name} value={f.value}>{f.name}</option>)}
                </select>
                <div className="flex gap-1 items-center justify-end">
                  <label className="flex flex-col items-center" title="Text Color">
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                    <span className={`text-[6px] font-bold uppercase ${t.textMuted} mt-0.5`}>Fill</span>
                  </label>
                  <label className="flex flex-col items-center" title="Outline Color">
                    <input type="color" value={textStrokeColor} onChange={(e) => setTextStrokeColor(e.target.value)} className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                    <span className={`text-[6px] font-bold uppercase ${t.textMuted} mt-0.5`}>Strk</span>
                  </label>
                </div>
              </div>

              <div className={`p-2 rounded-lg border ${t.border} ${t.bgInset} space-y-2`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-black uppercase tracking-widest w-12 ${t.textMuted}`}>Outline</span>
                  <input type="range" min="0" max="10" value={textStrokeWidth} onChange={(e) => setTextStrokeWidth(Number(e.target.value))} className={`flex-1 h-1.5 ${t.rangeTrack} rounded-lg appearance-none accent-sky-500`} />
                  <span className={`text-[8px] font-bold w-4 text-right ${t.textStrong}`}>{textStrokeWidth}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-black uppercase tracking-widest w-12 ${t.textMuted}`}>Curve</span>
                  <input type="range" min="-120" max="120" value={textCurve} onChange={(e) => setTextCurve(Number(e.target.value))} className={`flex-1 h-1.5 ${t.rangeTrack} rounded-lg appearance-none accent-sky-500`} />
                  <span className={`text-[8px] font-bold w-4 text-right ${t.textStrong}`}>{textCurve}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={`flex ${t.tabBar} border-b ${t.border} shrink-0`}>
            <button onClick={() => { setActiveTab("front"); setPreviewSide("front"); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === "front" ? `text-sky-500 border-b-2 border-sky-500 ${t.tabActive}` : `${t.textMuted} hover:opacity-80`}`}>Front Design</button>
            <button onClick={() => { setActiveTab("back"); setPreviewSide("back"); }} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === "back" ? `text-sky-500 border-b-2 border-sky-500 ${t.tabActive}` : `${t.textMuted} hover:opacity-80`}`}>Back Design</button>
          </div>

          {/* Tab content */}
          <div className="p-4 flex-grow overflow-y-auto custom-scrollbar">
            {/* ============== REBUILT: VISUAL PRESET PICKER + PLACEMENT CONTROLS ============== */}
            {activeTab === "front" && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                <div>
                  <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Placement</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handlePresetClick("front","No Print")}
                      className={`py-3 px-2 text-[8px] font-black uppercase tracking-widest rounded-xl border-2 transition-all flex flex-col items-center ${activeFrontPreset === "No Print" ? t.btnPresetActive : t.btnPresetInactive}`}
                    >
                      <ZonePreviewIcon preset="No Print" active={activeFrontPreset === "No Print"} />
                      No Print
                    </button>
                    {Object.keys(activeFrontZones).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handlePresetClick("front", preset)}
                        className={`py-3 px-2 text-[8px] font-black uppercase tracking-widest rounded-xl border-2 transition-all flex flex-col items-center ${activeFrontPreset === preset ? t.btnPresetActive : t.btnPresetInactive}`}
                      >
                        <ZonePreviewIcon preset={preset} active={activeFrontPreset === preset} />
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {frontLogoUrl && (
                  <div className={`${t.bgInset} p-3 rounded-xl border ${t.border} space-y-3`}>
                    {/* Scale */}
                    <div>
                      <div className={`flex justify-between text-[9px] font-black ${t.textMuted} uppercase tracking-widest mb-2`}>
                        <span>Scale</span>
                        <span className={t.textStrong}>{Math.round(frontScale)}%</span>
                      </div>
                      <input
                        type="range" min="5" max="80" value={frontScale}
                        onChange={(e) => { setFrontScale(Number(e.target.value)); setActiveFrontPreset("Custom"); }}
                        className={`w-full h-1.5 ${t.rangeTrack} rounded-lg appearance-none accent-sky-500`}
                      />
                      <div className="flex gap-1 mt-2">
                        <button onClick={() => setFrontScale(Math.max(5, frontScale - 5))} className={`flex-1 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>− Smaller</button>
                        <button onClick={() => fitToZone("front")} className={`flex-1 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>Fit Zone</button>
                        <button onClick={() => setFrontScale(Math.min(80, frontScale + 5))} className={`flex-1 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>+ Bigger</button>
                      </div>
                    </div>

                    {/* Position */}
                    <div>
                      <div className={`flex justify-between text-[9px] font-black ${t.textMuted} uppercase tracking-widest mb-2`}>
                        <span>Position</span>
                        <span className={t.textStrong}>{Math.round(frontX)}% · {Math.round(frontY)}%</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="grid grid-cols-3 gap-1 w-[108px]">
                          <div></div>
                          <button onClick={() => nudge("front","up")} className={`py-1.5 rounded text-xs border ${t.nudgeBtn}`}>↑</button>
                          <div></div>
                          <button onClick={() => nudge("front","left")} className={`py-1.5 rounded text-xs border ${t.nudgeBtn}`}>←</button>
                          <button onClick={() => centerInZone("front","both")} className={`py-1.5 rounded text-[9px] font-black border ${t.nudgeBtn}`} title="Center in zone">●</button>
                          <button onClick={() => nudge("front","right")} className={`py-1.5 rounded text-xs border ${t.nudgeBtn}`}>→</button>
                          <div></div>
                          <button onClick={() => nudge("front","down")} className={`py-1.5 rounded text-xs border ${t.nudgeBtn}`}>↓</button>
                          <div></div>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <button onClick={() => centerInZone("front","h")} className={`py-1.5 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>Center H</button>
                          <button onClick={() => centerInZone("front","v")} className={`py-1.5 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>Center V</button>
                          <button onClick={() => resetToPreset("front")} className={`py-1.5 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>Reset</button>
                        </div>
                      </div>
                    </div>

                    {/* BG Color Removal + Clear */}
                    <div className="flex items-center gap-2 pt-2 border-t border-dashed border-zinc-300 dark:border-zinc-700">
                      <input type="color" value={frontTargetColor} onChange={(e) => setFrontTargetColor(e.target.value)} className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer shrink-0" title="Pick color to erase from design" />
                      <button onClick={() => handleRemoveActiveLogoBg("front")} className="flex-[2] py-2 bg-indigo-100 dark:bg-indigo-900/30 rounded text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors shadow-sm active:scale-95">Erase Color</button>
                      <button onClick={() => clearLogo("front")} className="flex-1 py-2 bg-red-100 dark:bg-red-900/30 rounded text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-colors shadow-sm active:scale-95">Clear</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "back" && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                <div>
                  <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Placement</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handlePresetClick("back","No Print")}
                      className={`py-3 px-2 text-[8px] font-black uppercase tracking-widest rounded-xl border-2 transition-all flex flex-col items-center ${activeBackPreset === "No Print" ? t.btnPresetActive : t.btnPresetInactive}`}
                    >
                      <ZonePreviewIcon preset="No Print" active={activeBackPreset === "No Print"} />
                      No Print
                    </button>
                    {Object.keys(activeBackZones).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handlePresetClick("back", preset)}
                        className={`py-3 px-2 text-[8px] font-black uppercase tracking-widest rounded-xl border-2 transition-all flex flex-col items-center ${activeBackPreset === preset ? t.btnPresetActive : t.btnPresetInactive}`}
                      >
                        <ZonePreviewIcon preset={preset} active={activeBackPreset === preset} />
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {backLogoUrl && backScale > 0 && (
                  <div className={`${t.bgInset} p-3 rounded-xl border ${t.border} space-y-3`}>
                    <div>
                      <div className={`flex justify-between text-[9px] font-black ${t.textMuted} uppercase tracking-widest mb-2`}>
                        <span>Scale</span>
                        <span className={t.textStrong}>{Math.round(backScale)}%</span>
                      </div>
                      <input type="range" min="5" max="80" value={backScale} onChange={(e) => { setBackScale(Number(e.target.value)); setActiveBackPreset("Custom"); }} className={`w-full h-1.5 ${t.rangeTrack} rounded-lg appearance-none accent-sky-500`} />
                      <div className="flex gap-1 mt-2">
                        <button onClick={() => setBackScale(Math.max(5, backScale - 5))} className={`flex-1 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>− Smaller</button>
                        <button onClick={() => fitToZone("back")} className={`flex-1 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>Fit Zone</button>
                        <button onClick={() => setBackScale(Math.min(80, backScale + 5))} className={`flex-1 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>+ Bigger</button>
                      </div>
                    </div>

                    <div>
                      <div className={`flex justify-between text-[9px] font-black ${t.textMuted} uppercase tracking-widest mb-2`}>
                        <span>Position</span>
                        <span className={t.textStrong}>{Math.round(backX)}% · {Math.round(backY)}%</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="grid grid-cols-3 gap-1 w-[108px]">
                          <div></div>
                          <button onClick={() => nudge("back","up")} className={`py-1.5 rounded text-xs border ${t.nudgeBtn}`}>↑</button>
                          <div></div>
                          <button onClick={() => nudge("back","left")} className={`py-1.5 rounded text-xs border ${t.nudgeBtn}`}>←</button>
                          <button onClick={() => centerInZone("back","both")} className={`py-1.5 rounded text-[9px] font-black border ${t.nudgeBtn}`}>●</button>
                          <button onClick={() => nudge("back","right")} className={`py-1.5 rounded text-xs border ${t.nudgeBtn}`}>→</button>
                          <div></div>
                          <button onClick={() => nudge("back","down")} className={`py-1.5 rounded text-xs border ${t.nudgeBtn}`}>↓</button>
                          <div></div>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <button onClick={() => centerInZone("back","h")} className={`py-1.5 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>Center H</button>
                          <button onClick={() => centerInZone("back","v")} className={`py-1.5 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>Center V</button>
                          <button onClick={() => resetToPreset("back")} className={`py-1.5 rounded text-[8px] font-black uppercase tracking-widest border ${t.nudgeBtn}`}>Reset</button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-dashed border-zinc-300 dark:border-zinc-700">
                      <input type="color" value={backTargetColor} onChange={(e) => setBackTargetColor(e.target.value)} className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer shrink-0" />
                      <button onClick={() => handleRemoveActiveLogoBg("back")} className="flex-[2] py-2 bg-indigo-100 dark:bg-indigo-900/30 rounded text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors shadow-sm active:scale-95">Erase Color</button>
                      <button onClick={() => clearLogo("back")} className="flex-1 py-2 bg-red-100 dark:bg-red-900/30 rounded text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-colors shadow-sm active:scale-95">Clear</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ORDER / CATALOG FOOTER */}
          <div className={`p-4 border-t ${t.border} ${t.bgInset} shrink-0`}>
            <h3 className="text-[9px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-2">Link Mockup to Order</h3>
            <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className={`w-full border rounded-lg px-3 py-2 outline-none mb-3 focus:border-sky-500 font-bold text-xs ${t.bgInput}`}>
              <option value="">-- Select an Active Job --</option>
              {jobsList.map((job) => (<option key={job.id} value={job.id}>#{job.job_number} - {job.quotes?.customers?.company_name || job.title}</option>))}
            </select>

            <div className="flex gap-2 mb-2">
              <button onClick={() => setCatalogTheme("Light")} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${catalogTheme === "Light" ? t.btnPresetActive : t.btnPresetInactive}`}>☀ Light</button>
              <button onClick={() => setCatalogTheme("Dark")} className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${catalogTheme === "Dark" ? t.btnPresetActive : t.btnPresetInactive}`}>☾ Dark</button>
            </div>

            <button onClick={() => setShowPricingPanel(!showPricingPanel)} className={`w-full mb-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${showPricingPanel ? "bg-emerald-600 text-white border-emerald-600" : t.btnPresetInactive}`}>
              {showPricingPanel ? "✓ Pricing Enabled" : "💰 Add Pricing to Catalog"}
            </button>

            {showPricingPanel && (
              <div className={`${t.bgCard} border ${t.border} rounded-lg p-3 mb-3 space-y-2`}>
                {(["tshirt","hoodie","polo","hat"] as const).map((k) => (
                  <div key={k} className="grid grid-cols-4 gap-1 items-center">
                    <span className={`text-[9px] font-black uppercase ${t.textMuted} col-span-1`}>
                      {k === "tshirt" ? "👕 Tee" : k === "hoodie" ? "🧥 Hood" : k === "polo" ? "👕 Polo" : "🧢 Hat"}
                    </span>
                    <input type="text" placeholder="Qty" value={pricing[k].qty} onChange={(e) => setPricing({...pricing, [k]: {...pricing[k], qty: e.target.value}})} className={`text-[10px] font-bold px-2 py-1 rounded border ${t.bgInput}`} />
                    <input type="text" placeholder="$/pc" value={pricing[k].unit} onChange={(e) => setPricing({...pricing, [k]: {...pricing[k], unit: e.target.value}})} className={`text-[10px] font-bold px-2 py-1 rounded border ${t.bgInput}`} />
                    <input type="text" placeholder="Total" value={pricing[k].total} onChange={(e) => setPricing({...pricing, [k]: {...pricing[k], total: e.target.value}})} className={`text-[10px] font-bold px-2 py-1 rounded border ${t.bgInput}`} />
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-1 items-center pt-1">
                  <span className={`text-[9px] font-black uppercase ${t.textMuted}`}>Valid</span>
                  <input type="text" value={quoteValidDays} onChange={(e) => setQuoteValidDays(e.target.value)} className={`text-[10px] font-bold px-2 py-1 rounded border ${t.bgInput}`} />
                  <span className={`text-[9px] font-black uppercase ${t.textMuted}`}>days</span>
                </div>
                <textarea value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} placeholder="Quote notes shown on catalog..." rows={2} className={`w-full text-[10px] font-semibold px-2 py-1 rounded border ${t.bgInput}`} />
              </div>
            )}

            <div className="flex gap-2 mb-2">
              <button onClick={downloadCurrentView} disabled={isProcessing || !hasAnyLogo}
                className={`flex-1 py-2.5 rounded-lg font-black uppercase text-[8px] tracking-widest transition-all shadow-sm ${isProcessing || !hasAnyLogo ? t.disabledBtn : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                📸 Quick View
              </button>
              <button onClick={generateMasterCatalog} disabled={isProcessing || !hasAnyLogo}
                className={`flex-1 py-2.5 rounded-lg font-black uppercase text-[8px] tracking-widest transition-all shadow-sm ${isProcessing || !hasAnyLogo ? t.disabledBtn : "bg-sky-600 hover:bg-sky-500 text-white hover:-translate-y-0.5"}`}>
                {isProcessing ? "Rendering..." : "4K Catalog"}
              </button>
            </div>

            <button onClick={saveToOrder} disabled={!selectedJobId || isSavingToOrder || !hasAnyLogo}
              className={`w-full py-3 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all shadow-md ${(!selectedJobId || isSavingToOrder || !hasAnyLogo) ? t.disabledBtn : "bg-emerald-600 hover:bg-emerald-500 text-white hover:-translate-y-0.5 shadow-emerald-500/20"}`}>
              {isSavingToOrder ? "Saving..." : "✉ Send Proof to Client"}
            </button>
            {progress && <div className="text-center text-[8px] font-black uppercase tracking-widest text-emerald-500 animate-pulse mt-2">{progress}</div>}
          </div>
        </div>

        {/* RIGHT STAGE */}
        <div className={`flex-grow ${t.bgStage} relative p-4 md:p-8 overflow-y-auto custom-scrollbar flex flex-col items-center justify-start transition-colors duration-300`}>

          <div className={`w-full h-full flex flex-col items-center ${catalogUrl ? "hidden" : ""}`}>
            {/* Live placement hint & Dimension Ruler */}
            {activeLogoUrl && activeLogoScale > 0 && (
              <div className={`mb-4 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${t.bgCard} border ${t.border} ${t.textMuted} shadow-sm flex flex-wrap justify-center items-center gap-3`}>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                  {activeTab === "front" ? activeFrontPreset : activeBackPreset}
                </span>
                <span className={t.border + " border-l h-4"}></span>
                <span className="text-sky-500 flex items-center gap-1.5" title="Estimated Physical Print Width">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                  {((activeLogoScale / 100) * 14).toFixed(1)}" W
                </span>
                <span className={t.border + " border-l h-4"}></span>
                <span>{Math.round(activeLogoScale)}% Scale</span>
                <span className={t.border + " border-l h-4 hidden md:block"}></span>
                <span className={`${t.textMuted} hidden md:block`}>Drag on canvas • arrows to nudge</span>
              </div>
            )}

            <div
              className="flex flex-col xl:flex-row w-full justify-center items-center h-full pb-10"
              style={{ gap: "calc(-300px * 0.45 * 2)" }}
              style={{
                // Smaller overall scale + push everything up and slightly left.
                // - scale ceiling lowered to 0.85 (was 1.20)
                // - justify-content: flex-start nudges content left
                // - align-items: flex-start nudges content up
                // - negative top margin pulls the whole row up further
                // - this is where the size and the left and right of the canvas is
                ["--mockup-scale" as string]: "0.80",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                paddingLeft: "0rem",
                paddingRight: "73rem",
                paddingTop: "0",
                marginTop: "0rem",
              } as React.CSSProperties}
            >
              <div
                className="flex flex-col items-center relative group transition-all"
                style={{
                  // Scale from the *center* (was top), so when the canvas grows or
                  // shrinks it stays anchored to the layout center vertically. This
                  // is what fixes the "everything is too low" issue on large screens.
                  transformOrigin: "center center",
                  transform: "scale(var(--mockup-scale))",
                  // Compensating margins ONLY pull inward when the canvas is scaled
                  // DOWN (scale < 1). Once scale >= 1 they're clamped to 0 — never
                  // negative-becomes-positive, never push the canvas around.
                  marginBottom: "max(-200px, calc(-100px * (1 - var(--mockup-scale))))",
                  marginLeft:   "max(0px, calc(-300px * (1 - var(--mockup-scale))))",
                  marginRight:  "max(-500px, calc(-400px * (1 - var(--mockup-scale))))",
                }}
                onClick={() => { setPreviewSide("front"); setActiveTab("front"); }}
              >
                <div className={`absolute -top-6 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === "front" ? "text-sky-500" : t.textMuted}`}>Front View</div>
                <div className={`rounded-2xl overflow-hidden ${t.shadow} border-2 transition-all duration-300 cursor-pointer ${activeTab === "front" ? t.canvasBorderActive : t.canvasBorderInactive}`}>
                  <canvas ref={frontCanvasRef} />
                </div>
              </div>
              <div
                className="flex flex-col items-center relative group transition-all"
                style={{
                  transformOrigin: "center center",
                  transform: "scale(var(--mockup-scale))",
                  marginBottom: "max(-200px, calc(-100px * (1 - var(--mockup-scale))))",
                  marginLeft:   "max(0px, calc(-400px * (1 - var(--mockup-scale))))",
                  marginRight:  "max(-200px, calc(-300px * (1 - var(--mockup-scale))))",
                }}
                onClick={() => { setPreviewSide("back"); setActiveTab("back"); }}
              >
                <div className={`absolute -top-6 text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === "back" ? "text-sky-500" : t.textMuted}`}>Back View</div>
                <div className={`rounded-2xl overflow-hidden ${t.shadow} border-2 transition-all duration-300 cursor-pointer ${activeTab === "back" ? t.canvasBorderActive : t.canvasBorderInactive}`}>
                  <canvas ref={backCanvasRef} />
                </div>
              </div>
            </div>
            {adminMode && (
              <div className={`absolute bottom-8 left-8 right-8 ${t.adminTerminalBg} border border-emerald-500/30 rounded-xl p-4 backdrop-blur-md shadow-2xl z-50`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">● Admin Calibration Mode Active</span>
                  <span className={`text-[9px] ${t.textMuted} uppercase tracking-widest`}>SHIFT+Click | CMD+C/V | BACKSPACE</span>
                </div>
                <textarea readOnly value={adminConfigOutput || "Select, move, resize a green box to generate config..."} className={`w-full h-32 ${t.adminTextareaBg} text-emerald-600 font-mono text-[10px] p-3 rounded-lg border border-emerald-500/50 focus:outline-none custom-scrollbar`} />
              </div>
            )}
          </div>

          {/* CATALOG VIEW */}
          {catalogUrl && (
            <div className="w-full max-w-5xl animate-in fade-in zoom-in-95 duration-500 pt-4">
              <div className="flex justify-between items-end mb-8">
                <h3 className={`text-2xl font-black uppercase tracking-tighter italic border-b-4 border-sky-500 pb-2 ${t.textStrong}`}>Master Presentation</h3>
                <div className="flex gap-3">
                  <button onClick={() => setCatalogUrl(null)} className={`px-5 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all ${t.btnPresetInactive}`}>← Edit</button>
                  <button onClick={() => downloadImage(catalogUrl, `YAYA_${lockedColor.replace(/ /g,"_")}_Catalog.jpg`)} className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all shadow-md shadow-sky-500/20">Download JPEG</button>
                  <button onClick={downloadAsPDF} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-black uppercase text-[9px] tracking-widest transition-all shadow-md shadow-emerald-500/20">Download PDF</button>
                </div>
              </div>
              <div className={`p-3 rounded-2xl border shadow-xl mb-8 ${catalogTheme === "Light" ? "bg-white border-zinc-200" : "bg-[#09090b] border-zinc-800"}`}>
                <img src={catalogUrl} alt="Master Catalog" className="w-full h-auto rounded-xl" />
              </div>

              {/* GARMENT SET DOWNLOADS — bundles Front + Back + Color Options into
                  one nicely laid-out file per garment. */}
              {catalogItems.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <h4 className={`text-lg font-black uppercase tracking-tighter italic ${t.textStrong}`}>Garment Sets</h4>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} mt-1`}>
                        Download a full set: Front + Back + Color Options in one file
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {([
                      { key: "tshirt" as const, label: "Premium Tee",  icon: "👕" },
                      { key: "hoodie" as const, label: "Heavy Hoodie", icon: "🧥" },
                      { key: "polo"   as const, label: "Polo",         icon: "👔" },
                      { key: "hat"    as const, label: "Trucker",      icon: "🧢" },
                    ]).map(g => (
                      <button
                        key={g.key}
                        onClick={() => downloadGarmentSet(g.key, g.label)}
                        disabled={isProcessing}
                        className={`group relative rounded-xl border-2 transition-all overflow-hidden text-left disabled:opacity-50 disabled:cursor-not-allowed p-4 flex items-center gap-3 ${
                          catalogTheme === "Light"
                            ? "bg-white border-zinc-200 hover:border-emerald-500 hover:shadow-lg"
                            : "bg-[#09090b] border-zinc-800 hover:border-emerald-500"
                        }`}
                      >
                        <div className="text-3xl shrink-0">{g.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[12px] font-black uppercase tracking-tight truncate ${t.textStrong}`}>{g.label} Set</div>
                          <div className={`text-[9px] font-bold uppercase tracking-widest truncate mt-0.5 ${t.textMuted}`}>
                            Front + Back + Colors
                          </div>
                        </div>
                        <div className="text-emerald-500 shrink-0 text-xl group-hover:scale-125 transition-transform">⬇</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* INDIVIDUAL ITEM DOWNLOADS — click any item to download a clean
                  white-bg, watermarked single-item proof with order details. */}
              {catalogItems.length > 0 && (
                <div className="mb-16">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <h4 className={`text-lg font-black uppercase tracking-tighter italic ${t.textStrong}`}>Individual Items</h4>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} mt-1`}>
                        Click any item to download a single-item proof
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {catalogItems.map((item, idx) => (
                      <button
                        key={`${item.title}-${idx}`}
                        onClick={() => downloadSingleItem(item)}
                        disabled={isProcessing}
                        title={`Download ${item.title}`}
                        className={`group relative rounded-xl border-2 transition-all overflow-hidden text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                          catalogTheme === "Light"
                            ? "bg-white border-zinc-200 hover:border-sky-500 hover:shadow-lg"
                            : "bg-[#09090b] border-zinc-800 hover:border-sky-500"
                        }`}
                      >
                        {/* Image */}
                        <div className={`aspect-square w-full flex items-center justify-center p-2 ${catalogTheme === "Light" ? "bg-zinc-50" : "bg-[#0f0f12]"}`}>
                          <img src={item.url} alt={item.title} className="max-w-full max-h-full object-contain" />
                        </div>
                        {/* Hover download overlay */}
                        <div className="absolute inset-0 bg-sky-500/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white pointer-events-none">
                          <div className="text-3xl mb-1">⬇</div>
                          <div className="text-[9px] font-black uppercase tracking-widest">Download</div>
                        </div>
                        {/* Caption */}
                        <div className="px-2.5 py-2 border-t border-zinc-200 dark:border-zinc-800">
                          <div className={`text-[10px] font-black uppercase tracking-tight truncate ${t.textStrong}`}>{item.title}</div>
                          <div className={`text-[8px] font-bold uppercase tracking-widest truncate mt-0.5 ${t.textMuted}`}>
                            {item.price && item.price.qty ? `${item.price.qty} pcs` : "Tap to export"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BG REMOVAL MODAL */}
      {showBgRemovalModal && pendingUploadUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200" onClick={() => { if (!progress) setShowBgRemovalModal(false); }}>
          <div className={`${t.bgPanel} border ${t.border} rounded-[2rem] w-full max-w-4xl p-8 shadow-2xl relative text-center`} onClick={(e) => e.stopPropagation()}>
            <h2 className={`text-2xl font-black uppercase italic tracking-tighter leading-none mb-2 ${t.textStrong}`}>WOULD YOU LIKE TO REMOVE THE BACKGROUND?</h2>
            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} mb-8`}>How should we process the background for this uploaded file?</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {/* Card 1: Global */}
              <button onClick={() => handleBgChoice("global")} disabled={!!progress} className={`flex flex-col rounded-2xl border-2 ${t.border} hover:border-indigo-500 transition-all overflow-hidden group text-left ${t.bgCard}`}>
                <div className="h-32 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTVlN2ViIi8+PHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2U1ZTdlYiIvPjwvc3ZnPg==')] flex items-center justify-center relative">
                   <div className="absolute inset-0 bg-white/40 group-hover:bg-transparent transition-all"></div>
                   <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg relative z-10 group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                   </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className={`font-black text-sm uppercase tracking-widest mb-1 ${t.textStrong}`}>Erase All White</h3>
                  <p className={`text-[10px] uppercase font-bold text-indigo-500 mb-3`}>Best for simple logos</p>
                  <p className={`text-xs ${t.textMuted} font-medium leading-relaxed`}>Makes all white pixels transparent. Perfect for black graphics on a white square.</p>
                </div>
              </button>

              {/* Card 2: Edge */}
              <button onClick={() => handleBgChoice("edge")} disabled={!!progress} className={`flex flex-col rounded-2xl border-2 ${t.border} hover:border-sky-500 transition-all overflow-hidden group text-left ${t.bgCard}`}>
                <div className="h-32 w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZTVlN2ViIi8+PHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2U1ZTdlYiIvPjwvc3ZnPg==')] flex items-center justify-center relative">
                   <div className="absolute inset-0 bg-white/40 group-hover:bg-transparent transition-all"></div>
                   <div className="w-16 h-16 bg-white rounded-lg border-2 border-dashed border-zinc-400 flex items-center justify-center shadow-lg relative z-10 group-hover:scale-110 transition-transform">
                      <svg className="w-7 h-7 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"></path></svg>
                   </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className={`font-black text-sm uppercase tracking-widest mb-1 ${t.textStrong}`}>Trim Edges Only</h3>
                  <p className={`text-[10px] uppercase font-bold text-sky-500 mb-3`}>Prevents transparent text</p>
                  <p className={`text-xs ${t.textMuted} font-medium leading-relaxed`}>Only removes white around the outside of your shape. Recommended if your design has white text or parts.</p>
                </div>
              </button>

              {/* Card 3: None */}
              <button onClick={() => handleBgChoice("none")} disabled={!!progress} className={`flex flex-col rounded-2xl border-2 ${t.border} hover:border-emerald-500 transition-all overflow-hidden group text-left ${t.bgCard}`}>
                <div className="h-32 w-full bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center relative border-b border-zinc-200 dark:border-zinc-700">
                   <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-sm flex items-center justify-center shadow-md relative z-10 group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                   </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className={`font-black text-sm uppercase tracking-widest mb-1 ${t.textStrong}`}>Keep Original</h3>
                  <p className={`text-[10px] uppercase font-bold text-emerald-500 mb-3`}>Use exactly as uploaded</p>
                  <p className={`text-xs ${t.textMuted} font-medium leading-relaxed`}>Do not make any changes to the background. Print it with the white square visible.</p>
                </div>
              </button>
            </div>
            
            {progress && (
              <div className="mt-6 inline-flex items-center gap-3 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-6 py-3 rounded-full font-black uppercase text-xs tracking-widest animate-pulse">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                {progress}
              </div>
            )}
            
            <button onClick={() => setShowBgRemovalModal(false)} className={`mt-6 text-[10px] font-black uppercase tracking-widest ${t.textMuted} hover:text-zinc-400 transition-colors`}>
              Cancel / Close
            </button>
          </div>
        </div>
      )}

      {/* SMART BACK MODAL */}
      {showBackDesignModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200" onClick={() => setShowBackDesignModal(false)}>
          <div className={`${t.bgPanel} border ${t.border} rounded-[2rem] w-full max-w-4xl p-8 shadow-2xl relative text-center`} onClick={(e) => e.stopPropagation()}>
            <div className="inline-block bg-sky-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-4 shadow-md shadow-sky-500/20">STEP 2 OF 2</div>
            <h2 className={`text-3xl md:text-4xl font-black uppercase italic tracking-tighter leading-none mb-3 ${t.textStrong}`}>NOW FOR THE BACK</h2>
            <p className={`text-xs font-black uppercase tracking-widest text-sky-500 mb-8`}>Your front logo is set. What are we printing on the back?</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {/* Card 1: Same Logo */}
              <button onClick={handleSameBackLogo} className={`flex flex-col rounded-2xl border-2 ${t.border} hover:border-sky-500 transition-all overflow-hidden group text-left ${t.bgCard}`}>
                <div className="h-32 w-full bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center relative border-b border-sky-100 dark:border-sky-900/50">
                   <div className="flex items-center gap-2 relative z-10 group-hover:scale-110 transition-transform">
                     {/* Front Shirt Icon (Deep Neck) */}
                     <svg className="w-10 h-10 text-sky-500 drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M 7.5 3 C 7.5 3 9.5 5.5 12 5.5 C 14.5 5.5 16.5 3 16.5 3 L 21 7.5 L 18 10.5 L 17.5 10 L 17.5 20 A 1 1 0 0 1 16.5 21 L 7.5 21 A 1 1 0 0 1 6.5 20 L 6.5 10 L 6 10.5 L 3 7.5 L 7.5 3 Z" fill="currentColor" fillOpacity="0.1"/>
                        <circle cx="12" cy="11.5" r="1.5" fill="currentColor"/>
                     </svg>
                     {/* Sync/Arrow */}
                     <svg className="w-6 h-6 text-sky-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 12h14"></path></svg>
                     {/* Back Shirt Icon (High Neck) */}
                     <svg className="w-12 h-12 text-sky-600 drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M 7.5 3 C 7.5 3 9.5 3.8 12 3.8 C 14.5 3.8 16.5 3 16.5 3 L 21 7.5 L 18 10.5 L 17.5 10 L 17.5 20 A 1 1 0 0 1 16.5 21 L 7.5 21 A 1 1 0 0 1 6.5 20 L 6.5 10 L 6 10.5 L 3 7.5 L 7.5 3 Z" fill="currentColor" fillOpacity="0.1"/>
                        <rect x="9" y="10" width="6" height="7" rx="1" fill="currentColor"/>
                     </svg>
                   </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className={`font-black text-sm uppercase tracking-widest mb-1 ${t.textStrong}`}>Use Same Logo For Back</h3>
                  <p className={`text-[10px] uppercase font-bold text-sky-500 mb-3`}>Quick & Easy</p>
                  <p className={`text-xs ${t.textMuted} font-medium leading-relaxed`}>We will automatically take your front design and apply it directly to the center back.</p>
                </div>
              </button>

              {/* Card 2: Upload New */}
              <label className={`flex flex-col rounded-2xl border-2 ${t.border} hover:border-indigo-500 transition-all overflow-hidden group text-left cursor-pointer ${t.bgCard}`}>
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleUploadNewBackLogo} />
                <div className="h-32 w-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center relative border-b border-indigo-100 dark:border-indigo-900/50">
                   <div className="relative group-hover:scale-110 transition-transform">
                     {/* Back Shirt Outline (High Neck) */}
                     <svg className="w-16 h-16 text-indigo-300 dark:text-indigo-700 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M 7.5 3 C 7.5 3 9.5 3.8 12 3.8 C 14.5 3.8 16.5 3 16.5 3 L 21 7.5 L 18 10.5 L 17.5 10 L 17.5 20 A 1 1 0 0 1 16.5 21 L 7.5 21 A 1 1 0 0 1 6.5 20 L 6.5 10 L 6 10.5 L 3 7.5 L 7.5 3 Z" fill="currentColor" fillOpacity="0.05"/>
                     </svg>
                     {/* Upload Icon Overlay */}
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-indigo-500 rounded-full p-2 shadow-lg -mt-1">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        </div>
                     </div>
                   </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className={`font-black text-sm uppercase tracking-widest mb-1 ${t.textStrong}`}>Upload New Logo For Back</h3>
                  <p className={`text-[10px] uppercase font-bold text-indigo-500 mb-3`}>Custom Back Design</p>
                  <p className={`text-xs ${t.textMuted} font-medium leading-relaxed`}>Have a specific graphic just for the back? Upload a new image or PDF file here.</p>
                </div>
              </label>

              {/* Card 3: No Print */}
              <button onClick={handleNoBackPrint} className={`flex flex-col rounded-2xl border-2 ${t.border} hover:border-zinc-400 transition-all overflow-hidden group text-left ${t.bgCard}`}>
                <div className="h-32 w-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center relative border-b border-zinc-200 dark:border-zinc-700">
                   <div className="relative group-hover:scale-110 transition-transform">
                     {/* Blank Back Shirt Outline (High Neck) */}
                     <svg className="w-16 h-16 text-zinc-300 dark:text-zinc-600 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M 7.5 3 C 7.5 3 9.5 3.8 12 3.8 C 14.5 3.8 16.5 3 16.5 3 L 21 7.5 L 18 10.5 L 17.5 10 L 17.5 20 A 1 1 0 0 1 16.5 21 L 7.5 21 A 1 1 0 0 1 6.5 20 L 6.5 10 L 6 10.5 L 3 7.5 L 7.5 3 Z" fill="currentColor" fillOpacity="0.05"/>
                     </svg>
                     {/* Dashed blank square in middle */}
                     <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-6 h-8 border-2 border-dashed border-zinc-400 dark:border-zinc-500 rounded-sm opacity-50 mt-1"></div>
                     </div>
                   </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className={`font-black text-sm uppercase tracking-widest mb-1 ${t.textStrong}`}>No Back Print</h3>
                  <p className={`text-[10px] uppercase font-bold text-zinc-500 mb-3`}>Front Print Only</p>
                  <p className={`text-xs ${t.textMuted} font-medium leading-relaxed`}>Leave the back completely blank. You can always change your mind and add one later.</p>
                </div>
              </button>
            </div>
            
            <button onClick={() => setShowBackDesignModal(false)} className={`mt-8 text-[10px] font-black uppercase tracking-widest ${t.textMuted} hover:text-zinc-400 transition-colors`}>
              Cancel / Close
            </button>
          </div>
        </div>
      )}

      {/* CLIENT APPROVAL MODAL - NEW */}
      {showApprovalModal && approvalLinkData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className={`${t.bgPanel} border ${t.border} rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative`}>
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className={`text-2xl font-black uppercase italic tracking-tighter leading-none mb-1 text-center ${t.textStrong}`}>Proof Ready to Send</h2>
            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted} mb-6 text-center`}>Client can approve or request changes instantly</p>

            <div className={`${t.bgInset} border ${t.border} rounded-xl p-4 mb-4`}>
              <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-1`}>Recipient</div>
              <div className={`font-black text-sm ${t.textStrong} mb-3`}>{approvalLinkData.customer}</div>
              <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-1`}>Project</div>
              <div className={`font-bold text-xs ${t.textMain} mb-3`}>{approvalLinkData.jobTitle}</div>
              <div className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-1`}>Approval Link</div>
              <div className={`font-mono text-[10px] ${t.textStrong} break-all p-2 rounded ${t.bgCard} border ${t.border}`}>{approvalLinkData.url}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={copyApprovalLink} className={`py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${t.btnPresetInactive}`}>
                📋 Copy Link
              </button>
              <button onClick={sendApprovalEmail} className="py-3 rounded-xl font-black uppercase text-[10px] tracking-widest bg-sky-600 hover:bg-sky-500 text-white transition-all active:scale-95">
                ✉ Open in Email
              </button>
            </div>

            <button onClick={() => { window.open(approvalLinkData.url, "_blank"); }} className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${t.btnPresetInactive} mb-3`}>
              Preview as Client →
            </button>

            <button onClick={() => {
              setShowApprovalModal(false);
              if (initialJobId) router.push("/jobs");
            }} className={`w-full py-2 rounded-xl font-black uppercase text-[9px] tracking-widest ${t.textMuted} hover:${t.bgInset} transition-colors`}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* KEYBOARD SHORTCUTS MODAL */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200" onClick={() => setShowShortcuts(false)}>
          <div className={`${t.bgPanel} border ${t.border} rounded-3xl w-full max-w-lg p-8 shadow-2xl relative`} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowShortcuts(false)} className={`absolute top-4 right-4 w-8 h-8 rounded-full ${t.textMuted} hover:${t.bgInset} flex items-center justify-center transition-colors`}>×</button>
            <h2 className={`text-2xl font-black uppercase italic tracking-tighter leading-none mb-6 ${t.textStrong}`}>Keyboard Shortcuts</h2>
            <div className="space-y-2">
              {[
                ["↑↓←→", "Nudge selected design 1px"],
                ["Shift + ↑↓←→", "Nudge 10px"],
                ["Backspace / Delete", "Remove selected design"],
                ["Tab", "Switch Front ↔ Back"],
                ["?", "Show/hide this"],
                ["Enter (in text field)", "Add custom text"],
                ["Ctrl/Cmd + C (Admin)", "Copy selected zone"],
                ["Ctrl/Cmd + V (Admin)", "Paste zone"],
              ].map(([key, desc]) => (
                <div key={key} className={`flex items-center justify-between py-2 px-3 rounded-lg ${t.bgInset}`}>
                  <code className={`text-[11px] font-black px-2 py-1 rounded ${t.bgCard} border ${t.border} ${t.textStrong}`}>{key}</code>
                  <span className={`text-xs font-semibold ${t.textMain}`}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300 ${
          toast.type === "success" ? "bg-emerald-600" :
          toast.type === "error" ? "bg-rose-600" : "bg-zinc-900"
        } text-white px-5 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2`}>
          {toast.type === "success" && <span>✓</span>}
          {toast.type === "error" && <span>!</span>}
          <span>{toast.msg}</span>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.5); }
      `}</style>
    </div>
  );
}

export default function AutomatedMockupGeneratorV10() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#0f1115] flex items-center justify-center font-black text-sky-500 tracking-widest uppercase animate-pulse text-sm">Loading Mockup Studio...</div>}>
      <MockupGeneratorInner />
    </Suspense>
  );
}