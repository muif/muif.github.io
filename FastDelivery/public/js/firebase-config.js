// 1. استيراد دوال Firebase الأساسية (الإصدار 9/10 Modular)
// تطبيقاً للجزء الأول: البنية التحتية باستخدام Firebase [cite: 230]
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

// 2. إعدادات مشروعك (يجب تغيير هذه القيم لتطابق مشروعك في Firebase Console)
const firebaseConfig = {
    apiKey: "AIzaSyBQlIPyVsYFRiUqZFLAPogE0ccn4Q3mhY8",
    authDomain: "fastdelivery-app-8311b.firebaseapp.com",
    projectId: "fastdelivery-app-8311b",
    storageBucket: "fastdelivery-app-8311b.firebasestorage.app",
    messagingSenderId: "596516332041",
    appId: "1:596516332041:web:1bb79d2731d682d2370ed8"
};

// 3. تهيئة التطبيق (Initialize Firebase)
const app = initializeApp(firebaseConfig);

// 4. تهيئة الخدمات وتصديرها لتستخدمها باقي ملفات المشروع
const auth = getAuth(app);         // خدمة المصادقة [cite: 231]
const db = getFirestore(app);      // قاعدة بيانات Firestore [cite: 232]
const messaging = getMessaging(app); // خدمة الإشعارات [cite: 234]

// 5. تصدير المتغيرات لتكون متاحة لباقي ملفات الـ JavaScript
export { app, auth, db, messaging, getToken, onMessage };

