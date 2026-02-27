// firebase-messaging-sw.js (يجب أن يكون في المجلد الرئيسي للمشروع)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// ⚙️ انسخ نفس بيانات الـ Config الموجودة في مشروعك هنا
const firebaseConfig = {
    apiKey: "AIzaSyBQlIPyVsYFRiUqZFLAPogE0ccn4Q3mhY8",
    authDomain: "fastdelivery-app-8311b.firebaseapp.com",
    projectId: "fastdelivery-app-8311b",
    storageBucket: "fastdelivery-app-8311b.firebasestorage.app",
    messagingSenderId: "596516332041",
    appId: "1:596516332041:web:1bb79d2731d682d2370ed8"
};


firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 🛡️ استلام الإشعار عندما يكون التطبيق مغلقاً (Background)
// 🛡️ استلام البيانات عندما يكون التطبيق مغلقاً (Background)
messaging.onBackgroundMessage((payload) => {
    // نكتفي بطباعة السجل للمراقبة الهندسية فقط
    console.log('[الحارس الخلفي] 🔔 المتصفح استلم إشعاراً وسيقوم بإظهاره تلقائياً: ', payload);

    // ❌ قمنا بحذف سطر self.registration.showNotification 
    // لمنع التكرار، لأن Firebase يتكفل بإظهاره نيابة عنا.
});