// ============================================================================
// تطبيق التاجر - المحرك الرئيسي (Merchant App Core Logic)
// تطبيقاً لـ [الجزء الرابع]: دورة حياة الطلب (المرحلة 2: التسعير، والمرحلة 4: الاستلام المالي).
// وتطبيقاً لـ [الجزء الخامس]: محرك الإشعارات، جرس التنبيهات، والتفاعل معها.
// وتطبيقاً لـ [الجزء الثالث]: نظام إضافة طلبات الضيوف (Guest Orders) عبر الهاتف.
// ============================================================================

import { auth, db } from '../../shared/firebase-config.js';
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, getDoc, addDoc, serverTimestamp, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentMerchantId = null;
let currentMerchantEmail = null; // أضفنا هذا لتغيير الباسورد
// ============================================================================
// --- محرك فحص التحديثات للتاجر (Update Guard) ---
// ============================================================================
const APP_VERSION = '1.0';

async function checkMerchantUpdates() {
    try {
        const docSnap = await getDoc(doc(db, "app_settings", "updates"));
        if (docSnap.exists()) {
            const data = docSnap.data().merchant; // نأخذ إعدادات التاجر
            if (data && data.new_version > APP_VERSION) {

                const title = data.title || "يتوفر تحديث جديد للتطبيق!";
                const link = data.link || "#";
                const icon = data.icon || "https://cdn-icons-png.flaticon.com/512/9322/9322127.png";

                if (data.type === 'mandatory') {
                    const mScreen = document.getElementById('mandatory-update-screen');
                    if (mScreen) {
                        mScreen.style.display = 'flex';
                        document.getElementById('m-upd-title').innerText = title;
                        document.getElementById('m-upd-link').href = link;
                        if (data.icon) document.getElementById('m-upd-icon').src = icon;
                    }
                } else if (data.type === 'optional') {
                    const skippedVersion = localStorage.getItem('merchant_skipped_update');
                    if (skippedVersion !== data.new_version) {
                        const oToast = document.getElementById('optional-update-toast');
                        if (oToast) {
                            oToast.style.display = 'flex';
                            document.getElementById('o-upd-title').innerText = title;
                            document.getElementById('o-upd-link').href = link;

                            document.getElementById('o-upd-skip').addEventListener('click', () => {
                                oToast.style.display = 'none';
                                localStorage.setItem('merchant_skipped_update', data.new_version);
                            });
                        }
                    }
                    localStorage.setItem('merchant_optional_update', JSON.stringify(data));
                }
            } else {
                localStorage.removeItem('merchant_optional_update');
            }
        }
    } catch (e) { console.error("خطأ في فحص التحديثات:", e); }
}
checkMerchantUpdates();
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: إدارة الجلسات ومصفوفة الصلاحيات RBAC]
// التحقق من الدخول وجلب معرف التاجر لضمان أنه يرى طلباته الخاصة فقط.
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: إدارة الجلسات ومصفوفة الصلاحيات RBAC]
// التحقق من الدخول وجلب معرف التاجر لضمان أنه يرى طلباته الخاصة فقط.
// ----------------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentMerchantId = user.uid;
        currentMerchantEmail = user.email;

        // جلب بيانات التاجر لتعبئة شاشة حسابي والهيدر
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            const storeName = data.store_name || data.name || "متجري";

            document.getElementById('merchant-name').innerText = storeName;

            const accNameEl = document.getElementById('account-merchant-name');
            if (accNameEl) accNameEl.innerText = storeName;

            const accPhoneEl = document.getElementById('account-merchant-phone');
            if (accPhoneEl) accPhoneEl.innerText = data.phone || "رقم غير مسجل";
        }

        loadMerchantOrders();
        startMerchantNotificationRadar();
    } else {
        window.location.href = 'login.html';
    }
});

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء السابع: شاشة إدارة الطلبات - التبويبات]
// دالة لجلب الطلبات لحظياً وعرضها في تبويبات (مع مستشعر الإشعارات والصندوق الأسود)
// ----------------------------------------------------------------------------
function loadMerchantOrders() {

    window.loadedMerchantOrders = {}; // ذاكرة لحفظ الطلبات
    // جلب الطلبات التي تخص هذا التاجر فقط (مبدأ الأمان)
    const q = query(collection(db, "orders"), where("merchant_id", "==", currentMerchantId));
    let isFirstLoad = true;

    onSnapshot(q, (snapshot) => {
        const newList = document.getElementById('new-orders-list');
        const processingList = document.getElementById('processing-orders-list');
        const historyList = document.getElementById('history-orders-list');

        if (!newList || !processingList || !historyList) return; // حماية من الأخطاء إذا لم تحمل الصفحة

        let newOrdersHTML = '';
        let processingHTML = '';
        let historyHTML = '';
        let newOrdersCount = 0;

        // ترتيب الطلبات برمجياً من الأحدث للأقدم (حتى يظهر الأرشيف مرتباً)
        const docsArray = [];
        snapshot.forEach(doc => docsArray.push({ id: doc.id, ...doc.data() }));
        docsArray.sort((a, b) => (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0));

        // 1. [تطبيقاً للجزء الخامس]: تشغيل صوت الإشعار التلقائي للطلبات الجديدة فقط
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !isFirstLoad) {
                if (change.doc.data().status === 'PENDING') {
                    const audio = document.getElementById('alert-sound');
                    if (audio) audio.play().catch(e => console.log("المتصفح منع الصوت"));
                }
            }
        });

        // 2. [تطبيقاً للجزء السابع]: توزيع الطلبات على الأقسام الثلاثة
        docsArray.forEach(order => {
            window.loadedMerchantOrders[order.id] = order; // حفظ في الذاكرة
            const orderId = order.id;
            const dateStr = order.created_at ? new Date(order.created_at.toDate()).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '';

            // --- القسم الأول: الطلبات الجديدة (تحتاج تسعير PENDING) ---
            if (order.status === 'PENDING') {
                newOrdersCount++;
                newOrdersHTML += `
                   <div class="order-card-clickable" data-id="${orderId}" style="cursor: pointer; border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 8px; text-align: right; box-shadow: 0 2px 4px rgba(0,0,0,0.05); background:#fff3cd; border-right: 5px solid #ffc107; transition: 0.2s;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${order.order_details}</strong>
                            <span style="font-size: 11px; color: gray;">${dateStr}</span>
                        </div>
                        <p style="color: gray; font-size: 13px; margin-top: 5px;"><strong>ملاحظة للعنوان:</strong> ${order.address_note}</p>
                        <p style="font-size: 12px; color: #2980b9; font-weight: bold; margin-top: 5px;">🚚 أجرة توصيل المنطقة: ${order.delivery_fee || 0} د.ع</p>
                        
                        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px;">
                            <input type="text" id="note-${orderId}" placeholder="ملاحظة للمندوب (مثال: قابل للكسر، حار جداً)..." style="padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
                            <div style="display: flex; gap: 10px;">
                                <input type="number" id="price-${orderId}" placeholder="أدخل سعر المنتج فقط (د.ع)" style="padding: 10px; flex: 2; border: 1px solid #ccc; border-radius: 5px;">
                                <button class="set-price-btn" data-id="${orderId}" data-fee="${order.delivery_fee || 0}" data-admin="${order.is_admin_guest || false}" style="background: #2ecc71; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: bold; flex: 1;">إرسال السعر</button>
                                <button class="cancel-order-btn" data-id="${orderId}" style="background: #e74c3c; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: bold;"><i class="fas fa-times"></i> رفض</button>
                            </div>
                        </div>
                    </div>
                `;
            }
            // --- القسم الثاني: قيد التجهيز والتوصيل (AWAITING_APPROVAL, ASSIGNED, IN_TRANSIT) ---
            else if (['AWAITING_APPROVAL', 'ASSIGNED', 'IN_TRANSIT'].includes(order.status)) {
                let statusText = order.status === 'AWAITING_APPROVAL' ? '⏳ بانتظار موافقة العميل على السعر' :
                    order.status === 'ASSIGNED' ? '🛵 المندوب في الطريق إليك (أو بانتظارك)' : '🚚 بالطريق للعميل';

                // [تطبيقاً للجزء الرابع والسادس]: القفل المالي (تأكيد استلام النقد من المندوب)
                let confirmCashBtn = '';
                if (order.status === 'ASSIGNED' && order.driver_id) {
                    // تأثير بصري (نبض أحمر) إذا قام المندوب بضرب الجرس من تطبيقه
                    const alertStyle = order.merchant_alerted ? "animation: pulse 1s infinite; border: 2px solid red;" : "";

                    confirmCashBtn = `
                        <button class="confirm-cash-btn" data-id="${orderId}" style="margin-top: 15px; width: 100%; background: #2ecc71; color: white; border: none; padding: 12px; border-radius: 5px; font-weight: bold; cursor: pointer; ${alertStyle}">
                            💰 استلمت المبلغ (${order.merchant_price || order.total_price} د.ع) وسلمت الطلب
                        </button>
                    `;
                }

                processingHTML += `
                    <div class="order-card-clickable" data-id="${orderId}" style="cursor: pointer; border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 8px; text-align: right; background: #f9f9f9; border-right: 5px solid #3498db; transition: 0.2s;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${order.order_details}</strong>
                            <span style="font-size: 11px; color: gray;">${dateStr}</span>
                        </div>
                        <p style="margin-top: 5px; color: #2c3e50; font-weight: bold; font-size: 13px;">الحالة: ${statusText}</p>
                        ${confirmCashBtn}
                    </div>
                `;
            }
            // --- القسم الثالث: الأرشيف (مكتمل DELIVERED / ملغي CANCELED) ---
            else {
                let isDelivered = order.status === 'DELIVERED';
                let historyStatusText = isDelivered ? '✅ تم التسليم' : '🚫 ملغي';
                let colorBorder = isDelivered ? '#2ecc71' : '#e74c3c';
                // إظهار سبب الإلغاء في الأرشيف
                let reasonHtml = !isDelivered ? `<p style="margin-top: 5px; font-size: 12px; color: #e74c3c;">سبب الإلغاء: ${order.cancel_reason || order.reason || 'غير محدد'}</p>` : '';

                historyHTML += `
                    <div class="order-card-clickable" data-id="${orderId}" style="cursor: pointer; border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 8px; text-align: right; opacity: 0.8; border-right: 5px solid ${colorBorder}; transition: 0.2s;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${order.order_details}</strong>
                            <span style="font-size: 12px; font-weight: bold; color: ${colorBorder};">${historyStatusText}</span>
                        </div>
                        <p style="margin-top: 5px; font-size: 12px; color: gray;">${dateStr} | السعر: ${order.total_price || 0} د.ع</p>
                        ${reasonHtml}
                    </div>
                `;
            }
        });

        // رسائل في حال كانت الأقسام فارغة
        newList.innerHTML = newOrdersHTML || '<p style="color:gray; font-size:14px; text-align:center;">لا توجد طلبات جديدة حالياً.</p>';
        processingList.innerHTML = processingHTML || '<p style="color:gray; font-size:14px; text-align:center;">لا توجد طلبات قيد التجهيز.</p>';
        historyList.innerHTML = historyHTML || '<p style="color:gray; font-size:14px; text-align:center;">لا يوجد سجل طلبات سابق.</p>';

        isFirstLoad = false;

        // ----------------------------------------------------------------------------
        // --- 3. برمجة الأحداث للأزرار الجديدة (تطبيق السجل الجنائي) ---
        // ----------------------------------------------------------------------------

        // أ. زر إرسال السعر [تطبيقاً للمرحلة 2: التسعير والتفاوض]
        // أ. زر إرسال السعر [تحديث المرحلة 2 - النسخة المصححة من الخطأ]
        document.querySelectorAll('.set-price-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetBtn = e.target.closest('button'); // لضمان التقاط الزر حتى لو ضغط على الأيقونة
                const orderId = targetBtn.getAttribute('data-id');
                const deliveryFee = Number(targetBtn.getAttribute('data-fee')) || 0;

                // --- الحل: قراءة الوسام من الزر مباشرة ---
                const isAdminGuest = targetBtn.getAttribute('data-admin') === 'true';

                const merchantPrice = Number(document.getElementById(`price-${orderId}`).value);
                const noteInput = document.getElementById(`note-${orderId}`).value.trim();

                if (!merchantPrice || merchantPrice <= 0) { alert("يرجى إدخال سعر صحيح للمنتج!"); return; }

                const finalTotalPrice = merchantPrice + deliveryFee;

                try {
                    targetBtn.disabled = true; targetBtn.innerText = "...";

                    // تحديد الحالة التالية بناءً على المتغير الجديد
                    const nextStatus = isAdminGuest ? 'ASSIGNED' : 'AWAITING_APPROVAL';
                    const logMessage = isAdminGuest
                        ? `تم التسعير والتحويل للمندوب فوراً (طلب إداري). الإجمالي: ${finalTotalPrice}`
                        : `سعر المنتج: ${merchantPrice} | التوصيل: ${deliveryFee} | الإجمالي: ${finalTotalPrice}`;

                    await updateDoc(doc(db, "orders", orderId), {
                        merchant_price: merchantPrice,
                        total_price: finalTotalPrice,
                        merchant_note: noteInput || 'لا توجد ملاحظات',
                        status: nextStatus
                    });

                    await addDoc(collection(db, `orders/${orderId}/order_logs`), {
                        timestamp: serverTimestamp(),
                        action_type: 'PRICE_SET',
                        description: logMessage,
                        action_by: document.getElementById('merchant-name').innerText
                    });
                } catch (error) { console.error(error); targetBtn.disabled = false; targetBtn.innerText = "إرسال السعر"; }
            });
        });

        // ب. زر رفض وإلغاء الطلب [تطبيقاً للجزء الرابع: حالات الإلغاء]
        document.querySelectorAll('.cancel-order-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const orderId = e.target.getAttribute('data-id');

                // إجبار التاجر على كتابة السبب للإدارة (Reason is Mandatory)
                const reason = prompt("يرجى كتابة سبب الإلغاء بدقة للإدارة (مثال: نفدت الكمية):");

                if (reason === null) return; // تراجع
                if (reason.trim() === "") {
                    alert("إجراء مرفوض ❌! يجب كتابة سبب الإلغاء لتوثيقه في السجل.");
                    return;
                }

                try {
                    e.target.disabled = true; e.target.innerHTML = "جاري الإلغاء...";

                    // 1. تحديث حالة الطلب
                    await updateDoc(doc(db, "orders", orderId), {
                        status: 'CANCELED_BY_MERCHANT',
                        cancel_reason: reason.trim()
                    });

                    // 2. توثيق المخالفة/الإلغاء في السجل الجنائي
                    await addDoc(collection(db, `orders/${orderId}/order_logs`), {
                        timestamp: serverTimestamp(),
                        action_type: 'CANCELED_BY_MERCHANT',
                        description: `تم رفض الطلب وإلغاؤه من قبل التاجر. السبب: ${reason.trim()}`,
                        action_by: document.getElementById('merchant-name').innerText
                    });

                    alert("تم الإلغاء وتوثيق السبب في السجل الإداري بنجاح.");
                } catch (error) {
                    console.error("خطأ:", error);
                    alert("حدث خطأ أثناء الإلغاء.");
                    e.target.disabled = false;
                }
            });
        });

        // ج. زر تأكيد استلام المبلغ من المندوب [تطبيقاً للمرحلة 4: الاستلام والتوصيل]
        document.querySelectorAll('.confirm-cash-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const orderId = e.target.getAttribute('data-id');
                const confirmMsg = confirm("🚨 تحذير: هل أنت متأكد أنك استلمت أموالك نقداً من المندوب؟ بمجرد التأكيد سينطلق الطلب.");
                if (!confirmMsg) return;

                try {
                    e.target.disabled = true; e.target.innerText = "جاري التأكيد...";
                    await updateDoc(doc(db, "orders", orderId), {
                        status: 'IN_TRANSIT',      // فتح القفل للمندوب لينطلق
                        merchant_paid: true,       // تأكيد الدفع
                        merchant_alerted: false    // إطفاء التنبيه
                    });

                    // توثيق البصمة المالية في السجل الجنائي
                    await addDoc(collection(db, `orders/${orderId}/order_logs`), {
                        timestamp: serverTimestamp(),
                        action_type: 'MERCHANT_PAID',
                        description: `💰 أقر التاجر باستلام المبلغ نقداً من المندوب وتم تسليم الطلب. المندوب الآن بالطريق للعميل.`,
                        action_by: document.getElementById('merchant-name').innerText
                    });

                    alert("تم تأكيد الاستلام! المندوب الآن في طريقه للعميل.");
                } catch (error) {
                    console.error(error);
                    alert("حدث خطأ.");
                    e.target.disabled = false;
                }
            });
        });
    });
}

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثالث: إضافة طلبات الضيوف Guest Orders عبر الهاتف]
// --- 3. نظام طلبات الضيوف (ميزة التاجر للطلبات الهاتفية) ---
// ----------------------------------------------------------------------------
const guestModal = document.getElementById('guest-modal');
const openModalBtn = document.getElementById('open-guest-modal');
const closeModalBtn = document.getElementById('close-guest-modal');
const guestZoneSelect = document.getElementById('guest-zone-select');
let zonesData = {};

// فتح النافذة وجلب المناطق (Zones) لضمان التوجيه الصحيح
openModalBtn.addEventListener('click', async () => {
    guestModal.classList.add('active');

    // جلب المناطق إذا لم يتم جلبها مسبقاً
    if (Object.keys(zonesData).length === 0) {
        guestZoneSelect.innerHTML = '<option value="">-- اختر المنطقة --</option>';
        const snapshot = await getDocs(query(collection(db, "zones"), where("is_active", "==", true)));
        snapshot.forEach(doc => {
            zonesData[doc.id] = doc.data();
            guestZoneSelect.innerHTML += `<option value="${doc.id}">${doc.data().name} (${doc.data().city})</option>`;
        });
    }
});

// إغلاق النافذة
closeModalBtn.addEventListener('click', () => guestModal.classList.remove('active'));

// [تطبيقاً للقرار البرمجي الذكي]: الاستماع لتغيير المنطقة لإظهار/إخفاء الأعمدة (FAT) بناءً على خصائص المنطقة
guestZoneSelect.addEventListener('change', async (e) => {
    const zoneId = e.target.value;
    const fatGroup = document.getElementById('guest-fat-group');
    const gpsGroup = document.getElementById('guest-gps-group');
    const fatSelect = document.getElementById('guest-fat-select');

    if (!zoneId) {
        fatGroup.style.display = 'none'; gpsGroup.style.display = 'none'; return;
    }

    const zone = zonesData[zoneId];
    if (zone.has_fat) {
        fatGroup.style.display = 'flex'; gpsGroup.style.display = 'none';
        fatSelect.innerHTML = '<option value="">-- جاري التحميل... --</option>';
        const colsSnapshot = await getDocs(collection(db, `zones/${zoneId}/columns`));
        fatSelect.innerHTML = '<option value="">-- اختر العمود --</option>';
        colsSnapshot.forEach(doc => {
            fatSelect.innerHTML += `<option value="${doc.data().column_id}">${doc.data().column_id}</option>`;
        });
    } else {
        fatGroup.style.display = 'none'; gpsGroup.style.display = 'flex';
    }
});

// إرسال طلب الضيف لقاعدة البيانات
document.getElementById('submit-guest-order').addEventListener('click', async () => {
    const phone = document.getElementById('guest-phone').value.trim();
    const details = document.getElementById('guest-order-details').value.trim();
    const price = Number(document.getElementById('guest-price').value);
    const zoneId = guestZoneSelect.value;
    const addressNote = document.getElementById('guest-address-note').value.trim();

    if (!phone || !details || !price || !zoneId || !addressNote) {
        alert("يرجى تعبئة جميع الحقول الإجبارية (الهاتف، التفاصيل، السعر، المنطقة، العنوان)!");
        return;
    }
    // 🛡️ القفل الأمني الصارم لرقم هاتف العميل الضيف
    if (!phone.startsWith('07') || phone.length !== 11) {
        alert("🚨 رقم هاتف العميل غير صالح! يجب أن يتكون من 11 رقماً ويبدأ بـ 07");
        return;
    }

    let columnId = null;
    if (zonesData[zoneId].has_fat) {
        columnId = document.getElementById('guest-fat-select').value;
        if (!columnId) { alert("يرجى اختيار رقم العمود!"); return; }
    }

    try {
        const btn = document.getElementById('submit-guest-order');
        btn.disabled = true; btn.innerText = "جاري الإرسال...";

        // إنشاء الطلب (مباشرة لحالة ASSIGNED لأنه مسعّر وجاهز للمندوب ليأخذه فوراً)
        // --- [تحديث]: محرك الحساب المالي لطلب الضيف ---
        const deliveryFee = Number(zonesData[zoneId].delivery_fee) || 0; // جلب أجرة المنطقة
        const finalTotalPrice = price + deliveryFee; // الحساب الإجمالي العادل

        const newOrderRef = await addDoc(collection(db, "orders"), {
            created_by_user_id: currentMerchantId,
            merchant_id: currentMerchantId,
            customer_id: null,
            guest_name: document.getElementById('guest-name').value.trim() || 'عميل ضيف',
            guest_phone: phone,
            driver_id: null,
            status: 'ASSIGNED',
            zone_id: zoneId,
            column_id: columnId,
            address_note: addressNote,
            order_details: details,
            merchant_price: price,      // صافي ربح التاجر
            delivery_fee: deliveryFee,  // أجرة التوصيل (للمكتب والمندوب)
            total_price: finalTotalPrice, // المبلغ الذي سيظهر للمندوب لتحصيله من العميل
            created_at: serverTimestamp()
        });

        // توثيق إنشاء طلب الضيف في السجل الجنائي
        await addDoc(collection(db, `orders/${newOrderRef.id}/order_logs`), {
            timestamp: serverTimestamp(),
            action_type: 'ASSIGNED',
            description: 'تم إنشاء الطلب وتسعيره من قبل التاجر لعميل ضيف.',
            action_by: 'التاجر'
        });

        alert("تم إرسال الطلب للمناديب بنجاح!");
        guestModal.classList.remove('active');

        // تفريغ الحقول
        document.getElementById('guest-phone').value = '';
        document.getElementById('guest-order-details').value = '';
        document.getElementById('guest-price').value = '';
        document.getElementById('guest-address-note').value = '';

    } catch (error) {
        console.error("خطأ:", error);
        alert("حدث خطأ أثناء الإرسال.");
    } finally {
        const btn = document.getElementById('submit-guest-order');
        btn.disabled = false; btn.innerText = "إرسال للمناديب فوراً";
    }
});

// ============================================================================
// --- نظام التنقل بين الشاشات (SPA Navigation) ---
// ============================================================================
function switchScreen(screenId) {
    // إخفاء جميع الشاشات وإزالة التفعيل من الشريط السفلي
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));

    if (screenId === 'orders') {
        document.getElementById('screen-orders').style.display = 'block';
        document.getElementById('nav-orders').classList.add('active');
    } else if (screenId === 'archive') {
        document.getElementById('screen-archive').style.display = 'block';
        document.getElementById('nav-archive').classList.add('active');
    } else if (screenId === 'products') {
        document.getElementById('screen-products').style.display = 'block';
        document.getElementById('nav-products').classList.add('active');
    } else if (screenId === 'account') {
        document.getElementById('screen-account').style.display = 'block';
        document.getElementById('nav-account').classList.add('active');
        // تحديث اسم المتجر في شاشة حسابي
        document.getElementById('account-merchant-name').innerText = document.getElementById('merchant-name').innerText;
    } else if (screenId === 'notifications') {
        document.getElementById('screen-notifications').style.display = 'block';
    }
}

// أزرار التنقل السفلية
document.getElementById('nav-orders').addEventListener('click', () => switchScreen('orders'));
document.getElementById('nav-archive').addEventListener('click', () => switchScreen('archive'));
document.getElementById('nav-products').addEventListener('click', () => switchScreen('products'));
document.getElementById('nav-account').addEventListener('click', () => switchScreen('account'));
// فتح الإشعارات من الجرس
document.getElementById('bell-btn').addEventListener('click', () => switchScreen('notifications'));

// 🚀 برمجة زر تسجيل الخروج (الموجود الآن في شاشة حسابي)
document.getElementById('account-logout-btn')?.addEventListener('click', async () => {
    if (confirm("هل تريد تسجيل الخروج؟")) {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) { console.error("خطأ أثناء الخروج:", error); }
    }
});

// ============================================================================
// [تطبيقاً للجزء الخامس]: الرادار الذكي للإشعارات والتوجيه العميق (Merchant Radar)
// ============================================================================
let localReadNotifications = JSON.parse(localStorage.getItem('merchant_read_notifs')) || [];
let toastedNotifs = new Set();
let globalNotifIds = [];

// إغلاق واجهة الإشعار الغني
document.querySelectorAll('.close-page-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).style.display = 'none';
    });
});

// فتح الإشعارات من الجرس وتصفير العداد
document.getElementById('bell-btn').addEventListener('click', () => {
    switchScreen('notifications');
    document.getElementById('notification-badge').style.display = 'none';

    globalNotifIds.forEach(id => {
        if (!localReadNotifications.includes(id)) {
            localReadNotifications.push(id);
        }
    });
    localStorage.setItem('merchant_read_notifs', JSON.stringify(localReadNotifications));

    document.querySelectorAll('.notif-card').forEach(card => {
        card.style.background = 'white';
        card.style.borderRight = 'none';
    });
});

function startMerchantNotificationRadar() {
    // توليد النافذة المنزلقة (Toast)
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; top: -100px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; padding: 15px 25px; border-radius: 30px; box-shadow: 0 10px 30px rgba(59,130,246,0.4); z-index: 9999; display: flex; align-items: center; gap: 15px; transition: top 0.4s; direction: rtl; width: 90%; max-width: 400px;';
    toast.innerHTML = `<i class="fas fa-bell" style="font-size: 20px;"></i> <div><h4 id="m-toast-title" style="margin:0; font-size:15px;"></h4><p id="m-toast-body" style="margin:3px 0 0 0; font-size:13px; opacity:0.9;"></p></div>`;
    document.body.appendChild(toast);

    const qNotifs = query(collection(db, "notifications"), orderBy("created_at", "desc"), limit(40));
    let isFirstLoad = true;

    onSnapshot(qNotifs, (snapshot) => {
        const list = document.getElementById('notifications-list-screen');
        const badge = document.getElementById('notification-badge');
        list.innerHTML = '';
        let unreadCount = 0;
        globalNotifIds = [];

        snapshot.forEach(docSnap => {
            const notif = docSnap.data();
            const notifId = docSnap.id;

            // هل الإشعار للتاجر؟ (يستقبل إشعارات: الجميع، التجار، أو إشعار خاص به سواء بالاسم القديم أو الجديد)
            const isForMe = (notif.target_type === 'all') ||
                (notif.target_type === 'merchants') ||
                (notif.target_type === 'specific' && notif.target_uid === currentMerchantId) ||
                (notif.target_user === currentMerchantId); // لدعم الطلبات القديمة

            if (!isForMe) return;

            globalNotifIds.push(notifId);
            const isRead = localReadNotifications.includes(notifId);

            if (!isRead) { unreadCount++; }

            // النافذة المنزلقة (Toast) مع الصوت
            if (!isFirstLoad && !isRead && !toastedNotifs.has(notifId)) {
                document.getElementById('m-toast-title').innerText = notif.title || 'إشعار جديد';
                document.getElementById('m-toast-body').innerText = notif.body || notif.message || '';
                toast.style.top = '20px';

                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                const audio = document.getElementById('alert-sound');
                if (audio) audio.play().catch(e => console.log("الصوت محظور مؤقتاً"));

                setTimeout(() => toast.style.top = '-100px', 5000);
                toastedNotifs.add(notifId);
            }

            // رسم بطاقة الإشعار
            const bg = isRead ? 'background: white;' : 'background: #f0f8ff; border-right: 4px solid #3498db;';
            const dateStr = notif.created_at ? notif.created_at.toDate().toLocaleString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'الآن';

            const card = document.createElement('div');
            card.className = 'notif-card';
            card.style.cssText = `padding: 15px; margin-bottom: 12px; border-radius: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.02); border: 1px solid #e2e8f0; cursor: pointer; transition: 0.3s; display: flex; gap: 15px; align-items: flex-start; ${bg}`;

            const iconColor = isRead ? 'gray' : '#e74c3c';
            const notifTitle = notif.title || 'إشعار إداري';
            const notifBody = notif.body || notif.message || '';

            card.innerHTML = `
                <div style="background: white; padding: 12px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); color: ${iconColor};">
                    <i class="fas fa-bell" style="font-size: 18px;"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 14px; font-weight: bold; color: #2c3e50;">${notifTitle}</div>
                    <div style="font-size: 13px; color: #555; margin-top: 5px; line-height: 1.5;">${notifBody}</div>
                    <div style="font-size: 11px; color: gray; margin-top: 8px; text-align: left; direction: ltr;">${dateStr}</div>
                </div>
            `;

            // هندسة التفاعل الغني والتوجيه العميق
            card.addEventListener('click', () => {
                card.style.background = 'white'; card.style.borderRight = 'none';
                if (!localReadNotifications.includes(notifId)) {
                    localReadNotifications.push(notifId);
                    localStorage.setItem('merchant_read_notifs', JSON.stringify(localReadNotifications));
                }

                // التوجيه للطلب المباشر (Deep Link) - يدعم الإشعارات القديمة والجديدة
                const targetOrderId = notif.action_value || notif.order_id;

                if (notif.action_type === 'external_link' && notif.action_value) {
                    window.open(notif.action_value, '_blank');
                }
                else if (notif.action_type === 'internal_page') {
                    document.getElementById('rich-notif-title').innerText = notifTitle;
                    document.getElementById('rich-notif-body').innerText = notifBody;
                    const imgEl = document.getElementById('rich-notif-image');
                    if (notif.image_url) { imgEl.src = notif.image_url; imgEl.style.display = 'block'; } else { imgEl.style.display = 'none'; }
                    const actionBtn = document.getElementById('rich-notif-action-btn');
                    if (notif.action_value) { actionBtn.style.display = 'block'; actionBtn.onclick = () => window.open(notif.action_value, '_blank'); } else { actionBtn.style.display = 'none'; }
                    document.getElementById('page-rich-notification').style.display = 'block';
                }
                else if ((notif.action_type === 'order_link' || notif.order_id) && targetOrderId) {
                    // 🧠 التوجيه الذكي (Smart Routing): التحقق من حالة الطلب أولاً لمعرفة الشاشة المناسبة
                    const targetOrder = window.loadedMerchantOrders[targetOrderId];
                    let targetScreen = 'orders'; // الافتراضي هو شاشة الطلبات الحالية

                    // إذا كان الطلب موجوداً في الذاكرة، نفحص حالته
                    if (targetOrder) {
                        const archiveStatuses = ['DELIVERED', 'CANCELED', 'CANCELED_BY_MERCHANT', 'CANCELED_BY_CUSTOMER', 'CANCELED_BY_ADMIN'];
                        if (archiveStatuses.includes(targetOrder.status)) {
                            targetScreen = 'archive'; // توجيه للأرشيف إذا كان منتهي أو ملغي
                        }
                    }

                    // التوجيه للشاشة الصحيحة بناءً على الفحص
                    switchScreen(targetScreen);

                    // القفز للطلب وتحديده بصرياً (Highlight)
                    setTimeout(() => {
                        const btnElement = document.querySelector(`[data-id="${targetOrderId}"]`);
                        if (btnElement) {
                            const orderCard = btnElement.closest('div[style*="border: 1px solid"]');
                            if (orderCard) {
                                orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                orderCard.style.border = '2px solid #3b82f6';
                                orderCard.style.transform = 'scale(1.02)';
                                setTimeout(() => { orderCard.style.border = '1px solid #ddd'; orderCard.style.transform = 'scale(1)'; }, 3000);
                            }
                        } else {
                            alert("الطلب غير موجود بالقوائم الحالية.");
                        }
                    }, 500);
                }
            }); // نهاية حدث النقر على الإشعار

            list.appendChild(card);
        });

        if (list.innerHTML === '') {
            list.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: gray;">
                    <i class="fas fa-bell-slash" style="font-size:50px; opacity:0.3; margin-bottom:15px;"></i>
                    <br>لا توجد إشعارات حالياً.
                </div>`;
        }

        if (unreadCount > 0) {
            badge.style.display = 'inline-block';
            badge.innerText = unreadCount > 9 ? '+9' : unreadCount;
        } else {
            badge.style.display = 'none';
        }

        isFirstLoad = false;
    });
}

// ============================================================================
// --- شاشة تفاصيل الطلب والسجل الجنائي (Merchant Order Details Engine) ---
// ============================================================================
const orderDetailsModal = document.getElementById('order-details-modal');
const closeOrderDetailsBtn = document.getElementById('close-order-details');
let currentOpenedOrderId = null;

// إغلاق النافذة
if (closeOrderDetailsBtn) {
    closeOrderDetailsBtn.addEventListener('click', () => {
        orderDetailsModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // إعادة التمرير
    });
}
// ميزة نسخ المعرف
document.getElementById('copy-order-id')?.addEventListener('click', () => {
    const idText = document.getElementById('modal-order-id').innerText;
    navigator.clipboard.writeText(idText).then(() => alert("تم نسخ رقم الطلب!"));
});

// نظام التبويبات (Tabs Logic)
document.querySelectorAll('.order-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // تغيير الألوان للأزرار
        document.querySelectorAll('.order-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.color = '#64748b';
            b.style.borderBottomColor = 'transparent';
        });
        e.target.classList.add('active');
        e.target.style.color = '#3b82f6';
        e.target.style.borderBottomColor = '#3b82f6';

        // إخفاء المحتوى وإظهار المطلوب
        document.querySelectorAll('.order-tab-content').forEach(content => content.style.display = 'none');
        const targetTab = e.target.getAttribute('data-tab');
        document.getElementById(targetTab).style.display = 'block';

        // إذا فتح تبويب السجل، نقوم بجلبه من الفايربيس (إذا لم نجلبه مسبقاً)
        if (targetTab === 'tab-logs' && currentOpenedOrderId) {
            fetchOrderLogs(currentOpenedOrderId);
        }
    });
});

// التقاط الضغطة على بطاقة الطلب لفتح التفاصيل
// التقاط الضغطة على بطاقة الطلب لفتح التفاصيل (يعمل في شاشة الطلبات وشاشة الأرشيف)
const openOrderDetailsHandler = async (e) => {
    // 🛡️ حماية: تجاهل الضغط إذا كان على زر أو حقل إدخال
    if (e.target.closest('button') || e.target.closest('input')) return;

    const card = e.target.closest('.order-card-clickable');
    if (card) {
        const orderId = card.getAttribute('data-id');
        const order = window.loadedMerchantOrders[orderId];
        if (order) await openOrderDetailsModal(order);
    }
};

document.getElementById('screen-orders')?.addEventListener('click', openOrderDetailsHandler);
document.getElementById('screen-archive')?.addEventListener('click', openOrderDetailsHandler);
// دالة تعبئة البيانات في النافذة
async function openOrderDetailsModal(order) {
    document.body.style.overflow = 'hidden'; // إيقاف التمرير في الخلفية
    currentOpenedOrderId = order.id;

    // إرجاع التبويب الافتراضي لـ (التفاصيل) ومسح السجل القديم
    document.querySelector('[data-tab="tab-details"]').click();
    document.getElementById('audit-log-content-merchant').innerHTML = '<p style="text-align: center; color: gray; margin-top: 20px;"><i class="fas fa-spinner fa-spin"></i> جاري جلب السجل...</p>';

    document.getElementById('modal-order-id').innerText = order.id;
    document.getElementById('modal-c-fat').innerText = order.column_id || "لا يوجد / لا يتطلب";
    document.getElementById('modal-c-note').innerText = order.address_note || "لا توجد ملاحظات";

    document.getElementById('modal-p-merchant').innerText = (order.merchant_price || 0) + ' د.ع';
    document.getElementById('modal-p-delivery').innerText = (order.delivery_fee || 0) + ' د.ع';
    document.getElementById('modal-p-total').innerText = (order.total_price || 0) + ' د.ع';

    // الحالة
    const statusMap = {
        'PENDING_ADMIN': 'بانتظار الإدارة', 'PENDING': 'بانتظار تسعيرك',
        'AWAITING_APPROVAL': 'بانتظار موافقة العميل', 'ASSIGNED': 'مُسند للمندوب',
        'IN_TRANSIT': 'بالطريق للعميل', 'DELIVERED': 'مكتمل ✅',
        'CANCELED': 'ملغي 🚫', 'CANCELED_BY_MERCHANT': 'ألغيته أنت 🚫',
        'CANCELED_BY_CUSTOMER': 'ألغاه العميل 🚫', 'CANCELED_BY_ADMIN': 'ألغته الإدارة 🚫'
    };
    document.getElementById('modal-order-status').innerText = statusMap[order.status] || order.status;

    // 🧠 الذكاء: تحديد المصدر وجلب أسماء العملاء
    let sourceText = ""; let cName = "غير متوفر"; let cPhone = "غير متوفر";

    if (order.is_admin_guest) {
        sourceText = "🎧 الإدارة (طلب هاتفي)";
        cName = order.guest_name || "عميل إدارة"; cPhone = order.guest_phone || "غير متوفر";
    } else if (order.customer_id === null && order.created_by_user_id === currentMerchantId) {
        sourceText = "🏪 التاجر (تسجيل شخصي)";
        cName = order.guest_name || "عميل ضيف"; cPhone = order.guest_phone || "غير متوفر";
    } else if (order.customer_id) {
        sourceText = "📱 العميل (تطبيق)";
        document.getElementById('modal-c-name').innerText = "جاري الجلب...";
        try {
            const custDoc = await getDoc(doc(db, "users", order.customer_id));
            if (custDoc.exists()) {
                cName = custDoc.data().name || "بدون اسم";
                cPhone = custDoc.data().phone || "غير مسجل";
            }
        } catch (e) { cName = "خطأ بالجلب"; }
    }

    document.getElementById('modal-order-source').innerText = sourceText;
    document.getElementById('modal-c-name').innerText = cName;
    document.getElementById('modal-c-phone').innerText = cPhone;

    // جلب بيانات المندوب إن وُجد
    const driverSec = document.getElementById('modal-driver-section');
    if (order.driver_id) {
        driverSec.style.display = 'block';
        document.getElementById('modal-d-name').innerText = "جاري التحميل...";
        document.getElementById('modal-d-phone').innerText = "...";
        try {
            const driverDoc = await getDoc(doc(db, "users", order.driver_id));
            if (driverDoc.exists()) {
                document.getElementById('modal-d-name').innerText = driverDoc.data().name || "مندوب";
                document.getElementById('modal-d-phone').innerText = driverDoc.data().phone || "غير مسجل";
            }
        } catch (e) { }
    } else {
        driverSec.style.display = 'none';
    }

    // سبب الإلغاء
    const cancelSec = document.getElementById('modal-cancel-section');
    if (order.status.includes('CANCEL')) {
        cancelSec.style.display = 'block';
        document.getElementById('modal-cancel-reason').innerText = order.cancel_reason || order.reason || "لم يتم ذكر السبب!";
    } else {
        cancelSec.style.display = 'none';
    }

    orderDetailsModal.style.display = 'block';
}

// دالة جلب ورسم السجل الجنائي للطلب (التبويب الثاني)
async function fetchOrderLogs(orderId) {
    const content = document.getElementById('audit-log-content-merchant');
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

            // تحديد لون الدائرة حسب نوع الإجراء
            let dotColor = '#94a3b8'; // رمادي افتراضي
            if (log.action_type === 'PRICE_SET') dotColor = '#f59e0b'; // برتقالي
            if (log.action_type === 'ASSIGNED') dotColor = '#3b82f6'; // أزرق
            if (log.action_type === 'MERCHANT_PAID' || log.action_type === 'DELIVERED') dotColor = '#10b981'; // أخضر
            if (log.action_type.includes('CANCEL')) dotColor = '#ef4444'; // أحمر

            timelineHtml += `
                <div style="margin-bottom: 20px; position: relative;">
                    <div style="position: absolute; right: -27px; top: 5px; background: ${dotColor}; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 0 3px #f8fafc;"></div>
                    <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <strong style="color: #1e293b; font-size: 13px;">${log.action_by || 'النظام'}</strong>
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
// --- 10. إعدادات المتجر والأمان (Settings & Security) ---
// ============================================================================
// إغلاق النوافذ
document.querySelectorAll('.m-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('active');
    });
});

// فتح تعديل البيانات
document.getElementById('btn-m-edit-profile')?.addEventListener('click', () => {
    document.getElementById('m-edit-name-input').value = document.getElementById('account-merchant-name').innerText;
    document.getElementById('m-edit-phone-input').value = document.getElementById('account-merchant-phone').innerText;
    document.getElementById('m-modal-edit-profile').classList.add('active');
});

// حفظ التعديلات
document.getElementById('m-save-profile-btn')?.addEventListener('click', async (e) => {
    const newName = document.getElementById('m-edit-name-input').value.trim();
    const newPhone = document.getElementById('m-edit-phone-input').value.trim();

    if (!newName || !newPhone) { alert("يرجى تعبئة جميع الحقول!"); return; }
    // 🛡️ القفل الأمني الصارم لرقم هاتف التاجر
    if (!newPhone.startsWith('07') || newPhone.length !== 11) {
        alert("🚨 رقم الهاتف غير صالح! يجب أن يتكون من 11 رقماً ويبدأ بـ 07");
        return;
    }
    try {
        e.target.disabled = true; e.target.innerText = "جاري الحفظ...";

        await updateDoc(doc(db, "users", currentMerchantId), {
            store_name: newName,
            name: newName,
            phone: newPhone
        });

        document.getElementById('merchant-name').innerText = newName; // تحديث الهيدر
        document.getElementById('account-merchant-name').innerText = newName; // تحديث شاشة حسابي
        document.getElementById('account-merchant-phone').innerText = newPhone;

        alert("تم تحديث بيانات المتجر بنجاح! ✅");
        document.getElementById('m-modal-edit-profile').classList.remove('active');
    } catch (error) {
        console.error("خطأ:", error); alert("حدث خطأ أثناء التحديث.");
    } finally {
        e.target.disabled = false; e.target.innerText = "حفظ التعديلات";
    }
});

// فتح تغيير كلمة المرور
document.getElementById('btn-m-change-password')?.addEventListener('click', () => {
    document.getElementById('m-current-pwd-input').value = '';
    document.getElementById('m-new-pwd-input').value = '';
    document.getElementById('m-pwd-error-msg').style.display = 'none';
    document.getElementById('m-modal-change-password').classList.add('active');
});

// المحرك الأمني لتحديث كلمة المرور
document.getElementById('m-save-pwd-btn')?.addEventListener('click', async (e) => {
    const currentPwd = document.getElementById('m-current-pwd-input').value;
    const newPwd = document.getElementById('m-new-pwd-input').value;
    const errorMsg = document.getElementById('m-pwd-error-msg');

    if (!currentPwd || !newPwd) { errorMsg.innerText = "يرجى إدخال كلمة المرور القديمة والجديدة!"; errorMsg.style.display = 'block'; return; }
    if (newPwd.length < 6) { errorMsg.innerText = "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل!"; errorMsg.style.display = 'block'; return; }

    try {
        e.target.disabled = true; e.target.innerText = "جاري التحقق...";
        errorMsg.style.display = 'none';

        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(currentMerchantEmail, currentPwd);

        await reauthenticateWithCredential(user, credential);
        e.target.innerText = "جاري التحديث...";
        await updatePassword(user, newPwd);

        alert("تم تغيير كلمة المرور بنجاح! 🔒");
        document.getElementById('m-modal-change-password').classList.remove('active');
    } catch (error) {
        console.error(error);
        errorMsg.style.display = 'block';
        if (error.code === 'auth/invalid-credential') { errorMsg.innerText = "❌ كلمة المرور الحالية (القديمة) غير صحيحة!"; }
        else { errorMsg.innerText = "حدث خطأ غير متوقع، حاول مجدداً."; }
    } finally {
        e.target.disabled = false; e.target.innerText = "تحديث كلمة المرور";
    }
});

// فتح نافذة الحذف
document.getElementById('btn-m-delete-account')?.addEventListener('click', () => {
    document.getElementById('m-delete-pwd-input').value = '';
    document.getElementById('m-delete-error-msg').style.display = 'none';
    document.getElementById('m-modal-delete-account').classList.add('active');
});

// تأكيد الحذف
document.getElementById('m-confirm-delete-btn')?.addEventListener('click', async (e) => {
    const pwd = document.getElementById('m-delete-pwd-input').value;
    const errorMsg = document.getElementById('m-delete-error-msg');

    if (!pwd) { errorMsg.innerText = "يجب إدخال كلمة المرور لتأكيد الحذف!"; errorMsg.style.display = 'block'; return; }
    if (!confirm("🚨 هل أنت متأكد بنسبة 100% أنك تريد مسح متجرك؟ هذا الإجراء لا يمكن التراجع عنه!")) return;

    try {
        e.target.disabled = true; e.target.innerText = "جاري مسح البيانات...";
        errorMsg.style.display = 'none';

        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(currentMerchantEmail, pwd);
        await reauthenticateWithCredential(user, credential);

        // مسح ملف التاجر من قاعدة البيانات
        await deleteDoc(doc(db, "users", currentMerchantId));
        // مسح الحساب نهائياً من نظام المصادقة
        await deleteUser(user);

        alert("تم حذف المتجر وبياناته بنجاح. نتمنى أن نراك مجدداً! 👋");
        window.location.href = 'login.html';
    } catch (error) {
        console.error("خطأ أثناء الحذف:", error);
        errorMsg.style.display = 'block';
        if (error.code === 'auth/invalid-credential') { errorMsg.innerText = "❌ كلمة المرور غير صحيحة!"; }
        else { errorMsg.innerText = "حدث خطأ غير متوقع، يرجى المحاولة لاحقاً."; }
    } finally {
        e.target.disabled = false; e.target.innerText = "حذف متجري للأبد";
    }
});

// ============================================================================
// --- جلب إعدادات الدعم الفني وإظهار التحديثات في حساب التاجر ---
// ============================================================================
async function loadMerchantSupport() {
    try {
        const docSnap = await getDoc(doc(db, "app_settings", "support"));
        if (docSnap.exists()) {
            const data = docSnap.data().merchant; // دعم التاجر فقط
            if (data) {
                if (data.phone) {
                    const waClean = data.phone.replace(/\s+/g, '');
                    const waUrl = `https://wa.me/${waClean.startsWith('0') ? '964' + waClean.substring(1) : waClean}`;
                    document.getElementById('btn-m-support-whatsapp').onclick = () => window.open(waUrl, '_blank');
                }
                if (data.email) {
                    const emailBtn = document.getElementById('btn-m-support-email');
                    emailBtn.style.display = 'flex';
                    emailBtn.onclick = () => {
                        window.location.href = `mailto:${data.email}`;
                        navigator.clipboard.writeText(data.email).then(() => {
                            alert(`تم نسخ البريد الإلكتروني للمراسلة: \n${data.email}`);
                        }).catch(() => { });
                    };
                }
            }
        }
    } catch (e) { console.error("خطأ:", e); }
}

function checkMerchantOptionalBanner() {
    const updDataStr = localStorage.getItem('merchant_optional_update');
    if (updDataStr) {
        const updData = JSON.parse(updDataStr);
        const banner = document.getElementById('account-update-banner');
        if (banner) {
            banner.style.display = 'flex';
            document.getElementById('acc-upd-title').innerText = updData.title || 'احصل على أحدث الميزات والإصلاحات.';
            document.getElementById('acc-upd-link').href = updData.link || '#';
        }
    }
}

// تشغيل المحركات
loadMerchantSupport();
checkMerchantOptionalBanner();