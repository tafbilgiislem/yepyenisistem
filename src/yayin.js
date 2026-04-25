import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

let slidesData = {};
let settingsData = {};
let slideKeys = [];
let currentIndex = 0;
let rotationTimer = null;
const container = document.getElementById('viewer-container');

// Ayarları Dinle
onValue(ref(db, 'sahne/ayarlar'), (snapshot) => {
    if (snapshot.exists()) { settingsData = snapshot.val(); }
});

// Slaytları Dinle ve ÖN YÜKLEME (Pre-render) Yap
onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
    if (snapshot.exists()) {
        slidesData = snapshot.val();
        
        const yayinAkisi = [ 'slayt_svg', 'kampanya_svg', 'slayt_svg', 'duyuru_svg' ];
        slideKeys = yayinAkisi.filter(anahtar => slidesData[anahtar]);
        if (slideKeys.length === 0) { slideKeys = Object.keys(slidesData); }
        
        // 🚀 İŞTE PERFORMANSIN SIRRI: Ekranı saniyede bir silmek yerine slaytları KATMANLARA önceden diziyoruz
        const uniqueKeys = [...new Set(slideKeys)]; // Aynı slayttan 2 tane varsa 1 kere çizdirir (Hafıza tasarrufu)
        
        container.innerHTML = ""; // Sadece başlangıçta 1 kere siler
        uniqueKeys.forEach(key => {
            const div = document.createElement('div');
            div.className = 'slide-layer'; // Hepsi arkada gizli bekliyor
            div.id = 'layer-' + key;
            div.innerHTML = slidesData[key];
            container.appendChild(div);
        });
        
        if (!rotationTimer && slideKeys.length > 0) {
            showSlide(0);
        }
    } else {
        container.innerHTML = "<h1 style='color:white;'>Yayın Bekleniyor...</h1>";
    }
});

function showSlide(index) {
    if (slideKeys.length === 0) return;
    
    currentIndex = index % slideKeys.length;
    const currentKey = slideKeys[currentIndex];
    
    const slideConfig = settingsData[currentKey] || {};
    const beklemeSuresi = slideConfig.time || 5000;
    const effect = slideConfig.effect || 'fade';

    // Bütün katmanları gizle ve geçiş efekti sınıfını ata
    document.querySelectorAll('.slide-layer').forEach(layer => {
        layer.classList.remove('active');
    });

    // Gösterilecek slaytı bul ve efekti tetikle
    const targetLayer = document.getElementById('layer-' + currentKey);
    if (targetLayer) {
        targetLayer.className = `slide-layer ${effect}`; // Senin kodundaki gibi efekt class'ını ekle
        
        // Tarayıcıyı hizaya zorla (Efekt çakışmasını engeller)
        void targetLayer.offsetWidth; 
        
        targetLayer.classList.add('active'); // O büyülü animasyonu başlat!
    }

    updateClock();

    clearTimeout(rotationTimer);
    rotationTimer = setTimeout(() => {
        showSlide(currentIndex + 1);
    }, beklemeSuresi);
}

// --- CANLI SAAT VE TARİH SİSTEMİ ---
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

// --- İÇ RESİM ROTASYON MOTORU ---
function startInnerSliders() {
    setInterval(() => {
        // Artık sadece "Aktif (Görünen)" katmandaki resimleri değiştirmesi yeterli
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