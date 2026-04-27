import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ⚠️ DİKKAT: KENDİ FIREBASE BİLGİLERİNİ BURAYA YAPIŞTIR
const firebaseConfig = {
    apiKey: "AIzaSyCFBrHqXdRVdbtaqyKCQAgJ4U8no9cDIF8",
    authDomain: "svg-pro-studio.firebaseapp.com",
    databaseURL: "https://svg-pro-studio-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "svg-pro-studio",
    storageBucket: "svg-pro-studio.firebasestorage.app",
    messagingSenderId: "1085012043931",
    appId: "1:1085012043931:web:fb6f9fb2e79f4a2607fe3e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const deviceId = "TV_" + Math.floor(Math.random() * 10000); 

let slidesData = JSON.parse(localStorage.getItem('slidesData')) || {};
let settingsData = JSON.parse(localStorage.getItem('settingsData')) || {};
let rssCache = { url: "", data: "🔴 Haberler Bekleniyor...", time: 0 };

let slideKeys = Object.keys(slidesData).sort();
let currentIndex = -1;
let rotationTimer = null;
let isFirstLoad = true;

const container = document.getElementById('viewer-container');

// 📡 HEARTBEAT (CİHAZ TAKİP VE CANLI MONİTÖR)
setInterval(() => {
    const currentPlaying = slideKeys[currentIndex] || "Bekleniyor...";
    set(ref(db, 'sahne/cihazlar/' + deviceId), {
        lastSeen: Date.now(),
        version: "V49-PRO-VIDEO",
        playing: currentPlaying.replace(/_/g, ' ').toUpperCase()
    }).catch(e => console.log("Sinyal gönderilemedi."));
}, 5000);

// 🗞️ RSS API ÇEKİCİ
async function fetchRssData(url) {
    if(!url) return "🔴 Geçerli bir haber linki girilmedi.";
    const now = Date.now();
    if(rssCache.url === url && (now - rssCache.time < 300000)) {
        return rssCache.data;
    }
    try {
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if(data.items && data.items.length > 0) {
            const newsString = data.items.map(i => "🔴 " + i.title).join("  |  ");
            const finalString = newsString + "  |  " + newsString;
            rssCache = { url: url, data: finalString, time: now };
            return finalString;
        }
    } catch(e) { }
    return "🔴 Haberler yüklenemedi...";
}

// ⏳ RSS EKRAN GÜNCELLEYİCİ
setInterval(async () => {
    const activeLayer = document.querySelector('.slide-layer.active');
    if(!activeLayer) return;
    
    const rssBands = activeLayer.querySelectorAll('.rss-band');
    for(let band of rssBands) {
        const url = band.getAttribute('data-rss-url');
        const text = await fetchRssData(url);
        const scroller = band.querySelector('.rss-scroller');
        if(scroller && scroller.innerText !== text) {
            scroller.innerText = text;
        }
    }
}, 2000);

// 🧠 AKILLI ZAMANLAMA KONTROLÜ
function isSlideVisible(key) {
    const s = settingsData[key];
    if(!s) return true; 
    
    const now = new Date();
    const currentDay = now.getDay(); 
    const currentTime = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');

    if(s.days && s.days.length > 0 && !s.days.includes(currentDay)) return false;
    if(s.startTime && s.endTime) {
        if(currentTime < s.startTime || currentTime > s.endTime) return false;
    }
    return true; 
}

// 🎨 AYARLARI DİNLE
onValue(ref(db, 'sahne/ayarlar'), (snapshot) => {
    if (snapshot.exists()) {
        settingsData = snapshot.val();
        localStorage.setItem('settingsData', JSON.stringify(settingsData));
    }
});

// 🖼️ SLAYTLARI DİNLE (AKILLI DİFERANSİYEL GÜNCELLEME)
onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
    if (snapshot.exists()) {
        const newData = snapshot.val();
        localStorage.setItem('slidesData', JSON.stringify(newData));
        updateLayersDifferential(newData);
    } else if (Object.keys(slidesData).length === 0 && isFirstLoad) {
        container.innerHTML = "<h1 style='color:white; text-align:center;'>Yayın Bekleniyor...</h1>";
    }
});

// 🚀 V49 YAYINI KESMEYEN GÜNCELLEME MOTORU
function updateLayersDifferential(newData) {
    const newKeys = Object.keys(newData).sort(); 
    
    slideKeys.forEach(key => {
        if (!newData[key]) {
            const el = document.getElementById('layer-' + key);
            if (el) el.remove();
        }
    });

    newKeys.forEach(key => {
        let layer = document.getElementById('layer-' + key);
        let isNewLayer = false;
        
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'slide-layer fade'; 
            layer.id = 'layer-' + key;
            container.appendChild(layer);
            isNewLayer = true; 
        }

        if (isNewLayer || slidesData[key] !== newData[key]) {
            layer.innerHTML = newData[key];
            // Yeni veri basıldığında arka plandaki videoyu hemen durdur ki ses yapmasın
            if(!layer.classList.contains('active')) {
                layer.querySelectorAll('video').forEach(v => { v.pause(); v.currentTime = 0; });
            }
        }
    });

    slidesData = newData;
    slideKeys = newKeys;

    if (isFirstLoad && slideKeys.length > 0) {
        isFirstLoad = false;
        showNextSlide();
    }
}

if(Object.keys(slidesData).length > 0) {
    updateLayersDifferential(slidesData);
}

// 🎬 KESİNTİSİZ YAYIN MOTORU VE VİDEO YÖNETİCİSİ
function showNextSlide() {
    if (slideKeys.length === 0) {
        rotationTimer = setTimeout(showNextSlide, 2000);
        return;
    }

    let attempts = 0;
    let nextIndex = (currentIndex + 1) % slideKeys.length;

    while (attempts < slideKeys.length) {
        const key = slideKeys[nextIndex];
        if (isSlideVisible(key)) {
            currentIndex = nextIndex;
            applySlide(key);
            return;
        }
        nextIndex = (nextIndex + 1) % slideKeys.length;
        attempts++;
    }

    rotationTimer = setTimeout(showNextSlide, 3000);
}

function applySlide(key) {
    const config = settingsData[key] || { effect: 'fade', time: 5000 };

    // 1. Önce tüm katmanları gizle ve tüm VİDEOLARI DURDUR
    document.querySelectorAll('.slide-layer').forEach(layer => {
        layer.classList.remove('active');
        layer.querySelectorAll('video').forEach(v => {
            v.pause();
            v.currentTime = 0;
        });
    });
    
    // 2. Yeni katmanı göster ve İÇİNDEKİ VİDEOLARI BAŞLAT
    const targetLayer = document.getElementById('layer-' + key);
    if(targetLayer) {
        targetLayer.className = `slide-layer ${config.effect || 'fade'}`;
        void targetLayer.offsetWidth; 
        targetLayer.classList.add('active'); 
        
        targetLayer.querySelectorAll('video').forEach(v => {
            // Tarayıcı otomatik oynatma kurallarına takılmamak için catch ekliyoruz
            v.play().catch(e => console.log("Video oynatılamadı. Lütfen sessiz (muted) modda olduğundan emin olun.", e));
        });
    }

    updateClock(); 

    clearTimeout(rotationTimer);
    rotationTimer = setTimeout(showNextSlide, config.time || 5000);
}

// ⌚ CANLI SAAT
function updateClock() {
    const dateText = document.getElementById("dateText");
    const timeText = document.getElementById("timeText");
    if (!dateText && !timeText) return;
    
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const date = now.toLocaleDateString('tr-TR');
    
    if (dateText) dateText.textContent = date;
    if (timeText) timeText.textContent = hours + ":" + minutes + ":" + seconds;
}
setInterval(updateClock, 1000);

// 🖼️ İÇ RESİM MOTORU (Slider)
function startInnerSliders() {
    setInterval(() => {
        const activeLayer = document.querySelector('.slide-layer.active');
        if(!activeLayer) return;
        
        const images = activeLayer.querySelectorAll('image[data-image-list]');
        images.forEach(img => {
            const list = img.getAttribute('data-image-list'); 
            if(!list) return;
            
            const urls = list.split(',').map(s => s.trim()).filter(s => s !== "");
            if(urls.length < 2) return; 
            
            let idx = parseInt(img.getAttribute('data-slider-idx') || '0');
            idx = (idx + 1) % urls.length;
            img.setAttribute('data-slider-idx', idx);
            
            const newUrl = urls[idx];
            const clone = img.cloneNode(true);
            clone.removeAttribute('data-image-list'); 
            clone.id = 'clone_' + Date.now();
            clone.style.transition = "opacity 0.8s ease-in-out"; 
            clone.style.opacity = 1;
            
            img.setAttribute('href', newUrl);
            img.parentNode.insertBefore(clone, img.nextSibling);
            
            requestAnimationFrame(() => { 
                requestAnimationFrame(() => { clone.style.opacity = 0; }); 
            });
            setTimeout(() => { clone.remove(); }, 800);
        });
    }, 3000); 
}
startInnerSliders();