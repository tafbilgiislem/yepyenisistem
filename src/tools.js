window.getSvgDim = function() {
    const svg = document.querySelector('#canvas-inner svg'); let w = 1920, h = 1080;
    if(svg && svg.hasAttribute('viewBox')) { const vb = svg.getAttribute('viewBox').split(/\s+|,/); if(vb.length >= 4) { w = parseFloat(vb[2]); h = parseFloat(vb[3]); } }
    return { w, h };
};
window.getCanvasCenter = function() { const dim = window.getSvgDim(); return { cx: dim.w / 2, cy: dim.h / 2 }; };

window.setD = function(el, key, val) { if(el) el.setAttribute('data-' + key, val); };
window.getD = function(el, key) { return el ? el.getAttribute('data-' + key) : null; };
window.safeColor = function(c) { if(!c) return "#ffffff"; if(c.length === 4 && c.startsWith('#')) return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return c.startsWith('#') && c.length === 7 ? c : "#ffffff"; };

window.addNewText = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const center = window.getCanvasCenter();
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text"); t.id = "txt_" + Date.now(); t.setAttribute("class", "duzenlenebilir"); t.setAttribute("x", center.cx); t.setAttribute("y", center.cy); t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "central"); window.setD(t, 'base-font-size', "80"); window.setD(t, 'raw-text', "YENİ METİN"); window.setD(t, 'solid-color', "#ffffff"); t.setAttribute("fill", "#ffffff"); t.setAttribute("font-size", "80"); t.setAttribute("font-family", "sans-serif"); t.textContent = "YENİ METİN";
    svg.appendChild(t); window.selectedEl = t; if(window.saveState) window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(t); if(window.renderEditor) window.renderEditor();
};

window.addShape = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const center = window.getCanvasCenter();
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); rect.id = "shp_" + Date.now(); rect.setAttribute("class", "duzenlenebilir"); rect.setAttribute("x", center.cx - 100); rect.setAttribute("y", center.cy - 100); rect.setAttribute("width", 200); rect.setAttribute("height", 200); window.setD(rect, 'solid-color', "#10b981"); rect.setAttribute("fill", "#10b981"); window.setD(rect, 'mask-shape', "none");
    svg.appendChild(rect); window.selectedEl = rect; if(window.saveState) window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(rect); if(window.renderEditor) window.renderEditor();
};

window.addVideo = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const dim = window.getSvgDim();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "vid_" + Date.now(); fo.setAttribute("class", "duzenlenebilir video-obj"); fo.setAttribute("x", dim.w/2 - 400); fo.setAttribute("y", dim.h/2 - 225); fo.setAttribute("width", 800); fo.setAttribute("height", 450);
    window.setD(fo, 'video-url', 'https://www.w3schools.com/html/mov_bbb.mp4'); window.setD(fo, 'video-muted', 'true'); window.setD(fo, 'video-loop', 'true'); window.setD(fo, 'mask-shape', 'none'); window.setD(fo, 'rx', '0');
    svg.appendChild(fo); if(window.updateVideoDisplay) window.updateVideoDisplay(fo);
    window.selectedEl = fo; if(window.saveState) window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(fo); if(window.renderEditor) window.renderEditor();
};

window.updateVideoDisplay = function(el) {
    if (!el || !el.classList.contains('video-obj')) return;
    const url = window.getD(el, 'video-url') || ''; const muted = window.getD(el, 'video-muted') === 'true' ? 'muted' : ''; const loop = window.getD(el, 'video-loop') === 'true' ? 'loop' : '';
    const isYT = url.includes('youtube.com') || url.includes('youtu.be'); const isHLS = url.includes('.m3u8');
    let innerHTMLString = '';
    if (isYT) {
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))((\w|-){11})/); const ytId = ytMatch ? ytMatch[1] : ''; const muteParam = window.getD(el, 'video-muted') === 'true' ? '&mute=1' : ''; const loopParam = window.getD(el, 'video-loop') === 'true' ? `&loop=1&playlist=${ytId}` : '';
        innerHTMLString = `<iframe style="width:100%; height:100%; pointer-events:none; border:none; background:#000;" src="https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&showinfo=0&enablejsapi=1&iv_load_policy=3${muteParam}${loopParam}&origin=${window.location.origin}" allow="autoplay; encrypted-media"></iframe>`;
    } else if (isHLS) {
        const vidId = "v_" + Date.now() + Math.floor(Math.random()*1000);
        innerHTMLString = `<video id="${vidId}" style="width:100%; height:100%; object-fit:cover; pointer-events:none; background:#000;" autoplay playsinline ${muted} ${loop}></video>`;
        setTimeout(() => { const vEl = document.getElementById(vidId); if (vEl && window.Hls && Hls.isSupported()) { const hls = new Hls({ maxBufferLength: 60, liveSyncDurationCount: 3 }); hls.loadSource(url); hls.attachMedia(vEl); } else if (vEl && vEl.canPlayType('application/vnd.apple.mpegurl')) { vEl.src = url; } }, 100);
    } else {
        innerHTMLString = `<video style="width:100%; height:100%; object-fit:cover; pointer-events:none; background:#000;" src="${url}" autoplay playsinline ${muted} ${loop}></video>`;
    }
    el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; background:#000; overflow:hidden;">${innerHTMLString}</div>`; if(window.applyShapeMask) window.applyShapeMask(el); 
};

window.addRssBand = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const dim = window.getSvgDim();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "rss_" + Date.now(); fo.setAttribute("class", "duzenlenebilir rss-band");
    fo.setAttribute("x", 0); fo.setAttribute("y", dim.h - 80); fo.setAttribute("width", dim.w); fo.setAttribute("height", 80);
    window.setD(fo, 'rss-url', 'https://www.cnnturk.com/feed/rss/all/news'); window.setD(fo, 'rss-speed', '35'); window.setD(fo, 'solid-color', '#dc2626'); window.setD(fo, 'text-color', '#ffffff'); window.setD(fo, 'base-font-size', '30');
    svg.appendChild(fo); if(window.updateRssDisplay) window.updateRssDisplay(fo);
    window.selectedEl = fo; if(window.saveState) window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(fo); if(window.renderEditor) window.renderEditor();
};

window.updateRssDisplay = function(el) {
    if (!el || !el.classList.contains('rss-band')) return;
    const url = window.getD(el, 'rss-url') || ''; const speed = window.getD(el, 'rss-speed') || '35'; const bgColor = window.getD(el, 'solid-color') || '#dc2626'; const txtColor = window.getD(el, 'text-color') || '#ffffff'; const fSize = window.getD(el, 'base-font-size') || '30';
    el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; overflow:hidden; background:${bgColor}; border-top:3px solid #fff;"><div class="rss-scroller" style="white-space:nowrap; color:${txtColor}; font-size:${fSize}px; font-weight:800; font-family:sans-serif; animation: scrollNews ${speed}s linear infinite; padding-left:100vw; letter-spacing:1px;">🔴 HABER BANT ÖNİZLEMESİ (${url || 'Link Yok'})</div></div>`;
};

window.addWeather = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const center = window.getCanvasCenter();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "wth_" + Date.now(); fo.setAttribute("class", "duzenlenebilir weather-widget");
    fo.setAttribute("x", center.cx - 250); fo.setAttribute("y", center.cy - 250); fo.setAttribute("width", 500); fo.setAttribute("height", 500);
    window.setD(fo, 'city', 'Istanbul'); window.setD(fo, 'theme', 'dark'); window.setD(fo, 'mask-shape', 'circle'); window.setD(fo, 'rx', '0'); fo.setAttribute('font-family', 'sans-serif');
    svg.appendChild(fo); if(window.updateWeatherDisplay) window.updateWeatherDisplay(fo);
    window.selectedEl = fo; if(window.saveState) window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(fo); if(window.renderEditor) window.renderEditor();
};

window.updateWeatherDisplay = async function(el) {
    if (!el || !el.classList.contains('weather-widget')) return;
    const city = window.getD(el, 'city') || 'Istanbul'; const txtColor = window.getD(el, 'text-color') || '#ffffff'; const font = el.getAttribute('font-family') || 'sans-serif';
    el.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:${txtColor}; font-family:${font};">Yükleniyor...</div>`;

    try {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`); const data = await res.json();
        const temp = data.current_condition[0].temp_C; const desc = data.current_condition[0].lang_tr?.[0]?.value || data.current_condition[0].weatherDesc[0].value; const engDesc = data.current_condition[0].weatherDesc[0].value;
        const iconMap = { "Sunny": "☀️", "Clear": "🌙", "Partly cloudy": "⛅", "Cloudy": "☁️", "Overcast": "☁️", "Mist": "🌫️", "Patchy rain possible": "🌦️", "Light rain": "🌧️", "Heavy rain": "🌧️", "Light snow": "🌨️", "Heavy snow": "❄️", "Moderate or heavy rain with thunder": "⛈️", "Fog": "🌫️" };
        const emoji = iconMap[engDesc] || "🌤️";

        let clockHTML = `
        <div class="weather-inner" xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; background: radial-gradient(circle, #2a2a2a 0%, #0a0a0a 100%); border-radius: 50%; position: relative; container-type: inline-size; font-family: ${font}; border: 1.5cqw solid #475569; box-shadow: inset 0 0 6cqw #000, 0 2cqw 10cqw rgba(0,0,0,0.8); overflow: hidden; color: ${txtColor};">
            <div style="position:absolute; inset: 18%; border-radius:50%; border: 0.5cqw dashed rgba(255,255,255,0.1);"></div>
            <div style="position:absolute; top:19%; left:50%; transform:translate(-50%, -50%); font-size:4cqw; color:rgba(255,255,255,0.6); font-weight:bold;">12</div>
            <div style="position:absolute; bottom:19%; left:50%; transform:translate(-50%, 50%); font-size:4cqw; color:rgba(255,255,255,0.6); font-weight:bold;">6</div>
            <div style="position:absolute; left:19%; top:50%; transform:translate(-50%, -50%); font-size:4cqw; color:rgba(255,255,255,0.6); font-weight:bold;">9</div>
            <div style="position:absolute; right:19%; top:50%; transform:translate(50%, -50%); font-size:4cqw; color:rgba(255,255,255,0.6); font-weight:bold;">3</div>

            <div style="position:absolute; top:6%; left:50%; transform:translate(-50%, 0); text-align:center;"><div style="font-size:5cqw; line-height:1.2;">${emoji}</div><div style="font-size:3.5cqw; font-weight:bold;">${temp}°</div></div>
            <div style="position:absolute; bottom:6%; left:50%; transform:translate(-50%, 0); text-align:center;"><div style="font-size:5cqw; line-height:1.2;">🌧️</div><div style="font-size:3.5cqw; font-weight:bold;">14°</div></div>
            <div style="position:absolute; top:50%; left:6%; transform:translate(0, -50%); text-align:center;"><div style="font-size:5cqw; line-height:1.2;">⛅</div><div style="font-size:3.5cqw; font-weight:bold;">16°</div></div>
            <div style="position:absolute; top:50%; right:6%; transform:translate(0, -50%); text-align:center;"><div style="font-size:5cqw; line-height:1.2;">☀️</div><div style="font-size:3.5cqw; font-weight:bold;">${temp}°</div></div>

            <div style="position:absolute; top:35%; left:50%; transform:translate(-50%, -50%); display:flex; align-items:center; gap:1cqw;">
                <div style="background:#111; padding:0.5cqw 2cqw; border-radius:0.5cqw; font-size:5cqw; font-weight:bold; color:var(--accent); border:1px solid #333; box-shadow:inset 0 0 1cqw rgba(0,0,0,1);">14:30</div>
                <div style="font-size:3cqw; color:rgba(255,255,255,0.5); font-weight:bold;">PM</div>
            </div>

            <div style="position:absolute; top:50%; left:30%; transform:translate(-50%, -50%); background:#111; padding:0.5cqw 1.5cqw; border-radius:0.5cqw; font-size:3.5cqw; font-weight:bold; border:1px solid #333;">CUM</div>
            <div style="position:absolute; top:50%; right:30%; transform:translate(50%, -50%); background:#111; padding:0.5cqw 1.5cqw; border-radius:0.5cqw; font-size:3.5cqw; font-weight:bold; border:1px solid #333;">28</div>

            <div style="position:absolute; bottom:28%; left:50%; transform:translateX(-50%); text-align:center; width:60%;">
                <div style="font-size:3.5cqw; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:0.1cqw;">${city.toUpperCase()}</div>
                <div style="font-size:2.5cqw; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${desc}</div>
            </div>

            <div class="analog-hour" style="position:absolute; bottom:50%; left:calc(50% - 0.75cqw); width:1.5cqw; height:20cqw; background:#e2e8f0; transform-origin:bottom center; transform:rotate(45deg); border-radius:1cqw; box-shadow:0 1cqw 2cqw rgba(0,0,0,0.5);"></div>
            <div class="analog-min" style="position:absolute; bottom:50%; left:calc(50% - 0.5cqw); width:1cqw; height:30cqw; background:#38bdf8; transform-origin:bottom center; transform:rotate(120deg); border-radius:1cqw; box-shadow:0 1cqw 2cqw rgba(0,0,0,0.5);"></div>
            <div class="analog-sec" style="position:absolute; bottom:50%; left:calc(50% - 0.2cqw); width:0.4cqw; height:35cqw; background:#ef4444; transform-origin:bottom center; transform:rotate(210deg); box-shadow:0 1cqw 2cqw rgba(0,0,0,0.5);"></div>
            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:4cqw; height:4cqw; background:#0f172a; border:0.8cqw solid #94a3b8; border-radius:50%; box-shadow:0 1cqw 2cqw rgba(0,0,0,0.8);"></div>
        </div>`;
        el.innerHTML = clockHTML;
    } catch(e) {
        el.innerHTML = `<div style="color:red; background:#000; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">Veri Hatası</div>`;
    }
};

window.addCurrency = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const dim = window.getSvgDim();
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "cur_" + Date.now(); fo.setAttribute("class", "duzenlenebilir currency-widget");
    fo.setAttribute("x", dim.w/2 - 300); fo.setAttribute("y", dim.h/2 - 75); fo.setAttribute("width", 600); fo.setAttribute("height", 150);
    window.setD(fo, 'currencies', 'USD,EUR,GBP'); window.setD(fo, 'solid-color', '#000000'); window.setD(fo, 'bg-opacity', '0.6'); window.setD(fo, 'text-color', '#ffffff'); window.setD(fo, 'mask-shape', 'none'); window.setD(fo, 'rx', '15'); fo.setAttribute('font-family', 'sans-serif');
    svg.appendChild(fo); if(window.updateCurrencyDisplay) window.updateCurrencyDisplay(fo);
    window.selectedEl = fo; if(window.saveState) window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(fo); if(window.renderEditor) window.renderEditor();
};

window.updateCurrencyDisplay = async function(el) {
    if (!el || !el.classList.contains('currency-widget')) return;
    const curs = (window.getD(el, 'currencies') || 'USD,EUR,GBP').split(',').map(c=>c.trim().toUpperCase()); const txtColor = window.getD(el, 'text-color') || '#ffffff'; const font = el.getAttribute('font-family') || 'sans-serif';
    el.innerHTML = `<div class="currency-inner" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:${txtColor}; font-family:${font}; container-type: inline-size; box-sizing:border-box; padding:2cqw;">Yükleniyor...</div>`;

    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD'); const data = await res.json(); const tryRate = data.rates['TRY'];
        let htmlBlocks = '';
        curs.forEach(c => {
            let val = "0.00"; if(c === 'USD') val = tryRate.toFixed(2); else if(data.rates[c]) { val = (tryRate / data.rates[c]).toFixed(2); }
            let flag = "💰"; if(c==='USD') flag="🇺🇸"; if(c==='EUR') flag="🇪🇺"; if(c==='GBP') flag="🇬🇧"; if(c==='CHF') flag="🇨🇭"; if(c==='JPY') flag="🇯🇵"; if(c==='SAR' || c==='AED') flag="🇸🇦";
            htmlBlocks += `<div style="display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.15); padding:3cqw 2cqw; border-radius:1cqw; min-width:25cqw;"><span style="font-size:10cqw; margin-bottom:1cqw; line-height:1;">${flag}</span><span style="font-size:6cqw; color:var(--accent); font-weight:bold; line-height:1;">${c}</span><span style="font-size:10cqw; font-weight:800; line-height:1;">₺${val}</span></div>`;
        });
        el.innerHTML = `<div class="currency-inner" xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; display:flex; align-items:center; justify-content:space-evenly; color:${txtColor}; font-family:${font}; container-type: inline-size; box-sizing:border-box; padding:2cqw;">${htmlBlocks}</div>`;
    } catch(e) {
        el.innerHTML = `<div class="currency-inner" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:${txtColor}; font-family:${font}; container-type: inline-size;">Hata: Kurlar Alınamadı</div>`;
    }
};

window.processImportedFile = function(file) {
    if (!file) return;
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parser = new DOMParser(); const doc = parser.parseFromString(ev.target.result, "image/svg+xml"); const importedSvg = doc.documentElement;
                if (importedSvg.tagName === 'parsererror') { if(window.showToast) window.showToast("Geçersiz SVG", "error"); return; }
                const mainSvg = document.querySelector('#canvas-inner svg'); const center = window.getCanvasCenter();
                importedSvg.id = "svg_import_" + Date.now(); importedSvg.setAttribute("class", "duzenlenebilir");
                importedSvg.style.position = ""; importedSvg.style.left = ""; importedSvg.style.top = "";
                let w = parseFloat(importedSvg.getAttribute('width')) || 400; let h = parseFloat(importedSvg.getAttribute('height')) || 400;
                if(importedSvg.hasAttribute('viewBox') && (!importedSvg.hasAttribute('width') || !importedSvg.hasAttribute('height'))) {
                    const vb = importedSvg.getAttribute('viewBox').split(/\s+|,/); if(vb.length >= 4) { w = parseFloat(vb[2]); h = parseFloat(vb[3]); importedSvg.setAttribute('width', w); importedSvg.setAttribute('height', h); }
                }
                importedSvg.setAttribute("x", center.cx - (w / 2)); importedSvg.setAttribute("y", center.cy - (h / 2));
                mainSvg.appendChild(importedSvg); window.selectedEl = importedSvg; if(window.saveState) window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(importedSvg); if(window.renderEditor) window.renderEditor(); if(window.showToast) window.showToast("SVG Eklendi", "success");
            } catch(e) { if(window.showToast) window.showToast("Hata!", "error"); }
        }; reader.readAsText(file);
    } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const svg = document.querySelector('#canvas-inner svg'); const center = window.getCanvasCenter();
            const img = document.createElementNS("http://www.w3.org/2000/svg", "image"); img.id = "img_" + Date.now(); img.setAttribute("class", "duzenlenebilir"); img.setAttribute("x", center.cx - 150); img.setAttribute("y", center.cy - 150); img.setAttribute("width", 300); img.setAttribute("height", 300); window.setD(img, "rx", "0"); window.setD(img, "smoothing", "0.5"); window.setD(img, "mask-shape", "none"); img.setAttribute("href", ev.target.result);
            svg.appendChild(img); window.selectedEl = img; if(window.saveState) window.saveState(); if(window.setupLayers) window.setupLayers(); if(window.updateUI) window.updateUI(img); if(window.renderEditor) window.renderEditor();
        }; reader.readAsDataURL(file);
    }
};

window.downloadSVG = function() {
    const svg = document.querySelector('#canvas-inner svg'); if(!svg) return; const clone = svg.cloneNode(true);
    clone.querySelectorAll('.duzenlenebilir, .locked, .guide-line, .snap-line, .handle, .video-obj, .weather-widget, .currency-widget').forEach(el => { el.classList.remove('duzenlenebilir', 'locked'); if (el.classList.length === 0) el.removeAttribute('class'); });
    const ctrl = clone.querySelector('#control-layer'); if (ctrl) clone.removeChild(ctrl);
    const data = new XMLSerializer().serializeToString(clone); const blob = new Blob([data], {type: "image/svg+xml;charset=utf-8"}); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = (document.getElementById('file-selector')?.value || 'tasarim') + '.svg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); if(window.showToast) window.showToast("SVG Dosyası İndirildi!", "success");
};