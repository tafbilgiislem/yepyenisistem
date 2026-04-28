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

const deviceId = "TV_" + Math.floor(Math.random() * 10000); 

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

setInterval(() => {
    const currentPlaying = slideKeys[currentIndex] || "Bekleniyor...";
    set(ref(db, 'sahne/cihazlar/' + deviceId), {
        lastSeen: Date.now(),
        version: "V49-WIDGET",
        playing: currentPlaying.replace(/_/g, ' ').toUpperCase()
    }).catch(() => {});
}, 5000);

// --- 🌟 CANLI VERİ (RSS / HAVA DURUMU / DÖVİZ) GÜNCELLEYİCİSİ ---
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

// Tüm Widget'ları Her 5 Dakikada Bir (300,000 ms) Güncelle
setInterval(async () => {
    const activeLayer = document.querySelector('.slide-layer.active');
    if(!activeLayer) return;
    
    // 1. RSS Güncelle
    const rssBands = activeLayer.querySelectorAll('.rss-band');
    for(let band of rssBands) {
        const url = band.getAttribute('data-rss-url');
        const text = await fetchRssData(url);
        const scroller = band.querySelector('.rss-scroller');
        if(scroller && scroller.innerText !== text) scroller.innerText = text;
    }

    // 2. Hava Durumu Güncelle
    activeLayer.querySelectorAll('.weather-widget').forEach(async wth => {
        const city = wth.getAttribute('data-city') || 'Istanbul';
        const theme = wth.getAttribute('data-theme') || 'dark';
        try {
            const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
            const data = await res.json();
            const temp = data.current_condition[0].temp_C;
            const desc = data.current_condition[0].lang_tr?.[0]?.value || data.current_condition[0].weatherDesc[0].value;
            const engDesc = data.current_condition[0].weatherDesc[0].value;
            const iconMap = { "Sunny": "☀️", "Clear": "🌤️", "Partly cloudy": "⛅", "Cloudy": "☁️", "Overcast": "☁️", "Mist": "🌫️", "Patchy rain possible": "🌦️", "Light rain": "🌧️", "Heavy rain": "🌧️", "Light snow": "🌨️", "Heavy snow": "❄️", "Moderate or heavy rain with thunder": "⛈️" };
            const emoji = iconMap[engDesc] || "🌤️";
            const bg = theme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';
            const color = theme === 'dark' ? '#fff' : '#000';
            
            wth.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:${bg}; color:${color}; border-radius:20px; font-family:sans-serif; backdrop-filter:blur(10px); padding:20px; box-sizing:border-box;"><div style="font-size:1.5em; font-weight:bold; margin-bottom:5px; text-transform:uppercase; letter-spacing:2px;">${city}</div><div style="display:flex; align-items:center; gap:15px;"><span style="font-size:4em;">${emoji}</span><span style="font-size:4.5em; font-weight:800;">${temp}°</span></div><div style="font-size:1.2em; opacity:0.8; margin-top:5px;">${desc}</div></div>`;
        } catch(e) {}
    });

    // 3. Döviz Güncelle
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
                htmlBlocks += `<div style="display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.1); padding:15px; border-radius:10px; min-width:100px;"><span style="font-size:1.5em; margin-bottom:5px;">${flag}</span><span style="font-size:1em; color:#10b981; font-weight:bold;">${c}</span><span style="font-size:1.6em; font-weight:800;">₺${val}</span></div>`;
            });
            cur.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; justify-content:space-evenly; background:rgba(0,0,0,0.7); color:#fff; border-radius:15px; font-family:sans-serif; backdrop-filter:blur(10px); padding:10px; box-sizing:border-box;">${htmlBlocks}</div>`;
        } catch(e) {}
    });
}, 300000); // 300,000 ms = 5 dakika.


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