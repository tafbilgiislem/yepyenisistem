import { db, ref, set, get, onValue, remove } from "./firebase.js";

// --- SİSTEM DURUMU ---
window.selectedEl = null;
window.historyStack = [];
window.historyIndex = -1;
window.currentZoom = 1;

// --- GİRİŞ VE TOAST ---
window.checkPin = () => {
    if(document.getElementById('pin-input').value === '1234') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.filter = 'blur(0px)';
    } else { alert("Hatalı Şifre!"); }
};

window.showToast = (msg) => {
    const t = document.createElement('div'); t.className = "toast success";
    t.innerHTML = `<span>${msg}</span>`; document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
};

// --- SLAYT VE FIREBASE ---
onValue(ref(db, 'sahne/slaytlar'), (snap) => {
    const sel = document.getElementById('file-selector');
    if(!sel) return;
    const current = sel.value; sel.innerHTML = "";
    if(snap.exists()) {
        Object.keys(snap.val()).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k; opt.textContent = k.toUpperCase(); sel.appendChild(opt);
        });
        if(current && snap.val()[current]) sel.value = current;
        else { sel.value = Object.keys(snap.val())[0]; window.loadSlide(); }
    }
});

window.loadSlide = async () => {
    const key = document.getElementById('file-selector').value;
    if(!key) return;
    const snap = await get(ref(db, `sahne/slaytlar/${key}`));
    document.getElementById('canvas-inner').innerHTML = snap.exists() ? snap.val() : '<svg viewBox="0 0 1920 1080"></svg>';
    window.setupLayers();
};

window.saveData = () => {
    const key = document.getElementById('file-selector').value;
    const svg = document.querySelector('#canvas-inner svg').outerHTML;
    set(ref(db, `sahne/slaytlar/${key}`), svg);
    window.showToast("Yayına Gönderildi!");
};

// --- NESNE EKLEME ---
window.addNewText = () => {
    const svg = document.querySelector('#canvas-inner svg');
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.id = "txt_" + Date.now();
    t.setAttribute("x", 960); t.setAttribute("y", 540);
    t.setAttribute("class", "duzenlenebilir");
    t.setAttribute("fill", "#ffffff");
    t.setAttribute("font-size", "80");
    t.textContent = "YENİ METİN";
    svg.appendChild(t); window.setupLayers();
};

window.addWeather = () => {
    const svg = document.querySelector('#canvas-inner svg');
    const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    fo.id = "wth_" + Date.now();
    fo.setAttribute("x", 710); fo.setAttribute("y", 290);
    fo.setAttribute("width", 500); fo.setAttribute("height", 500);
    fo.setAttribute("class", "duzenlenebilir weather-widget");
    fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="background:#111;color:white;width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%;border:5px solid #444">SAAT/HAVA</div>`;
    svg.appendChild(fo); window.setupLayers();
};

// --- KATMANLAR VE DÜZENLEME ---
window.setupLayers = () => {
    const list = document.getElementById('layers-list'); list.innerHTML = "";
    const autoList = document.getElementById('auto-fields-list'); autoList.innerHTML = "";
    
    document.querySelectorAll('.duzenlenebilir').forEach(el => {
        // Katman Listesi
        const item = document.createElement('div');
        item.style = "padding:8px;border-bottom:1px solid #334155;cursor:pointer;color:#cbd5e1";
        item.innerText = el.tagName + " (" + el.id + ")";
        item.onclick = () => window.selectElement(el);
        list.appendChild(item);

        // Hızlı Metin Listesi
        if(el.tagName === 'text') {
            const row = document.createElement('div');
            row.innerHTML = `<input type="text" value="${el.textContent}" oninput="document.getElementById('${el.id}').textContent=this.value" style="width:100%;margin-bottom:5px">`;
            autoList.appendChild(row);
        }
    });
};

window.selectElement = (el) => {
    window.selectedEl = el;
    const fields = document.getElementById('editor-fields');
    fields.innerHTML = `
        <h4 style="margin:0 0 10px 0">Düzenle: ${el.id}</h4>
        <label>Renk:</label><input type="color" value="${el.getAttribute('fill') || '#ffffff'}" oninput="window.selectedEl.setAttribute('fill', this.value)"><br><br>
        <label>X:</label><input type="number" value="${el.getAttribute('x')}" oninput="window.selectedEl.setAttribute('x', this.value)"><br>
        <label>Y:</label><input type="number" value="${el.getAttribute('y')}" oninput="window.selectedEl.setAttribute('y', this.value)"><br><br>
        <button onclick="window.selectedEl.remove();window.setupLayers()" style="background:red;color:white;width:100%;padding:10px">SİL</button>
    `;
};

// --- MOTOR TEMELLERİ ---
window.resetZoom = () => { window.currentZoom = 1; document.getElementById('svg-wrapper').style.transform = "scale(1)"; };
window.undo = () => { console.log("Geri Al"); };
window.redo = () => { console.log("İleri Al"); };

// Başlat
window.onload = () => { window.loadSlide(); };