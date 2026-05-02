import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, remove } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";

// --- 1. FIREBASE BAĞLANTISI VE GÜVENLİK ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DB_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app, db, auth;
try { 
    app = initializeApp(firebaseConfig); 
    db = getDatabase(app); 
    auth = getAuth(app);
} catch(e) { 
    console.error("Firebase Başlatma Hatası", e); 
}

const ADMIN_EMAIL = "tafbilgiislem@gmail.com"; 

// --- 2. GLOBAL DEĞİŞKENLER VE DURUMLAR ---
let recentColors = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ffffff'];
window.selectedEl = null; 
window.activeTabId = 'tab-layout'; 

let resizingEl = null, rotatingEl = null, radiusingEl = null, activeHandle = null, offset = {x:0, y:0}, startP = {x:0, y:0}, startData = {}, isModified = false;
let clipboard = null, currentZoom = 1, panX = 0, panY = 0, historyStack = [], historyIndex = -1, isDraggingElement = false, isSpacePressed = false, isPanning = false, panStart = {x:0, y:0}, panOffsetStart = {x:0, y:0};
let isDrawingMode = false, isDrawing = false, currentPath = null, pathData = "", isDraggingGuide = false, currentGuide = null;
let draggedLayerId = null;

const googleFonts = [
    { name: "Varsayılan", val: "sans-serif" }, 
    { name: "Times New Roman", val: "'Times New Roman', Times, serif" },
    { name: "Roboto", val: "'Roboto', sans-serif" }, 
    { name: "Montserrat", val: "'Montserrat', sans-serif" }, 
    { name: "Poppins", val: "'Poppins', sans-serif" }, 
    { name: "Oswald", val: "'Oswald', sans-serif" }, 
    { name: "Pacifico", val: "'Pacifico', cursive" }
];

// --- 3. OTURUM YÖNETİMİ VE ROL KONTROLÜ ---
const loginScreen = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');

onAuthStateChanged(auth, (user) => {
    if (user) {
        if(loginScreen) loginScreen.style.display = 'none';
        if(appContainer) {
            appContainer.style.display = 'flex';
            appContainer.style.filter = 'blur(0px)';
        }
        
        if (user.email !== ADMIN_EMAIL) {
            aktifEtPersonelModu(); 
        } else {
            kapatPersonelModu(); 
        }

        window.showToast("Giriş Başarılı!", "success");
        baslatSlaytDinleyici();
    } else {
        if(loginScreen) loginScreen.style.display = 'flex';
        if(appContainer) {
            appContainer.style.display = 'none';
            appContainer.style.filter = 'blur(10px)';
        }
    }
});

function aktifEtPersonelModu() {
    const PERSONEL_SLAYTI = "slayt_svg";
    window.renderProperties = function() {}; 
    window.updateUI = function() {};
    window.selectedEl = null;
    if(window.closeCtx) window.closeCtx();

    let kalkan = document.getElementById('personel-kalkan');
    if (!kalkan) {
        kalkan = document.createElement('style');
        kalkan.id = 'personel-kalkan';
        document.head.appendChild(kalkan);
    }
    kalkan.innerHTML = `
        #svg-wrapper { pointer-events: none !important; user-select: none !important; }
        #control-layer, #context-menu { display: none !important; }
    `;

    let gonderBtn = document.getElementById('personel-yayinla-btn');
    if (!gonderBtn) {
        gonderBtn = document.createElement('button');
        gonderBtn.id = 'personel-yayinla-btn';
        gonderBtn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> YAYINA GÖNDER';
        gonderBtn.style.cssText = 'position:fixed; bottom:30px; right:30px; z-index:999999; background:#10b981; color:white; padding:15px 30px; font-size:16px; font-weight:bold; border-radius:8px; border:none; cursor:pointer; box-shadow:0 10px 20px rgba(16,185,129,0.4); display:flex; align-items:center; gap:10px;';
        gonderBtn.onclick = function() {
            if(window.saveData) window.saveData();
            window.showToast("Yayına Gönderildi!", "success");
        };
        document.body.appendChild(gonderBtn);
    }

    setInterval(() => {
        let selector = document.getElementById('file-selector');
        if (selector && selector.options.length > 1) {
            let izinliSlayt = Array.from(selector.options).find(opt => opt.value === PERSONEL_SLAYTI);
            selector.innerHTML = ''; 
            if (izinliSlayt) {
                selector.appendChild(izinliSlayt); 
                selector.value = PERSONEL_SLAYTI;  
                if(window.loadSlide) window.loadSlide(); 
            } else {
                selector.innerHTML = '<option value="">Yetkili Slayt Bulunamadı</option>';
            }
        }
    }, 300); 
}

function kapatPersonelModu() {
    const kalkan = document.getElementById('personel-kalkan');
    if (kalkan) kalkan.remove();
}

window.checkPin = function() {
    const emailInput = document.getElementById('email-input');
    const pinInput = document.getElementById('pin-input');
    if(!emailInput || !pinInput) return alert("E-posta veya şifre kutusu bulunamadı!");
    const email = emailInput.value;
    const pin = pinInput.value;
    if(!email || !pin) return window.showToast("E-posta ve Şifre boş olamaz!", "error");

    signInWithEmailAndPassword(auth, email, pin)
        .catch((error) => {
            window.showToast("Hatalı E-posta veya Şifre!", "error");
            pinInput.value = "";
            console.error(error);
        });
};

// --- 4. VERİTABANI DİNLEYİCİLERİ VE EDİTÖR FONKSİYONLARI ---
function baslatSlaytDinleyici() {
    if(!db) return;
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
            if (current && data[current]) {
                selector.value = current;
            } else if (!current && Object.keys(data).length > 0) {
                selector.value = Object.keys(data)[0];
                window.loadSlide();
            }
        }
    });
}

window.showToast = function(msg, type = 'success') {
    const container = document.getElementById('toast-container'); if(!container) return;
    const toast = document.createElement('div'); toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
    toast.innerHTML = `<i class="ph ${icon}"></i> <span>${msg}</span>`; container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, 3000);
};

window.addNewSlide = async function() {
    const name = prompt("Yeni Slayt İsmi (Örn: sabah_kampanyasi):");
    if (!name) return;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const defaultSvg = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"><rect id="canvas-background" x="0" y="0" width="1920" height="1080" fill="#020617"></rect><text id="t_${Date.now()}" class="duzenlenebilir" x="960" y="540" text-anchor="middle" fill="white" font-size="60">${name.toUpperCase()}</text></svg>`;
    
    await set(ref(db, 'sahne/slaytlar/' + key), defaultSvg);
    await set(ref(db, 'sahne/ayarlar/' + key), { time: 5000, effect: 'fade' });
    window.showToast("Yeni Slayt Oluşturuldu!");
    document.getElementById('file-selector').value = key;
    window.loadSlide();
};

window.deleteSlide = async function() {
    const key = document.getElementById('file-selector').value;
    if (!key) return;
    if (confirm(key.replace(/_/g, ' ').toUpperCase() + " adlı slayt tamamen silinecek, emin misiniz?")) {
        await remove(ref(db, 'sahne/slaytlar/' + key));
        await remove(ref(db, 'sahne/ayarlar/' + key));
        window.showToast("Slayt Silindi", "error");
        document.getElementById('canvas-inner').innerHTML = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"><rect id="canvas-background" x="0" y="0" width="1920" height="1080" fill="#020617"></rect></svg>`;
        setTimeout(() => window.loadSlide(), 500); 
    }
};

window.downloadSVG = function() {
    const svg = document.querySelector('#canvas-inner svg');
    if(!svg) return;
    const clone = svg.cloneNode(true);
    clone.querySelectorAll('.duzenlenebilir, .locked, .guide-line, .snap-line, .handle, .video-obj, .weather-widget, .currency-widget').forEach(el => {
        el.classList.remove('duzenlenebilir', 'locked');
        if (el.classList.length === 0) el.removeAttribute('class');
    });
    const ctrl = clone.querySelector('#control-layer');
    if (ctrl) clone.removeChild(ctrl);
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = document.getElementById('file-selector')?.value || 'tasarim';
    a.download = fileName + '.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.showToast("SVG Dosyası İndirildi!", "success");
};

window.setD = function(el, key, val) { if(el) el.setAttribute('data-' + key, val); };
window.getD = function(el, key) { return el ? el.getAttribute('data-' + key) : null; };

window.addRecentColor = function(c) { if(!recentColors.includes(c)) { recentColors.unshift(c); if(recentColors.length > 10) recentColors.pop(); if(window.selectedEl) window.renderProperties(); } };
function safeColor(c) { if(!c) return "#ffffff"; if(c.length === 4 && c.startsWith('#')) return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return c.startsWith('#') && c.length === 7 ? c : "#ffffff"; }

window.getSvgDim = function() {
    const svg = document.querySelector('#canvas-inner svg'); let w = 1920, h = 1080;
    if(svg && svg.hasAttribute('viewBox')) { const vb = svg.getAttribute('viewBox').split(/\s+|,/); if(vb.length >= 4) { w = parseFloat(vb[2]); h = parseFloat(vb[3]); } }
    return { w, h };
};
window.getCanvasCenter = function() { const dim = window.getSvgDim(); return { cx: dim.w / 2, cy: dim.h / 2 }; };

window.loadSlide = async function() {
    window.showToast("Slayt Yükleniyor...", "success");
    try {
        const file = document.getElementById('file-selector')?.value;
        if(!file) return;
        const safeKey = file;
        const ci = document.getElementById('canvas-inner'); if(!ci) return;
        
        if(db) {
            const snapshot = await get(ref(db, 'sahne/slaytlar/' + safeKey));
            if(snapshot.exists()) { ci.innerHTML = snapshot.val(); } 
            else { ci.innerHTML = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"><rect id="canvas-background" x="0" y="0" width="1920" height="1080" fill="#020617"></rect></svg>`; }
        } else {
             ci.innerHTML = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"><rect id="canvas-background" x="0" y="0" width="1920" height="1080" fill="#020617"></rect></svg>`;
        }
        historyStack = []; historyIndex = -1; window.selectedEl = null;
        setTimeout(() => { window.setupLayers(); window.initCanvasSettings(); window.resetZoom(); window.saveState(); }, 200);
    } catch(e) { window.showToast("Veritabanı Hatası!", "error"); }
};

window.syncToFirebase = function() {
    if(!db) return;
    const file = document.getElementById('file-selector')?.value;
    if(!file) return;
    const safeKey = file;
    const svg = document.querySelector('#canvas-inner svg'); if (!svg) return;
    
    const ctrl = document.getElementById('control-layer'); 
    if(ctrl) {
        const ctrlHTML = ctrl.innerHTML; ctrl.innerHTML = "";
        const tamSvgKodu = svg.outerHTML; ctrl.innerHTML = ctrlHTML;
        set(ref(db, 'sahne/slaytlar/' + safeKey), tamSvgKodu).catch(e => console.error(e));
    }
    const st = document.getElementById('status-time');
    const now = new Date(); if(st) st.innerText = `Son Kayıt: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`; 
};

window.saveData = function() { window.syncToFirebase(); window.showToast("Tasarım Yayına Gönderildi!"); };

window.saveState = function() {
    const svg = document.querySelector('#canvas-inner svg'); if (!svg) return;
    const ctrl = document.getElementById('control-layer'); 
    if(ctrl) {
        const ctrlHTML = ctrl.innerHTML; ctrl.innerHTML = ""; 
        const state = svg.innerHTML; ctrl.innerHTML = ctrlHTML;
        if (historyIndex < historyStack.length - 1) historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(state); historyIndex++; window.renderLayers(); window.syncToFirebase(); 
    }
};

window.undo = function() { if (historyIndex > 0) { historyIndex--; window.restoreState(); } };
window.redo = function() { if (historyIndex < historyStack.length - 1) { historyIndex++; window.restoreState(); } };
window.restoreState = function() { const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; svg.innerHTML = historyStack[historyIndex]; const ctrl = document.getElementById('control-layer'); if(ctrl) ctrl.innerHTML = ""; window.selectedEl = null; window.setupLayers(); window.syncToFirebase(); };

window.cloneElement = function(id) {
    const el = document.getElementById(id);
    if(!el) return;
    const clone = el.cloneNode(true);
    clone.id = "el_" + Date.now();
    clone.setAttribute("x", (parseFloat(clone.getAttribute("x")) || 0) + 30);
    clone.setAttribute("y", (parseFloat(clone.getAttribute("y")) || 0) + 30);
    el.parentNode.insertBefore(clone, el.nextSibling);
    window.selectedEl = clone;
    window.saveState();
    window.setupLayers();
    window.updateUI(clone);
    window.renderEditor();
};

window.moveLayer = function(id, dir) {
    const el = document.getElementById(id);
    if(!el) return;
    const parent = el.parentNode;
    if(dir === 'top') {
        parent.appendChild(el);
    } else if (dir === 'bottom') {
        const bg = document.getElementById('canvas-background');
        if(bg && bg.nextSibling) parent.insertBefore(el, bg.nextSibling);
        else parent.insertBefore(el, parent.firstChild);
    } else if (dir === 1) {
        if(el.nextSibling) parent.insertBefore(el, el.nextSibling.nextSibling);
    } else if (dir === -1) {
        if(el.previousSibling && el.previousSibling.id !== 'canvas-background') {
            parent.insertBefore(el, el.previousSibling);
        }
    }
    window.saveState();
    window.renderEditor();
};

window.toggleLock = function(id) {
    const el = document.getElementById(id);
    if(!el) return;
    const isLocked = window.getD(el, 'locked') === "true";
    window.setD(el, 'locked', isLocked ? "false" : "true");
    if(isLocked) el.classList.remove('locked');
    else el.classList.add('locked');
    window.saveState();
    window.renderEditor();
};

window.toggleVisibility = function(id) {
    const el = document.getElementById(id);
    if(!el) return;
    if(el.getAttribute('visibility') === 'hidden') el.removeAttribute('visibility');
    else el.setAttribute('visibility', 'hidden');
    if(window.selectedEl && window.selectedEl.id === id) {
        window.selectedEl = null;
        const ctrl = document.getElementById('control-layer');
        if(ctrl) ctrl.innerHTML = '';
    }
    window.saveState();
    window.renderEditor();
};

window.changeZoom = function(amount) { currentZoom = Math.max(0.3, Math.min(3, currentZoom + amount)); window.applyZoom(); window.syncRulerTransform(); };
window.resetZoom = function() { currentZoom = 1; panX = 0; panY = 0; window.applyZoom(); window.syncRulerTransform(); };
window.applyZoom = function() { const sw = document.getElementById('svg-wrapper'); if(sw) sw.style.transform = `scale(${currentZoom}) translate(${panX}px, ${panY}px)`; const zv = document.getElementById('zoom-val'); if(zv) zv.innerText = Math.round(currentZoom * 100) + "%"; };

window.syncRulerTransform = function() {
    const hRulerSvg = document.querySelector('#horizontal-ruler svg'); const vRulerSvg = document.querySelector('#vertical-ruler svg'); if(!hRulerSvg || !vRulerSvg) return;
    hRulerSvg.style.transform = `scaleX(${currentZoom}) translateX(${panX}px)`; hRulerSvg.style.transformOrigin = 'left center';
    vRulerSvg.style.transform = `scaleY(${currentZoom}) translateY(${panY}px)`; vRulerSvg.style.transformOrigin = 'top center';
};

window.updateRulers = function() {
    const hRuler = document.getElementById('horizontal-ruler'); const vRuler = document.getElementById('vertical-ruler'); if(!hRuler || !vRuler) return;
    const dim = window.getSvgDim(); const w = dim.w; const h = dim.h;
    const pt_h = `M0,0 h${w} M0,0 v15 `; const pt_v = `M0,0 v${h} M0,0 h15 `; let labels_h = ''; let labels_v = '';
    for(let x=0; x<=w; x+=100) { if(x>0) labels_h += `<text x="${x}" y="12" font-size="10" text-anchor="middle" fill="#94a3b8">${x}</text>`; }
    for(let y=0; y<=h; y+=100) { if(y>0) labels_v += `<text x="2" y="${y+3}" font-size="10" fill="#94a3b8">${y}</text>`; }
    hRuler.innerHTML = `<svg width="100%" height="20" viewBox="0 0 ${w} 20" preserveAspectRatio="none"><path d="${pt_h}" stroke="#334155"/><line id="h-cursor" x1="0" y1="0" x2="0" y2="20" stroke="#ef4444" stroke-width="1"/><g>${labels_h}</g></svg>`; 
    vRuler.innerHTML = `<svg width="20" height="100%" viewBox="0 0 20 ${h}" preserveAspectRatio="none"><path d="${pt_v}" stroke="#334155"/><line id="v-cursor" x1="0" y1="0" x2="20" y2="0" stroke="#ef4444" stroke-width="1"/><g>${labels_v}</g></svg>`; 
    window.syncRulerTransform();
};

window.initCanvasSettings = function() {
    const dim = window.getSvgDim();
    const cw = document.getElementById('canvas-w'); if(cw) cw.value = dim.w; 
    const ch = document.getElementById('canvas-h'); if(ch) ch.value = dim.h;
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return;
    let bgRect = svg.querySelector('#canvas-background');
    if (!bgRect) { bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); bgRect.id = "canvas-background"; bgRect.setAttribute("x", "0"); bgRect.setAttribute("y", "0"); bgRect.setAttribute("width", dim.w); bgRect.setAttribute("height", dim.h); bgRect.setAttribute("fill", "#020617"); svg.insertBefore(bgRect, svg.firstChild); }
    const cbc = document.getElementById('canvas-bg-color'); if(cbc) cbc.value = safeColor(bgRect.getAttribute("fill"));
    window.updateRulers();
};

window.updateCanvasSize = function() { const w = document.getElementById('canvas-w')?.value; const h = document.getElementById('canvas-h')?.value; const svg = document.querySelector('#canvas-inner svg'); if(svg){ svg.setAttribute("viewBox", `0 0 ${w} ${h}`); const ctrl = document.getElementById('control-layer'); if(ctrl) ctrl.setAttribute("viewBox", `0 0 ${w} ${h}`); const bgRect = svg.querySelector('#canvas-background'); if(bgRect) { bgRect.setAttribute("width", w); bgRect.setAttribute("height", h); } window.saveState(); window.updateRulers(); } };
window.updateCanvasBg = function() { const col = document.getElementById('canvas-bg-color')?.value; const bgRect = document.querySelector('#canvas-background'); if(bgRect) bgRect.setAttribute("fill", col); window.saveState(); };

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

window.addVideo = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return;
    const dim = window.getSvgDim();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "vid_" + Date.now();
    fo.setAttribute("class", "duzenlenebilir video-obj");
    fo.setAttribute("x", dim.w/2 - 400);
    fo.setAttribute("y", dim.h/2 - 225);
    fo.setAttribute("width", 800);
    fo.setAttribute("height", 450);
    
    window.setD(fo, 'video-url', 'https://www.w3schools.com/html/mov_bbb.mp4');
    window.setD(fo, 'video-muted', 'true');
    window.setD(fo, 'video-loop', 'true');
    window.setD(fo, 'mask-shape', 'none');
    window.setD(fo, 'rx', '0');
    
    svg.appendChild(fo); window.updateVideoDisplay(fo);
    window.selectedEl = fo; window.saveState(); window.setupLayers(); window.updateUI(fo); window.renderEditor();
};

window.updateVideoDisplay = function(el) {
    if (!el || !el.classList.contains('video-obj')) return;
    const url = window.getD(el, 'video-url') || '';
    const muted = window.getD(el, 'video-muted') === 'true' ? 'muted' : '';
    const loop = window.getD(el, 'video-loop') === 'true' ? 'loop' : '';
    
    const isYT = url.includes('youtube.com') || url.includes('youtu.be');
    const isHLS = url.includes('.m3u8');
    
    let innerHTMLString = '';
    
    if (isYT) {
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
        const ytId = ytMatch ? ytMatch[1] : '';
        const muteParam = window.getD(el, 'video-muted') === 'true' ? '&mute=1' : '';
        const loopParam = window.getD(el, 'video-loop') === 'true' ? `&loop=1&playlist=${ytId}` : '';
        
        innerHTMLString = `<iframe style="width:100%; height:100%; pointer-events:none; border:none; background:#000;" src="https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&enablejsapi=1&iv_load_policy=3${muteParam}${loopParam}&origin=${window.location.origin}" allow="autoplay; encrypted-media"></iframe>`;
    } else if (isHLS) {
        const vidId = "v_" + Date.now() + Math.floor(Math.random()*1000);
        innerHTMLString = `<video id="${vidId}" style="width:100%; height:100%; object-fit:cover; pointer-events:none; background:#000;" autoplay playsinline ${muted} ${loop}></video>`;
        
        setTimeout(() => {
            const vEl = document.getElementById(vidId);
            if (vEl && window.Hls && Hls.isSupported()) {
                const hls = new Hls({ maxBufferLength: 60, liveSyncDurationCount: 3 });
                hls.loadSource(url); hls.attachMedia(vEl);
            } else if (vEl && vEl.canPlayType('application/vnd.apple.mpegurl')) {
                vEl.src = url; 
            }
        }, 100);
    } else {
        innerHTMLString = `<video style="width:100%; height:100%; object-fit:cover; pointer-events:none; background:#000;" src="${url}" autoplay playsinline ${muted} ${loop}></video>`;
    }
    
    el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; background:#000; overflow:hidden;">${innerHTMLString}</div>`;
    window.applyShapeMask(el); 
};

window.addRssBand = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; 
    const dim = window.getSvgDim();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "rss_" + Date.now();
    fo.setAttribute("class", "duzenlenebilir rss-band");
    fo.setAttribute("x", 0);
    fo.setAttribute("y", dim.h - 80);
    fo.setAttribute("width", dim.w);
    fo.setAttribute("height", 80);
    
    window.setD(fo, 'rss-url', 'https://api.collectapi.com/news/getNews?country=tr&tag=general');
    window.setD(fo, 'collect-api-key', '');
    window.setD(fo, 'rss-speed', '35');
    window.setD(fo, 'solid-color', '#dc2626'); // Başlık Rengi
    window.setD(fo, 'ticker-bg', '#0f172a');  // 🚀 YENİ: Kayan Yazı Arkaplan Rengi
    window.setD(fo, 'text-color', '#ffffff');
    window.setD(fo, 'base-font-size', '30');
    window.setD(fo, 'font-family', 'sans-serif'); 
    window.setD(fo, 'banned-words', ''); 
    window.setD(fo, 'rss-title', 'SON DAKİKA'); // 🚀 YENİ: Sabit Başlık Metni
    
    svg.appendChild(fo); window.updateRssDisplay(fo);
    window.selectedEl = fo; window.saveState(); window.setupLayers(); window.updateUI(fo); window.renderEditor();
};

window.addTickerBand = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; 
    const dim = window.getSvgDim();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "ticker_" + Date.now();
    fo.setAttribute("class", "duzenlenebilir ticker-band");
    fo.setAttribute("x", 0);
    fo.setAttribute("y", dim.h - 160); // RSS'in biraz üstüne koyar
    fo.setAttribute("width", dim.w);
    fo.setAttribute("height", 80);
    
    window.setD(fo, 'ticker-text', 'BURAYA İSTEDİĞİNİZ DUYURUYU VEYA KAMPANYAYI YAZABİLİRSİNİZ...        TÜRKÇE KARAKTER DESTEKLİDİR...');
    window.setD(fo, 'ticker-speed', '35');
    window.setD(fo, 'solid-color', '#3b82f6'); // Varsayılan Başlık Rengi (Mavi)
    window.setD(fo, 'ticker-bg', '#0f172a');  
    window.setD(fo, 'text-color', '#ffffff');
    window.setD(fo, 'base-font-size', '30');
    window.setD(fo, 'font-family', 'sans-serif'); 
    window.setD(fo, 'ticker-title', 'DUYURU'); // Varsayılan Başlık
    
    svg.appendChild(fo); window.updateTickerDisplay(fo);
    window.selectedEl = fo; window.saveState(); window.setupLayers(); window.updateUI(fo); window.renderEditor();
};

window.updateTickerDisplay = function(el) {
    if (!el || !el.classList.contains('ticker-band')) return;
    let text = window.getD(el, 'ticker-text') || 'METİN GİRİNİZ...';
    
    // 🎨 Renk kodlarını algılayan sistem (İzmir kırmızı vs.)
    text = text.replace(/\[color=([^\]]+)\](.*?)\[\/color\]/gi, '<span style="color:$1;">$2</span>');

    const speed = window.getD(el, 'ticker-speed') || '35';
    const bgColor = window.getD(el, 'solid-color') || '#3b82f6'; 
    const tickerBg = window.getD(el, 'ticker-bg') || '#0f172a'; 
    const txtColor = window.getD(el, 'text-color') || '#ffffff';
    const fSize = window.getD(el, 'base-font-size') || '30';
    const fontFamily = window.getD(el, 'font-family') || 'sans-serif'; 
    const tickerTitle = window.getD(el, 'ticker-title') !== undefined ? window.getD(el, 'ticker-title') : 'DUYURU'; 

    // 🚀 KÖKTEN ÇÖZÜM: Metni çoğaltıp aralara şık bir ayraç ve boşluk atıyoruz
    const spacer = "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
    const textBlock = Array(5).fill(text).join(spacer + "•" + spacer) + spacer + "•" + spacer;

    // Her kayan yazıya benzersiz animasyon adı (farklı hızların çakışmaması için)
    const animName = 'marquee_' + el.id.replace(/[^a-zA-Z0-9]/g, '');

    const titleBlockHtml = tickerTitle.trim() !== '' ? `
        <div style="position:absolute; left:0; top:0; bottom:0; background:${bgColor}; padding:0 40px 0 20px; display:flex; align-items:center; justify-content:center; clip-path:polygon(0 0, 100% 0, calc(100% - 30px) 100%, 0 100%); z-index:10; border-right: 4px solid rgba(0,0,0,0.2);">
            <span style="color:#ffffff; font-size:${fSize * 0.85}px; font-weight:900; font-family:${fontFamily}; white-space:nowrap; text-transform:uppercase; letter-spacing:1px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${tickerTitle}</span>
        </div>` : '';

    el.innerHTML = `
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; position:relative; overflow:hidden; background:${tickerBg}; border-top:3px solid #fff;">
        
        <style>
            /* Matematiksel Kusursuz Döngü: Sadece %50'ye kadar kayar ve çaktırmadan başa atlar! */
            @keyframes ${animName} {
                0% { transform: translateX(0%); }
                100% { transform: translateX(-50%); }
            }
        </style>

        <div style="display:flex; width:max-content; height:100%; align-items:center; animation: ${animName} ${speed}s linear infinite;">
            <div style="white-space:nowrap; color:${txtColor}; font-size:${fSize}px; font-weight:800; font-family:${fontFamily}; text-transform:uppercase; letter-spacing:1px;">${textBlock}</div>
            <div style="white-space:nowrap; color:${txtColor}; font-size:${fSize}px; font-weight:800; font-family:${fontFamily}; text-transform:uppercase; letter-spacing:1px;">${textBlock}</div>
        </div>
        
        ${titleBlockHtml}
    </div>`;
};

window.updateRssDisplay = function(el) {
    if (!el || !el.classList.contains('rss-band')) return;
    const url = window.getD(el, 'rss-url') || '';
    const speed = window.getD(el, 'rss-speed') || '35';
    const bgColor = window.getD(el, 'solid-color') || '#dc2626'; 
    const tickerBg = window.getD(el, 'ticker-bg') || '#0f172a'; // 🚀 Arkaplan rengi çekildi
    const txtColor = window.getD(el, 'text-color') || '#ffffff';
    const fSize = window.getD(el, 'base-font-size') || '30';
    const fontFamily = window.getD(el, 'font-family') || 'sans-serif'; 
    const rssTitle = window.getD(el, 'rss-title') !== undefined ? window.getD(el, 'rss-title') : 'SON DAKİKA'; 
    
    // Eğer kullanıcı başlık metnini silerse kutuyu tamamen gizle
    const titleBlockHtml = rssTitle.trim() !== '' ? `
        <div style="position:absolute; left:0; top:0; bottom:0; background:${bgColor}; padding:0 40px 0 20px; display:flex; align-items:center; justify-content:center; clip-path:polygon(0 0, 100% 0, calc(100% - 30px) 100%, 0 100%); z-index:10; border-right: 4px solid rgba(0,0,0,0.2);">
            <span style="color:#ffffff; font-size:${fSize * 0.85}px; font-weight:900; font-family:${fontFamily}; white-space:nowrap; text-transform:uppercase; letter-spacing:1px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${rssTitle}</span>
        </div>` : '';

    el.innerHTML = `
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; position:relative; overflow:hidden; background:${tickerBg}; border-top:3px solid #fff;">
        
        <div style="position:absolute; inset:0; display:flex; align-items:center;">
            <div class="rss-scroller" style="white-space:nowrap; color:${txtColor}; font-size:${fSize}px; font-weight:800; font-family:${fontFamily}; text-transform:uppercase; animation: scrollNews ${speed}s linear infinite; padding-left:100vw; letter-spacing:1px;">🔴 HABER BANT ÖNİZLEMESİ (${url || 'Link Yok'})</div>
        </div>

        ${titleBlockHtml}

    </div>`;
};

window.addWeather = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return;
    const dim = window.getSvgDim();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "wth_" + Date.now();
    fo.setAttribute("class", "duzenlenebilir weather-widget");
    fo.setAttribute("x", dim.w/2 - 190); 
    fo.setAttribute("y", dim.h/2 - 240);
    fo.setAttribute("width", 380); 
    fo.setAttribute("height", 480);
    
    window.setD(fo, 'city', 'Izmir');
    window.setD(fo, 'theme', 'light');
    window.setD(fo, 'mask-shape', 'none');
    
    svg.appendChild(fo); window.updateWeatherDisplay(fo);
    window.selectedEl = fo; window.saveState(); window.setupLayers(); window.updateUI(fo); window.renderEditor();
};

window.updateWeatherDisplay = async function(el) {
    if (!el || !el.classList.contains('weather-widget')) return;
    const city = window.getD(el, 'city') || 'Izmir';
    const theme = window.getD(el, 'theme') || 'light';
    
    const mainBg = theme === 'dark' ? '#1e293b' : '#ffffff';
    const gridBg = theme === 'dark' ? '#334155' : '#f8f3ee';
    const textColor = theme === 'dark' ? '#cbd5e1' : '#64748b';
    const valColor = theme === 'dark' ? '#38bdf8' : '#0369a1';

    el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:${mainBg}; color:${textColor}; border-radius:20px; font-family:sans-serif;">Yükleniyor...</div>`;
    window.applyShapeMask(el);

    try {
        // 🚀 BURAYA KENDİ OPENWEATHERMAP API KEY'İNİ YAZ 
        const OWM_API_KEY = "97fe4c9ee7efb72f3e0520ceb21bba8b"; 
        
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&lang=tr&appid=${OWM_API_KEY}`);
        if(!res.ok) throw new Error("API Hatası");
        const data = await res.json();
        
        const temp = Math.round(data.main.temp);
        const feelsLike = Math.round(data.main.feels_like);
        let desc = data.weather[0].description;
        desc = desc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); 
        
        const wind = data.wind.speed.toFixed(1);
        const humidity = data.main.humidity;
        const visibility = (data.visibility / 1000).toFixed(1);
        const pressure = data.main.pressure;
        const clouds = data.clouds.all; 
        const minMax = `${Math.round(data.main.temp_min)}° / ${Math.round(data.main.temp_max)}°`;

        let bgUrl = "https://images.unsplash.com/photo-1601297183305-6df142704ea2?q=80&w=600&auto=format&fit=crop"; 
        if(data.weather[0].main === 'Clear') bgUrl = "https://images.unsplash.com/photo-1529126624584-eb58aa1f868c?q=80&w=600&auto=format&fit=crop"; 
        else if(data.weather[0].main === 'Rain' || data.weather[0].main === 'Drizzle' || data.weather[0].main === 'Thunderstorm') bgUrl = "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=600&auto=format&fit=crop"; 
        else if(data.weather[0].main === 'Snow') bgUrl = "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?q=80&w=600&auto=format&fit=crop"; 

        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');

        el.innerHTML = `
        <div xmlns="http://www.w3.org/1999/xhtml" style="container-type: size; width: 100%; height: 100%; background: ${mainBg}; border-radius: 20px; font-family: sans-serif; display: flex; flex-direction: column; justify-content: space-between; padding: 4%; box-sizing: border-box;">
            
            <div style="width: 100%; height: 50%; background: #1e293b; border-radius: 14px; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 5%; box-sizing: border-box; box-shadow: inset 0 0 40px rgba(0,0,0,0.4); color: white;">
                <img src="${bgUrl}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.65; mix-blend-mode: overlay; pointer-events: none;" />
                
                <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="font-size: 8cqmin; font-weight: 800; text-shadow: 0 2px 5px rgba(0,0,0,0.6);">${city.toUpperCase()}</div>
                    <div style="font-size: 6cqmin; font-weight: bold; text-shadow: 0 2px 5px rgba(0,0,0,0.6);">${timeStr}</div>
                </div>
                
                <div style="position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: space-between;">
                    <div style="font-size: 25cqmin; font-weight: 800; line-height: 0.8; text-shadow: 0 4px 10px rgba(0,0,0,0.5);">${temp}°</div>
                    <div style="text-align: right; display: flex; flex-direction: column; gap: 1cqmin;">
                        <div style="font-size: 5.5cqmin; font-weight: bold; text-shadow: 0 2px 5px rgba(0,0,0,0.6);">${desc}</div>
                        <div style="font-size: 4cqmin; opacity: 0.95; text-shadow: 0 2px 5px rgba(0,0,0,0.6);">Hissedilen: ${feelsLike}°</div>
                    </div>
                </div>
            </div>

            <div style="width: 100%; height: 46%; display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 3%;">
                <div style="background: ${gridBg}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="font-size: 4cqmin; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-wind"></i> Rüzgâr</div>
                    <div style="font-size: 5cqmin; color: ${valColor}; font-weight: bold; margin-top: 4px;">${wind} m/s</div>
                </div>
                <div style="background: ${gridBg}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="font-size: 4cqmin; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-drop"></i> Nem</div>
                    <div style="font-size: 5cqmin; color: ${valColor}; font-weight: bold; margin-top: 4px;">%${humidity}</div>
                </div>
                <div style="background: ${gridBg}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="font-size: 4cqmin; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-eye"></i> Görünürlük</div>
                    <div style="font-size: 5cqmin; color: ${valColor}; font-weight: bold; margin-top: 4px;">${visibility} km</div>
                </div>
                <div style="background: ${gridBg}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="font-size: 4cqmin; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-arrows-in"></i> Basınç</div>
                    <div style="font-size: 5cqmin; color: ${valColor}; font-weight: bold; margin-top: 4px;">${pressure} hPa</div>
                </div>
                <div style="background: ${gridBg}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="font-size: 4cqmin; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-cloud"></i> Bulutluluk</div>
                    <div style="font-size: 5cqmin; color: ${valColor}; font-weight: bold; margin-top: 4px;">%${clouds}</div>
                </div>
                <div style="background: ${gridBg}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div style="font-size: 4cqmin; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-thermometer"></i> Min/Maks</div>
                    <div style="font-size: 5cqmin; color: ${valColor}; font-weight: bold; margin-top: 4px;">${minMax}</div>
                </div>
            </div>
        </div>`;
        window.applyShapeMask(el); 
    } catch(e) {
        el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:${mainBg}; color:red; border-radius:20px; font-family:sans-serif;">Hata: Şehir bulunamadı veya API hatası</div>`;
    }
};
window.addCurrency = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return;
    const dim = window.getSvgDim();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "cur_" + Date.now();
    fo.setAttribute("class", "duzenlenebilir currency-widget");
    fo.setAttribute("x", dim.w/2 - 300); fo.setAttribute("y", dim.h/2 - 75);
    fo.setAttribute("width", 600); fo.setAttribute("height", 150);
    
    window.setD(fo, 'currencies', 'USD,EUR,GBP');
    window.setD(fo, 'mask-shape', 'none');
    
    svg.appendChild(fo); window.updateCurrencyDisplay(fo);
    window.selectedEl = fo; window.saveState(); window.setupLayers(); window.updateUI(fo); window.renderEditor();
};

window.updateCurrencyDisplay = async function(el) {
    if (!el || !el.classList.contains('currency-widget')) return;
    const curs = (window.getD(el, 'currencies') || 'USD,EUR,GBP').split(',').map(c=>c.trim().toUpperCase());
    
    el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.7); color:#fff; border-radius:15px; font-family:sans-serif; backdrop-filter:blur(10px);">Yükleniyor...</div>`;
    window.applyShapeMask(el);

    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        const tryRate = data.rates['TRY'];
        
        let htmlBlocks = '';
        curs.forEach(c => {
            let val = "0.00";
            if(c === 'USD') val = tryRate.toFixed(2);
            else if(data.rates[c]) {
                val = (tryRate / data.rates[c]).toFixed(2);
            }
            
            let flag = "💰";
            if(c==='USD') flag="🇺🇸"; if(c==='EUR') flag="🇪🇺"; if(c==='GBP') flag="🇬🇧"; if(c==='CHF') flag="🇨🇭"; if(c==='JPY') flag="🇯🇵"; if(c==='SAR' || c==='AED') flag="🇸🇦";
            
            htmlBlocks += `<div style="display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.1); padding:15px; border-radius:10px; min-width:100px;">
                <span style="font-size:1.5em; margin-bottom:5px;">${flag}</span>
                <span style="font-size:1em; color:#10b981; font-weight:bold;">${c}</span>
                <span style="font-size:1.6em; font-weight:800;">₺${val}</span>
            </div>`;
        });

        el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; justify-content:space-evenly; background:rgba(0,0,0,0.7); color:#fff; border-radius:15px; font-family:sans-serif; backdrop-filter:blur(10px); padding:10px; box-sizing:border-box;">
            ${htmlBlocks}
        </div>`;
        window.applyShapeMask(el);
    } catch(e) {
        el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.7); color:#fff; border-radius:15px; font-family:sans-serif; backdrop-filter:blur(10px);">Hata: Kurlar Alınamadı</div>`;
    }
};

window.processImportedFile = function(file) {
    if (!file) return;
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parser = new DOMParser(); const doc = parser.parseFromString(ev.target.result, "image/svg+xml"); const importedSvg = doc.documentElement;
                if (importedSvg.tagName === 'parsererror') { window.showToast("Geçersiz SVG", "error"); return; }
                const mainSvg = document.querySelector('#canvas-inner svg'); const center = window.getCanvasCenter();
                importedSvg.id = "svg_import_" + Date.now(); importedSvg.setAttribute("class", "duzenlenebilir");
                importedSvg.style.position = ""; importedSvg.style.left = ""; importedSvg.style.top = "";
                let w = parseFloat(importedSvg.getAttribute('width')) || 400; let h = parseFloat(importedSvg.getAttribute('height')) || 400;
                if(importedSvg.hasAttribute('viewBox') && (!importedSvg.hasAttribute('width') || !importedSvg.hasAttribute('height'))) {
                    const vb = importedSvg.getAttribute('viewBox').split(/\s+|,/); if(vb.length >= 4) { w = parseFloat(vb[2]); h = parseFloat(vb[3]); importedSvg.setAttribute('width', w); importedSvg.setAttribute('height', h); }
                }
                importedSvg.setAttribute("x", center.cx - (w / 2)); importedSvg.setAttribute("y", center.cy - (h / 2));
                mainSvg.appendChild(importedSvg); window.selectedEl = importedSvg; window.saveState(); window.setupLayers(); window.updateUI(importedSvg); window.renderEditor(); window.showToast("SVG Eklendi", "success");
            } catch(e) { window.showToast("Hata!", "error"); }
        }; reader.readAsText(file);
    } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const svg = document.querySelector('#canvas-inner svg'); const center = window.getCanvasCenter();
            const img = document.createElementNS("http://www.w3.org/2000/svg", "image"); img.id = "img_" + Date.now(); img.setAttribute("class", "duzenlenebilir"); img.setAttribute("x", center.cx - 150); img.setAttribute("y", center.cy - 150); img.setAttribute("width", 300); img.setAttribute("height", 300); window.setD(img, "rx", "0"); window.setD(img, "smoothing", "0.5"); window.setD(img, "mask-shape", "none"); img.setAttribute("href", ev.target.result);
            svg.appendChild(img); window.selectedEl = img; window.saveState(); window.setupLayers(); window.updateUI(img); window.renderEditor();
        }; reader.readAsDataURL(file);
    }
};

document.getElementById('img-in')?.addEventListener('change', (e) => { window.processImportedFile(e.target.files[0]); e.target.value = ""; });
const mv = document.getElementById('main-view');
if(mv) { mv.addEventListener('dragover', (e) => { e.preventDefault(); mv.style.opacity = '0.8'; }); mv.addEventListener('dragleave', (e) => { e.preventDefault(); mv.style.opacity = '1'; }); mv.addEventListener('drop', (e) => { e.preventDefault(); mv.style.opacity = '1'; window.processImportedFile(e.dataTransfer.files[0]); }); }

window.pickColor = async function(id, dataKey, attrToSet) {
    if (!window.EyeDropper) { window.showToast("Tarayıcı desteklemiyor", "error"); return; }
    try { const eyeDropper = new EyeDropper(); const result = await eyeDropper.open(); const color = result.sRGBHex; const el = document.getElementById(id); if(el) { window.addRecentColor(color); if (dataKey) window.setD(el, dataKey.replace(/([A-Z])/g, "-$1").toLowerCase(), color); if (dataKey === 'color1' || dataKey === 'color2' || dataKey === 'solidColor') window.applyFill(el); else { el.setAttribute(attrToSet, color); } window.saveState(); window.renderProperties(); } } catch (e) {}
};

window.applyRecentColor = function(id, color) { const el = document.getElementById(id); if(!el) return; const fillType = window.getD(el, 'fill-type') || 'solid'; if(fillType === 'solid') { window.setD(el, 'solid-color', color); window.applyFill(el); } else { window.setD(el, 'color1', color); window.applyFill(el); } window.saveState(); window.renderProperties(); };

window.refreshAutoTextFields = function() {
    const list = document.getElementById('auto-fields-list'); 
    const svg = document.querySelector('#canvas-inner svg'); 
    if(!svg || !list) return;
    
    const textElements = svg.querySelectorAll('text.duzenlenebilir'); 
    list.innerHTML = ""; 
    let hasVars = false;
    
    textElements.forEach((el, index) => {
        hasVars = true;
        const varName = el.getAttribute('data-var-name') || `YAZI ${index + 1}`;
        const currentVal = window.getD(el, 'raw-text') || el.textContent; 
        const row = document.createElement('div'); row.style.marginBottom = "8px";
        row.innerHTML = `<div class="label-row"><span class="label-text" style="color:#f472b6;"><i class="ph ph-text-aa"></i> ${varName}</span></div><input type="text" value="${currentVal.replace(/"/g, '&quot;')}" oninput="window.updateVarValue('${el.id}', this.value)" onchange="window.saveState()" style="border-color:rgba(244,114,182,0.3);">`; 
        list.appendChild(row);
    });
    
    if(!hasVars) list.innerHTML = `<div style="font-size:11px; color:#64748b; text-align:center;">Sahnede henüz yazı yok. Yazı eklediğinizde burada listelenecektir.</div>`;
};

window.updateVarValue = function(id, val) { const el = document.getElementById(id); if(!el) return; window.changeSetting(id, 'raw-text', val); if(window.selectedEl && window.selectedEl.id === id) { document.querySelectorAll('input[oninput*="raw-text"]').forEach(input => { if(!input.getAttribute('oninput').includes('updateVarValue')) input.value = val; }); } };

window.changeProp = function(id, prop, val, elUI) {
    const el = document.getElementById(id); if(!el) return;
    if(prop === 'x') el.setAttribute('x', val); if(prop === 'y') el.setAttribute('y', val);
    if(prop === 'w') { if(el.tagName === 'text') { if(val > 10) { el.setAttribute('textLength', val); el.setAttribute('lengthAdjust', 'spacingAndGlyphs'); const tp = el.querySelector('textPath'); if (tp) { tp.setAttribute('textLength', val); tp.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } } else { el.removeAttribute('textLength'); el.removeAttribute('lengthAdjust'); const tp = el.querySelector('textPath'); if (tp) { tp.removeAttribute('textLength'); tp.removeAttribute('lengthAdjust'); } } } else { el.setAttribute('width', val); } }
    if(prop === 'h') { if(el.tagName === 'text') { window.setD(el, 'base-font-size', val); el.setAttribute('font-size', val); } else { el.setAttribute('height', val); } }
    if (elUI) { const badge = document.getElementById('val-' + prop + '-' + id); if (badge) badge.innerText = val + 'px'; if (elUI.type === 'range' && elUI.nextElementSibling && elUI.nextElementSibling.type === 'number') elUI.nextElementSibling.value = val; else if (elUI.type === 'number' && elUI.previousElementSibling && elUI.previousElementSibling.type === 'range') elUI.previousElementSibling.value = val; }
    if(el.tagName === 'text') window.applyTextCurve(el); 
    if(el.tagName === 'image' || el.tagName === 'rect' || el.classList.contains('video-obj') || el.classList.contains('weather-widget') || el.classList.contains('currency-widget')) window.applyShapeMask(el); 
    window.updateUI(el);
};

window.changeSetting = function(id, key, val, elUI) {
    const el = document.getElementById(id); if(!el) return; window.setD(el, key, val);
    if (key === 'raw-text') { el.removeAttribute('textLength'); el.removeAttribute('lengthAdjust'); const tp = el.querySelector('textPath'); if (tp) { tp.removeAttribute('textLength'); tp.removeAttribute('lengthAdjust'); } }
    if(key === 'curve' || key === 'raw-text' || key === 'letter-spacing' || key === 'max-width' || key === 'max-height') { if(key === 'letter-spacing') el.setAttribute('letter-spacing', val); window.applyTextCurve(el); }
    if(key === 'rx' || key === 'mask-shape') window.applyShapeMask(el); if(key === 'angle') window.applyTransforms(el);
    if(['solid-color', 'color1', 'color2', 'fill-type'].includes(key)) window.applyFill(el); 
    if (elUI) { const badge = document.getElementById('val-' + key + '-' + id); if (badge) badge.innerText = val + (key === 'angle' ? '°' : (key === 'curve' ? '' : 'px')); if (elUI.type === 'range' && elUI.nextElementSibling && elUI.nextElementSibling.type === 'number') elUI.nextElementSibling.value = val; else if (elUI.type === 'number' && elUI.previousElementSibling && elUI.previousElementSibling.type === 'range') elUI.previousElementSibling.value = val; }
    window.updateUI(el);
};

window.changeFilter = function(id, filterType, val, elUI) {
    const el = document.getElementById(id); if(!el) return;
    if(filterType === 'opacity') el.setAttribute('opacity', val); else window.setD(el, filterType, val); window.applyFilters(el);
    if (elUI) { const badge = document.getElementById('val-' + (filterType==='opacity'?'op':(filterType==='shadow-x'?'sx':(filterType==='shadow-y'?'sy':(filterType==='shadow-blur'?'sb':'bl')))) + '-' + id); if (badge) badge.innerText = (filterType==='opacity' ? Math.round(val*100)+'%' : val+'px'); if (elUI.type === 'range' && elUI.nextElementSibling && elUI.nextElementSibling.type === 'number') elUI.nextElementSibling.value = val; else if (elUI.type === 'number' && elUI.previousElementSibling && elUI.previousElementSibling.type === 'range') elUI.previousElementSibling.value = val; }
};

window.applyTextStyle = function(id, style, val) {
    const el = document.getElementById(id); if(!el || el.tagName !== 'text') return; const rawText = window.getD(el, 'raw-text') || el.textContent;
    if(style === 'normal') { el.innerHTML = ''; el.textContent = rawText; window.setD(el, 'text-style', 'normal'); window.applyTextCurve(el); }
    else if(style === 'neon') { window.setD(el, 'text-style', 'neon'); el.innerHTML = `<tspan font-weight="bold" fill="#ffffff" stroke="${window.getD(el, 'solid-color')||'#000'}" stroke-width="2" filter="drop-shadow(0 0 15px ${window.getD(el, 'solid-color')||'#000'})">${rawText}</tspan>`; }
    else if(style === '3d') { window.setD(el, 'text-style', '3d'); el.innerHTML = `<tspan font-weight="bold" fill="${window.getD(el, 'solid-color')||'#000'}" stroke="#000000" stroke-width="3" filter="drop-shadow(6px 6px 0 #000000)">${rawText}</tspan>`; }
    else if(style === 'hollow') { window.setD(el, 'text-style', 'hollow'); el.innerHTML = `<tspan fill="none" stroke="${window.getD(el, 'solid-color')||'#000'}" stroke-width="4">${rawText}</tspan>`; }
    else if(style === 'bold') { window.setD(el, 'bold', window.getD(el, 'bold') === 'true' ? 'false' : 'true'); el.setAttribute('font-weight', window.getD(el, 'bold') === 'true' ? 'bold' : 'normal'); }
    else if(style === 'italic') { window.setD(el, 'italic', window.getD(el, 'italic') === 'true' ? 'false' : 'true'); el.setAttribute('font-style', window.getD(el, 'italic') === 'true' ? 'italic' : 'normal'); }
    else if(style === 'underline') { window.setD(el, 'underline', window.getD(el, 'underline') === 'true' ? 'false' : 'true'); el.setAttribute('text-decoration', window.getD(el, 'underline') === 'true' ? 'underline' : 'none'); }
    else if(style === 'align') { el.setAttribute('text-anchor', val); window.autoFitText(el); } 
    window.saveState(); window.renderEditor(); window.updateUI(el);
};

window.alignElement = function(id, type) {
    const el = document.getElementById(id); if(!el) return; const dim = window.getSvgDim(); const w = dim.w, h = dim.h;
    let bbox = {x:0, y:0, width:0, height:0}; try { bbox = el.getBBox(); } catch(e){}
    if (el.tagName === 'text') { if(type === 'center-h') el.setAttribute('x', w/2); if(type === 'center-v') el.setAttribute('y', h/2); if(type === 'left') el.setAttribute('x', bbox.width/2); if(type === 'right') el.setAttribute('x', w - bbox.width/2); } 
    else { let nw = parseFloat(el.getAttribute('width')) || bbox.width; let nh = parseFloat(el.getAttribute('height')) || bbox.height; if(type === 'center-h') el.setAttribute('x', (w/2) - (nw/2)); if(type === 'center-v') el.setAttribute('y', (h/2) - (nh/2)); if(type === 'left') el.setAttribute('x', 0); if(type === 'right') el.setAttribute('x', w - nw); } 
    if(el.tagName === 'image' || el.tagName === 'rect' || el.classList.contains('video-obj') || el.classList.contains('weather-widget') || el.classList.contains('currency-widget')) window.applyShapeMask(el); window.saveState(); window.updateUI(el);
};

window.toggleFlip = function(id, dir) { const el = document.getElementById(id); if(!el) return; if(dir === 'x') window.setD(el, 'flip-x', window.getD(el, 'flip-x') === "-1" ? "1" : "-1"); else window.setD(el, 'flip-y', window.getD(el, 'flip-y') === "-1" ? "1" : "-1"); window.applyTransforms(el); window.saveState(); };

window.applyTransforms = function(el) {
    let cx = 0, cy = 0; if(el.tagName === 'text') { cx = parseFloat(el.getAttribute('x')) || 0; cy = parseFloat(el.getAttribute('y')) || 0; } else if(el.tagName !== 'path') { cx = (parseFloat(el.getAttribute('x')) || 0) + (parseFloat(el.getAttribute('width')) || 0) / 2; cy = (parseFloat(el.getAttribute('y')) || 0) + (parseFloat(el.getAttribute('height')) || 0) / 2; }
    const angle = parseFloat(window.getD(el, 'angle')) || 0; const fx = parseFloat(window.getD(el, 'flip-x')) || 1; const fy = parseFloat(window.getD(el, 'flip-y')) || 1;
    el.setAttribute("transform", `rotate(${angle} ${cx} ${cy}) translate(${cx} ${cy}) scale(${fx} ${fy}) translate(${-cx} ${-cy})`); window.updateUI(el);
};

window.applyFilters = function(el) { 
    const sx = parseFloat(window.getD(el, 'shadow-x')) || 0, sy = parseFloat(window.getD(el, 'shadow-y')) || 0, sb = parseFloat(window.getD(el, 'shadow-blur')) || 0, sc = window.getD(el, 'shadow-color') || '#000000'; 
    const bri = parseFloat(window.getD(el, 'bri')) || 100, con = parseFloat(window.getD(el, 'con')) || 100, sat = parseFloat(window.getD(el, 'sat')) || 100, gray = parseFloat(window.getD(el, 'gray')) || 0, bl = parseFloat(window.getD(el, 'blur')) || 0; 
    const blend = window.getD(el, 'blend') || 'normal'; let filterStr = ''; 
    if (sx != 0 || sy != 0 || sb != 0) filterStr += `drop-shadow(${sx}px ${sy}px ${sb}px ${sc}) `; 
    if (bri != 100) filterStr += `brightness(${bri}%) `; if (con != 100) filterStr += `contrast(${con}%) `; if (sat != 100) filterStr += `saturate(${sat}%) `; if (gray > 0) filterStr += `grayscale(${gray}%) `; if (bl > 0) filterStr += `blur(${bl}px) `;
    el.style.filter = filterStr.trim(); el.style.mixBlendMode = blend; el.setAttribute('style', el.getAttribute('style') || ''); 
};

window.applyFill = function(el) {
    if(el.tagName === 'image' || el.classList.contains('rss-band') || el.classList.contains('video-obj') || el.classList.contains('weather-widget') || el.classList.contains('currency-widget')) {
        if(el.classList.contains('rss-band')) window.updateRssDisplay(el);
        if(el.classList.contains('video-obj')) window.updateVideoDisplay(el);
        if(el.classList.contains('weather-widget')) window.updateWeatherDisplay(el);
        if(el.classList.contains('currency-widget')) window.updateCurrencyDisplay(el);
        return;
    }
    const type = window.getD(el, 'fill-type') || 'solid';
    let fillVal = '';
    if (type === 'gradient') {
        const c1 = window.getD(el, 'color1') || '#10b981'; const c2 = window.getD(el, 'color2') || '#3b82f6';
        const svg = document.querySelector('#canvas-inner svg'); let defs = svg.querySelector('defs'); if (!defs) { defs = document.createElementNS("http://www.w3.org/2000/svg", "defs"); svg.prepend(defs); }
        let gradId = "grad_" + el.id; let grad = defs.querySelector("#" + gradId);
        if (!grad) { grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient"); grad.id = gradId; grad.setAttribute("x1", "0%"); grad.setAttribute("y1", "0%"); grad.setAttribute("x2", "100%"); grad.setAttribute("y2", "100%"); const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop"); stop1.setAttribute("offset", "0%"); stop1.className = "stop1"; const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop"); stop2.setAttribute("offset", "100%"); stop2.className = "stop2"; grad.appendChild(stop1); grad.appendChild(stop2); defs.appendChild(grad); }
        grad.querySelector(".stop1").setAttribute("stop-color", c1); grad.querySelector(".stop2").setAttribute("stop-color", c2); fillVal = `url(#${gradId})`;
    } else { fillVal = window.getD(el, 'solid-color'); }
    if (!fillVal && type !== 'gradient') return;
    el.setAttribute("fill", fillVal); if(el.tagName !== 'path') el.style.fill = fillVal;
    if(el.tagName === 'g' || el.tagName === 'svg') { el.querySelectorAll('path, circle, rect, polygon').forEach(child => { child.style.fill = fillVal; child.setAttribute('fill', fillVal); }); }
};

window.autoFitText = function(el) { 
    if (el.tagName !== 'text') return; const boundRectId = window.getD(el, 'bound-rect');
    if (boundRectId) { const rect = document.getElementById(boundRectId); if (rect && (rect.tagName === 'rect' || rect.tagName === 'image')) { const rx = parseFloat(rect.getAttribute('x')) || 0; const ry = parseFloat(rect.getAttribute('y')) || 0; const rw = parseFloat(rect.getAttribute('width')) || 0; const rh = parseFloat(rect.getAttribute('height')) || 0; el.setAttribute('x', rx + rw / 2); el.setAttribute('y', ry + rh / 2); el.setAttribute('text-anchor', 'middle'); el.setAttribute('dominant-baseline', 'central'); window.setD(el, 'max-width', Math.max(10, rw - 40));  window.setD(el, 'max-height', Math.max(10, rh - 40));  el.removeAttribute('textLength'); el.removeAttribute('lengthAdjust'); const tp = el.querySelector('textPath'); if (tp) { tp.removeAttribute('textLength'); tp.removeAttribute('lengthAdjust'); } } }
    const mw = parseFloat(window.getD(el, 'max-width')) || 0; const mh = parseFloat(window.getD(el, 'max-height')) || 0; const baseFs = parseFloat(window.getD(el, 'base-font-size')) || 60; 
    if (mw > 0 || mh > 0) { el.removeAttribute('textLength'); el.removeAttribute('lengthAdjust'); const tp = el.querySelector('textPath'); if (tp) { tp.removeAttribute('textLength'); tp.removeAttribute('lengthAdjust'); } }
    el.style.fontSize = baseFs + "px"; el.setAttribute("font-size", baseFs); 
    if (mw > 0 || mh > 0) { let bbox = {width:0, height:0}; try { bbox = el.getBBox(); } catch(e){} let scaleW = 1; let scaleH = 1; if (mw > 0 && bbox.width > mw && bbox.width > 0) { scaleW = mw / bbox.width; } if (mh > 0 && bbox.height > mh && bbox.height > 0) { scaleH = mh / bbox.height; } const finalScale = Math.min(scaleW, scaleH); if(finalScale < 1) { const newFs = baseFs * finalScale;  el.style.fontSize = newFs + "px"; el.setAttribute("font-size", newFs);  } }
};

window.applyTextCurve = function(el) {
    if (el.tagName !== 'text') return; const curve = parseFloat(window.getD(el, 'curve')) || 0; if(!window.getD(el, 'raw-text')) window.setD(el, 'raw-text', el.textContent); const rawText = window.getD(el, 'raw-text');
    el.innerHTML = ''; el.textContent = rawText; 
    if (curve === 0) { const style = window.getD(el, 'text-style') || 'normal'; if(style !== 'normal') window.applyTextStyle(el.id, style, el.getAttribute('text-anchor')); } else {
        const svg = document.querySelector('#canvas-inner svg'); let defs = svg.querySelector('defs'); if (!defs) { defs = document.createElementNS("http://www.w3.org/2000/svg", "defs"); svg.prepend(defs); }
        const pathId = "curve_" + el.id; let curvePath = defs.querySelector("#" + pathId); if (!curvePath) { curvePath = document.createElementNS("http://www.w3.org/2000/svg", "path"); curvePath.id = pathId; curvePath.setAttribute("fill", "none"); defs.appendChild(curvePath); }
        const x = parseFloat(el.getAttribute('x')) || 0; const y = parseFloat(el.getAttribute('y')) || 0; const curveStrength = curve * 2.5; 
        curvePath.setAttribute("d", `M ${x - 1500}, ${y - curveStrength/2} Q ${x}, ${y + curveStrength} ${x + 1500}, ${y - curveStrength/2}`); 
        el.innerHTML = ''; const tp = document.createElementNS("http://www.w3.org/2000/svg", "textPath"); tp.setAttribute("href", "#" + pathId); tp.setAttribute("startOffset", "50%"); tp.setAttribute("text-anchor", "middle"); tp.textContent = rawText;
        const style = window.getD(el, 'text-style') || 'normal';
        if(style === 'neon') { tp.setAttribute("font-weight", "bold"); tp.setAttribute("fill", "#ffffff"); tp.setAttribute("stroke", window.getD(el, 'solid-color')||"#000"); tp.setAttribute("stroke-width", "2"); tp.setAttribute("filter", `drop-shadow(0 0 15px ${window.getD(el, 'solid-color')||'#000'})`); } 
        else if(style === '3d') { tp.setAttribute("font-weight", "bold"); tp.setAttribute("fill", window.getD(el, 'solid-color')||"#000"); tp.setAttribute("stroke", "#000000"); tp.setAttribute("stroke-width", "3"); tp.setAttribute("filter", `drop-shadow(6px 6px 0 #000000)`); } 
        else if (style === 'hollow') { tp.setAttribute("fill", "none"); tp.setAttribute("stroke", window.getD(el, 'solid-color')||"#000"); tp.setAttribute("stroke-width", "4"); }
        const w = el.getAttribute('textLength'); if (w) { tp.setAttribute('textLength', w); tp.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } el.appendChild(tp);
    } window.autoFitText(el);
};

window.describeRoundedRect = function(r, s, x, y, w, h) { if (r <= 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`; r = Math.min(r, w / 2, h / 2); const kappa = (4 * (r * (1 - s)) * Math.tan(Math.PI / 4)) / 3; const pts = [ [x + r, y], [x + w - r, y], [x + w, y + r], [x + w, y + h - r], [x + w - r, y + h], [x + r, y + h], [x, y + h - r], [x, y + r] ]; return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]} C ${pts[1][0] + kappa} ${pts[1][1]} ${pts[2][0]} ${pts[2][1] - kappa} ${pts[2][0]} ${pts[2][1]} L ${pts[3][0]} ${pts[3][1]} C ${pts[3][0]} ${pts[3][1] + kappa} ${pts[4][0] + kappa} ${pts[4][1]} ${pts[4][0]} ${pts[4][1]} L ${pts[5][0]} ${pts[5][1]} C ${pts[5][0] - kappa} ${pts[5][1]} ${pts[6][0]} ${pts[6][1] + kappa} ${pts[6][0]} ${pts[6][1]} L ${pts[7][0]} ${pts[7][1]} C ${pts[7][0]} ${pts[7][1] - kappa} ${pts[0][0] - kappa} ${pts[0][1]} ${pts[0][0]} ${pts[0][1]} Z`; };

window.applyShapeMask = function(el) { 
    if (el.tagName !== 'image' && el.tagName !== 'rect' && !el.classList.contains('video-obj') && !el.classList.contains('weather-widget') && !el.classList.contains('currency-widget')) return; 

    if (el.classList.contains('video-obj') || el.classList.contains('weather-widget') || el.classList.contains('currency-widget')) {
        const shape = window.getD(el, 'mask-shape') || 'none';
        const innerDiv = el.querySelector('div');
        if (innerDiv) {
            let rx = parseFloat(window.getD(el, 'rx')) || 0;
            if (shape === 'none') {
                innerDiv.style.clipPath = 'none';
                innerDiv.style.borderRadius = el.classList.contains('weather-widget') || el.classList.contains('currency-widget') ? '15px' : '0px';
            } else if (shape === 'circle') {
                innerDiv.style.clipPath = 'circle(50% at 50% 50%)';
                innerDiv.style.borderRadius = '0px';
            } else if (shape === 'triangle') {
                innerDiv.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
                innerDiv.style.borderRadius = '0px';
            } else if (shape === 'star') {
                innerDiv.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
                innerDiv.style.borderRadius = '0px';
            } else { 
                innerDiv.style.clipPath = 'none';
                innerDiv.style.borderRadius = rx + 'px';
            }
        }
        el.removeAttribute("clip-path");
        return;
    }

    if (!window.getD(el, 'mask-shape') || window.getD(el, 'mask-shape') === "none") { el.removeAttribute("clip-path"); return; }
    const shape = window.getD(el, 'mask-shape'); const x = parseFloat(el.getAttribute('x')) || 0, y = parseFloat(el.getAttribute('y')) || 0, w = parseFloat(el.getAttribute('width')) || 0, h = parseFloat(el.getAttribute('height')) || 0; if(w === 0 || h === 0) return; let d = "";
    if (shape === 'circle') { const cx = x+w/2, cy = y+h/2, r = Math.min(w,h)/2; d = `M ${cx-r},${cy} A ${r},${r} 0 1,0 ${cx+r},${cy} A ${r},${r} 0 1,0 ${cx-r},${cy} Z`; } else if (shape === 'triangle') { d = `M ${x+w/2},${y} L ${x+w},${y+h} L ${x},${y+h} Z`; } else if (shape === 'star') { const cx = x+w/2, cy = y+h/2, outerR = Math.min(w,h)/2, innerR = outerR/2.5; for(let i=0; i<10; i++) { let r = i%2===0 ? outerR : innerR; let angle = (Math.PI/2) - (i * Math.PI/5); d += (i===0 ? "M " : " L ") + (cx + Math.cos(angle)*r) + "," + (cy - Math.sin(angle)*r); } d += " Z"; } else { let rx = parseFloat(window.getD(el, 'rx')) || 0; let sm = parseFloat(window.getD(el, 'smoothing')); if (isNaN(sm)) sm = 0.5; d = window.describeRoundedRect(rx, sm, x, y, w, h); }
    const svg = document.querySelector('#canvas-inner svg'); let defs = svg.querySelector('defs'); if (!defs) { defs = document.createElementNS("http://www.w3.org/2000/svg", "defs"); svg.prepend(defs); } const clipId = "clip_" + el.id; let clipPath = defs.querySelector("#" + clipId); if (!clipPath) { clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath"); clipPath.id = clipId; const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); clipPath.appendChild(path); defs.appendChild(clipPath); el.setAttribute("clip-path", `url(#${clipId})`); } clipPath.querySelector('path').setAttribute("d", d); 
};

window.setupLayers = function() {
    const mainSvg = document.querySelector('#canvas-inner svg'); const ctrl = document.getElementById('control-layer'); if (!mainSvg) return; if (!mainSvg.getAttribute('xmlns')) mainSvg.setAttribute('xmlns', "http://www.w3.org/2000/svg");
    const dim = window.getSvgDim(); if(ctrl) ctrl.setAttribute("viewBox", `0 0 ${dim.w} ${dim.h}`);
    let editables = mainSvg.querySelectorAll('.duzenlenebilir');
    if (editables.length === 0) { 
        mainSvg.querySelectorAll('text, image').forEach(el => { 
            if(el.id !== 'control-layer' && el.id !== 'canvas-background' && !el.closest('#control-layer') && !el.classList.contains('guide-line')) { 
                el.classList.add('duzenlenebilir'); 
            } 
        }); 
    }
    mainSvg.querySelectorAll('.duzenlenebilir').forEach(el => {
        if(!el.id) el.id = "el_" + Math.random().toString(36).substr(2,9);
        if(window.getD(el, 'locked') === "true") el.classList.add('locked');
        if(el.tagName === 'text' && window.getD(el, 'curve')) window.applyTextCurve(el);
        if((el.tagName === 'image' || el.tagName === 'rect' || el.classList.contains('video-obj') || el.classList.contains('weather-widget') || el.classList.contains('currency-widget')) && window.getD(el, 'mask-shape') && window.getD(el, 'mask-shape') !== "none") window.applyShapeMask(el);
        if(window.getD(el, 'angle') || window.getD(el, 'flip-x') || window.getD(el, 'flip-y')) window.applyTransforms(el);
        if(window.getD(el, 'shadow-blur') || window.getD(el, 'blur') || window.getD(el, 'blend')) window.applyFilters(el);
        window.applyFill(el);
        if(el.classList.contains('rss-band')) window.updateRssDisplay(el);
        if(el.classList.contains('video-obj')) window.updateVideoDisplay(el);
        if(el.classList.contains('weather-widget')) window.updateWeatherDisplay(el);
        if(el.classList.contains('currency-widget')) window.updateCurrencyDisplay(el);
        if(el.classList.contains('ticker-band')) window.updateTickerDisplay(el);
    });
    window.initEngine(mainSvg); window.renderEditor(); window.updateRulers(); window.refreshAutoTextFields();
};

window.switchTab = function(btn, tabId) { 
    const wrapper = btn.closest('#editor-fields'); 
    if (!wrapper) return; 
    window.activeTabId = tabId;
    wrapper.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    wrapper.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
    btn.classList.add('active'); 
    wrapper.querySelector('#' + tabId).classList.add('active'); 
};

window.renderEditor = function() { 
    window.renderLayers(); window.refreshAutoTextFields(); 
    if(window.selectedEl) window.renderProperties(); 
    else { const ef = document.getElementById('editor-fields'); if(ef) ef.innerHTML = `<div style="text-align:center; color:#64748b; margin-top:50px; font-style:italic; font-size:13px;"><i class="ph ph-cursor-click" style="font-size:32px; display:block; margin-bottom:15px; color:var(--accent); opacity:0.5;"></i> 👆 Düzenlemek için sahneden veya katmanlardan bir nesne seçin.</div>`; } 
};

window.renderLayers = function() {
    const list = document.getElementById('layers-list'); if(!list) return; list.innerHTML = ""; 
    const domElements = Array.from(document.querySelectorAll('.duzenlenebilir'));
    const elements = [...domElements].reverse(); 
    const sc = document.getElementById('status-count'); if(sc) sc.innerText = `Nesne Sayısı: ${elements.length}`;
    
    elements.forEach((el) => {
        const isLocked = window.getD(el, 'locked') === "true"; const isActive = window.selectedEl === el; const isHidden = el.getAttribute('visibility') === 'hidden'; let typeName = el.tagName.toUpperCase(); let icon = 'ph-square';
        if (typeName === 'RECT') { typeName = 'ŞEKİL'; icon = 'ph-square'; } if (typeName === 'G' || typeName === 'SVG') { typeName = 'VEKTÖR'; icon = 'ph-shapes'; } if (typeName === 'PATH') { typeName = 'ÇİZİM'; icon = 'ph-scribble-loop'; } if (typeName === 'IMAGE') { typeName = 'RESİM'; icon = 'ph-image'; } if (el.tagName === 'text') { let txt = window.getD(el, 'raw-text') || el.textContent; typeName = `T: ${txt.substring(0,10)}${txt.length>10?'...':''}`; icon = 'ph-text-t'; }
        if (el.classList.contains('rss-band')) { typeName = 'HABER BANT (RSS)'; icon = 'ph-newspaper'; }
        if (el.classList.contains('ticker-band')) { typeName = 'MANUEL KAYAN YAZI'; icon = 'ph-text-align-right'; }
        if (el.classList.contains('video-obj')) { typeName = 'VİDEO'; icon = 'ph-video-camera'; }
        if (el.classList.contains('weather-widget')) { typeName = 'HAVA DURUMU'; icon = 'ph-cloud-sun'; }
        if (el.classList.contains('currency-widget')) { typeName = 'DÖVİZ'; icon = 'ph-currency-circle-dollar'; }

        const item = document.createElement('div'); 
        item.className = `layer-item ${isActive ? 'active' : ''}`;
        item.draggable = true; 
        item.dataset.id = el.id;

        item.addEventListener('dragstart', (e) => { draggedLayerId = el.id; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => item.style.opacity = '0.5', 0); });
        item.addEventListener('dragend', () => { item.style.opacity = '1'; document.querySelectorAll('.layer-item').forEach(i => { i.style.borderTop = ''; i.style.borderBottom = ''; }); draggedLayerId = null; });
        item.addEventListener('dragover', (e) => { e.preventDefault(); if (draggedLayerId === el.id) return; const rect = item.getBoundingClientRect(); const midY = rect.top + rect.height / 2; if (e.clientY < midY) { item.style.borderTop = '2px solid var(--accent)'; item.style.borderBottom = ''; } else { item.style.borderBottom = '2px solid var(--accent)'; item.style.borderTop = ''; } });
        item.addEventListener('dragleave', () => { item.style.borderTop = ''; item.style.borderBottom = ''; });
        item.addEventListener('drop', (e) => {
            e.preventDefault(); item.style.borderTop = ''; item.style.borderBottom = '';
            if (!draggedLayerId || draggedLayerId === el.id) return;
            const draggedEl = document.getElementById(draggedLayerId); const targetEl = document.getElementById(el.id);
            if(!draggedEl || !targetEl) return;
            const rect = item.getBoundingClientRect(); const dropBeforeVisual = e.clientY < (rect.top + rect.height / 2); 
            const parent = targetEl.parentNode;
            if (dropBeforeVisual) { if (targetEl.nextSibling) parent.insertBefore(draggedEl, targetEl.nextSibling); else parent.appendChild(draggedEl); } else { parent.insertBefore(draggedEl, targetEl); }
            window.saveState(); window.renderEditor();
        });

        item.onclick = (e) => { if(e.target.closest('.layer-btn')) return; window.selectedEl = el; isDraggingElement = false; window.updateUI(el); window.renderEditor(); };
        item.innerHTML = `<div style="display:flex; align-items:center; gap:8px; flex:1; overflow:hidden; pointer-events:none;"><i class="ph ph-dots-six-vertical" style="color:#64748b;"></i><i class="ph ${icon}" style="color:var(--accent);"></i><span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${isLocked ? 'text-decoration:line-through; opacity:0.5;' : ''} ${isHidden ? 'opacity:0.3;' : ''}">${typeName}</span></div><div class="layer-actions"><button class="layer-btn" onclick="window.toggleVisibility('${el.id}')" title="Göster/Gizle"><i class="ph ${isHidden ? 'ph-eye-closed' : 'ph-eye'}"></i></button><button class="layer-btn" onclick="window.moveLayer('${el.id}', 'top')" title="En Üste"><i class="ph ph-caret-double-up"></i></button><button class="layer-btn" onclick="window.moveLayer('${el.id}', 1)" title="Yukarı"><i class="ph ph-caret-up"></i></button><button class="layer-btn" onclick="window.moveLayer('${el.id}', -1)" title="Aşağı"><i class="ph ph-caret-down"></i></button><button class="layer-btn" onclick="window.moveLayer('${el.id}', 'bottom')" title="En Alta"><i class="ph ph-caret-double-down"></i></button><button class="layer-btn" onclick="window.toggleLock('${el.id}')" title="Kilit"><i class="ph ${isLocked ? 'ph-lock-key' : 'ph-lock-key-open'}"></i></button><button class="layer-btn" style="color:#ef4444;" onclick="if(confirm('Silinecek?')){ const delId='${el.id}'; if(window.selectedEl && window.selectedEl.id===delId) window.selectedEl=null; document.getElementById(delId).remove(); window.saveState(); window.renderEditor(); const cl=document.getElementById('control-layer'); if(cl) cl.innerHTML=''; event.stopPropagation(); }"><i class="ph ph-trash"></i></button></div>`; list.appendChild(item);
    });
};

function createPropGroup(title, content) { return `<div class="prop-group"><div class="prop-group-title">${title}</div>${content}</div>`; }

window.renderProperties = function() {
    const f = document.getElementById('editor-fields'); if(!f) return; if (!window.selectedEl || !window.selectedEl.tagName) { window.renderEditor(); return; }
    try {
        const el = window.selectedEl; const id = el.id; const tag = el.tagName.toLowerCase();
        const isLocked = window.getD(el, 'locked') === "true"; const isPath = tag === 'path'; const isShape = tag === 'rect'; const isImage = tag === 'image'; const isIcon = tag === 'svg' || tag === 'g';
        const isRss = el.classList.contains('rss-band');
        const isTicker = el.classList.contains('ticker-band');
        const isVideo = el.classList.contains('video-obj');
        const isWeather = el.classList.contains('weather-widget');
        const isCurrency = el.classList.contains('currency-widget');
        const isText = tag === 'text' || isRss || isTicker; 
        const isWidget = isWeather || isCurrency;
        
        let typeName = tag.toUpperCase(); let headerIcon = 'ph-square'; if (isShape) { typeName = 'ŞEKİL'; headerIcon = 'ph-square'; } if (isIcon) { typeName = 'VEKTÖR'; headerIcon = 'ph-shapes'; } if (isPath) { typeName = 'ÇİZİM'; headerIcon = 'ph-scribble-loop'; } if (isImage) { typeName = 'RESİM'; headerIcon = 'ph-image'; } if (tag === 'text') { typeName = 'METİN'; headerIcon = 'ph-text-t'; }
        if (isRss) { typeName = 'HABER BANT (RSS)'; headerIcon = 'ph-newspaper'; }
        if (isTicker) { typeName = 'MANUEL KAYAN YAZI'; headerIcon = 'ph-text-align-right'; }
        if (isVideo) { typeName = 'VİDEO / YOUTUBE'; headerIcon = 'ph-video-camera'; }
        if (isWeather) { typeName = 'HAVA DURUMU'; headerIcon = 'ph-cloud-sun'; }
        if (isCurrency) { typeName = 'DÖVİZ TABLOSU'; headerIcon = 'ph-currency-circle-dollar'; }

        let layoutHtml = "", styleHtml = "", textHtml = "", codeHtml = "", videoHtml = "", widgetHtml = "";
        let headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid var(--border);"><div style="font-size:14px; color:white; font-weight:bold; letter-spacing:1px; display:flex; align-items:center; gap:8px;"><i class="ph ${headerIcon}" style="color:var(--accent);"></i> ${typeName} AYARLARI ${isLocked ? '<i class="ph ph-lock-key" style="color:#ef4444;"></i>' : ''}</div><div class="delete-btn" style="cursor:pointer; color:#94a3b8; font-size:20px; transition:0.2s;" title="Sil" onclick="if(confirm('Silinecek?')){ document.getElementById('${id}').remove(); window.selectedEl=null; window.saveState(); window.renderEditor(); const ctrl = document.getElementById('control-layer'); if(ctrl) ctrl.innerHTML=''; }"><i class="ph ph-x-circle"></i></div></div><div class="action-row" style="margin-bottom:20px;"><button class="action-btn" onclick="window.toggleLock('${id}')" style="background:${isLocked?'var(--error)':'#334155'}"><i class="ph ${isLocked?'ph-lock-key-open':'ph-lock-key'}"></i> ${isLocked ? 'KİLİDİ AÇ' : 'KİLİTLE'}</button><button class="action-btn special" onclick="window.cloneElement('${id}')" ${isLocked ? 'disabled':''}><i class="ph ph-copy"></i> KOPYALA</button></div>`;
        if (isLocked) { f.innerHTML = headerHtml + `<div style="text-align:center; color:#ef4444; font-size:12px; margin-top:30px;"><i class="ph ph-lock-key" style="font-size:40px; display:block; margin-bottom:10px; opacity:0.5;"></i> Bu öğe kilitli. Düzenlemek için kilidini açın.</div>`; return; }
        
        if (!isText && !isVideo && !isWidget && (window.activeTabId === 'tab-text' || window.activeTabId === 'tab-video' || window.activeTabId === 'tab-widget')) window.activeTabId = 'tab-layout';
        if (isVideo && window.activeTabId !== 'tab-video' && window.activeTabId !== 'tab-layout' && window.activeTabId !== 'tab-style' && window.activeTabId !== 'tab-code') window.activeTabId = 'tab-video';
        if (isWidget && window.activeTabId !== 'tab-widget' && window.activeTabId !== 'tab-layout' && window.activeTabId !== 'tab-style' && window.activeTabId !== 'tab-code') window.activeTabId = 'tab-widget';
        if (isText && window.activeTabId !== 'tab-text' && window.activeTabId !== 'tab-layout' && window.activeTabId !== 'tab-style' && window.activeTabId !== 'tab-code') window.activeTabId = 'tab-text';

        let tabsNav = `<div class="tabs-header">
            <button class="tab-btn ${window.activeTabId === 'tab-layout' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-layout')"><i class="ph ph-bounding-box"></i> Düzen</button>
            <button class="tab-btn ${window.activeTabId === 'tab-style' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-style')"><i class="ph ph-palette"></i> Stil</button>
            ${isText ? `<button class="tab-btn ${window.activeTabId === 'tab-text' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-text')"><i class="ph ph-text-t"></i> Metin</button>` : ''}
            ${isVideo ? `<button class="tab-btn ${window.activeTabId === 'tab-video' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-video')"><i class="ph ph-video-camera"></i> Medya</button>` : ''}
            ${isWidget ? `<button class="tab-btn ${window.activeTabId === 'tab-widget' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-widget')"><i class="ph ph-plug"></i> Widget</button>` : ''}
            <button class="tab-btn ${window.activeTabId === 'tab-code' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-code')"><i class="ph ph-code"></i> Kod</button>
        </div>`;

        if(!isPath) {
            let bbox = {x:0, y:0, width:0, height:0}; try { bbox = el.getBBox(); } catch(e){}
            const x = Math.round(parseFloat(el.getAttribute("x")) || bbox.x || 0); const y = Math.round(parseFloat(el.getAttribute("y")) || bbox.y || 0); let w = 0, h = 0;
            if(tag === 'text') { w = Math.round(parseFloat(el.getAttribute("textLength")) || bbox.width || 0); h = Math.round(parseFloat(window.getD(el, "base-font-size")) || 60); } else { w = Math.round(parseFloat(el.getAttribute("width")) || bbox.width || 0); h = Math.round(parseFloat(el.getAttribute("height")) || bbox.height || 0); }
            const angle = parseFloat(window.getD(el, 'angle')) || 0;
            
            layoutHtml += createPropGroup("<i class='ph ph-intersect'></i> Hizalama & Çevirme", `<div class="action-row" style="margin-bottom:8px;"><button class="action-btn" onclick="window.alignElement('${id}', 'left')"><i class="ph ph-align-left"></i> SOL</button><button class="action-btn" onclick="window.alignElement('${id}', 'center-h')"><i class="ph ph-align-center-horizontal"></i> ORTA</button><button class="action-btn" onclick="window.alignElement('${id}', 'right')"><i class="ph ph-align-right"></i> SAĞ</button></div><div class="action-row" style="margin-bottom:10px;"><button class="action-btn" onclick="window.alignElement('${id}', 'center-v')"><i class="ph ph-align-center-vertical"></i> DİKEY ORTA</button><button class="action-btn" onclick="window.toggleFlip('${id}', 'x')"><i class="ph ph-arrows-left-right"></i> YATAY ÇEVİR</button><button class="action-btn" onclick="window.toggleFlip('${id}', 'y')"><i class="ph ph-arrows-down-up"></i> DİKEY ÇEVİR</button></div>`);
            layoutHtml += createPropGroup("<i class='ph ph-arrows-out'></i> Konum ve Boyut", `<div class="label-row"><span class="label-text">X KONUMU</span><span class="value-badge" id="val-x-${id}">${x}px</span></div><div style="display:flex; gap:10px; margin-bottom:15px;"><input type="range" min="-1000" max="3000" value="${x}" style="flex:1;" oninput="window.changeProp('${id}', 'x', this.value, this);" onchange="window.saveState()"><input type="number" value="${x}" style="width:70px; padding:8px;" oninput="window.changeProp('${id}', 'x', this.value, this);" onchange="window.saveState()"></div><div class="label-row"><span class="label-text">Y KONUMU</span><span class="value-badge" id="val-y-${id}">${y}px</span></div><div style="display:flex; gap:10px; margin-bottom:15px;"><input type="range" min="-1000" max="3000" value="${y}" style="flex:1;" oninput="window.changeProp('${id}', 'y', this.value, this);" onchange="window.saveState()"><input type="number" value="${y}" style="width:70px; padding:8px;" oninput="window.changeProp('${id}', 'y', this.value, this);" onchange="window.saveState()"></div><div class="label-row"><span class="label-text">${tag === 'text' ? 'GENİŞLİK (ESNETME W)' : 'GENİŞLİK (W)'}</span><span class="value-badge" id="val-w-${id}">${w}px</span></div><div style="display:flex; gap:10px; margin-bottom:15px;"><input type="range" min="1" max="2500" value="${w}" style="flex:1;" oninput="window.changeProp('${id}', 'w', this.value, this);" onchange="window.saveState()"><input type="number" value="${w}" style="width:70px; padding:8px;" oninput="window.changeProp('${id}', 'w', this.value, this);" onchange="window.saveState()"></div><div class="label-row"><span class="label-text">${tag === 'text' ? 'YAZI PUNTO (H)' : 'YÜKSEKLİK (H)'}</span><span class="value-badge" id="val-h-${id}">${h}px</span></div><div style="display:flex; gap:10px;"><input type="range" min="1" max="2500" value="${h}" style="flex:1;" oninput="window.changeProp('${id}', 'h', this.value, this);" onchange="window.saveState()"><input type="number" value="${h}" style="width:70px; padding:8px;" oninput="window.changeProp('${id}', 'h', this.value, this);" onchange="window.saveState()"></div>`);
            layoutHtml += createPropGroup("<i class='ph ph-arrows-clockwise'></i> Dönüştürme", `<div class="label-row" style="margin-top:0;"><span class="label-text">DÖNDÜRME AÇISI</span><span class="value-badge" id="val-angle-${id}">${angle}°</span></div><div style="display:flex; gap:10px; align-items:center;"><input type="range" min="0" max="360" value="${angle}" style="flex:1;" oninput="window.changeSetting('${id}', 'angle', this.value, this);" onchange="window.saveState()"><input type="number" value="${angle}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'angle', this.value, this);" onchange="window.saveState()"></div>`);
        }
        if ((isShape || isImage || isVideo || isWidget) && !isRss && !isTicker) {
            const rx = parseFloat(window.getD(el, 'rx')) || 0; const maskShape = window.getD(el, 'mask-shape') || 'none'; let bbox = {width:0, height:0}; try { bbox = el.getBBox(); }catch(e){} const maxR = Math.min(bbox.width, bbox.height) / 2;
            layoutHtml += createPropGroup("<i class='ph ph-scissors'></i> Form & Maskeleme", `<div class="label-text" style="margin-bottom:5px;">MASKELEME ŞEKLİ</div><select class="font-select" style="margin-bottom:15px;" onchange="window.changeSetting('${id}', 'mask-shape', this.value); window.saveState();"><option value="none" ${maskShape === 'none' ? 'selected' : ''}>Yok (Düz)</option><option value="squircle" ${maskShape === 'squircle' ? 'selected' : ''}>Oval Kare (Squircle)</option><option value="circle" ${maskShape === 'circle' ? 'selected' : ''}>Daire</option><option value="triangle" ${maskShape === 'triangle' ? 'selected' : ''}>Üçgen</option><option value="star" ${maskShape === 'star' ? 'selected' : ''}>Yıldız</option></select><div class="label-row"><span class="label-text">KÖŞE YARIÇAPI (SQUIRCLE)</span><span class="value-badge" id="val-rx-${id}">${Math.round(rx)}px</span></div><div style="display:flex; gap:10px; align-items:center;"><input type="range" min="0" max="${maxR}" value="${rx}" style="flex:1;" oninput="window.changeSetting('${id}', 'rx', this.value, this);" onchange="window.saveState()"><input type="number" value="${rx}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'rx', this.value, this);" onchange="window.saveState()"></div>`);
            
            if (isImage) {
                const imageList = window.getD(el, 'image-list') || '';
                layoutHtml += createPropGroup("<i class='ph ph-images'></i> İç Resim Slaydı", `<div class="label-text" style="margin-bottom:5px;">ÇOKLU RESİM LİNKLERİ (VİRGÜLLE AYIRIN)</div><textarea placeholder="https://resim1.jpg, https://resim2.jpg" style="width:100%; height:60px; background:#000; color:#fff; border:1px solid var(--border); padding:8px; border-radius:6px; font-size:11px;" oninput="window.changeSetting('${id}', 'image-list', this.value);" onchange="window.saveState()">${imageList}</textarea><div style="font-size:10px; color:#94a3b8; margin-top:5px; font-style:italic;">Buraya birden fazla resim linki girerseniz, yayın ekranında bu alan otomatik slayt gibi döner.</div>`);
            }
        }

        if (!isImage && !isVideo && !isWidget) {
            const fillType = window.getD(el, 'fill-type') || 'solid'; const col1 = window.getD(el, 'color1') || '#10b981'; const col2 = window.getD(el, 'color2') || '#3b82f6'; const solidCol = window.getD(el, 'solid-color') || (el.getAttribute('fill') === 'none' ? el.getAttribute('stroke') : el.getAttribute('fill')) || "#ffffff";
            let fillHtml = `<div class="label-text" style="margin-bottom:5px;">${isRss||isTicker?'ARKA PLAN':'DOLGU TİPİ'}</div>`;
            if (!isRss && !isTicker) fillHtml += `<select class="font-select" style="margin-bottom:15px;" onchange="window.changeSetting('${id}', 'fill-type', this.value); window.saveState();"><option value="solid" ${fillType === 'solid' ? 'selected' : ''}>Düz Renk</option><option value="gradient" ${fillType === 'gradient' ? 'selected' : ''}>Renk Geçişi (Gradient)</option></select>`;
            if (fillType === 'solid' || isRss || isTicker) { fillHtml += `<div style="display:flex; gap:10px; align-items:center;"><input type="color" value="${safeColor(solidCol)}" oninput="window.changeSetting('${id}', 'solid-color', this.value); this.nextElementSibling.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();" style="width:45px; height:45px; cursor:pointer; border:none; background:none; border-radius:8px;"><button class="action-btn" style="flex:0 0 45px; padding:12px; background:#334155; font-size:18px;" onclick="window.pickColor('${id}', 'solidColor', 'fill')" title="Göz Damlası"><i class="ph ph-drop"></i></button><input type="text" value="${safeColor(solidCol)}" style="flex:1;" oninput="window.changeSetting('${id}', 'solid-color', this.value); this.previousElementSibling.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();"></div>`; } else { fillHtml += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"><div class="input-group"><span class="label-text">RENK 1</span><div style="display:flex; gap:5px; align-items:center;"><input type="color" value="${safeColor(col1)}" oninput="window.changeSetting('${id}', 'color1', this.value);" onchange="window.addRecentColor(this.value); window.saveState();" style="width:35px; height:35px; cursor:pointer; border:none; background:none;"><button class="action-btn" style="padding:8px; background:#334155; font-size:16px;" onclick="window.pickColor('${id}', 'color1', '')"><i class="ph ph-drop"></i></button></div></div><div class="input-group"><span class="label-text">RENK 2</span><div style="display:flex; gap:5px; align-items:center;"><input type="color" value="${safeColor(col2)}" oninput="window.changeSetting('${id}', 'color2', this.value);" onchange="window.addRecentColor(this.value); window.saveState();" style="width:35px; height:35px; cursor:pointer; border:none; background:none;"><button class="action-btn" style="padding:8px; background:#334155; font-size:16px;" onclick="window.pickColor('${id}', 'color2', '')"><i class="ph ph-drop"></i></button></div></div></div>`; }
            fillHtml += `<div class="label-text" style="margin-top:15px; margin-bottom:8px;">PROJE RENKLERİ</div><div class="swatch-container">` + recentColors.map(c => `<div class="color-swatch" style="background:${c}" onclick="window.applyRecentColor('${id}', '${c}')" title="${c}"></div>`).join('') + `</div>`;
            styleHtml += createPropGroup("<i class='ph ph-paint-bucket'></i> Dolgu & Renk", fillHtml);
        }
        if(!isRss && !isTicker && !isVideo && !isWidget) {
            const strokeCol = el.getAttribute('stroke') || '#000000'; const strokeW = parseFloat(el.getAttribute('stroke-width')) || 0; const dash = el.getAttribute('stroke-dasharray') || 'none';
            styleHtml += createPropGroup("<i class='ph ph-square-logo'></i> Kenarlık & Çizgi", `<div class="label-text" style="margin-bottom:5px;">ÇİZGİ RENGİ</div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="color" value="${safeColor(strokeCol)}" oninput="const t=document.getElementById('${id}'); t.setAttribute('stroke', this.value); t.setAttribute('paint-order', 'stroke fill'); t.setAttribute('stroke-linejoin', 'round'); this.nextElementSibling.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();" style="width:45px; height:45px; cursor:pointer; border:none; background:none; border-radius:8px;"><button class="action-btn" style="flex:0 0 45px; padding:12px; background:#334155; font-size:18px;" onclick="window.pickColor('${id}', '', 'stroke')" title="Göz Damlası"><i class="ph ph-drop"></i></button><input type="text" value="${safeColor(strokeCol)}" style="flex:1;" oninput="const t=document.getElementById('${id}'); t.setAttribute('stroke', this.value); t.setAttribute('paint-order', 'stroke fill'); t.setAttribute('stroke-linejoin', 'round'); this.previousElementSibling.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();"></div><div class="label-row"><span class="label-text">KALINLIK</span><span class="value-badge" id="val-sw-${id}">${strokeW}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="0" max="50" value="${strokeW}" style="flex:1;" oninput="const t=document.getElementById('${id}'); t.setAttribute('stroke-width', this.value); t.setAttribute('paint-order', 'stroke fill'); document.getElementById('val-sw-${id}').innerText=this.value+'px'; this.nextElementSibling.value=this.value;" onchange="window.saveState()"><input type="number" value="${strokeW}" style="width:70px; padding:8px;" oninput="const t=document.getElementById('${id}'); t.setAttribute('stroke-width', this.value); t.setAttribute('paint-order', 'stroke fill'); document.getElementById('val-sw-${id}').innerText=this.value+'px'; this.previousElementSibling.value=this.value;" onchange="window.saveState()"></div><div class="label-text" style="margin-bottom:5px;">ÇİZGİ TİPİ</div><select class="font-select" onchange="document.getElementById('${id}').setAttribute('stroke-dasharray', this.value); window.saveState();"><option value="none" ${dash === 'none' ? 'selected' : ''}>Düz</option><option value="5,5" ${dash === '5,5' ? 'selected' : ''}>Kesikli</option><option value="2,2" ${dash === '2,2' ? 'selected' : ''}>Noktalı</option></select>`);
        }
        let opacityVal = parseFloat(el.getAttribute('opacity')); if (isNaN(opacityVal)) opacityVal = 1;
        const sX = parseFloat(window.getD(el, 'shadow-x')) || 0, sY = parseFloat(window.getD(el, 'shadow-y')) || 0, sB = parseFloat(window.getD(el, 'shadow-blur')) || 0, sC = window.getD(el, 'shadow-color') || '#000000', bl = parseFloat(window.getD(el, 'blur')) || 0; const blend = window.getD(el, 'blend') || 'normal';
        styleHtml += createPropGroup("<i class='ph ph-magic-wand'></i> Efektler & Görünüm", `<div class="label-row"><span class="label-text">SAYDAMLIK (OPACITY)</span><span class="value-badge" id="val-opacity-${id}">${Math.round(opacityVal*100)}%</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="0" max="1" step="0.05" value="${opacityVal}" style="flex:1;" oninput="window.changeFilter('${id}', 'opacity', this.value, this);" onchange="window.saveState()"><input type="number" min="0" max="1" step="0.05" value="${opacityVal}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'opacity', this.value, this);" onchange="window.saveState()"></div><div class="label-text" style="margin-bottom:5px;">KARIŞIM MODU (BLEND)</div><select class="font-select" style="margin-bottom:15px;" onchange="window.changeFilter('${id}', 'blend', this.value); window.saveState();"><option value="normal" ${blend === 'normal' ? 'selected' : ''}>Normal</option><option value="multiply" ${blend === 'multiply' ? 'selected' : ''}>Çoğalt (Multiply)</option><option value="screen" ${blend === 'screen' ? 'selected' : ''}>Ekran (Screen)</option><option value="overlay" ${blend === 'overlay' ? 'selected' : ''}>Kaplama (Overlay)</option></select><div class="group-box"><div class="label-text" style="color:white; margin-bottom:10px;"><i class="ph ph-drop-half-bottom"></i> GÖLGE VE BLUR</div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="color" value="${sC}" oninput="window.changeFilter('${id}', 'shadow-color', this.value); this.nextElementSibling.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();" style="width:40px; height:40px; cursor:pointer; border:radius:8px; border:none; background:none;"><button class="action-btn" style="padding:10px; background:#334155; font-size:16px;" onclick="window.pickColor('${id}', 'shadow-color', '')"><i class="ph ph-drop"></i></button><input type="text" value="${sC}" style="flex:1;" oninput="window.changeFilter('${id}', 'shadow-color', this.value); this.previousElementSibling.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();"></div><div class="label-row"><span class="label-text">GÖLGE X</span><span class="value-badge" id="val-shadow-x-${id}">${sX}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="-100" max="100" value="${sX}" style="flex:1;" oninput="window.changeFilter('${id}', 'shadow-x', this.value, this);" onchange="window.saveState()"><input type="number" value="${sX}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'shadow-x', this.value, this);" onchange="window.saveState()"></div><div class="label-row"><span class="label-text">GÖLGE Y</span><span class="value-badge" id="val-shadow-y-${id}">${sY}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="-100" max="100" value="${sY}" style="flex:1;" oninput="window.changeFilter('${id}', 'shadow-y', this.value, this);" onchange="window.saveState()"><input type="number" value="${sY}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'shadow-y', this.value, this);" onchange="window.saveState()"></div><div class="label-row"><span class="label-text">GÖLGE YAYILMASI</span><span class="value-badge" id="val-shadow-blur-${id}">${sB}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="0" max="100" value="${sB}" style="flex:1;" oninput="window.changeFilter('${id}', 'shadow-blur', this.value, this);" onchange="window.saveState()"><input type="number" value="${sB}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'shadow-blur', this.value, this);" onchange="window.saveState()"></div><div class="label-row"><span class="label-text">NESNE BULANIKLIĞI</span><span class="value-badge" id="val-blur-${id}">${bl}px</span></div><div style="display:flex; gap:10px; align-items:center;"><input type="range" min="0" max="100" value="${bl}" style="flex:1;" oninput="window.changeFilter('${id}', 'blur', this.value, this);" onchange="window.saveState()"><input type="number" value="${bl}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'blur', this.value, this);" onchange="window.saveState()"></div></div>`);

        if (tag === 'text') {
            const rawText = (window.getD(el, 'raw-text') || el.textContent).replace(/'/g, "&apos;").replace(/"/g, "&quot;"); const varName = window.getD(el, 'var-name') || "";
            let rectOptions = `<option value="">-- Serbest Bırak (Sabitleme Yok) --</option>`; document.querySelectorAll('#canvas-inner svg rect.duzenlenebilir, #canvas-inner svg image.duzenlenebilir').forEach(r => { rectOptions += `<option value="${r.id}" ${window.getD(el, 'bound-rect') === r.id ? 'selected' : ''}>Şekil: ${r.id}</option>`; });
            textHtml += createPropGroup("<i class='ph ph-text-t'></i> Metin ve Sabitleme", `<div style="margin-bottom:10px;"><div class="label-text" style="margin-bottom:5px;">METİN İÇERİĞİ</div><input type="text" value="${rawText}" oninput="window.changeSetting('${id}', 'raw-text', this.value); window.refreshAutoTextFields();" onchange="window.saveState()" placeholder="Metni girin..." style="margin-bottom:10px;"></div><div style="margin-bottom:10px;"><div class="label-text" style="color:#f472b6; margin-bottom:5px;">OTOMATİK DEĞİŞKEN ADI (Örn: FIYAT)</div><input type="text" value="${varName}" placeholder="Boş bırakırsanız listede görünmez" oninput="this.value = this.value.toUpperCase(); window.setD(document.getElementById('${id}'), 'var-name', this.value); window.refreshAutoTextFields();" onchange="window.saveState()" style="border-color:#f472b6;"></div><div style="padding:10px; background:rgba(16, 185, 129, 0.1); border:1px solid #10b981; border-radius:8px; margin-top:10px;"><div class="label-text" style="color:#10b981; margin-bottom:5px;"><i class="ph ph-intersect"></i> BİR KUTUYA SABİTLE (ORTALA & SIĞDIR)</div><div style="font-size:10px; color:#94a3b8; margin-bottom:8px; font-style:italic;">Seçilen kutunun tam ortasına yapışır ve taşmayı önler.</div><select class="font-select" style="border-color:#10b981; background:#0f172a;" onchange="window.changeSetting('${id}', 'bound-rect', this.value); window.autoFitText(document.getElementById('${id}')); window.updateUI(document.getElementById('${id}')); window.saveState();">${rectOptions}</select></div>`);
            const ls = parseFloat(el.getAttribute("letter-spacing")) || 0; const currentFont = el.getAttribute("font-family") || "sans-serif"; const curve = parseFloat(window.getD(el, 'curve')) || 0; const mw = parseFloat(window.getD(el, 'max-width')) || 0; const mh = parseFloat(window.getD(el, 'max-height')) || 0; const isB = el.getAttribute('font-weight') === 'bold'; const isI = el.getAttribute('font-style') === 'italic'; const isU = el.getAttribute('text-decoration') === 'underline'; const tAlign = el.getAttribute('text-anchor') || 'middle';
            let fontOptionsHtml = googleFonts.map(font => `<option value="${font.val}" style="font-family: ${font.val}" ${currentFont.includes(font.name) ? "selected" : ""}>${font.name}</option>`).join('');
            textHtml += createPropGroup("<i class='ph ph-text-aa'></i> Yazı Tipi & Biçimlendirme", `<select class="font-select" style="margin-bottom:15px;" onchange="const t=document.getElementById('${id}'); t.setAttribute('font-family', this.value); t.style.fontFamily=this.value; window.applyTextCurve(t); if(window.updateEditorUI) window.updateEditorUI(t); window.saveState();">${fontOptionsHtml}</select><div style="display:flex; gap:5px; margin-bottom:15px;"><button class="action-btn ${isB?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'bold')"><i class="ph ph-text-b"></i></button><button class="action-btn ${isI?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'italic')"><i class="ph ph-text-italic"></i></button><button class="action-btn ${isU?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'underline')"><i class="ph ph-text-underline"></i></button><div style="width:1px; background:var(--border); margin:0 5px;"></div><button class="action-btn ${tAlign==='start'?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'align', 'start')"><i class="ph ph-text-align-left"></i></button><button class="action-btn ${tAlign==='middle'?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'align', 'middle')"><i class="ph ph-text-align-center"></i></button><button class="action-btn ${tAlign==='end'?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'align', 'end')"><i class="ph ph-text-align-right"></i></button></div><div class="action-row" style="margin-bottom:15px;"><button class="action-btn" onclick="window.applyTextStyle('${id}', 'normal')">Stil Temizle</button><button class="action-btn special" onclick="document.getElementById('${id}').removeAttribute('textLength'); document.getElementById('${id}').removeAttribute('lengthAdjust'); window.autoFitText(document.getElementById('${id}')); window.saveState(); window.renderProperties();"><i class="ph ph-arrows-out-line-horizontal"></i> ESNETMEYİ SIFIRLA</button></div><div class="action-row" style="margin-bottom:15px;"><button class="action-btn" onclick="window.applyTextStyle('${id}', 'neon')">Neon</button><button class="action-btn" onclick="window.applyTextStyle('${id}', '3d')">3D</button><button class="action-btn" onclick="window.applyTextStyle('${id}', 'hollow')">Hollow</button></div><div class="label-row"><span class="label-text">EĞRİLİK (KAVİS)</span><span class="value-badge" id="val-curve-${id}">${curve}</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="-100" max="100" value="${curve}" style="flex:1;" oninput="window.changeSetting('${id}', 'curve', this.value, this);" onchange="window.saveState()"><input type="number" value="${curve}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'curve', this.value, this);" onchange="window.saveState()"></div><div class="label-row"><span class="label-text">HARF ARALIĞI</span><span class="value-badge" id="val-letter-spacing-${id}">${ls}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="-20" max="100" value="${ls}" style="flex:1;" oninput="window.changeSetting('${id}', 'letter-spacing', this.value, this);" onchange="window.saveState()"><input type="number" value="${ls}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'letter-spacing', this.value, this);" onchange="window.saveState()"></div><div class="label-row"><span class="label-text">SIĞDIRMA GENİŞLİK (MAX-W)</span><span class="value-badge" id="val-max-width-${id}">${mw === 0 ? 'KAPALI' : mw+'px'}</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="0" max="2000" value="${mw}" style="flex:1;" oninput="window.changeSetting('${id}', 'max-width', this.value, this);" onchange="window.saveState()"><input type="number" value="${mw}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'max-width', this.value, this);" onchange="window.saveState()"></div><div class="label-row"><span class="label-text">SIĞDIRMA YÜKSEKLİK (MAX-H)</span><span class="value-badge" id="val-max-height-${id}">${mh === 0 ? 'KAPALI' : mh+'px'}</span></div><div style="display:flex; gap:10px; align-items:center;"><input type="range" min="0" max="2000" value="${mh}" style="flex:1;" oninput="window.changeSetting('${id}', 'max-height', this.value, this);" onchange="window.saveState()"><input type="number" value="${mh}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'max-height', this.value, this);" onchange="window.saveState()"></div>`);
        } else if (isRss) {
            const url = window.getD(el, 'rss-url') || ''; 
            const apiKey = window.getD(el, 'collect-api-key') || ''; 
            const deeplKey = window.getD(el, 'deepl-api-key') || '';
            const speed = window.getD(el, 'rss-speed') || '35'; 
            const txtColor = window.getD(el, 'text-color') || '#ffffff'; 
            const bgColor = window.getD(el, 'solid-color') || '#dc2626'; 
            const tickerBg = window.getD(el, 'ticker-bg') || '#0f172a';  
            const fSize = window.getD(el, 'base-font-size') || '30';
            const autoTrans = window.getD(el, 'auto-translate') === 'true'; 
            const fontFamily = window.getD(el, 'font-family') || 'sans-serif'; 
            const bannedWords = window.getD(el, 'banned-words') || ''; 
            const rssTitle = window.getD(el, 'rss-title') !== undefined ? window.getD(el, 'rss-title') : 'SON DAKİKA'; 

            let fontOptionsHtml = "";
            if (typeof googleFonts !== 'undefined') {
                fontOptionsHtml = googleFonts.map(font => `<option value="${font.val}" style="font-family: ${font.val}" ${fontFamily.includes(font.name) || fontFamily === font.val ? "selected" : ""}>${font.name}</option>`).join('');
            }
            
            textHtml += createPropGroup("<i class='ph ph-rss'></i> Haber Akış Ayarları", `
            <div class="label-text" style="margin-bottom:5px; color:#f59e0b;"><i class="ph ph-text-t"></i> SABİT BAŞLIK (SOL KÖŞE)</div>
            <input type="text" value="${rssTitle}" oninput="window.changeSetting('${id}', 'rss-title', this.value); window.updateRssDisplay(document.getElementById('${id}'));" onchange="window.saveState()" placeholder="Gizlemek için boş bırakın..." style="margin-bottom:15px; border-color:#f59e0b;">

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                <div>
                    <div class="label-text">BAŞLIK RENGİ</div>
                    <div style="display:flex; gap:10px; align-items:center; margin-top:5px;"><input type="color" value="${safeColor(bgColor)}" oninput="window.changeSetting('${id}', 'solid-color', this.value); window.updateRssDisplay(document.getElementById('${id}')); this.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();" style="width:35px; height:35px; cursor:pointer; border:none; background:none; border-radius:6px;"><input type="text" value="${safeColor(bgColor)}" style="flex:1; padding:5px; font-size:10px;" oninput="window.changeSetting('${id}', 'solid-color', this.value); window.updateRssDisplay(document.getElementById('${id}')); this.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();"></div>
                </div>
                <div>
                    <div class="label-text">ARKAPLAN RENGİ</div>
                    <div style="display:flex; gap:10px; align-items:center; margin-top:5px;"><input type="color" value="${safeColor(tickerBg)}" oninput="window.changeSetting('${id}', 'ticker-bg', this.value); window.updateRssDisplay(document.getElementById('${id}')); this.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();" style="width:35px; height:35px; cursor:pointer; border:none; background:none; border-radius:6px;"><input type="text" value="${safeColor(tickerBg)}" style="flex:1; padding:5px; font-size:10px;" oninput="window.changeSetting('${id}', 'ticker-bg', this.value); window.updateRssDisplay(document.getElementById('${id}')); this.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();"></div>
                </div>
            </div>
            <hr style="border-color:#334155; margin:15px 0;">
            <div class="label-text" style="margin-bottom:5px;">HABER KAYNAK LİNKİ</div>
            <input type="text" value="${url}" oninput="window.changeSetting('${id}', 'rss-url', this.value); window.updateRssDisplay(document.getElementById('${id}'));" onchange="window.saveState()" placeholder="Örn: https://api.collectapi.com/..." style="margin-bottom:10px;">
            <div class="label-text" style="color:#f472b6; margin-bottom:5px;">COLLECT API KEY (Varsa)</div>
            <input type="text" value="${apiKey}" oninput="window.changeSetting('${id}', 'collect-api-key', this.value);" onchange="window.saveState()" placeholder="Örn: apikey 123456789..." style="margin-bottom:15px; border-color:#f472b6;">
            <div class="label-text" style="color:#10b981; margin-bottom:5px;">YAPAY ZEKA ÇEVİRİSİ</div>
            <button class="action-btn ${autoTrans ? 'active' : ''}" style="width:100%; margin-bottom:10px;" onclick="window.changeSetting('${id}', 'auto-translate', '${!autoTrans}'); window.updateRssDisplay(document.getElementById('${id}')); window.renderProperties(); window.saveState();"><i class="ph ph-translate"></i> ${autoTrans ? 'OTOMATİK ÇEVİRİ: AÇIK' : 'OTOMATİK ÇEVİRİ: KAPALI'}</button>
            <div class="label-text" style="color:#10b981; margin-bottom:5px;"><i class="ph ph-key"></i> DEEPL API KEY (Profesyonel Çeviri)</div>
            <input type="text" value="${deeplKey}" oninput="window.changeSetting('${id}', 'deepl-api-key', this.value);" onchange="window.saveState()" placeholder="Boşsa ücretsiz Google Çeviri kullanılır..." style="margin-bottom:15px; border-color:#10b981; color:#a7f3d0; font-size:10px;">
            <div class="label-text" style="color:#ef4444; margin-bottom:5px;"><i class="ph ph-prohibit"></i> SANSÜRLENECEK KELİMELER</div>
            <input type="text" value="${bannedWords}" oninput="window.changeSetting('${id}', 'banned-words', this.value);" onchange="window.saveState()" placeholder="Örn: ön izleme, reklam..." style="margin-bottom:15px; border-color:#ef4444; color:#fca5a5;">
            <div class="label-text" style="margin-bottom:5px;">YAZI TİPİ (FONT)</div>
            <select class="font-select" style="margin-bottom:15px;" onchange="window.changeSetting('${id}', 'font-family', this.value); window.updateRssDisplay(document.getElementById('${id}')); window.saveState();">${fontOptionsHtml}</select>
            <div class="label-row"><span class="label-text">AKIŞ HIZI (Düşük = Hızlı)</span><span class="value-badge" id="val-rss-speed-${id}">${speed}s</span></div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="5" max="150" value="${speed}" style="flex:1;" oninput="window.changeSetting('${id}', 'rss-speed', this.value, this); window.updateRssDisplay(document.getElementById('${id}'));" onchange="window.saveState()"><input type="number" value="${speed}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'rss-speed', this.value, this); window.updateRssDisplay(document.getElementById('${id}'));" onchange="window.saveState()"></div>
            <div class="label-row"><span class="label-text">YAZI PUNTO</span><span class="value-badge" id="val-base-font-size-${id}">${fSize}px</span></div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="10" max="200" value="${fSize}" style="flex:1;" oninput="window.changeSetting('${id}', 'base-font-size', this.value, this); window.updateRssDisplay(document.getElementById('${id}'));" onchange="window.saveState()"><input type="number" value="${fSize}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'base-font-size', this.value, this); window.updateRssDisplay(document.getElementById('${id}'));" onchange="window.saveState()"></div>
            <div class="label-text">KAYAN YAZI RENGİ</div>
            <div style="display:flex; gap:10px; align-items:center;"><input type="color" value="${safeColor(txtColor)}" oninput="window.changeSetting('${id}', 'text-color', this.value); window.updateRssDisplay(document.getElementById('${id}')); this.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();" style="width:45px; height:45px; cursor:pointer; border:none; background:none; border-radius:8px;"><input type="text" value="${safeColor(txtColor)}" style="flex:1;" oninput="window.changeSetting('${id}', 'text-color', this.value); window.updateRssDisplay(document.getElementById('${id}')); this.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();"></div>
            `);
        } else if (isTicker) {
            const textStr = window.getD(el, 'ticker-text') || '';
            const speed = window.getD(el, 'ticker-speed') || '35';
            const txtColor = window.getD(el, 'text-color') || '#ffffff';
            const bgColor = window.getD(el, 'solid-color') || '#3b82f6';
            const tickerBg = window.getD(el, 'ticker-bg') || '#0f172a';
            const fSize = window.getD(el, 'base-font-size') || '30';
            const fontFamily = window.getD(el, 'font-family') || 'sans-serif';
            const tickerTitle = window.getD(el, 'ticker-title') !== undefined ? window.getD(el, 'ticker-title') : 'DUYURU';

            let fontOptionsHtml = "";
            if (typeof googleFonts !== 'undefined') {
                fontOptionsHtml = googleFonts.map(font => `<option value="${font.val}" style="font-family: ${font.val}" ${fontFamily.includes(font.name) || fontFamily === font.val ? "selected" : ""}>${font.name}</option>`).join('');
            }

            textHtml += createPropGroup("<i class='ph ph-text-align-right'></i> Kayan Yazı Ayarları", `
            <div class="label-text" style="margin-bottom:5px; color:#f59e0b;"><i class="ph ph-text-t"></i> SABİT BAŞLIK (SOL KÖŞE)</div>
            <input type="text" value="${tickerTitle}" oninput="window.changeSetting('${id}', 'ticker-title', this.value); window.updateTickerDisplay(document.getElementById('${id}'));" onchange="window.saveState()" placeholder="Gizlemek için boş bırakın..." style="margin-bottom:15px; border-color:#f59e0b;">

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                <div>
                    <div class="label-text">BAŞLIK RENGİ</div>
                    <div style="display:flex; gap:10px; align-items:center; margin-top:5px;"><input type="color" value="${safeColor(bgColor)}" oninput="window.changeSetting('${id}', 'solid-color', this.value); window.updateTickerDisplay(document.getElementById('${id}')); this.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();" style="width:35px; height:35px; cursor:pointer; border:none; background:none; border-radius:6px;"><input type="text" value="${safeColor(bgColor)}" style="flex:1; padding:5px; font-size:10px;" oninput="window.changeSetting('${id}', 'solid-color', this.value); window.updateTickerDisplay(document.getElementById('${id}')); this.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();"></div>
                </div>
                <div>
                    <div class="label-text">ARKAPLAN RENGİ</div>
                    <div style="display:flex; gap:10px; align-items:center; margin-top:5px;"><input type="color" value="${safeColor(tickerBg)}" oninput="window.changeSetting('${id}', 'ticker-bg', this.value); window.updateTickerDisplay(document.getElementById('${id}')); this.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();" style="width:35px; height:35px; cursor:pointer; border:none; background:none; border-radius:6px;"><input type="text" value="${safeColor(tickerBg)}" style="flex:1; padding:5px; font-size:10px;" oninput="window.changeSetting('${id}', 'ticker-bg', this.value); window.updateTickerDisplay(document.getElementById('${id}')); this.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();"></div>
                </div>
            </div>

            <hr style="border-color:#334155; margin:15px 0;">

            <div class="label-text" style="margin-bottom:5px;">KAYACAK METİN (KAMPANYA / DUYURU)</div>
            <textarea oninput="window.changeSetting('${id}', 'ticker-text', this.value); window.updateTickerDisplay(document.getElementById('${id}'));" onchange="window.saveState()" style="width:100%; height:80px; background:#000; color:#fff; border:1px solid var(--border); padding:8px; border-radius:6px; font-size:12px; margin-bottom:5px;" placeholder="Yazılarınızı buraya girin...">${textStr}</textarea>
            
            <div style="font-size:10px; color:#10b981; margin-bottom:15px; background:rgba(16,185,129,0.1); padding:8px; border-radius:6px; border:1px dashed #10b981;">
                <b>💡 Renkli Kelime Taktikleri:</b><br>
                [color=red]KIRMIZI[/color]<br>
                [color=yellow]SARI[/color]<br>
                [color=#ff00ff]ÖZEL RENK[/color]
            </div>

            <div class="label-text" style="margin-bottom:5px;">YAZI TİPİ (FONT)</div>
            <select class="font-select" style="margin-bottom:15px;" onchange="window.changeSetting('${id}', 'font-family', this.value); window.updateTickerDisplay(document.getElementById('${id}')); window.saveState();">${fontOptionsHtml}</select>

            <div class="label-row"><span class="label-text">AKIŞ HIZI (Düşük = Hızlı)</span><span class="value-badge" id="val-ticker-speed-${id}">${speed}s</span></div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="5" max="150" value="${speed}" style="flex:1;" oninput="window.changeSetting('${id}', 'ticker-speed', this.value, this); window.updateTickerDisplay(document.getElementById('${id}'));" onchange="window.saveState()"><input type="number" value="${speed}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'ticker-speed', this.value, this); window.updateTickerDisplay(document.getElementById('${id}'));" onchange="window.saveState()"></div>

            <div class="label-row"><span class="label-text">YAZI PUNTO</span><span class="value-badge" id="val-base-font-size-${id}">${fSize}px</span></div>
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="10" max="200" value="${fSize}" style="flex:1;" oninput="window.changeSetting('${id}', 'base-font-size', this.value, this); window.updateTickerDisplay(document.getElementById('${id}'));" onchange="window.saveState()"><input type="number" value="${fSize}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'base-font-size', this.value, this); window.updateTickerDisplay(document.getElementById('${id}'));" onchange="window.saveState()"></div>

            <div class="label-text">KAYAN YAZI RENGİ</div>
            <div style="display:flex; gap:10px; align-items:center;"><input type="color" value="${safeColor(txtColor)}" oninput="window.changeSetting('${id}', 'text-color', this.value); window.updateTickerDisplay(document.getElementById('${id}')); this.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();" style="width:45px; height:45px; cursor:pointer; border:none; background:none; border-radius:8px;"><input type="text" value="${safeColor(txtColor)}" style="flex:1;" oninput="window.changeSetting('${id}', 'text-color', this.value); window.updateTickerDisplay(document.getElementById('${id}')); this.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); window.saveState();"></div>
            `);
        } else if (isVideo) {
            const url = window.getD(el, 'video-url') || '';
            const isMuted = window.getD(el, 'video-muted') === 'true';
            const isLoop = window.getD(el, 'video-loop') === 'true';
            videoHtml += createPropGroup("<i class='ph ph-video-camera'></i> Medya Ayarları", `
            <div class="label-text" style="margin-bottom:5px;">VİDEO LİNKİ (MP4 / M3U8 / YOUTUBE)</div>
            <input type="text" value="${url}" oninput="window.changeSetting('${id}', 'video-url', this.value); window.updateVideoDisplay(document.getElementById('${id}'));" onchange="window.saveState()" placeholder="Örn: https://youtu.be/..." style="margin-bottom:15px;">
            <div class="action-row">
                <button class="action-btn ${isMuted ? 'active' : ''}" onclick="window.changeSetting('${id}', 'video-muted', '${!isMuted}'); window.updateVideoDisplay(document.getElementById('${id}')); window.renderProperties(); window.saveState();">
                    <i class="ph ${isMuted ? 'ph-speaker-slash' : 'ph-speaker-high'}"></i> ${isMuted ? 'SESSİZ' : 'SESLİ'}
                </button>
                <button class="action-btn ${isLoop ? 'active' : ''}" onclick="window.changeSetting('${id}', 'video-loop', '${!isLoop}'); window.updateVideoDisplay(document.getElementById('${id}')); window.renderProperties(); window.saveState();">
                    <i class="ph ph-arrows-clockwise"></i> ${isLoop ? 'DÖNGÜ (AÇIK)' : 'DÖNGÜ (KAPALI)'}
                </button>
            </div>
            `);
        } else if (isWeather) {
            const city = window.getD(el, 'city') || 'Izmir';
            const theme = window.getD(el, 'theme') || 'light';
            widgetHtml += createPropGroup("<i class='ph ph-cloud-sun'></i> Hava Durumu Ayarları", `
            <div class="label-text" style="margin-bottom:5px;">ŞEHİR ADI</div>
            <input type="text" value="${city}" oninput="window.changeSetting('${id}', 'city', this.value); window.updateWeatherDisplay(document.getElementById('${id}'));" onchange="window.saveState()" placeholder="Örn: Istanbul" style="margin-bottom:15px;">
            <div class="label-text" style="margin-bottom:5px;">TEMA</div>
            <select class="font-select" onchange="window.changeSetting('${id}', 'theme', this.value); window.updateWeatherDisplay(document.getElementById('${id}')); window.saveState();">
                <option value="dark" ${theme==='dark'?'selected':''}>Koyu (Cam Efekti)</option>
                <option value="light" ${theme==='light'?'selected':''}>Açık (Buzlu Cam)</option>
            </select>
            <button class="action-btn active" style="width:100%; margin-top:15px;" onclick="window.updateWeatherDisplay(document.getElementById('${id}'));"><i class="ph ph-arrows-clockwise"></i> VERİYİ YENİLE</button>
            `);
        } else if (isCurrency) {
            const curs = window.getD(el, 'currencies') || 'USD,EUR,GBP';
            widgetHtml += createPropGroup("<i class='ph ph-currency-circle-dollar'></i> Döviz Ayarları", `
            <div class="label-text" style="margin-bottom:5px;">GÖSTERİLECEK KURLAR (Virgülle Ayırın)</div>
            <input type="text" value="${curs}" oninput="window.changeSetting('${id}', 'currencies', this.value.toUpperCase()); window.updateCurrencyDisplay(document.getElementById('${id}'));" onchange="window.saveState()" placeholder="USD,EUR,GBP" style="margin-bottom:15px;">
            <button class="action-btn active" style="width:100%; margin-top:15px;" onclick="window.updateCurrencyDisplay(document.getElementById('${id}'));"><i class="ph ph-arrows-clockwise"></i> VERİYİ YENİLE</button>
            `);
        }

        codeHtml += createPropGroup("<i class='ph ph-file-code'></i> Canlı SVG Kodu", `<textarea id="raw-svg-code" style="width:100%; height:250px; background:#000; color:var(--accent); font-family:monospace; font-size:11px; padding:10px; border-radius:8px; border:1px solid var(--border); resize:vertical;" onchange="window.saveState()">${el.outerHTML.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea><button class="action-btn active" style="width:100%; margin-top:10px; padding:12px;" onclick="window.applyRawCode('${id}')"><i class="ph ph-terminal-window"></i> KODU UYGULA</button>`);
        
        f.innerHTML = headerHtml + tabsNav + 
            `<div id="tab-layout" class="tab-content ${window.activeTabId === 'tab-layout' ? 'active' : ''}">${layoutHtml}</div>` + 
            `<div id="tab-style" class="tab-content ${window.activeTabId === 'tab-style' ? 'active' : ''}">${styleHtml}</div>` + 
            (isText ? `<div id="tab-text" class="tab-content ${window.activeTabId === 'tab-text' ? 'active' : ''}">${textHtml}</div>` : '') + 
            (isVideo ? `<div id="tab-video" class="tab-content ${window.activeTabId === 'tab-video' ? 'active' : ''}">${videoHtml}</div>` : '') + 
            (isWidget ? `<div id="tab-widget" class="tab-content ${window.activeTabId === 'tab-widget' ? 'active' : ''}">${widgetHtml}</div>` : '') +
            `<div id="tab-code" class="tab-content ${window.activeTabId === 'tab-code' ? 'active' : ''}">${codeHtml}</div>`;
    } catch(err) { f.innerHTML = `<div style="color:var(--error); padding:20px; font-size:12px; text-align:center;"><i class="ph ph-warning-circle" style="font-size:32px; display:block; margin-bottom:10px;"></i> Özellikler yüklenemedi.</div>`; }
};

window.applyRawCode = function(id) {
    try { let p = new DOMParser(); let code = document.getElementById('raw-svg-code').value.trim(); let n; if (!code.toLowerCase().startsWith('<svg')) { let d = p.parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + code + '</svg>', 'image/svg+xml'); n = d.documentElement.firstElementChild; } else { let d = p.parseFromString(code, 'image/svg+xml'); n = d.documentElement; } if(!n) throw new Error('Geçersiz SVG'); let o = document.getElementById(id); o.replaceWith(n); window.selectedEl = n; if(!window.selectedEl.id) window.selectedEl.id='el_'+Date.now(); if(!window.selectedEl.classList.contains('duzenlenebilir')) window.selectedEl.classList.add('duzenlenebilir'); window.saveState(); window.setupLayers(); window.updateUI(window.selectedEl); window.renderEditor(); window.showToast("Özel Kod Uygulandı!"); } catch(err) { window.showToast('Lütfen geçerli bir SVG kodu girin.', 'error'); }
};

window.initEngine = function(svg) {
    const wrapper = document.getElementById('svg-wrapper'); const ctrl = document.getElementById('control-layer');
    const getCoords = (e) => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const ctm = svg.getScreenCTM(); if (!ctm) return { x: 0, y: 0 }; const cursorpt = pt.matrixTransform(ctm.inverse()); return { x: cursorpt.x, y: cursorpt.y }; };

    if(wrapper) {
        wrapper.onpointerdown = (e) => {
            if (isSpacePressed) { isPanning = true; panStart = {x: e.clientX, y: e.clientY}; panOffsetStart = {x: panX, y: panY}; document.getElementById('svg-wrapper')?.classList.add('panning'); return; }
            const p = getCoords(e); const target = e.target; isModified = false;
            if (isDrawingMode) {
                isDrawing = true; currentPath = document.createElementNS("http://www.w3.org/2000/svg", "path"); currentPath.id = "pth_" + Date.now(); currentPath.setAttribute("class", "duzenlenebilir"); currentPath.setAttribute("fill", "none"); currentPath.setAttribute("stroke", "#10b981"); currentPath.setAttribute("stroke-width", "5"); currentPath.setAttribute("stroke-linecap", "round"); currentPath.setAttribute("stroke-linejoin", "round"); pathData = `M ${p.x} ${p.y}`; currentPath.setAttribute("d", pathData);
                const guidesGroup = document.getElementById('guides-group'); if(guidesGroup) svg.insertBefore(currentPath, guidesGroup); else svg.appendChild(currentPath);
                try { wrapper.setPointerCapture(e.pointerId); } catch(err){} return;
            }
            if (target.classList.contains('guide-line')) { isDraggingGuide = true; currentGuide = target; try { wrapper.setPointerCapture(e.pointerId); } catch(err){} e.preventDefault(); e.stopPropagation(); return; }
            if (target.classList.contains('handle')) {
                const el = document.getElementById(target.dataset.id); if (!el || window.getD(el, 'locked') === "true") return;
                let tempW = 0, tempH = 0; if(el.tagName === 'text') { tempW = parseFloat(el.getAttribute("textLength")) || el.getBBox().width || 0; tempH = parseFloat(window.getD(el, "base-font-size")) || 80; } else { tempW = parseFloat(el.getAttribute("width")) || 0; tempH = parseFloat(el.getAttribute("height")) || 0; }
                startP = p; startData = { x: parseFloat(el.getAttribute("x")) || 0, y: parseFloat(el.getAttribute("y")) || 0, w: tempW, h: tempH, rx: parseFloat(window.getD(el, 'rx')) || 0, baseFontSize: parseFloat(window.getD(el, 'base-font-size')) || 60 };
                if (target.classList.contains('handle-resize')) { resizingEl = el; activeHandle = target.dataset.handle; } 
                else if (target.classList.contains('handle-rotate')) { rotatingEl = el; } 
                else if (target.classList.contains('handle-radius')) { radiusingEl = el; }
                try { wrapper.setPointerCapture(e.pointerId); } catch(err){} e.preventDefault(); e.stopPropagation(); return;
            }
            const el = target.closest('.duzenlenebilir');
            if (el) {
                if (e.altKey && window.getD(el, 'locked') !== "true") { const clone = el.cloneNode(true); clone.id = "el_" + Date.now(); clone.classList.add("duzenlenebilir"); el.parentNode.insertBefore(clone, el.nextSibling); window.selectedEl = clone; } else { window.selectedEl = el; }
                isDraggingElement = true; offset.x = p.x - (parseFloat(window.selectedEl.getAttribute("x")) || 0); offset.y = p.y - (parseFloat(window.selectedEl.getAttribute("y")) || 0); 
                window.updateUI(window.selectedEl); window.renderEditor();
                if(window.getD(window.selectedEl, 'locked') !== "true") { try { wrapper.setPointerCapture(e.pointerId); } catch(err){} }
            } else { if(!e.target.closest('#sidebar')) { window.selectedEl = null; if(ctrl) ctrl.innerHTML = ""; window.renderEditor(); } }
        };

        wrapper.onpointermove = (e) => {
            if (isPanning) { panX = panOffsetStart.x + ((e.clientX - panStart.x) / currentZoom); panY = panOffsetStart.y + ((e.clientY - panStart.y) / currentZoom); window.applyZoom(); window.syncRulerTransform(); return; }
            const p = getCoords(e);
            if (isDrawing && currentPath) { pathData += ` L ${p.x} ${p.y}`; currentPath.setAttribute("d", pathData); return; }
            if (isDraggingGuide && currentGuide) { if(window.getD(currentGuide, 'type') === 'h') { currentGuide.setAttribute('y1', p.y); currentGuide.setAttribute('y2', p.y); } else { currentGuide.setAttribute('x1', p.x); currentGuide.setAttribute('x2', p.x); } return; }
            if (!window.selectedEl && !resizingEl && !rotatingEl && !radiusingEl) return;
            if (window.selectedEl && window.getD(window.selectedEl, 'locked') === "true" && !resizingEl && !rotatingEl && !radiusingEl) return; 
            if(isDraggingElement || resizingEl || rotatingEl || radiusingEl) e.preventDefault(); 
            const dx = p.x - startP.x; const dy = p.y - startP.y; 

            if (resizingEl) {
                isModified = true; let { x, y, w, h } = startData;
                if (activeHandle === 'br') { w += dx; h += dy; } else if (activeHandle === 'bl') { x += dx; w -= dx; h += dy; } else if (activeHandle === 'tr') { y += dy; w += dx; h -= dy; } else if (activeHandle === 'tl') { x += dx; y += dy; w -= dx; h -= dy; }
                if (resizingEl.tagName === "text") { 
                    if(w > 10) { resizingEl.setAttribute('textLength', w); resizingEl.setAttribute('lengthAdjust', 'spacingAndGlyphs'); const tp = resizingEl.querySelector('textPath'); if (tp) { tp.setAttribute('textLength', w); tp.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } }
                    if(h > 5) { window.setD(resizingEl, 'base-font-size', h); } if(activeHandle.includes('l')) resizingEl.setAttribute('x', x); if(activeHandle.includes('t')) resizingEl.setAttribute('y', y); window.applyTextCurve(resizingEl);
                } else if (resizingEl.tagName === "image" || resizingEl.tagName === "rect" || resizingEl.tagName === "svg" || resizingEl.tagName === "g" || resizingEl.tagName === "foreignObject") { 
                    if (w > 10 && h > 10) { resizingEl.setAttribute("x", x); resizingEl.setAttribute("y", y); resizingEl.setAttribute("width", w); resizingEl.setAttribute("height", h); if(resizingEl.tagName !== "svg" && resizingEl.tagName !== "g" && window.getD(resizingEl, 'mask-shape') && window.getD(resizingEl, 'mask-shape') !== "none") window.applyShapeMask(resizingEl); } 
                } window.updateUI(resizingEl); if(resizingEl.tagName === 'rect' || resizingEl.tagName === 'image' || resizingEl.classList.contains('video-obj') || resizingEl.classList.contains('weather-widget') || resizingEl.classList.contains('currency-widget')) { document.querySelectorAll(`text[data-bound-rect="${resizingEl.id}"]`).forEach(txt => { window.autoFitText(txt); }); }
            } else if (rotatingEl) {
                isModified = true; let bbox = {x:0, y:0, width:0, height:0}; try{ bbox = rotatingEl.getBBox(); }catch(e){}
                const angle = Math.atan2(p.y - (bbox.y + bbox.height/2), p.x - (bbox.x + bbox.width/2)) * (180 / Math.PI) + 90; 
                window.setD(rotatingEl, 'angle', angle); window.applyTransforms(rotatingEl); window.updateUI(rotatingEl);
            } 
            else if (radiusingEl && (radiusingEl.tagName === "image" || radiusingEl.tagName === "rect" || radiusingEl.classList.contains('video-obj') || radiusingEl.classList.contains('weather-widget') || radiusingEl.classList.contains('currency-widget'))) {
                isModified = true; 
                let delta = Math.max(dx, dy); 
                let newRx = Math.max(0, Math.min(startData.w/2, startData.h/2, startData.rx + delta));
                window.setD(radiusingEl, 'rx', newRx); 
                window.applyShapeMask(radiusingEl); 
                window.updateUI(radiusingEl);
                
                let badge = document.getElementById('val-rx-' + radiusingEl.id);
                if(badge) badge.innerText = Math.round(newRx) + 'px';
                document.querySelectorAll(`input[oninput*="changeSetting('${radiusingEl.id}', 'rx'"]`).forEach(inp => {
                    inp.value = newRx;
                });
            } else if (window.selectedEl && isDraggingElement) {
                isModified = true; 
                let newX = p.x - offset.x; let newY = p.y - offset.y;
                let snapX = null, snapY = null; const snapTolerance = 12;
                const dim = window.getSvgDim(); const cw = dim.w, ch = dim.h;
                let bbox = {width:0, height:0}; try { bbox = window.selectedEl.getBBox(); } catch(e){}
                const isText = window.selectedEl.tagName === 'text';
                let objCX = isText ? newX : newX + bbox.width / 2; let objCY = isText ? newY : newY + bbox.height / 2;

                if (!e.shiftKey) {
                    if (Math.abs(objCX - cw/2) < snapTolerance) { objCX = cw/2; snapX = cw/2; }
                    if (Math.abs(objCY - ch/2) < snapTolerance) { objCY = ch/2; snapY = ch/2; }
                    if (!isText) {
                        if (Math.abs(newX) < snapTolerance) { newX = 0; objCX = bbox.width/2; snapX = 0; }
                        if (Math.abs(newX + bbox.width - cw) < snapTolerance) { newX = cw - bbox.width; objCX = cw - bbox.width/2; snapX = cw; }
                        if (Math.abs(newY) < snapTolerance) { newY = 0; objCY = bbox.height/2; snapY = 0; }
                        if (Math.abs(newY + bbox.height - ch) < snapTolerance) { newY = ch - bbox.height; objCY = ch - bbox.height/2; snapY = ch; }
                    }
                    document.querySelectorAll('.duzenlenebilir').forEach(other => {
                        if (other.id === window.selectedEl.id || window.getD(other, 'locked') === 'true') return;
                        try {
                            let ob = other.getBBox(); let oIsText = other.tagName === 'text';
                            let oCX = oIsText ? parseFloat(other.getAttribute('x'))||0 : ob.x + ob.width/2; let oCY = oIsText ? parseFloat(other.getAttribute('y'))||0 : ob.y + ob.height/2;
                            if (Math.abs(objCX - oCX) < snapTolerance) { objCX = oCX; snapX = oCX; }
                            if (Math.abs(objCY - oCY) < snapTolerance) { objCY = oCY; snapY = oCY; }
                        } catch(err){}
                    });
                    if (isText) { newX = objCX; newY = objCY; } else { newX = objCX - bbox.width / 2; newY = objCY - bbox.height / 2; }
                }
                window.selectedEl.setAttribute("x", newX); window.selectedEl.setAttribute("y", newY);
                if((window.selectedEl.tagName === 'image' || window.selectedEl.tagName === 'rect' || window.selectedEl.classList.contains('video-obj') || window.selectedEl.classList.contains('weather-widget') || window.selectedEl.classList.contains('currency-widget')) && window.getD(window.selectedEl, 'mask-shape') && window.getD(window.selectedEl, 'mask-shape') !== "none") window.applyShapeMask(window.selectedEl); 
                if(window.selectedEl.tagName === 'text' && window.getD(window.selectedEl, 'curve')) window.applyTextCurve(window.selectedEl); 
                window.updateUI(window.selectedEl, snapX, snapY);
                if(window.selectedEl.tagName === 'rect' || window.selectedEl.tagName === 'image' || window.selectedEl.classList.contains('video-obj') || window.selectedEl.classList.contains('weather-widget') || window.selectedEl.classList.contains('currency-widget')) { document.querySelectorAll(`text[data-bound-rect="${window.selectedEl.id}"]`).forEach(txt => { window.autoFitText(txt); }); }
            }
        };

        const release = (e) => { 
            try { wrapper.releasePointerCapture(e.pointerId); } catch(err){} isDraggingElement = false; 
            if (isPanning) { isPanning = false; document.getElementById('svg-wrapper')?.classList.remove('panning'); return; }
            if (isDrawing) { isDrawing = false; window.selectedEl = currentPath; currentPath = null; isDrawingMode = false; document.getElementById('svg-wrapper')?.classList.remove('draw-mode'); window.saveState(); window.renderEditor(); window.updateUI(window.selectedEl); return; }
            if (isDraggingGuide) { isDraggingGuide = false; currentGuide = null; window.saveState(); return; }
            if (isModified) { window.saveState(); if(window.selectedEl) window.renderProperties(); }
            resizingEl = null; rotatingEl = null; radiusingEl = null; activeHandle = null; isModified = false; document.querySelectorAll('.snap-line').forEach(l=>l.remove()); 
        };
        wrapper.onpointerup = release; wrapper.onpointercancel = release;
    }
};

window.updateUI = function(el, snapX=null, snapY=null) {
    const ctrl = document.getElementById('control-layer'); if(!ctrl) return; ctrl.innerHTML = ""; if(!el) return;
    let b = {x:0,y:0,width:0,height:0}; try { b = el.getBBox(); }catch(e){return;}
    const transform = el.getAttribute("transform") || ""; const isLocked = window.getD(el, 'locked') === "true";
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.setAttribute("transform", transform); ctrl.appendChild(g);
    
    const dim = window.getSvgDim(); const w = dim.w, h = dim.h;
    if (snapX !== null) { const lX = document.createElementNS("http://www.w3.org/2000/svg", "line"); lX.setAttribute("x1", snapX); lX.setAttribute("y1", 0); lX.setAttribute("x2", snapX); lX.setAttribute("y2", h); lX.classList.add("snap-line"); ctrl.appendChild(lX); }
    if (snapY !== null) { const lY = document.createElementNS("http://www.w3.org/2000/svg", "line"); lY.setAttribute("x1", 0); lY.setAttribute("y1", snapY); lY.setAttribute("x2", w); lY.setAttribute("y2", snapY); lY.classList.add("snap-line"); ctrl.appendChild(lY); }

    const strokeColor = isLocked ? "var(--error)" : "var(--handle-move)";
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect"); r.setAttribute("x", b.x); r.setAttribute("y", b.y); r.setAttribute("width", b.width); r.setAttribute("height", b.height); r.setAttribute("fill", "none"); r.setAttribute("stroke", strokeColor); r.setAttribute("stroke-width", "2"); r.setAttribute("stroke-dasharray", "6,4"); g.appendChild(r);
    if (isLocked) return;
    
    const s = 24; 
    const corners = [{ id: 'tl', x: b.x, y: b.y, cur: 'nwse-resize' }, { id: 'tr', x: b.x + b.width, y: b.y, cur: 'nesw-resize' }, { id: 'bl', x: b.x, y: b.y + b.height, cur: 'nesw-resize' }, { id: 'br', x: b.x + b.width, y: b.y + b.height, cur: 'nwse-resize' }];
    corners.forEach(c => { const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); rect.setAttribute("x", c.x - s/2); rect.setAttribute("y", c.y - s/2); rect.setAttribute("width", s); rect.setAttribute("height", s); rect.setAttribute("class", "handle handle-resize"); rect.dataset.id = el.id; rect.dataset.handle = c.id; rect.style.cursor = c.cur; g.appendChild(rect); });
    
    const rotY = b.y - 40; const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); line.setAttribute("x1", b.x + b.width/2); line.setAttribute("y1", b.y); line.setAttribute("x2", b.x + b.width/2); line.setAttribute("y2", rotY); line.setAttribute("stroke", "var(--handle-rotate)"); line.setAttribute("stroke-width", "2"); g.appendChild(line);
    const rotH = document.createElementNS("http://www.w3.org/2000/svg", "circle"); rotH.setAttribute("cx", b.x + b.width/2); rotH.setAttribute("cy", rotY); rotH.setAttribute("r", s/2.5); rotH.setAttribute("class", "handle handle-rotate"); rotH.dataset.id = el.id; g.appendChild(rotH);

    if (el.tagName === 'rect' || el.tagName === 'image' || el.classList.contains('video-obj') || el.classList.contains('weather-widget') || el.classList.contains('currency-widget')) {
        const currentRx = parseFloat(window.getD(el, 'rx')) || 0;
        const offsetDist = Math.max(15, currentRx);
        const radH = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        radH.setAttribute("cx", b.x + offsetDist);
        radH.setAttribute("cy", b.y + offsetDist);
        radH.setAttribute("r", s/2.5);
        radH.setAttribute("class", "handle handle-radius");
        radH.dataset.id = el.id;
        g.appendChild(radH);
    }
};
window.updateEditorUI = window.updateUI; 

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); isSpacePressed = true; const sw = document.getElementById('svg-wrapper'); if(sw) sw.classList.add('pan-mode'); return; }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); window.undo(); return; } if (e.ctrlKey && e.key === 'y') { e.preventDefault(); window.redo(); return; }
    if (window.selectedEl && window.getD(window.selectedEl, 'locked') !== "true") {
        const step = e.shiftKey ? 10 : 1; let moved = false; let x = parseFloat(window.selectedEl.getAttribute("x")) || 0, y = parseFloat(window.selectedEl.getAttribute("y")) || 0;
        if (e.key === 'ArrowUp') { y -= step; moved = true; } if (e.key === 'ArrowDown') { y += step; moved = true; } if (e.key === 'ArrowLeft') { x -= step; moved = true; } if (e.key === 'ArrowRight') { x += step; moved = true; }
        if (moved) { e.preventDefault(); window.selectedEl.setAttribute("x", x); window.selectedEl.setAttribute("y", y); if(window.selectedEl.tagName === 'image' || window.selectedEl.tagName === 'rect' || window.selectedEl.classList.contains('video-obj') || window.selectedEl.classList.contains('weather-widget') || window.selectedEl.classList.contains('currency-widget')) window.applyShapeMask(window.selectedEl); if(window.selectedEl.tagName === 'text') window.applyTextCurve(window.selectedEl); window.updateUI(window.selectedEl); isModified = true; }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); window.selectedEl.remove(); const ctrl = document.getElementById('control-layer'); if(ctrl) ctrl.innerHTML = ''; window.selectedEl = null; window.saveState(); window.renderEditor(); }
        if (e.ctrlKey && e.key === 'c') { e.preventDefault(); clipboard = window.selectedEl.cloneNode(true); }
    }
    if (e.ctrlKey && e.key === 'v' && clipboard) { e.preventDefault(); const clone = clipboard.cloneNode(true); clone.id = "el_" + Date.now(); clone.setAttribute("x", (parseFloat(clone.getAttribute("x")) || 0) + 30); clone.setAttribute("y", (parseFloat(clone.getAttribute("y")) || 0) + 30); document.querySelector('#canvas-inner svg').appendChild(clone); window.selectedEl = clone; window.saveState(); window.setupLayers(); window.updateUI(clone); window.renderEditor(); }
});

document.addEventListener('keyup', (e) => { 
    if (e.code === 'Space') { isSpacePressed = false; isPanning = false; const sw = document.getElementById('svg-wrapper'); if(sw) { sw.classList.remove('pan-mode'); sw.classList.remove('panning'); } return; } 
    if(isModified && e.key.startsWith('Arrow')) { window.saveState(); isModified = false; } 
});

document.addEventListener('contextmenu', function(e) {
    const el = e.target.closest('.duzenlenebilir');
    if (el) {
        e.preventDefault(); window.selectedEl = el; isDraggingElement = false; window.updateUI(el); window.renderEditor();
        const ctx = document.getElementById('context-menu');
        if (ctx) {
            ctx.style.display = 'block'; ctx.style.left = e.pageX + 'px'; ctx.style.top = e.pageY + 'px';
            const isLocked = window.getD(el, 'locked') === "true";
            document.getElementById('ctx-lock-icon').className = isLocked ? "ph ph-lock-key-open" : "ph ph-lock-key";
            document.getElementById('ctx-lock-text').innerText = isLocked ? "Kilidi Aç" : "Kilitle";
        }
    } else if (e.target.closest('#svg-wrapper')) { e.preventDefault(); window.closeCtx(); }
});
window.closeCtx = function() { const ctx = document.getElementById('context-menu'); if(ctx) { ctx.style.display = 'none'; } }; 
document.addEventListener('click', window.closeCtx);

// =========================================================================
// 📝 AKILLI SLAYT YENİDEN ADLANDIRMA MOTORU
// =========================================================================

window.renameSlide = async function() {
    const oldKey = document.getElementById('file-selector')?.value;
    if (!oldKey) return window.showToast("Lütfen önce bir slayt seçin!", "error");

    const currentName = oldKey.replace(/_/g, ' ').toUpperCase();
    const rawNewName = prompt("Slaytın yeni ismini girin:", currentName);
    
    if (!rawNewName || rawNewName.trim() === "") return;
    const newKey = rawNewName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (newKey === oldKey) return; 

    const snapCheck = await get(ref(db, 'sahne/slaytlar/' + newKey));
    if (snapCheck.exists()) {
        return window.showToast("Bu isimde bir slayt zaten var! Lütfen başka bir isim seçin.", "error");
    }

    window.showToast("Slayt adı güncelleniyor...", "success");

    const svgSnap = await get(ref(db, 'sahne/slaytlar/' + oldKey));
    const ayarSnap = await get(ref(db, 'sahne/ayarlar/' + oldKey));
    
    const svgData = svgSnap.exists() ? svgSnap.val() : '';
    const ayarData = ayarSnap.exists() ? ayarSnap.val() : {};

    if (svgData) await set(ref(db, 'sahne/slaytlar/' + newKey), svgData);
    await set(ref(db, 'sahne/ayarlar/' + newKey), ayarData);

    const plSnap = await get(ref(db, 'sahne/oynatma_listeleri'));
    if (plSnap.exists()) {
        const allPlaylists = plSnap.val();
        let listsUpdated = false;
        
        Object.keys(allPlaylists).forEach(target => {
            let list = allPlaylists[target];
            let changed = false;
            list.forEach(item => {
                if (item.slide === oldKey) {
                    item.slide = newKey; 
                    changed = true;
                }
            });
            if (changed) {
                allPlaylists[target] = list;
                listsUpdated = true;
            }
        });
        
        if (listsUpdated) {
            await set(ref(db, 'sahne/oynatma_listeleri'), allPlaylists);
            if (window.fetchPlaylistFromFirebase) window.fetchPlaylistFromFirebase();
        }
    }

    await remove(ref(db, 'sahne/slaytlar/' + oldKey));
    await remove(ref(db, 'sahne/ayarlar/' + oldKey));

    window.showToast("Slayt ismi başarıyla değiştirildi!", "success");
    
    setTimeout(() => {
        const selector = document.getElementById('file-selector');
        if (selector) selector.value = newKey;
        if (window.loadSlide) window.loadSlide();
    }, 1000);
};

// =========================================================================
// 🚀 YENİ NESİL: EKRAN YAYIN AKIŞI (PLAYLIST) VE CİHAZ YÖNETİMİ
// =========================================================================

window.aktifHedefler = { cihazlar: {}, gruplar: new Set(['GENEL', 'TÜMÜ']) };
window.currentPlaylistTarget = 'TÜMÜ';
window.loadedPlaylist = [];

if (!window.hedefDinleyiciAktif) {
    onValue(ref(db, 'sahne/cihazlar'), (snapshot) => {
        if (snapshot.exists()) {
            const cihazlar = snapshot.val();
            window.aktifHedefler.cihazlar = cihazlar;
            Object.values(cihazlar).forEach(c => {
                if (c.group) window.aktifHedefler.gruplar.add(c.group);
            });
            window.renderPlaylistPanel(); 
            window.updateDeviceDashboard();
        }
    });
    window.hedefDinleyiciAktif = true;
}



window.togglePlaylistPanel = function() { };

window.changePlaylistTarget = function(target) {
    window.currentPlaylistTarget = target;
    window.fetchPlaylistFromFirebase();
};

window.renderPlaylistPanel = function() {
    const sel = document.getElementById('playlist-target-select');
    if (!sel) return;
    const currVal = window.currentPlaylistTarget;
    sel.innerHTML = `<option value="TÜMÜ">🌍 TÜM EKRANLAR (GENEL YAYIN)</option>`;
    
    Array.from(window.aktifHedefler.gruplar).sort().forEach(grup => {
        if(grup !== 'TÜMÜ') sel.innerHTML += `<option value="${grup}">🏢 GRUP: ${grup}</option>`;
    });
    Object.keys(window.aktifHedefler.cihazlar).forEach(id => {
        const c = window.aktifHedefler.cihazlar[id];
        sel.innerHTML += `<option value="${c.name || id}">📺 TV: ${c.name || id}</option>`;
    });
    
    sel.value = currVal;
    if(window.loadedPlaylist.length === 0) window.fetchPlaylistFromFirebase();
};

window.fetchPlaylistFromFirebase = async function() {
    const target = window.currentPlaylistTarget;
    const listContainer = document.getElementById('playlist-items');
    if(!listContainer) return;

    listContainer.innerHTML = `<div style="text-align:center; color:#64748b; font-size:12px; padding:20px;">Liste yükleniyor...</div>`;

    const snap = await get(ref(db, 'sahne/oynatma_listeleri/' + target));
    window.loadedPlaylist = snap.exists() ? snap.val() : [];
    window.renderPlaylistItems();
};

window.addCurrentSlideToPlaylist = function() {
    const currentSlide = document.getElementById('file-selector')?.value;
    if(!currentSlide) return window.showToast("Önce bir slayt seçin!", "error");

    window.loadedPlaylist.push({
        slide: currentSlide,
        time: 5000,
        effect: 'fade',
        startTime: '00:00',
        endTime: '23:59',
        days: [1,2,3,4,5,6,0], 
        startDate: '',
        endDate: ''
    });
    window.renderPlaylistItems();
    window.showToast("Slayt listeye eklendi. Düzenleyip kaydetmeyi unutmayın!", "success");
};

window.removePlaylistItem = function(index) {
    window.loadedPlaylist.splice(index, 1);
    window.renderPlaylistItems();
};

window.toggleDayForPlaylist = function(index, dayNum) {
    let item = window.loadedPlaylist[index];
    if (!item.days) item.days = [1,2,3,4,5,6,0]; 
    
    if (item.days.includes(dayNum)) {
        item.days = item.days.filter(d => d !== dayNum); 
    } else {
        item.days.push(dayNum); 
    }
    window.renderPlaylistItems();
};

window.renderPlaylistItems = function() {
    const listContainer = document.getElementById('playlist-items');
    if(!listContainer) return;

    listContainer.innerHTML = '';
    
    if (window.loadedPlaylist.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; color:#ef4444; font-size:12px; padding:20px; border:1px dashed #ef4444; border-radius:6px;">Bu hedef için henüz oynatma listesi yok!</div>`;
        return;
    }

    const effectOptions = [
        {val: 'fade', name: 'Yumuşak Geçiş (Fade)'},
        {val: 'slide', name: 'Sola Kaydır (Slide)'},
        {val: 'slide-right', name: 'Sağa Kaydır (Slide Right)'},
        {val: 'slide-up', name: 'Yukarı Kaydır (Slide Up)'},
        {val: 'slide-down', name: 'Aşağı Kaydır (Slide Down)'},
        {val: 'zoom', name: 'Büyüyerek Gel (Zoom In)'},
        {val: 'zoom-out', name: 'Küçülerek Gel (Zoom Out)'},
        {val: 'flip', name: 'Yatay Dönüş (Flip X)'},
        {val: 'flip-y', name: 'Dikey Dönüş (Flip Y)'},
        {val: 'rotate', name: 'Dönerek Gel (Rotate)'},
        {val: 'blur', name: 'Bulanıklıktan Netleş (Blur)'},
        {val: 'wipe-left', name: 'Sola Silinme (Wipe)'},
        {val: 'bounce', name: 'Zıplama (Bounce)'},
        {val: 'none', name: 'Efektsiz (Kesme)'}
    ];

    const daysLabels = [
        {name: 'Pzt', num: 1}, {name: 'Sal', num: 2}, {name: 'Çar', num: 3}, 
        {name: 'Per', num: 4}, {name: 'Cum', num: 5}, {name: 'Cmt', num: 6}, {name: 'Paz', num: 0}
    ];

    window.loadedPlaylist.forEach((item, index) => {
        if (!item.days) item.days = [1,2,3,4,5,6,0]; 
        
        let efDur = item.effectDur !== undefined ? item.effectDur : 1;
        let efEase = item.effectEase || 'ease-in-out';
        let efAngle = item.effectAngle !== undefined ? item.effectAngle : -90;
        let efScale = item.effectScale !== undefined ? item.effectScale : 0.5;

        let extraSettingsHtml = '';
        if (item.effect && item.effect !== 'none' && item.effect !== 'fade') {
            let specificSettings = '';
            
            if (item.effect === 'rotate') {
                specificSettings = `
                    <div><span style="font-size:9px; color:#f472b6; display:block;">DÖNÜŞ AÇISI (Derece)</span>
                    <input type="number" value="${efAngle}" onchange="window.loadedPlaylist[${index}].effectAngle = parseInt(this.value); window.renderPlaylistItems();" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px;"></div>
                    <div><span style="font-size:9px; color:#f472b6; display:block;">BAŞLANGIÇ BOYUTU (0-2)</span>
                    <input type="number" step="0.1" value="${efScale}" onchange="window.loadedPlaylist[${index}].effectScale = parseFloat(this.value); window.renderPlaylistItems();" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px;"></div>
                `;
            } else if (['zoom', 'zoom-out', 'bounce'].includes(item.effect)) {
                specificSettings = `
                    <div style="grid-column: span 2;"><span style="font-size:9px; color:#f472b6; display:block;">BAŞLANGIÇ BOYUTU (0.1 - 2.0)</span>
                    <input type="number" step="0.1" value="${efScale}" onchange="window.loadedPlaylist[${index}].effectScale = parseFloat(this.value); window.renderPlaylistItems();" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px;"></div>
                `;
            } else if (['flip', 'flip-y'].includes(item.effect)) {
                specificSettings = `
                    <div style="grid-column: span 2;"><span style="font-size:9px; color:#f472b6; display:block;">DÖNÜŞ AÇISI (Derece)</span>
                    <input type="number" value="${efAngle}" onchange="window.loadedPlaylist[${index}].effectAngle = parseInt(this.value); window.renderPlaylistItems();" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px;"></div>
                `;
            }

            extraSettingsHtml = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; padding:10px; background:rgba(0,0,0,0.3); border:1px dashed #64748b; border-radius:6px;">
                    <div style="grid-column: span 2; font-size:10px; color:#e2e8f0; font-weight:bold; border-bottom:1px solid #334155; padding-bottom:4px; margin-bottom:4px;">
                        <i class="ph ph-magic-wand"></i> Gelişmiş Animasyon Ayarları
                    </div>
                    <div><span style="font-size:9px; color:#38bdf8; display:block;">SÜRE (Saniye)</span>
                    <input type="number" step="0.1" value="${efDur}" onchange="window.loadedPlaylist[${index}].effectDur = parseFloat(this.value); window.renderPlaylistItems();" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px;"></div>
                    
                    <div><span style="font-size:9px; color:#38bdf8; display:block;">AKICILIK TİPİ</span>
                    <select onchange="window.loadedPlaylist[${index}].effectEase = this.value; window.renderPlaylistItems();" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px;">
                        <option value="ease-in-out" ${efEase==='ease-in-out'?'selected':''}>Yumuşak</option>
                        <option value="linear" ${efEase==='linear'?'selected':''}>Sabit Hız</option>
                        <option value="cubic-bezier(0.68, -0.55, 0.265, 1.55)" ${efEase.includes('cubic')?'selected':''}>Yaylanarak</option>
                    </select></div>
                    ${specificSettings}
                </div>
            `;
        }

        let effectsHtml = effectOptions.map(e => `<option value="${e.val}" ${item.effect === e.val ? 'selected' : ''}>${e.name}</option>`).join('');

        let daysHtml = daysLabels.map(d => {
            const isActive = item.days.includes(d.num);
            return `<div onclick="window.toggleDayForPlaylist(${index}, ${d.num})" style="flex:1; text-align:center; padding:4px 0; font-size:10px; cursor:pointer; border-radius:4px; font-weight:bold; background:${isActive ? '#10b981' : '#1e293b'}; color:${isActive ? '#fff' : '#64748b'}; border:1px solid ${isActive ? '#10b981' : '#334155'}; transition:0.2s;" title="${d.name} Günü ${isActive ? 'Aktif' : 'Kapalı'}">${d.name}</div>`;
        }).join('');

        const card = document.createElement('div');
        card.style.cssText = 'background:#1e293b; border:1px solid #334155; border-radius:6px; padding:10px; position:relative;';
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:8px;">
                <b style="color:#f59e0b; font-size:13px;">${index + 1}. SAYFA: ${item.slide.replace(/_/g, ' ').toUpperCase()}</b>
                <button onclick="window.removePlaylistItem(${index})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:16px;"><i class="ph ph-trash"></i></button>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                <div>
                    <span style="font-size:9px; color:#94a3b8; display:block;">EKRANDA KALMA SÜRESİ (ms)</span>
                    <input type="number" value="${item.time}" onchange="window.loadedPlaylist[${index}].time = parseInt(this.value)" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px;">
                </div>
                <div>
                    <span style="font-size:9px; color:#94a3b8; display:block;">GEÇİŞ EFEKTİ TİPİ</span>
                    <select onchange="window.loadedPlaylist[${index}].effect = this.value; window.renderPlaylistItems();" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px;">
                        ${effectsHtml}
                    </select>
                </div>
            </div>

            ${extraSettingsHtml}

            <div style="margin-bottom:8px; border-top:1px dashed #334155; padding-top:8px;">
                <span style="font-size:9px; color:#38bdf8; display:block; margin-bottom:4px;">YAYIN GÜNLERİ (Kapatmak için tıklayın)</span>
                <div style="display:flex; gap:4px;">
                    ${daysHtml}
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                <div><span style="font-size:9px; color:#10b981; display:block;">BAŞLAMA TARİHİ</span>
                <input type="date" value="${item.startDate || ''}" onchange="window.loadedPlaylist[${index}].startDate = this.value" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px; color-scheme:dark;"></div>
                <div><span style="font-size:9px; color:#ef4444; display:block;">BİTİŞ TARİHİ</span>
                <input type="date" value="${item.endDate || ''}" onchange="window.loadedPlaylist[${index}].endDate = this.value" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px; color-scheme:dark;"></div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div><span style="font-size:9px; color:#94a3b8; display:block;">BAŞLAMA SAATİ</span>
                <input type="time" value="${item.startTime || '00:00'}" onchange="window.loadedPlaylist[${index}].startTime = this.value" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px; color-scheme:dark;"></div>
                <div><span style="font-size:9px; color:#94a3b8; display:block;">BİTİŞ SAATİ</span>
                <input type="time" value="${item.endTime || '23:59'}" onchange="window.loadedPlaylist[${index}].endTime = this.value" style="width:100%; background:#0f172a; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:11px; color-scheme:dark;"></div>
            </div>
        `;
        listContainer.appendChild(card);
    });
};

window.savePlaylistToFirebase = async function() {
    const target = window.currentPlaylistTarget;
    if(!target) return;
    await set(ref(db, 'sahne/oynatma_listeleri/' + target), window.loadedPlaylist);
    if(window.showToast) window.showToast(target + " için Oynatma Listesi Kaydedildi!", "success");
};

// --- GELİŞMİŞ CİHAZ KONTROL MERKEZİ ---
// --- GELİŞMİŞ CİHAZ KONTROL MERKEZİ ---
window.updateDeviceDashboard = function() {
    const listContainer = document.getElementById('device-list');
    if(!listContainer) return; 
    
    listContainer.innerHTML = '';
    const now = Date.now();
    
    const cihazlarObj = window.aktifHedefler.cihazlar || {};
    const deviceIds = Object.keys(cihazlarObj);
    
    // Eğer hiç cihaz yoksa
    if (deviceIds.length === 0) {
        listContainer.innerHTML = '<div style="font-size:12px; color:#64748b; text-align:center; padding:15px;"><i class="ph ph-plugs" style="font-size:24px; display:block; margin-bottom:5px; opacity:0.5;"></i>Yayına bağlı cihaz yok.</div>';
        return;
    }

    // 1. Orijinal nesneyi diziye (Array) çeviriyoruz ki sıralayabilelim
    let deviceArray = [];
    deviceIds.forEach(id => {
        deviceArray.push({ id: id, ...cihazlarObj[id] });
    });

    // 2. 🚀 AKILLI SIRALAMA (Aktif olanlar en üste, pasifler alta)
    deviceArray.sort((a, b) => {
        // Cihaz 20 saniyeden (20000ms) yakın zamanda sinyal verdiyse aktiftir
        const aIsOnline = !(!a.lastSeen || (now - a.lastSeen > 20000));
        const bIsOnline = !(!b.lastSeen || (now - b.lastSeen > 20000));
        
        if (aIsOnline && !bIsOnline) return -1; // A aktif, B koptuysa A üste
        if (!aIsOnline && bIsOnline) return 1;  // B aktif, A koptuysa B üste
        
        // İkisi de aynı durumdaysa isimlerine göre alfabetik diz
        const nameA = (a.name || a.id).toUpperCase();
        const nameB = (b.name || b.id).toUpperCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });

    // 3. Sıralanmış listeyi SENİN ORİJİNAL TASARIMIN VE BUTONLARINLA ekrana bas
    deviceArray.forEach(c => {
        const id = c.id;
        const isOffline = !c.lastSeen || (now - c.lastSeen > 20000); 
        const statusColor = isOffline ? '#ef4444' : '#10b981';
        const statusText = isOffline ? 'KOPTU' : 'YAYINDA';
        const currentPlaying = c.playing || 'Bekleniyor...';

        const card = document.createElement('div');
        card.className = 'device-card';
        card.style.cssText = `background:#0f172a; border:1px solid #1e293b; border-left:4px solid ${statusColor}; border-radius:8px; padding:12px; font-size:12px; margin-bottom:10px; transition:0.3s;`;
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="color:#f8fafc; font-size:14px;"><i class="ph ph-monitor-play" style="color:${statusColor};"></i> ${c.name || id}</strong>
                <span style="background:${statusColor}20; color:${statusColor}; padding:3px 8px; border-radius:4px; font-weight:bold;">${statusText}</span>
            </div>
            <div style="color:#94a3b8; margin-bottom:4px;"><i class="ph ph-buildings"></i> Grup: <b style="color:#38bdf8;">${c.group || 'GENEL'}</b></div>
            <div style="color:#94a3b8; margin-bottom:12px;"><i class="ph ph-film-strip"></i> Oynatılan: <b style="color:#f59e0b;">${currentPlaying}</b></div>
            
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button onclick="window.cmdDevice('${id}', 'ping')" style="flex:1; background:rgba(59,130,246,0.1); color:#3b82f6; border:1px solid #3b82f6; border-radius:4px; padding:4px; cursor:pointer; font-weight:bold;"><i class="ph ph-map-pin"></i> Bul</button>
                <button onclick="window.cmdDevice('${id}', 'refresh')" style="flex:1; background:rgba(100,116,139,0.1); color:#94a3b8; border:1px solid #64748b; border-radius:4px; padding:4px; cursor:pointer; font-weight:bold;"><i class="ph ph-arrows-clockwise"></i> F5</button>
                <button onclick="window.renameDevice('${id}', '${c.name || id}')" style="flex:1; background:rgba(14,165,233,0.1); color:#0ea5e9; border:1px solid #0ea5e9; border-radius:4px; padding:4px; cursor:pointer; font-weight:bold;"><i class="ph ph-pencil-simple"></i> İsim</button>
                <button onclick="window.changeDeviceGroup('${id}', '${c.group || 'GENEL'}')" style="flex:1; background:rgba(139,92,246,0.1); color:#8b5cf6; border:1px solid #8b5cf6; border-radius:4px; padding:4px; cursor:pointer; font-weight:bold;"><i class="ph ph-users"></i> Grup</button>
            </div>
        `;
        listContainer.appendChild(card);
    });
};

window.cmdDevice = async function(id, cmdType) {
    await set(ref(db, 'sahne/komutlar/' + id), { type: cmdType, ts: Date.now() });
    if(window.showToast) window.showToast("Komut TV'ye fırlatıldı!", "success");
};

window.renameDevice = async function(id, currentName) {
    const newName = prompt("Cihazın yeni adını girin (Örn: MERKEZ GİRİŞ):", currentName);
    if(newName && newName.trim() !== "") {
        await set(ref(db, 'sahne/komutlar/' + id), { type: 'rename', newName: newName.trim().toUpperCase(), ts: Date.now() });
        if(window.showToast) window.showToast("İsim değiştirildi, TV güncelleniyor...", "success");
    }
};

window.changeDeviceGroup = async function(id, currentGroup) {
    const newGroup = prompt("Cihazı hangi Şubeye/Gruba atamak istiyorsunuz?\n(Örn: KADIKÖY ŞUBE veya GENEL)", currentGroup);
    if(newGroup && newGroup.trim() !== "") {
        await set(ref(db, 'sahne/komutlar/' + id), { type: 'changeGroup', newGroup: newGroup.trim().toUpperCase(), ts: Date.now() });
        if(window.showToast) window.showToast("Grup değiştirildi, TV kendini yeniden başlatıyor...", "success");
    }
};
