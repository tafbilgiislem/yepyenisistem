import { db, ref, set, get, onValue, remove } from "./firebase.js";

// Global Değişken Tanımlamaları
window.currentZoom = 1; window.panX = 0; window.panY = 0; 
window.historyStack = []; window.historyIndex = -1; 
window.isDraggingElement = false; window.isSpacePressed = false; window.isPanning = false; 
window.panStart = {x:0, y:0}; window.panOffsetStart = {x:0, y:0};
window.isDrawingMode = false; window.isDrawing = false; window.currentPath = null; window.pathData = ""; 
window.isDraggingGuide = false; window.currentGuide = null; window.draggedLayerId = null;
window.offset = {x:0, y:0}; window.startP = {x:0, y:0}; window.startData = {}; window.isModified = false;
window.clipboard = null;

// Firebase Bağlantıları ve Arayüz Tetikleyicileri
window.onload = function() { 
    if(window.listenDevices) window.listenDevices(); 
};

if(db) {
    onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
        const selector = document.getElementById('file-selector');
        if(!selector) return;
        const current = selector.value;
        selector.innerHTML = "";
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = key.replace(/_/g, ' ').toUpperCase();
                selector.appendChild(opt);
            });
            if (current && data[current]) { selector.value = current; } 
            else if (!current && Object.keys(data).length > 0) { selector.value = Object.keys(data)[0]; if(window.loadSlide) window.loadSlide(); }
        }
    });
}

// Global Durum Yönetimi (Save, Undo, Redo)
window.saveState = function() {
    const svg = document.querySelector('#canvas-inner svg'); if (!svg) return; 
    const ctrl = document.getElementById('control-layer'); 
    if(ctrl) { 
        const ctrlHTML = ctrl.innerHTML; ctrl.innerHTML = ""; 
        const state = svg.innerHTML; ctrl.innerHTML = ctrlHTML; 
        if (window.historyIndex < window.historyStack.length - 1) window.historyStack = window.historyStack.slice(0, window.historyIndex + 1); 
        window.historyStack.push(state); window.historyIndex++; 
        if(window.renderLayers) window.renderLayers(); 
        if(window.syncToFirebase) window.syncToFirebase(); 
    }
};

window.undo = function() { if (window.historyIndex > 0) { window.historyIndex--; window.restoreState(); } };
window.redo = function() { if (window.historyIndex < window.historyStack.length - 1) { window.historyIndex++; window.restoreState(); } };
window.restoreState = function() { 
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; 
    svg.innerHTML = window.historyStack[window.historyIndex]; 
    const ctrl = document.getElementById('control-layer'); if(ctrl) ctrl.innerHTML = ""; 
    window.selectedEl = null; 
    if(window.setupLayers) window.setupLayers(); 
    if(window.syncToFirebase) window.syncToFirebase(); 
};

window.syncToFirebase = function() {
    if(!db) return; const file = document.getElementById('file-selector')?.value; if(!file) return; const svg = document.querySelector('#canvas-inner svg'); if (!svg) return;
    const ctrl = document.getElementById('control-layer'); 
    if(ctrl) { 
        const ctrlHTML = ctrl.innerHTML; ctrl.innerHTML = ""; 
        const tamSvgKodu = svg.outerHTML; ctrl.innerHTML = ctrlHTML; 
        set(ref(db, 'sahne/slaytlar/' + file), tamSvgKodu).catch(e => console.error(e)); 
    }
    const st = document.getElementById('status-time'); const now = new Date(); 
    if(st) st.innerText = `Son Kayıt: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`; 
};

window.saveData = function() { window.syncToFirebase(); if(window.showToast) window.showToast("Tasarım Yayına Gönderildi!"); };

window.saveSlideSettings = function() {
    if(!db) return; const file = document.getElementById('file-selector')?.value; if(!file) return;
    const time = document.getElementById('slide-time')?.value || 5000; const effect = document.getElementById('slide-effect')?.value || 'fade'; const startTime = document.getElementById('start-time')?.value || '00:00'; const endTime = document.getElementById('end-time')?.value || '23:59'; const activeDays = Array.from(document.querySelectorAll('.day-btn.active')).map(b => parseInt(b.dataset.day));
    set(ref(db, 'sahne/ayarlar/' + file), { time: parseInt(time), effect: effect, startTime: startTime, endTime: endTime, days: activeDays });
    if(window.showToast) window.showToast("Ayarlar Kaydedildi!");
};

window.loadSlide = async function() {
    if(window.showToast) window.showToast("Slayt Yükleniyor...", "success");
    try {
        const file = document.getElementById('file-selector')?.value; if(!file) return; const ci = document.getElementById('canvas-inner'); if(!ci) return;
        if(db) {
            const snapshot = await get(ref(db, 'sahne/slaytlar/' + file));
            if(snapshot.exists()) { ci.innerHTML = snapshot.val(); } else { ci.innerHTML = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"><rect id="canvas-background" x="0" y="0" width="1920" height="1080" fill="#020617"></rect></svg>`; }
            const ayarSnap = await get(ref(db, 'sahne/ayarlar/' + file));
            if(ayarSnap.exists()) {
                const s = ayarSnap.val();
                if(document.getElementById('slide-time')) document.getElementById('slide-time').value = s.time || 5000;
                if(document.getElementById('slide-effect')) document.getElementById('slide-effect').value = s.effect || 'fade';
                if(document.getElementById('start-time')) document.getElementById('start-time').value = s.startTime || '00:00';
                if(document.getElementById('end-time')) document.getElementById('end-time').value = s.endTime || '23:59';
                if(s.days) { document.querySelectorAll('.day-btn').forEach(b => { if(s.days.includes(parseInt(b.dataset.day))) b.classList.add('active'); else b.classList.remove('active'); }); }
            }
        } 
        window.historyStack = []; window.historyIndex = -1; window.selectedEl = null;
        setTimeout(() => { 
            if(window.setupLayers) window.setupLayers(); 
            if(window.initCanvasSettings) window.initCanvasSettings(); 
            if(window.resetZoom) window.resetZoom(); 
            window.saveState(); 
        }, 200);
    } catch(e) { if(window.showToast) window.showToast("Veritabanı Hatası!", "error"); }
};

window.processImportedFile = function(file) {
    if (!file) return;
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parser = new DOMParser(); const doc = parser.parseFromString(ev.target.result, "image/svg+xml"); const importedSvg = doc.documentElement;
                if (importedSvg.tagName === 'parsererror') { if(window.showToast) window.showToast("Geçersiz SVG", "error"); return; }
                const mainSvg = document.querySelector('#canvas-inner svg'); const center = window.getCanvasCenter();
                importedSvg.id = "svg_import_" + Date.now(); importedSvg.setAttribute("class", "duzenlenebilir");
                importedSvg.style.position = ""; importedSvg.style.left = ""; importedSvg.style.top = "";
                let w = parseFloat(importedSvg.getAttribute('width')) || 400; let h = parseFloat(importedSvg.getAttribute('height')) || 400;
                if(importedSvg.hasAttribute('viewBox') && (!importedSvg.hasAttribute('width') || !importedSvg.hasAttribute('height'))) {
                    const vb = importedSvg.getAttribute('viewBox').split(/\s+|,/); if(vb.length >= 4) { w = parseFloat(vb[2]); h = parseFloat(vb[3]); importedSvg.setAttribute('width', w); importedSvg.setAttribute('height', h); }
                }
                importedSvg.setAttribute("x", center.cx - (w / 2)); importedSvg.setAttribute("y", center.cy - (h / 2));
                mainSvg.appendChild(importedSvg); window.selectedEl = importedSvg; window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(importedSvg); if(window.renderEditor) window.renderEditor(); if(window.showToast) window.showToast("SVG Eklendi", "success");
            } catch(e) { if(window.showToast) window.showToast("Hata!", "error"); }
        }; reader.readAsText(file);
    } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const svg = document.querySelector('#canvas-inner svg'); const center = window.getCanvasCenter();
            const img = document.createElementNS("http://www.w3.org/2000/svg", "image"); img.id = "img_" + Date.now(); img.setAttribute("class", "duzenlenebilir"); img.setAttribute("x", center.cx - 150); img.setAttribute("y", center.cy - 150); img.setAttribute("width", 300); img.setAttribute("height", 300); window.setD(img, "rx", "0"); window.setD(img, "smoothing", "0.5"); window.setD(img, "mask-shape", "none"); img.setAttribute("href", ev.target.result);
            svg.appendChild(img); window.selectedEl = img; window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(img); if(window.renderEditor) window.renderEditor();
        }; reader.readAsDataURL(file);
    }
};

// Klavye Olayları
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); window.isSpacePressed = true; const sw = document.getElementById('svg-wrapper'); if(sw) sw.classList.add('pan-mode'); return; }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); window.undo(); return; } 
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); window.redo(); return; }
    
    if (window.selectedEl && window.getD(window.selectedEl, 'locked') !== "true") {
        const step = e.shiftKey ? 10 : 1; let moved = false; let x = parseFloat(window.selectedEl.getAttribute("x")) || 0, y = parseFloat(window.selectedEl.getAttribute("y")) || 0;
        if (e.key === 'ArrowUp') { y -= step; moved = true; } if (e.key === 'ArrowDown') { y += step; moved = true; } if (e.key === 'ArrowLeft') { x -= step; moved = true; } if (e.key === 'ArrowRight') { x += step; moved = true; }
        if (moved) { 
            e.preventDefault(); window.selectedEl.setAttribute("x", x); window.selectedEl.setAttribute("y", y); 
            if((window.selectedEl.tagName === 'image' || window.selectedEl.tagName === 'rect' || window.selectedEl.classList.contains('video-obj') || window.selectedEl.classList.contains('weather-widget') || window.selectedEl.classList.contains('currency-widget')) && window.applyShapeMask) window.applyShapeMask(window.selectedEl); 
            if(window.selectedEl.tagName === 'text' && window.applyTextCurve) window.applyTextCurve(window.selectedEl); 
            if(window.updateUI) window.updateUI(window.selectedEl); window.isModified = true; 
        }
        if (e.key === 'Delete' || e.key === 'Backspace') { 
            e.preventDefault(); window.selectedEl.remove(); const ctrl = document.getElementById('control-layer'); if(ctrl) ctrl.innerHTML = ''; window.selectedEl = null; window.saveState(); if(window.renderEditor) window.renderEditor(); 
        }
        if (e.ctrlKey && e.key === 'c') { e.preventDefault(); window.clipboard = window.selectedEl.cloneNode(true); }
    }
    if (e.ctrlKey && e.key === 'v' && window.clipboard) { 
        e.preventDefault(); const clone = window.clipboard.cloneNode(true); clone.id = "el_" + Date.now(); clone.setAttribute("x", (parseFloat(clone.getAttribute("x")) || 0) + 30); clone.setAttribute("y", (parseFloat(clone.getAttribute("y")) || 0) + 30); document.querySelector('#canvas-inner svg').appendChild(clone); window.selectedEl = clone; window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(clone); if(window.renderEditor) window.renderEditor(); 
    }
});

document.addEventListener('keyup', (e) => { 
    if (e.code === 'Space') { window.isSpacePressed = false; window.isPanning = false; const sw = document.getElementById('svg-wrapper'); if(sw) { sw.classList.remove('pan-mode'); sw.classList.remove('panning'); } return; } 
    if(window.isModified && e.key.startsWith('Arrow')) { window.saveState(); window.isModified = false; } 
});

document.addEventListener('contextmenu', function(e) {
    const el = e.target.closest('.duzenlenebilir');
    if (el) {
        e.preventDefault(); window.selectedEl = el; window.isDraggingElement = false; 
        if(window.updateUI) window.updateUI(el); 
        if(window.renderEditor) window.renderEditor();
        
        const ctx = document.getElementById('context-menu');
        if (ctx) {
            ctx.style.display = 'block'; ctx.style.left = e.pageX + 'px'; ctx.style.top = e.pageY + 'px';
            const isLocked = window.getD(el, 'locked') === "true";
            document.getElementById('ctx-lock-icon').className = isLocked ? "ph ph-lock-key-open" : "ph ph-lock-key";
            document.getElementById('ctx-lock-text').innerText = isLocked ? "Kilidi Aç" : "Kilitle";
        }
    } else if (e.target.closest('#svg-wrapper')) { e.preventDefault(); if(window.closeCtx) window.closeCtx(); }
});

window.closeCtx = function() { const ctx = document.getElementById('context-menu'); if(ctx) { ctx.style.display = 'none'; } }; 
document.addEventListener('click', window.closeCtx);

// Sürükle Bırak Eventleri (Sayfa Yüklendiğinde)
setTimeout(() => {
    document.getElementById('img-in')?.addEventListener('change', (e) => { window.processImportedFile(e.target.files[0]); e.target.value = ""; });
    const mv = document.getElementById('main-view');
    if(mv) { 
        mv.addEventListener('dragover', (e) => { e.preventDefault(); mv.style.opacity = '0.8'; }); 
        mv.addEventListener('dragleave', (e) => { e.preventDefault(); mv.style.opacity = '1'; }); 
        mv.addEventListener('drop', (e) => { e.preventDefault(); mv.style.opacity = '1'; window.processImportedFile(e.dataTransfer.files[0]); }); 
    }
}, 500);