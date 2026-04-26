import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ⚠️ DİKKAT: KENDİ FIREBASE BİLGİLERİNİ BURAYA YAPIŞTIRMAYI UNUTMA
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

// Her TV ekranı için rastgele bir ID oluştur
const deviceId = "TV_" + Math.floor(Math.random() * 10000); 

// Çevrimdışı durumlar için verileri LocalStorage'dan oku
let slidesData = JSON.parse(localStorage.getItem('slidesData')) || {};
let settingsData = JSON.parse(localStorage.getItem('settingsData')) || {};
let rssCache = { url: "", data: "🔴 Haberler Bekleniyor...", time: 0 };

let slideKeys = [];
let currentIndex = 0;
let rotationTimer = null;
const container = document.getElementById('viewer-container');

// 📡 HEARTBEAT (CİHAZ TAKİBİ)
// Her 10 saniyede bir Editör'e "Ben yayındayım ve çalışıyorum" sinyali yollar
setInterval(() => {
    set(ref(db, 'sahne/cihazlar/' + deviceId), {
        lastSeen: Date.now(),
        version: "V49-CMS"
    }).catch(e => console.log("Çevrimdışı: Sinyal gönderilemedi."));
}, 10000);

// 🗞️ CANLI RSS HABER ÇEKİCİ (CORS Korumasını Aşar)
async function fetchRssData(url) {
    if(!url) return "🔴 Geçerli bir haber linki girilmedi.";
    const now = Date.now();
    
    // API'yi yormamak için haberleri 5 dakikada bir yeniler
    if(rssCache.url === url && (now - rssCache.time < 300000)) {
        return rssCache.data;
    }
    
    try {
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if(data.items && data.items.length > 0) {
            const newsString = data.items.map(i => "🔴 " + i.title).join("  |  ");
            // Kayan animasyonda boşluk olmaması için metni iki kez yazdırıyoruz
            const finalString = newsString + "  |  " + newsString;
            rssCache = { url: url, data: finalString, time: now };
            return finalString;
        }
    } catch(e) { console.log("RSS Çekilemedi:", e); }
    
    return "🔴 Haber kaynağına ulaşılamıyor...";
}

// ⏳ RSS EKRAN GÜNCELLEYİCİ (Aktif katmandaki bantları günceller)
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

// 🧠 AKILLI ZAMANLAMA KONTROLÜ (GÜN VE SAAT)
function isSlideVisible(key) {
    const s = settingsData[key];
    if(!s) return true; // Ayar yoksa varsayılan olarak göster
    
    const now = new Date();
    const currentDay = now.getDay(); // 0: Pazar, 1: Pazartesi ...
    const currentTime = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');

    // 1. Gün testi
    if(s.days && s.days.length > 0 && !s.days.includes(currentDay)) {
        return false;
    }
    
    // 2. Saat testi
    if(s.startTime && s.endTime) {
        if(currentTime < s.startTime || currentTime > s.endTime) {
            return false;
        }
    }
    
    return true; // Geçerliyse göster
}

// 🎨 AYARLARI DİNLE VE HAFIZAYA KAYDET
onValue(ref(db, 'sahne/ayarlar'), (snapshot) => {
    if (snapshot.exists()) {
        settingsData = snapshot.val();
        localStorage.setItem('settingsData', JSON.stringify(settingsData));
    }
});

// 🖼️ SLAYTLARI DİNLE VE KATMANLARI OLUŞTUR (CMS MANTIĞI)
onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
    if (snapshot.exists()) {
        slidesData = snapshot.val();
        localStorage.setItem('slidesData', JSON.stringify(slidesData));
        buildLayers(); // Katmanları çiz
    } else {
        container.innerHTML = "<h1 style='color:white; text-align:center;'>Yayın Bekleniyor veya Slayt Yok...</h1>";
    }
});

// 🏗️ KATMAN (LAYER) İNŞA MOTORU
function buildLayers() {
    container.innerHTML = ""; // Ekranı temizle
    slideKeys = Object.keys(slidesData); // Slaytların anahtarlarını al (Dinamik CMS Listesi)
    
    slideKeys.forEach(key => {
        const div = document.createElement('div');
        div.className = 'slide-layer'; // Hepsi opacity: 0 olarak arkada bekliyor
        div.id = 'layer-' + key;
        div.innerHTML = slidesData[key];
        container.appendChild(div);
    });
    
    if(!rotationTimer && slideKeys.length > 0) {
        showSlide(0); // Çizim bittikten sonra ilk slaytı oynat
    }
}

// 🎬 GÖSTERİM (YAYIN DÖNGÜSÜ) MOTORU
function showSlide(index) {
    if (slideKeys.length === 0) return;
    
    let actualIndex = index % slideKeys.length;
    let currentKey = slideKeys[actualIndex];

    // 🌟 Zamanı gelmeyen slaytları atla
    if(!isSlideVisible(currentKey)) {
        setTimeout(() => { showSlide(actualIndex + 1); }, 100);
        return;
    }

    currentIndex = actualIndex;
    const config = settingsData[currentKey] || { effect: 'fade', time: 5000 };

    // Bütün katmanları kapat
    document.querySelectorAll('.slide-layer').forEach(layer => {
        layer.classList.remove('active');
    });
    
    // Hedef katmanı bul, efektini ata ve aktif et
    const targetLayer = document.getElementById('layer-' + currentKey);
    if(targetLayer) {
        targetLayer.className = `slide-layer ${config.effect || 'fade'}`;
        void targetLayer.offsetWidth; // Reflow: Efektlerin düzgün çalışmasını zorlar
        targetLayer.classList.add('active'); // Oynat!
    }

    updateClock(); // Saati tazele

    // Döngüyü sürdür
    clearTimeout(rotationTimer);
    rotationTimer = setTimeout(() => {
        showSlide(currentIndex + 1);
    }, config.time || 5000);
}

// ⌚ CANLI SAAT MOTORU
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

// 🖼️ İÇ RESİM (MİNİ SLAYT) MOTORU
function startInnerSliders() {
    setInterval(() => {
        // Cihazı yormamak için sadece aktif olan katmanın içindeki resimleri çeviriyoruz
        const activeLayer = document.querySelector('.slide-layer.active');
        if(!activeLayer) return;
        
        const images = activeLayer.querySelectorAll('image[data-image-list]');
        images.forEach(img => {
            const list = img.getAttribute('data-image-list'); if(!list) return;
            const urls = list.split(',').map(s => s.trim()).filter(s => s !== "");
            if(urls.length < 2) return; 
            
            let idx = parseInt(img.getAttribute('data-slider-idx') || '0');
            idx = (idx + 1) % urls.length;
            img.setAttribute('data-slider-idx', idx);
            
            const newUrl = urls[idx];
            
            // Crossfade efekti için resmi klonla, üstüne bindir ve eskisini sil
            const clone = img.cloneNode(true);
            clone.removeAttribute('data-image-list'); clone.id = 'clone_' + Date.now();
            clone.style.transition = "opacity 0.8s ease-in-out"; clone.style.opacity = 1;
            
            img.setAttribute('href', newUrl);
            img.parentNode.insertBefore(clone, img.nextSibling);
            
            requestAnimationFrame(() => { requestAnimationFrame(() => { clone.style.opacity = 0; }); });
            setTimeout(() => { clone.remove(); }, 800);
        });
    }, 3000); 
}
startInnerSliders();

// Sistem ilk açıldığında internet kopuksa bile lokal hafızadaki (Cache) eski yayın akışını başlatır
if(Object.keys(slidesData).length > 0) {
    buildLayers();
}
