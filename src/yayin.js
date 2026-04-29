// --- 1. FIREBASE BAĞLANTISI ---
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DB_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. CİHAZ KİMLİĞİ VE GRUP HAFIZASI ---
let deviceId = localStorage.getItem('tv_device_id');
if (!deviceId) {
    deviceId = "TV_" + Math.floor(Math.random() * 10000);
    localStorage.setItem('tv_device_id', deviceId);
}
let deviceName = localStorage.getItem('tv_custom_name') || deviceId;
// 🚀 YENİ: Cihazın Grubunu hafızadan al, yoksa "GENEL" yap
let deviceGroup = localStorage.getItem('tv_device_group') || 'GENEL'; 

// --- 3. DEĞİŞKENLER ---
let slidesData = JSON.parse(localStorage.getItem('slidesData')) || {};
let settingsData = JSON.parse(localStorage.getItem('settingsData')) || {};
let rssCache = { url: "", data: "🔴 Haberler Bekleniyor...", time: 0 };

let slideKeys = Object.keys(slidesData).sort();
let currentIndex = -1;
let rotationTimer = null;
let isFirstLoad = true;
let pendingUpdates = {};
let pendingDeletes = [];

const container = document.getElementById('viewer-container');

// --- 4. FİREBASE'E "BEN AKTİFİM" SİNYALİ GÖNDER ---
setInterval(() => {
    const currentPlaying = slideKeys[currentIndex] || "Bekleniyor...";
    set(ref(db, 'sahne/cihazlar/' + deviceId), {
        lastSeen: Date.now(),
        version: "V50-GROUP",
        playing: currentPlaying.replace(/_/g, ' ').toUpperCase(),
        name: deviceName,
        group: deviceGroup // 🚀 YENİ: Firebase'e grubunu da bildirir
    }).catch(() => {});
}, 5000);

// --- 5. 🌟 UZAKTAN KUMANDA ---
onValue(ref(db, 'sahne/komutlar/' + deviceId), (snapshot) => {
    if (snapshot.exists()) {
        const cmd = snapshot.val();
        const lastCmdTs = localStorage.getItem('last_cmd_ts') || 0;
        
        if (cmd.ts > lastCmdTs) {
            localStorage.setItem('last_cmd_ts', cmd.ts);
            
            if (cmd.type === 'refresh') {
                window.location.reload(); 
            } 
            else if (cmd.type === 'rename') {
                deviceName = cmd.newName; 
                localStorage.setItem('tv_custom_name', deviceName);
            } 
            else if (cmd.type === 'changeGroup') { 
                // 🚀 YENİ: Uzaktan grup değiştirme komutu gelirse uygula ve yenile
                deviceGroup = cmd.newGroup;
                localStorage.setItem('tv_device_group', deviceGroup);
                window.location.reload(); 
            }
            else if (cmd.type === 'ping') {
                let div = document.getElementById('ping-overlay');
                if(!div) {
                    div = document.createElement('div'); div.id = 'ping-overlay';
                    div.style.cssText = 'position:fixed; inset:0; background:rgba(220,38,38,0.95); color:white; z-index:9999999; display:flex; align-items:center; justify-content:center; font-size:8vw; font-weight:900; text-transform:uppercase;';
                    document.body.appendChild(div);
                }
                div.innerText = "📍 BEN: " + deviceName + "\n🏢 GRUP: " + deviceGroup;
                div.style.display = 'flex';
                setTimeout(() => { div.style.display = 'none'; }, 4000); 
            }
        }
    }
});

// --- WIDGET GÜNCELLEYİCİLER (RSS, HAVA, DÖVİZ) ---
async function fetchRssData(url) {
    if(!url) return "🔴 Geçerli bir haber linki girilmedi.";
    const now = Date.now();
    if(rssCache.url === url && (now - rssCache.time < 300000)) return rssCache.data;
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

setInterval(async () => {
    const activeLayer = document.querySelector('.slide-layer.active');
    if(!activeLayer) return;
    
    const rssBands = activeLayer.querySelectorAll('.rss-band');
    for(let band of rssBands) {
        const url = band.getAttribute('data-rss-url');
        const text = await fetchRssData(url);
        const scroller = band.querySelector('.rss-scroller');
        if(scroller && scroller.innerText !== text) scroller.innerText = text;
    }

    activeLayer.querySelectorAll('.weather-widget').forEach(async wth => {
        const city = wth.getAttribute('data-city') || 'Istanbul';
        try {
            const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
            const data = await res.json();
            const temp = data.current_condition[0].temp_C;
            const desc = data.current_condition[0].lang_tr?.[0]?.value || data.current_condition[0].weatherDesc[0].value;
            const engDesc = data.current_condition[0].weatherDesc[0].value;
            const iconMap = { "Sunny": "☀️", "Clear": "🌙", "Partly cloudy": "⛅", "Cloudy": "☁️", "Overcast": "☁️", "Mist": "🌫️", "Patchy rain possible": "🌦️", "Light rain": "🌧️", "Heavy rain": "🌧️", "Light snow": "🌨️", "Heavy snow": "❄️", "Moderate or heavy rain with thunder": "⛈️", "Fog": "🌫️" };
            const emoji = iconMap[engDesc] || "🌤️";
            const inner = wth.querySelector('.weather-inner');
            if (inner) inner.innerHTML = `<div style="display:flex; flex-direction:column; align-items:flex-start; justify-content:center;"><div style="font-size: 25cqh; font-weight:800; letter-spacing:0.05em; margin-bottom: 2cqh; line-height: 1;">${city.toUpperCase()}</div><div style="font-size: 12cqh; font-weight:400; opacity:0.8; line-height: 1;">${desc}</div></div><div style="display:flex; align-items:center; gap: 3cqw;"><span style="font-size: 40cqh; line-height: 1;">${emoji}</span><span style="font-size: 45cqh; font-weight:800; line-height: 1;">${temp}°</span></div>`;
        } catch(e) {}
    });

    activeLayer.querySelectorAll('.currency-widget').forEach(async cur => {
        const curs = (cur.getAttribute('data-currencies') || 'USD,EUR,GBP').split(',').map(c=>c.trim().toUpperCase());
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await res.json();
            const tryRate = data.rates['TRY'];
            let htmlBlocks = '';
            curs.forEach(c => {
                let val = "0.00";
                if(c === 'USD') val = tryRate.toFixed(2);
                else if(data.rates[c]) val = (tryRate / data.rates[c]).toFixed(2);
                let flag = "💰";
                if(c==='USD') flag="🇺🇸"; if(c==='EUR') flag="🇪🇺"; if(c==='GBP') flag="🇬🇧"; if(c==='CHF') flag="🇨🇭"; if(c==='JPY') flag="🇯🇵"; if(c==='SAR' || c==='AED') flag="🇸🇦";
                htmlBlocks += `<div style="display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.15); padding:3cqh 2cqw; border-radius:1cqw; min-width:25cqw;"><span style="font-size:15cqh; margin-bottom:1cqh; line-height:1;">${flag}</span><span style="font-size:10cqh; color:var(--accent); font-weight:bold; line-height:1;">${c}</span><span style="font-size:16cqh; font-weight:800; line-height:1;">₺${val}</span></div>`;
            });
            const inner = cur.querySelector('.currency-inner');
            if (inner) inner.innerHTML = htmlBlocks;
        } catch(e) {}
    });
}, 300000);


// 🚀 GELİŞMİŞ DENETLEME: GRUP + SAAT + GÜN + TARİH KONTROLÜ
function isSlideVisible(key) {
    const s = settingsData[key];
    if(!s) return true; 

    const now = new Date();
    
    // --- 1. TARİHSEL (TAK Takvim) KONTROLÜ ---
    // Tarih formatı: YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0]; 

    if (s.startDate && todayStr < s.startDate) {
        return false; // Kampanya henüz başlamamış
    }
    if (s.endDate && todayStr > s.endDate) {
        return false; // Kampanya süresi dolmuş
    }

    // --- 2. GRUP (ŞUBE) KONTROLÜ ---
    if(s.targetGroup && s.targetGroup !== 'TÜMÜ' && s.targetGroup !== deviceGroup) {
        return false; 
    }

    // --- 3. GÜN KONTROLÜ ---
    const currentDay = now.getDay(); 
    if(s.days && s.days.length > 0 && !s.days.includes(currentDay)) return false;

    // --- 4. SAAT KONTROLÜ ---
    const currentTime = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
    if(s.startTime && s.endTime) {
        if(currentTime < s.startTime || currentTime > s.endTime) return false;
    }

    return true; // Tüm engelleri geçti, slayt gösterilebilir!
}

onValue(ref(db, 'sahne/ayarlar'), (snapshot) => {
    if (snapshot.exists()) {
        settingsData = snapshot.val();
        localStorage.setItem('settingsData', JSON.stringify(settingsData));
    }
});

onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
    if (snapshot.exists()) {
        const newData = snapshot.val();
        localStorage.setItem('slidesData', JSON.stringify(newData));
        updateLayersGhost(newData);
    } else if (Object.keys(slidesData).length === 0 && isFirstLoad) {
        container.innerHTML = "<h1 style='color:white; text-align:center;'>Yayın Bekleniyor...</h1>";
    }
});

function initMedia(layer) {
    layer.querySelectorAll('video').forEach(vid => {
        if (vid.id && vid.id.startsWith('v_')) {
            const urlEl = vid.closest('.video-obj');
            const url = urlEl ? urlEl.getAttribute('data-video-url') : null;
            if (url && url.includes('.m3u8')) {
                if (window.Hls && Hls.isSupported()) {
                    const hls = new Hls({ maxBufferLength: 60, liveSyncDurationCount: 3 });
                    hls.loadSource(url);
                    hls.attachMedia(vid);
                } else if (vid.canPlayType('application/vnd.apple.mpegurl')) {
                    vid.src = url; 
                }
            }
        }
    });
}

function updateLayersGhost(newData) {
    const newKeys = Object.keys(newData).sort(); 
    
    slideKeys.forEach(key => {
        if (!newData[key]) {
            const el = document.getElementById('layer-' + key);
            if (el) {
                if (el.classList.contains('active')) pendingDeletes.push(key);
                else el.remove();
            }
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
            if (layer.classList.contains('active')) {
                pendingUpdates[key] = newData[key]; 
            } else {
                layer.innerHTML = newData[key];
                initMedia(layer); 
                
                layer.querySelectorAll('video').forEach(v => v.pause());
                layer.querySelectorAll('iframe').forEach(ifr => {
                    if (ifr.src.includes('youtube')) {
                        ifr.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                    }
                });
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
    updateLayersGhost(slidesData);
}

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

    document.querySelectorAll('.slide-layer').forEach(layer => {
        if (layer.id !== 'layer-' + key && layer.classList.contains('active')) {
            layer.classList.remove('active');
            const prevKey = layer.id.replace('layer-', '');

            setTimeout(() => {
                layer.querySelectorAll('video').forEach(v => {
                    v.pause();
                    if (!v.src.includes('.m3u8') && !v.id.startsWith('v_')) v.currentTime = 0;
                });
                
                layer.querySelectorAll('iframe').forEach(ifr => {
                    if (ifr.src.includes('youtube')) {
                        ifr.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                        ifr.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
                    }
                });

                if (pendingUpdates[prevKey]) {
                    layer.innerHTML = pendingUpdates[prevKey];
                    initMedia(layer);
                    delete pendingUpdates[prevKey];
                }
                
                if (pendingDeletes.includes(prevKey)) {
                    layer.remove();
                    pendingDeletes = pendingDeletes.filter(k => k !== prevKey);
                }
            }, 1200);
        }
    });
    
    const targetLayer = document.getElementById('layer-' + key);
    if(targetLayer) {
        targetLayer.className = `slide-layer ${config.effect || 'fade'} active`;
        void targetLayer.offsetWidth; 
        
        targetLayer.querySelectorAll('video').forEach(v => {
            v.play().catch(e => console.log("Otomatik oynatma engeli", e));
        });
        
        targetLayer.querySelectorAll('iframe').forEach(ifr => {
            if (ifr.src.includes('youtube')) {
                ifr.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
            }
        });
    }

    updateClock(); 
    clearTimeout(rotationTimer);
    rotationTimer = setTimeout(showNextSlide, config.time || 5000);
}

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
// --- 🚀 YENİ: SİSTEM GENELİ GERİ SAYIM MOTORU (SVG'ler için) ---
const HEDEF_TARIH = new Date("2028-07-14T20:00:00");

function updateGlobalCountdowns() {
    const activeLayer = document.querySelector('.slide-layer.active');
    if (!activeLayer) return;

    // Aktif slaytta geri sayım ID'leri var mı diye kontrol et
    const secEl = activeLayer.querySelector('#seconds');
    const minEl = activeLayer.querySelector('#minutes');
    const hourEl = activeLayer.querySelector('#hours');
    const dayEl = activeLayer.querySelector('#days');
    const monthEl = activeLayer.querySelector('#months');

    if (secEl || minEl || hourEl || dayEl || monthEl) {
        const now = new Date();
        let diff = HEDEF_TARIH - now;
        if (diff < 0) diff = 0;

        const seconds = Math.floor(diff / 1000) % 60;
        const minutes = Math.floor(diff / 60000) % 60;
        const hours = Math.floor(diff / 3600000) % 24;
        const days = Math.floor(diff / 86400000) % 30;
        const months = Math.floor(diff / (86400000 * 30));

        // SVG'nin içindeki text etiketlerini güncelle
        if (monthEl) monthEl.textContent = String(months).padStart(2, "0");
        if (dayEl) dayEl.textContent = String(days).padStart(2, "0");
        if (hourEl) hourEl.textContent = String(hours).padStart(2, "0");
        if (minEl) minEl.textContent = String(minutes).padStart(2, "0");
        if (secEl) secEl.textContent = String(seconds).padStart(2, "0");
    }
}
setInterval(updateGlobalCountdowns, 1000);
// --- GERİ SAYIM MOTORU SONU ---