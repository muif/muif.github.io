// ============================================================================
// تطبيق العميل - محرك التتبع والدعم الفني (Customer App - Tracking & Support)
// تطبيقاً لـ [الجزء الرابع]: دورة حياة الطلب (المرحلة 3: موافقة العميل، والمرحلة 4: التتبع البصري).
// تطبيقاً لـ [الجزء الثامن]: نظام الدعم الفني السياقي (Context-Based Ticketing).
// هذا الملف مسؤول عن رسم شريط التتبع اللحظي، قبول أو رفض التسعير، وإرسال الشكاوى.
// ============================================================================

import { auth, db } from '../../shared/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";let currentUserUid = null;
// ----------------------------------------------------------------------------
// [1] حارس الجلسة ودرع الإخفاء (Auth Guard & UI Shield)
// ----------------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // التأكد من أن المستخدم الحالي هو "عميل" فعلاً وليس مندوباً أو تاجراً
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'customer') {

            // 🟢 العميل مسجل وصلاحيته صحيحة: ارفع الدرع وأظهر الصفحة!
            document.body.style.display = 'block';

            currentUserUid = user.uid;
            loadMyOrders(); // بدء جلب الطلبات اللحظية

        } else {
            // 🚫 مسجل دخول بحساب آخر، اطرده لصفحة الدخول
            window.location.href = 'login.html';
        }
    } else {
        // 🚫 زائر غير مسجل يحاول الدخول لصفحة التتبع، اطرده فوراً
        window.location.href = 'login.html';
    }
});


// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الرابع والسابع: التتبع البصري اللحظي Visual Tracking]
// --- 2. جلب الطلبات ورسم حالاتها اللحظية ---
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الرابع والسابع: التتبع البصري اللحظي + التوجيه العميق من الإشعارات]
// --- 2. جلب الطلبات ورسم حالاتها اللحظية والقفز للطلب المحدد ---
// ----------------------------------------------------------------------------
function loadMyOrders() {
    const ordersContainer = document.getElementById('orders-container');
    window.loadedCustomerOrders = {}; // ذاكرة لحفظ طلبات العميل
    const q = query(collection(db, "orders"), where("customer_id", "==", currentUserUid));

    onSnapshot(q, (snapshot) => {
        ordersContainer.innerHTML = '';

        if (snapshot.empty) {
            ordersContainer.innerHTML = '<p style="text-align:center; color:gray; margin-top:50px;">لا توجد طلبات سابقة أو حالية.</p>';
            return;
        }

        let ordersArray = [];
        snapshot.forEach(doc => ordersArray.push({ id: doc.id, ...doc.data() }));
        ordersArray.sort((a, b) => b.created_at?.toMillis() - a.created_at?.toMillis());

        ordersArray.forEach(order => {
            window.loadedCustomerOrders[order.id] = order; // 👈 حفظ الطلب في الذاكرة

            const card = document.createElement('div');
            card.id = `order-card-${order.id}`;
            card.classList.add('order-card-clickable'); // 👈 إضافة الكلاس
            card.setAttribute('data-id', order.id); // 👈 إضافة الـ ID

            // 👈 أضفنا cursor: pointer هنا
            card.style.cssText = "background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: all 0.5s ease; cursor: pointer;";
            let progressLevel = -1;
            let actionButtons = '';

            switch (order.status) {
                case 'PENDING_ADMIN':
                    progressLevel = 0;
                    actionButtons = `<div style="margin-top:15px; padding:10px; background:#f4f0fb; color:#8e44ad; border-radius:8px; font-weight:bold; text-align:center; border: 1px dashed #8e44ad;">👩‍💻 جاري مراجعة طلبك وتوجيهه للتاجر المناسب...</div>`;
                    break;
                case 'PENDING':
                    progressLevel = 0;
                    actionButtons = `<div style="margin-top:15px; padding:10px; background:#fff3cd; color:#856404; border-radius:8px; font-weight:bold; text-align:center; border: 1px dashed #ffc107;">⏳ الطلب عند التاجر الآن، بانتظار تحديد السعر...</div>`;
                    break;
                case 'AWAITING_APPROVAL':
                    progressLevel = 0;
                    actionButtons = `
                        <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border-radius: 8px; border: 1px dashed #ffc107;">
                            <p style="color: #856404; font-weight: bold; margin-bottom: 10px; font-size: 14px;">
                                🔔 لقد قام التاجر بتسعير طلبك، هل توافق؟
                            </p>
                            
                            <div style="background: white; padding: 10px; border-radius: 5px; margin-bottom: 12px; border: 1px solid #ffeeba;">
                                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-bottom: 5px;">
                                    <span>🛒 سعر المنتجات:</span>
                                    <strong>${order.merchant_price || 0} د.ع</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-bottom: 5px;">
                                    <span>🚚 أجرة التوصيل:</span>
                                    <strong>${order.delivery_fee || 0} د.ع</strong>
                                </div>
                                <hr style="border: 0; border-top: 1px solid #ddd; margin: 8px 0;">
                                <div style="display: flex; justify-content: space-between; font-size: 15px; color: #e74c3c; font-weight: bold;">
                                    <span>💰 الإجمالي المطلوب:</span>
                                    <span>${order.total_price || 0} د.ع</span>
                                </div>
                            </div>

                            <div style="display: flex; gap: 10px;">
                                <button class="approve-btn" data-id="${order.id}" style="flex:1; background:#2ecc71; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer; font-weight:bold;">✅ موافق</button>
                                <button class="reject-btn" data-id="${order.id}" style="flex:1; background:#e74c3c; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer; font-weight:bold;">❌ رفض</button>
                            </div>
                        </div>
                    `;
                    break;
                case 'ASSIGNED': progressLevel = 1; break;
                case 'IN_TRANSIT': progressLevel = 2; break;
                case 'DELIVERED': progressLevel = 3; break;
                case 'CANCELED_BY_ADMIN':
                case 'CANCELED':
                case 'CANCELED_BY_CUSTOMER':
                case 'CANCELED_BY_MERCHANT':
                    progressLevel = -1;
                    break;
            }

            let trackingVisualHTML = '';

            if (progressLevel === -1) {
                trackingVisualHTML = `<div class="track-canceled"><i class="fas fa-ban"></i> تم إلغاء هذا الطلب (${order.reason || order.cancel_reason || 'بدون سبب'})</div>`;
            } else {
                const lineWidth = (progressLevel * 25) + '%';
                trackingVisualHTML = `
                    <div class="tracking-container">
                        <div class="tracking-progress-line" style="width: ${lineWidth};"></div>
                        <div class="track-step ${progressLevel >= 0 ? (progressLevel > 0 ? 'completed' : 'active') : ''}">
                            <div class="track-icon"><i class="fas fa-clipboard-list"></i></div>
                            <div class="track-text">التسعير</div>
                        </div>
                        <div class="track-step ${progressLevel >= 1 ? (progressLevel > 1 ? 'completed' : 'active') : ''}">
                            <div class="track-icon"><i class="fas fa-motorcycle"></i></div>
                            <div class="track-text">المندوب</div>
                        </div>
                        <div class="track-step ${progressLevel >= 2 ? (progressLevel > 2 ? 'completed' : 'active') : ''}">
                            <div class="track-icon"><i class="fas fa-route"></i></div>
                            <div class="track-text">بالطريق</div>
                        </div>
                        <div class="track-step ${progressLevel >= 3 ? 'completed' : ''}">
                            <div class="track-icon"><i class="fas fa-check-circle"></i></div>
                            <div class="track-text">التسليم</div>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <strong style="font-size: 15px;">${order.order_details}</strong>
                        <div style="font-size: 13px; color: gray; margin-top: 5px;">${order.total_price > 0 ? 'الإجمالي: ' + order.total_price + ' د.ع' : 'بانتظار التسعير'}</div>
                    </div>
                    <button class="open-ticket-btn" data-id="${order.id}" data-details="${order.order_details}" style="background:none; border:none; color:#e74c3c; font-size:22px; cursor:pointer;" title="تواصل مع الدعم الفني">
                        <i class="fas fa-headset"></i>
                    </button>
                </div>
                ${trackingVisualHTML}
                ${actionButtons}
            `;
            ordersContainer.appendChild(card);
        });

        // ------------------------------------------------------------------------
        // 🔥 السحر هنا: التقاط الطلب المستهدف من الإشعار والقفز إليه (Deep Linking)
        // ------------------------------------------------------------------------
        const targetOrderId = localStorage.getItem('target_order_id');
        if (targetOrderId) {
            setTimeout(() => {
                const targetCard = document.getElementById(`order-card-${targetOrderId}`);
                if (targetCard) {
                    // 1. التمرير السلس نحو الطلب المستهدف ليصبح في منتصف الشاشة
                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // 2. إضافة تأثير بصري (وميض وتكبير) للفت الانتباه
                    targetCard.style.border = "2px solid #3b82f6";
                    targetCard.style.boxShadow = "0 0 25px rgba(59,130,246,0.4)";
                    targetCard.style.transform = "scale(1.02)";

                    // 3. إزالة التأثير بعد 4 ثوانٍ ليعود البطاقة لشكلها الطبيعي
                    setTimeout(() => {
                        targetCard.style.border = "none";
                        targetCard.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
                        targetCard.style.transform = "scale(1)";
                    }, 4000);

                    // 4. مسح رقم الطلب من الذاكرة لكي لا يتكرر هذا الحدث عند تحديث الصفحة
                    localStorage.removeItem('target_order_id');
                }
            }, 600); // ننتظر نصف ثانية لضمان اكتمال رسم الواجهة في المتصفح
        }

    });
}
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الرابع والثامن: محرك الأحداث الشامل Event Delegation]
// --- 3. التقاط أحداث الأزرار (فتح التذاكر، الموافقة، الرفض) ---
// ----------------------------------------------------------------------------
document.getElementById('orders-container').addEventListener('click', async (e) => {

    // 1. فتح نافذة التذاكر المربوطة بالسياق (Context-Based Ticket)
    const ticketBtn = e.target.closest('.open-ticket-btn');
    if (ticketBtn) {
        currentTicketOrderId = ticketBtn.getAttribute('data-id');
        const details = ticketBtn.getAttribute('data-details');
        // حقن اسم الطلب في واجهة التذكرة ليعرف العميل أنه يشتكي على هذا الطلب تحديداً
        document.getElementById('ticket-order-info').innerText = `بخصوص طلب: ${details}`;
        document.getElementById('ticket-modal').style.display = 'flex';
        return;
    }

    // 2. الموافقة على السعر [تطبيقاً للمرحلة 3 من دورة الحياة]
    const approveBtn = e.target.closest('.approve-btn');
    if (approveBtn) {
        const orderId = approveBtn.getAttribute('data-id');
        approveBtn.disabled = true; approveBtn.innerText = "جاري التأكيد...";
        // تحويل الطلب لحالة ASSIGNED ليظهر مباشرة في تطبيق المناديب الميدانيين
        await updateDoc(doc(db, "orders", orderId), { status: 'ASSIGNED' });
        alert("تمت الموافقة! جاري إرسال الطلب للمناديب.");
        return;
    }

    // 3. رفض السعر وإلغاء الطلب من قبل العميل
    const rejectBtn = e.target.closest('.reject-btn');
    if (rejectBtn) {
        // إجبار العميل على كتابة سبب لكي تراه الإدارة في السجل الجنائي
        const reason = prompt("يرجى كتابة سبب الرفض (مثال: السعر مرتفع):");
        if (reason && reason.trim() !== "") {
            const orderId = rejectBtn.getAttribute('data-id');
            rejectBtn.disabled = true; rejectBtn.innerText = "جاري الإلغاء...";

            await updateDoc(doc(db, "orders", orderId), {
                status: 'CANCELED_BY_CUSTOMER',
                reason: reason.trim()
            });
            alert("تم رفض السعر وإلغاء الطلب.");
        } else if (reason !== null) {
            alert("لا يمكن الإلغاء بدون ذكر السبب للإدارة.");
        }
        return;
    }
});

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثامن: نظام الدعم الفني السياقي Context-Based Ticketing]
// --- 4. نظام إرسال التذاكر (شكاوى العملاء) ---
// ----------------------------------------------------------------------------
let currentTicketOrderId = null;

document.getElementById('submit-ticket-btn').addEventListener('click', async (e) => {
    const subject = document.getElementById('ticket-subject').value;
    const message = document.getElementById('ticket-message').value.trim();

    if (!message) { alert("يرجى كتابة تفاصيل المشكلة!"); return; }

    try {
        e.target.disabled = true; e.target.innerText = "جاري الإرسال...";

        // إنشاء التذكرة وحفظها في قاعدة البيانات مع ربطها برقم الطلب (order_id)
        await addDoc(collection(db, "tickets"), {
            order_id: currentTicketOrderId,  // الربط السياقي
            customer_id: currentUserUid,
            subject: subject,
            message: message,
            status: 'OPEN', // حالة الشكوى (مفتوحة للإدارة)
            created_at: serverTimestamp()
        });

        alert("تم استلام رسالتك! سيقوم الدعم الفني بمراجعتها في أسرع وقت.");
        document.getElementById('ticket-modal').style.display = 'none';
        document.getElementById('ticket-message').value = '';
    } catch (error) {
        console.error("خطأ:", error);
        alert("حدث خطأ أثناء الإرسال.");
    } finally {
        e.target.disabled = false; e.target.innerText = "إرسال للإدارة";
    }
});

// ============================================================================
// --- شاشة تفاصيل الطلب والسجل الزمني للعميل (Customer Details Engine) ---
// ============================================================================
const custOrderDetailsModal = document.getElementById('customer-order-details-modal');
const closeCustOrderDetailsBtn = document.getElementById('close-customer-order-details');
let custOpenedOrderId = null;

// إغلاق النافذة
if (closeCustOrderDetailsBtn) {
    closeCustOrderDetailsBtn.addEventListener('click', () => {
        custOrderDetailsModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // إعادة التمرير
    });
}
// نظام التبويبات (Tabs Logic)
document.querySelectorAll('.c-order-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.c-order-tab-btn').forEach(b => {
            b.classList.remove('active'); b.style.color = '#64748b'; b.style.borderBottomColor = 'transparent';
        });
        e.target.classList.add('active'); e.target.style.color = '#3b82f6'; e.target.style.borderBottomColor = '#3b82f6';

        document.querySelectorAll('.c-order-tab-content').forEach(content => content.style.display = 'none');
        const targetTab = e.target.getAttribute('data-tab');
        document.getElementById(targetTab).style.display = 'block';

        if (targetTab === 'c-tab-logs' && custOpenedOrderId) {
            fetchCustomerOrderLogs(custOpenedOrderId);
        }
    });
});

// التقاط الضغطة على بطاقة الطلب لفتح التفاصيل
document.getElementById('orders-container')?.addEventListener('click', async (e) => {
    // 🛡️ حماية: تجاهل الضغط إذا كان على زر الموافقة/الرفض أو زر الدعم الفني
    if (e.target.closest('button')) return;

    const card = e.target.closest('.order-card-clickable');
    if (card) {
        const orderId = card.getAttribute('data-id');
        const order = window.loadedCustomerOrders[orderId];
        if (order) await openCustomerOrderDetails(order);
    }
});

// دالة تعبئة البيانات في النافذة للعميل
async function openCustomerOrderDetails(order) {
    document.body.style.overflow = 'hidden'; // إيقاف التمرير في الخلفية
    custOpenedOrderId = order.id;
    document.querySelector('[data-tab="c-tab-details"]').click(); // تفعيل تبويب التفاصيل

    document.getElementById('modal-c-price').innerText = (order.merchant_price || 0) + ' د.ع';
    document.getElementById('modal-c-delivery').innerText = (order.delivery_fee || 0) + ' د.ع';
    document.getElementById('modal-c-total').innerText = (order.total_price || 0) + ' د.ع';

    // 🧠 الذكاء: جلب اسم التاجر
    const merchantNameEl = document.getElementById('modal-c-merchant-name');
    if (order.merchant_id) {
        merchantNameEl.innerText = "جاري التحميل...";
        try {
            const mDoc = await getDoc(doc(db, "users", order.merchant_id));
            if (mDoc.exists()) { merchantNameEl.innerText = mDoc.data().store_name || mDoc.data().name || "متجر مسجل"; }
        } catch (e) { merchantNameEl.innerText = "متجر مسجل"; }
    } else {
        merchantNameEl.innerText = "لم يتم تحديد متجر (يُعالج من قبل الإدارة 🎧)";
    }

    // جلب بيانات المندوب (إن وجد)
    const driverSec = document.getElementById('modal-c-driver-section');
    if (order.driver_id) {
        driverSec.style.display = 'block';
        document.getElementById('modal-c-driver-name').innerText = "جاري التحميل...";
        document.getElementById('modal-c-driver-phone').innerText = "...";
        try {
            const dDoc = await getDoc(doc(db, "users", order.driver_id));
            if (dDoc.exists()) {
                document.getElementById('modal-c-driver-name').innerText = dDoc.data().name || "مندوب";
                document.getElementById('modal-c-driver-phone').innerText = dDoc.data().phone || "غير متوفر";
            }
        } catch (e) { }
    } else {
        driverSec.style.display = 'none';
    }

    // سبب الإلغاء
    const cancelSec = document.getElementById('modal-c-cancel-section');
    if (order.status.includes('CANCEL')) {
        cancelSec.style.display = 'block';
        document.getElementById('modal-c-cancel-reason').innerText = order.reason || order.cancel_reason || "لم يتم ذكر السبب.";
    } else {
        cancelSec.style.display = 'none';
    }

    custOrderDetailsModal.style.display = 'block';
}

// دالة جلب السجل الزمني (Timeline) للعميل
async function fetchCustomerOrderLogs(orderId) {
    const content = document.getElementById('audit-log-content-customer');
    try {
        const qLogs = query(collection(db, `orders/${orderId}/order_logs`), orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(qLogs);

        if (querySnapshot.empty) {
            content.innerHTML = `<p style="text-align:center; padding:20px; color: gray;">لا يوجد سجل حركات لهذا الطلب حتى الآن.</p>`;
            return;
        }

        let timelineHtml = '<div style="position: relative; padding-right: 20px; border-right: 2px solid #cbd5e1; margin-top: 10px;">';

        querySnapshot.forEach((docSnap) => {
            const log = docSnap.data();
            const timeStr = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

            let dotColor = '#94a3b8';
            if (log.action_type === 'PRICE_SET') dotColor = '#f59e0b';
            if (log.action_type === 'ASSIGNED') dotColor = '#3b82f6';
            if (log.action_type === 'MERCHANT_PAID' || log.action_type === 'DELIVERED') dotColor = '#10b981';
            if (log.action_type.includes('CANCEL')) dotColor = '#ef4444';

            // تجميل من قام بالإجراء ليناسب رؤية العميل
            let actionByStr = log.action_by || 'النظام';
            if (actionByStr === 'موظف الإدارة') actionByStr = 'الدعم الفني 🎧';

            timelineHtml += `
                <div style="margin-bottom: 20px; position: relative;">
                    <div style="position: absolute; right: -27px; top: 5px; background: ${dotColor}; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 0 3px #f8fafc;"></div>
                    <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <strong style="color: #1e293b; font-size: 13px;">${actionByStr}</strong>
                            <span style="font-size: 11px; color: #94a3b8; direction: ltr;">${timeStr}</span>
                        </div>
                        <div style="font-size: 13px; color: #475569; line-height: 1.5;">${log.description}</div>
                    </div>
                </div>`;
        });
        timelineHtml += '</div>';
        content.innerHTML = timelineHtml;

    } catch (error) {
        console.error("خطأ في جلب السجل:", error);
        content.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ أثناء جلب البيانات.</p>';
    }
}

// ============================================================================
// 🚀 توجيه زر الطلب الحر لفتح النافذة برابط مباشر (الطريقة المضمونة)
// ============================================================================
const fabBtn = document.getElementById('open-direct-order-btn');
if (fabBtn) {
    fabBtn.addEventListener('click', () => {
        // نضع الإشارة في الرابط نفسه بدلاً من الذاكرة
        window.location.href = 'index.html?action=order';
    });
}