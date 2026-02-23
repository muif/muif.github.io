// ============================================================================
// محرك تكوين وإرسال الطلبات الأساسي (Order Flow Core Logic)
// تطبيقاً لـ [الجزء الثاني]: نظام الطلب المباشر (Direct Order) والقوائم المنسدلة للتجار.
// تطبيقاً لـ [الجزء الرابع]: دورة حياة الطلب (المرحلة 1: الإنشاء والحالة الابتدائية PENDING).
// ============================================================================

import { db } from '../../shared/firebase-config.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: التوجيه الذكي للطلبات]
// --- 1. جلب التجار لعرضهم للعميل في القائمة المنسدلة ---
// ----------------------------------------------------------------------------
async function loadMerchants() {
    const merchantSelect = document.getElementById('merchant-select');
    if (!merchantSelect) return;

    // نجلب المستخدمين الذين دورهم "تاجر" فقط (عزل الصلاحيات)
    const q = query(collection(db, "users"), where("role", "==", "merchant"));
    const snapshot = await getDocs(q);

    snapshot.forEach(doc => {
        const merchant = doc.data();
        // عرض اسم متجر التاجر (إن وجد) أو اسمه الشخصي كخيار للعميل
        const storeName = merchant.store_name || merchant.name;
        merchantSelect.innerHTML += `<option value="${doc.id}">🏪 ${storeName}</option>`;
    });
}

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الرابع: تأسيس الطلب في قاعدة البيانات Firestore]
// --- 2. دالة إرسال الطلب (Submit Order) ---
// ----------------------------------------------------------------------------
async function submitOrder() {
    // 1. جلب التاجر المختار من القائمة التي أنشأتها (السطر السحري لتوجيه الطلب)
    const merchantSelect = document.getElementById('merchant-select');
    const selectedMerchantId = merchantSelect ? merchantSelect.value : null;

    // 2. جلب بقية البيانات من الحقول الأخرى (التفاصيل، العنوان، المنطقة)
    const orderDetails = document.getElementById('custom-order-text').value;
    const addressNote = document.getElementById('address-note').value;
    const zoneId = document.getElementById('zone-select').value;

    try {
        // 3. إنشاء الطلب في Firestore
        const newOrderRef = await addDoc(collection(db, "orders"), {
            merchant_id: selectedMerchantId, // هنا يتم الربط التلقائي بالتاجر لكي يظهر في شاشته
            order_details: orderDetails,
            address_note: addressNote,
            zone_id: zoneId,
            status: 'PENDING', // الحالة الابتدائية للطلب (بانتظار التسعير)
            created_at: serverTimestamp(), // توثيق وقت الإنشاء الدقيق لترتيب الطلبات
            // ... أضف هنا بقية الحقول مثل customer_id ...
        });

        alert("تم إرسال الطلب بنجاح!");
    } catch (error) {
        console.error("خطأ في إنشاء الطلب:", error);
    }
}

// ----------------------------------------------------------------------------
// استدعاء الدالة التلقائي (Initialization)
// جلب التجار فور فتح الصفحة لتكون القائمة جاهزة لاستخدام العميل
// ----------------------------------------------------------------------------
loadMerchants();