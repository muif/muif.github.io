// ============================================================================
// لوحة القيادة المركزية - المنطق البرمجي (Dashboard Core Logic)
// تطبيقاً لـ [الجزء الأول]: شاشة الإحصائيات الحية (KPIs).
// وتطبيقاً لـ [الجزء الثاني]: نظام الجلسات وحماية الواجهات (Route Guards).
// ============================================================================

import { auth, db } from '../../shared/firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ----------------------------------------------------------------------------
// التقاط عناصر الواجهة (DOM Elements) لتحديث الشريط العلوي للإدارة
// ----------------------------------------------------------------------------
const adminNameEl = document.getElementById('admin-name');
const adminRoleDisplayEl = document.getElementById('admin-role-display');
const logoutBtn = document.getElementById('logoutBtn');

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: نظام الجلسات، حماية الواجهات، وطرد المحظورين]
// 1. مراقبة حالة تسجيل الدخول (Route Guard)
// وظيفتها: منع أي عميل، تاجر، أو مندوب من التسلل لهذه الصفحة، وطرد أي إداري تم حظره.
// ----------------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // جلب بيانات المستخدم الذي يحاول الدخول من جدول "users"
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const role = userData.role;

                // التحقق من الصلاحية (مسموح فقط للإداريين)
                if (['super_admin', 'sub_admin', 'employee'].includes(role)) {

                    // [تطبيقاً للجزء الثاني: الإيقاف الإداري]
                    // إذا كان حساب الإداري مغلقاً (is_active === false)، يُطرد فوراً
                    if (userData.is_active === false) {
                        await signOut(auth);
                        window.location.href = 'login.html';
                        return;
                    }

                    // تحديث واجهة المستخدم بالاسم والصلاحية المترجمة
                    adminNameEl.innerText = userData.name || userData.email;
                    let roleAr = role === 'super_admin' ? 'مدير نظام (صلاحيات كاملة)' :
                        role === 'sub_admin' ? 'مدير مساعد' : 'موظف';
                    adminRoleDisplayEl.innerText = `الصلاحية الحالية: ${roleAr}`;

                    // إعطاء الإذن بعرض الصفحة (لإخفاء الشاشة البيضاء قبل التحقق)
                    document.body.classList.add('authorized');

                    // 🚀 بمجرد التأكد من الصلاحية، يتم تشغيل محرك الإحصائيات الحية
                    startLiveKPIs();

                } else {
                    // إذا كان المستخدم تاجراً أو عميلاً، يُطرد برسالة تحذيرية
                    alert("غير مصرح لك بدخول هذه الصفحة.");
                    await signOut(auth);
                    window.location.href = 'login.html';
                }
            } else {
                await signOut(auth);
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error("خطأ في جلب بيانات المستخدم:", error);
        }
    } else {
        // طرد أي شخص غير مسجل الدخول نهائياً
        window.location.href = 'login.html';
    }
});

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الأول: شاشة الإحصائيات الحية (KPIs)]
// 2. محرك الإحصائيات الحية (Live KPIs)
// يعتمد على دالة `onSnapshot` لضمان تحديث الأرقام فوراً (Real-time) دون تحديث الصفحة.
// ----------------------------------------------------------------------------
function startLiveKPIs() {

    // أ. مؤشر الطلبات قيد التنفيذ (النشطة)
    // يجلب كل الطلبات التي لم تكتمل ولم تُلغَ بعد.
    const qOrders = query(collection(db, "orders"), where("status", "in", ["PENDING", "PENDING_ADMIN", "AWAITING_APPROVAL", "ASSIGNED", "IN_TRANSIT"]));
    onSnapshot(qOrders, (snapshot) => {
        document.getElementById('kpi-orders').innerText = snapshot.size;
    });

    // ب. مؤشر المناديب المتواجدين (النشطين في الشارع)
    // يجلب المستخدمين الذين دورهم "مندوب" وحسابهم مفعل "is_active == true"
    const qDrivers = query(collection(db, "users"), where("role", "==", "driver"), where("is_active", "==", true));
    onSnapshot(qDrivers, (snapshot) => {
        document.getElementById('kpi-drivers').innerText = snapshot.size;
    });

    // ج. مؤشر إجمالي أرباح التوصيل للمكتب
    // [تطبيقاً للشفافية المالية]: يجمع أجرة التوصيل (delivery_fee) للطلبات التي تم تسليمها فقط (DELIVERED).
    const qDelivered = query(collection(db, "orders"), where("status", "==", "DELIVERED"));
    onSnapshot(qDelivered, (snapshot) => {
        let totalProfit = 0;
        snapshot.forEach(docSnap => {
            // إضافة حماية (Number) لتجنب الأخطاء الحسابية إذا كان الحقل فارغاً
            totalProfit += (Number(docSnap.data().delivery_fee) || 0);
        });
        document.getElementById('kpi-profit').innerText = totalProfit.toLocaleString() + ' د.ع';
    });

    // د. مؤشر تذاكر الدعم الفني المفتوحة
    // يجلب الشكاوى التي تحتاج إلى تدخل ولم تُغلق بعد (OPEN)
    const qTickets = query(collection(db, "tickets"), where("status", "==", "OPEN"));
    onSnapshot(qTickets, (snapshot) => {
        document.getElementById('kpi-tickets').innerText = snapshot.size;
    });
}

// ----------------------------------------------------------------------------
// 3. تفعيل زر تسجيل الخروج (خروج آمن ومسح الجلسة)
// ----------------------------------------------------------------------------
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("خطأ أثناء تسجيل الخروج:", error);
    }
});

// ----------------------------------------------------------------------------
// 4. تفعيل ميزة طي وتوسيع الشريط الجانبي (Sidebar Toggle)
// ----------------------------------------------------------------------------
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const sidebar = document.querySelector('.sidebar');

if (toggleSidebarBtn && sidebar) {
    toggleSidebarBtn.addEventListener('click', () => {
        // إضافة أو إزالة كلاس collapsed الذي قمنا ببرمجته في ملف CSS
        sidebar.classList.toggle('collapsed');
    });
}