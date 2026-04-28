import { db, ref, set, get, onValue, remove } from "./firebase.js";

window.selectedEl = null; window.activeTabId = 'tab-layout'; 
window.currentZoom = 1; window.panX = 0; window.panY = 0; window.historyStack = []; window.historyIndex = -1; 
window.isModified = false; window.clipboard = null;
window.isDraggingElement = false; window.isSpacePressed = false; window.isPanning = false; 
window.panStart = {x:0, y:0}; window.panOffsetStart = {x:0, y:0};
window.resizingEl = null; window.rotatingEl = null; window.radiusingEl = null; window.activeHandle = null; 
window.offset = {x:0, y:0}; window.startP = {x:0, y:0}; window.startData = {}; window.draggedLayerId = null;

const googleFonts = [
    { name: "Varsayılan", val: "sans-serif" }, { name: "Times New Roman", val: "'Times New Roman', Times, serif" },
    { name: "Roboto", val: "'Roboto', sans-serif" }, { name: "Montserrat", val: "'Montserrat', sans-serif" }, 
    { name: "Poppins", val: "'Poppins', sans-serif" }, { name: "Oswald", val: "'Oswald', sans-serif" }, { name: "Pacifico", val: "'Pacifico', cursive" }
];

window.getSvgDim = () => {
    const svg = document.querySelector('#canvas-inner svg'); let w = 1920, h = 1080;
    if(svg && svg.hasAttribute('viewBox')) { const vb = svg.getAttribute('viewBox').split(/\s+|,/); if(vb.length >= 4) { w = parseFloat(vb[2]); h = parseFloat(vb[3]); } }
    return { w, h };
};
window.getCanvasCenter = () => { const dim = window.getSvgDim(); return { cx: dim.w / 2, cy: dim.h / 2 }; };
window.setD = (el, key, val) => { if(el) el.setAttribute('data-' + key, val); };
window.getD = (el, key) => el ? el.getAttribute('data-' + key) : null;
window.safeColor = (c) => { if(!c) return "#ffffff"; if(c.length === 4 && c.startsWith('#')) return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return c.startsWith('#') && c.length === 7 ? c : "#ffffff"; };

// --- GİRİŞ VE SİSTEM ARAÇLARI ---
window.checkPin = () => {
    if(document.getElementById('pin-input').value === '1234') { 
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.filter = 'blur(0px)';
        window.showToast("Giriş Başarılı!", "success");
    } else { window.showToast("Hatalı Şifre!", "error"); document.getElementById('pin-input').value = ""; }
};

window.showToast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container'); if(!container) return;
    const toast = document.createElement('div'); toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
    toast.innerHTML = `<i class="ph ${icon}"></i> <span>${msg}</span>`; container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, 3000);
};

// --- FIREBASE VE SLAYT İŞLEMLERİ ---
if(db) {
    onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
        const selector = document.getElementById('file-selector'); if(!selector) return;
        const current = selector.value; selector.innerHTML = "";
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                const opt = document.createElement('option'); opt.value = key; opt.textContent = key.replace(/_/g, ' ').toUpperCase(); selector.appendChild(opt);
            });
            if (current && data[current]) selector.value = current; 
            else if (!current && Object.keys(data).length > 0) { selector.value = Object.keys(data)[0]; window.loadSlide(); }
        }
    });
}

window.loadSlide = async () => {
    window.showToast("Slayt Yükleniyor...", "success");
    try {
        const file = document.getElementById('file-selector')?.value; if(!file) return; const ci = document.getElementById('canvas-inner'); if(!ci) return;
        const snapshot = await get(ref(db, 'sahne/slaytlar/' + file));
        if(snapshot.exists()) ci.innerHTML = snapshot.val(); else ci.innerHTML = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"><rect id="canvas-background" x="0" y="0" width="1920" height="1080" fill="#020617"></rect></svg>`;
        window.historyStack = []; window.historyIndex = -1; window.selectedEl = null;
        setTimeout(() => { window.setupLayers(); window.saveState(); }, 200);
    } catch(e) { window.showToast("Hata!", "error"); }
};

window.saveData = () => {
    if(!db) return; const file = document.getElementById('file-selector')?.value; if(!file) return; const svg = document.querySelector('#canvas-inner svg'); if (!svg) return;
    const ctrl = document.getElementById('control-layer'); 
    if(ctrl) { const ctrlHTML = ctrl.innerHTML; ctrl.innerHTML = ""; set(ref(db, 'sahne/slaytlar/' + file), svg.outerHTML); ctrl.innerHTML = ctrlHTML; }
    window.showToast("Yayına Gönderildi!");
};

// --- NESNE EKLEME (FABRİKA) ---
window.addNewText = () => {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const center = window.getCanvasCenter();
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text"); t.id = "txt_" + Date.now(); t.setAttribute("class", "duzenlenebilir"); t.setAttribute("x", center.cx); t.setAttribute("y", center.cy); t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "central"); window.setD(t, 'base-font-size', "80"); window.setD(t, 'raw-text', "YENİ METİN"); window.setD(t, 'solid-color', "#ffffff"); t.setAttribute("fill", "#ffffff"); t.setAttribute("font-size", "80"); t.setAttribute("font-family", "sans-serif"); t.textContent = "YENİ METİN";
    svg.appendChild(t); window.selectedEl = t; window.saveState(); window.setupLayers(); window.updateUI(t); window.renderEditor();
};

window.addShape = () => {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const center = window.getCanvasCenter();
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); rect.id = "shp_" + Date.now(); rect.setAttribute("class", "duzenlenebilir"); rect.setAttribute("x", center.cx - 100); rect.setAttribute("y", center.cy - 100); rect.setAttribute("width", 200); rect.setAttribute("height", 200); window.setD(rect, 'solid-color', "#10b981"); rect.setAttribute("fill", "#10b981"); window.setD(rect, 'mask-shape', "none");
    svg.appendChild(rect); window.selectedEl = rect; window.saveState(); window.setupLayers(); window.updateUI(rect); window.renderEditor();
};

window.addWeather = () => {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const center = window.getCanvasCenter();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject"); fo.id = "wth_" + Date.now(); fo.setAttribute("class", "duzenlenebilir weather-widget"); fo.setAttribute("x", center.cx - 250); fo.setAttribute("y", center.cy - 250); fo.setAttribute("width", 500); fo.setAttribute("height", 500); window.setD(fo, 'city', 'Istanbul'); window.setD(fo, 'theme', 'dark'); window.setD(fo, 'mask-shape', 'circle'); window.setD(fo, 'rx', '0'); fo.setAttribute('font-family', 'sans-serif');
    svg.appendChild(fo); window.updateWeatherDisplay(fo); window.selectedEl = fo; window.saveState(); window.setupLayers(); window.updateUI(fo); window.renderEditor();
};

window.updateWeatherDisplay = async (el) => {
    if (!el || !el.classList.contains('weather-widget')) return;
    const city = window.getD(el, 'city') || 'Istanbul'; const txtColor = window.getD(el, 'text-color') || '#ffffff'; const font = el.getAttribute('font-family') || 'sans-serif';
    el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${txtColor};font-family:${font}">Yükleniyor...</div>`;
    try {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`); const data = await res.json();
        const temp = data.current_condition[0].temp_C; const engDesc = data.current_condition[0].weatherDesc[0].value;
        const emoji = { "Sunny": "☀️", "Clear": "🌙", "Partly cloudy": "⛅", "Cloudy": "☁️", "Overcast": "☁️", "Heavy rain": "🌧️", "Moderate or heavy rain with thunder": "⛈️" }[engDesc] || "🌤️";
        el.innerHTML = `<div class="weather-inner" xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; background: radial-gradient(circle, #2a2a2a 0%, #0a0a0a 100%); border-radius: 50%; display:flex; flex-direction:column; align-items:center; justify-content:center; border: 1.5cqw solid #475569; overflow: hidden; color: ${txtColor}; font-family: ${font};"><div style="font-size:15cqw;line-height:1;">${emoji}</div><div style="font-size:8cqw;font-weight:bold;margin-top:2cqw;">${city.toUpperCase()}</div><div style="font-size:12cqw;font-weight:bold;color:var(--accent);">${temp}°C</div></div>`;
    } catch(e) { el.innerHTML = `<div style="color:red; background:#000; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">Hata</div>`; }
};

window.addCurrency = () => {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const dim = window.getSvgDim();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject"); fo.id = "cur_" + Date.now(); fo.setAttribute("class", "duzenlenebilir currency-widget"); fo.setAttribute("x", dim.w/2 - 300); fo.setAttribute("y", dim.h/2 - 75); fo.setAttribute("width", 600); fo.setAttribute("height", 150); window.setD(fo, 'currencies', 'USD,EUR,GBP'); window.setD(fo, 'solid-color', '#000000'); window.setD(fo, 'bg-opacity', '0.6'); window.setD(fo, 'text-color', '#ffffff'); window.setD(fo, 'mask-shape', 'none'); window.setD(fo, 'rx', '15'); fo.setAttribute('font-family', 'sans-serif');
    svg.appendChild(fo); window.updateCurrencyDisplay(fo); window.selectedEl = fo; window.saveState(); window.setupLayers(); window.updateUI(fo); window.renderEditor();
};

window.updateCurrencyDisplay = async (el) => {
    if (!el || !el.classList.contains('currency-widget')) return;
    const curs = (window.getD(el, 'currencies') || 'USD,EUR,GBP').split(',').map(c=>c.trim().toUpperCase()); const txtColor = window.getD(el, 'text-color') || '#ffffff'; const font = el.getAttribute('font-family') || 'sans-serif';
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD'); const data = await res.json(); const tryRate = data.rates['TRY'];
        let htmlBlocks = '';
        curs.forEach(c => {
            let val = "0.00"; if(c === 'USD') val = tryRate.toFixed(2); else if(data.rates[c]) val = (tryRate / data.rates[c]).toFixed(2);
            htmlBlocks += `<div style="display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,0.15);padding:2cqw;border-radius:1cqw;min-width:20cqw;"><span style="font-size:5cqw;color:var(--accent);font-weight:bold;">${c}</span><span style="font-size:8cqw;font-weight:800;">₺${val}</span></div>`;
        });
        el.innerHTML = `<div class="currency-inner" xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-evenly;color:${txtColor};font-family:${font};container-type:inline-size;padding:2cqw;background:rgba(0,0,0,0.6);border-radius:15px;">${htmlBlocks}</div>`;
    } catch(e) { el.innerHTML = `<div style="color:red; background:#000; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">Hata</div>`; }
};
// --- KATMANLAR VE HIZLI METİN YÖNETİMİ ---
window.setupLayers = () => {
    const mainSvg = document.querySelector('#canvas-inner svg'); if (!mainSvg) return;
    mainSvg.querySelectorAll('.duzenlenebilir').forEach(el => { if(!el.id) el.id = "el_" + Math.random().toString(36).substr(2,9); });
    window.initEngine(mainSvg); window.renderEditor(); window.refreshAutoTextFields();
};

window.renderEditor = () => { 
    window.renderLayers(); window.refreshAutoTextFields(); 
    if(window.selectedEl) window.renderProperties(); 
    else { const ef = document.getElementById('editor-fields'); if(ef) ef.innerHTML = `<div style="text-align:center;color:#64748b;margin-top:50px;font-style:italic;font-size:13px"><i class="ph ph-cursor-click" style="font-size:32px;display:block;margin-bottom:15px;color:var(--accent);opacity:0.5"></i>👆 Düzenlemek için sahneden veya katmanlardan bir nesne seçin.</div>`; } 
};

window.refreshAutoTextFields = () => {
    const list = document.getElementById('auto-fields-list'); const svg = document.querySelector('#canvas-inner svg'); if(!svg || !list) return;
    const textElements = svg.querySelectorAll('text.duzenlenebilir'); list.innerHTML = ""; let hasVars = false;
    textElements.forEach((el, index) => {
        hasVars = true; const varName = el.getAttribute('data-var-name') || `YAZI ${index + 1}`; const currentVal = window.getD(el, 'raw-text') || el.textContent; 
        const row = document.createElement('div'); row.style.marginBottom = "8px";
        row.innerHTML = `<div class="label-row"><span class="label-text" style="color:#f472b6;"><i class="ph ph-text-aa"></i> ${varName}</span></div><input type="text" value="${currentVal.replace(/"/g, '&quot;')}" oninput="window.changeSetting('${el.id}', 'raw-text', this.value); if(window.selectedEl && window.selectedEl.id === '${el.id}') window.renderProperties();" onchange="window.saveState()" style="border-color:rgba(244,114,182,0.3);">`; 
        list.appendChild(row);
    });
    if(!hasVars) list.innerHTML = `<div style="font-size:11px;color:#64748b;text-align:center;">Sahnede henüz yazı yok.</div>`;
};

window.renderLayers = () => {
    const list = document.getElementById('layers-list'); if(!list) return; list.innerHTML = ""; 
    const domElements = Array.from(document.querySelectorAll('.duzenlenebilir')); const elements = [...domElements].reverse(); 
    document.getElementById('status-count').innerText = `Nesne Sayısı: ${elements.length}`;
    elements.forEach((el) => {
        const isLocked = window.getD(el, 'locked') === "true"; const isActive = window.selectedEl === el; const isHidden = el.getAttribute('visibility') === 'hidden'; let typeName = el.tagName.toUpperCase(); let icon = 'ph-square';
        if (typeName === 'RECT') { typeName = 'ŞEKİL'; icon = 'ph-square'; } else if (typeName === 'IMAGE') { typeName = 'RESİM'; icon = 'ph-image'; } else if (el.tagName === 'text') { let txt = window.getD(el, 'raw-text') || el.textContent; typeName = `T: ${txt.substring(0,10)}${txt.length>10?'...':''}`; icon = 'ph-text-t'; }
        if (el.classList.contains('weather-widget')) { typeName = 'HAVA DURUMU'; icon = 'ph-cloud-sun'; } else if (el.classList.contains('currency-widget')) { typeName = 'DÖVİZ'; icon = 'ph-currency-circle-dollar'; }
        const item = document.createElement('div'); item.className = `layer-item ${isActive ? 'active' : ''}`; item.dataset.id = el.id;
        item.onclick = (e) => { if(e.target.closest('.layer-btn')) return; window.selectedEl = el; window.updateUI(el); window.renderEditor(); };
        item.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex:1;overflow:hidden;"><i class="ph ph-dots-six-vertical" style="color:#64748b;"></i><i class="ph ${icon}" style="color:var(--accent);"></i><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isLocked?'text-decoration:line-through;opacity:0.5;':''}${isHidden?'opacity:0.3;':''}">${typeName}</span></div><div class="layer-actions"><button class="layer-btn" onclick="const el=document.getElementById('${el.id}'); if(el.getAttribute('visibility')==='hidden') el.removeAttribute('visibility'); else el.setAttribute('visibility', 'hidden'); window.saveState(); window.renderEditor();"><i class="ph ${isHidden ? 'ph-eye-closed' : 'ph-eye'}"></i></button><button class="layer-btn" style="color:#ef4444;" onclick="if(confirm('Silinecek?')){ document.getElementById('${el.id}').remove(); window.selectedEl=null; window.saveState(); window.renderEditor(); const cl=document.getElementById('control-layer'); if(cl) cl.innerHTML=''; event.stopPropagation(); }"><i class="ph ph-trash"></i></button></div>`; 
        list.appendChild(item);
    });
};

window.switchTab = (btn, tabId) => { 
    const wrapper = btn.closest('#editor-fields'); if (!wrapper) return; window.activeTabId = tabId;
    wrapper.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); wrapper.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
    btn.classList.add('active'); wrapper.querySelector('#' + tabId).classList.add('active'); 
};

window.changeSetting = (id, key, val) => {
    const el = document.getElementById(id); if(!el) return; window.setD(el, key, val);
    if (key === 'raw-text' && el.tagName === 'text') { el.textContent = val; }
    if (key === 'solid-color') { el.setAttribute('fill', val); }
    if (el.classList.contains('weather-widget')) window.updateWeatherDisplay(el);
    if (el.classList.contains('currency-widget')) window.updateCurrencyDisplay(el);
    window.updateUI(el);
};

window.changeProp = (id, prop, val) => {
    const el = document.getElementById(id); if(!el) return;
    if(prop === 'x') el.setAttribute('x', val); if(prop === 'y') el.setAttribute('y', val);
    if(prop === 'w') { if(el.tagName === 'text') el.setAttribute('font-size', val); else el.setAttribute('width', val); }
    if(prop === 'h') { if(el.tagName !== 'text') el.setAttribute('height', val); }
    window.updateUI(el);
};

// DEVASA PRO STUDIO PANELİ
window.renderProperties = () => {
    const f = document.getElementById('editor-fields'); if(!f) return; if (!window.selectedEl) return;
    const el = window.selectedEl; const id = el.id; const tag = el.tagName.toLowerCase();
    const isLocked = window.getD(el, 'locked') === "true"; const isText = tag === 'text'; const isWidget = el.classList.contains('weather-widget') || el.classList.contains('currency-widget');
    
    let typeName = tag.toUpperCase(); let headerIcon = 'ph-square'; 
    if (tag === 'rect') { typeName = 'KUTU ŞEKİL'; headerIcon = 'ph-square'; } if (tag === 'text') { typeName = 'METİN DÜZENLE'; headerIcon = 'ph-text-t'; }
    if (el.classList.contains('weather-widget')) { typeName = 'HAVA DURUMU / SAAT'; headerIcon = 'ph-cloud-sun'; } if (el.classList.contains('currency-widget')) { typeName = 'DÖVİZ PANOSU'; headerIcon = 'ph-currency-circle-dollar'; }

    let headerHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:1px solid var(--border);padding-bottom:10px;"><div style="font-size:14px;color:white;font-weight:bold;display:flex;align-items:center;gap:8px;"><i class="ph ${headerIcon}" style="color:var(--accent);"></i> ${typeName}</div><div style="cursor:pointer;color:#ef4444;font-size:20px;" onclick="document.getElementById('${id}').remove(); window.selectedEl=null; window.saveState(); window.renderEditor();"><i class="ph ph-trash"></i></div></div>`;
    
    let tabsNav = `<div class="tabs-header"><button class="tab-btn ${window.activeTabId === 'tab-layout' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-layout')"><i class="ph ph-bounding-box"></i> Düzen</button>${isText ? `<button class="tab-btn ${window.activeTabId === 'tab-text' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-text')"><i class="ph ph-text-t"></i> Metin</button>` : ''}${isWidget ? `<button class="tab-btn ${window.activeTabId === 'tab-widget' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-widget')"><i class="ph ph-plug"></i> Araç</button>` : ''}</div>`;

    const x = Math.round(parseFloat(el.getAttribute("x")) || 0); const y = Math.round(parseFloat(el.getAttribute("y")) || 0); 
    let w = 0, h = 0; if(tag === 'text') { w = Math.round(parseFloat(el.getAttribute("font-size")) || 80); h = w; } else { w = Math.round(parseFloat(el.getAttribute("width")) || 0); h = Math.round(parseFloat(el.getAttribute("height")) || 0); }
    const solidCol = window.getD(el, 'solid-color') || el.getAttribute('fill') || "#ffffff";

    let layoutHtml = `<div class="prop-group"><div class="prop-group-title"><i class='ph ph-arrows-out'></i> Konum ve Boyut</div><div class="label-row"><span class="label-text">X KONUMU</span></div><input type="number" value="${x}" oninput="window.changeProp('${id}', 'x', this.value)" onchange="window.saveState()"><div class="label-row"><span class="label-text">Y KONUMU</span></div><input type="number" value="${y}" oninput="window.changeProp('${id}', 'y', this.value)" onchange="window.saveState()"><div class="label-row"><span class="label-text">${isText?'YAZI PUNTO (BÜYÜKLÜK)':'GENİŞLİK (W)'}</span></div><input type="number" value="${w}" oninput="window.changeProp('${id}', 'w', this.value)" onchange="window.saveState()">${!isText ? `<div class="label-row"><span class="label-text">YÜKSEKLİK (H)</span></div><input type="number" value="${h}" oninput="window.changeProp('${id}', 'h', this.value)" onchange="window.saveState()">` : ''}</div><div class="prop-group"><div class="prop-group-title"><i class='ph ph-paint-bucket'></i> Renk & Görünüm</div><div class="label-row"><span class="label-text">DOLGU RENGİ</span></div><div style="display:flex;gap:10px;"><input type="color" value="${window.safeColor(solidCol)}" oninput="window.changeSetting('${id}', 'solid-color', this.value);" onchange="window.saveState()" style="width:50px;height:40px;cursor:pointer;border:none;background:none;"><input type="text" value="${window.safeColor(solidCol)}" style="flex:1;" oninput="window.changeSetting('${id}', 'solid-color', this.value);" onchange="window.saveState()"></div></div>`;

    let textHtml = "";
    if (isText) {
        const rawText = window.getD(el, 'raw-text') || el.textContent; const varName = window.getD(el, 'var-name') || "";
        let fontOptionsHtml = googleFonts.map(font => `<option value="${font.val}" style="font-family: ${font.val}" ${el.getAttribute('font-family')?.includes(font.name) ? "selected" : ""}>${font.name}</option>`).join('');
        textHtml = `<div class="prop-group"><div class="prop-group-title"><i class='ph ph-text-t'></i> Metin Ayarları</div><div class="label-text">METİN İÇERİĞİ</div><input type="text" value="${rawText}" oninput="window.changeSetting('${id}', 'raw-text', this.value); window.refreshAutoTextFields();" onchange="window.saveState()"><div class="label-text" style="color:#f472b6;margin-top:10px;">OTOMATİK DEĞİŞKEN (Örn: FIYAT)</div><input type="text" value="${varName}" oninput="this.value = this.value.toUpperCase(); window.setD(document.getElementById('${id}'), 'var-name', this.value); window.refreshAutoTextFields();" onchange="window.saveState()" style="border-color:#f472b6;"><div class="label-text" style="margin-top:10px;">YAZI TİPİ (FONT)</div><select class="font-select" onchange="document.getElementById('${id}').setAttribute('font-family', this.value); window.saveState();">${fontOptionsHtml}</select></div>`;
    }

    let widgetHtml = "";
    if (el.classList.contains('weather-widget')) {
        widgetHtml = `<div class="prop-group"><div class="prop-group-title"><i class='ph ph-cloud-sun'></i> Hava Durumu Ayarı</div><div class="label-text">ŞEHİR ADI</div><input type="text" value="${window.getD(el, 'city') || 'Istanbul'}" oninput="window.changeSetting('${id}', 'city', this.value);" onchange="window.saveState()"></div>`;
    } else if (el.classList.contains('currency-widget')) {
        widgetHtml = `<div class="prop-group"><div class="prop-group-title"><i class='ph ph-currency-circle-dollar'></i> Döviz Ayarı</div><div class="label-text">KURLAR (Virgülle Ayır)</div><input type="text" value="${window.getD(el, 'currencies') || 'USD,EUR,GBP'}" oninput="window.changeSetting('${id}', 'currencies', this.value.toUpperCase());" onchange="window.saveState()"></div>`;
    }

    f.innerHTML = headerHtml + tabsNav + `<div id="tab-layout" class="tab-content ${window.activeTabId === 'tab-layout' ? 'active' : ''}">${layoutHtml}</div>` + (isText ? `<div id="tab-text" class="tab-content ${window.activeTabId === 'tab-text' ? 'active' : ''}">${textHtml}</div>` : '') + (isWidget ? `<div id="tab-widget" class="tab-content ${window.activeTabId === 'tab-widget' ? 'active' : ''}">${widgetHtml}</div>` : '');
};

// --- SÜRÜKLE BIRAK MOTORU ---
window.initEngine = (svg) => {
    const wrapper = document.getElementById('svg-wrapper');
    const getCoords = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
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

window.updateUI = (el) => {
    const ctrl = document.getElementById('control-layer'); if(!ctrl) return; ctrl.innerHTML = ""; if(!el) return;
    let b = {x:0,y:0,width:0,height:0}; try { b = el.getBBox(); }catch(e){return;}
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.setAttribute("transform", el.getAttribute("transform") || ""); ctrl.appendChild(g);
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect"); r.setAttribute("x", b.x); r.setAttribute("y", b.y); r.setAttribute("width", b.width); r.setAttribute("height", b.height); r.setAttribute("fill", "none"); r.setAttribute("stroke", "#3b82f6"); r.setAttribute("stroke-width", "2"); g.appendChild(r);
};

window.saveState = () => {
    const svg = document.querySelector('#canvas-inner svg'); if (!svg) return; 
    const ctrl = document.getElementById('control-layer'); if(ctrl) { const ctrlHTML = ctrl.innerHTML; ctrl.innerHTML = ""; const state = svg.innerHTML; ctrl.innerHTML = ctrlHTML; if (window.historyIndex < window.historyStack.length - 1) window.historyStack = window.historyStack.slice(0, window.historyIndex + 1); window.historyStack.push(state); window.historyIndex++; window.renderLayers(); }
};

window.onload = () => { window.loadSlide(); };