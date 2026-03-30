// shared/push-engine.js
// ============================================================================
// العقل المركزي لنظام الإشعارات الموزع (Distributed Push Engine)
// يحتوي على: موزع الأحمال، جلب التوكن، الاستماع الأمامي، والروابط الديناميكية.
// ============================================================================

import { db, messaging } from './firebase-config.js';
import { doc, updateDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

// 🔑 1. ضع مفتاح الـ VAPID هنا (رخصة استقبال الإشعارات)
const VAPID_KEY = "BAv9BAyQRfqD1VyjRPBBd1sOuHVJMu4NVuLAAwUT0u9U7IHcexlg7Gnhcc_lg2sfA5OCp__0FD-c_vaT3OHGiyc";

// 🔐 2. مفتاح الأمان السري بين تطبيقك وسيرفراتك
const SECRET_KEY = "NIPPUR_SECURE_2026";

// 🌐 3. الذاكرة المؤقتة لأسطول السيرفرات (Dynamic Cache) - كانت ثابتة سابقاً!
let GAS_SERVERS_CACHE = [];

// ============================================================================
// 🚀 محرك المزامنة المخفي (Background Sync Engine)
// يعمل بصمت عند فتح التطبيق ليجلب الروابط ويحدثها تلقائياً إذا تغيرت من الإدارة
// ============================================================================
function syncGasServers() {
    const docRef = doc(db, "app_settings", "gas_servers");
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().urls) {
            GAS_SERVERS_CACHE = docSnap.data().urls;
            console.log("🔄 [Push Engine] تم مزامنة أسطول سيرفرات GAS:", GAS_SERVERS_CACHE.length, "سيرفرات");
        } else {
            GAS_SERVERS_CACHE = [];
            console.warn("⚠️ [Push Engine] لا توجد سيرفرات GAS نشطة في الإدارة!");
        }
    }, (error) => {
        console.error("❌ خطأ في مزامنة سيرفرات الإشعارات:", error);
    });
}
// تشغيل المزامنة فوراً عند تحميل هذا الملف في أي تطبيق (إدارة، تاجر، مندوب، عميل)
syncGasServers();

// ============================================================================
// ⚙️ محرك (1): تسجيل الجهاز وحفظ بصمة الهاتف (FCM Token)
// ============================================================================
export async function registerDeviceToken(uid) {
    try {
        console.log("جاري طلب صلاحية الإشعارات...");
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            // جلب البصمة الفريدة للجهاز
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (currentToken) {
                // حفظ التوكن في ملف المستخدم في الفايرستور
                await updateDoc(doc(db, "users", uid), { fcm_token: currentToken });
                console.log("✅ تم حفظ بصمة الجهاز (Token) بنجاح للاستقبال الخارجي.");
            } else {
                console.warn("⚠️ لم نتمكن من جلب التوكن، تأكد من إعدادات VAPID.");
            }
        } else {
            console.warn("❌ المستخدم رفض صلاحية الإشعارات.");
        }
    } catch (error) {
        console.error("❌ خطأ في محرك جلب التوكن:", error);
    }
}

// ============================================================================
// ⚙️ محرك (2): موزع الأحمال والانتقال التلقائي عند الفشل (Load Balancer)
// ============================================================================
export async function sendDistributedPush(fcmToken, title, body) {

    // 🛡️ الطوارئ: إذا كانت الذاكرة فارغة (بسبب ضعف النت أو الإرسال السريع جداً)، نجلبها بالقوة!
    if (GAS_SERVERS_CACHE.length === 0) {
        try {
            const docSnap = await getDoc(doc(db, "app_settings", "gas_servers"));
            if (docSnap.exists() && docSnap.data().urls) {
                GAS_SERVERS_CACHE = docSnap.data().urls;
            }
        } catch (e) {
            console.error("❌ فشل جلب سيرفرات الإشعارات الطارئ:", e);
        }
    }

    if (GAS_SERVERS_CACHE.length === 0) {
        console.warn("⚠️ إيقاف الإرسال: أسطول السيرفرات فارغ! يرجى إضافة روابط GAS من لوحة الإدارة.");
        return false;
    }

    // 🔀 خلط مصفوفة السيرفرات عشوائياً لتوزيع الضغط (Round-Robin/Load Balancing)
    const shuffledServers = [...GAS_SERVERS_CACHE].sort(() => 0.5 - Math.random());

    const payload = JSON.stringify({
        key: SECRET_KEY,
        fcm_token: fcmToken,
        title: title,
        body: body
    });

    // 🔄 حلقة المحاولة والانتقال التلقائي (Fallback Loop)
    for (let i = 0; i < shuffledServers.length; i++) {
        const serverUrl = shuffledServers[i];
        try {
            // استخدام text/plain يمنع المتصفح من حظر الطلب المبدئي (CORS Preflight)
            const response = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: payload
            });

            // إذا رد سيرفر جوجل بنجاح، نكسر الحلقة ونتوقف
            if (response.ok) {
                console.log(`✅ نجح الإطلاق الصاروخي عبر السيرفر رقم [${i + 1}]`);
                return true;
            } else {
                console.warn(`⚠️ السيرفر [${i + 1}] رد بخطأ، جاري تحويل المسار للسيرفر البديل...`);
            }
        } catch (error) {
            console.warn(`❌ انقطع الاتصال بالسيرفر [${i + 1}]، جاري تحويل المسار...`);
        }
    }

    console.error("🚨 طوارئ: فشلت جميع السيرفرات المتاحة في إرسال الإشعار!");
    return false;
}

// ============================================================================
// ⚙️ محرك (3): الاستماع الأمامي (Foreground Listener)
// ============================================================================
export function listenToForegroundMessages() {
    onMessage(messaging, (payload) => {
        console.log("🔔 [إشعار أمامي]:", payload);
        // يمكنك لاحقاً ربط هذا الرادار بصوت تنبيه أو نافذة منبثقة إضافية
    });
}