import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

// ⚠️ KENDİ FIREBASE BİLGİLERİNİ BURAYA GİR
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

function veriTabaninaKaydet() {
  set(ref(db, 'sahne/katmanlar'), state.layers).catch(e => console.error(e));
}

// --- STATE (DURUM) ---
const state = { activeTool: 'select', layers: [], selectedId: null, drag: { isDragging: false, target: null, offsetX: 0, offsetY: 0 } };

// --- DOM SEÇİCİLERİ ---
const loginBtn = document.getElementById('login-btn');
const appContainer = document.getElementById('app-container');
const loginScreen = document.getElementById('login-screen');
const layersList = document.getElementById('layers-list');
const mainSvg = document.getElementById('main-svg');
const propertiesPanel = document.getElementById('properties-panel');
const textProps = document.getElementById('text-props');
const colorProps = document.getElementById('color-props');
const propTextInput = document.getElementById('prop-text-input');
const propColorInput = document.getElementById('prop-color-input');

// --- 1. GİRİŞ (Beni Hatırla) ---
if (sessionStorage.getItem("oturumAcik") === "evet") {
  loginScreen.style.display = 'none';
  appContainer.style.display = 'flex';
}
loginBtn.onclick = () => {
  if(document.getElementById('access-key').value === "123") { 
    sessionStorage.setItem("oturumAcik", "evet"); 
    loginScreen.style.display = 'none';
    appContainer.style.display = 'flex';
  } else alert("Hatalı Şifre!");
};

// --- 2. ARAÇLAR (Metin & Kutu) ---
document.getElementById('btn-add-text').onclick = () => {
  const id = 'layer_' + Date.now();
  const newLayer = { id, type: 'text', name: 'Metin', x: 300, y: 300, text: "YENİ METİN" };
  state.layers.push(newLayer);
  
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("id", id); text.setAttribute("x", newLayer.x); text.setAttribute("y", newLayer.y);
  text.setAttribute("fill", "white"); text.setAttribute("font-size", "32"); text.style.cursor = "move";
  text.textContent = newLayer.text;
  
  text.onmousedown = (e) => startDrag(e, text, id); text.ontouchstart = (e) => startDrag(e, text, id); 
  mainSvg.appendChild(text); selectLayer(id); veriTabaninaKaydet();
};

document.getElementById('btn-add-rect').onclick = () => {
  const id = 'layer_' + Date.now();
  const newLayer = { id, type: 'rect', name: 'Kutu', x: 200, y: 200, width: 250, height: 60, fill: "#10b981" };
  state.layers.push(newLayer);
  
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("id", id); rect.setAttribute("x", newLayer.x); rect.setAttribute("y", newLayer.y);
  rect.setAttribute("width", newLayer.width); rect.setAttribute("height", newLayer.height);
  rect.setAttribute("fill", newLayer.fill); rect.setAttribute("rx", "10"); rect.style.cursor = "move";
  
  rect.onmousedown = (e) => startDrag(e, rect, id); rect.ontouchstart = (e) => startDrag(e, rect, id);
  mainSvg.appendChild(rect); selectLayer(id); veriTabaninaKaydet();
};

// --- 3. AKILLI SVG YÜKLEYİCİ ---
document.getElementById('btn-add-svg').onclick = () => {
  const svgKod = prompt("Lütfen SVG kodunu buraya yapıştırın:");
  if (!svgKod) return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgKod, "image/svg+xml");
  const importedSvg = doc.querySelector("svg"); // Sadece SVG'yi al, çöp kodları at

  if (!importedSvg) {
    alert("Geçerli bir SVG kodu bulunamadı!"); return;
  }

  const id = 'layer_' + Date.now();
  const newLayer = { id, type: 'custom-svg', name: 'Özel Tasarım', x: 100, y: 100, rawCode: importedSvg.outerHTML };
  state.layers.push(newLayer);
  
  const nestedSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  nestedSvg.setAttribute("id", id);
  nestedSvg.setAttribute("x", newLayer.x);
  nestedSvg.setAttribute("y", newLayer.y);
  nestedSvg.style.cursor = "move";
  nestedSvg.style.overflow = "visible";

  // Boyutları kopyala
  if (importedSvg.getAttribute("viewBox")) {
    nestedSvg.setAttribute("viewBox", importedSvg.getAttribute("viewBox"));
    nestedSvg.setAttribute("width", importedSvg.getAttribute("width") || "300");
    nestedSvg.setAttribute("height", importedSvg.getAttribute("height") || "300");
  } else {
    nestedSvg.setAttribute("width", "300"); nestedSvg.setAttribute("height", "300");
  }

  // Çizimleri kopyala (Arka plan beyazlarını temizle)
  Array.from(importedSvg.childNodes).forEach(node => {
    if (node.tagName === 'rect' && (node.getAttribute('fill') === 'white' || node.getAttribute('fill') === '#ffffff' || node.getAttribute('fill') === '#FFF')) {
       // Tasarım programlarından gelen beyaz arkaplanı yoksay
       return; 
    }
    nestedSvg.appendChild(node.cloneNode(true));
  });
  
  nestedSvg.onmousedown = (e) => startDrag(e, nestedSvg, id);
  nestedSvg.ontouchstart = (e) => startDrag(e, nestedSvg, id);
  
  mainSvg.appendChild(nestedSvg); selectLayer(id); veriTabaninaKaydet();
};

// --- 4. PANEL VE ÖZELLİK DEĞİŞTİRME ---
function selectLayer(id) {
  state.selectedId = id;
  layersList.innerHTML = '';
  state.layers.forEach(layer => {
    const div = document.createElement('div');
    div.className = `layer-item ${state.selectedId === layer.id ? 'active' : ''}`;
    div.innerHTML = `<span>${layer.name}</span>`;
    div.onclick = () => selectLayer(layer.id);
    layersList.appendChild(div);
  });

  const seciliObje = state.layers.find(l => l.id === id);
  if (seciliObje) {
    propertiesPanel.style.display = 'block';
    if (seciliObje.type === 'text') {
      textProps.style.display = 'block'; colorProps.style.display = 'none';
      propTextInput.value = seciliObje.text; 
    } else if (seciliObje.type === 'rect') {
      textProps.style.display = 'none'; colorProps.style.display = 'block';
      propColorInput.value = seciliObje.fill; 
    } else {
      textProps.style.display = 'none'; colorProps.style.display = 'none'; // Şimdilik özel SVG ayarları kapalı
    }
  } else {
    propertiesPanel.style.display = 'none';
  }
}

propTextInput.addEventListener('input', (e) => {
  if (!state.selectedId) return;
  const layer = state.layers.find(l => l.id === state.selectedId);
  if (layer && layer.type === 'text') {
    layer.text = e.target.value; 
    document.getElementById(state.selectedId).textContent = e.target.value; 
    veriTabaninaKaydet();
  }
});

propColorInput.addEventListener('input', (e) => {
  if (!state.selectedId) return;
  const layer = state.layers.find(l => l.id === state.selectedId);
  if (layer && layer.type === 'rect') {
    layer.fill = e.target.value; 
    document.getElementById(state.selectedId).setAttribute("fill", e.target.value); 
    veriTabaninaKaydet();
  }
});

// --- 5. SİLME MANTIĞI ---
document.getElementById('tool-delete').onclick = () => {
  if (!state.selectedId) return;
  state.layers = state.layers.filter(layer => layer.id !== state.selectedId);
  const silinecek = document.getElementById(state.selectedId);
  if (silinecek) silinecek.remove();
  selectLayer(null); veriTabaninaKaydet();
};

// --- 6. SÜRÜKLE - BIRAK MOTORU (Tablet ve Fare Uyumlu) ---
function getMousePosition(evt) {
  const CTM = mainSvg.getScreenCTM();
  if (evt.touches && evt.touches.length > 0) return { x: (evt.touches[0].clientX - CTM.e) / CTM.a, y: (evt.touches[0].clientY - CTM.f) / CTM.d };
  return { x: (evt.clientX - CTM.e) / CTM.a, y: (evt.clientY - CTM.f) / CTM.d };
}

function startDrag(evt, element, id) {
  selectLayer(id);
  state.drag.isDragging = true; state.drag.target = element;
  const offset = getMousePosition(evt);
  state.drag.offsetX = offset.x - (parseFloat(element.getAttribute("x")) || 0);
  state.drag.offsetY = offset.y - (parseFloat(element.getAttribute("y")) || 0);
}

function handleMove(evt) {
  if (state.drag.isDragging && state.drag.target) {
    evt.preventDefault();
    const coord = getMousePosition(evt);
    state.drag.target.setAttribute("x", coord.x - state.drag.offsetX);
    state.drag.target.setAttribute("y", coord.y - state.drag.offsetY);
  }
}

function handleUp() {
  if (state.drag.isDragging && state.drag.target) {
    const layer = state.layers.find(l => l.id === state.drag.target.getAttribute("id"));
    if (layer) {
      layer.x = parseFloat(state.drag.target.getAttribute("x"));
      layer.y = parseFloat(state.drag.target.getAttribute("y"));
      veriTabaninaKaydet();
    }
  }
  state.drag.isDragging = false; state.drag.target = null;
}

window.addEventListener('mousemove', handleMove); window.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('mouseup', handleUp); window.addEventListener('touchend', handleUp);