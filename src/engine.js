// --- ⚙️ MOTOR (ENGINE): Sürükle-Bırak, Yeniden Boyutlandırma ve SVG Matematik Motoru ---

window.applyRawCode = function(id) {
    try { 
        let p = new DOMParser(); 
        let code = document.getElementById('raw-svg-code').value.trim(); 
        let n; 
        if (!code.toLowerCase().startsWith('<svg')) { 
            let d = p.parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + code + '</svg>', 'image/svg+xml'); 
            n = d.documentElement.firstElementChild; 
        } else { 
            let d = p.parseFromString(code, 'image/svg+xml'); 
            n = d.documentElement; 
        } 
        if(!n) throw new Error('Geçersiz SVG'); 
        
        let o = document.getElementById(id); 
        o.replaceWith(n); 
        window.selectedEl = n; 
        if(!window.selectedEl.id) window.selectedEl.id='el_'+Date.now(); 
        if(!window.selectedEl.classList.contains('duzenlenebilir')) window.selectedEl.classList.add('duzenlenebilir'); 
        
        if(window.saveState) window.saveState(); 
        if(window.setupLayers) window.setupLayers(); 
        window.updateUI(window.selectedEl); 
        if(window.renderEditor) window.renderEditor(); 
        if(window.showToast) window.showToast("Özel Kod Uygulandı!"); 
    } catch(err) { 
        if(window.showToast) window.showToast('Lütfen geçerli bir SVG kodu girin.', 'error'); 
    }
};

window.initEngine = function(svg) {
    const wrapper = document.getElementById('svg-wrapper'); 
    const ctrl = document.getElementById('control-layer');
    
    const getCoords = (e) => { 
        const pt = svg.createSVGPoint(); 
        pt.x = e.clientX; 
        pt.y = e.clientY; 
        const ctm = svg.getScreenCTM(); 
        if (!ctm) return { x: 0, y: 0 }; 
        const cursorpt = pt.matrixTransform(ctm.inverse()); 
        return { x: cursorpt.x, y: cursorpt.y }; 
    };

    if(wrapper) {
        wrapper.onpointerdown = (e) => {
            if (window.isSpacePressed) { 
                window.isPanning = true; 
                window.panStart = {x: e.clientX, y: e.clientY}; 
                window.panOffsetStart = {x: window.panX, y: window.panY}; 
                document.getElementById('svg-wrapper')?.classList.add('panning'); 
                return; 
            }
            const p = getCoords(e); const target = e.target; window.isModified = false;
            
            if (window.isDrawingMode) {
                window.isDrawing = true; 
                window.currentPath = document.createElementNS("http://www.w3.org/2000/svg", "path"); 
                window.currentPath.id = "pth_" + Date.now(); 
                window.currentPath.setAttribute("class", "duzenlenebilir"); 
                window.currentPath.setAttribute("fill", "none"); 
                window.currentPath.setAttribute("stroke", "#10b981"); 
                window.currentPath.setAttribute("stroke-width", "5"); 
                window.currentPath.setAttribute("stroke-linecap", "round"); 
                window.currentPath.setAttribute("stroke-linejoin", "round"); 
                window.pathData = `M ${p.x} ${p.y}`; 
                window.currentPath.setAttribute("d", window.pathData);
                
                const guidesGroup = document.getElementById('guides-group'); 
                if(guidesGroup) svg.insertBefore(window.currentPath, guidesGroup); 
                else svg.appendChild(window.currentPath);
                try { wrapper.setPointerCapture(e.pointerId); } catch(err){} 
                return;
            }
            
            if (target.classList.contains('guide-line')) { 
                window.isDraggingGuide = true; window.currentGuide = target; 
                try { wrapper.setPointerCapture(e.pointerId); } catch(err){} 
                e.preventDefault(); e.stopPropagation(); return; 
            }
            
            if (target.classList.contains('handle')) {
                const el = document.getElementById(target.dataset.id); 
                if (!el || window.getD(el, 'locked') === "true") return;
                
                let tempW = 0, tempH = 0; 
                if(el.tagName === 'text') { 
                    tempW = parseFloat(el.getAttribute("textLength")) || el.getBBox().width || 0; 
                    tempH = parseFloat(window.getD(el, "base-font-size")) || 80; 
                } else { 
                    tempW = parseFloat(el.getAttribute("width")) || 0; 
                    tempH = parseFloat(el.getAttribute("height")) || 0; 
                }
                
                window.startP = p; 
                window.startData = { 
                    x: parseFloat(el.getAttribute("x")) || 0, 
                    y: parseFloat(el.getAttribute("y")) || 0, 
                    w: tempW, h: tempH, 
                    rx: parseFloat(window.getD(el, 'rx')) || 0, 
                    baseFontSize: parseFloat(window.getD(el, 'base-font-size')) || 60 
                };
                
                if (target.classList.contains('handle-resize')) { window.resizingEl = el; window.activeHandle = target.dataset.handle; } 
                else if (target.classList.contains('handle-rotate')) { window.rotatingEl = el; } 
                else if (target.classList.contains('handle-radius')) { window.radiusingEl = el; }
                
                try { wrapper.setPointerCapture(e.pointerId); } catch(err){} 
                e.preventDefault(); e.stopPropagation(); return;
            }
            
            const el = target.closest('.duzenlenebilir');
            if (el) {
                if (e.altKey && window.getD(el, 'locked') !== "true") { 
                    const clone = el.cloneNode(true); 
                    clone.id = "el_" + Date.now(); 
                    clone.classList.add("duzenlenebilir"); 
                    el.parentNode.insertBefore(clone, el.nextSibling); 
                    window.selectedEl = clone; 
                } else { 
                    window.selectedEl = el; 
                }
                
                window.isDraggingElement = true; 
                window.offset.x = p.x - (parseFloat(window.selectedEl.getAttribute("x")) || 0); 
                window.offset.y = p.y - (parseFloat(window.selectedEl.getAttribute("y")) || 0); 
                window.updateUI(window.selectedEl); 
                if(window.renderEditor) window.renderEditor();
                
                if(window.getD(window.selectedEl, 'locked') !== "true") { 
                    try { wrapper.setPointerCapture(e.pointerId); } catch(err){} 
                }
            } else { 
                if(!e.target.closest('#sidebar')) { 
                    window.selectedEl = null; 
                    if(ctrl) ctrl.innerHTML = ""; 
                    if(window.renderEditor) window.renderEditor(); 
                } 
            }
        };

        wrapper.onpointermove = (e) => {
            if (window.isPanning) { 
                window.panX = window.panOffsetStart.x + ((e.clientX - window.panStart.x) / window.currentZoom); 
                window.panY = window.panOffsetStart.y + ((e.clientY - window.panStart.y) / window.currentZoom); 
                if(window.applyZoom) window.applyZoom(); 
                if(window.syncRulerTransform) window.syncRulerTransform(); 
                return; 
            }
            
            const p = getCoords(e);
            
            if (window.isDrawing && window.currentPath) { window.pathData += ` L ${p.x} ${p.y}`; window.currentPath.setAttribute("d", window.pathData); return; }
            if (window.isDraggingGuide && window.currentGuide) { 
                if(window.getD(window.currentGuide, 'type') === 'h') { window.currentGuide.setAttribute('y1', p.y); window.currentGuide.setAttribute('y2', p.y); } 
                else { window.currentGuide.setAttribute('x1', p.x); window.currentGuide.setAttribute('x2', p.x); } 
                return; 
            }
            
            if (!window.selectedEl && !window.resizingEl && !window.rotatingEl && !window.radiusingEl) return;
            if (window.selectedEl && window.getD(window.selectedEl, 'locked') === "true" && !window.resizingEl && !window.rotatingEl && !window.radiusingEl) return; 
            if (window.isDraggingElement || window.resizingEl || window.rotatingEl || window.radiusingEl) e.preventDefault(); 
            
            const dx = p.x - window.startP.x; const dy = p.y - window.startP.y; 

            if (window.resizingEl) {
                window.isModified = true; let { x, y, w, h } = window.startData;
                
                if (window.activeHandle === 'br') { w += dx; h += dy; } 
                else if (window.activeHandle === 'bl') { x += dx; w -= dx; h += dy; } 
                else if (window.activeHandle === 'tr') { y += dy; w += dx; h -= dy; } 
                else if (window.activeHandle === 'tl') { x += dx; y += dy; w -= dx; h -= dy; }
                
                if (window.resizingEl.tagName === "text") { 
                    if(w > 10) { 
                        window.resizingEl.setAttribute('textLength', w); window.resizingEl.setAttribute('lengthAdjust', 'spacingAndGlyphs'); 
                        const tp = window.resizingEl.querySelector('textPath'); 
                        if (tp) { tp.setAttribute('textLength', w); tp.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } 
                    }
                    if(h > 5) { window.setD(window.resizingEl, 'base-font-size', h); } 
                    if(window.activeHandle.includes('l')) window.resizingEl.setAttribute('x', x); 
                    if(window.activeHandle.includes('t')) window.resizingEl.setAttribute('y', y); 
                    if(window.applyTextCurve) window.applyTextCurve(window.resizingEl);
                } else if (window.resizingEl.tagName === "image" || window.resizingEl.tagName === "rect" || window.resizingEl.tagName === "svg" || window.resizingEl.tagName === "g" || window.resizingEl.tagName === "foreignObject") { 
                    if (w > 10 && h > 10) { 
                        window.resizingEl.setAttribute("x", x); window.resizingEl.setAttribute("y", y); 
                        window.resizingEl.setAttribute("width", w); window.resizingEl.setAttribute("height", h); 
                    } 
                } 
                
                window.updateUI(window.resizingEl); 
                
                if(window.resizingEl.tagName === 'rect' || window.resizingEl.tagName === 'image' || window.resizingEl.classList.contains('video-obj') || window.resizingEl.classList.contains('weather-widget') || window.resizingEl.classList.contains('currency-widget')) { 
                    document.querySelectorAll(`text[data-bound-rect="${window.resizingEl.id}"]`).forEach(txt => { if(window.autoFitText) window.autoFitText(txt); }); 
                }
            } else if (window.rotatingEl) {
                window.isModified = true; let bbox = {x:0, y:0, width:0, height:0}; try{ bbox = window.rotatingEl.getBBox(); }catch(e){}
                const angle = Math.atan2(p.y - (bbox.y + bbox.height/2), p.x - (bbox.x + bbox.width/2)) * (180 / Math.PI) + 90; 
                window.setD(window.rotatingEl, 'angle', angle); 
                if(window.applyTransforms) window.applyTransforms(window.rotatingEl); 
                window.updateUI(window.rotatingEl);
            } else if (window.radiusingEl && (window.radiusingEl.tagName === "image" || window.radiusingEl.tagName === "rect" || window.radiusingEl.classList.contains('video-obj') || window.radiusingEl.classList.contains('weather-widget') || window.radiusingEl.classList.contains('currency-widget'))) {
                window.isModified = true; 
                let delta = Math.max(dx, dy); 
                let newRx = Math.max(0, Math.min(window.startData.w/2, window.startData.h/2, window.startData.rx + delta));
                window.setD(window.radiusingEl, 'rx', newRx); 
                if(window.applyShapeMask) window.applyShapeMask(window.radiusingEl); 
                window.updateUI(window.radiusingEl);
                
                let badge = document.getElementById('val-rx-' + window.radiusingEl.id);
                if(badge) badge.innerText = Math.round(newRx) + 'px';
                document.querySelectorAll(`input[oninput*="changeSetting('${window.radiusingEl.id}', 'rx'"]`).forEach(inp => { inp.value = newRx; });
            } else if (window.selectedEl && window.isDraggingElement) {
                window.isModified = true; 
                let newX = p.x - window.offset.x; let newY = p.y - window.offset.y;
                let snapX = null, snapY = null; const snapTolerance = 12;
                const dim = window.getSvgDim(); const cw = dim.w, ch = dim.h;
                let bbox = {width:0, height:0}; try { bbox = window.selectedEl.getBBox(); } catch(e){}
                
                const isText = window.selectedEl.tagName === 'text';
                let objCX = isText ? newX : newX + bbox.width / 2; let objCY = isText ? newY : newY + bbox.height / 2;

                if (!e.shiftKey) {
                    if (Math.abs(objCX - cw/2) < snapTolerance) { objCX = cw/2; snapX = cw/2; }
                    if (Math.abs(objCY - ch/2) < snapTolerance) { objCY = ch/2; snapY = ch/2; }
                    if (!isText) {
                        if (Math.abs(newX) < snapTolerance) { newX = 0; objCX = bbox.width/2; snapX = 0; }
                        if (Math.abs(newX + bbox.width - cw) < snapTolerance) { newX = cw - bbox.width; objCX = cw - bbox.width/2; snapX = cw; }
                        if (Math.abs(newY) < snapTolerance) { newY = 0; objCY = bbox.height/2; snapY = 0; }
                        if (Math.abs(newY + bbox.height - ch) < snapTolerance) { newY = ch - bbox.height; objCY = ch - bbox.height/2; snapY = ch; }
                    }
                    
                    document.querySelectorAll('.duzenlenebilir').forEach(other => {
                        if (other.id === window.selectedEl.id || window.getD(other, 'locked') === 'true') return;
                        try {
                            let ob = other.getBBox(); let oIsText = other.tagName === 'text';
                            let oCX = oIsText ? parseFloat(other.getAttribute('x'))||0 : ob.x + ob.width/2; let oCY = oIsText ? parseFloat(other.getAttribute('y'))||0 : ob.y + ob.height/2;
                            if (Math.abs(objCX - oCX) < snapTolerance) { objCX = oCX; snapX = oCX; }
                            if (Math.abs(objCY - oCY) < snapTolerance) { objCY = oCY; snapY = oCY; }
                        } catch(err){}
                    });
                    
                    if (isText) { newX = objCX; newY = objCY; } 
                    else { newX = objCX - bbox.width / 2; newY = objCY - bbox.height / 2; }
                }
                
                window.selectedEl.setAttribute("x", newX); window.selectedEl.setAttribute("y", newY);
                
                if((window.selectedEl.tagName === 'image' || window.selectedEl.tagName === 'rect' || window.selectedEl.classList.contains('video-obj') || window.selectedEl.classList.contains('weather-widget') || window.selectedEl.classList.contains('currency-widget')) && window.getD(window.selectedEl, 'mask-shape') && window.getD(window.selectedEl, 'mask-shape') !== "none") {
                    if(window.applyShapeMask) window.applyShapeMask(window.selectedEl); 
                }
                if(window.selectedEl.tagName === 'text' && window.getD(window.selectedEl, 'curve')) {
                    if(window.applyTextCurve) window.applyTextCurve(window.selectedEl); 
                }
                window.updateUI(window.selectedEl, snapX, snapY);
                
                if(window.selectedEl.tagName === 'rect' || window.selectedEl.tagName === 'image' || window.selectedEl.classList.contains('video-obj') || window.selectedEl.classList.contains('weather-widget') || window.selectedEl.classList.contains('currency-widget')) { 
                    document.querySelectorAll(`text[data-bound-rect="${window.selectedEl.id}"]`).forEach(txt => { if(window.autoFitText) window.autoFitText(txt); }); 
                }
            }
        };

        const release = (e) => { 
            try { wrapper.releasePointerCapture(e.pointerId); } catch(err){} window.isDraggingElement = false; 
            
            if (window.isPanning) { 
                window.isPanning = false; document.getElementById('svg-wrapper')?.classList.remove('panning'); return; 
            }
            
            if (window.isDrawing) { 
                window.isDrawing = false; window.selectedEl = window.currentPath; window.currentPath = null; window.isDrawingMode = false; document.getElementById('svg-wrapper')?.classList.remove('draw-mode'); 
                if(window.saveState) window.saveState(); 
                if(window.renderEditor) window.renderEditor(); 
                window.updateUI(window.selectedEl); return; 
            }
            
            if (window.isDraggingGuide) { 
                window.isDraggingGuide = false; window.currentGuide = null; 
                if(window.saveState) window.saveState(); return; 
            }
            
            if (window.isModified) { 
                if(window.saveState) window.saveState(); 
                if(window.selectedEl && window.renderProperties) window.renderProperties(); 
            }
            
            window.resizingEl = null; window.rotatingEl = null; window.radiusingEl = null; window.activeHandle = null; window.isModified = false; 
            document.querySelectorAll('.snap-line').forEach(l=>l.remove()); 
        };
        
        wrapper.onpointerup = release; 
        wrapper.onpointercancel = release;
    }
};

window.updateUI = function(el, snapX=null, snapY=null) {
    const ctrl = document.getElementById('control-layer'); if(!ctrl) return; ctrl.innerHTML = ""; if(!el) return;
    
    let b = {x:0,y:0,width:0,height:0}; try { b = el.getBBox(); }catch(e){return;}
    
    const transform = el.getAttribute("transform") || ""; const isLocked = window.getD(el, 'locked') === "true";
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.setAttribute("transform", transform); ctrl.appendChild(g);
    
    const dim = window.getSvgDim(); const w = dim.w, h = dim.h;
    
    if (snapX !== null) { const lX = document.createElementNS("http://www.w3.org/2000/svg", "line"); lX.setAttribute("x1", snapX); lX.setAttribute("y1", 0); lX.setAttribute("x2", snapX); lX.setAttribute("y2", h); lX.classList.add("snap-line"); ctrl.appendChild(lX); }
    if (snapY !== null) { const lY = document.createElementNS("http://www.w3.org/2000/svg", "line"); lY.setAttribute("x1", 0); lY.setAttribute("y1", snapY); lY.setAttribute("x2", w); lY.setAttribute("y2", snapY); lY.classList.add("snap-line"); ctrl.appendChild(lY); }

    const strokeColor = isLocked ? "var(--error)" : "var(--handle-move)";
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect"); r.setAttribute("x", b.x); r.setAttribute("y", b.y); r.setAttribute("width", b.width); r.setAttribute("height", b.height); r.setAttribute("fill", "none"); r.setAttribute("stroke", strokeColor); r.setAttribute("stroke-width", "2"); r.setAttribute("stroke-dasharray", "6,4"); g.appendChild(r);
    
    if (isLocked) return;
    
    const s = 24; 
    const corners = [{ id: 'tl', x: b.x, y: b.y, cur: 'nwse-resize' }, { id: 'tr', x: b.x + b.width, y: b.y, cur: 'nesw-resize' }, { id: 'bl', x: b.x, y: b.y + b.height, cur: 'nesw-resize' }, { id: 'br', x: b.x + b.width, y: b.y + b.height, cur: 'nwse-resize' }];
    corners.forEach(c => { const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect"); rect.setAttribute("x", c.x - s/2); rect.setAttribute("y", c.y - s/2); rect.setAttribute("width", s); rect.setAttribute("height", s); rect.setAttribute("class", "handle handle-resize"); rect.dataset.id = el.id; rect.dataset.handle = c.id; rect.style.cursor = c.cur; g.appendChild(rect); });
    
    const rotY = b.y - 40; const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); line.setAttribute("x1", b.x + b.width/2); line.setAttribute("y1", b.y); line.setAttribute("x2", b.x + b.width/2); line.setAttribute("y2", rotY); line.setAttribute("stroke", "var(--handle-rotate)"); line.setAttribute("stroke-width", "2"); g.appendChild(line);
    const rotH = document.createElementNS("http://www.w3.org/2000/svg", "circle"); rotH.setAttribute("cx", b.x + b.width/2); rotH.setAttribute("cy", rotY); rotH.setAttribute("r", s/2.5); rotH.setAttribute("class", "handle handle-rotate"); rotH.dataset.id = el.id; g.appendChild(rotH);

    if (el.tagName === 'rect' || el.tagName === 'image' || el.classList.contains('video-obj') || el.classList.contains('weather-widget') || el.classList.contains('currency-widget')) {
        const currentRx = parseFloat(window.getD(el, 'rx')) || 0;
        const offsetDist = Math.max(15, currentRx);
        const radH = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        radH.setAttribute("cx", b.x + offsetDist);
        radH.setAttribute("cy", b.y + offsetDist);
        radH.setAttribute("r", s/2.5);
        radH.setAttribute("class", "handle handle-radius");
        radH.dataset.id = el.id;
        g.appendChild(radH);
    }
};
window.updateEditorUI = window.updateUI;