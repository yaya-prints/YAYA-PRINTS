"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function YayaCustomizerIntegration() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================================
  // PASTE YOUR ENTIRE HTML FILE INSIDE THESE BACKTICKS (``)
  // I have included the beginning of your file to show you exactly how it sits.
  // Make sure to paste the WHOLE thing, from <!DOCTYPE html> to </html>.
  // ============================================================================
  const customizerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>YAYA Customizer</title>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet">

<style>
:root { 
  --primary-grad: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --nav-grad: linear-gradient(180deg, #24243e 0%, #302b63 50%, #24243e 100%);
  --accent-pop: #ff0080;
  --vibrant-grad: linear-gradient(to right, #fa709a 0%, #fee140 100%);
  --action-red-grad: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  --glass: rgba(255, 255, 255, 0.95);
  --shadow-lg: 0 20px 50px rgba(0,0,0,0.3);
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

/* ANIMATED BACKGROUND */
body { 
  margin: 0; padding: 0; 
  background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
  background-size: 400% 400%;
  animation: gradientBG 15s ease infinite;
  font-family: 'Poppins', sans-serif; 
  height: 100vh; width: 100vw; overflow: hidden;
  display: flex; align-items: center; justify-content: center; 
}

@keyframes gradientBG {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* LAYOUT - MAXIMIZED */
#studio-app { 
  display: grid; grid-template-columns: 100px 380px 1fr; 
  width: 96vw; height: 92vh; 
  background: #fff; border-radius: 24px; 
  box-shadow: var(--shadow-lg);
  overflow: hidden; color: #333; position: relative; 
  border: 1px solid rgba(255,255,255,0.4);
}

@media (max-width: 1024px) {
  #studio-app { 
    display: flex; flex-direction: column; 
    width: 100%; height: 100%; border-radius: 0; 
    overflow: hidden; 
  }
  #studio-nav { 
    flex-direction: row !important; 
    height: 85px !important; 
    padding: 0 20px; 
    justify-content: space-between; 
    align-items: center; 
    width:100%; order: 1; flex-shrink: 0;
  }
  #studio-stage { 
    order: 2; 
    flex-grow: 1; 
    height: auto !important; 
    min-height: 0; 
    padding: 10px !important;
    align-items: center !important; 
    justify-content: center !important; 
    display: flex !important;
  }
  #studio-controls { 
    order: 3; 
    height: 40vh; 
    width:100%; 
    border-right: none; border-top: 1px solid #eee; 
    padding: 20px 20px 20px 20px !important; 
    overflow-y: auto;
    flex-shrink: 0;
    z-index: 20; 
    background: #fff;
  }
}

/* NAV */
#studio-nav { 
  background: var(--nav-grad); 
  display: flex; flex-direction: column; align-items: center; padding-top: 5px; gap: 35px; z-index: 10; 
  box-shadow: 5px 0 15px rgba(0,0,0,0.1);
}
.nav-btn { background: transparent; border: none; color: rgba(255,255,255,0.5); cursor: pointer; display: flex; flex-direction: column; align-items: center; font-size: 11px; gap: 8px; font-weight: 600; transition: 0.3s; }
.nav-btn:hover { color: #fff; transform: scale(1.1); }
.nav-btn.active { color: #fff; position: relative; }
.nav-btn.active i { color: var(--accent-pop); text-shadow: 0 0 10px rgba(255,0,128,0.5); }
.nav-btn.active::after { content: ''; width: 4px; height: 100%; background: var(--accent-pop); position: absolute; right: -20px; border-radius: 2px 0 0 2px; }
@media (max-width: 1024px) {
    .nav-btn.active::after { bottom: -10px; right: 0; width: 100%; height: 4px; border-radius: 2px 2px 0 0; top: auto; }
}
.nav-btn i { font-size: 30px; }

/* CONTROLS */
#studio-controls { 
  background: #fff; border-right: 1px solid #f0f0f0; padding: 30px; 
  overflow-y: auto; display: flex; flex-direction: column; gap: 30px; 
  position: relative;
}

.panel-section h4 { 
  font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; 
  color: #fff; margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px;
  background: var(--primary-grad); padding: 12px 18px; border-radius: 12px; 
  box-shadow: 0 5px 15px -5px rgba(102, 126, 234, 0.5); 
}
.panel-section h4::before { display: none; } 

#area-buttons .btn { text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }

.btn { 
  width: 100%; padding: 16px; border: 2px solid #f3f4f6; background: #fff; 
  border-radius: 16px; cursor: pointer; font-weight: 700; font-size: 14px; font-family: 'Poppins', sans-serif;
  display: flex; align-items: center; justify-content: center; gap: 10px; 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); color: #4b5563;
}
.btn:hover { background: #f9fafb; border-color: #667eea; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.05); }

.btn-primary { 
  background: var(--primary-grad); color: #fff; border: none; 
  box-shadow: 0 10px 20px -5px rgba(102, 126, 234, 0.5);
}
.btn-primary:hover { background: linear-gradient(135deg, #764ba2 0%, #667eea 100%); transform: translateY(-3px); box-shadow: 0 15px 25px -5px rgba(102, 126, 234, 0.6); }

.btn-action-red {
  background: var(--action-red-grad); color: #fff; border: none; 
  box-shadow: 0 10px 20px -5px rgba(239, 68, 68, 0.5);
}
.btn-action-red:hover {
  background: linear-gradient(135deg, #b91c1c 0%, #ef4444 100%);
  transform: translateY(-3px); box-shadow: 0 15px 25px -5px rgba(239, 68, 68, 0.6);
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; filter: grayscale(1); transform: none; box-shadow: none; }

.side-input { width: 100%; padding: 14px; border: 2px solid #f3f4f6; border-radius: 12px; font-size: 14px; background: #f9fafb; margin-bottom: 8px; font-family: 'Poppins', sans-serif; color: #333; transition: 0.2s; }
.side-input:focus { border-color: #667eea; outline: none; background: #fff; box-shadow: 0 0 0 4px rgba(102,126,234,0.1); }
.side-label { font-size: 11px; font-weight: 800; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.5px; }

.size-grid-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px; }
.size-box { display: flex; flex-direction: column; align-items: center; }
.size-header { font-size: 12px; font-weight: 800; color: #4b5563; margin-bottom: 4px; }
.qty-input-small {
    width: 100%; padding: 8px 0; text-align: center;
    border: 2px solid #e5e7eb; border-radius: 8px;
    font-size: 13px; font-weight: 600; color: #333;
    transition: 0.2s;
}
.qty-input-small:focus { border-color: #667eea; outline: none; background: #fff; }
.qty-input-small.has-val { border-color: #667eea; background: #eff6ff; color: #667eea; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }

#asset-preview { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; }
.asset-thumb { width: 60px; height: 60px; border: 2px solid #eee; border-radius: 12px; object-fit: cover; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.asset-thumb:hover { border-color: #667eea; transform: scale(1.1) rotate(2deg); }

#studio-stage { 
  background: #f8fafc; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; 
  background-image: linear-gradient(rgba(102, 126, 234, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(102, 126, 234, 0.05) 1px, transparent 1px);
  background-size: 30px 30px; 
}
.canvas-shadow { 
    box-shadow: 0 30px 60px -15px rgba(0,0,0,0.2); background: #fff; border-radius: 8px; 
    transition: transform 0.1s; touch-action: none; transform-origin: center center; 
}

#drop-overlay {
  position: absolute; inset: 40px; z-index: 100;
  border: 5px dashed #667eea; background: rgba(255, 255, 255, 0.95);
  border-radius: 30px; display: none; align-items: center; justify-content: center; flex-direction: column;
  pointer-events: none; backdrop-filter: blur(8px); animation: pulse 2s infinite;
}
@keyframes pulse { 0% { border-color: #667eea; } 50% { border-color: #764ba2; } 100% { border-color: #667eea; } }
#drop-overlay.active { display: flex; }
#drop-overlay h3 { background: var(--primary-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; font-size: 32px; font-weight: 800; }
#drop-overlay p { color: #6b7280; margin: 10px 0 0 0; font-size: 16px; font-weight: 600; }

.zoom-controls { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); background: #fff; border-radius: 50px; padding: 8px; display: flex; gap: 10px; box-shadow: 0 15px 30px rgba(0,0,0,0.15); z-index: 101; }
.z-btn { width: 45px; height: 45px; border: none; background: #f3f4f6; border-radius: 50%; cursor: pointer; color: #4b5563; display: flex; align-items: center; justify-content: center; transition: 0.2s; font-size:20px; }
.z-btn:hover { background: #667eea; color: #fff; transform: scale(1.1); }

.d-none { display: none !important; }
.d-none-type { display: none !important; }

#processing-overlay {
  position: absolute; inset: 0; background: rgba(255, 255, 255, 0.9);
  z-index: 12000; display: none; align-items: center; justify-content: center;
  flex-direction: column; backdrop-filter: blur(50px);
}
.loader-text { margin-top: 25px; font-weight: 800; font-size: 20px; background: var(--vibrant-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 1px; text-transform: uppercase; }
.loader-spinner {
  width: 70px; height: 70px; border-radius: 50%; border: 6px solid transparent;
  border-top-color: #fa709a; border-right-color: #fee140; border-bottom-color: #667eea;
  animation: spin 0.8s linear infinite; box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
}
@keyframes spin { 100% { transform: rotate(360deg); } }

#error-overlay {
    position: absolute; inset: 0; background: rgba(255, 255, 255, 0.95);
    z-index: 3100; display: none; align-items: center; justify-content: center;
    flex-direction: column; backdrop-filter: blur(10px); text-align: center; padding: 30px;
}
#error-overlay h3 { font-size: 28px; font-weight: 800; margin: 20px 0 10px 0; background: var(--vibrant-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
#error-overlay p { font-size: 16px; color: #6b7280; max-width: 400px; margin-bottom: 30px; font-weight: 600; }

#confirm-modal { position: absolute; inset: 0; background: rgba(30, 30, 47, 0.8); z-index: 2000; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
.modal-box { background: white; width: 90%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 40px; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: left; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.modal-form-group { margin-bottom: 15px; }
.modal-label { font-size:12px; font-weight:700; color:#374151; margin-bottom:6px; display:block; }
.modal-input { width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; font-family: 'Poppins', sans-serif; transition: 0.2s; }
.modal-input:focus { border-color: #667eea; outline: none; box-shadow: 0 0 0 4px rgba(102,126,234,0.1); }
.modal-textarea { width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; font-family: 'Poppins', sans-serif; transition: 0.2s; min-height:80px; resize:vertical; }
.modal-textarea:focus { border-color: #667eea; outline: none; box-shadow: 0 0 0 4px rgba(102,126,234,0.1); }

#progress-bar-container { width: 100%; background-color: #f3f4f6; height: 10px; border-radius: 5px; margin-top: 20px; display: none; overflow: hidden; }
#progress-bar-fill { height: 100%; background: var(--vibrant-grad); width: 0%; border-radius: 5px; transition: width 0.3s; }

#color-btn-trigger {
  text-align: left; display: flex; justify-content: space-between; align-items: center;
  background: #fff; transition: border-color 0.2s; cursor: pointer; border: 1px solid #e5e7eb;
}
#color-btn-trigger:hover { border-color: #667eea; }

#color-modal { display: none; position: fixed; inset: 0; background: rgba(30, 30, 47, 0.8); z-index: 2500; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
.color-grid-box { background: white; width: 90%; max-width: 900px; height: 85vh; border-radius: 24px; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden; }
.color-grid-content { padding: 30px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; background: #f9fafb; }
.color-option {
  padding: 20px; border: 2px solid #e5e7eb; border-radius: 16px; cursor: pointer; text-align: center; font-size: 13px; font-weight: 700;
  display: flex; flex-direction: column; align-items: center; justify-content: center; transition: all 0.2s; min-height: 90px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
}
.color-option:hover { transform: translateY(-5px); box-shadow: 0 15px 25px -5px rgba(0,0,0,0.1); border-color: #667eea; }
.color-option.active { border: 3px solid #667eea; transform: scale(0.96); box-shadow: inset 0 0 10px rgba(102,126,234,0.2); }

#admin-panel {
  position: absolute; bottom: 0; left: 0; right: 0; height: 300px; background: #1e1e2f; z-index: 9999; color: #0f0; padding: 20px;
  display: none; border-top: 4px solid #667eea; box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
}

#price-calculator-box {
  background: linear-gradient(145deg, #ffffff, #f0f2f5); border: 1px solid #fff; border-radius: 20px; padding: 20px; margin-bottom: 20px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.8); position: relative; overflow: hidden;
}
#price-warning-box {
  background: #fee2e2; color: #b91c1c; font-size: 12px; font-weight: 700; padding: 10px; border-radius: 10px; margin-bottom: 12px;
  display: flex; align-items: center; gap: 8px; border: 1px solid #fca5a5; animation: shake 0.5s ease-in-out;
}
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }

.price-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 5px; }
.price-label { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 800; letter-spacing: 0.5px; }
.price-val-small { font-size: 14px; font-weight: 700; color: #374151; }
.price-val-large { font-size: 28px; font-weight: 800; background: var(--vibrant-grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1; }
.discount-badge { display: inline-block; background: #dcfce7; color: #15803d; font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 20px; text-transform: uppercase; margin-left: 5px; vertical-align: middle; }

#bg-remove-modal { position: absolute; inset: 0; background: rgba(30,30,47,0.8); z-index: 2100; display: none; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
.bg-modal-wide {
  max-width: 800px !important; width: 95% !important; background: #fff; border-radius: 24px; overflow: hidden;
  box-shadow: 0 50px 100px -20px rgba(50, 50, 93, 0.25), 0 30px 60px -30px rgba(0, 0, 0, 0.3); animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes popIn { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }

.bg-modal-header { background: var(--primary-grad); padding: 25px; text-align: center; position: relative; overflow: hidden; }
.bg-modal-header h3 { color: white; margin: 0; font-size: 24px; font-weight: 800; position: relative; z-index: 2; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.bg-modal-header p { color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 13px; position: relative; z-index: 2; }
.bg-modal-header::after { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 60%); z-index: 1; }

.bg-options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; }

.bg-card {
  border: 2px solid #f3f4f6; border-radius: 20px; padding: 20px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex; flex-direction: column; align-items: center; position: relative; background: #fff;
}
.bg-card:hover { border-color: #667eea; transform: translateY(-8px); box-shadow: 0 20px 40px -10px rgba(102, 126, 234, 0.2); }

.preview-window { width: 100%; height: 100px; border-radius: 12px; margin-bottom: 15px; position: relative; border: 1px solid #eee; overflow: hidden; }
.preview-checkered {
  background-color: #fff; background-image: linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
  background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
.preview-solid { background: #f3f4f6; }
.preview-subject { width: 50px; height: 50px; background: var(--vibrant-grad); border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.preview-subject.edge-cut { border: 2px dashed #333; background: #fa709a; }
.bg-card h4 { margin: 0 0 5px 0; color: #1f2937; font-size: 15px; font-weight: 700; }
.bg-card p { margin: 0; color: #6b7280; font-size: 11px; text-align: center; line-height: 1.4; }
.recommended-badge { position: absolute; top: -12px; background: var(--accent-pop); color: white; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 20px; box-shadow: 0 4px 10px rgba(255,0,128,0.3); letter-spacing: 0.5px; text-transform: uppercase; }

@media (max-width: 600px) {
  .bg-options-grid { grid-template-columns: 1fr; padding: 20px; gap: 15px; }
  .preview-window { height: 70px; width: 60px; height: 60px; margin-bottom: 0; margin-right: 15px; flex-shrink: 0; }
  .bg-card { flex-direction: row; text-align: left; padding: 15px; align-items: center; }
  .bg-card > div { flex: 1; }
  .bg-card:hover { transform: scale(1.02); }
}

#editor-ui {
    position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 200; width: auto; min-width: 380px;
    background: rgba(255, 255, 255, 0.95) !important; backdrop-filter: blur(12px); border-radius: 16px !important; box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important; border: 1px solid rgba(255,255,255,0.8) !important;
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
}
#editor-ui.d-none { display: block !important; transform: translate(-50%, 150%); opacity: 0; pointer-events: none; }
#editor-ui .panel-section { background: transparent !important; border: none !important; box-shadow: none !important; padding: 10px 15px !important; margin: 0 !important; }
#editor-ui h4 { margin-bottom: 5px !important; font-size:12px !important; opacity:0.8; }
#editor-ui .btn { padding: 8px 12px; height: 38px; font-size: 12px; border-radius: 10px; }
#editor-ui .grid-3 { gap: 6px; }

@media (max-width: 1024px) {
    #editor-ui { position: fixed; left: 0; right: 0; bottom: 0; width: 100%; transform: translateY(0); border-radius: 20px 20px 0 0 !important; border: none !important; box-shadow: 0 -5px 20px rgba(0,0,0,0.1) !important; padding-bottom: 20px; }
    #editor-ui.d-none { transform: translateY(100%); opacity: 0; }
}
</style>
</head>
<body>

<div id="processing-overlay">
  <div class="loader-spinner"></div>
  <p class="loader-text" id="loader-msg">Processing...</p>
</div>

<div id="error-overlay">
    <i class="material-icons-round" style="font-size:80px; color:#ef4444; margin-bottom:10px;">error_outline</i>
    <h3>Oops! Small Glitch.</h3>
    <p id="error-msg-text">The image process timed out or was too complex. Don't worry, just try again!</p>
    <button class="btn btn-primary" onclick="document.getElementById('error-overlay').style.display='none'" style="width:auto; padding:15px 40px; font-size:16px;">
        Back to Design <i class="material-icons-round">arrow_forward</i>
    </button>
</div>

<div id="bg-remove-modal">
    <div class="modal-box bg-modal-wide">
        <div class="bg-modal-header">
            <h3>Optimize Your Image</h3>
            <p>We detected a background. How should we handle it?</p>
        </div>
        <div class="bg-options-grid">
            <div class="bg-card" onclick="applyBgChoice('global')">
                <span class="recommended-badge">Recommended</span>
                <div class="preview-window preview-checkered"><div class="preview-subject"></div></div>
                <div><h4>Remove White BG</h4><p>Makes white pixels transparent. Best for logos & illustrations.</p></div>
            </div>
            <div class="bg-card" onclick="applyBgChoice('edge')">
                <div class="preview-window preview-checkered"><div class="preview-subject edge-cut"></div></div>
                <div><h4>Remove Edges</h4><p>Trims the outer square edges only. Keeps white inside the design.</p></div>
            </div>
            <div class="bg-card" onclick="applyBgChoice('original')">
                <div class="preview-window preview-solid"><div class="preview-subject"></div></div>
                <div><h4>Keep Original</h4><p>Do not change anything. Print the image exactly as uploaded.</p></div>
            </div>
        </div>
        <div style="text-align:center; padding-bottom:20px;">
            <button class="btn" style="width:auto; border:none; color:#9ca3af; font-size:12px; background:transparent;" onclick="closeBgModal()">Cancel / Close</button>
        </div>
    </div>
</div>

<div id="studio-app">
  <nav id="studio-nav">
    <img src="https://cdn.shopify.com/s/files/1/0665/8431/4135/files/Asset_154.png?v=1758913953" alt="Logo" style="height: 50px; width: auto; object-fit: contain;">
    <div style="display:flex; gap:20px;">
        <button class="nav-btn active" id="nav-front" onclick="switchSide('front')"><i class="material-icons-round">checkroom</i><span>Front</span></button>
        <button class="nav-btn" id="nav-back" onclick="switchSide('back')"><i class="material-icons-round" style="transform: scaleX(-1);">checkroom</i><span>Back</span></button>
    </div>
  </nav>

  <aside id="studio-controls">
    <div class="panel-section"><h4>1. Print Area</h4><div class="grid-3" id="area-buttons"></div></div>
    
    <div class="panel-section">
      <h4>2. Add Design</h4>
      <input type="file" id="file-input" hidden accept="image/*,.pdf">
      <div class="grid-2">
        <button class="btn" onclick="document.getElementById('file-input').click()" title="Upload an image or PDF"><i class="material-icons-round" style="color:#667eea;">upload_file</i> Upload</button>
        <button class="btn" onclick="addText()" title="Add a text box"><i class="material-icons-round" style="color:#ec4899;">text_fields</i> Text</button>
      </div>
      <div id="asset-preview"></div>
    </div>

    <div class="panel-section">
      <h4>3. Apparel Type</h4>
      <div>
        <select id="opt-type" class="side-input" onchange="updateGarmentType()">
          <option value="T-Shirt">T-Shirt</option>
          <option value="Hoodie">Hoodie</option>
          <option value="Sweatshirt">Sweatshirt</option>
        </select>
      </div>
    </div>

    <div class="panel-section">
      <h4>4. Garment Colour</h4>
      <div>
        <button id="color-btn-trigger" class="side-input" onclick="toggleColorModal(true)" title="Select garment color">
          <span id="current-color-name">Select Color...</span>
          <i class="material-icons-round">palette</i>
        </button>
        <input type="hidden" id="opt-color" value="Black">
      </div>
    </div>

    <div class="panel-section">
      <h4>5. Size & Quantity</h4>
      <div class="size-grid-container">
          <div class="size-box"><span class="size-header">S</span><input type="number" class="qty-input-small" data-size="S" value="0" min="0" onfocus="if(this.value=='0') this.value=''" onblur="if(this.value=='') this.value='0'" oninput="updateTotalQty(this)"></div>
          <div class="size-box"><span class="size-header">M</span><input type="number" class="qty-input-small" data-size="M" value="0" min="0" onfocus="if(this.value=='0') this.value=''" onblur="if(this.value=='') this.value='0'" oninput="updateTotalQty(this)"></div>
          <div class="size-box"><span class="size-header">L</span><input type="number" class="qty-input-small" data-size="L" value="0" min="0" onfocus="if(this.value=='0') this.value=''" onblur="if(this.value=='') this.value='0'" oninput="updateTotalQty(this)"></div>
          <div class="size-box"><span class="size-header">XL</span><input type="number" class="qty-input-small" data-size="XL" value="0" min="0" onfocus="if(this.value=='0') this.value=''" onblur="if(this.value=='') this.value='0'" oninput="updateTotalQty(this)"></div>
          <div class="size-box"><span class="size-header">2XL</span><input type="number" class="qty-input-small" data-size="2XL" value="0" min="0" onfocus="if(this.value=='0') this.value=''" onblur="if(this.value=='') this.value='0'" oninput="updateTotalQty(this)"></div>
          <div class="size-box"><span class="size-header">3XL</span><input type="number" class="qty-input-small" data-size="3XL" value="0" min="0" onfocus="if(this.value=='0') this.value=''" onblur="if(this.value=='') this.value='0'" oninput="updateTotalQty(this)"></div>
          <div class="size-box"><span class="size-header">4XL</span><input type="number" class="qty-input-small" data-size="4XL" value="0" min="0" onfocus="if(this.value=='0') this.value=''" onblur="if(this.value=='') this.value='0'" oninput="updateTotalQty(this)"></div>
          <div class="size-box"><span class="size-header">5XL</span><input type="number" class="qty-input-small" data-size="5XL" value="0" min="0" onfocus="if(this.value=='0') this.value=''" onblur="if(this.value=='') this.value='0'" oninput="updateTotalQty(this)"></div>
      </div>
    </div>

    <div class="panel-section">
      <h4>6. Production Speed</h4>
      <div class="grid-2">
        <div><label class="side-label">Total Qty</label><input type="number" id="opt-qty" class="side-input" value="0" readonly style="background:#e5e7eb; cursor:default;"></div>
        <div><label class="side-label">Preference</label><select id="opt-time" class="side-input"><option value="Standard">Standard (5-7 Bus. Days)</option><option value="Rush">Rush (2-4 Bus. Days)</option></select></div>
      </div>
    </div>
    
    <div style="flex:1"></div>

    <div>
      <div id="price-calculator-box">
        <div id="price-warning-box" class="d-none"><i class="material-icons-round">warning</i> <span>Min Order: 6 Items</span></div>
        <div class="price-row"><div class="price-label">Price Per Item <span id="ui-discount-tag" class="discount-badge d-none">-0%</span></div><div id="ui-per-item" class="price-val-small">$10.00</div></div>
        <div style="border-top:1px solid #eee; margin:10px 0;"></div>
        <div class="price-row"><div class="price-label">Estimated Total</div><div id="ui-total" class="price-val-large">$0.00</div></div>
      </div>
      <div class="grid-2" style="margin-bottom:20px;">
        <button class="btn" onclick="action('undo')" title="Undo">⟲ Undo</button>
        <button class="btn" onclick="action('redo')" title="Redo">⟳ Redo</button>
      </div>
      <button id="atc-btn" class="btn btn-action-red" style="padding:18px; font-size:15px; letter-spacing:1px;" onclick="openConfirmModal()">ADD TO CART & CHECKOUT <i class="material-icons-round">shopping_cart</i></button>
      <div style="text-align:center; margin-top:15px; font-size:12px; font-weight:700; color:#9ca3af;">
        <label style="cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;"><input type="checkbox" onchange="toggleAdmin()" style="cursor:pointer;"> Enable Dev Mode</label>
      </div>
    </div>
  </aside>

  <main id="studio-stage">
    <div id="drop-overlay">
      <i class="material-icons-round" style="font-size:80px; color:#667eea;">cloud_upload</i>
      <h3>Drop File Here</h3>
      <p>Supports Images & PDF</p>
    </div>

    <div class="canvas-shadow" id="canvas-wrapper-div"><canvas id="c"></canvas></div>
    
    <div id="editor-ui" class="d-none">
      <div class="panel-section">
        <h4 style="background:none; color:#667eea; box-shadow:none; padding:0; margin-bottom:15px; font-size:16px;"><i class="material-icons-round" style="font-size:18px;">tune</i> Edit Selected</h4>
        <div id="text-tools" class="d-none">
          <select class="btn" style="margin-bottom:10px; justify-content:space-between;" onchange="updateProp('fontFamily', this.value)" title="Font family">
            <option value="Inter">Inter (Sans)</option><option value="Anton">Anton (Bold)</option><option value="Oswald">Oswald (Tall)</option><option value="Roboto">Roboto (Basic)</option>
          </select>
          <div class="grid-2" style="margin-bottom:10px;">
            <input type="color" class="btn" style="padding:0; height:50px; width:100%;" onchange="updateProp('fill', this.value)" title="Text color">
            <div style="display:flex; gap:8px;"><button class="btn" style="padding:0" onclick="toggleStyle('bold')" title="Bold"><b>B</b></button><button class="btn" style="padding:0" onclick="toggleStyle('italic')" title="Italic"><i>I</i></button></div>
          </div>
          <div class="grid-2" style="margin-bottom:10px;">
            <input type="color" class="btn" style="padding:0; height:50px; width:100%;" onchange="updateProp('stroke', this.value)" title="Stroke color" value="#000000">
            <input type="number" class="btn" style="padding:0; text-align:center;" onchange="updateProp('strokeWidth', parseFloat(this.value))" title="Stroke width" value="0" min="0" max="20" step="1">
          </div>
          <div class="grid-2" style="margin-bottom:10px;">
            <button class="btn" onclick="toggleShadow()" title="Toggle shadow">Shadow</button>
          </div>
        </div>
        <div id="image-tools" class="d-none">
          <div class="grid-3" style="margin-bottom:10px;">
            <button class="btn" onclick="applyFilter('grayscale')" title="Grayscale">Gray</button>
            <button class="btn" onclick="applyFilter('sepia')" title="Sepia">Sepia</button>
            <button class="btn" onclick="applyFilter('vintage')" title="Vintage">Vintage</button>
          </div>
          <div class="grid-3" style="margin-bottom:10px;">
            <button class="btn" onclick="applyFilter('blur')" title="Blur">Blur</button>
            <button class="btn" onclick="applyFilter('sharpen')" title="Sharpen">Sharpen</button>
            <button class="btn" onclick="resetFilters()" title="Reset all filters">Reset</button>
          </div>
          <div class="grid-2" style="margin-top:10px;">
              <button class="btn" onclick="toggleWhiteBG()" style="background:#fff; color:#333; border:2px solid #e5e7eb; padding:12px 5px; font-size:12px;" title="Remove white background"><i class="material-icons-round" style="font-size:16px; color:#ec4899;">auto_fix_high</i> Remove All</button>
              <button class="btn" onclick="toggleEdgeBG()" style="background:#fff; color:#333; border:2px solid #e5e7eb; padding:12px 5px; font-size:12px;" title="Remove edges only"><i class="material-icons-round" style="font-size:16px; color:#667eea;">crop_square</i> Edges Only</button>
          </div>
          <button class="btn" onclick="toggleColorSwapSection()" style="margin-top:10px; border:2px solid #e5e7eb; justify-content: center;" title="Swap colors"><i class="material-icons-round" style="color:#f59e0b;">colorize</i> Color Swap</button>
          <div id="color-swap-tools" class="d-none" style="margin-top:10px; background:#f3f4f6; padding:10px; border-radius:10px;">
              <div class="grid-2" style="margin-bottom:8px;">
                  <div><span style="font-size:10px; font-weight:800; color:#666; display:block; margin-bottom:4px;">TARGET</span><input type="color" id="swap-target" value="#ffffff" style="width:100%; height:30px; border:none; cursor:pointer; border-radius:4px;"></div>
                  <div><span style="font-size:10px; font-weight:800; color:#666; display:block; margin-bottom:4px;">REPLACE</span><input type="color" id="swap-replace" value="#ef4444" style="width:100%; height:30px; border:none; cursor:pointer; border-radius:4px;"></div>
              </div>
              <div style="margin-bottom:8px;">
                    <label style="font-size:10px; font-weight:800; color:#666;">TOLERANCE: <span id="tol-val">20</span>%</label>
                    <input type="range" id="swap-tolerance" min="0" max="100" value="20" style="width:100%; accent-color:#667eea;" oninput="document.getElementById('tol-val').innerText=this.value">
              </div>
              <button class="btn" onclick="applyColorSwapLogic()" style="background:#667eea; color:white; font-size:12px; padding:8px; border:none;">Apply Change</button>
          </div>
        </div>
        <div class="grid-3" style="margin-top:15px;">
          <button class="btn" onclick="action('copy')" title="Copy"><i class="material-icons-round" style="font-size:16px;">content_copy</i> Copy</button>
          <button class="btn" onclick="duplicateObject()" title="Duplicate"><i class="material-icons-round" style="font-size:16px;">content_copy</i> Dup</button>
          <button class="btn" onclick="toggleLock()" title="Lock/Unlock"><i class="material-icons-round" style="font-size:16px;" id="lock-icon">lock_open</i> Lock</button>
          <button class="btn" onclick="action('delete')" style="color:#ef4444; border-color:#fee2e2; background:#fef2f2;" title="Delete"><i class="material-icons-round" style="font-size:16px;">delete</i> Delete</button>
        </div>
      </div>
    </div>

    <div class="zoom-controls">
      <button class="z-btn" id="guide-toggle-btn" onclick="toggleGuides()" title="Toggle Guides"><i class="material-icons-round">visibility</i></button>
      <div style="width:1px; height:25px; background:#e5e7eb; margin:auto 5px;"></div>
      <button class="z-btn" onclick="resetView()" title="Reset view"><i class="material-icons-round">crop_free</i></button>
      <button class="z-btn" onclick="zoomCanvas(1.15)" title="Zoom in"><i class="material-icons-round">add</i></button>
      <button class="z-btn" onclick="zoomCanvas(0.85)" title="Zoom out"><i class="material-icons-round">remove</i></button>
    </div>
  </main>
    
  <div id="confirm-modal">
    <div class="modal-box">
      <h3 style="margin-top:0; text-align:center; font-weight:800; color:#1f2937; font-size:24px;">Almost There!</h3>
      <p style="text-align:center; font-size:14px; color:#6b7280; margin-bottom:30px;">Complete your details to add to cart.</p>
      
      <form action="https://formsubmit.co/info@yayasports.ca" method="POST" id="email-form">
          <input type="hidden" name="_captcha" value="false">
          <input type="hidden" name="_subject" value="New Custom Order Request">
          
          <div class="grid-2">
              <div class="modal-form-group">
                  <label class="modal-label">Your Name</label>
                  <input type="text" name="name" id="ui-name" class="modal-input" placeholder="John Doe" required>
              </div>
              <div class="modal-form-group">
                  <label class="modal-label">Business Name (Optional)</label>
                  <input type="text" name="business" id="ui-business" class="modal-input" placeholder="My Brand Inc.">
              </div>
          </div>

          <div class="grid-2">
              <div class="modal-form-group">
                  <label class="modal-label">Email Address</label>
                  <input type="email" name="email" id="ui-email" class="modal-input" placeholder="email@example.com" required>
              </div>
              <div class="modal-form-group">
                  <label class="modal-label">Phone Number</label>
                  <input type="tel" name="phone" id="ui-phone" class="modal-input" placeholder="(123) 456-7890">
              </div>
          </div>

          <div class="modal-form-group">
              <label class="modal-label">Order Notes / Instructions</label>
              <textarea name="notes" id="ui-notes" class="modal-textarea" placeholder="Any specific instructions for placement, colors, or sizing?"></textarea>
          </div>
          
          <textarea id="hidden-body" name="details" style="display:none;"></textarea>
      </form>

      <div id="progress-bar-container"><div id="progress-bar-fill"></div></div>
      <div id="status-msg"></div>

      <div class="grid-2" style="margin-top:20px;">
        <button type="button" class="btn" id="cancel-btn" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-primary" id="submit-trigger-btn" onclick="safeSubmit()">ADD TO CART & CHECKOUT</button>
      </div>
    </div>
  </div>

  <div id="admin-panel">
    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
      <h3 style="margin:0; color:#667eea;">Admin Config</h3>
      <button class="btn" style="width:auto; padding:5px 15px;" onclick="toggleAdmin()">Close & Save</button>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 200px; gap:20px;">
      <textarea id="admin-output" style="background:#000; color:#0f0; border:none; padding:10px; font-family:monospace;"></textarea>
      <div style="color:#9ca3af; font-size:12px;">
        <p>1. Toggle Admin Mode.</p><p>2. Drag Shirt to Resize/Crop.</p><p>3. Drag Red Boxes to adjust print zones.</p><p>4. Copy the code from the box and replace in source file.</p>
      </div>
    </div>
  </div>

  <div id="color-modal">
    <div class="color-grid-box">
      <div style="padding:25px; border-bottom:1px solid #f3f4f6; display:flex; justify-content:space-between; align-items:center; background:#fff;">
        <h3 style="margin:0; font-size:22px; font-weight:800; color:#111;">Select Garment Color</h3>
        <button class="btn" style="width:auto; padding:10px 15px; border:none;" onclick="toggleColorModal(false)"><i class="material-icons-round" style="font-size:24px;">close</i></button>
      </div>
      <div style="padding:20px 30px; background:#fff; border-bottom:1px solid #f3f4f6;"><input type="text" placeholder="Search color name..." class="side-input" onkeyup="filterColors(this.value)"></div>
      <div id="color-grid-container" class="color-grid-content"></div>
    </div>
  </div>
</div>

<script>
// ---------- API KEY ----------
const IMGBB_API_KEY = 'd0f51d8914e090848d677a3ea2994c06'; 
// -----------------------------

const BG_TOLERANCE = 30; 
const EXPORT_SCALE_FACTOR = 5; 
const BASE_URL = "https://cdn.shopify.com/s/files/1/0665/8431/4135/files/";

const HOODIE_ALLOWED_COLORS = ["Black", "White", "Navy", "Sport Grey", "Red", "Royal", "Charcoal", "Forest", "Maroon", "Dark Chocolate", "Dark Heather", "Purple", "Irish Green", "Heliconia", "Light Pink", "Carolina Blue", "Sand", "Gold", "Orange", "Safety Green", "Safety Pink", "Safety Orange", "Ash Grey", "Indigo Blue", "Military Green", "Heather Dark Maroon", "Heather Dark Green", "Heather Dark Navy", "Graphite Heather", "Heather Deep Royal", "Heather Scarlet Red"];

const COLOR_HEX_MAP = {"Antique Cherry Red": "#7C1C29", "Antique Green": "#2E5038", "Antique Jade": "#00887A", "Antique Orange": "#C95634", "Antique Sapphire": "#126B88", "Ash Grey": "#D7D7D7", "Azalea": "#F089B2", "Berry": "#86264D", "Black": "#111111", "Black Berry": "#372B40", "Brown Savana": "#654637", "Cardinal Red": "#8A1529", "Carolina Blue": "#7BAFD4", "Charcoal": "#4F5254", "Cobalt": "#0047AB", "Coral Silk": "#FF7F50", "Corn Silk": "#FFF8DC", "Daisy": "#FEDB00", "Dark Chocolate": "#35231D", "Dark Heather": "#4B4F55", "Electric Green": "#56B000", "Forest": "#182C25", "Garnet": "#5F121F", "Gold": "#FFC72C", "Graphite Heather": "#787878", "Gravel": "#A8A9AD", "Heather Military Green": "#4B5320", "Heather Navy": "#343F51", "Heather Radiant Orchid": "#A05792", "Heather Red": "#BC3640", "Heather Sapphire": "#0067A5", "Heliconia": "#DB3E79", "Ice Grey": "#D6D9DC", "Indigo Blue": "#475D74", "Irish Green": "#009E60", "Kiwi": "#8EE53F", "Light Blue": "#ADD8E6", "Light Pink": "#FFB6C1", "Lilac": "#C8A2C8", "Lime": "#00FF00", "Maroon": "#500000", "Midnight": "#001f3f", "Military Green": "#4B5320", "Mint Green": "#98FF98", "Natural": "#EFEBD8", "Navy": "#000080", "Neon Blue": "#4D4DFF", "Neon Green": "#39FF14", "Old Gold": "#CFB53B", "Orange": "#FF5F00", "Purple": "#6A0DAD", "Red": "#E60000", "Royal": "#4169E1", "Russet": "#80461B", "Safety Green": "#CEFF00", "Safety Orange": "#FF6700", "Safety Pink": "#FF69B4", "Sand": "#C2B280", "Sapphire": "#0F52BA", "Sky": "#87CEEB", "Sport Grey": "#9E9E9E", "Sunset": "#FD5E53", "Tangerine": "#F28500", "Tennessee Orange": "#BF5700", "Texas Orange": "#CC5500", "Tropical Blue": "#007BA7", "Turf Green": "#006400", "Tweed": "#635D4F", "Violet": "#8F00FF", "White": "#FFFFFF", "Yellow Haze": "#FFFACD", "Heather Dark Maroon": "#5d1e2e", "Heather Dark Green": "#2d4235", "Heather Dark Navy": "#2b3447", "Heather Deep Royal": "#3b5ba5", "Heather Scarlet Red": "#b93d47"};

const TSHIRT_CONFIG = {
  "front": { "mockupConfig": { "left": -142, "top": -44, "scaleX": 0.296, "scaleY": 0.296 }, "areas": { "center": { "x": 153, "y": 143, "w": 295, "h": 384, "zoom": 1.7 }, "leftChest": { "x": 345, "y": 150, "w": 98, "h": 98, "zoom": 4.8 }, "rightChest": { "x": 160, "y": 150, "w": 98, "h": 98, "zoom": 4.8 } }, "json": [] },
  "back": { "mockupConfig": { "left": -150, "top": -37, "scaleX": 0.3007, "scaleY": 0.3007 }, "areas": { "fullBack": { "x": 161, "y": 122, "w": 285, "h": 406, "zoom": 1.6 }, "upperBack": { "x": 168, "y": 130, "w": 273, "h": 84, "zoom": 2 } }, "json": [] }
};

const HOODIE_CONFIG = {
  "front": { "mockupConfig": { "left": 20, "top": -40, "scaleX": 0.5364, "scaleY": 0.5364 }, "areas": { "center": { "x": 172, "y": 158, "w": 248, "h": 337, "zoom": 1.7 }, "leftChest": { "x": 336, "y": 163, "w": 81, "h": 81, "zoom": 4.8 }, "rightChest": { "x": 174, "y": 161, "w": 81, "h": 81, "zoom": 4.8 } }, "json": [] },
  "back": { "mockupConfig": { "left": 20, "top": -11, "scaleX": 0.5667, "scaleY": 0.5667 }, "areas": { "fullBack": { "x": 183, "y": 219, "w": 254, "h": 361, "zoom": 1.6 }, "upperBack": { "x": 189, "y": 224, "w": 243, "h": 77, "zoom": 2 } }, "json": [] }
};

let Runtime_TSHIRT = JSON.parse(JSON.stringify(TSHIRT_CONFIG));
let Runtime_HOODIE = JSON.parse(JSON.stringify(HOODIE_CONFIG));
let CONFIG = { sides: JSON.parse(JSON.stringify(Runtime_TSHIRT)) };

function getCandidateUrls(colorName, side) {
    const type = document.getElementById('opt-type').value; 
    const candidates = [];
    if (type === 'Hoodie') {
        const safeColor = colorName.trim().replace(/\\s+/g, '_');
        const safeSide = (side.toLowerCase() === 'front') ? 'Front' : 'Back';
        candidates.push(\`\${BASE_URL}Gildan_18500_\${safeColor}_\${safeSide}_High.JPG\`);
        candidates.push(\`\${BASE_URL}Gildan_18500_\${safeColor}_\${safeSide}_High.jpg\`);
        candidates.push(\`\${BASE_URL}Gildan_18500_\${safeColor}_\${safeSide}_High.png\`);
        const legacyColor = colorName.toLowerCase().trim().replace(/\\s+/g, '-');
        const legacySide = side.toLowerCase();
        candidates.push(\`\${BASE_URL}hoodie-\${legacyColor}-\${legacySide}.png\`);
        candidates.push(\`\${BASE_URL}\${legacyColor}-\${legacySide}.png\`);
    } else {
        const safeColor = colorName.toLowerCase().trim().replace(/\\s+/g, '-'); 
        const safeSide = side.toLowerCase(); 
        candidates.push(\`\${BASE_URL}\${safeColor}-\${safeSide}.png\`);
        const typePrefix = type.toLowerCase(); 
        candidates.push(\`\${BASE_URL}\${typePrefix}-\${safeColor}-\${safeSide}.png\`);
    }
    return candidates;
}

// ===== NEW FALLBACK MOCKUP GENERATOR =====
function generateFallbackMockup(colorName, side) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');
    // Fill with garment color
    const hex = COLOR_HEX_MAP[colorName] || '#cccccc';
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 600, 700);
    // Draw a simple shirt outline
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 10;
    ctx.strokeRect(100, 100, 400, 500);
    ctx.font = 'bold 40px Poppins, sans-serif';
    ctx.fillStyle = getContrastYIQ(hex) ? '#ffffff' : '#333333';
    ctx.textAlign = 'center';
    ctx.fillText(colorName, 300, 350);
    ctx.fillText(side.toUpperCase(), 300, 450);
    return canvas.toDataURL();
}

function tryLoadImages(urlList) {
    return new Promise((resolve, reject) => {
        let index = 0;
        function tryNext() {
            if (index >= urlList.length) {
                // All candidates failed – use fallback
                const fallbackUrl = generateFallbackMockup(State.color, State.side);
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.src = fallbackUrl;
                return;
            }
            const url = urlList[index];
            const img = new Image(); img.crossOrigin = "anonymous";
            img.onload = function() { resolve(img); };
            img.onerror = function() { index++; tryNext(); };
            img.src = url;
        }
        tryNext();
    });
}

let State = { side: 'front', color: 'Black', area: 'center', devMode: false, undo: [], redo: [], saving: false, clipboard: null, guides: {}, uploads: [], guidesVisible: true, currentType: 'T-Shirt' };

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
const canvas = new fabric.Canvas('c', { width: 600, height: 700, preserveObjectStacking: true, selection: true, allowTouchScrolling: false });
fabric.Object.prototype.set({ transparentCorners: false, cornerColor: '#ffffff', cornerStrokeColor: '#111', borderColor: '#111', cornerSize: 12, padding: 8, cornerStyle: 'circle', borderDashArray: [4, 4] });

function resizeCanvas() {
    const wrapper = document.getElementById('canvas-wrapper-div');
    const stage = document.getElementById('studio-stage');
    const availableW = stage.clientWidth - 20;
    const availableH = stage.clientHeight - 20;
    const scaleW = availableW / 600;
    const scaleH = availableH / 700;
    const scale = Math.min(1, scaleW, scaleH);
    wrapper.style.transform = \`scale(\${scale})\`;
}
window.addEventListener('resize', resizeCanvas);

(function boot() {
    const grid = document.getElementById('color-grid-container');
    
    // CUSTOM ORDER LOGIC: Black, White, then Color Gradient
    const PREFERRED_ORDER = [
      "Black", "White", 
      // Neutrals
      "Sport Grey", "Ash Grey", "Ice Grey", "Gravel", "Charcoal", "Dark Heather", "Graphite Heather", "Heather Navy", "Midnight",
      // Reds
      "Red", "Heather Red", "Heather Scarlet Red", "Cardinal Red", "Antique Cherry Red", "Cherry Red", "Garnet", "Maroon", "Heather Dark Maroon",
      // Oranges
      "Orange", "Sunset", "Safety Orange", "Texas Orange", "Tennessee Orange", "Antique Orange", "Tangerine",
      // Yellows/Creams
      "Gold", "Old Gold", "Daisy", "Corn Silk", "Yellow Haze", "Natural", "Sand",
      // Greens
      "Forest", "Hunter Green", "Military Green", "Heather Military Green", "Antique Green", "Heather Dark Green", "Irish Green", "Kelly Green", "Electric Green", "Lime", "Kiwi", "Mint Green", "Antique Jade", "Turf Green", "Safety Green",
      // Blues
      "Navy", "Heather Dark Navy", "Royal", "Heather Deep Royal", "Antique Sapphire", "Sapphire", "Heather Sapphire", "Cobalt", "Carolina Blue", "Light Blue", "Sky", "Tropical Blue", "Indigo Blue", "Neon Blue",
      // Purples/Pinks
      "Purple", "Heather Radiant Orchid", "Violet", "Lilac", "Black Berry", "Berry", "Heliconia", "Safety Pink", "Azalea", "Light Pink",
      // Browns
      "Dark Chocolate", "Brown Savana", "Russet", "Tweed"
    ];

    const ALL_KEYS = Object.keys(COLOR_HEX_MAP);
    const REMAINING = ALL_KEYS.filter(x => !PREFERRED_ORDER.includes(x)).sort();
    const SORTED_KEYS = [...PREFERRED_ORDER.filter(x => ALL_KEYS.includes(x)), ...REMAINING];

    SORTED_KEYS.forEach(colorName => {
        if(COLOR_HEX_MAP[colorName]) {
            const btn = document.createElement('div');
            btn.className = 'color-option';
            btn.setAttribute('data-color', colorName);
            const hex = COLOR_HEX_MAP[colorName];
            btn.style.backgroundColor = hex;
            const isDark = getContrastYIQ(hex);
            btn.style.color = isDark ? '#ffffff' : '#000000';
            if(!isDark && hex.toLowerCase().includes('fff')) { btn.style.border = '1px solid #ccc'; } else { btn.style.borderColor = hex; }
            btn.innerText = colorName;
            btn.onclick = () => { changeColor(colorName); toggleColorModal(false); };
            grid.appendChild(btn);
        }
    });

    document.getElementById('opt-color').value = State.color;
    document.getElementById('current-color-name').innerText = State.color;
    updateActiveColorUI();
    changeColor(State.color); 

    loadSide('front'); 
    setupShortcuts(); 
    setupDragDrop(); 
    setTimeout(resizeCanvas, 100);
    initSnapping();
    updatePricing(); 
})();

function getContrastYIQ(hexcolor){ 
    hexcolor = hexcolor.replace("#", ""); 
    var r = parseInt(hexcolor.substr(0,2),16); 
    var g = parseInt(hexcolor.substr(2,2),16); 
    var b = parseInt(hexcolor.substr(4,2),16); 
    var yiq = ((r*299)+(g*587)+(b*114))/1000; 
    return (yiq < 128); 
}

function showLoader(text) { document.getElementById('loader-msg').innerText = text || "Processing..."; document.getElementById('processing-overlay').style.display = 'flex'; }
function hideLoader() { document.getElementById('processing-overlay').style.display = 'none'; }
function triggerError(msg) { hideLoader(); document.getElementById('error-msg-text').innerText = msg || "The process timed out."; document.getElementById('error-overlay').style.display = 'flex'; }

function updateTotalQty(input) { 
    if(input.value > 0) { input.classList.add('has-val'); } else { input.classList.remove('has-val'); } 
    let total = 0; 
    document.querySelectorAll('.qty-input-small').forEach(el => { total += parseInt(el.value) || 0; }); 
    document.getElementById('opt-qty').value = total; 
    updatePricing(); 
}

function forceLocks() {
    if (State.devMode) return; 
    canvas.getObjects().forEach(obj => {
        if (obj.name && obj.name.startsWith('guide-')) { 
            obj.set({ selectable: false, evented: true, lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true, lockRotation: true, hasControls: false, hoverCursor: 'default' }); 
        }
        if (obj.name === 'mockup') { 
            obj.set({ selectable: false, evented: true, lockMovementX: true, lockMovementY: true, hasControls: false, hoverCursor: 'default' }); 
            canvas.sendToBack(obj); 
        }
    });
    canvas.requestRenderAll();
}

function loadSide(name) {
    return new Promise((resolve) => {
        canvas.clear(); 
        const candidates = getCandidateUrls(State.color, name);
        const data = CONFIG.sides[name];
        tryLoadImages(candidates).then((loadedImg) => {
            const cfg = data.mockupConfig || { left:0, top:0, scaleX:1, scaleY:1 };
            const fabricImg = new fabric.Image(loadedImg);
            fabricImg.set({ left: cfg.left, top: cfg.top, scaleX: cfg.scaleX, scaleY: cfg.scaleY, selectable: State.devMode, evented: true, name: 'mockup', hoverCursor: State.devMode ? 'move' : 'default' });
            if(!data.mockupConfig) { fabricImg.scaleToWidth(600); }
            fabricImg.on('modified', () => { 
                if(State.devMode) { 
                    CONFIG.sides[State.side].mockupConfig = { left: Math.round(fabricImg.left), top: Math.round(fabricImg.top), scaleX: parseFloat(fabricImg.scaleX.toFixed(4)), scaleY: parseFloat(fabricImg.scaleY.toFixed(4)) }; 
                    updateAdminOutput(); 
                } 
            });
            canvas.add(fabricImg); fabricImg.sendToBack(); finishSetup(); resolve();
        }).catch((err) => { 
            console.error(err); 
            // This fallback should never be reached because tryLoadImages now always resolves with fallback
        });

        function finishSetup() {
            const hex = COLOR_HEX_MAP[State.color] || '#ffffff';
            const isDark = getContrastYIQ(hex);
            const controlColor = isDark ? '#ffffff' : '#333333';
            fabric.Object.prototype.set({ borderColor: controlColor, cornerStrokeColor: controlColor, cornerColor: isDark ? '#555555' : '#ffffff' });
            const box = document.getElementById('area-buttons'); box.innerHTML = '';
            const areas = CONFIG.sides[name].areas;
            Object.keys(areas).forEach(key => {
                const btn = document.createElement('button'); btn.className = 'btn'; btn.style.fontSize = '11px'; 
                btn.innerText = key.replace(/([A-Z])/g, ' $1').trim(); btn.onclick = () => zoomTo(key); box.appendChild(btn);
            });
            renderGuides(); forceLocks();
        }
    });
}

function switchSide(name) {
    if(CONFIG.sides[State.side]) { CONFIG.sides[State.side].json = getCleanJSON(); }
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById('nav-'+name).classList.add('active');
    State.side = name; 
    loadSide(name).then(() => { 
        if(CONFIG.sides[name].json) { 
            fabric.util.enlivenObjects(CONFIG.sides[name].json, (objs) => { objs.forEach(o => { canvas.add(o); }); canvas.renderAll(); saveState(); }); 
        } 
        updatePricing(); 
    });
}

function getCleanJSON() { return canvas.toJSON(['name']).objects.filter(o => !o.name?.startsWith('guide') && o.name !== 'mockup' && !o.name?.startsWith('snap-line')); }

function updateGarmentType() {
    const newType = document.getElementById('opt-type').value;
    if (State.currentType === 'Hoodie') { Runtime_HOODIE = JSON.parse(JSON.stringify(CONFIG.sides)); } else { Runtime_TSHIRT = JSON.parse(JSON.stringify(CONFIG.sides)); }
    if (newType === 'Hoodie') { CONFIG.sides = JSON.parse(JSON.stringify(Runtime_HOODIE)); } else { CONFIG.sides = JSON.parse(JSON.stringify(Runtime_TSHIRT)); }
    State.currentType = newType;
    if(newType === 'Hoodie' && !HOODIE_ALLOWED_COLORS.includes(State.color)) { State.color = "Black"; document.getElementById('opt-color').value = "Black"; document.getElementById('current-color-name').innerText = "Black"; }
    switchSide(State.side);
}

function changeColor(newColor) {
    State.color = newColor;
    document.getElementById('opt-color').value = newColor; 
    document.getElementById('current-color-name').innerText = newColor; 
    const hex = COLOR_HEX_MAP[newColor] || '#ffffff';
    const triggerBtn = document.getElementById('color-btn-trigger');
    triggerBtn.style.backgroundColor = hex;
    const isDark = getContrastYIQ(hex);
    triggerBtn.style.color = isDark ? '#ffffff' : '#333333';
    triggerBtn.style.borderColor = isDark ? 'transparent' : '#e5e7eb';
    updateActiveColorUI();
    showLoader("Changing Color...");
    const candidates = getCandidateUrls(State.color, State.side);
    tryLoadImages(candidates).then((loadedImg) => {
        const oldMockup = canvas.getObjects().find(o => o.name === 'mockup');
        if(oldMockup) { canvas.remove(oldMockup); }
        const fabricImg = new fabric.Image(loadedImg);
        const cfg = CONFIG.sides[State.side].mockupConfig || { left:0, top:0, scaleX:1, scaleY:1 };
        fabricImg.set({ left: cfg.left, top: cfg.top, scaleX: cfg.scaleX, scaleY: cfg.scaleY, selectable: State.devMode, evented: true, name: 'mockup', hoverCursor: State.devMode ? 'move' : 'default' });
        canvas.add(fabricImg); fabricImg.sendToBack(); renderGuides(); canvas.requestRenderAll(); hideLoader();
    });
}

function toggleColorModal(show) {
    document.getElementById('color-modal').style.display = show ? 'flex' : 'none';
    if(show) {
        const type = document.getElementById('opt-type').value;
        document.querySelectorAll('.color-option').forEach(btn => {
            const colorName = btn.getAttribute('data-color');
            if(type === 'Hoodie' && !HOODIE_ALLOWED_COLORS.includes(colorName)) { btn.classList.add('d-none-type'); } else { btn.classList.remove('d-none-type'); }
        });
        updateActiveColorUI();
    }
}

function updateActiveColorUI() { 
    document.querySelectorAll('.color-option').forEach(btn => { if(btn.innerText === State.color) { btn.classList.add('active'); } else { btn.classList.remove('active'); } }); 
}

function filterColors(query) {
    const term = query.toLowerCase(); const type = document.getElementById('opt-type').value;
    document.querySelectorAll('.color-option').forEach(btn => {
        const name = btn.getAttribute('data-color').toLowerCase(); const realName = btn.getAttribute('data-color');
        let visible = name.includes(term); 
        if(type === 'Hoodie' && !HOODIE_ALLOWED_COLORS.includes(realName)) { visible = false; }
        if(visible) { btn.classList.remove('d-none'); btn.style.display='flex'; } else { btn.classList.add('d-none'); btn.style.display='none'; }
    });
}

function toggleGuides() {
    State.guidesVisible = !State.guidesVisible;
    const btn = document.getElementById('guide-toggle-btn'); const icon = btn.querySelector('i');
    if(State.guidesVisible) { icon.innerText = 'visibility'; btn.style.color = '#4b5563'; } else { icon.innerText = 'visibility_off'; btn.style.color = '#d1d5db'; }
    Object.values(State.guides).forEach(rect => { rect.set('visible', State.guidesVisible); });
    canvas.requestRenderAll();
}

function renderGuides() {
    canvas.getObjects().forEach(o => { if(o.name?.startsWith('guide')) { canvas.remove(o); } });
    State.guides = {}; 
    const hex = COLOR_HEX_MAP[State.color] || '#ffffff'; const isDark = getContrastYIQ(hex);
    const guideColor = isDark ? '#ffffff' : '#333333'; 
    const areas = CONFIG.sides[State.side].areas;
    Object.keys(areas).forEach(key => {
        const a = areas[key];
        const rect = new fabric.Rect({ left: a.x, top: a.y, width: a.w, height: a.h, fill: 'transparent', stroke: guideColor, strokeWidth: 1, strokeDashArray: [4, 4], selectable: State.devMode, evented: true, hasControls: State.devMode, lockMovementX: !State.devMode, lockMovementY: !State.devMode, lockScalingX: !State.devMode, lockScalingY: !State.devMode, hoverCursor: State.devMode ? 'move' : 'default', cornerColor: 'red', cornerSize: 15, transparentCorners: false, name: 'guide-'+key, visible: State.guidesVisible });
        rect.on('modified', () => { if(State.devMode) { areas[key] = { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.getScaledWidth()), h: Math.round(rect.getScaledHeight()), zoom: a.zoom }; updateAdminOutput(); } });
        State.guides[key] = rect; canvas.add(rect); 
        const bg = canvas.getObjects().find(o => o.name === 'mockup'); if(bg) { rect.bringToFront(); }
    });
    canvas.getObjects().forEach(o => { if(o.name !== 'mockup' && !o.name?.startsWith('guide')) { o.bringToFront(); } });
}

function zoomTo(key) {
    State.area = key; 
    const hex = COLOR_HEX_MAP[State.color] || '#ffffff'; const isDark = getContrastYIQ(hex); const baseColor = isDark ? '#ffffff' : '#333333';
    Object.values(State.guides).forEach(g => g.set({ stroke: baseColor, strokeWidth: 1 })); 
    if(State.guides[key]) { State.guides[key].set({ stroke: '#ffae00', strokeWidth: 2 }); }
    const area = CONFIG.sides[State.side].areas[key];
    const targetZoom = area.zoom; const boxCx = area.x + area.w / 2; const boxCy = area.y + area.h / 2;
    const targetPanX = (canvas.width / 2) - (boxCx * targetZoom); const targetPanY = (canvas.height / 2) - (boxCy * targetZoom);
    fabric.util.animate({ startValue: 0, endValue: 1, duration: 600, easing: fabric.util.ease.easeInOutQuad, onChange: function(val) { const z = canvas.getZoom() + (targetZoom - canvas.getZoom()) * val; const curPanX = canvas.viewportTransform[4]; const curPanY = canvas.viewportTransform[5]; const nextPanX = curPanX + (targetPanX - curPanX) * val; const nextPanY = curPanY + (targetPanY - curPanY) * val; canvas.setZoom(z); canvas.viewportTransform[4] = nextPanX; canvas.viewportTransform[5] = nextPanY; canvas.requestRenderAll(); } });
}

function resetView() {
    fabric.util.animate({ startValue: 0, endValue: 1, duration: 600, easing: fabric.util.ease.easeInOutQuad, onChange: (val) => { const z = canvas.getZoom() + (1 - canvas.getZoom()) * val; const panX = canvas.viewportTransform[4] * (1 - val); const panY = canvas.viewportTransform[5] * (1 - val); canvas.setZoom(z); canvas.viewportTransform[4] = panX; canvas.viewportTransform[5] = panY; canvas.requestRenderAll(); } });
    const hex = COLOR_HEX_MAP[State.color] || '#ffffff'; const isDark = getContrastYIQ(hex); const baseColor = isDark ? '#ffffff' : '#333333';
    Object.values(State.guides).forEach(g => g.set({ stroke: baseColor, strokeWidth: 1 }));
}

function zoomCanvas(factor) { 
    var zoom = canvas.getZoom() * factor; if(zoom > 20) zoom = 20; if(zoom < 0.1) zoom = 0.1; 
    var center = { x: canvas.width / 2, y: canvas.height / 2 }; canvas.zoomToPoint(center, zoom); 
}

canvas.on('mouse:down', (opt) => {
    if(State.devMode) return; 
    const target = opt.target;
    if(target && target.name && target.name.startsWith('guide-')) { zoomTo(target.name.replace('guide-', '')); return; }
    if(!target || (target.name === 'mockup')) { if(canvas.getZoom() > 1.05) { resetView(); } return; }
});

canvas.on('selection:created', (e) => { 
    if (State.devMode) return; 
    if (e.selected && e.selected.length > 0) { const isGuide = e.selected.some(obj => obj.name && obj.name.startsWith('guide-')); if (isGuide) { canvas.discardActiveObject(); canvas.requestRenderAll(); return; } } 
    updateUI(); 
});

document.getElementById('file-input').onchange = (e) => { processUpload(e.target.files[0]); };

function setupDragDrop() { 
    const stage = document.getElementById('studio-stage'); const overlay = document.getElementById('drop-overlay'); 
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { stage.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false); }); 
    stage.addEventListener('dragenter', () => overlay.classList.add('active'), false); 
    stage.addEventListener('dragleave', (e) => { if (e.relatedTarget && !stage.contains(e.relatedTarget)) { overlay.classList.remove('active'); } }, false); 
    stage.addEventListener('drop', (e) => { overlay.classList.remove('active'); if(e.dataTransfer.files.length > 0) { processUpload(e.dataTransfer.files[0]); } }, false); 
}

function processUpload(file) { 
    if(!file) return; 
    if(file.size > 10 * 1024 * 1024) { alert("File is too large! Maximum 10MB."); return; } 
    State.uploads.push(file); 
    const thumb = document.createElement('img'); thumb.className = 'asset-thumb'; 
    const reader = new FileReader(); 
    reader.onload = (e) => { thumb.src = e.target.result; document.getElementById('asset-preview').appendChild(thumb); }; 
    reader.readAsDataURL(file); 
    thumb.onclick = () => { if(file.type === 'application/pdf') { loadPDF(file); } else { const r = new FileReader(); r.onload = (f) => fabric.Image.fromURL(f.target.result, (img) => addToCanvas(img)); r.readAsDataURL(file); } }; 
    if(file.type === 'application/pdf') { loadPDF(file); } else { const reader = new FileReader(); reader.onload = (f) => fabric.Image.fromURL(f.target.result, (img) => addToCanvas(img)); reader.readAsDataURL(file); } 
}

async function loadPDF(file) { 
    const buffer = await file.arrayBuffer(); const pdf = await pdfjsLib.getDocument(buffer).promise; 
    const page = await pdf.getPage(1); const viewport = page.getViewport({ scale: 100.0 }); 
    const c = document.createElement('canvas'); c.width = viewport.width; c.height = viewport.height; 
    const ctx = c.getContext('2d'); await page.render({ canvasContext: ctx, viewport }).promise; 
    const idata = ctx.getImageData(0,0,c.width,c.height); const d = idata.data; 
    for(let i=0; i<d.length; i+=4) { if(d[i]>245 && d[i+1]>245 && d[i+2]>245) { d[i+3] = 0; } }
    ctx.putImageData(idata,0,0); fabric.Image.fromURL(c.toDataURL(), (img) => addToCanvas(img)); 
}

function addToCanvas(obj) {
    if(obj.type === 'image' && obj.getElement()) { obj.set({ width: obj.getElement().naturalWidth, height: obj.getElement().naturalHeight }); }
    const area = CONFIG.sides[State.side].areas[State.area];
    obj.scaleToWidth(area.w * 0.7); if(obj.getScaledHeight() > area.h * 0.7) { obj.scaleToHeight(area.h * 0.7); }
    obj.set({ left: area.x + (area.w/2) - (obj.getScaledWidth()/2), top: area.y + (area.h/2) - (obj.getScaledHeight()/2) });
    obj.setControlsVisibility({ mt:false, mb:false, ml:false, mr:false });
    canvas.add(obj); canvas.setActiveObject(obj); saveState(); updateUI();
    if(obj.type === 'image') { document.getElementById('bg-remove-modal').style.display = 'flex'; }
}

function addText() { 
    const area = CONFIG.sides[State.side].areas[State.area]; 
    const t = new fabric.Textbox('YOUR TEXT', { left: area.x + 20, top: area.y + 40, width: area.w - 40, fontSize: 32, fontFamily: 'Inter', fontWeight: 'bold', fill: '#000000', textAlign: 'center' }); 
    addToCanvas(t); 
}

canvas.on('selection:updated', updateUI); canvas.on('selection:cleared', updateUI);

function updateUI() { 
    const obj = canvas.getActiveObject(); const ui = document.getElementById('editor-ui');
    if(obj && (obj.name==='mockup' || obj.name?.startsWith('guide'))) { ui.classList.add('d-none'); return; }
    if(obj) { 
        ui.classList.remove('d-none'); 
        if(obj.type==='textbox'){ 
            document.getElementById('text-tools').classList.remove('d-none'); 
            document.getElementById('image-tools').classList.add('d-none'); 
            // Update lock icon
            document.getElementById('lock-icon').innerText = obj.lockMovementX ? 'lock' : 'lock_open';
        } else { 
            document.getElementById('text-tools').classList.add('d-none'); 
            document.getElementById('image-tools').classList.remove('d-none'); 
            document.getElementById('lock-icon').innerText = obj.lockMovementX ? 'lock' : 'lock_open';
        } 
    } else { ui.classList.add('d-none'); } 
}

function action(act, param, e) { 
    if(e) e.stopPropagation(); const obj = canvas.getActiveObject(); 
    if(act==='delete' && obj){ canvas.remove(obj); saveState(); updateUI(); } 
    if(act==='copy' && obj) { obj.clone(c => State.clipboard = c); }
    if(act==='paste' && State.clipboard) { State.clipboard.clone(c => { canvas.discardActiveObject(); c.set({ left: c.left+20, top: c.top+20, evented: true }); canvas.add(c); canvas.setActiveObject(c); saveState(); updateUI(); }); }
    if(act==='undo'){ if(State.undo.length<=1) return; State.redo.push(State.undo.pop()); loadState(State.undo[State.undo.length-1]); } 
    if(act==='redo'){ if(State.redo.length===0) return; const json = State.redo.pop(); State.undo.push(json); loadState(json); } 
}

function duplicateObject() {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.clone(cloned => {
        cloned.set({ left: obj.left + 20, top: obj.top + 20 });
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        saveState();
        updateUI();
    });
}

function toggleLock() {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const newLock = !obj.lockMovementX;
    obj.set({
        lockMovementX: newLock,
        lockMovementY: newLock,
        lockScalingX: newLock,
        lockScalingY: newLock,
        lockRotation: newLock,
        hasControls: !newLock,
        selectable: !newLock,
        hoverCursor: newLock ? 'default' : 'move'
    });
    canvas.renderAll();
    updateUI();
}

function toggleShadow() {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    if (obj.shadow) {
        obj.set({ shadow: null });
    } else {
        obj.set({ shadow: 'rgba(0,0,0,0.3) 4px 4px 6px' });
    }
    canvas.renderAll();
    saveState();
}

function updateProp(prop, val) { const obj = canvas.getActiveObject(); if(obj){ obj.set(prop, val); canvas.renderAll(); saveState(); } }

function toggleStyle(s) { const obj = canvas.getActiveObject(); if(!obj) return; if(s==='bold') { obj.set('fontWeight', obj.fontWeight==='bold'?'normal':'bold'); } if(s==='italic') { obj.set('fontStyle', obj.fontStyle==='italic'?'normal':'italic'); } canvas.renderAll(); saveState(); }

function applyFilter(type) { 
    const obj = canvas.getActiveObject(); if(!obj || obj.type!=='image') return; obj.filters = []; 
    if(type==='grayscale') { obj.filters.push(new fabric.Image.filters.Grayscale()); }
    if(type==='sepia') { obj.filters.push(new fabric.Image.filters.Sepia()); }
    if(type==='vintage') { obj.filters.push(new fabric.Image.filters.Vintage()); }
    if(type==='blur') { obj.filters.push(new fabric.Image.filters.Blur({ blur: 0.5 })); }
    if(type==='sharpen') { obj.filters.push(new fabric.Image.filters.Convolute({ matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0] })); }
    obj.applyFilters(); canvas.renderAll(); saveState(); 
}

function resetFilters() {
    const obj = canvas.getActiveObject(); if(!obj || obj.type!=='image') return;
    obj.filters = [];
    obj.applyFilters(); canvas.renderAll(); saveState();
}

function saveState() { 
    if(State.saving) return; const json = canvas.toJSON(['name']); 
    json.objects = json.objects.filter(o => !o.name?.startsWith('guide') && o.name !== 'mockup' && !o.name?.startsWith('snap-line')); 
    State.undo.push(JSON.stringify(json)); State.redo=[]; updateUI(); localStorage.setItem('YAYA_AUTO_SAVE', JSON.stringify(CONFIG.sides)); updatePricing(); 
}

function loadState(json) { 
    State.saving = true; const parsed = JSON.parse(json); 
    canvas.getObjects().forEach(o => { if (!o.name?.startsWith('guide') && o.name !== 'mockup' && !o.name?.startsWith('snap-line')) { canvas.remove(o); } }); 
    fabric.util.enlivenObjects(parsed.objects, (enlivened) => { enlivened.forEach(o => canvas.add(o)); canvas.renderAll(); updateUI(); State.saving = false; }); updatePricing(); 
}

function setupShortcuts() { 
    window.addEventListener('keydown', (e) => { 
        const cmd = e.ctrlKey || e.metaKey; 
        if (e.key === 'Delete' || e.key === 'Backspace') { const obj = canvas.getActiveObject(); if(obj && !obj.isEditing) { e.preventDefault(); action('delete'); } } 
        if (e.key === 'Escape') { e.preventDefault(); resetView(); } 
        if(cmd && e.key==='c') { action('copy'); }
        if(cmd && e.key==='v') { action('paste'); }
        if(cmd && e.key==='d') { e.preventDefault(); duplicateObject(); } // Ctrl+D for duplicate
        if(cmd && e.key==='z') { e.preventDefault(); e.shiftKey ? action('redo') : action('undo'); } 
    }); 
}

function initSnapping() {
    canvas.on('object:moving', (e) => { 
        if(State.devMode) return; const obj = e.target; const area = CONFIG.sides[State.side].areas[State.area]; if(!area) return; 
        const areaCenterX = area.x + (area.w / 2); const areaCenterY = area.y + (area.h / 2); const objCenterX = obj.left + (obj.getScaledWidth() / 2); const objCenterY = obj.top + (obj.getScaledHeight() / 2); const SNAP_DIST = 10; 
        if (Math.abs(objCenterX - areaCenterX) < SNAP_DIST) { obj.set({ left: areaCenterX - (obj.getScaledWidth() / 2) }); drawSnapLine(areaCenterX, null); } else { clearSnapLine('v'); } 
        if (Math.abs(objCenterY - areaCenterY) < SNAP_DIST) { obj.set({ top: areaCenterY - (obj.getScaledHeight() / 2) }); drawSnapLine(null, areaCenterY); } else { clearSnapLine('h'); } 
    });
    canvas.on('mouse:up', () => { clearSnapLine('all'); });
}

function drawSnapLine(x, y) { 
    if (x !== null) { let line = canvas.getObjects().find(o => o.name === 'snap-line-v'); if (!line) { line = new fabric.Line([x, 0, x, 10000], { stroke: '#00bfff', strokeWidth: 1, selectable: false, evented: false, name: 'snap-line-v', strokeDashArray: [5, 5] }); canvas.add(line); } line.set({ x1: x, x2: x }); } 
    if (y !== null) { let line = canvas.getObjects().find(o => o.name === 'snap-line-h'); if (!line) { line = new fabric.Line([0, y, 10000, y], { stroke: '#00bfff', strokeWidth: 1, selectable: false, evented: false, name: 'snap-line-h', strokeDashArray: [5, 5] }); canvas.add(line); } line.set({ y1: y, y2: y }); } 
    canvas.requestRenderAll(); 
}

function clearSnapLine(type) { 
    if(type === 'v' || type === 'all') { const line = canvas.getObjects().find(o => o.name === 'snap-line-v'); if (line) { canvas.remove(line); } } 
    if(type === 'h' || type === 'all') { const line = canvas.getObjects().find(o => o.name === 'snap-line-h'); if (line) { canvas.remove(line); } } 
    canvas.requestRenderAll(); 
}

function toggleAdmin() { 
    State.devMode = !State.devMode; document.getElementById('admin-panel').style.display = State.devMode ? 'block' : 'none'; 
    const mockup = canvas.getObjects().find(o => o.name === 'mockup'); if(mockup) { mockup.set({ selectable: State.devMode, hoverCursor: State.devMode ? 'move' : 'default' }); } renderGuides(); updateAdminOutput(); canvas.requestRenderAll(); 
}

function updateAdminOutput() { 
    const type = document.getElementById('opt-type').value; const varName = (type === 'Hoodie') ? "HOODIE_CONFIG" : "TSHIRT_CONFIG"; 
    const cleanConfig = { front: CONFIG.sides.front, back: CONFIG.sides.back }; cleanConfig.front.json = []; cleanConfig.back.json = []; 
    document.getElementById('admin-output').value = \`const \${varName} = \` + JSON.stringify(cleanConfig, null, 2) + ";"; 
}

function openConfirmModal() { 
    Object.values(State.guides).forEach(r=>r.visible=false); canvas.setZoom(1); canvas.absolutePan(new fabric.Point(0,0)); 
    document.getElementById('confirm-modal').style.display = 'flex'; renderGuides(); 
}

function closeModal() { document.getElementById('confirm-modal').style.display = 'none'; }

function dataURItoBlob(dataURI) { 
    var byteString=atob(dataURI.split(',')[1]); var ab=new ArrayBuffer(byteString.length); var ia=new Uint8Array(ab); 
    for(var i=0;i<byteString.length;i++){ ia[i]=byteString.charCodeAt(i); } return new Blob([ab],{type:'image/png'}); 
}

async function uploadToImgBB(blob, nameSuffix) { 
    const formData = new FormData(); formData.append("image", blob); formData.append("key", IMGBB_API_KEY); formData.append("name", "YAYA-" + nameSuffix); 
    const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData }); 
    const result = await response.json(); 
    if (result.success) { return result.data.url; } 
    throw new Error("Upload Failed"); 
}

function drawStudioItem(ctx, img, x, y, w, h, label) {
    if (!img) return;
    const scale = Math.min(w / img.width, h / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = x + (w - drawW) / 2;
    const drawY = y + (h - drawH) / 2;
    
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
    
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(drawX - 2, drawY - 2, drawW + 4, drawH + 4);
    ctx.restore();
    
    if (label) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = "#1f2937";
        ctx.font = "800 48px 'Poppins', 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.letterSpacing = "4px";
        ctx.fillText(label.toUpperCase(), x + (w / 2), y + h - 80);
        ctx.restore();
    }
}

async function composeStudioMockup(frontSrc, backSrc, mode) {
    return new Promise((resolve) => {
        const c = document.createElement('canvas'); 
        const ctx = c.getContext('2d');
        const width = 4000; 
        const height = (mode === 'dual') ? 2200 : 4000; 
        c.width = width; 
        c.height = height;
        
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#f0f4fa");
        gradient.addColorStop(0.5, "#e6ecf5");
        gradient.addColorStop(1, "#d9e0eb");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        for (let i = 0; i < 1000; i++) {
            ctx.fillRect(Math.random()*width, Math.random()*height, 2, 2);
        }
        
        const vignette = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width*0.8);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);
        
        const imgFront = new Image(); 
        const imgBack = new Image();
        const drawScene = () => {
            const padding = 200;
            if (mode === 'dual') {
                const boxW = (width - (padding * 3)) / 2; 
                const boxH = height - (padding * 2);
                drawStudioItem(ctx, imgFront, padding, padding, boxW, boxH, "FRONT DESIGN");
                if(backSrc) { 
                    drawStudioItem(ctx, imgBack, (padding * 2) + boxW, padding, boxW, boxH, "BACK DESIGN"); 
                }
                ctx.save();
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(padding + boxW + padding/2, padding);
                ctx.lineTo(padding + boxW + padding/2, height - padding);
                ctx.stroke();
                ctx.restore();
            } else if (mode === 'front') {
                const boxSize = 2800; 
                const x = (width - boxSize) / 2; 
                const y = (height - boxSize) / 2;
                drawStudioItem(ctx, imgFront, x, y, boxSize, boxSize, "FRONT VIEW");
            } else if (mode === 'back') {
                const boxSize = 2800; 
                const x = (width - boxSize) / 2; 
                const y = (height - boxSize) / 2;
                drawStudioItem(ctx, imgBack, x, y, boxSize, boxSize, "BACK VIEW");
            }
            
            ctx.save();
            ctx.globalAlpha = 0.1;
            ctx.font = "italic 280px 'Poppins', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#333";
            ctx.fillText("YAYA", width/2, height/2 - 100);
            ctx.fillText("PRINTS", width/2, height/2 + 100);
            ctx.restore();
            
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 20;
            ctx.strokeRect(10, 10, width-20, height-20);
            ctx.restore();
            
            resolve(c.toDataURL('image/jpeg', 1.0));
        };
        
        if (mode === 'dual') { 
            imgFront.onload = () => { 
                if (backSrc) { 
                    imgBack.onload = drawScene; 
                    imgBack.src = backSrc; 
                } else { 
                    drawScene(); 
                } 
            }; 
            imgFront.src = frontSrc; 
        } else if (mode === 'front') { 
            imgFront.onload = drawScene; 
            imgFront.src = frontSrc; 
        } else if (mode === 'back') { 
            imgBack.onload = drawScene; 
            imgBack.src = backSrc; 
        }
    });
}

async function safeSubmit() {
    const name = document.getElementById('ui-name').value; 
    const email = document.getElementById('ui-email').value;
    if(!name || !email) { alert("Please enter your Name and Email to complete the order."); return; }
    if(CONFIG.sides[State.side]) { CONFIG.sides[State.side].json = getCleanJSON(); }

    const status = document.getElementById('status-msg'); const bar = document.getElementById('progress-bar-fill');
    const box = document.getElementById('progress-bar-container'); const btn = document.getElementById('submit-trigger-btn'); const cancelBtn = document.getElementById('cancel-btn');

    btn.disabled = true; cancelBtn.disabled = true; box.style.display='block';
    
    try {
        showLoader("Capturing Design..."); status.innerText = "Analyzing Front Side..."; bar.style.width = "10%";
        await loadSide('front'); 
        if(CONFIG.sides['front'].json) { await new Promise(r => { fabric.util.enlivenObjects(CONFIG.sides['front'].json, (objs) => { objs.forEach(o => canvas.add(o)); canvas.renderAll(); setTimeout(r, 500); }); }); }
        Object.values(State.guides).forEach(r => r.visible=false); canvas.setZoom(1); canvas.absolutePan(new fabric.Point(0,0));
        const rawFront = canvas.toDataURL({ format: 'png', multiplier: 5 });

        status.innerText = "Analyzing Back Side..."; bar.style.width = "30%";
        await loadSide('back');
        if(CONFIG.sides['back'].json) { await new Promise(r => { fabric.util.enlivenObjects(CONFIG.sides['back'].json, (objs) => { objs.forEach(o => canvas.add(o)); canvas.renderAll(); setTimeout(r, 500); }); }); }
        Object.values(State.guides).forEach(r => r.visible=false); canvas.setZoom(1); canvas.absolutePan(new fabric.Point(0,0));
        const rawBack = canvas.toDataURL({ format: 'png', multiplier: 5 });

        status.innerText = "Generating Professional Photos..."; bar.style.width = "50%";
        const renderDual = await composeStudioMockup(rawFront, rawBack, 'dual');
        const renderFront = await composeStudioMockup(rawFront, null, 'front');
        const renderBack = await composeStudioMockup(null, rawBack, 'back');

        status.innerText = "Uploading High-Res Proofs..."; bar.style.width = "70%";
        const urlDual = await uploadToImgBB(dataURItoBlob(renderDual), "PROOF-FULL");
        const urlFront = await uploadToImgBB(dataURItoBlob(renderFront), "PROOF-FRONT");
        const urlBack = await uploadToImgBB(dataURItoBlob(renderBack), "PROOF-BACK");

        let originalFilesList = "None (Text Only Design)";
        let assetLinks = "";
        if(State.uploads.length > 0) { 
            status.innerText = "Uploading Your Source Files..."; 
            const uploaded = await uploadClientFiles(); 
            originalFilesList = uploaded.map(f => \`\${f.name}: \${f.url}\`).join(" | ");
            assetLinks = originalFilesList;
        }

        status.innerText = "Emailing Copy to Store..."; bar.style.width = "80%";

        const garmentType = document.getElementById('opt-type').value; 
        const garmentColor = State.color; 
        const rushStatus = document.getElementById('opt-time').value;
        const phone = document.getElementById('ui-phone').value || "N/A";
        const business = document.getElementById('ui-business').value || "N/A";
        const notes = document.getElementById('ui-notes').value || "None";
        const qty = document.getElementById('opt-qty').value;

        const sizeArr = [];
        document.querySelectorAll('.qty-input-small').forEach(input => {
            const val = parseInt(input.value) || 0;
            if(val > 0) sizeArr.push(\`\${input.dataset.size}: \${val}\`);
        });
        const sizeString = sizeArr.join(', ');

        const emailMsg = \`New Order Request (Pre-Checkout)\\n----------------\\nCLIENT INFO:\\nName: \${name}\\nBusiness: \${business}\\nEmail: \${email}\\nPhone: \${phone}\\n\\nORDER NOTES:\\n\${notes}\\n\\nDETAILS:\\nItem: \${garmentType}\\nColor: \${garmentColor}\\nTotal Qty: \${qty}\\nProduction: \${rushStatus}\\n\\n=== FULL PROOF ===\\n\${urlDual}\\n\\n=== FRONT VIEW ===\\n\${urlFront}\\n\\n=== BACK VIEW ===\\n\${urlBack}\\n\\n=== QUANTITY BREAKDOWN ===\\n\${sizeString}\\n\\n=== ORIGINAL ASSETS ===\\n\${assetLinks}\`;

        document.getElementById('hidden-body').value = emailMsg;
        const emailForm = document.getElementById('email-form');
        const emailData = new FormData(emailForm);
        
        try {
            await fetch("https://formsubmit.co/ajax/info@yayasports.ca", {
                method: "POST",
                body: emailData
            });
            console.log("Email sent successfully.");
        } catch (emailErr) {
            console.warn("Email submission failed:", emailErr);
        }

        status.innerText = "Adding to Cart..."; bar.style.width = "90%";

        const totalText = document.getElementById('ui-total').innerText;
        const totalPrice = parseFloat(totalText.replace(/[^0-9.]/g, ''));
        const itemsToAdd = Math.round(totalPrice); 

        const payload = {
            items: [{
                id: 51807741182231, // Variant ID for Custom Item
                quantity: itemsToAdd,
                properties: {
                    '_Real_Qty_Items': qty,
                    'Custom Project': 'YAYA Prints Customizer',
                    'Client Name': name,
                    'Business': business,
                    'Email': email,
                    'Phone': phone,
                    'Garment': \`\${garmentColor} \${garmentType}\`,
                    'Sizes': sizeString,
                    'Production': rushStatus,
                    'Note': 'Qty represents Total Price',
                    'Design Proof': urlDual,
                    'Front View': urlFront,
                    'Back View': urlBack,
                    'Source Files': assetLinks
                }
            }]
        };

        await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(resp => {
            if(!resp.ok) throw new Error('Could not add to cart');
            return resp.json();
        }).then(() => {
            bar.style.width = "100%";
            setTimeout(() => { window.location.href = '/checkout'; }, 1000);
        });

    } catch(err) {
        console.error(err); hideLoader();
        alert("We encountered an error processing the order. Please try again or contact support.\\n\\nError: " + err.message);
        btn.disabled = false; cancelBtn.disabled = false; box.style.display='none';
    }
}

function getFormattedSizes() {
    let str = ""; document.querySelectorAll('.qty-input-small').forEach(i => { if(parseInt(i.value) > 0) str += \`\${i.getAttribute('data-size')}: \${i.value} | \`; });
    return str || "No sizes selected";
}

async function uploadClientFiles() {
    const uploadedFileURLs = [];
    for (const file of State.uploads) {
        try {
            const formData = new FormData(); formData.append("image", file); formData.append("key", IMGBB_API_KEY); formData.append("name", "CLIENT-" + file.name);
            const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
            const result = await response.json();
            if (result.success) uploadedFileURLs.push({ name: file.name, url: result.data.url });
        } catch (error) { console.error(error); }
    }
    return uploadedFileURLs;
}

function removeWhiteBackground(imageElement, tolerance) {
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
    const w = imageElement.naturalWidth || imageElement.width; const h = imageElement.naturalHeight || imageElement.height;
    canvas.width = w; canvas.height = h; ctx.drawImage(imageElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h); const data = imageData.data; const limit = 255 - tolerance;
    for (let i = 0; i < data.length; i += 4) { if (data[i] > limit && data[i+1] > limit && data[i+2] > limit) data[i + 3] = 0; }
    ctx.putImageData(imageData, 0, 0); return canvas.toDataURL();
}

function removeEdgeBackground(imageElement, tolerance) {
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
    const w = imageElement.naturalWidth || imageElement.width; const h = imageElement.naturalHeight || imageElement.height;
    canvas.width = w; canvas.height = h; ctx.drawImage(imageElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h); const data = imageData.data;
    function isWhite(r, g, b) { const limit = 255 - tolerance; return r > limit && g > limit && b > limit; }
    const stack = []; const visited = new Uint8Array(w * h);
    for (let x = 0; x < w; x++) { stack.push([x, 0]); stack.push([x, h - 1]); }
    for (let y = 0; y < h; y++) { stack.push([0, y]); stack.push([w - 1, y]); }
    while (stack.length) { 
        const [x, y] = stack.pop(); const idx = (y * w + x); if (visited[idx]) continue; visited[idx] = 1; const dataIdx = idx * 4; 
        if (data[dataIdx + 3] === 0 || isWhite(data[dataIdx], data[dataIdx + 1], data[dataIdx + 2])) {
            data[dataIdx + 3] = 0; if (x > 0) stack.push([x - 1, y]); if (x < w - 1) stack.push([x + 1, y]); if (y > 0) stack.push([x, y - 1]); if (y < h - 1) stack.push([x, y + 1]);
        }
    }
    ctx.putImageData(imageData, 0, 0); return canvas.toDataURL();
}

function closeBgModal() { document.getElementById('bg-remove-modal').style.display = 'none'; }

function applyBgChoice(mode) {
    const obj = canvas.getActiveObject(); if (!obj || obj.type !== 'image') { closeBgModal(); return; }
    closeBgModal(); showLoader("Processing Background...");
    setTimeout(() => {
        try {
            if (!obj._originalSrc) { obj._originalSrc = obj.getSrc(); }
            const tempImg = new Image(); tempImg.crossOrigin = "anonymous";
            tempImg.onload = function() {
                let newSrc;
                if (mode === 'global') newSrc = removeWhiteBackground(tempImg, BG_TOLERANCE); else if (mode === 'edge') newSrc = removeEdgeBackground(tempImg, BG_TOLERANCE); else { const c = document.createElement('canvas'); c.width = tempImg.naturalWidth; c.height = tempImg.naturalHeight; c.getContext('2d').drawImage(tempImg, 0, 0); newSrc = c.toDataURL(); }
                obj.setSrc(newSrc, function() { obj._isBackgroundRemoved = true; obj._bgMode = mode; canvas.renderAll(); saveState(); hideLoader(); });
            };
            tempImg.src = obj._originalSrc;
        } catch(e) { triggerError("Error during removal."); }
    }, 150);
}

function toggleWhiteBG() { applyBgChoice('global'); }
function toggleEdgeBG() { applyBgChoice('edge'); }

function toggleColorSwapSection() { document.getElementById('color-swap-tools').classList.toggle('d-none'); }
function hexToRgb(hex) { const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null; }

function colorReplace(imageElement, targetHex, replaceHex, tolerancePercent) {
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
    const w = imageElement.naturalWidth; const h = imageElement.naturalHeight; canvas.width = w; canvas.height = h; ctx.drawImage(imageElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h); const data = imageData.data; const target = hexToRgb(targetHex); const replace = hexToRgb(replaceHex);
    const threshold = (tolerancePercent / 100) * 441.6;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 10) continue;
        const dist = Math.sqrt(Math.pow(data[i]-target.r, 2) + Math.pow(data[i+1]-target.g, 2) + Math.pow(data[i+2]-target.b, 2));
        if (dist <= threshold) { data[i] = replace.r; data[i + 1] = replace.g; data[i + 2] = replace.b; }
    }
    ctx.putImageData(imageData, 0, 0); return canvas.toDataURL();
}

function applyColorSwapLogic() {
    const obj = canvas.getActiveObject(); if (!obj) return;
    const targetHex = document.getElementById('swap-target').value; const replaceHex = document.getElementById('swap-replace').value; const tolerance = parseInt(document.getElementById('swap-tolerance').value);
    showLoader("Swapping Colors...");
    setTimeout(() => {
        const tempImg = new Image(); tempImg.crossOrigin = "anonymous";
        tempImg.onload = function() { const newSrc = colorReplace(tempImg, targetHex, replaceHex, tolerance); obj.setSrc(newSrc, function() { canvas.renderAll(); saveState(); hideLoader(); }); };
        tempImg.src = obj.getSrc();
    }, 100);
}

// ============================================
// UPDATED PRICING LOGIC
// ============================================
function updatePricing() {
    const MIN_ORDER = 6;
    const BASE_PRICE = 24.00;
    const BACK_PRINT_COST = 5.00;
    
    // 1. Calculate Total Qty & Size Upcharges
    let totalQty = 0;
    let sizeUpchargeTotal = 0; 

    document.querySelectorAll('.qty-input-small').forEach(input => {
        const qty = parseInt(input.value) || 0;
        const size = input.dataset.size;
        totalQty += qty;

        // Upcharge Logic
        if (size === '2XL') sizeUpchargeTotal += (3.00 * qty);
        if (size === '3XL') sizeUpchargeTotal += (5.00 * qty);
        if (size === '4XL') sizeUpchargeTotal += (5.00 * qty);
        if (size === '5XL') sizeUpchargeTotal += (5.00 * qty);
    });

    // 2. Check Back Print Status
    let hasBackDesign = false;
    
    // Check saved JSON
    if (CONFIG.sides.back.json && CONFIG.sides.back.json.length > 0) {
        hasBackDesign = true;
    } 
    // Check active canvas if we are on the back side
    else if (State.side === 'back') {
        const currentObjects = canvas.getObjects().filter(o => !o.name?.startsWith('guide') && o.name !== 'mockup');
        if (currentObjects.length > 0) hasBackDesign = true;
    }

    // 3. Determine Discount Tier
    let discountPercent = 0;
    if (totalQty >= 12 && totalQty <= 23) discountPercent = 0.10;
    else if (totalQty >= 24 && totalQty <= 47) discountPercent = 0.15;
    else if (totalQty >= 48 && totalQty <= 71) discountPercent = 0.20;
    else if (totalQty >= 72) discountPercent = 0.25;

    // 4. Calculate Final Prices
    const rawUnitCost = BASE_PRICE + (hasBackDesign ? BACK_PRINT_COST : 0);
    const discountedUnitCost = rawUnitCost * (1 - discountPercent);
    const totalBaseCost = discountedUnitCost * totalQty;
    const grandTotal = totalBaseCost + sizeUpchargeTotal;
    const avgPricePerItem = totalQty > 0 ? (grandTotal / totalQty) : discountedUnitCost;

    // 5. Update UI
    const uiTotal = document.getElementById('ui-total');
    const uiPerItem = document.getElementById('ui-per-item');
    const uiDiscount = document.getElementById('ui-discount-tag');
    const uiWarning = document.getElementById('price-warning-box');
    const atcBtn = document.getElementById('atc-btn');

    // Format Currency
    const fmt = (num) => '$' + num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    uiTotal.innerText = fmt(grandTotal);
    uiPerItem.innerText = fmt(avgPricePerItem);

    // Show Discount Badge
    if (discountPercent > 0) {
        uiDiscount.classList.remove('d-none');
        uiDiscount.innerText = \`-\${(discountPercent * 100)}% BULK SAVE\`;
    } else {
        uiDiscount.classList.add('d-none');
    }

    // Handle Minimum Order Logic
    if (totalQty < MIN_ORDER) {
        uiWarning.classList.remove('d-none');
        atcBtn.disabled = true;
        atcBtn.style.opacity = "0.5";
        atcBtn.innerHTML = \`MINIMUM \${MIN_ORDER} ITEMS\`;
    } else {
        uiWarning.classList.add('d-none');
        atcBtn.disabled = false;
        atcBtn.style.opacity = "1";
        atcBtn.innerHTML = \`ADD TO CART & CHECKOUT <i class="material-icons-round">shopping_cart</i>\`;
    }
}
</script>
</body>
</html>
  `;

  useEffect(() => {
    // This allows the iframe to render without conflicting with Next.js Hydration
    if (iframeRef.current) {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(customizerHTML);
        iframeDoc.close();
        setIsLoading(false);
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-70px)] bg-slate-950 w-full overflow-hidden">
      {/* Utility Bar to navigate back since the global layout nav is hidden */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
            <button 
            onClick={() => router.back()} 
            className="text-slate-400 hover:text-white transition text-xs font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg"
            >
            ← Exit Studio
            </button>
            <h2 className="text-white font-black uppercase tracking-widest text-sm">YAYA Studio Engine</h2>
        </div>
      </div>
      
      {/* This iframe isolates your raw HTML/JS code so it runs perfectly 
        without breaking the React architecture of the rest of your dashboard.
      */}
      <div className="flex-grow w-full h-full relative">
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-50">
                <span className="text-white font-black uppercase tracking-widest animate-pulse">Initializing Studio...</span>
            </div>
        )}
        <iframe 
            ref={iframeRef}
            className="w-full h-full border-none m-0 p-0 block bg-white"
            sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-popups"
            title="YAYA Mockup Studio"
        />
      </div>
    </div>
  );
}