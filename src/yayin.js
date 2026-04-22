import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ⚠️ DİKKAT: EDİTÖRDEKİ AYNI FIREBASE BİLGİLERİNİ BURAYA YAPIŞTIR
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
    if (snapshot.exists()) {
        settingsData = snapshot.val();
    }
});

// 2. Slaytları ve YAYIN AKIŞINI Dinle
onValue(ref(db, 'sahne/slaytlar'), (snapshot) => {
    if (snapshot.exists()) {
        slidesData = snapshot.val();
        
        // 🌟 İŞTE SİHRİN OLDUĞU YER: YAYIN AKIŞI LİSTESİ 🌟
        // Sıralamayı istediğin gibi değiştirebilir, aynı slaytı defalarca yazabilirsin.
        const yayinAkisi = [
            'slayt_svg',     // 1. Önce Ana Slayt çıksın
            'kampanya_svg',  // 2. Sonra Kampanya çıksın
            'slayt_svg',     // 3. Sonra TEKRAR Ana Slayt çıksın
            'duyuru_svg'     // 4. En son Duyuru çıksın ve başa (1. adıma) dönsün
        ];

        // Sadece Firebase'e "Yayına Gönder"ilmiş (içi dolu) slaytları filtrele 
        // (Böylece boş bir slayt sırası gelince siyah ekranda takılıp kalmaz)
        slideKeys = yayinAkisi.filter(anahtar => slidesData[anahtar]);

        // Eğer yukarıdaki listeden hiçbir şey henüz veritabanında yoksa, olan ne varsa onu çal (Yedek plan)
        if (slideKeys.length === 0) {
            slideKeys = Object.keys(slidesData);
        }
        
        // Döngüyü başlat veya güncelle
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
    
    // Sıradaki slaytı hesapla
    currentIndex = index % slideKeys.length;
    const currentKey = slideKeys[currentIndex];
    
    // Slaytın özel süresi ve efekti var mı? Yoksa varsayılan 5 sn ve Fade efekti kullan.
    const slideConfig = settingsData[currentKey] || { time: 5000, effect: 'fade' };
    const beklemeSuresi = slideConfig.time || 5000;
    const effect = slideConfig.effect || 'fade';

    applyTransitionOut(effect, () => {
        container.innerHTML = slidesData[currentKey];
        applyTransitionIn(effect);
        updateClock();
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
    updateClock();
}

function applyTransitionOut(effect, callback) {
    container.classList.add(`out-${effect}`);
    setTimeout(() => {
        container.classList.remove(`out-${effect}`);
        callback();
    }, 800); 
}

function applyTransitionIn(effect) {
    container.classList.add(`in-${effect}`);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            container.classList.remove(`in-${effect}`);
        });
    });
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

// --- İÇ RESİM SLAYT (ÇOKLU RESİM) SİSTEMİ ---
function startInnerSliders() {
    setInterval(() => {
        const svg = document.querySelector('#viewer-container svg');
        if(!svg) return;
        
        const images = svg.querySelectorAll('image[data-image-list]');
        images.forEach(img => {
            const list = img.getAttribute('data-image-list');
            if(!list) return;
            
            const urls = list.split(',').map(s => s.trim()).filter(s => s !== "");
            if(urls.length < 2) return; 
            
            let idx = parseInt(img.getAttribute('data-slider-idx') || '0');
            idx = (idx + 1) % urls.length;
            img.setAttribute('data-slider-idx', idx);
            
            img.style.transition = "opacity 0.5s ease-in-out";
            img.style.opacity = 0;
            
            setTimeout(() => {
                img.setAttribute('href', urls[idx]); 
                img.style.opacity = 1; 
            }, 500);
        });
    }, 3000); 
}
startInnerSliders();