// Firebase modülünü içeri aktarıyoruz (Import)
import { db, ref, set, get, onValue, remove } from "./firebase.js";

// --- GİRİŞ VE SİSTEM ARAÇLARI ---
window.checkPin = function() {
    const pin = document.getElementById('pin-input').value;
    if(pin === '1234') { 
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.filter = 'blur(0px)';
        window.showToast("Giriş Başarılı!", "success");
    } else {
        window.showToast("Hatalı Şifre!", "error");
        document.getElementById('pin-input').value = "";
    }
};

window.showToast = function(msg, type = 'success') {
    const container = document.getElementById('toast-container'); if(!container) return;
    const toast = document.createElement('div'); toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
    toast.innerHTML = `<i class="ph ${icon}"></i> <span>${msg}</span>`; container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(120%)'; setTimeout(() => toast.remove(), 300); }, 3000);
};

// --- GLOBAL DEĞİŞKENLER ---
window.selectedEl = null; window.activeTabId = 'tab-layout'; 
window.currentZoom = 1; window.panX = 0; window.panY = 0; window.historyStack = []; window.historyIndex = -1; 
window.isModified = false; window.clipboard = null;

// --- FIREBASE VERİ SENKRONİZASYONU ---
if(db) {
    onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
        const selector = document.getElementById('file-selector'); if(!selector) return;
        const current = selector.value; selector.innerHTML = "";
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(key => {
                const opt = document.createElement('option'); opt.value = key; opt.textContent = key.replace(/_/g, ' ').toUpperCase(); selector.appendChild(opt);
            });
            if (current && data[current]) { selector.value = current; } 
            else if (!current && Object.keys(data).length > 0) { selector.value = Object.keys(data)[0]; window.loadSlide(); }
        }
    });
}

window.addNewSlide = async function() {
    const name = prompt("Yeni Slayt İsmi (Örn: sabah_kampanyasi):"); if (!name) return;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const defaultSvg = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"><rect id="canvas-background" x="0" y="0" width="1920" height="1080" fill="#020617"></rect></svg>`;
    await set(ref(db, 'sahne/slaytlar/' + key), defaultSvg);
    await set(ref(db, 'sahne/ayarlar/' + key), { time: 5000, effect: 'fade' });
    window.showToast("Yeni Slayt Oluşturuldu!"); document.getElementById('file-selector').value = key; window.loadSlide();
};

window.deleteSlide = async function() {
    const key = document.getElementById('file-selector').value; if (!key) return;
    if (confirm(key.replace(/_/g, ' ').toUpperCase() + " adlı slayt tamamen silinecek, emin misiniz?")) {
        await remove(ref(db, 'sahne/slaytlar/' + key)); await remove(ref(db, 'sahne/ayarlar/' + key));
        window.showToast("Slayt Silindi", "error");
        document.getElementById('canvas-inner').innerHTML = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg"><rect id="canvas-background" x="0" y="0" width="1920" height="1080" fill="#020617"></rect></svg>`;
        setTimeout(() => window.loadSlide(), 500); 
    }
};

window.loadSlide = async function() {
    window.showToast("Slayt Yükleniyor...", "success");
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
        setTimeout(() => { if(window.setupLayers) window.setupLayers(); if(window.initCanvasSettings) window.initCanvasSettings(); if(window.resetZoom) window.resetZoom(); window.saveState(); }, 200);
    } catch(e) { window.showToast("Veritabanı Hatası!", "error"); }
};

window.syncToFirebase = function() {
    if(!db) return; const file = document.getElementById('file-selector')?.value; if(!file) return; const svg = document.querySelector('#canvas-inner svg'); if (!svg) return;
    const ctrl = document.getElementById('control-layer'); 
    if(ctrl) { const ctrlHTML = ctrl.innerHTML; ctrl.innerHTML = ""; const tamSvgKodu = svg.outerHTML; ctrl.innerHTML = ctrlHTML; set(ref(db, 'sahne/slaytlar/' + file), tamSvgKodu).catch(e => console.error(e)); }
    const st = document.getElementById('status-time'); const now = new Date(); if(st) st.innerText = `Son Kayıt: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`; 
};

window.saveData = function() { window.syncToFirebase(); window.showToast("Tasarım Yayına Gönderildi!"); };

window.saveSlideSettings = function() {
    if(!db) return; const file = document.getElementById('file-selector')?.value; if(!file) return;
    const time = document.getElementById('slide-time')?.value || 5000; const effect = document.getElementById('slide-effect')?.value || 'fade'; const startTime = document.getElementById('start-time')?.value || '00:00'; const endTime = document.getElementById('end-time')?.value || '23:59'; const activeDays = Array.from(document.querySelectorAll('.day-btn.active')).map(b => parseInt(b.dataset.day));
    set(ref(db, 'sahne/ayarlar/' + file), { time: parseInt(time), effect: effect, startTime: startTime, endTime: endTime, days: activeDays });
    window.showToast("Ayarlar Kaydedildi!");
};

// Cihaz dinleme
window.listenDevices = function() {
    if(!db) return;
    onValue(ref(db, 'sahne/cihazlar'), (snapshot) => {
        const list = document.getElementById('device-list'); if(!list) return; list.innerHTML = "";
        if(snapshot.exists()) {
            const devices = snapshot.val(); const now = Date.now();
            Object.keys(devices).forEach(id => {
                const dev = devices[id]; const isOnline = (now - dev.lastSeen) < 15000;
                const card = document.createElement('div'); card.className = `device-card ${isOnline ? 'online' : 'offline'}`;
                card.innerHTML = `<div style="display:flex;justify-content:space-between;"><strong>📺 ${id}</strong><span>${isOnline ? '🟢 Çevrimiçi' : '🔴 Koptu'}</span></div><div style="color:#94a3b8;margin-top:4px;">Sürüm: ${dev.version || 'Bilinmiyor'} | Oynatılan: ${dev.playing || 'Yok'}</div>`;
                list.appendChild(card);
            });
        } else { list.innerHTML = '<div style="font-size:11px;color:#64748b;text-align:center;padding:10px;">Cihazlar bekleniyor...</div>'; }
    });
};

window.onload = function() { window.listenDevices(); }