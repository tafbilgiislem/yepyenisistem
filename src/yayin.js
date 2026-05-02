// --- 0. 🌟 GÖRSEL EFEKT VE ANİMASYON MOTORU (DİNAMİK) ---
if (!document.getElementById('tv-effects-css')) {
    const style = document.createElement('style');
    style.id = 'tv-effects-css';
    style.innerHTML = `
        .slide-layer { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 1; overflow: hidden; }
        .slide-layer.active { pointer-events: auto; z-index: 2; }
        .slide-layer.fade { opacity: 0; transition: opacity var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.fade.active { opacity: 1; }
        .slide-layer.slide { transform: translateX(100%); transition: transform var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.slide.active { transform: translateX(0); }
        .slide-layer.slide-right { transform: translateX(-100%); transition: transform var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.slide-right.active { transform: translateX(0); }
        .slide-layer.slide-up { transform: translateY(100%); transition: transform var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.slide-up.active { transform: translateY(0); }
        .slide-layer.slide-down { transform: translateY(-100%); transition: transform var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.slide-down.active { transform: translateY(0); }
        .slide-layer.zoom { transform: scale(var(--ef-scale, 0.5)); opacity: 0; transition: all var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.zoom.active { transform: scale(1); opacity: 1; }
        .slide-layer.zoom-out { transform: scale(var(--ef-scale, 1.5)); opacity: 0; transition: all var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.zoom-out.active { transform: scale(1); opacity: 1; }
        .slide-layer.flip { transform: perspective(2000px) rotateY(var(--ef-angle, 90deg)); opacity: 0; transition: all var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.flip.active { transform: perspective(2000px) rotateY(0deg); opacity: 1; }
        .slide-layer.flip-y { transform: perspective(2000px) rotateX(var(--ef-angle, 90deg)); opacity: 0; transition: all var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.flip-y.active { transform: perspective(2000px) rotateX(0deg); opacity: 1; }
        .slide-layer.rotate { transform: rotate(var(--ef-angle, -90deg)) scale(var(--ef-scale, 0.5)); opacity: 0; transition: all var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.rotate.active { transform: rotate(0deg) scale(1); opacity: 1; }
        .slide-layer.blur { filter: blur(20px); opacity: 0; transition: all var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.blur.active { filter: blur(0px); opacity: 1; }
        .slide-layer.wipe-left { clip-path: polygon(100% 0, 100% 0, 100% 100%, 100% 100%); transition: clip-path var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.wipe-left.active { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
        .slide-layer.bounce { transform: scale(var(--ef-scale, 0.5)); opacity: 0; transition: all var(--ef-dur, 1s) var(--ef-ease, ease-in-out); }
        .slide-layer.bounce.active { transform: scale(1); opacity: 1; }
        .slide-layer.none { opacity: 0; transition: none !important; }
        .slide-layer.none.active { opacity: 1; transition: none !important; }
    `;
    document.head.appendChild(style);
}

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
let deviceGroup = localStorage.getItem('tv_device_group') || 'GENEL'; 

let slidesData = JSON.parse(localStorage.getItem('slidesData')) || {};
let myPlaylist = []; 
let rssCache = { url: "", data: "🔴 Haberler Bekleniyor...", time: 0 };
let currentIndex = -1;
let rotationTimer = null;
let isFirstLoad = true;
const container = document.getElementById('viewer-container');

setInterval(() => {
    let currentPlaying = "Bekleniyor...";
    if (myPlaylist.length > 0 && currentIndex >= 0 && myPlaylist[currentIndex]) {
        currentPlaying = myPlaylist[currentIndex].slide || "Bilinmiyor";
    }
    set(ref(db, 'sahne/cihazlar/' + deviceId), {
        lastSeen: Date.now(),
        version: "V68-INSTANT-API",
        playing: currentPlaying.replace(/_/g, ' ').toUpperCase(),
        name: deviceName,
        group: deviceGroup
    }).catch(() => {});
}, 5000);

onValue(ref(db, 'sahne/komutlar/' + deviceId), (snapshot) => {
    if (snapshot.exists()) {
        const cmd = snapshot.val();
        const lastCmdTs = localStorage.getItem('last_cmd_ts') || 0;
        if (cmd.ts > lastCmdTs) {
            localStorage.setItem('last_cmd_ts', cmd.ts);
            if (cmd.type === 'refresh') window.location.reload(); 
            else if (cmd.type === 'rename') { deviceName = cmd.newName; localStorage.setItem('tv_custom_name', deviceName); } 
            else if (cmd.type === 'changeGroup') { deviceGroup = cmd.newGroup; localStorage.setItem('tv_device_group', deviceGroup); window.location.reload(); }
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

// 🚀 HİBRİT ÇEVİRİ MOTORU (DeepL Pro + Google Ücretsiz Fallback)
async function translateToTurkish(text, deepLKey) {
    // 1. EĞER DEEPL ANAHTARI GİRİLMİŞSE PROFESYONEL ÇEVİRİ KULLAN
    if (deepLKey && deepLKey.trim() !== '') {
        try {
            // Anahtar sonu :fx ile bitiyorsa ücretsiz sunucu, bitmiyorsa Pro sunucu kullanılır
            const url = deepLKey.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `DeepL-Auth-Key ${deepLKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: [text], target_lang: 'TR' })
            });
            const data = await res.json();
            if (data.translations && data.translations[0]) {
                return data.translations[0].text;
            }
        } catch (e) {
            console.error("DeepL Hatası, ücretsiz Google Çeviriye dönülüyor...", e);
        }
    }

    // 2. ANAHTAR YOKSA VEYA HATA VERİRSE ÜCRETSİZ GOOGLE ÇEVİRİ KULLAN (Asla Yarı Yolda Bırakmaz)
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        let translatedText = "";
        data[0].forEach(item => { if (item[0]) translatedText += item[0]; });
        return translatedText || text;
    } catch (e) {
        console.error("Google Çeviri Hatası:", e);
        return text; 
    }
}

// 🚀 COLLECT API + DEEPL + SANSÜR + BÜYÜK HARF DESTEKLİ HABER MOTORU
async function fetchRssData(url, apiKey, autoTranslate, bannedWords, deepLKey) { 
    if(!url) return "🔴 GEÇERLİ BİR HABER LİNKİ GİRİLMEDİ.";
    const now = Date.now();
    
    // Veriler değişmediyse hafızadan hızlıca ver
    if(rssCache.url === url && rssCache.translate === autoTranslate && rssCache.banned === bannedWords && (now - rssCache.time < 300000)) return rssCache.data;
    
    try {
        let newsItems = [];

        // 1. Haberleri Çek
        if (url.includes('collectapi.com')) {
            const res = await fetch(url, { headers: { "content-type": "application/json", "authorization": apiKey } });
            const data = await res.json();
            if(data.success && data.result) newsItems = data.result.map(i => i.name);
        } else {
            const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if(data.items) newsItems = data.items.map(i => i.title);
        }

        if (newsItems.length > 0) {
            // Haber sitelerinin kendi attığı "|" işaretlerini zorla sil
            newsItems = newsItems.map(title => title.replace(/\|/g, " "));

            // Aralara ayraç yerine 8 karakterlik devasa bir boşluk at
            let combinedText = newsItems.map(title => "🔴 " + title).join("        ");

            // 2. ÇEVİRİ MOTORUNU DEEPL DESTEĞİYLE ÇAĞIR
            if (autoTranslate === 'true') {
                combinedText = await translateToTurkish(combinedText, deepLKey);
            }

            // 3. SADECE YAZILAN KELİMEYİ GİZLEME (Haberi Asla Silmez!)
            if (bannedWords && bannedWords.trim() !== "") {
                const bannedArr = bannedWords.split(',').map(w => w.trim()).filter(w => w);
                bannedArr.forEach(banned => {
                    const regex = new RegExp(banned, "gi");
                    combinedText = combinedText.replace(regex, ""); 
                });
                
                combinedText = combinedText.replace(/\s{2,}/g, ' ').trim();
            }

            // 4. TÜRKÇE KARAKTER UYUMLU BÜYÜK HARF DÖNÜŞÜMÜ
            combinedText = combinedText.toLocaleUpperCase('tr-TR');

            const finalString = combinedText + "        " + combinedText;
            rssCache = { url: url, data: finalString, time: now, translate: autoTranslate, banned: bannedWords };
            return finalString;
        }

    } catch(e) { console.error("Haber Hatası:", e); }
    return "🔴 HABERLER YÜKLENEMEDİ...";
}

// 🚀 WIDGETLARI CANLI YENİLEME MOTORU
async function refreshActiveWidgets() {
    
    // 1. RSS HABERLER (Sadece aktif ekranda güncellenir ki kayma animasyonu bozulmasın)
    const activeLayer = document.querySelector('.slide-layer.active');
    if(activeLayer) {
        const rssBands = activeLayer.querySelectorAll('.rss-band');
        for(let band of rssBands) {
            const url = band.getAttribute('data-rss-url');
            const apiKey = band.getAttribute('data-collect-api-key') || '';
            const autoTrans = band.getAttribute('data-auto-translate') || 'false'; 
            const bannedWords = band.getAttribute('data-banned-words') || ''; 
            const deepLKey = band.getAttribute('data-deepl-api-key') || ''; // 🚀 YENİ: DeepL Key'i al
            
            // 🚀 Motora DeepL Key'i de gönder
            const text = await fetchRssData(url, apiKey, autoTrans, bannedWords, deepLKey); 
            const scroller = band.querySelector('.rss-scroller');
            if(scroller && scroller.innerText !== text) scroller.innerText = text;
        }
    }
    
    // 2. HAVA DURUMU (Ekranda olsun veya olmasın arka planda TÜM slaytları günceller)
    document.querySelectorAll('.weather-widget').forEach(async wth => {
        const city = wth.getAttribute('data-city') || 'Izmir';
        const theme = wth.getAttribute('data-theme') || 'light';
        const mainBg = theme === 'dark' ? '#1e293b' : '#ffffff';
        const gridBg = theme === 'dark' ? '#334155' : '#f8f3ee';
        const textColor = theme === 'dark' ? '#cbd5e1' : '#64748b';
        const valColor = theme === 'dark' ? '#38bdf8' : '#0369a1';

        try {
            const OWM_API_KEY = "97fe4c9ee7efb72f3e0520ceb21bba8b"; 
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&lang=tr&appid=${OWM_API_KEY}`);
            
            if(!res.ok) return; 
            
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

            // 🚀 DİNAMİK PİKSEL HESAPLAMA
            const w = parseFloat(wth.getAttribute('width')) || 380;
            const scale = w / 380;

            wth.innerHTML = `
            <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; background: ${mainBg}; border-radius: ${20 * scale}px; font-family: sans-serif; display: flex; flex-direction: column; justify-content: space-between; padding: 4%; box-sizing: border-box;">
                <div style="width: 100%; height: 50%; background: #1e293b; border-radius: ${14 * scale}px; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; padding: 5%; box-sizing: border-box; box-shadow: inset 0 0 40px rgba(0,0,0,0.4); color: white;">
                    <img src="${bgUrl}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.65; mix-blend-mode: overlay; pointer-events: none;" />
                    <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="font-size: ${30 * scale}px; font-weight: 800; text-shadow: 0 2px 5px rgba(0,0,0,0.6);">${city.toUpperCase()}</div>
                        <div style="font-size: ${20 * scale}px; font-weight: bold; text-shadow: 0 2px 5px rgba(0,0,0,0.6);">${timeStr}</div>
                    </div>
                    <div style="position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: space-between;">
                        <div style="font-size: ${90 * scale}px; font-weight: 800; line-height: 0.8; text-shadow: 0 4px 10px rgba(0,0,0,0.5);">${temp}°</div>
                        <div style="text-align: right; display: flex; flex-direction: column; gap: ${2 * scale}px;">
                            <div style="font-size: ${18 * scale}px; font-weight: bold; text-shadow: 0 2px 5px rgba(0,0,0,0.6);">${desc}</div>
                            <div style="font-size: ${14 * scale}px; opacity: 0.95; text-shadow: 0 2px 5px rgba(0,0,0,0.6);">Hissedilen: ${feelsLike}°</div>
                        </div>
                    </div>
                </div>
                <div style="width: 100%; height: 46%; display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 3%;">
                    <div style="background: ${gridBg}; border-radius: ${10 * scale}px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="font-size: ${13 * scale}px; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-wind"></i> Rüzgâr</div>
                        <div style="font-size: ${16 * scale}px; color: ${valColor}; font-weight: bold; margin-top: 4px;">${wind} m/s</div>
                    </div>
                    <div style="background: ${gridBg}; border-radius: ${10 * scale}px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="font-size: ${13 * scale}px; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-drop"></i> Nem</div>
                        <div style="font-size: ${16 * scale}px; color: ${valColor}; font-weight: bold; margin-top: 4px;">%${humidity}</div>
                    </div>
                    <div style="background: ${gridBg}; border-radius: ${10 * scale}px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="font-size: ${13 * scale}px; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-eye"></i> Görünürlük</div>
                        <div style="font-size: ${16 * scale}px; color: ${valColor}; font-weight: bold; margin-top: 4px;">${visibility} km</div>
                    </div>
                    <div style="background: ${gridBg}; border-radius: ${10 * scale}px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="font-size: ${13 * scale}px; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-arrows-in"></i> Basınç</div>
                        <div style="font-size: ${16 * scale}px; color: ${valColor}; font-weight: bold; margin-top: 4px;">${pressure} hPa</div>
                    </div>
                    <div style="background: ${gridBg}; border-radius: ${10 * scale}px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="font-size: ${13 * scale}px; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-cloud"></i> Bulutluluk</div>
                        <div style="font-size: ${16 * scale}px; color: ${valColor}; font-weight: bold; margin-top: 4px;">%${clouds}</div>
                    </div>
                    <div style="background: ${gridBg}; border-radius: ${10 * scale}px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="font-size: ${13 * scale}px; color: ${textColor}; display: flex; align-items: center; gap: 4px;"><i class="ph ph-thermometer"></i> Min/Maks</div>
                        <div style="font-size: ${16 * scale}px; color: ${valColor}; font-weight: bold; margin-top: 4px;">${minMax}</div>
                    </div>
                </div>
            </div>`;
        } catch(e) { console.log("Hava durumu güncellenemedi, API veya İnternet hatası:", e); }
    });

    // 3. DÖVİZ (Tüm slaytları arka planda günceller)
    document.querySelectorAll('.currency-widget').forEach(async cur => {
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
}


// 🚀 OYNATMA LİSTESİ DİNLEYİCİSİ
onValue(ref(db, 'sahne/oynatma_listeleri'), (snapshot) => {
    if (snapshot.exists()) {
        const lists = snapshot.val();
        myPlaylist = lists[deviceName] || lists[deviceId] || lists[deviceGroup] || lists['TÜMÜ'] || [];
        
        if (myPlaylist.length > 0 && container.innerHTML.includes("Yayın Bekleniyor")) {
            currentIndex = -1;
            showNextSlide();
        }
    } else {
        myPlaylist = [];
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
    const newKeys = Object.keys(newData); 
    
    Object.keys(slidesData).forEach(key => {
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
            initMedia(layer); 
            
            if (!layer.classList.contains('active')) {
                layer.querySelectorAll('video').forEach(v => v.pause());
            } else {
                layer.querySelectorAll('video').forEach(v => v.play().catch(e=>console.log(e)));
                layer.querySelectorAll('iframe').forEach(ifr => {
                    if (ifr.src.includes('youtube')) {
                        ifr.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                    }
                });
                // 🚀 EKRAN GÜNCELLENİR GÜNCELLEMEZ WIDGETLARI ÇEK
                refreshActiveWidgets();
            }
        }
    });

    slidesData = newData;

    if (isFirstLoad && myPlaylist.length > 0) {
        isFirstLoad = false;
        showNextSlide();
    } else if (isFirstLoad) {
        container.innerHTML = "<h1 style='color:white; text-align:center;'>Yayın Bekleniyor...</h1>";
    }
}

if(Object.keys(slidesData).length > 0) {
    updateLayersGhost(slidesData);
}

function isPlaylistItemVisible(item) {
    if (!item) return false;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; 
    
    if (item.startDate && todayStr < item.startDate) return false;
    if (item.endDate && todayStr > item.endDate) return false;
    
    const currentDay = now.getDay(); 
    if(item.days && item.days.length > 0 && !item.days.includes(currentDay)) return false;

    const currentTime = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
    if(item.startTime && item.endTime) {
        if(currentTime < item.startTime || currentTime > item.endTime) return false;
    }
    return true;
}

function showNextSlide() {
    clearTimeout(rotationTimer);
    
    if (myPlaylist.length === 0) {
        container.innerHTML = "<h1 style='color:white; text-align:center;'>Bu Ekran İçin Yayın Akışı Yok</h1>";
        rotationTimer = setTimeout(showNextSlide, 5000);
        return;
    }

    if (container.querySelector('h1')) container.innerHTML = '';

    let attempts = 0;
    let nextIndex = (currentIndex + 1) % myPlaylist.length;

    while (attempts < myPlaylist.length) {
        const item = myPlaylist[nextIndex];
        if (isPlaylistItemVisible(item) && slidesData[item.slide]) {
            currentIndex = nextIndex;
            applySlide(item);
            return;
        }
        nextIndex = (nextIndex + 1) % myPlaylist.length;
        attempts++;
    }

    container.innerHTML = "<h1 style='color:white; text-align:center;'>Şu An Oynatılacak Slayt Yok</h1>";
    rotationTimer = setTimeout(showNextSlide, 5000);
}

function applySlide(playlistItem) {
    const key = playlistItem.slide;
    const effect = playlistItem.effect || 'fade';
    const time = playlistItem.time || 5000;

    const efDur = playlistItem.effectDur !== undefined ? playlistItem.effectDur : 1;
    const efEase = playlistItem.effectEase || 'ease-in-out';
    const efAngle = playlistItem.effectAngle !== undefined ? playlistItem.effectAngle : (effect === 'rotate' ? -90 : 90);
    const efScale = playlistItem.effectScale !== undefined ? playlistItem.effectScale : 0.5;

    document.querySelectorAll('.slide-layer').forEach(layer => {
        if (layer.id !== 'layer-' + key && layer.classList.contains('active')) {
            layer.classList.remove('active');
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
            }, efDur * 1000 + 200); 
        }
    });
    
    let targetLayer = document.getElementById('layer-' + key);
    if (!targetLayer) {
        targetLayer = document.createElement('div');
        targetLayer.className = `slide-layer fade`; 
        targetLayer.id = 'layer-' + key;
        targetLayer.innerHTML = slidesData[key];
        container.appendChild(targetLayer);
        initMedia(targetLayer);
    }

    targetLayer.style.setProperty('--ef-dur', efDur + 's');
    targetLayer.style.setProperty('--ef-ease', efEase);
    targetLayer.style.setProperty('--ef-angle', efAngle + 'deg');
    targetLayer.style.setProperty('--ef-scale', efScale);

    targetLayer.className = `slide-layer ${effect} active`;
    void targetLayer.offsetWidth; 
    
    targetLayer.querySelectorAll('video').forEach(v => {
        v.play().catch(e => console.log("Otomatik oynatma engeli", e));
    });
    
    targetLayer.querySelectorAll('iframe').forEach(ifr => {
        if (ifr.src.includes('youtube')) {
            ifr.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        }
    });

    updateClock(); 
    refreshActiveWidgets(); // 🚀 SLAYT AÇILDIĞI AN WIDGETLARI (HABERLERİ) ÇEK!
    
    rotationTimer = setTimeout(showNextSlide, time);
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
    if (dateText) { dateText.textContent = date; dateText.setAttribute("text-anchor", "start"); }
    if (timeText) { timeText.textContent = hours + ":" + minutes + ":" + seconds; timeText.setAttribute("text-anchor", "start"); }
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

const HEDEF_TARIH = new Date("2028-07-14T20:00:00");
function updateGlobalCountdowns() {
    const activeLayer = document.querySelector('.slide-layer.active');
    if (!activeLayer) return;
    const secEl = activeLayer.querySelector('#seconds'), minEl = activeLayer.querySelector('#minutes'), hourEl = activeLayer.querySelector('#hours'), dayEl = activeLayer.querySelector('#days'), monthEl = activeLayer.querySelector('#months');
    if (secEl || minEl || hourEl || dayEl || monthEl) {
        const now = new Date(); let diff = HEDEF_TARIH - now; if (diff < 0) diff = 0;
        const seconds = Math.floor(diff / 1000) % 60, minutes = Math.floor(diff / 60000) % 60, hours = Math.floor(diff / 3600000) % 24, days = Math.floor(diff / 86400000) % 30, months = Math.floor(diff / (86400000 * 30));
        if (monthEl) monthEl.textContent = String(months).padStart(2, "0"); if (dayEl) dayEl.textContent = String(days).padStart(2, "0"); if (hourEl) hourEl.textContent = String(hours).padStart(2, "0"); if (minEl) minEl.textContent = String(minutes).padStart(2, "0"); if (secEl) secEl.textContent = String(seconds).padStart(2, "0");
    }
}
setInterval(updateGlobalCountdowns, 1000);