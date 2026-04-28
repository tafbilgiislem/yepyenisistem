import { db, ref, set, get, onValue, remove } from "./firebase.js";

// --- GLOBAL DEĞİŞKENLER VE TEMEL ARAÇLAR ---
window.selectedEl = null; window.activeTabId = 'tab-layout'; 
window.currentZoom = 1; window.panX = 0; window.panY = 0; window.historyStack = []; window.historyIndex = -1; 
window.isModified = false; window.clipboard = null;
window.isDraggingElement = false; window.isSpacePressed = false; window.isPanning = false; 
window.panStart = {x:0, y:0}; window.panOffsetStart = {x:0, y:0};
window.resizingEl = null; window.rotatingEl = null; window.radiusingEl = null; window.activeHandle = null; 
window.offset = {x:0, y:0}; window.startP = {x:0, y:0}; window.startData = {}; window.draggedLayerId = null;

window.getSvgDim = function() {
    const svg = document.querySelector('#canvas-inner svg'); let w = 1920, h = 1080;
    if(svg && svg.hasAttribute('viewBox')) { const vb = svg.getAttribute('viewBox').split(/\s+|,/); if(vb.length >= 4) { w = parseFloat(vb[2]); h = parseFloat(vb[3]); } }
    return { w, h };
};
window.getCanvasCenter = function() { const dim = window.getSvgDim(); return { cx: dim.w / 2, cy: dim.h / 2 }; };
window.setD = function(el, key, val) { if(el) el.setAttribute('data-' + key, val); };
window.getD = function(el, key) { return el ? el.getAttribute('data-' + key) : null; };
window.safeColor = function(c) { if(!c) return "#ffffff"; if(c.length === 4 && c.startsWith('#')) return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return c.startsWith('#') && c.length === 7 ? c : "#ffffff"; };

// --- BİLDİRİM VE GİRİŞ ---
window.checkPin = function() {
    const pin = document.getElementById('pin-input').value;
    if(pin === '1234') { 
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.filter = 'blur(0px)';
        window.showToast("Giriş Başarılı!", "success");
    } else {
        window.showToast("Hatalı Şifre!", "error"); document.getElementById('pin-input').value = "";
    }
};

window.showToast = function(msg, type = 'success') {
    const container = document.getElementById('toast-container'); if(!container) return;
    const toast = document.createElement('div'); toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
    toast.innerHTML = `<i class="ph ${icon}"></i> <span>${msg}</span>`; container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, 3000);
};

// --- ARAÇLAR (NESNE EKLEME) ---
window.addNewText = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const center = window.getCanvasCenter();
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text"); t.id = "txt_" + Date.now(); t.setAttribute("class", "duzenlenebilir"); t.setAttribute("x", center.cx); t.setAttribute("y", center.cy); t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "central"); window.setD(t, 'base-font-size', "80"); window.setD(t, 'raw-text', "YENİ METİN"); window.setD(t, 'solid-color', "#ffffff"); t.setAttribute("fill", "#ffffff"); t.setAttribute("font-size", "80"); t.setAttribute("font-family", "sans-serif"); t.textContent = "YENİ METİN";
    svg.appendChild(t); window.selectedEl = t; window.saveState(); window.setupLayers(); window.updateUI(t); window.renderEditor();
};

window.addShape = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const center = window.getCanvasCenter();
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); rect.id = "shp_" + Date.now(); rect.setAttribute("class", "duzenlenebilir"); rect.setAttribute("x", center.cx - 100); rect.setAttribute("y", center.cy - 100); rect.setAttribute("width", 200); rect.setAttribute("height", 200); window.setD(rect, 'solid-color', "#10b981"); rect.setAttribute("fill", "#10b981"); window.setD(rect, 'mask-shape', "none");
    svg.appendChild(rect); window.selectedEl = rect; window.saveState(); window.setupLayers(); window.updateUI(rect); window.renderEditor();
};

// (Video, Hava, Döviz ekleme fonksiyonları buraya dahil...)
window.addWeather = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const center = window.getCanvasCenter();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "wth_" + Date.now(); fo.setAttribute("class", "duzenlenebilir weather-widget"); fo.setAttribute("x", center.cx - 250); fo.setAttribute("y", center.cy - 250); fo.setAttribute("width", 500); fo.setAttribute("height", 500); window.setD(fo, 'city', 'Istanbul'); window.setD(fo, 'theme', 'dark'); window.setD(fo, 'mask-shape', 'circle'); window.setD(fo, 'rx', '0'); fo.setAttribute('font-family', 'sans-serif');
    svg.appendChild(fo); window.updateWeatherDisplay(fo); window.selectedEl = fo; window.saveState(); window.setupLayers(); window.updateUI(fo); window.renderEditor();
};

window.updateWeatherDisplay = async function(el) {
    if (!el || !el.classList.contains('weather-widget')) return;
    const city = window.getD(el, 'city') || 'Istanbul'; const txtColor = window.getD(el, 'text-color') || '#ffffff'; const font = el.getAttribute('font-family') || 'sans-serif';
    el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:${txtColor}; font-family:${font};">Yükleniyor...</div>`;
    try {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`); const data = await res.json();
        const temp = data.current_condition[0].temp_C; el.innerHTML = `<div class="weather-inner" xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; background: radial-gradient(circle, #2a2a2a 0%, #0a0a0a 100%); border-radius: 50%; display:flex; align-items:center; justify-content:center; flex-direction:column; border: 1.5cqw solid #475569; overflow: hidden; color: ${txtColor}; font-family: ${font};"><div style="font-size:30px; font-weight:bold;">${city.toUpperCase()}</div><div style="font-size:50px; font-weight:bold;">${temp}°C</div></div>`;
    } catch(e) { el.innerHTML = `<div style="color:red; background:#000; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">Veri Hatası</div>`; }
};

// --- ARAYÜZ VE ÖZELLİKLER PANELI (UI) ---
window.refreshAutoTextFields = function() {
    const list = document.getElementById('auto-fields-list'); const svg = document.querySelector('#canvas-inner svg'); if(!svg || !list) return;
    const textElements = svg.querySelectorAll('text.duzenlenebilir'); list.innerHTML = ""; let hasVars = false;
    textElements.forEach((el, index) => {
        hasVars = true; const varName = el.getAttribute('data-var-name') || `YAZI ${index + 1}`; const currentVal = window.getD(el, 'raw-text') || el.textContent; 
        const row = document.createElement('div'); row.style.marginBottom = "8px";
        row.innerHTML = `<div class="label-row"><span class="label-text" style="color:#f472b6;"><i class="ph ph-text-aa"></i> ${varName}</span></div><input type="text" value="${currentVal.replace(/"/g, '&quot;')}" oninput="window.updateVarValue('${el.id}', this.value)" onchange="window.saveState()" style="border-color:rgba(244,114,182,0.3);">`; 
        list.appendChild(row);
    });
    if(!hasVars) list.innerHTML = `<div style="font-size:11px; color:#64748b; text-align:center;">Sahnede henüz yazı yok. Yazı eklediğinizde burada listelenecektir.</div>`;
};

window.updateVarValue = function(id, val) { 
    const el = document.getElementById(id); if(!el) return; window.changeSetting(id, 'raw-text', val); 
    if(window.selectedEl && window.selectedEl.id === id) { document.querySelectorAll('input[oninput*="raw-text"]').forEach(input => { if(!input.getAttribute('oninput').includes('updateVarValue')) input.value = val; }); } 
};

window.renderEditor = function() { 
    window.renderLayers(); window.refreshAutoTextFields(); 
    if(window.selectedEl) window.renderProperties(); 
    else { const ef = document.getElementById('editor-fields'); if(ef) ef.innerHTML = `<div style="text-align:center; color:#64748b; margin-top:50px; font-style:italic; font-size:13px;"><i class="ph ph-cursor-click" style="font-size:32px; display:block; margin-bottom:15px; color:var(--accent); opacity:0.5;"></i> 👆 Düzenlemek için sahneden veya katmanlardan bir nesne seçin.</div>`; } 
};

window.renderLayers = function() {
    const list = document.getElementById('layers-list'); if(!list) return; list.innerHTML = ""; 
    const domElements = Array.from(document.querySelectorAll('.duzenlenebilir')); const elements = [...domElements].reverse(); 
    const sc = document.getElementById('status-count'); if(sc) sc.innerText = `Nesne Sayısı: ${elements.length}`;
    elements.forEach((el) => {
        const isLocked = window.getD(el, 'locked') === "true"; const isActive = window.selectedEl === el; let typeName = el.tagName.toUpperCase(); 
        if (el.tagName === 'text') typeName = 'METİN'; if(el.tagName === 'rect') typeName = 'KUTU';
        const item = document.createElement('div'); item.className = `layer-item ${isActive ? 'active' : ''}`; item.dataset.id = el.id;
        item.onclick = (e) => { if(e.target.closest('.layer-btn')) return; window.selectedEl = el; window.updateUI(el); window.renderEditor(); };
        item.innerHTML = `<div style="display:flex; align-items:center; gap:8px; flex:1; overflow:hidden;"><i class="ph ph-dots-six-vertical" style="color:#64748b;"></i><span style="flex:1;">${typeName}</span></div><div class="layer-actions"><button class="layer-btn" onclick="window.toggleLock('${el.id}')" title="Kilit"><i class="ph ${isLocked ? 'ph-lock-key' : 'ph-lock-key-open'}"></i></button><button class="layer-btn" style="color:#ef4444;" onclick="document.getElementById('${el.id}').remove(); window.selectedEl=null; window.saveState(); window.renderEditor();"><i class="ph ph-trash"></i></button></div>`; 
        list.appendChild(item);
    });
};

window.renderProperties = function() {
    const f = document.getElementById('editor-fields'); if(!f) return; if (!window.selectedEl) return;
    const el = window.selectedEl; const id = el.id; const isLocked = window.getD(el, 'locked') === "true";
    let headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;"><div style="font-weight:bold; color:white;">ÖZELLİKLER</div></div>`;
    if (isLocked) { f.innerHTML = headerHtml + `<div style="color:#ef4444; text-align:center;">Bu öğe kilitli.</div>`; return; }
    
    let propsHtml = "";
    if (el.tagName === 'text') {
        const rawText = window.getD(el, 'raw-text') || el.textContent;
        propsHtml += `<div class="label-text">METİN İÇERİĞİ</div><input type="text" value="${rawText}" oninput="window.changeSetting('${id}', 'raw-text', this.value); window.refreshAutoTextFields();" onchange="window.saveState()"><br><br>`;
    }
    const x = parseFloat(el.getAttribute("x")) || 0; const y = parseFloat(el.getAttribute("y")) || 0;
    propsHtml += `<div class="label-text">X KONUMU</div><input type="number" value="${Math.round(x)}" oninput="window.changeProp('${id}', 'x', this.value)" onchange="window.saveState()">`;
    propsHtml += `<div class="label-text">Y KONUMU</div><input type="number" value="${Math.round(y)}" oninput="window.changeProp('${id}', 'y', this.value)" onchange="window.saveState()">`;
    
    f.innerHTML = headerHtml + propsHtml;
};

// --- MOTOR (ENGINE) ---
window.updateUI = function(el) {
    const ctrl = document.getElementById('control-layer'); if(!ctrl) return; ctrl.innerHTML = ""; if(!el) return;
    let b = {x:0,y:0,width:0,height:0}; try { b = el.getBBox(); }catch(e){return;}
    const transform = el.getAttribute("transform") || ""; 
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.setAttribute("transform", transform); ctrl.appendChild(g);
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect"); r.setAttribute("x", b.x); r.setAttribute("y", b.y); r.setAttribute("width", b.width); r.setAttribute("height", b.height); r.setAttribute("fill", "none"); r.setAttribute("stroke", "var(--handle-move)"); r.setAttribute("stroke-width", "2"); g.appendChild(r);
};

window.setupLayers = function() {
    const mainSvg = document.querySelector('#canvas-inner svg'); if (!mainSvg) return; 
    mainSvg.querySelectorAll('.duzenlenebilir').forEach(el => {
        if(!el.id) el.id = "el_" + Math.random().toString(36).substr(2,9);
    });
    window.initEngine(mainSvg); window.renderEditor(); window.refreshAutoTextFields();
};

window.initEngine = function(svg) {
    const wrapper = document.getElementById('svg-wrapper');
    const getCoords = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const ctm = svg.getScreenCTM(); return pt.matrixTransform(ctm.inverse()); };
    if(wrapper) {
        wrapper.onpointerdown = (e) => {
            const target = e.target; const el = target.closest('.duzenlenebilir');
            if (el) { window.selectedEl = el; window.isDraggingElement = true; const p = getCoords(e); window.offset.x = p.x - (parseFloat(el.getAttribute("x")) || 0); window.offset.y = p.y - (parseFloat(el.getAttribute("y")) || 0); window.updateUI(el); window.renderEditor(); try { wrapper.setPointerCapture(e.pointerId); } catch(err){} }
            else { if(!e.target.closest('#sidebar')) { window.selectedEl = null; const ctrl = document.getElementById('control-layer'); if(ctrl) ctrl.innerHTML = ""; window.renderEditor(); } }
        };
        wrapper.onpointermove = (e) => {
            if (window.selectedEl && window.isDraggingElement) {
                const p = getCoords(e); window.selectedEl.setAttribute("x", p.x - window.offset.x); window.selectedEl.setAttribute("y", p.y - window.offset.y); window.updateUI(window.selectedEl); window.isModified = true;
            }
        };
        wrapper.onpointerup = (e) => { try { wrapper.releasePointerCapture(e.pointerId); } catch(err){} window.isDraggingElement = false; if (window.isModified) { window.saveState(); window.renderProperties(); window.isModified = false; } };
    }
};

window.saveState = function() {
    const svg = document.querySelector('#canvas-inner svg'); if (!svg) return; 
    const ctrl = document.getElementById('control-layer'); if(ctrl) { const ctrlHTML = ctrl.innerHTML; ctrl.innerHTML = ""; const state = svg.innerHTML; ctrl.innerHTML = ctrlHTML; if (window.historyIndex < window.historyStack.length - 1) window.historyStack = window.historyStack.slice(0, window.historyIndex + 1); window.historyStack.push(state); window.historyIndex++; window.renderLayers(); }
};

window.changeSetting = function(id, key, val) {
    const el = document.getElementById(id); if(!el) return; window.setD(el, key, val);
    if (key === 'raw-text' && el.tagName === 'text') { el.textContent = val; }
    window.updateUI(el);
};

window.changeProp = function(id, prop, val) {
    const el = document.getElementById(id); if(!el) return;
    if(prop === 'x') el.setAttribute('x', val); if(prop === 'y') el.setAttribute('y', val);
    window.updateUI(el);
};

window.onload = function() { window.setupLayers(); };