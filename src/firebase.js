import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCFBrHqXdRVdbtaqyKCQAgJ4U8no9cDIF8",
    authDomain: "svg-pro-studio.firebaseapp.com",
    databaseURL: "https://svg-pro-studio-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "svg-pro-studio",
    storageBucket: "svg-pro-studio.firebasestorage.app",
    messagingSenderId: "1085012043931",
    appId: "1:1085012043931:web:fb6f9fb2e79f4a2607fe3e"
};

let db = null;
try { 
    const app = initializeApp(firebaseConfig); 
    db = getDatabase(app); 
    console.log("✅ Firebase Başarıyla Bağlandı!");
} catch(e) { 
    console.error("❌ Firebase Hatası:", e); 
}

// Diğer modüllerde kullanabilmek için dışa aktarıyoruz (Export)
export { db, ref, set, get, onValue, remove };