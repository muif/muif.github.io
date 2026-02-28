// ============================================================================
// تطبيق المندوب - المحرك الميداني الرئيسي (Driver App Core Logic)
// تطبيقاً لـ [الجزء الرابع]: التقاط الطلبات، دورة الحياة الميدانية، وسيناريو الطوارئ (التحويل).
// وتطبيقاً لـ [الجزء السادس]: المحفظة و"الضربة القاضية" لتسجيل الدين عند التسليم.
// وتطبيقاً لـ [الجزء الثامن]: تتبع الموقع GPS للخريطة الحية للقيادة المركزية.
// ============================================================================
import { auth, db } from './firebase-config.js';
import { registerDeviceToken, listenToForegroundMessages } from './push-engine.js';
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, setDoc, increment, serverTimestamp, addDoc, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentDriver = null;
let currentDriverEmail = null; // 👈 سطر جديد لحفظ الإيميل للأمان
let currentEmergencyOrderId = null;
let currentOrderZone = null;


// ============================================================================
// --- محرك فحص التحديثات للمندوب (Update Guard) ---
// ============================================================================
const APP_VERSION = '1.0';


// --- محرك وضع الصيانة المدمج ---
function checkMaintenance(userPhone) {
    onSnapshot(doc(db, "app_settings", "maintenance"), (docSnap) => {
        if (docSnap.exists()) {
            const maintData = docSnap.data()["driver"]; // خاص بالمندوب
            const overlay = document.getElementById('maintenance-overlay');

            if (maintData && maintData.is_active) {
                const isWhitelisted = maintData.whitelist && maintData.whitelist.includes(userPhone);

                if (!isWhitelisted) {
                    document.getElementById('maint-title').innerText = maintData.title || "صيانة مؤقتة";
                    document.getElementById('maint-desc').innerText = maintData.message || "نعمل على تحديث النظام...";
                    if (maintData.image_url) {
                        document.getElementById('maint-img').src = maintData.image_url;
                        document.getElementById('maint-img').style.display = 'block';
                    }
                    if (maintData.external_link) {
                        document.getElementById('maint-link-btn').href = maintData.external_link;
                        document.getElementById('maint-link-btn').style.display = 'inline-block';
                    }
                    overlay.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                } else {
                    overlay.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            } else {
                if (overlay) {
                    overlay.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            }
        }
    });
}
async function checkDriverUpdates() {
    try {
        const docSnap = await getDoc(doc(db, "app_settings", "updates"));
        if (docSnap.exists()) {
            const data = docSnap.data().driver; // نأخذ إعدادات المندوب
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
                    const skippedVersion = localStorage.getItem('driver_skipped_update');
                    if (skippedVersion !== data.new_version) {
                        const oToast = document.getElementById('optional-update-toast');
                        if (oToast) {
                            oToast.style.display = 'flex';
                            document.getElementById('o-upd-title').innerText = title;
                            document.getElementById('o-upd-link').href = link;

                            document.getElementById('o-upd-skip').addEventListener('click', () => {
                                oToast.style.display = 'none';
                                localStorage.setItem('driver_skipped_update', data.new_version);
                            });
                        }
                    }
                    localStorage.setItem('driver_optional_update', JSON.stringify(data));
                }
            } else {
                localStorage.removeItem('driver_optional_update');
            }
        }
    } catch (e) { console.error("خطأ في فحص التحديثات:", e); }
}
checkDriverUpdates();
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: إدارة الجلسات ومصفوفة الصلاحيات RBAC]
// 1. التحقق من المصادقة، التأكد من أن الدور 'driver'، وجلب المناطق والمحفظة.
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: إدارة الجلسات ومصفوفة الصلاحيات RBAC]
// 1. التحقق من المصادقة، التأكد من الدور، فحص الصيانة، وجلب المحفظة.
// ----------------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));

        // 🚀 السماح للمندوب والمدير بالدخول
        if (userDoc.exists() && (userDoc.data().role === 'driver' || userDoc.data().role === 'admin')) {

            // 🟢 فحص وضع الصيانة فوراً (باستخدام رقم هاتف المستخدم)
            checkMaintenance(userDoc.data().phone || "");

            // 🟢 رفع الدرع وإظهار الصفحة فوراً
            document.body.style.display = 'block';

            currentDriver = { uid: user.uid, ...userDoc.data() };
            // تشغيل محرك تسجيل الإشعارات الخارجي وجلب التوكن
            registerDeviceToken(user.uid);
            // تشغيل الاستماع الأمامي
            listenToForegroundMessages();
            currentDriverEmail = user.email;
            document.getElementById('driver-name').innerText = currentDriver.name;

            // تعبئة شاشة حسابي
            document.getElementById('account-driver-name').innerText = currentDriver.name;
            document.getElementById('account-driver-phone').innerText = currentDriver.phone || "رقم غير مسجل";

            // 🧠 جلب مناطق المندوب
            const driverZones = currentDriver.zones || currentDriver.assigned_zones;
            const zonesElement = document.getElementById('assigned-zones');
            if (driverZones && driverZones.length > 0) {
                zonesElement.innerText = "جاري تحميل أسماء المناطق...";
                try {
                    const qZones = query(collection(db, "zones"), where("is_active", "==", true));
                    const zonesSnap = await getDocs(qZones);
                    const zonesDict = {};
                    zonesSnap.forEach(zDoc => { zonesDict[zDoc.id] = zDoc.data().name; });

                    const translatedNames = driverZones.map(id => zonesDict[id] || 'منطقة غير معروفة').join(' - ');
                    zonesElement.innerText = `مناطقك: ${translatedNames}`;
                } catch (error) {
                    zonesElement.innerText = "مناطقك: (خطأ في التحميل)";
                }
            } else {
                zonesElement.innerText = "مناطقك: لم يتم التعيين بعد";
            }

            const walletAmountEl = document.getElementById('driver-wallet-amount');
            if (walletAmountEl) {
                walletAmountEl.innerHTML = `${(currentDriver.wallet_balance || 0).toLocaleString()} <span style="font-size: 16px;">د.ع</span>`;
            }

            // تشغيل المحركات الأساسية
            listenToOrders();
            startDriverNotificationRadar();
            startGPSTracking();
        } else {
            // 🚫 مسجل بحساب تاجر أو عميل، اطرده لصفحة دخول المندوب
            window.location.href = 'login.html';
        }
    } else {
        // 🚫 غير مسجل نهائياً
        checkMaintenance(""); // التحقق من الصيانة للزوار
        window.location.href = 'login.html';
    }
});
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني والرابع: التوزيع الجغرافي الصارم للطلبات]
// 2. الاستماع للطلبات (Real-time) المطابقة لمناطق المندوب فقط.
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني والرابع: التوزيع الجغرافي الصارم ودورة الحياة الميدانية]
// محرك جلب الطلبات الميدانية (المحدث ليشمل تنبيهات طلبات الإدارة الهاتفية)
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني والرابع: التوزيع الجغرافي الصارم ودورة الحياة الميدانية]
// محرك جلب الطلبات الميدانية (المطور: يشمل فصل الطلبات النشطة عن المكتملة)
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني والرابع: التوزيع الجغرافي الصارم ودورة الحياة الميدانية]
// محرك جلب الطلبات الميدانية (المطور: يشمل فصل الطلبات النشطة عن المكتملة)
// ----------------------------------------------------------------------------
function listenToOrders() {
    // 🧠 استخدام المتغير الذي يدعم الحسابات القديمة والجديدة
    const activeZones = currentDriver.zones || currentDriver.assigned_zones;

    if (!activeZones || activeZones.length === 0) {
        document.getElementById('available-list').innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #ef4444;">
                <i class="fas fa-exclamation-circle" style="font-size: 50px; margin-bottom: 15px; opacity: 0.8;"></i>
                <h3 style="font-family: 'Cairo', sans-serif;">غير مصرح لك بالعمل</h3>
                <p style="font-size: 14px;">لم يتم إسناد أي مناطق لك من قبل الإدارة بعد.</p>
            </div>`;
        return;
    }

    // بناء استعلام يجلب الطلبات التي تقع ضمن مناطق المندوب المحددة
    const q = query(collection(db, "orders"), where("zone_id", "in", activeZones));

    onSnapshot(q, (snapshot) => {
        window.loadedDriverOrders = {}; // ذاكرة حفظ الطلبات للمندوب
        const availableList = document.getElementById('available-list');
        const activeDetails = document.getElementById('active-order-details');

        let availableHtml = '';
        let activeHtml = '';
        let completedHtml = ''; // التعديل هنا: تم تعريفه مرة واحدة فقط
        let deliveredOrders = [];

        snapshot.forEach(docSnap => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            window.loadedDriverOrders[orderId] = { id: orderId, ...order }; // الحفظ في الذاكرة

            // محرك التنبيه الإلزامي لطلبات الإدارة
            const isAdminOrder = order.is_admin_guest === true;
            const adminAlertHtml = isAdminOrder ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; color: #ef4444; padding: 12px; border-radius: 10px; margin-bottom: 15px; text-align: center; font-weight: 700;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 18px; margin-bottom: 5px;"></i> 
                    <br> هذا الطلب مسجل من الإدارة
                    <br> <span style="font-size: 12px; color: #b91c1c;">يجب الاتصال بالعميل لتأكيد السعر قبل التحرك!</span>
                    <a href="tel:${order.guest_phone}" style="display: block; margin-top: 10px; background: #ef4444; color: white; padding: 8px 15px; border-radius: 12px; text-decoration: none; font-size: 14px;">
                        <i class="fas fa-phone"></i> اتصل بالعميل الآن
                    </a>
                </div>
            ` : '';

            // --- أ. طلبات جديدة غير مستلمة (متاحة للالتقاط) ---
            if (order.status === 'ASSIGNED' && !order.driver_id) {
                availableHtml += `
                    <div class="order-card order-card-clickable" data-id="${orderId}" style="cursor: pointer;">
                        ${adminAlertHtml}
                        <h3>طلب جديد 📦</h3>
                        <p><strong>التفاصيل:</strong> ${order.order_details}</p>
                        <div class="address-box">📍 ${order.column_id ? 'العمود: ' + order.column_id : 'موقع GPS'}</div>
                        <p style="margin-bottom: 5px; font-weight: 800; color: #1e293b; font-size: 15px;">💰 التحصيل الكلي: ${order.total_price} د.ع</p>
                        <button class="action-btn btn-accept" onclick="acceptOrder('${orderId}')">قـبـول الـطـلـب</button>
                    </div>
                `;
            }

            // --- ب. طلبات المندوب (النشطة والمكتملة) ---
            if (order.driver_id === currentDriver.uid) {

                // 1. الطلبات النشطة
                if (order.status === 'ASSIGNED' || order.status === 'IN_TRANSIT') {
                    let actionButtonHtml = '';

                    // حالة التواجد عند التاجر (الطلب مقفل)
                    if (order.status === 'ASSIGNED') {
                        actionButtonHtml = `
                            <div style="background:#fef9c3; color:#a16207; padding:12px; border-radius:10px; margin-bottom:12px; font-size:13px; text-align:center; font-weight:800; border: 1px dashed #eab308;">
                                🔒 الطلب مقفل. ادفع مبلغ (${order.merchant_price || order.total_price} د.ع) للتاجر، واطلب منه تأكيد الاستلام من تطبيقه.
                            </div>
                            <button class="action-btn" onclick="alertMerchant('${orderId}')" style="background:#f59e0b; margin-bottom:10px; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.2);">
                                🔔 إرسال تنبيه للتاجر لتأكيد الاستلام
                            </button>
                        `;
                    }
                    // حالة الانطلاق للعميل
                    else if (order.status === 'IN_TRANSIT') {
                        actionButtonHtml = `
                            <button class="action-btn btn-deliver" onclick="updateStatus('${orderId}', 'DELIVERED', '${order.customer_id}', ${order.total_price || 0})">
                                ✅ تـم الـتـسـلـيـم واستلام (${order.total_price || 0} د.ع)
                            </button>`;
                    }

                    const emergencyButtonHtml = `
                        <button class="action-btn" onclick="openTransferModal('${orderId}', '${order.zone_id}')" style="background:#ef4444; margin-top:10px; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);">
                            🚨 طوارئ: تحويل الطلب لزميل
                        </button>
                    `;

                    const merchantNoteHtml = order.merchant_note && order.merchant_note !== 'لا توجد ملاحظات' ?
                        `<div style="background:#f0fdf4; color:#166534; padding:10px; border-radius:8px; font-size:13px; margin-bottom:12px; border:1px solid #bbf7d0;"><strong>ملاحظة التاجر:</strong> ${order.merchant_note}</div>` : '';

                    activeHtml += `
                       <div class="order-card order-card-clickable" data-id="${orderId}" style="border-right-color: #3b82f6; cursor: pointer;">
                            <h3>مهمة قيد التنفيذ 🚚</h3>
                            ${merchantNoteHtml}
                            <p><strong>المحتوى:</strong> ${order.order_details}</p>
                            <div class="address-box">🏠 العنوان: ${order.address_note}</div>
                            <p style="margin-bottom: 12px; font-weight: 800; color: #1e293b; font-size: 16px;">💵 المطلوب من العميل: ${order.total_price} د.ع</p>
                            ${actionButtonHtml}
                            ${emergencyButtonHtml}
                        </div>
                    `;
                }
                // 2. الطلبات المكتملة (تم التسليم)
                else if (order.status === 'DELIVERED') {
                    deliveredOrders.push({ id: orderId, ...order });
                }
            }
        });

        // --- تحديث واجهة الطلبات المتاحة (رسالة فارغة إن لم يوجد) ---
        if (availableHtml === '') {
            availableList.innerHTML = `
                <div style="text-align: center; padding: 50px 20px; color: #94a3b8;">
                    <i class="fas fa-box-open" style="font-size: 60px; margin-bottom: 15px; opacity: 0.4;"></i>
                    <h3 style="font-family: 'Cairo', sans-serif;">لا توجد طلبات جديدة</h3>
                    <p style="font-size: 14px; margin-top: 5px;">أنتظر قليلاً، سيظهر هنا أي طلب جديد في منطقتك.</p>
                </div>`;
        } else {
            availableList.innerHTML = availableHtml;
        }

        // --- تحديث واجهة المهام (رسالة فارغة إن لم يوجد مهام نشطة) ---
        if (activeHtml === '') {
            activeHtml = `
                <div style="text-align: center; padding: 50px 20px; color: #94a3b8;">
                    <i class="fas fa-motorcycle" style="font-size: 60px; margin-bottom: 15px; opacity: 0.4;"></i>
                    <h3 style="font-family: 'Cairo', sans-serif;">لا توجد مهام نشطة</h3>
                    <p style="font-size: 14px; margin-top: 5px;">التقط طلباً من قسم "متاح" لتبدأ العمل وتحصد الأرباح.</p>
                </div>`;
        }

        // --- إضافة الطلبات المكتملة إلى أسفل شاشة المهام ---
        // ترتيب الطلبات من الأحدث للأقدم وعرض آخر 5 فقط
        deliveredOrders.sort((a, b) => b.created_at?.toMillis() - a.created_at?.toMillis());
        completedHtml = ''; // التعديل هنا: إزالة كلمة let ليتم استخدام المتغير المعرف مسبقاً

        deliveredOrders.slice(0, 5).forEach(order => {
            completedHtml += `
                <div class="order-card order-card-clickable" data-id="${order.id}" style="border-right-color: #10b981; opacity: 0.8; background: #f8fafc; padding: 15px; cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h3 style="color: #10b981; margin: 0; font-size: 15px;"><i class="fas fa-check-circle"></i> تم التسليم</h3>
                        <span style="font-size: 12px; color: #94a3b8; font-family: monospace;">#${order.id.slice(-5).toUpperCase()}</span>
                    </div>
                    <p style="margin-bottom: 6px; font-size: 13px;">${order.order_details}</p>
                    <p style="margin: 0; font-weight: 800; color: #334155; font-size: 14px;">💰 تم تحصيل: ${order.total_price} د.ع</p>
                </div>
            `;
        });

        if (completedHtml !== '') {
            activeHtml += `
                <h4 style="margin: 30px 0 15px 0; color: #64748b; font-size: 15px; text-align: center; display: flex; align-items: center; gap: 10px;">
                    <span style="flex: 1; height: 1px; background: #cbd5e1;"></span>
                    <i class="fas fa-history"></i> أحدث الطلبات المكتملة
                    <span style="flex: 1; height: 1px; background: #cbd5e1;"></span>
                </h4>
                ${completedHtml}
            `;
        }

        // عرض النتيجة النهائية في الشاشة
        activeDetails.innerHTML = activeHtml;
    });
}
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الرابع: سيناريو الطوارئ - المرحلة 5]
// --- محرك الطوارئ (Transfer Engine) ---
// يسمح للمندوب بتمرير الطلب لزميل في نفس المنطقة في حال تعطل دراجته.
// ----------------------------------------------------------------------------

// 1. فتح النافذة وجلب الزملاء المتاحين
window.openTransferModal = async (orderId, zoneId) => {
    currentEmergencyOrderId = orderId;
    currentOrderZone = zoneId;

    document.getElementById('transfer-modal').style.display = 'flex';
    const selectBox = document.getElementById('available-drivers-select');
    selectBox.innerHTML = '<option value="">جاري البحث عن زملاء...</option>';

    try {
        // البحث عن المناديب (النشطين) الذين يملكون (نفس المنطقة) في مصفوفة مناطقهم
        const qDrivers = query(
            collection(db, "users"),
            where("role", "==", "driver"),
            where("is_active", "==", true),
            where("assigned_zones", "array-contains", zoneId)
        );

        const snapshot = await getDocs(qDrivers);
        selectBox.innerHTML = '<option value="">-- اختر المندوب البديل --</option>';

        let found = false;
        snapshot.forEach(docSnap => {
            // حماية: لا تظهر المندوب الحالي لنفسه في القائمة
            if (docSnap.id !== currentDriver.uid) {
                found = true;
                selectBox.innerHTML += `<option value="${docSnap.id}">${docSnap.data().name}</option>`;
            }
        });

        if (!found) {
            selectBox.innerHTML = '<option value="">(لا يوجد مناديب متاحين في هذه المنطقة حالياً)</option>';
        }
    } catch (error) {
        console.error("خطأ في جلب الزملاء:", error);
        selectBox.innerHTML = '<option value="">حدث خطأ في البحث</option>';
    }
};

// إغلاق النافذة
document.getElementById('close-transfer-modal').addEventListener('click', () => {
    document.getElementById('transfer-modal').style.display = 'none';
});


// 🚀 برمجة زر تسجيل الخروج من شاشة حسابي
document.getElementById('account-logout-btn')?.addEventListener('click', async () => {
    if (confirm("هل أنت متأكد أنك تريد تسجيل الخروج وإنهاء ورديتك؟")) {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("خطأ أثناء الخروج:", error);
        }
    }
});

// 2. تأكيد تحويل الطلب
document.getElementById('confirm-transfer-btn').addEventListener('click', async () => {
    const newDriverId = document.getElementById('available-drivers-select').value;
    const selectText = document.getElementById('available-drivers-select').options[document.getElementById('available-drivers-select').selectedIndex].text;

    if (!newDriverId) {
        alert("يجب اختيار مندوب بديل أولاً لتمرير الطلب إليه!");
        return;
    }

    if (confirm(`هل أنت متأكد من تحويل العهدة والطلب إلى [${selectText}]؟`)) {
        const btn = document.getElementById('confirm-transfer-btn');
        btn.disabled = true; btn.innerText = "جاري التحويل...";

        try {
            // أ. تحديث الطلب وإسناده للمندوب الجديد (وإعادته لحالة ASSIGNED ليبدأ الدورة من جديد مع الزميل)
            await updateDoc(doc(db, "orders", currentEmergencyOrderId), {
                driver_id: newDriverId,
                status: 'ASSIGNED'
            });

            // ب. [تطبيقاً للسجل الجنائي]: توثيق العملية في السجل للإدارة للمراقبة لاحقاً
            await addDoc(collection(db, `orders/${currentEmergencyOrderId}/order_logs`), {
                timestamp: serverTimestamp(),
                action_type: 'EMERGENCY_TRANSFER',
                description: `🚨 طوارئ: تم تحويل الطلب من (${currentDriver.name}) إلى (${selectText}).`,
                action_by: currentDriver.name
            });

            alert(`تم تحويل الطلب وإخلاء عهدتك بنجاح! سيظهر الطلب الآن لدى الزميل ${selectText}.`);
            document.getElementById('transfer-modal').style.display = 'none';

        } catch (error) {
            console.error("خطأ في التحويل:", error);
            alert("حدث خطأ أثناء تحويل الطلب.");
        } finally {
            btn.disabled = false; btn.innerText = "تأكيد التحويل وإخلاء العهدة";
        }
    }
});


// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الرابع: دورة حياة الطلب والسجل الجنائي]
// --- دوال العمليات الأساسية الميدانية ---
// ----------------------------------------------------------------------------

// 1. قبول الطلب (التقاطه من السوق)
window.acceptOrder = async (id) => {
    // إسناد المندوب للطلب
    await updateDoc(doc(db, "orders", id), {
        driver_id: currentDriver.uid,
        status: 'ASSIGNED'
    });
    // تسجيل الحدث في الصندوق الأسود (السجل الجنائي)
    await addDoc(collection(db, `orders/${id}/order_logs`), {
        timestamp: serverTimestamp(),
        action_type: 'ASSIGNED',
        description: `تم قبول الطلب من قبل المندوب: ${currentDriver.name}`,
        action_by: currentDriver.name
    });
    alert("تم قبول الطلب! توجه للتاجر.");
};

// 2. تحديث الحالات وتطبيق (الضربة القاضية) المالية
window.updateStatus = async (orderId, newStatus, customerId, totalPrice = 0) => {
    try {
        if (newStatus === 'DELIVERED') {
            await updateDoc(doc(db, "orders", orderId), { status: newStatus });

            await addDoc(collection(db, `orders/${orderId}/order_logs`), {
                timestamp: serverTimestamp(), action_type: newStatus,
                description: `تم التسليم للعميل بنجاح بواسطة: ${currentDriver.name}`, action_by: currentDriver.name
            });

            // ------------------------------------------------------------------------
            // 💰 [تطبيقاً للجزء السادس: الضربة القاضية للمحفظة - Driver Wallet]
            // عند التسليم، يعتبر النظام أن المندوب استلم "كاش"، فيتم تقييد المبلغ الكلي بالسالب كدين عليه للمكتب
            // ------------------------------------------------------------------------
            await setDoc(doc(db, "users", currentDriver.uid), {
                wallet_balance: increment(-totalPrice)
            }, { merge: true });

            // [تطبيقاً للجزء السادس: دفتر الأستاذ الرقمي Transactions]
            // تسجيل الإيصال المالي لتسهيل المراجعة عند تصفية الحساب في الداشبورد
            await addDoc(collection(db, "transactions"), {
                transaction_id: `COD-${Math.floor(Math.random() * 100000)}`,
                user_uid: currentDriver.uid,
                amount: -totalPrice,
                type: "تحصيل نقدي من العميل (مطلوب للمكتب)",
                related_order_id: orderId,
                created_at: serverTimestamp()
            });

            // [تطبيقاً للجزء السادس: إضافة نقاط ولاء للعميل المسجل تلقائياً]
            if (customerId && customerId !== 'undefined' && customerId !== 'null') {
                const LOYALTY_POINTS = 15;
                await setDoc(doc(db, "users", customerId), { loyalty_points: increment(LOYALTY_POINTS) }, { merge: true });
            }
            alert("تم تسليم الطلب! المبلغ الآن مسجل كعهدة في ذمتك لصالح المكتب.");

        } else {
            // تحديث الحالات العادية وتسجيلها في السجل
            await updateDoc(doc(db, "orders", orderId), { status: newStatus });
            await addDoc(collection(db, `orders/${orderId}/order_logs`), {
                timestamp: serverTimestamp(), action_type: newStatus,
                description: `تغيرت الحالة إلى ${newStatus}`, action_by: currentDriver.name
            });
        }
    } catch (error) {
        console.error("❌ توقف النظام بسبب خطأ:", error);
        alert("حدث خطأ يمنع إكمال العملية!");
    }
};

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثالث: القفل المالي للتاجر]
// دالة إرسال تنبيه ينعكس كلون أحمر نابض في شاشة التاجر لطلب تحرير الطلب
// ----------------------------------------------------------------------------
window.alertMerchant = async (orderId) => {
    try {
        await updateDoc(doc(db, "orders", orderId), { merchant_alerted: true });
        alert("تم إرسال تنبيه لمتجر التاجر 🔔! يرجى إخباره شفهياً أيضاً.");
    } catch (e) {
        console.error("خطأ:", e);
    }
};

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثامن: شاشة القيادة المركزية - Live Map Tracking]
// بث إحداثيات المندوب لقاعدة البيانات لكي يظهر كدبوس متحرك في خريطة الإدارة
// ----------------------------------------------------------------------------
function startGPSTracking() {
    if ("geolocation" in navigator) {
        // تحديث الموقع الجغرافي بشكل مستمر للمندوب طالما التطبيق مفتوح
        navigator.geolocation.watchPosition(async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            try {
                // حفظ الإحداثيات في مسار المستخدم بـ Firestore
                await setDoc(doc(db, "users", currentDriver.uid), { current_location: { lat: lat, lng: lng } }, { merge: true });
            } catch (error) { }
        }, (error) => { }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    }
}

// ============================================================================
// --- شاشة تفاصيل الطلب بكامل الشاشة للمندوب (Full Screen Details Engine) ---
// ============================================================================
const driverOrderDetailsModal = document.getElementById('driver-order-details-modal');
const closeDriverOrderDetailsBtn = document.getElementById('close-driver-order-details');
let driverOpenedOrderId = null;

// إغلاق الشاشة
if (closeDriverOrderDetailsBtn) {
    closeDriverOrderDetailsBtn.addEventListener('click', () => {
        driverOrderDetailsModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // إعادة التمرير للشاشة الأصلية
    });
}

// نظام التبويبات (Tabs Logic)
document.querySelectorAll('.d-order-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.d-order-tab-btn').forEach(b => {
            b.classList.remove('active'); b.style.color = '#64748b'; b.style.borderBottomColor = 'transparent';
        });
        e.target.classList.add('active'); e.target.style.color = '#3b82f6'; e.target.style.borderBottomColor = '#3b82f6';

        document.querySelectorAll('.d-order-tab-content').forEach(content => content.style.display = 'none');
        const targetTab = e.target.getAttribute('data-tab');
        document.getElementById(targetTab).style.display = 'block';

        if (targetTab === 'd-tab-logs' && driverOpenedOrderId) {
            fetchDriverOrderLogs(driverOpenedOrderId);
        }
    });
});

// التقاط الضغطة على البطاقة
document.body.addEventListener('click', async (e) => {
    // 🛡️ حماية صارمة: منع فتح الشاشة إذا ضغط المندوب على أي زر (قبول، تسليم، اتصال، تحويل)
    if (e.target.closest('button') || e.target.closest('a')) return;

    const card = e.target.closest('.order-card-clickable');
    if (card) {
        const orderId = card.getAttribute('data-id');
        const order = window.loadedDriverOrders[orderId];
        if (order) await openDriverOrderDetails(order);
    }
});

// دالة تعبئة بيانات الشاشة الكاملة
async function openDriverOrderDetails(order) {
    driverOpenedOrderId = order.id;
    document.querySelector('[data-tab="d-tab-details"]').click();

    // إيقاف التمرير في الخلفية
    document.body.style.overflow = 'hidden';

    // 1. البيانات الأساسية والعنوان
    document.getElementById('modal-d-customer-fat').innerText = order.column_id || "موقع GPS / لا يوجد";
    document.getElementById('modal-d-customer-note').innerText = order.address_note || "بدون ملاحظات إضافية";

    // 2. المالية
    document.getElementById('modal-d-price-merchant').innerText = (order.merchant_price || 0) + ' د.ع';
    document.getElementById('modal-d-price-delivery').innerText = (order.delivery_fee || 0) + ' د.ع';
    document.getElementById('modal-d-price-total').innerText = (order.total_price || 0) + ' د.ع';

    // 3. 🧠 الذكاء: جلب التاجر والعميل وتجهيز أزرار الاتصال
    const merchantNameEl = document.getElementById('modal-d-merchant-name');
    const callMerchantBtn = document.getElementById('btn-call-merchant');
    merchantNameEl.innerText = "جاري التحميل...";
    callMerchantBtn.href = "#";

    if (order.merchant_id) {
        try {
            const mDoc = await getDoc(doc(db, "users", order.merchant_id));
            if (mDoc.exists()) {
                merchantNameEl.innerText = mDoc.data().store_name || mDoc.data().name || "متجر";
                callMerchantBtn.href = `tel:${mDoc.data().phone}`;
            }
        } catch (e) { merchantNameEl.innerText = "خطأ بالتحميل"; }
    }

    const customerNameEl = document.getElementById('modal-d-customer-name');
    const callCustomerBtn = document.getElementById('btn-call-customer');
    customerNameEl.innerText = "جاري التحميل...";
    callCustomerBtn.href = "#";

    if (order.is_admin_guest || order.customer_id === null) {
        // طلب ضيف من الإدارة أو التاجر
        customerNameEl.innerText = `${order.guest_name || 'عميل'} (طلب هاتف)`;
        callCustomerBtn.href = `tel:${order.guest_phone}`;
    } else if (order.customer_id) {
        // طلب من تطبيق العميل
        try {
            const cDoc = await getDoc(doc(db, "users", order.customer_id));
            if (cDoc.exists()) {
                customerNameEl.innerText = cDoc.data().name || "عميل تطبيق";
                callCustomerBtn.href = `tel:${cDoc.data().phone}`;
            }
        } catch (e) { customerNameEl.innerText = "خطأ بالتحميل"; }
    }

    driverOrderDetailsModal.style.display = 'block';
}

// دالة جلب السجل الزمني للمندوب
async function fetchDriverOrderLogs(orderId) {
    const content = document.getElementById('audit-log-content-driver');
    try {
        const qLogs = query(collection(db, `orders/${orderId}/order_logs`), orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(qLogs);

        if (querySnapshot.empty) {
            content.innerHTML = `<p style="text-align:center; padding:20px; color: gray;">لا يوجد سجل حركات.</p>`;
            return;
        }

        let timelineHtml = '<div style="position: relative; padding-right: 20px; border-right: 2px solid #cbd5e1; margin-top: 10px;">';

        querySnapshot.forEach((docSnap) => {
            const log = docSnap.data();
            const timeStr = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

            let dotColor = '#94a3b8';
            if (log.action_type === 'ASSIGNED') dotColor = '#3b82f6';
            if (log.action_type === 'MERCHANT_PAID' || log.action_type === 'DELIVERED') dotColor = '#10b981';
            if (log.action_type.includes('CANCEL')) dotColor = '#ef4444';

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
        content.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ.</p>';
    }
}

// ============================================================================
// --- رادار الإشعارات الذكي للمندوب (Driver Notification Radar) ---
// ============================================================================
let localReadNotifications = JSON.parse(localStorage.getItem('driver_read_notifs')) || [];
let toastedNotifs = new Set();
let globalNotifIds = [];

// إغلاق أي صفحة إشعارات (شاشة القائمة أو الشاشة الغنية)
document.querySelectorAll('.close-page-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).style.display = 'none';
    });
});

// فتح الإشعارات من الجرس في الأعلى
const navBellBtn = document.getElementById('nav-bell-btn');
if (navBellBtn) {
    navBellBtn.addEventListener('click', () => {
        document.getElementById('page-notifications').style.display = 'block';
        document.getElementById('unread-badge').style.display = 'none';

        globalNotifIds.forEach(id => {
            if (!localReadNotifications.includes(id)) {
                localReadNotifications.push(id);
            }
        });
        localStorage.setItem('driver_read_notifs', JSON.stringify(localReadNotifications));

        document.querySelectorAll('.notif-card').forEach(card => {
            card.style.background = 'white';
            card.style.borderRight = 'none';
        });
    });
}

function startDriverNotificationRadar() {
    // بناء النافذة المنزلقة (Toast) العلوية
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; top: -100px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; padding: 15px 25px; border-radius: 30px; box-shadow: 0 10px 30px rgba(59,130,246,0.4); z-index: 9999; display: flex; align-items: center; gap: 15px; transition: top 0.4s; direction: rtl; width: 90%; max-width: 400px;';
    toast.innerHTML = `<i class="fas fa-bell" style="font-size: 20px;"></i> <div><h4 id="d-toast-title" style="margin:0; font-size:15px;"></h4><p id="d-toast-body" style="margin:3px 0 0 0; font-size:13px; opacity:0.9;"></p></div>`;
    document.body.appendChild(toast);

    const qNotifs = query(collection(db, "notifications"), orderBy("created_at", "desc"), limit(30));
    let isFirstLoad = true;

    onSnapshot(qNotifs, (snapshot) => {
        const list = document.getElementById('notifications-list');
        const badge = document.getElementById('unread-badge');
        if (!list) return;

        list.innerHTML = '';
        let unreadCount = 0;
        globalNotifIds = [];

        snapshot.forEach(docSnap => {
            const notif = docSnap.data();
            const notifId = docSnap.id;

            // هل الإشعار للمندوب؟ (للجميع، أو فئة المناديب، أو المندوب نفسه تحديداً)
            const isForMe = (notif.target_type === 'all') ||
                (notif.target_type === 'drivers') ||
                (notif.target_type === 'specific' && notif.target_uid === currentDriver.uid);

            if (!isForMe) return;

            globalNotifIds.push(notifId);
            const isRead = localReadNotifications.includes(notifId);

            if (!isRead) unreadCount++;

            // الإشعار الصوتي والمنزلق
            if (!isFirstLoad && !isRead && !toastedNotifs.has(notifId)) {
                // إظهار النافذة المنزلقة الزرقاء               
                // 1. تحديد صفحة التوجيه (Deep Link URL)
                // افتراضياً: التوجيه لصفحة الإشعارات العامة
                let targetUrl = 'https://muif.github.io/FastDelivery/tset/index.html';

                // إذا كان الإشعار يخص طلباً معيناً (يحتوي على orderId مثلاً)
                if (notif.orderId || notif.action === 'view_order') {
                    targetUrl = 'https://muif.github.io/FastDelivery/tset/index.html' + notif.orderId;
                }

                // 2. الجسر السحري (الآن نرسل له 3 أشياء: العنوان، النص، والرابط!)
                if (window.NativeBridge) {
                    window.NativeBridge.pushNotif(
                        notif.title || 'تنبيه جديد',
                        notif.body || notif.message || '',
                        targetUrl // 👈 هذا هو الرابط الذي سيختبئ داخل الإشعار
                    );
                } else {
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                }
            }

            // رسم بطاقة الإشعار
            const bg = isRead ? 'background: white;' : 'background: #f0f8ff; border-right: 4px solid #3b82f6;';
            const dateStr = notif.created_at ? notif.created_at.toDate().toLocaleString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'الآن';

            const card = document.createElement('div');
            card.className = 'notif-card';
            card.style.cssText = `padding: 15px; margin-bottom: 12px; border-radius: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.02); border: 1px solid #e2e8f0; cursor: pointer; transition: 0.3s; display: flex; gap: 15px; align-items: flex-start; ${bg}`;

            const iconColor = isRead ? 'gray' : '#3b82f6';
            const notifTitle = notif.title || 'إشعار إداري';
            const notifBody = notif.body || notif.message || '';

            card.innerHTML = `
                <div style="background: white; padding: 12px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); color: ${iconColor};">
                    <i class="fas fa-bell" style="font-size: 18px;"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 14px; font-weight: bold; color: #1e293b;">${notifTitle}</div>
                    <div style="font-size: 13px; color: #475569; margin-top: 5px; line-height: 1.5;">${notifBody}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 8px; text-align: left; direction: ltr;">${dateStr}</div>
                </div>
            `;

            // هندسة التفاعل (التوجيه العميق)
            card.addEventListener('click', () => {
                card.style.background = 'white'; card.style.borderRight = 'none';
                if (!localReadNotifications.includes(notifId)) {
                    localReadNotifications.push(notifId);
                    localStorage.setItem('driver_read_notifs', JSON.stringify(localReadNotifications));
                }

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
                else if (notif.action_type === 'order_link' || notif.order_id) {
                    const targetId = notif.action_value || notif.order_id;
                    document.getElementById('page-notifications').style.display = 'none'; // إغلاق الإشعارات للقفز للطلب
                    setTimeout(() => {
                        const orderCard = document.querySelector(`[data-id="${targetId}"]`);
                        if (orderCard) {
                            orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            orderCard.style.border = '2px solid #3b82f6';
                            orderCard.style.transform = 'scale(1.02)';
                            setTimeout(() => { orderCard.style.border = '1px solid #e2e8f0'; orderCard.style.transform = 'scale(1)'; }, 3000);
                        } else {
                            alert("الطلب غير موجود في قائمتك الحالية.");
                        }
                    }, 500);
                }
            });

            list.appendChild(card);
        });

        if (list.innerHTML === '') {
            list.innerHTML = '<p style="text-align: center; color: gray; margin-top: 50px;"><i class="fas fa-bell-slash" style="font-size: 40px; opacity: 0.3; margin-bottom: 15px; display: block;"></i> لا توجد إشعارات حالياً.</p>';
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
// --- إعدادات المندوب والأمان (Settings & Security) ---
// ============================================================================

// إغلاق النوافذ المنبثقة
document.querySelectorAll('.d-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('active');
    });
});

// فتح نافذة التعديل وتعبئتها
document.getElementById('btn-d-edit-profile')?.addEventListener('click', () => {
    document.getElementById('d-edit-name-input').value = document.getElementById('account-driver-name').innerText;
    document.getElementById('d-edit-phone-input').value = document.getElementById('account-driver-phone').innerText;
    document.getElementById('d-modal-edit-profile').classList.add('active');
});

// حفظ البيانات الشخصية
document.getElementById('d-save-profile-btn')?.addEventListener('click', async (e) => {
    const newName = document.getElementById('d-edit-name-input').value.trim();
    const newPhone = document.getElementById('d-edit-phone-input').value.trim();

    if (!newName || !newPhone) { alert("يرجى تعبئة جميع الحقول!"); return; }
    // 🛡️ القفل الأمني الصارم لرقم هاتف المندوب
    if (!newPhone.startsWith('07') || newPhone.length !== 11) {
        alert("🚨 رقم الهاتف غير صالح! يجب أن يتكون من 11 رقماً ويبدأ بـ 07 (مثال: 07800000000)");
        return;
    }
    try {
        e.target.disabled = true; e.target.innerText = "جاري الحفظ...";

        await updateDoc(doc(db, "users", currentDriver.uid), {
            name: newName,
            phone: newPhone
        });

        document.getElementById('driver-name').innerText = newName; // هيدر
        document.getElementById('account-driver-name').innerText = newName; // حسابي
        document.getElementById('account-driver-phone').innerText = newPhone;

        alert("تم تحديث بياناتك بنجاح! ✅");
        document.getElementById('d-modal-edit-profile').classList.remove('active');
    } catch (error) {
        console.error("خطأ:", error); alert("حدث خطأ أثناء التحديث.");
    } finally {
        e.target.disabled = false; e.target.innerText = "حفظ التعديلات";
    }
});

// فتح نافذة تغيير الباسورد
document.getElementById('btn-d-change-password')?.addEventListener('click', () => {
    document.getElementById('d-current-pwd-input').value = '';
    document.getElementById('d-new-pwd-input').value = '';
    document.getElementById('d-pwd-error-msg').style.display = 'none';
    document.getElementById('d-modal-change-password').classList.add('active');
});

// المحرك الأمني لتحديث كلمة المرور
document.getElementById('d-save-pwd-btn')?.addEventListener('click', async (e) => {
    const currentPwd = document.getElementById('d-current-pwd-input').value;
    const newPwd = document.getElementById('d-new-pwd-input').value;
    const errorMsg = document.getElementById('d-pwd-error-msg');

    if (!currentPwd || !newPwd) { errorMsg.innerText = "يرجى إدخال كلمة المرور القديمة والجديدة!"; errorMsg.style.display = 'block'; return; }
    if (newPwd.length < 6) { errorMsg.innerText = "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل!"; errorMsg.style.display = 'block'; return; }

    try {
        e.target.disabled = true; e.target.innerText = "جاري التحقق...";
        errorMsg.style.display = 'none';

        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(currentDriverEmail, currentPwd);

        await reauthenticateWithCredential(user, credential);
        e.target.innerText = "جاري التحديث...";
        await updatePassword(user, newPwd);

        alert("تم تغيير كلمة المرور بنجاح! 🔒");
        document.getElementById('d-modal-change-password').classList.remove('active');
    } catch (error) {
        console.error(error);
        errorMsg.style.display = 'block';
        if (error.code === 'auth/invalid-credential') { errorMsg.innerText = "❌ كلمة المرور الحالية غير صحيحة!"; }
        else { errorMsg.innerText = "حدث خطأ غير متوقع، حاول مجدداً."; }
    } finally {
        e.target.disabled = false; e.target.innerText = "تحديث كلمة المرور";
    }
});

// فتح نافذة الحذف
document.getElementById('btn-d-delete-account')?.addEventListener('click', () => {
    document.getElementById('d-delete-pwd-input').value = '';
    document.getElementById('d-delete-error-msg').style.display = 'none';
    document.getElementById('d-modal-delete-account').classList.add('active');
});

// تأكيد الحذف
document.getElementById('d-confirm-delete-btn')?.addEventListener('click', async (e) => {
    const pwd = document.getElementById('d-delete-pwd-input').value;
    const errorMsg = document.getElementById('d-delete-error-msg');

    if (!pwd) { errorMsg.innerText = "يجب إدخال كلمة المرور لتأكيد الحذف!"; errorMsg.style.display = 'block'; return; }
    if (!confirm("🚨 هل أنت متأكد من مسح حسابك؟ هذا الإجراء لا يمكن التراجع عنه!")) return;

    try {
        e.target.disabled = true; e.target.innerText = "جاري مسح البيانات...";
        errorMsg.style.display = 'none';

        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(currentDriverEmail, pwd);
        await reauthenticateWithCredential(user, credential);

        // مسح ملف المندوب
        await deleteDoc(doc(db, "users", currentDriver.uid));
        // مسح الحساب نهائياً من المصادقة
        await deleteUser(user);

        alert("تم حذف حسابك بنجاح. 👋");
        window.location.href = 'login.html';
    } catch (error) {
        console.error("خطأ أثناء الحذف:", error);
        errorMsg.style.display = 'block';
        if (error.code === 'auth/invalid-credential') { errorMsg.innerText = "❌ كلمة المرور غير صحيحة!"; }
        else { errorMsg.innerText = "حدث خطأ يرجى المحاولة لاحقاً."; }
    } finally {
        e.target.disabled = false; e.target.innerText = "حذف حسابي للأبد";
    }
});

// ============================================================================
// --- جلب إعدادات الدعم الفني وإظهار التحديثات في حساب المندوب ---
// ============================================================================
async function loadDriverSupport() {
    try {
        const docSnap = await getDoc(doc(db, "app_settings", "support"));
        if (docSnap.exists()) {
            const data = docSnap.data().driver; // دعم المندوب فقط
            if (data) {
                if (data.phone) {
                    const waClean = data.phone.replace(/\s+/g, '');
                    const waUrl = `https://wa.me/${waClean.startsWith('0') ? '964' + waClean.substring(1) : waClean}`;
                    document.getElementById('btn-d-support-whatsapp').onclick = () => window.open(waUrl, '_blank');
                }
                if (data.email) {
                    const emailBtn = document.getElementById('btn-d-support-email');
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
    } catch (e) { console.error("خطأ في جلب الدعم:", e); }
}

function checkDriverOptionalBanner() {
    const updDataStr = localStorage.getItem('driver_optional_update');
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

// تشغيل المحركات بمجرد دخول المندوب
loadDriverSupport();
checkDriverOptionalBanner();

// ============================================================================
// --- 📄 محرك جلب الصفحات الديناميكية (المندوب) ---
// ============================================================================
async function fetchDriverPages() {
    const container = document.getElementById('dynamic-pages-container');
    const card = document.getElementById('dynamic-pages-card');
    if (!container) return;

    try {
        const q = query(collection(db, "app_pages"), where("target_app", "==", "driver"));
        const snap = await getDocs(q);

        container.innerHTML = '';

        if (snap.empty) {
            if (card) card.style.display = 'none';
            return;
        } else {
            if (card) card.style.display = 'block';
        }

        let isFirst = true;
        snap.forEach(docSnap => {
            const page = docSnap.data();

            const item = document.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; padding: 15px 0; cursor: pointer;';
            if (!isFirst) item.style.borderTop = '1px solid #f8f9fa';
            isFirst = false;

            item.innerHTML = `
                <div style="width: 35px; height: 35px; border-radius: 8px; display: flex; justify-content: center; align-items: center; font-size: 16px; margin-left: 15px; background: #f8fafc; color: #475569;"><i class="fas fa-file-alt"></i></div>
                <div style="flex: 1; font-size: 15px; font-weight: bold; color: #34495e;">${page.title}</div>
                <i class="fas fa-chevron-left" style="color: #bdc3c7; font-size: 14px;"></i>
            `;

            item.addEventListener('click', () => {
                const pageOverlay = document.getElementById('page-dynamic-content');
                document.getElementById('dyn-page-title').innerText = page.title;
                document.getElementById('dyn-page-body').innerText = page.content;

                const imgEl = document.getElementById('dyn-page-img');
                if (page.image_url) {
                    imgEl.src = page.image_url;
                    imgEl.style.display = 'block';
                } else {
                    imgEl.style.display = 'none';
                }

                pageOverlay.style.display = 'block';
                document.body.style.overflow = 'hidden';
            });

            container.appendChild(item);
        });
    } catch (error) {
        console.error("خطأ في جلب الصفحات:", error);
    }
}

document.addEventListener('DOMContentLoaded', fetchDriverPages);
