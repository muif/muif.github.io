// ============================================================================
// نظام الدعم الفني والشكاوى (Ticketing & Support System)
// تطبيقاً لـ [الجزء الثامن]: نظام الدعم الفني (Text & Context-Based Ticketing).
// هذا الملف مسؤول عن جلب التذاكر (الشكاوى) المفتوحة وعرضها لموظف الإدارة،
// مع توفير إمكانية معالجتها وإغلاقها.
// ============================================================================

import { db } from '../../shared/firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء السابع: الهيكل البصري للواجهات SPA]
// 1. منطق التنقل وإظهار شاشة الدعم الفني
// ----------------------------------------------------------------------------
const navTickets = document.getElementById('nav-tickets');
const viewTickets = document.getElementById('view-tickets');

navTickets.addEventListener('click', () => {
    // إخفاء جميع الشاشات وتفعيل شاشة التذاكر
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');

    navTickets.classList.add('active');
    viewTickets.style.display = 'block';
    document.getElementById('page-title').innerText = 'الدعم الفني والشكاوى';

    // بمجرد فتح الشاشة، يتم استدعاء دالة جلب التذاكر
    loadTickets();
});

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثامن: واجهة الرد ومعالجة التذاكر]
// 2. دالة جلب وعرض التذاكر المفتوحة (Real-time)
// ----------------------------------------------------------------------------
function loadTickets() {
    const ticketsList = document.getElementById('tickets-list');

    // بناء استعلام يجلب (فقط) التذاكر التي تحتاج إلى تدخل وتكون حالتها OPEN 🔴
    // (يتم تجاهل التذاكر المغلقة لتخفيف الضغط البصري على الموظف)
    const q = query(collection(db, "tickets"), where("status", "==", "OPEN"));

    onSnapshot(q, (snapshot) => {
        ticketsList.innerHTML = '';

        // حالة عدم وجود مشاكل (Zero Inbox)
        if (snapshot.empty) {
            ticketsList.innerHTML = '<p style="color:gray; text-align:center;">لا توجد تذاكر دعم فني مفتوحة حالياً. يا للروعة! 🎉</p>';
            return;
        }

        // بناء بطاقات التذاكر
        snapshot.forEach(docSnap => {
            const ticket = docSnap.data();
            const ticketId = docSnap.id;

            const div = document.createElement('div');
            // تنسيق البطاقة (شريط أحمر جانبي للدلالة على أنها مفتوحة وتحتاج انتباه)
            div.style.cssText = "background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-right: 5px solid #e74c3c;";

            // ملاحظة هندسية: تم عرض order_id هنا ليكون المرجع الأساسي للمشكلة،
            // وفي التحديثات القادمة (حسب الجزء الثامن) سيتم جلب تفاصيل هذا الطلب برمجياً وعرضها مع التذكرة.
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <strong style="color: #2c3e50; font-size:16px;">موضوع الشكوى: ${ticket.subject}</strong>
                    <span style="font-size:12px; color:gray;">معرف الطلب: ${ticket.order_id.substring(0, 6)}...</span>
                </div>
                <p style="margin-top: 10px; font-size: 14px; background: white; padding: 10px; border-radius: 5px; border: 1px solid #ddd;">${ticket.message}</p>
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="resolve-btn" data-id="${ticketId}" style="background:#2ecc71; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">✅ تم الحل والإغلاق</button>
                    </div>
            `;
            ticketsList.appendChild(div);
        });

        // ----------------------------------------------------------------------------
        // 3. برمجة زر "تم الحل والإغلاق" (تغيير حالة التذكرة)
        // ----------------------------------------------------------------------------
        document.querySelectorAll('.resolve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                // حماية من النقر الخاطئ
                const confirmClose = confirm("هل أنت متأكد من إغلاق هذه التذكرة؟");
                if (confirmClose) {
                    // تحديث حالة التذكرة في قاعدة البيانات لتصبح CLOSED 🟢
                    // (مما سيؤدي تلقائياً لاختفائها من هذه القائمة بفضل دالة onSnapshot)
                    await updateDoc(doc(db, "tickets", id), { status: 'CLOSED' });
                }
            });
        });
    });
}