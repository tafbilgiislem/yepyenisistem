// --- 🌟 ARAYÜZ VE ÖZELLİKLER (PROPERTIES) MOTORU 🌟 ---

// 1. Hızlı Metin Yerleştirme (Auto-Text) Güncelleyici
window.refreshAutoTextFields = function() {
    const list = document.getElementById('auto-fields-list'); 
    const svg = document.querySelector('#canvas-inner svg'); 
    if(!svg || !list) return;
    
    const textElements = svg.querySelectorAll('text.duzenlenebilir'); 
    list.innerHTML = ""; 
    let hasVars = false;
    
    textElements.forEach((el, index) => {
        hasVars = true;
        const varName = el.getAttribute('data-var-name') || `YAZI ${index + 1}`;
        const currentVal = window.getD(el, 'raw-text') || el.textContent; 
        const row = document.createElement('div'); 
        row.style.marginBottom = "8px";
        row.innerHTML = `
            <div class="label-row"><span class="label-text" style="color:#f472b6;"><i class="ph ph-text-aa"></i> ${varName}</span></div>
            <input type="text" value="${currentVal.replace(/"/g, '&quot;')}" oninput="window.updateVarValue('${el.id}', this.value)" onchange="if(window.saveState) window.saveState()" style="border-color:rgba(244,114,182,0.3);">
        `; 
        list.appendChild(row);
    });
    
    if(!hasVars) {
        list.innerHTML = `<div style="font-size:11px; color:#64748b; text-align:center;">Sahnede henüz yazı yok. Yazı eklediğinizde burada listelenecektir.</div>`;
    }
};

window.updateVarValue = function(id, val) { 
    const el = document.getElementById(id); if(!el) return; 
    window.changeSetting(id, 'raw-text', val); 
    if(window.selectedEl && window.selectedEl.id === id) { 
        document.querySelectorAll('input[oninput*="raw-text"]').forEach(input => { 
            if(!input.getAttribute('oninput').includes('updateVarValue')) input.value = val; 
        }); 
    } 
};

// 2. Temel Özellik Değiştirici (X, Y, Genişlik, Yükseklik)
window.changeProp = function(id, prop, val, elUI) {
    const el = document.getElementById(id); if(!el) return;
    if(prop === 'x') el.setAttribute('x', val); 
    if(prop === 'y') el.setAttribute('y', val);
    if(prop === 'w') { 
        if(el.tagName === 'text') { 
            if(val > 10) { 
                el.setAttribute('textLength', val); el.setAttribute('lengthAdjust', 'spacingAndGlyphs'); 
                const tp = el.querySelector('textPath'); 
                if (tp) { tp.setAttribute('textLength', val); tp.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } 
            } else { 
                el.removeAttribute('textLength'); el.removeAttribute('lengthAdjust'); 
                const tp = el.querySelector('textPath'); 
                if (tp) { tp.removeAttribute('textLength'); tp.removeAttribute('lengthAdjust'); } 
            } 
        } else { 
            el.setAttribute('width', val); 
        } 
    }
    if(prop === 'h') { 
        if(el.tagName === 'text') { 
            window.setD(el, 'base-font-size', val); el.setAttribute('font-size', val); 
        } else { 
            el.setAttribute('height', val); 
        } 
    }
    
    if (elUI) { 
        const badge = document.getElementById('val-' + prop + '-' + id); 
        if (badge) badge.innerText = val + 'px'; 
        if (elUI.type === 'range' && elUI.nextElementSibling && elUI.nextElementSibling.type === 'number') elUI.nextElementSibling.value = val; 
        else if (elUI.type === 'number' && elUI.previousElementSibling && elUI.previousElementSibling.type === 'range') elUI.previousElementSibling.value = val; 
    }
    
    if(el.tagName === 'text' && window.applyTextCurve) window.applyTextCurve(el); 
    if(window.updateUI) window.updateUI(el);
};

// 3. Gelişmiş Ayar Değiştirici (Renkler, Efektler, Ayarlar)
window.changeSetting = function(id, key, val, elUI) {
    const el = document.getElementById(id); if(!el) return; 
    window.setD(el, key, val);
    
    if (key === 'raw-text') { 
        el.removeAttribute('textLength'); el.removeAttribute('lengthAdjust'); 
        const tp = el.querySelector('textPath'); 
        if (tp) { tp.removeAttribute('textLength'); tp.removeAttribute('lengthAdjust'); } 
    }
    
    if(key === 'curve' || key === 'raw-text' || key === 'letter-spacing' || key === 'max-width' || key === 'max-height') { 
        if(key === 'letter-spacing') el.setAttribute('letter-spacing', val); 
        if(window.applyTextCurve) window.applyTextCurve(el); 
    }
    
    if(key === 'angle' && window.applyTransforms) window.applyTransforms(el);
    
    if(['solid-color', 'color1', 'color2', 'fill-type', 'bg-opacity'].includes(key)) { 
        if(window.applyFill) window.applyFill(el); 
    }
    
    // API Tetikleyicileri
    if(key === 'rss-url' || key === 'rss-speed' || key === 'text-color') { 
        if(el.classList.contains('rss-band') && window.updateRssDisplay) window.updateRssDisplay(el); 
    }
    if(key === 'video-url' || key === 'video-muted' || key === 'video-loop') { 
        if(el.classList.contains('video-obj') && window.updateVideoDisplay) window.updateVideoDisplay(el); 
    }
    if(key === 'city') { 
        if(el.classList.contains('weather-widget') && window.updateWeatherDisplay) window.updateWeatherDisplay(el); 
    }
    if(key === 'currencies') { 
        if(el.classList.contains('currency-widget') && window.updateCurrencyDisplay) window.updateCurrencyDisplay(el); 
    }
    
    if (elUI) { 
        const badge = document.getElementById('val-' + key + '-' + id); 
        if (badge) badge.innerText = val + (key === 'angle' ? '°' : (key === 'curve' ? '' : 'px')); 
        if (elUI.type === 'range' && elUI.nextElementSibling && elUI.nextElementSibling.type === 'number') elUI.nextElementSibling.value = val; 
        else if (elUI.type === 'number' && elUI.previousElementSibling && elUI.previousElementSibling.type === 'range') elUI.previousElementSibling.value = val; 
    }
    if(window.updateUI) window.updateUI(el);
};

// 4. Dolgu ve Arkaplan Renk Uygulayıcı (Infinite Loop Korumalı)
window.applyFill = function(el) {
    if(el.tagName === 'image' || el.classList.contains('rss-band') || el.classList.contains('video-obj') || el.classList.contains('weather-widget') || el.classList.contains('currency-widget')) {
        if (el.classList.contains('weather-widget') || el.classList.contains('currency-widget') || el.classList.contains('rss-band')) {
            const type = window.getD(el, 'fill-type') || 'solid'; 
            let fillVal = window.getD(el, 'solid-color') || '#000000';
            
            let innerDiv = el.querySelector('.weather-inner') || el.querySelector('.currency-inner') || (el.querySelector('.rss-scroller') ? el.querySelector('.rss-scroller').parentElement : null);
            if (!innerDiv) innerDiv = el.querySelector('div');

            if (innerDiv) {
                const bgOpacity = window.getD(el, 'bg-opacity') !== null ? parseFloat(window.getD(el, 'bg-opacity')) : (el.classList.contains('rss-band') ? 1 : 0.6);
                let finalBg = fillVal;
                if (type === 'solid' && fillVal.startsWith('#')) {
                    let hex = fillVal; 
                    if(hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
                    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
                    
                    if(el.classList.contains('weather-widget')) {
                        finalBg = `radial-gradient(circle, rgba(${r},${g},${b},${bgOpacity}) 0%, rgba(${Math.max(0, r-40)},${Math.max(0, g-40)},${Math.max(0, b-40)},${bgOpacity}) 100%)`;
                    } else {
                        finalBg = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
                    }
                }
                innerDiv.style.background = finalBg;
            }
        }
        return; 
    }
    
    const type = window.getD(el, 'fill-type') || 'solid'; let fillVal = '';
    if (type === 'gradient') {
        const c1 = window.getD(el, 'color1') || '#10b981'; const c2 = window.getD(el, 'color2') || '#3b82f6';
        const svg = document.querySelector('#canvas-inner svg'); let defs = svg.querySelector('defs'); 
        if (!defs) { defs = document.createElementNS("http://www.w3.org/2000/svg", "defs"); svg.prepend(defs); }
        let gradId = "grad_" + el.id; let grad = defs.querySelector("#" + gradId);
        if (!grad) { 
            grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient"); 
            grad.id = gradId; grad.setAttribute("x1", "0%"); grad.setAttribute("y1", "0%"); grad.setAttribute("x2", "100%"); grad.setAttribute("y2", "100%"); 
            const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop"); stop1.setAttribute("offset", "0%"); stop1.className = "stop1"; 
            const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop"); stop2.setAttribute("offset", "100%"); stop2.className = "stop2"; 
            grad.appendChild(stop1); grad.appendChild(stop2); defs.appendChild(grad); 
        }
        grad.querySelector(".stop1").setAttribute("stop-color", c1); 
        grad.querySelector(".stop2").setAttribute("stop-color", c2); 
        fillVal = `url(#${gradId})`;
    } else { 
        fillVal = window.getD(el, 'solid-color'); 
    }
    
    if (!fillVal && type !== 'gradient') return;
    el.setAttribute("fill", fillVal); 
    if(el.tagName !== 'path') el.style.fill = fillVal;
    if(el.tagName === 'g' || el.tagName === 'svg') { 
        el.querySelectorAll('path, circle, rect, polygon').forEach(child => { 
            child.style.fill = fillVal; child.setAttribute('fill', fillVal); 
        }); 
    }
};

// 5. Efekt ve Metin Stilleri
window.changeFilter = function(id, filterType, val, elUI) {
    const el = document.getElementById(id); if(!el) return;
    if(filterType === 'opacity') el.setAttribute('opacity', val); 
    else window.setD(el, filterType, val); 
    
    if(window.applyFilters) window.applyFilters(el);
    
    if (elUI) { 
        const badge = document.getElementById('val-' + (filterType==='opacity'?'op':(filterType==='shadow-x'?'sx':(filterType==='shadow-y'?'sy':(filterType==='shadow-blur'?'sb':'bl')))) + '-' + id); 
        if (badge) badge.innerText = (filterType==='opacity' ? Math.round(val*100)+'%' : val+'px'); 
        if (elUI.type === 'range' && elUI.nextElementSibling && elUI.nextElementSibling.type === 'number') elUI.nextElementSibling.value = val; 
        else if (elUI.type === 'number' && elUI.previousElementSibling && elUI.previousElementSibling.type === 'range') elUI.previousElementSibling.value = val; 
    }
};

window.applyTextStyle = function(id, style, val) {
    const el = document.getElementById(id); if(!el || el.tagName !== 'text') return; 
    const rawText = window.getD(el, 'raw-text') || el.textContent;
    
    if(style === 'normal') { 
        el.innerHTML = ''; el.textContent = rawText; window.setD(el, 'text-style', 'normal'); 
        if(window.applyTextCurve) window.applyTextCurve(el); 
    }
    else if(style === 'neon') { 
        window.setD(el, 'text-style', 'neon'); 
        el.innerHTML = `<tspan font-weight="bold" fill="#ffffff" stroke="${window.getD(el, 'solid-color')||'#000'}" stroke-width="2" filter="drop-shadow(0 0 15px ${window.getD(el, 'solid-color')||'#000'})">${rawText}</tspan>`; 
    }
    else if(style === '3d') { 
        window.setD(el, 'text-style', '3d'); 
        el.innerHTML = `<tspan font-weight="bold" fill="${window.getD(el, 'solid-color')||'#000'}" stroke="#000000" stroke-width="3" filter="drop-shadow(6px 6px 0 #000000)">${rawText}</tspan>`; 
    }
    else if(style === 'hollow') { 
        window.setD(el, 'text-style', 'hollow'); 
        el.innerHTML = `<tspan fill="none" stroke="${window.getD(el, 'solid-color')||'#000'}" stroke-width="4">${rawText}</tspan>`; 
    }
    else if(style === 'bold') { 
        window.setD(el, 'bold', window.getD(el, 'bold') === 'true' ? 'false' : 'true'); 
        el.setAttribute('font-weight', window.getD(el, 'bold') === 'true' ? 'bold' : 'normal'); 
    }
    else if(style === 'italic') { 
        window.setD(el, 'italic', window.getD(el, 'italic') === 'true' ? 'false' : 'true'); 
        el.setAttribute('font-style', window.getD(el, 'italic') === 'true' ? 'italic' : 'normal'); 
    }
    else if(style === 'underline') { 
        window.setD(el, 'underline', window.getD(el, 'underline') === 'true' ? 'false' : 'true'); 
        el.setAttribute('text-decoration', window.getD(el, 'underline') === 'true' ? 'underline' : 'none'); 
    }
    else if(style === 'align') { 
        el.setAttribute('text-anchor', val); 
        if(window.autoFitText) window.autoFitText(el); 
    } 
    
    if(window.saveState) window.saveState(); 
    if(window.renderEditor) window.renderEditor(); 
    if(window.updateUI) window.updateUI(el);
};

window.alignElement = function(id, type) {
    const el = document.getElementById(id); if(!el) return; 
    const dim = window.getSvgDim(); const w = dim.w, h = dim.h;
    let bbox = {x:0, y:0, width:0, height:0}; try { bbox = el.getBBox(); } catch(e){}
    
    if (el.tagName === 'text') { 
        if(type === 'center-h') el.setAttribute('x', w/2); 
        if(type === 'center-v') el.setAttribute('y', h/2); 
        if(type === 'left') el.setAttribute('x', bbox.width/2); 
        if(type === 'right') el.setAttribute('x', w - bbox.width/2); 
    } else { 
        let nw = parseFloat(el.getAttribute('width')) || bbox.width; 
        let nh = parseFloat(el.getAttribute('height')) || bbox.height; 
        if(type === 'center-h') el.setAttribute('x', (w/2) - (nw/2)); 
        if(type === 'center-v') el.setAttribute('y', (h/2) - (nh/2)); 
        if(type === 'left') el.setAttribute('x', 0); 
        if(type === 'right') el.setAttribute('x', w - nw); 
    } 
    if(window.saveState) window.saveState(); 
    if(window.updateUI) window.updateUI(el);
};

window.toggleFlip = function(id, dir) { 
    const el = document.getElementById(id); if(!el) return; 
    if(dir === 'x') window.setD(el, 'flip-x', window.getD(el, 'flip-x') === "-1" ? "1" : "-1"); 
    else window.setD(el, 'flip-y', window.getD(el, 'flip-y') === "-1" ? "1" : "-1"); 
    if(window.applyTransforms) window.applyTransforms(el); 
    if(window.saveState) window.saveState(); 
};

// 6. Göz Damlası (Renk Seçici)
window.pickColor = async function(id, dataKey, attrToSet) {
    if (!window.EyeDropper) { window.showToast("Tarayıcı desteklemiyor", "error"); return; }
    try { 
        const eyeDropper = new EyeDropper(); 
        const result = await eyeDropper.open(); 
        const color = result.sRGBHex; 
        const el = document.getElementById(id); 
        if(el) { 
            if(window.addRecentColor) window.addRecentColor(color); 
            if (dataKey) window.setD(el, dataKey.replace(/([A-Z])/g, "-$1").toLowerCase(), color); 
            if (dataKey === 'color1' || dataKey === 'color2' || dataKey === 'solidColor') {
                if(window.applyFill) window.applyFill(el); 
            } else { 
                el.setAttribute(attrToSet, color); 
            } 
            if(window.saveState) window.saveState(); 
            if(window.renderProperties) window.renderProperties(); 
        } 
    } catch (e) {}
};

window.applyRecentColor = function(id, color) { 
    const el = document.getElementById(id); if(!el) return; 
    const fillType = window.getD(el, 'fill-type') || 'solid'; 
    if(fillType === 'solid') { window.setD(el, 'solid-color', color); if(window.applyFill) window.applyFill(el); } 
    else { window.setD(el, 'color1', color); if(window.applyFill) window.applyFill(el); } 
    if(window.saveState) window.saveState(); 
    if(window.renderProperties) window.renderProperties(); 
};

// 7. DEVASA FONKSİYON: Sağ Panel (Özellikler) Oluşturucu
function createPropGroup(title, content) { 
    return `<div class="prop-group"><div class="prop-group-title">${title}</div>${content}</div>`; 
}

const googleFonts = [
    { name: "Varsayılan", val: "sans-serif" }, 
    { name: "Times New Roman", val: "'Times New Roman', Times, serif" },
    { name: "Roboto", val: "'Roboto', sans-serif" }, 
    { name: "Montserrat", val: "'Montserrat', sans-serif" }, 
    { name: "Poppins", val: "'Poppins', sans-serif" }, 
    { name: "Oswald", val: "'Oswald', sans-serif" }, 
    { name: "Pacifico", val: "'Pacifico', cursive" }
];

window.renderProperties = function() {
    const f = document.getElementById('editor-fields'); if(!f) return; 
    if (!window.selectedEl || !window.selectedEl.tagName) { 
        if(window.renderEditor) window.renderEditor(); return; 
    }
    
    try {
        const el = window.selectedEl; const id = el.id; const tag = el.tagName.toLowerCase();
        const isLocked = window.getD(el, 'locked') === "true"; 
        const isPath = tag === 'path'; const isShape = tag === 'rect'; const isImage = tag === 'image'; const isIcon = tag === 'svg' || tag === 'g';
        const isRss = el.classList.contains('rss-band');
        const isVideo = el.classList.contains('video-obj');
        const isWeather = el.classList.contains('weather-widget');
        const isCurrency = el.classList.contains('currency-widget');
        const isText = tag === 'text' || isRss; 
        const isWidget = isWeather || isCurrency;
        
        let typeName = tag.toUpperCase(); let headerIcon = 'ph-square'; 
        if (isShape) { typeName = 'ŞEKİL'; headerIcon = 'ph-square'; } 
        if (isIcon) { typeName = 'VEKTÖR'; headerIcon = 'ph-shapes'; } 
        if (isPath) { typeName = 'ÇİZİM'; headerIcon = 'ph-scribble-loop'; } 
        if (isImage) { typeName = 'RESİM'; headerIcon = 'ph-image'; } 
        if (tag === 'text') { typeName = 'METİN'; headerIcon = 'ph-text-t'; }
        if (isRss) { typeName = 'HABER BANT (RSS)'; headerIcon = 'ph-newspaper'; }
        if (isVideo) { typeName = 'VİDEO / YOUTUBE'; headerIcon = 'ph-video-camera'; }
        if (isWeather) { typeName = 'HAVA DURUMU'; headerIcon = 'ph-cloud-sun'; }
        if (isCurrency) { typeName = 'DÖVİZ TABLOSU'; headerIcon = 'ph-currency-circle-dollar'; }

        let layoutHtml = "", styleHtml = "", textHtml = "", codeHtml = "", videoHtml = "", widgetHtml = "";
        
        let headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid var(--border);">
            <div style="font-size:14px; color:white; font-weight:bold; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
                <i class="ph ${headerIcon}" style="color:var(--accent);"></i> ${typeName} AYARLARI ${isLocked ? '<i class="ph ph-lock-key" style="color:#ef4444;"></i>' : ''}
            </div>
            <div class="delete-btn" style="cursor:pointer; color:#94a3b8; font-size:20px; transition:0.2s;" title="Sil" onclick="if(confirm('Silinecek?')){ document.getElementById('${id}').remove(); window.selectedEl=null; window.saveState(); window.renderEditor(); const ctrl = document.getElementById('control-layer'); if(ctrl) ctrl.innerHTML=''; }">
                <i class="ph ph-x-circle"></i>
            </div>
        </div>
        <div class="action-row" style="margin-bottom:20px;">
            <button class="action-btn" onclick="window.toggleLock('${id}')" style="background:${isLocked?'var(--error)':'#334155'}"><i class="ph ${isLocked?'ph-lock-key-open':'ph-lock-key'}"></i> ${isLocked ? 'KİLİDİ AÇ' : 'KİLİTLE'}</button>
            <button class="action-btn special" onclick="window.cloneElement('${id}')" ${isLocked ? 'disabled':''}><i class="ph ph-copy"></i> KOPYALA</button>
        </div>`;
        
        if (isLocked) { 
            f.innerHTML = headerHtml + `<div style="text-align:center; color:#ef4444; font-size:12px; margin-top:30px;"><i class="ph ph-lock-key" style="font-size:40px; display:block; margin-bottom:10px; opacity:0.5;"></i> Bu öğe kilitli. Düzenlemek için kilidini açın.</div>`; 
            return; 
        }
        
        if (!isText && !isVideo && !isWidget && (window.activeTabId === 'tab-text' || window.activeTabId === 'tab-video' || window.activeTabId === 'tab-widget')) window.activeTabId = 'tab-layout';
        if (isVideo && window.activeTabId !== 'tab-video' && window.activeTabId !== 'tab-layout' && window.activeTabId !== 'tab-style' && window.activeTabId !== 'tab-code') window.activeTabId = 'tab-video';
        if (isWidget && window.activeTabId !== 'tab-widget' && window.activeTabId !== 'tab-layout' && window.activeTabId !== 'tab-style' && window.activeTabId !== 'tab-code') window.activeTabId = 'tab-widget';
        if (isText && window.activeTabId !== 'tab-text' && window.activeTabId !== 'tab-layout' && window.activeTabId !== 'tab-style' && window.activeTabId !== 'tab-code') window.activeTabId = 'tab-text';

        let tabsNav = `<div class="tabs-header">
            <button class="tab-btn ${window.activeTabId === 'tab-layout' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-layout')"><i class="ph ph-bounding-box"></i> Düzen</button>
            <button class="tab-btn ${window.activeTabId === 'tab-style' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-style')"><i class="ph ph-palette"></i> Stil</button>
            ${isText ? `<button class="tab-btn ${window.activeTabId === 'tab-text' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-text')"><i class="ph ph-text-t"></i> Metin</button>` : ''}
            ${isVideo ? `<button class="tab-btn ${window.activeTabId === 'tab-video' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-video')"><i class="ph ph-video-camera"></i> Medya</button>` : ''}
            ${isWidget ? `<button class="tab-btn ${window.activeTabId === 'tab-widget' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-widget')"><i class="ph ph-plug"></i> Widget</button>` : ''}
            <button class="tab-btn ${window.activeTabId === 'tab-code' ? 'active' : ''}" onclick="window.switchTab(this, 'tab-code')"><i class="ph ph-code"></i> Kod</button>
        </div>`;

        // LAYOUT SEKMESİ (Konum, Boyut, Çevirme)
        if(!isPath) {
            let bbox = {x:0, y:0, width:0, height:0}; try { bbox = el.getBBox(); } catch(e){}
            const x = Math.round(parseFloat(el.getAttribute("x")) || bbox.x || 0); const y = Math.round(parseFloat(el.getAttribute("y")) || bbox.y || 0); let w = 0, h = 0;
            if(tag === 'text') { w = Math.round(parseFloat(el.getAttribute("textLength")) || bbox.width || 0); h = Math.round(parseFloat(window.getD(el, "base-font-size")) || 60); } else { w = Math.round(parseFloat(el.getAttribute("width")) || bbox.width || 0); h = Math.round(parseFloat(el.getAttribute("height")) || bbox.height || 0); }
            const angle = parseFloat(window.getD(el, 'angle')) || 0;
            
            layoutHtml += createPropGroup("<i class='ph ph-intersect'></i> Hizalama & Çevirme", `<div class="action-row" style="margin-bottom:8px;"><button class="action-btn" onclick="window.alignElement('${id}', 'left')"><i class="ph ph-align-left"></i> SOL</button><button class="action-btn" onclick="window.alignElement('${id}', 'center-h')"><i class="ph ph-align-center-horizontal"></i> ORTA</button><button class="action-btn" onclick="window.alignElement('${id}', 'right')"><i class="ph ph-align-right"></i> SAĞ</button></div><div class="action-row" style="margin-bottom:10px;"><button class="action-btn" onclick="window.alignElement('${id}', 'center-v')"><i class="ph ph-align-center-vertical"></i> DİKEY ORTA</button><button class="action-btn" onclick="window.toggleFlip('${id}', 'x')"><i class="ph ph-arrows-left-right"></i> YATAY ÇEVİR</button><button class="action-btn" onclick="window.toggleFlip('${id}', 'y')"><i class="ph ph-arrows-down-up"></i> DİKEY ÇEVİR</button></div>`);
            layoutHtml += createPropGroup("<i class='ph ph-arrows-out'></i> Konum ve Boyut", `<div class="label-row"><span class="label-text">X KONUMU</span><span class="value-badge" id="val-x-${id}">${x}px</span></div><div style="display:flex; gap:10px; margin-bottom:15px;"><input type="range" min="-1000" max="3000" value="${x}" style="flex:1;" oninput="window.changeProp('${id}', 'x', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${x}" style="width:70px; padding:8px;" oninput="window.changeProp('${id}', 'x', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">Y KONUMU</span><span class="value-badge" id="val-y-${id}">${y}px</span></div><div style="display:flex; gap:10px; margin-bottom:15px;"><input type="range" min="-1000" max="3000" value="${y}" style="flex:1;" oninput="window.changeProp('${id}', 'y', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${y}" style="width:70px; padding:8px;" oninput="window.changeProp('${id}', 'y', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">${tag === 'text' ? 'GENİŞLİK (ESNETME W)' : 'GENİŞLİK (W)'}</span><span class="value-badge" id="val-w-${id}">${w}px</span></div><div style="display:flex; gap:10px; margin-bottom:15px;"><input type="range" min="1" max="2500" value="${w}" style="flex:1;" oninput="window.changeProp('${id}', 'w', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${w}" style="width:70px; padding:8px;" oninput="window.changeProp('${id}', 'w', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">${tag === 'text' ? 'YAZI PUNTO (H)' : 'YÜKSEKLİK (H)'}</span><span class="value-badge" id="val-h-${id}">${h}px</span></div><div style="display:flex; gap:10px;"><input type="range" min="1" max="2500" value="${h}" style="flex:1;" oninput="window.changeProp('${id}', 'h', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${h}" style="width:70px; padding:8px;" oninput="window.changeProp('${id}', 'h', this.value, this);" onchange="if(window.saveState) window.saveState()"></div>`);
            layoutHtml += createPropGroup("<i class='ph ph-arrows-clockwise'></i> Dönüştürme", `<div class="label-row" style="margin-top:0;"><span class="label-text">DÖNDÜRME AÇISI</span><span class="value-badge" id="val-angle-${id}">${angle}°</span></div><div style="display:flex; gap:10px; align-items:center;"><input type="range" min="0" max="360" value="${angle}" style="flex:1;" oninput="window.changeSetting('${id}', 'angle', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${angle}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'angle', this.value, this);" onchange="if(window.saveState) window.saveState()"></div>`);
        }

        // STYLE SEKMESİ (Dolgu, Arkaplan, Çizgi, Maske, Efektler)
        if ((isShape || isImage || isVideo || isWidget) && !isRss) {
            const rx = parseFloat(window.getD(el, 'rx')) || 0; 
            const maskShape = window.getD(el, 'mask-shape') || 'none'; 
            let bbox = {width:0, height:0}; try { bbox = el.getBBox(); }catch(e){} 
            const maxR = Math.min(bbox.width, bbox.height) / 2;
            
            layoutHtml += createPropGroup("<i class='ph ph-scissors'></i> Form & Maskeleme", `<div class="label-text" style="margin-bottom:5px;">MASKELEME ŞEKLİ</div><select class="font-select" style="margin-bottom:15px;" onchange="window.changeSetting('${id}', 'mask-shape', this.value); if(window.saveState) window.saveState();"><option value="none" ${maskShape === 'none' ? 'selected' : ''}>Yok (Düz)</option><option value="squircle" ${maskShape === 'squircle' ? 'selected' : ''}>Oval Kare (Squircle)</option><option value="circle" ${maskShape === 'circle' ? 'selected' : ''}>Daire</option><option value="triangle" ${maskShape === 'triangle' ? 'selected' : ''}>Üçgen</option><option value="star" ${maskShape === 'star' ? 'selected' : ''}>Yıldız</option></select><div class="label-row"><span class="label-text">KÖŞE YARIÇAPI (SQUIRCLE)</span><span class="value-badge" id="val-rx-${id}">${Math.round(rx)}px</span></div><div style="display:flex; gap:10px; align-items:center;"><input type="range" min="0" max="${maxR}" value="${rx}" style="flex:1;" oninput="window.changeSetting('${id}', 'rx', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${rx}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'rx', this.value, this);" onchange="if(window.saveState) window.saveState()"></div>`);
            
            if (isImage) {
                const imageList = window.getD(el, 'image-list') || '';
                layoutHtml += createPropGroup("<i class='ph ph-images'></i> İç Resim Slaydı", `<div class="label-text" style="margin-bottom:5px;">ÇOKLU RESİM LİNKLERİ (VİRGÜLLE AYIRIN)</div><textarea placeholder="https://resim1.jpg, https://resim2.jpg" style="width:100%; height:60px; background:#000; color:#fff; border:1px solid var(--border); padding:8px; border-radius:6px; font-size:11px;" oninput="window.changeSetting('${id}', 'image-list', this.value);" onchange="if(window.saveState) window.saveState()">${imageList}</textarea><div style="font-size:10px; color:#94a3b8; margin-top:5px; font-style:italic;">Buraya birden fazla resim linki girerseniz, yayın ekranında bu alan otomatik slayt gibi döner.</div>`);
            }
        }

        if (!isImage && !isVideo && !isWidget) {
            const fillType = window.getD(el, 'fill-type') || 'solid'; 
            const col1 = window.getD(el, 'color1') || '#10b981'; 
            const col2 = window.getD(el, 'color2') || '#3b82f6'; 
            const solidCol = window.getD(el, 'solid-color') || (el.getAttribute('fill') === 'none' ? el.getAttribute('stroke') : el.getAttribute('fill')) || "#ffffff";
            
            let fillHtml = `<div class="label-text" style="margin-bottom:5px;">${isRss?'ARKA PLAN':'DOLGU TİPİ'}</div>`;
            if (!isRss) fillHtml += `<select class="font-select" style="margin-bottom:15px;" onchange="window.changeSetting('${id}', 'fill-type', this.value); if(window.saveState) window.saveState();"><option value="solid" ${fillType === 'solid' ? 'selected' : ''}>Düz Renk</option><option value="gradient" ${fillType === 'gradient' ? 'selected' : ''}>Renk Geçişi (Gradient)</option></select>`;
            
            if (fillType === 'solid' || isRss) { 
                fillHtml += `<div style="display:flex; gap:10px; align-items:center;"><input type="color" value="${window.safeColor(solidCol)}" oninput="window.changeSetting('${id}', 'solid-color', this.value); this.nextElementSibling.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();" style="width:45px; height:45px; cursor:pointer; border:none; background:none; border-radius:8px;"><button class="action-btn" style="flex:0 0 45px; padding:12px; background:#334155; font-size:18px;" onclick="window.pickColor('${id}', 'solidColor', 'fill')" title="Göz Damlası"><i class="ph ph-drop"></i></button><input type="text" value="${window.safeColor(solidCol)}" style="flex:1;" oninput="window.changeSetting('${id}', 'solid-color', this.value); this.previousElementSibling.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();"></div>`; 
            } else { 
                fillHtml += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;"><div class="input-group"><span class="label-text">RENK 1</span><div style="display:flex; gap:5px; align-items:center;"><input type="color" value="${window.safeColor(col1)}" oninput="window.changeSetting('${id}', 'color1', this.value);" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();" style="width:35px; height:35px; cursor:pointer; border:none; background:none;"><button class="action-btn" style="padding:8px; background:#334155; font-size:16px;" onclick="window.pickColor('${id}', 'color1', '')"><i class="ph ph-drop"></i></button></div></div><div class="input-group"><span class="label-text">RENK 2</span><div style="display:flex; gap:5px; align-items:center;"><input type="color" value="${window.safeColor(col2)}" oninput="window.changeSetting('${id}', 'color2', this.value);" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();" style="width:35px; height:35px; cursor:pointer; border:none; background:none;"><button class="action-btn" style="padding:8px; background:#334155; font-size:16px;" onclick="window.pickColor('${id}', 'color2', '')"><i class="ph ph-drop"></i></button></div></div></div>`; 
            }
            
            fillHtml += `<div class="label-text" style="margin-top:15px; margin-bottom:8px;">PROJE RENKLERİ</div><div class="swatch-container">` + (window.recentColors || []).map(c => `<div class="color-swatch" style="background:${c}" onclick="window.applyRecentColor('${id}', '${c}')" title="${c}"></div>`).join('') + `</div>`;
            styleHtml += createPropGroup("<i class='ph ph-paint-bucket'></i> Dolgu & Renk", fillHtml);
        }
        
        if(isWidget || isRss) {
            const bgOpacity = window.getD(el, 'bg-opacity') || (isRss ? '1' : '0.6');
            const solidCol = window.getD(el, 'solid-color') || '#000000';
            styleHtml += createPropGroup("<i class='ph ph-paint-bucket'></i> Arka Plan Ayarları", `<div class="label-text" style="margin-bottom:5px;">ARKA PLAN RENGİ</div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="color" value="${window.safeColor(solidCol)}" oninput="window.changeSetting('${id}', 'solid-color', this.value); this.nextElementSibling.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();" style="width:45px; height:45px; cursor:pointer; border:none; background:none; border-radius:8px;"><button class="action-btn" style="flex:0 0 45px; padding:12px; background:#334155; font-size:18px;" onclick="window.pickColor('${id}', 'solidColor', 'fill')" title="Göz Damlası"><i class="ph ph-drop"></i></button><input type="text" value="${window.safeColor(solidCol)}" style="flex:1;" oninput="window.changeSetting('${id}', 'solid-color', this.value); this.previousElementSibling.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();"></div><div class="label-row"><span class="label-text">ARKA PLAN SAYDAMLIK</span><span class="value-badge" id="val-bg-opacity-${id}">${Math.round(bgOpacity*100)}%</span></div><div style="display:flex; gap:10px; align-items:center;"><input type="range" min="0" max="1" step="0.05" value="${bgOpacity}" style="flex:1;" oninput="window.changeSetting('${id}', 'bg-opacity', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" min="0" max="1" step="0.05" value="${bgOpacity}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'bg-opacity', this.value, this);" onchange="if(window.saveState) window.saveState()"></div>`);
        }

        if(!isRss && !isVideo && !isWidget) {
            const strokeCol = el.getAttribute('stroke') || '#000000'; const strokeW = parseFloat(el.getAttribute('stroke-width')) || 0; const dash = el.getAttribute('stroke-dasharray') || 'none';
            styleHtml += createPropGroup("<i class='ph ph-square-logo'></i> Kenarlık & Çizgi", `<div class="label-text" style="margin-bottom:5px;">ÇİZGİ RENGİ</div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="color" value="${window.safeColor(strokeCol)}" oninput="const t=document.getElementById('${id}'); t.setAttribute('stroke', this.value); t.setAttribute('paint-order', 'stroke fill'); t.setAttribute('stroke-linejoin', 'round'); this.nextElementSibling.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();" style="width:45px; height:45px; cursor:pointer; border:none; background:none; border-radius:8px;"><button class="action-btn" style="flex:0 0 45px; padding:12px; background:#334155; font-size:18px;" onclick="window.pickColor('${id}', '', 'stroke')" title="Göz Damlası"><i class="ph ph-drop"></i></button><input type="text" value="${window.safeColor(strokeCol)}" style="flex:1;" oninput="const t=document.getElementById('${id}'); t.setAttribute('stroke', this.value); t.setAttribute('paint-order', 'stroke fill'); t.setAttribute('stroke-linejoin', 'round'); this.previousElementSibling.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();"></div><div class="label-row"><span class="label-text">KALINLIK</span><span class="value-badge" id="val-sw-${id}">${strokeW}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="0" max="50" value="${strokeW}" style="flex:1;" oninput="const t=document.getElementById('${id}'); t.setAttribute('stroke-width', this.value); t.setAttribute('paint-order', 'stroke fill'); document.getElementById('val-sw-${id}').innerText=this.value+'px'; this.nextElementSibling.value=this.value;" onchange="if(window.saveState) window.saveState()"><input type="number" value="${strokeW}" style="width:70px; padding:8px;" oninput="const t=document.getElementById('${id}'); t.setAttribute('stroke-width', this.value); t.setAttribute('paint-order', 'stroke fill'); document.getElementById('val-sw-${id}').innerText=this.value+'px'; this.previousElementSibling.value=this.value;" onchange="if(window.saveState) window.saveState()"></div><div class="label-text" style="margin-bottom:5px;">ÇİZGİ TİPİ</div><select class="font-select" onchange="document.getElementById('${id}').setAttribute('stroke-dasharray', this.value); if(window.saveState) window.saveState();"><option value="none" ${dash === 'none' ? 'selected' : ''}>Düz</option><option value="5,5" ${dash === '5,5' ? 'selected' : ''}>Kesikli</option><option value="2,2" ${dash === '2,2' ? 'selected' : ''}>Noktalı</option></select>`);
        }
        
        let opacityVal = parseFloat(el.getAttribute('opacity')); if (isNaN(opacityVal)) opacityVal = 1;
        const sX = parseFloat(window.getD(el, 'shadow-x')) || 0, sY = parseFloat(window.getD(el, 'shadow-y')) || 0, sB = parseFloat(window.getD(el, 'shadow-blur')) || 0, sC = window.getD(el, 'shadow-color') || '#000000', bl = parseFloat(window.getD(el, 'blur')) || 0; const blend = window.getD(el, 'blend') || 'normal';
        styleHtml += createPropGroup("<i class='ph ph-magic-wand'></i> Efektler & Görünüm", `<div class="label-row"><span class="label-text">SAYDAMLIK (OPACITY)</span><span class="value-badge" id="val-opacity-${id}">${Math.round(opacityVal*100)}%</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="0" max="1" step="0.05" value="${opacityVal}" style="flex:1;" oninput="window.changeFilter('${id}', 'opacity', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" min="0" max="1" step="0.05" value="${opacityVal}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'opacity', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-text" style="margin-bottom:5px;">KARIŞIM MODU (BLEND)</div><select class="font-select" style="margin-bottom:15px;" onchange="window.changeFilter('${id}', 'blend', this.value); if(window.saveState) window.saveState();"><option value="normal" ${blend === 'normal' ? 'selected' : ''}>Normal</option><option value="multiply" ${blend === 'multiply' ? 'selected' : ''}>Çoğalt (Multiply)</option><option value="screen" ${blend === 'screen' ? 'selected' : ''}>Ekran (Screen)</option><option value="overlay" ${blend === 'overlay' ? 'selected' : ''}>Kaplama (Overlay)</option></select><div class="group-box"><div class="label-text" style="color:white; margin-bottom:10px;"><i class="ph ph-drop-half-bottom"></i> GÖLGE VE BLUR</div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="color" value="${sC}" oninput="window.changeFilter('${id}', 'shadow-color', this.value); this.nextElementSibling.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();" style="width:40px; height:40px; cursor:pointer; border:radius:8px; border:none; background:none;"><button class="action-btn" style="padding:10px; background:#334155; font-size:16px;" onclick="window.pickColor('${id}', 'shadow-color', '')"><i class="ph ph-drop"></i></button><input type="text" value="${sC}" style="flex:1;" oninput="window.changeFilter('${id}', 'shadow-color', this.value); this.previousElementSibling.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();"></div><div class="label-row"><span class="label-text">GÖLGE X</span><span class="value-badge" id="val-shadow-x-${id}">${sX}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="-100" max="100" value="${sX}" style="flex:1;" oninput="window.changeFilter('${id}', 'shadow-x', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${sX}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'shadow-x', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">GÖLGE Y</span><span class="value-badge" id="val-shadow-y-${id}">${sY}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="-100" max="100" value="${sY}" style="flex:1;" oninput="window.changeFilter('${id}', 'shadow-y', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${sY}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'shadow-y', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">GÖLGE YAYILMASI</span><span class="value-badge" id="val-shadow-blur-${id}">${sB}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="0" max="100" value="${sB}" style="flex:1;" oninput="window.changeFilter('${id}', 'shadow-blur', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${sB}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'shadow-blur', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">NESNE BULANIKLIĞI</span><span class="value-badge" id="val-blur-${id}">${bl}px</span></div><div style="display:flex; gap:10px; align-items:center;"><input type="range" min="0" max="100" value="${bl}" style="flex:1;" oninput="window.changeFilter('${id}', 'blur', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${bl}" style="width:70px; padding:8px;" oninput="window.changeFilter('${id}', 'blur', this.value, this);" onchange="if(window.saveState) window.saveState()"></div></div>`);

        // TEXT SEKMESİ
        if (tag === 'text') {
            const rawText = (window.getD(el, 'raw-text') || el.textContent).replace(/'/g, "&apos;").replace(/"/g, "&quot;"); 
            const varName = window.getD(el, 'var-name') || "";
            let rectOptions = `<option value="">-- Serbest Bırak (Sabitleme Yok) --</option>`; 
            document.querySelectorAll('#canvas-inner svg rect.duzenlenebilir, #canvas-inner svg image.duzenlenebilir').forEach(r => { 
                rectOptions += `<option value="${r.id}" ${window.getD(el, 'bound-rect') === r.id ? 'selected' : ''}>Şekil: ${r.id}</option>`; 
            });
            textHtml += createPropGroup("<i class='ph ph-text-t'></i> Metin ve Sabitleme", `<div style="margin-bottom:10px;"><div class="label-text" style="margin-bottom:5px;">METİN İÇERİĞİ</div><input type="text" value="${rawText}" oninput="window.changeSetting('${id}', 'raw-text', this.value); window.refreshAutoTextFields();" onchange="if(window.saveState) window.saveState()" placeholder="Metni girin..." style="margin-bottom:10px;"></div><div style="margin-bottom:10px;"><div class="label-text" style="color:#f472b6; margin-bottom:5px;">OTOMATİK DEĞİŞKEN ADI (Örn: FIYAT)</div><input type="text" value="${varName}" placeholder="Boş bırakırsanız listede görünmez" oninput="this.value = this.value.toUpperCase(); window.setD(document.getElementById('${id}'), 'var-name', this.value); window.refreshAutoTextFields();" onchange="if(window.saveState) window.saveState()" style="border-color:#f472b6;"></div><div style="padding:10px; background:rgba(16, 185, 129, 0.1); border:1px solid #10b981; border-radius:8px; margin-top:10px;"><div class="label-text" style="color:#10b981; margin-bottom:5px;"><i class="ph ph-intersect"></i> BİR KUTUYA SABİTLE (ORTALA & SIĞDIR)</div><div style="font-size:10px; color:#94a3b8; margin-bottom:8px; font-style:italic;">Seçilen kutunun tam ortasına yapışır ve taşmayı önler.</div><select class="font-select" style="border-color:#10b981; background:#0f172a;" onchange="window.changeSetting('${id}', 'bound-rect', this.value); if(window.autoFitText) window.autoFitText(document.getElementById('${id}')); if(window.updateUI) window.updateUI(document.getElementById('${id}')); if(window.saveState) window.saveState();">${rectOptions}</select></div>`);
            
            const ls = parseFloat(el.getAttribute("letter-spacing")) || 0; const currentFont = el.getAttribute("font-family") || "sans-serif"; const curve = parseFloat(window.getD(el, 'curve')) || 0; const mw = parseFloat(window.getD(el, 'max-width')) || 0; const mh = parseFloat(window.getD(el, 'max-height')) || 0; const isB = el.getAttribute('font-weight') === 'bold'; const isI = el.getAttribute('font-style') === 'italic'; const isU = el.getAttribute('text-decoration') === 'underline'; const tAlign = el.getAttribute('text-anchor') || 'middle';
            let fontOptionsHtml = googleFonts.map(font => `<option value="${font.val}" style="font-family: ${font.val}" ${currentFont.includes(font.name) ? "selected" : ""}>${font.name}</option>`).join('');
            
            textHtml += createPropGroup("<i class='ph ph-text-aa'></i> Yazı Tipi & Biçimlendirme", `<select class="font-select" style="margin-bottom:15px;" onchange="const t=document.getElementById('${id}'); t.setAttribute('font-family', this.value); t.style.fontFamily=this.value; if(window.applyTextCurve) window.applyTextCurve(t); if(window.updateUI) window.updateUI(t); if(window.saveState) window.saveState();">${fontOptionsHtml}</select><div style="display:flex; gap:5px; margin-bottom:15px;"><button class="action-btn ${isB?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'bold')"><i class="ph ph-text-b"></i></button><button class="action-btn ${isI?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'italic')"><i class="ph ph-text-italic"></i></button><button class="action-btn ${isU?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'underline')"><i class="ph ph-text-underline"></i></button><div style="width:1px; background:var(--border); margin:0 5px;"></div><button class="action-btn ${tAlign==='start'?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'align', 'start')"><i class="ph ph-text-align-left"></i></button><button class="action-btn ${tAlign==='middle'?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'align', 'middle')"><i class="ph ph-text-align-center"></i></button><button class="action-btn ${tAlign==='end'?'active':''}" style="flex:1; font-size:16px;" onclick="window.applyTextStyle('${id}', 'align', 'end')"><i class="ph ph-text-align-right"></i></button></div><div class="action-row" style="margin-bottom:15px;"><button class="action-btn" onclick="window.applyTextStyle('${id}', 'normal')">Stil Temizle</button><button class="action-btn special" onclick="document.getElementById('${id}').removeAttribute('textLength'); document.getElementById('${id}').removeAttribute('lengthAdjust'); if(window.autoFitText) window.autoFitText(document.getElementById('${id}')); if(window.saveState) window.saveState(); window.renderProperties();"><i class="ph ph-arrows-out-line-horizontal"></i> ESNETMEYİ SIFIRLA</button></div><div class="action-row" style="margin-bottom:15px;"><button class="action-btn" onclick="window.applyTextStyle('${id}', 'neon')">Neon</button><button class="action-btn" onclick="window.applyTextStyle('${id}', '3d')">3D</button><button class="action-btn" onclick="window.applyTextStyle('${id}', 'hollow')">Hollow</button></div><div class="label-row"><span class="label-text">EĞRİLİK (KAVİS)</span><span class="value-badge" id="val-curve-${id}">${curve}</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="-100" max="100" value="${curve}" style="flex:1;" oninput="window.changeSetting('${id}', 'curve', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${curve}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'curve', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">HARF ARALIĞI</span><span class="value-badge" id="val-letter-spacing-${id}">${ls}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="-20" max="100" value="${ls}" style="flex:1;" oninput="window.changeSetting('${id}', 'letter-spacing', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${ls}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'letter-spacing', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">SIĞDIRMA GENİŞLİK (MAX-W)</span><span class="value-badge" id="val-max-width-${id}">${mw === 0 ? 'KAPALI' : mw+'px'}</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="0" max="2000" value="${mw}" style="flex:1;" oninput="window.changeSetting('${id}', 'max-width', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${mw}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'max-width', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">SIĞDIRMA YÜKSEKLİK (MAX-H)</span><span class="value-badge" id="val-max-height-${id}">${mh === 0 ? 'KAPALI' : mh+'px'}</span></div><div style="display:flex; gap:10px; align-items:center;"><input type="range" min="0" max="2000" value="${mh}" style="flex:1;" oninput="window.changeSetting('${id}', 'max-height', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${mh}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'max-height', this.value, this);" onchange="if(window.saveState) window.saveState()"></div>`);
        } else if (isRss) {
            const url = window.getD(el, 'rss-url') || ''; const speed = window.getD(el, 'rss-speed') || '35'; const txtColor = window.getD(el, 'text-color') || '#ffffff'; const fSize = window.getD(el, 'base-font-size') || '30';
            textHtml += createPropGroup("<i class='ph ph-rss'></i> Haber Akış Ayarları", `<div class="label-text">RSS LİNKİ (Haber Kaynağı)</div><input type="text" value="${url}" oninput="window.changeSetting('${id}', 'rss-url', this.value);" placeholder="Örn: https://..."><br><br><div class="label-row"><span class="label-text">AKIŞ HIZI (Düşük = Hızlı)</span><span class="value-badge" id="val-rss-speed-${id}">${speed}s</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="5" max="150" value="${speed}" style="flex:1;" oninput="window.changeSetting('${id}', 'rss-speed', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${speed}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'rss-speed', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-row"><span class="label-text">YAZI PUNTO</span><span class="value-badge" id="val-base-font-size-${id}">${fSize}px</span></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;"><input type="range" min="10" max="200" value="${fSize}" style="flex:1;" oninput="window.changeSetting('${id}', 'base-font-size', this.value, this);" onchange="if(window.saveState) window.saveState()"><input type="number" value="${fSize}" style="width:70px; padding:8px;" oninput="window.changeSetting('${id}', 'base-font-size', this.value, this);" onchange="if(window.saveState) window.saveState()"></div><div class="label-text">YAZI RENGİ</div><div style="display:flex; gap:10px; align-items:center;"><input type="color" value="${window.safeColor(txtColor)}" oninput="window.changeSetting('${id}', 'text-color', this.value); this.nextElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();" style="width:45px; height:45px; cursor:pointer; border:none; background:none; border-radius:8px;"><input type="text" value="${window.safeColor(txtColor)}" style="flex:1;" oninput="window.changeSetting('${id}', 'text-color', this.value); this.previousElementSibling.value=this.value;" onchange="window.addRecentColor(this.value); if(window.saveState) window.saveState();"></div>`);
        } else if (isVideo) {
            const url = window.getD(el, 'video-url') || ''; const isMuted = window.getD(el, 'video-muted') === 'true'; const isLoop = window.getD(el, 'video-loop') === 'true';
            videoHtml += createPropGroup("<i class='ph ph-video-camera'></i> Medya Ayarları", `<div class="label-text" style="margin-bottom:5px;">VİDEO LİNKİ (MP4 / M3U8 / YOUTUBE)</div><input type="text" value="${url}" oninput="window.changeSetting('${id}', 'video-url', this.value);" placeholder="Örn: https://youtu.be/..." style="margin-bottom:15px;"><div class="action-row"><button class="action-btn ${isMuted ? 'active' : ''}" onclick="window.changeSetting('${id}', 'video-muted', '${!isMuted}'); window.renderProperties(); if(window.saveState) window.saveState();"><i class="ph ${isMuted ? 'ph-speaker-slash' : 'ph-speaker-high'}"></i> ${isMuted ? 'SESSİZ' : 'SESLİ'}</button><button class="action-btn ${isLoop ? 'active' : ''}" onclick="window.changeSetting('${id}', 'video-loop', '${!isLoop}'); window.renderProperties(); if(window.saveState) window.saveState();"><i class="ph ph-arrows-clockwise"></i> ${isLoop ? 'DÖNGÜ (AÇIK)' : 'DÖNGÜ (KAPALI)'}</button></div><div style="font-size:10px; color:#94a3b8; font-style:italic;">YouTube linklerini veya .m3u8 IPTV linklerini doğrudan yapıştırın, sistem otomatik çevirir. TV için sessiz oynaması önerilir.</div>`);
        } else if (isWeather) {
            const city = window.getD(el, 'city') || 'Istanbul'; const font = el.getAttribute('font-family') || 'sans-serif'; let fontOptionsHtml = googleFonts.map(f => `<option value="${f.val}" style="font-family: ${f.val}" ${font.includes(f.name) ? "selected" : ""}>${f.name}</option>`).join('');
            widgetHtml += createPropGroup("<i class='ph ph-cloud-sun'></i> Hava Durumu Ayarları", `<div class="label-text" style="margin-bottom:5px;">ŞEHİR ADI</div><input type="text" value="${city}" oninput="window.changeSetting('${id}', 'city', this.value);" placeholder="Örn: Istanbul" style="margin-bottom:15px;"><div class="label-text" style="margin-bottom:5px;">YAZI TİPİ</div><select class="font-select" onchange="const t=document.getElementById('${id}'); t.setAttribute('font-family', this.value); t.style.fontFamily=this.value; if(window.updateWeatherDisplay) window.updateWeatherDisplay(t); if(window.saveState) window.saveState();">${fontOptionsHtml}</select><button class="action-btn active" style="width:100%; margin-top:15px;" onclick="if(window.updateWeatherDisplay) window.updateWeatherDisplay(document.getElementById('${id}'));"><i class="ph ph-arrows-clockwise"></i> VERİYİ YENİLE</button>`);
        } else if (isCurrency) {
            const curs = window.getD(el, 'currencies') || 'USD,EUR,GBP'; const font = el.getAttribute('font-family') || 'sans-serif'; let fontOptionsHtml = googleFonts.map(f => `<option value="${f.val}" style="font-family: ${f.val}" ${font.includes(f.name) ? "selected" : ""}>${f.name}</option>`).join('');
            widgetHtml += createPropGroup("<i class='ph ph-currency-circle-dollar'></i> Döviz Ayarları", `<div class="label-text" style="margin-bottom:5px;">GÖSTERİLECEK KURLAR (Virgülle Ayırın)</div><input type="text" value="${curs}" oninput="window.changeSetting('${id}', 'currencies', this.value.toUpperCase());" placeholder="USD,EUR,GBP" style="margin-bottom:15px;"><div class="label-text" style="margin-bottom:5px;">YAZI TİPİ</div><select class="font-select" onchange="const t=document.getElementById('${id}'); t.setAttribute('font-family', this.value); t.style.fontFamily=this.value; if(window.updateCurrencyDisplay) window.updateCurrencyDisplay(t); if(window.saveState) window.saveState();">${fontOptionsHtml}</select><div style="font-size:10px; color:#94a3b8; font-style:italic;">Desteklenen: USD, EUR, GBP, CHF, JPY, SAR vb. Canlı serbest piyasa kurları çekilir.</div><button class="action-btn active" style="width:100%; margin-top:15px;" onclick="if(window.updateCurrencyDisplay) window.updateCurrencyDisplay(document.getElementById('${id}'));"><i class="ph ph-arrows-clockwise"></i> VERİYİ YENİLE</button>`);
        }

        codeHtml += createPropGroup("<i class='ph ph-file-code'></i> Canlı SVG Kodu", `<textarea id="raw-svg-code" style="width:100%; height:250px; background:#000; color:var(--accent); font-family:monospace; font-size:11px; padding:10px; border-radius:8px; border:1px solid var(--border); resize:vertical;" onchange="if(window.saveState) window.saveState()">${el.outerHTML.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea><button class="action-btn active" style="width:100%; margin-top:10px; padding:12px;" onclick="window.applyRawCode('${id}')"><i class="ph ph-terminal-window"></i> KODU UYGULA</button>`);
        
        f.innerHTML = headerHtml + tabsNav + 
            `<div id="tab-layout" class="tab-content ${window.activeTabId === 'tab-layout' ? 'active' : ''}">${layoutHtml}</div>` + 
            `<div id="tab-style" class="tab-content ${window.activeTabId === 'tab-style' ? 'active' : ''}">${styleHtml}</div>` + 
            (isText ? `<div id="tab-text" class="tab-content ${window.activeTabId === 'tab-text' ? 'active' : ''}">${textHtml}</div>` : '') + 
            (isVideo ? `<div id="tab-video" class="tab-content ${window.activeTabId === 'tab-video' ? 'active' : ''}">${videoHtml}</div>` : '') + 
            (isWidget ? `<div id="tab-widget" class="tab-content ${window.activeTabId === 'tab-widget' ? 'active' : ''}">${widgetHtml}</div>` : '') +
            `<div id="tab-code" class="tab-content ${window.activeTabId === 'tab-code' ? 'active' : ''}">${codeHtml}</div>`;
            
    } catch(err) { 
        f.innerHTML = `<div style="color:var(--error); padding:20px; font-size:12px; text-align:center;"><i class="ph ph-warning-circle" style="font-size:32px; display:block; margin-bottom:10px;"></i> Özellikler yüklenemedi.</div>`; 
    }
};

window.switchTab = function(btn, tabId) { 
    const wrapper = btn.closest('#editor-fields'); 
    if (!wrapper) return; 
    window.activeTabId = tabId;
    wrapper.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    wrapper.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
    btn.classList.add('active'); 
    wrapper.querySelector('#' + tabId).classList.add('active'); 
};