import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ⚠️ KENDİ FİREBASE BİLGİLERİNİ GİR
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

let slideKeys = [];
let currentIndex = 0;
let rotationTimer = null;
const container = document.getElementById('viewer-container');

// 📡 HEARTBEAT
setInterval(() => {
    set(ref(db, 'sahne/cihazlar/' + deviceId), {
        lastSeen: Date.now(),
        version: "V49.5-PRO"
    }).catch(e => console.log("Çevrimdışı Sinyal Yok"));
}, 10000);


// ⛅ HAVA DURUMU MOTORU (OPENWEATHERMAP)
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather?q=Izmir,TR&units=metric&lang=tr&appid=97fe4c9ee7efb72f3e0520ceb21bba8b";

async function fetchWeather() {
    try {
        const response = await fetch(WEATHER_API_URL);
        if(response.ok) {
            const data = await response.json();
            const temp = Math.round(data.main.temp); 
            const desc = data.weather[0].description; 
            const iconCode = data.weather[0].icon; 
            const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
            
            document.getElementById('w-temp').innerText = `${temp}°C`;
            document.getElementById('w-desc').innerText = `İZMİR | ${desc}`;
            document.getElementById('w-icon').innerHTML = `<img src="${iconUrl}" style="width: 50px; height: 50px; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.5)); margin-top: 5px;">`;
        }
    } catch(e) { console.log("Hava durumu çekilemedi:", e); }
}
fetchWeather();
setInterval(fetchWeather, 1800000); // 30 Dk bir yeniler


// 🗞️ RSS HABER MOTORU
async function fetchRssData(url) {
    if(!url) return "🔴 Geçerli bir haber linki girilmedi.";
    const now = Date.now();
    if(rssCache.url === url && (now - rssCache.time < 300000)) { return rssCache.data; }
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
    return "🔴 Haber kaynağına ulaşılamıyor...";
}

setInterval(async () => {
    const activeLayer = document.querySelector('.slide-layer.active');
    if(!activeLayer) return;
    const rssBands = activeLayer.querySelectorAll('.rss-band');
    for(let band of rssBands) {
        const url = band.getAttribute('data-rss-url');
        const text = await fetchRssData(url);
        const scroller = band.querySelector('.rss-scroller');
        if(scroller && scroller.innerText !== text) { scroller.innerText = text; }
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
    if(s.startTime && s.endTime) { if(currentTime < s.startTime || currentTime > s.endTime) return false; }
    return true; 
}

// 🎨 VERİLERİ DİNLE VE KAYDET
onValue(ref(db, 'sahne/ayarlar'), (snapshot) => {
    if (snapshot.exists()) {
        settingsData = snapshot.val();
        localStorage.setItem('settingsData', JSON.stringify(settingsData));
    }
});

onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
    if (snapshot.exists()) {
        slidesData = snapshot.val();
        localStorage.setItem('slidesData', JSON.stringify(slidesData));
        buildLayers(); 
    } else {
        container.innerHTML = "<h1 style='color:white; text-align:center;'>Yayın Bekleniyor...</h1>";
    }
});

// 🛡️ İZOLASYON (SANDBOX) MOTORU (KAYMALARI ÖNLER)
function isolateIDs(htmlString, slideKey) {
    return htmlString
        .replace(/\bid="([^"]+)"/g, `id="${slideKey}_$1"`)
        .replace(/url\(['"]?#([^)"']+?)['"]?\)/g, `url(#${slideKey}_$1)`)
        .replace(/\b(href|xlink:href)="\#([^"]+)"/g, `$1="#${slideKey}_$2"`);
}

// 🏗️ KATMAN İNŞASI
function buildLayers() {
    container.innerHTML = ""; 
    slideKeys = Object.keys(slidesData); 
    
    slideKeys.forEach(key => {
        const div = document.createElement('div');
        div.className = 'slide-layer'; 
        div.id = 'layer-' + key;
        div.innerHTML = isolateIDs(slidesData[key], key);
        container.appendChild(div);
    });
    
    if(!rotationTimer && slideKeys.length > 0) showSlide(0); 
}

// 🎬 YAYIN DÖNGÜSÜ
function showSlide(index) {
    if (slideKeys.length === 0) return;
    
    let actualIndex = index % slideKeys.length;
    let currentKey = slideKeys[actualIndex];

    if(!isSlideVisible(currentKey)) {
        setTimeout(() => { showSlide(actualIndex + 1); }, 100);
        return;
    }

    currentIndex = actualIndex;
    const config = settingsData[currentKey] || { effect: 'fade', time: 5000 };

    document.querySelectorAll('.slide-layer').forEach(layer => { layer.classList.remove('active'); });
    
    const targetLayer = document.getElementById('layer-' + currentKey);
    if(targetLayer) {
        targetLayer.className = `slide-layer ${config.effect || 'fade'}`;
        void targetLayer.offsetWidth; 
        targetLayer.classList.add('active'); 
    }

    clearTimeout(rotationTimer);
    rotationTimer = setTimeout(() => { showSlide(currentIndex + 1); }, config.time || 5000);
}

// ⌚ CANLI SAAT MOTORU (HTML'DEKİ ID'LERE BAĞLANDI)
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
    if (timeText) timeText.textContent = hours + ":" + minutes;
}
setInterval(updateClock, 1000);
updateClock(); // Açılışta hemen saati bas

// 🖼️ İÇ RESİM ÇEVİRİCİ
function startInnerSliders() {
    setInterval(() => {
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

if(Object.keys(slidesData).length > 0) buildLayers();
