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

// Televizyona rastgele bir ID atayalım (Cihaz takibi için)
const deviceId = "TV_" + Math.floor(Math.random() * 10000); 

// 🚀 ÇEVRİMDIŞI (OFFLINE) DESTEĞİ İÇİN VERİLERİ LOCALSTORAGE'DAN OKU
let slidesData = JSON.parse(localStorage.getItem('slidesData')) || {};
let settingsData = JSON.parse(localStorage.getItem('settingsData')) || {};

let slideKeys = [];
let currentIndex = 0;
let rotationTimer = null;
const container = document.getElementById('viewer-container');

// 📡 HEARTBEAT (CİHAZ TAKİP SİNYALİ)
// Her 10 saniyede bir Editör'e "Ben çalışıyorum" diye sinyal gönderir
setInterval(() => {
    set(ref(db, 'sahne/cihazlar/' + deviceId), {
        lastSeen: Date.now(),
        version: "V48-PRO"
    }).catch(e => console.log("Çevrimdışı: Sinyal gönderilemedi."));
}, 10000);

// 🗞️ CANLI RSS HABER MOTORU (CORS engeline takılmamak için rss2json proxy kullanıldı)
onValue(ref(db, 'sahne/rss'), (snapshot) => {
    const marquee = document.getElementById('news-marquee');
    if(snapshot.exists() && snapshot.val().url) {
        const rssUrl = snapshot.val().url;
        fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`)
        .then(res => res.json())
        .then(data => {
            if(data.items && data.items.length > 0) {
                // Haberleri aralarına ayraç koyarak tek bir uzun metin yap
                const newsString = data.items.map(i => "🔴 " + i.title).join("  |  ");
                // Akıcılık için metni iki kez yan yana yazdır
                document.getElementById('news-text').innerText = newsString + "  |  " + newsString;
                marquee.style.display = 'flex'; // Bandı görünür yap
            }
        }).catch(e => console.log("Haberler çekilemedi."));
    } else {
        marquee.style.display = 'none'; // Link yoksa bandı gizle
    }
});

// 🧠 AKILLI ZAMANLAMA KONTROLÜ (DAYPARTING)
// Bu fonksiyon "Bu slayt şu anki gün ve saate uygun mu?" diye kontrol eder
function isSlideVisible(key) {
    const s = settingsData[key];
    if(!s) return true; // Ayar yoksa her zaman göster
    
    const now = new Date();
    const currentDay = now.getDay(); // 0: Pazar, 1: Pazartesi ... 6: Cumartesi
    const currentTime = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');

    // 1. Gün Kontrolü
    if(s.days && s.days.length > 0 && !s.days.includes(currentDay)) {
        return false;
    }
    
    // 2. Saat Kontrolü
    if(s.startTime && s.endTime) {
        if(currentTime < s.startTime || currentTime > s.endTime) {
            return false;
        }
    }
    
    return true; // Testleri geçtiyse gösterime uygundur
}

// 🎨 AYARLARI DİNLE VE HAFIZAYA YAZ
onValue(ref(db, 'sahne/ayarlar'), (snapshot) => {
    if (snapshot.exists()) {
        settingsData = snapshot.val();
        localStorage.setItem('settingsData', JSON.stringify(settingsData));
    }
});

// 🖼️ SLAYTLARI DİNLE, HAFIZAYA YAZ VE KATMANLARI OLUŞTUR (PRE-RENDER)
onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
    if (snapshot.exists()) {
        slidesData = snapshot.val();
        localStorage.setItem('slidesData', JSON.stringify(slidesData)); // İnternet koparsa buradan okur
        buildLayers(); // Cihazı yormamak için katmanları önceden çiz
    } else if (Object.keys(slidesData).length === 0) {
        container.innerHTML = "<h1 style='color:white; text-align:center;'>Yayın Bekleniyor...</h1>";
    }
});

// 🏗️ KATMAN (LAYER) İNŞA MOTORU
function buildLayers() {
    container.innerHTML = ""; // Önce ekranı temizle
    slideKeys = Object.keys(slidesData);
    
    slideKeys.forEach(key => {
        const div = document.createElement('div');
        div.className = 'slide-layer'; // Hepsi arkada gizli (opacity: 0) bekler
        div.id = 'layer-' + key;
        div.innerHTML = slidesData[key];
        container.appendChild(div);
    });
    
    if(!rotationTimer && slideKeys.length > 0) {
        showSlide(0); // İlk slaytı başlat
    }
}

// 🎬 GÖSTERİM (YAYIN) MOTORU
function showSlide(index) {
    if (slideKeys.length === 0) return;
    
    let actualIndex = index % slideKeys.length;
    let currentKey = slideKeys[actualIndex];

    // 🌟 ZAMANLAMA TESTİ: Eğer slaytın çıkma zamanı değilse, beklemeden bir sonrakine atla
    if(!isSlideVisible(currentKey)) {
        setTimeout(() => { showSlide(actualIndex + 1); }, 100);
        return;
    }

    currentIndex = actualIndex;
    const config = settingsData[currentKey] || { effect: 'fade', time: 5000 };

    // 1. Tüm katmanları gizle
    document.querySelectorAll('.slide-layer').forEach(layer => {
        layer.classList.remove('active');
    });
    
    // 2. Hedef slaytı bul ve efekti uygulayıp görünür yap
    const targetLayer = document.getElementById('layer-' + currentKey);
    if(targetLayer) {
        targetLayer.className = `slide-layer ${config.effect || 'fade'}`;
        // Reflow: Tarayıcıyı hizaya zorlayarak efekt çakışmasını engeller
        void targetLayer.offsetWidth; 
        targetLayer.classList.add('active'); // Animasyonu başlat
    }

    updateClock(); // Canlı saati güncelle

    // Sonraki slayt için zamanlayıcıyı kur
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
        // Sadece ekranda o an "aktif" olan katmandaki resimleri değiştir (Performans)
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
            
            // Yumuşak geçiş için resmi kopyala, üst üste koy, eskisini sil
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

// Çevrimdışı senaryosu için ilk açılışta önbellekteki veriyi çalıştırmayı dene
if(Object.keys(slidesData).length > 0) {
    buildLayers();
}