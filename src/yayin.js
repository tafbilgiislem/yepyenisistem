import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const deviceId = "TV_" + Math.floor(1000 + Math.random() * 9000); 

// STATE (DURUM) YÖNETİMİ
let slidesData = {};
let settingsData = {};
let slideKeys = [];
let currentIndex = -1;
let rotationTimer = null;
let isFirstLoad = true;

const container = document.getElementById('viewer-container');

// 📡 CANLI MONİTÖR (HEARTBEAT) - "Şu an ne oynuyor?" bilgisini ekledik
setInterval(() => {
    const currentPlaying = slideKeys[currentIndex] || "Bekleniyor...";
    set(ref(db, 'sahne/cihazlar/' + deviceId), {
        lastSeen: Date.now(),
        playing: currentPlaying,
        version: "V49-CORE"
    }).catch(() => {});
}, 5000);

// 🧠 AKILLI VERİ DİNLEYİCİ
// Ayarları al
onValue(ref(db, 'sahne/ayarlar'), (snapshot) => {
    if (snapshot.exists()) {
        settingsData = snapshot.val();
    }
});

// Slaytları al (DURAKSATMADAN GÜNCELLE)
onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
    if (snapshot.exists()) {
        const newData = snapshot.val();
        updateSlidesDifferential(newData);
    }
});

// 🔄 DİFERANSİYEL GÜNCELLEME (YAYINI KESMEYEN MOTOR)
function updateSlidesDifferential(newData) {
    const newKeys = Object.keys(newData).sort(); // Alfabetik sıralama ile kararlılık sağla
    
    // 1. Silinen slaytları DOM'dan kaldır
    slideKeys.forEach(key => {
        if (!newData[key]) {
            const el = document.getElementById('layer-' + key);
            if (el) el.remove();
        }
    });

    // 2. Yeni veya değişen slaytları ekle/güncelle
    newKeys.forEach(key => {
        let layer = document.getElementById('layer-' + key);
        
        if (!layer) {
            // Yeni slayt katmanı oluştur
            layer = document.createElement('div');
            layer.id = 'layer-' + key;
            layer.className = 'slide-layer fade'; // Varsayılan gizli başla
            container.appendChild(layer);
        }

        // İçerik değişmişse sadece SVG'yi güncelle (Donmayı engeller)
        if (slidesData[key] !== newData[key]) {
            layer.innerHTML = newData[key];
        }
    });

    slidesData = newData;
    slideKeys = newKeys;

    // İlk açılışta yayını başlat
    if (isFirstLoad && slideKeys.length > 0) {
        isFirstLoad = false;
        nextSlide();
    }
}

// 🎬 KESİNTİSİZ YAYIN DÖNGÜSÜ
function nextSlide() {
    if (slideKeys.length === 0) {
        rotationTimer = setTimeout(nextSlide, 1000);
        return;
    }

    // Bir sonraki geçerli slaytı bul (Zamanlama kontrolü ile)
    let attempts = 0;
    let nextIdx = (currentIndex + 1) % slideKeys.length;

    while (attempts < slideKeys.length) {
        const key = slideKeys[nextIdx];
        if (checkSchedule(key)) {
            currentIndex = nextIdx;
            applySlideTransition(key);
            return;
        }
        nextIdx = (nextIdx + 1) % slideKeys.length;
        attempts++;
    }

    // Hiçbir slayt yayın saatinde değilse
    rotationTimer = setTimeout(nextSlide, 2000);
}

function applySlideTransition(key) {
    const config = settingsData[key] || { effect: 'fade', time: 5000 };
    
    // Tüm katmanları pasifleştir
    document.querySelectorAll('.slide-layer').forEach(l => {
        l.classList.remove('active');
    });

    // Hedef katmanı aktif et
    const target = document.getElementById('layer-' + key);
    if (target) {
        // Efekti uygula
        target.className = `slide-layer ${config.effect || 'fade'} active`;
        
        // Varsa RSS ve Saatleri başlat
        initializePlugins(target);
    }

    // Bir sonraki slayt için zamanlayıcı
    clearTimeout(rotationTimer);
    rotationTimer = setTimeout(nextSlide, config.time || 5000);
}

// ⏳ ZAMANLAMA KONTROLÜ
function checkSchedule(key) {
    const s = settingsData[key];
    if (!s) return true;

    const now = new Date();
    const day = now.getDay(); // 0: Pazar, 1: Pzt...
    const time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

    if (s.days && s.days.length > 0 && !s.days.includes(day)) return false;
    if (s.startTime && s.endTime) {
        if (time < s.startTime || time > s.endTime) return false;
    }
    return true;
}

// 🛠️ PLUGINS (RSS, SAAT, SLIDER)
async function initializePlugins(parent) {
    // 1. Saat Güncelleme
    const timeText = parent.querySelector('[id*="timeText"]');
    const dateText = parent.querySelector('[id*="dateText"]');
    if (timeText || dateText) {
        const update = () => {
            const d = new Date();
            if (timeText) timeText.textContent = d.toLocaleTimeString('tr-TR');
            if (dateText) dateText.textContent = d.toLocaleDateString('tr-TR');
        };
        update();
    }

    // 2. RSS Kontrol (Hafıza dostu)
    const rssBands = parent.querySelectorAll('.rss-band');
    rssBands.forEach(async band => {
        const url = band.getAttribute('data-rss-url');
        if (url) {
            const news = await fetchRSS(url);
            const scroller = band.querySelector('.rss-scroller');
            if (scroller) scroller.textContent = news;
        }
    });
}

// RSS Çekici (Cachli)
let rssCache = {};
async function fetchRSS(url) {
    if (rssCache[url] && (Date.now() - rssCache[url].time < 600000)) return rssCache[url].data;
    try {
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
        const json = await res.json();
        const str = json.items.map(i => " 🔴 " + i.title).join(" | ");
        rssCache[url] = { data: str + " | " + str, time: Date.now() };
        return rssCache[url].data;
    } catch { return "Haberler yüklenemedi..."; }
}