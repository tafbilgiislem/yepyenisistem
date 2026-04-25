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

// 1. Ayarları Dinle
onValue(ref(db, 'sahne/ayarlar'), (snapshot) => {
    if (snapshot.exists()) { settingsData = snapshot.val(); }
});

// 2. Slaytları ve YAYIN AKIŞINI Dinle
onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
    if (snapshot.exists()) {
        slidesData = snapshot.val();
        
        const yayinAkisi = [ 'slayt_svg', 'kampanya_svg', 'slayt_svg', 'duyuru_svg' ];
        slideKeys = yayinAkisi.filter(anahtar => slidesData[anahtar]);
        if (slideKeys.length === 0) { slideKeys = Object.keys(slidesData); }
        
        if (!rotationTimer && slideKeys.length > 0) {
            showSlide(0);
        } else if (slideKeys.length > 0) {
            renderCurrentSlideAnlik();
        }
    } else {
        container.innerHTML = "<h1 style='color:white; font-family: sans-serif;'>Yayın Bekleniyor...</h1>";
    }
});

function showSlide(index) {
    if (slideKeys.length === 0) return;
    
    currentIndex = index % slideKeys.length;
    const currentKey = slideKeys[currentIndex];
    
    const slideConfig = settingsData[currentKey] || { time: 5000, effect: 'fade' };
    const beklemeSuresi = slideConfig.time || 5000;
    const effect = slideConfig.effect || 'fade';

    applyTransitionOut(effect, () => {
        container.innerHTML = slidesData[currentKey];
        applyTransitionIn(effect);
    });

    clearTimeout(rotationTimer);
    rotationTimer = setTimeout(() => {
        showSlide(currentIndex + 1);
    }, beklemeSuresi);
}

function renderCurrentSlideAnlik() {
    if (slideKeys.length === 0) return;
    const currentKey = slideKeys[currentIndex];
    container.innerHTML = slidesData[currentKey];
}

// 🌟 EFEKT DÜZELTME MOTORU (REFLOW EKLENDİ) 🌟
function applyTransitionOut(effect, callback) {
    // Çıkış yaparken animasyonu aç
    container.style.transition = 'all 1.2s cubic-bezier(0.25, 1, 0.5, 1)';
    container.classList.add(`out-${effect}`);
    
    setTimeout(() => { 
        container.classList.remove(`out-${effect}`); 
        callback(); 
    }, 1200); 
}

function applyTransitionIn(effect) {
    // 1. Animasyonu kapat ki ekran gizlice giriş pozisyonuna ışınlanabilsin (Çakışmayı önler)
    container.style.transition = 'none';
    container.classList.add(`in-${effect}`);
    
    // 2. Tarayıcıya "Hemen pozisyonu hesapla" komutu ver (Reflow / Force Repaint)
    void container.offsetWidth;
    
    // 3. Işınlanma bitti, şimdi animasyonu tekrar açarak ekrana muazzam bir giriş yaptır
    container.style.transition = 'all 1.2s cubic-bezier(0.25, 1, 0.5, 1)';
    
    setTimeout(() => { 
        container.classList.remove(`in-${effect}`); 
    }, 50); 
}

// --- İÇ RESİM SLAYT SİSTEMİ ---
function startInnerSliders() {
    setInterval(() => {
        const svg = document.querySelector('#viewer-container svg');
        if(!svg) return;
        const images = svg.querySelectorAll('image[data-image-list]');
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