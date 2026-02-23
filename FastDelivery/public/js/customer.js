// ============================================================================
// تطبيق العميل - المحرك الرئيسي (Customer App Core Logic)
// تطبيقاً لـ [الجزء الرابع]: تصفح المتاجر وتكوين وإرسال الطلبات.
// تطبيقاً لـ [الجزء الثاني]: الطلب الحر (Direct Order) وتوجيهه للمتاجر.
// تطبيقاً لـ [الجزء الثالث]: محرك العنونة الجغرافي (FAT / GPS).
// تطبيقاً لـ [الجزء الخامس]: توليد الإشعارات اللحظية للتجار.
// ============================================================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
let currentUser = null;
let selectedMerchantId = null;
let selectedProduct = null;
let zonesData = {};


// ============================================================================
// --- محرك فحص التحديثات (Update Guard) ---
// ============================================================================
const APP_VERSION = '1.0'; // الإصدار الحالي المبرمج للتطبيق

async function checkAppUpdates() {
    try {
        const docSnap = await getDoc(doc(db, "app_settings", "updates"));
        if (docSnap.exists()) {
            const data = docSnap.data().customer; // نأخذ إعدادات العميل فقط
            if (data && data.new_version > APP_VERSION) {

                const title = data.title || "يتوفر تحديث جديد للتطبيق!";
                const link = data.link || "#";
                const icon = data.icon || "https://cdn-icons-png.flaticon.com/512/9322/9322127.png";

                if (data.type === 'mandatory') {
                    // قفل التطبيق بالكامل (إجباري)
                    const mScreen = document.getElementById('mandatory-update-screen');
                    if (mScreen) {
                        mScreen.style.display = 'flex';
                        document.getElementById('m-upd-title').innerText = title;
                        document.getElementById('m-upd-link').href = link;
                        if (data.icon) document.getElementById('m-upd-icon').src = icon;
                    }
                } else if (data.type === 'optional') {
                    // إظهار التنبيه مرة واحدة فقط إذا لم يتخطاه مسبقاً لهذا الإصدار بالتحديد
                    const skippedVersion = localStorage.getItem('skipped_update_version');
                    if (skippedVersion !== data.new_version) {
                        const oToast = document.getElementById('optional-update-toast');
                        if (oToast) {
                            oToast.style.display = 'flex';
                            document.getElementById('o-upd-title').innerText = title;
                            document.getElementById('o-upd-link').href = link;

                            document.getElementById('o-upd-skip').addEventListener('click', () => {
                                oToast.style.display = 'none';
                                localStorage.setItem('skipped_update_version', data.new_version);
                            });
                        }
                    }
                    // حفظ البيانات لصفحة حسابي لتعرض بطاقة التحديث بشكل دائم
                    localStorage.setItem('available_optional_update', JSON.stringify(data));
                }
            } else {
                // التطبيق محدث، نمسح التنبيه من شاشة حسابي
                localStorage.removeItem('available_optional_update');
            }
        }
    } catch (e) { console.error("خطأ في فحص التحديثات:", e); }
}
checkAppUpdates(); // تشغيل الفحص فور فتح التطبيق
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: إدارة الجلسات وحماية الواجهات Route Guards]
// --- 1. التحقق من الدخول وجلب بيانات العميل ---
// التأكد من أن المستخدم الحالي يمتلك صلاحية 'customer' لكي لا يدخل تاجر أو مندوب هنا.
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: إدارة الجلسات وحماية الواجهات Route Guards]
// --- 1. التحقق من الدخول وجلب بيانات العميل ---
// التأكد من أن المستخدم الحالي يمتلك صلاحية 'customer' لكي لا يدخل تاجر أو مندوب هنا.
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// --- 1. التحقق من الدخول (السماح للزوار بالتصفح) ---
// ----------------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'customer') {
            currentUser = { uid: user.uid, ...userDoc.data() };
            document.getElementById('customer-name').innerText = `مرحباً، ${currentUser.name || 'عميلنا العزيز'}`;
            document.getElementById('loyalty-points').innerText = currentUser.loyalty_points || 0;
            startCustomerNotificationRadar();
        } else {
            currentUser = null;
        }
    } else {
        // الزائر غير المسجل
        currentUser = null;
        document.getElementById('customer-name').innerText = "مرحباً بك (زائر)";
        document.getElementById('loyalty-points').innerText = "0";
    }

    // 🌟 السماح للجميع (مسجلين وزوار) برؤية المتاجر والإعلانات
    loadMerchants();
    loadZones();
    loadMerchantsList();
    startAdsRadar();

});


// ----------------------------------------------------------------------------
// [تطبيقاً للجزء السابع: سلايد شو المتاجر - UI/UX]
// --- 2. جلب التجار وعرضهم في السلايد شو + القائمة المنسدلة ---
// ----------------------------------------------------------------------------
async function loadMerchants() {
    const merchantsDiv = document.getElementById('merchants-carousel');
    merchantsDiv.innerHTML = '';

    // جلب التجار النشطين فقط (is_active == true)
    const q = query(collection(db, "users"), where("role", "==", "merchant"), where("is_active", "==", true));
    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
        const merchant = docSnap.data();
        const card = document.createElement('div');
        card.className = 'merchant-card';
        card.innerHTML = `
            <div class="merchant-emoji">🏪</div> 
            <div class="merchant-name">${merchant.store_name || merchant.name}</div>
        `;
        // عند الضغط على بطاقة التاجر، يتم تحميل منتجاته في القسم السفلي
        card.addEventListener('click', () => {
            selectedMerchantId = docSnap.id;
            document.getElementById('selected-merchant-name').innerText = `منتجات ${merchant.store_name || merchant.name}`;
            loadProducts(docSnap.id);
        });
        merchantsDiv.appendChild(card);
    });
}

// [تطبيقاً للجزء الثاني]: دالة جلب قائمة التجار في الـ Select لتوجيه "الطلب الحر"
async function loadMerchantsList() {
    const merchantSelect = document.getElementById('merchant-select');
    if (!merchantSelect) return;

    const q = query(collection(db, "users"), where("role", "==", "merchant"), where("is_active", "==", true));
    const snapshot = await getDocs(q);

    // الخيار الافتراضي: إرسال الطلب للإدارة لتوجيهه يدوياً
    merchantSelect.innerHTML = '<option value="">🍔 طلب حر (دعه للإدارة توجهه)</option>';

    snapshot.forEach(docSnap => {
        const merchant = docSnap.data();
        const storeName = merchant.store_name || merchant.name;
        merchantSelect.innerHTML += `<option value="${docSnap.id}">🏪 ${storeName}</option>`;
    });
}

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء السابع]: عرض منتجات المتجر المختار
// --- 3. جلب منتجات تاجر محدد ---
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// --- 3. جلب منتجات تاجر محدد (محدثة لدعم صفحة التفاصيل) ---
// ----------------------------------------------------------------------------
async function loadProducts(merchantId) {
    const productsDiv = document.getElementById('products-carousel');
    const productsSection = document.getElementById('products-section');
    productsDiv.innerHTML = 'جاري التحميل...';
    productsSection.style.display = 'block';

    const q = query(collection(db, "products"), where("merchant_id", "==", merchantId));
    const snapshot = await getDocs(q);

    productsDiv.innerHTML = '';
    if (snapshot.empty) {
        productsDiv.innerHTML = '<p style="padding:20px; color:gray;">لا توجد منتجات حالياً.</p>';
        return;
    }

    // رسم بطاقات المنتجات
    snapshot.forEach(docSnap => {
        const prod = docSnap.data();
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div>
                <div class="product-header">
                    <span>${prod.emoji || '📦'}</span>
                    <div class="product-details">
                        <h4>${prod.name}</h4>
                        <p style="font-size:11px; color:gray;">${prod.description}</p>
                    </div>
                </div>
                <div class="product-price">${prod.price.toLocaleString()} د.ع</div>
            </div>
            <button class="add-btn">التفاصيل والطلب</button>
        `;
        // عند الضغط، يتم تعبئة بيانات "صفحة التفاصيل" وإظهارها
        card.querySelector('.add-btn').addEventListener('click', () => {
            selectedProduct = prod;
            document.getElementById('detail-product-emoji').innerText = prod.emoji || '📦';
            document.getElementById('detail-product-name').innerText = prod.name;
            document.getElementById('detail-product-price').innerText = prod.price.toLocaleString() + ' د.ع';
            document.getElementById('detail-product-desc').innerText = prod.description || 'لا يوجد وصف إضافي لهذا المنتج.';

            document.getElementById('page-product-details').style.display = 'block'; // إظهار الصفحة
        });
        productsDiv.appendChild(card);
    });
}

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثالث]: محرك العنونة الذكي والـ FAT
// --- 4. جلب المناطق والتحكم التلقائي بحقول الإدخال ---
// ----------------------------------------------------------------------------
async function loadZones() {
    const zoneSelect = document.getElementById('zone-select');
    const q = query(collection(db, "zones"), where("is_active", "==", true));
    const snapshot = await getDocs(q);
    zoneSelect.innerHTML = '<option value="">-- اختر المنطقة --</option>';

    snapshot.forEach(docSnap => {
        zonesData[docSnap.id] = docSnap.data(); // حفظ بيانات المنطقة (مثل has_fat و delivery_fee)
        zoneSelect.innerHTML += `<option value="${docSnap.id}">${docSnap.data().name} (${docSnap.data().city})</option>`;
    });
}

// التبديل الذكي: عند اختيار منطقة، نتحقق هل تدعم الأعمدة (has_fat) أم لا
document.getElementById('zone-select').addEventListener('change', async (e) => {
    const zoneId = e.target.value;
    const fatGroup = document.getElementById('fat-group');
    const gpsGroup = document.getElementById('gps-group');
    const fatSelect = document.getElementById('fat-select');

    if (!zoneId) { fatGroup.style.display = 'none'; gpsGroup.style.display = 'none'; return; }

    const zone = zonesData[zoneId];
    if (zone.has_fat) {
        // إظهار قائمة الأعمدة وإخفاء رسالة الـ GPS
        fatGroup.style.display = 'block'; gpsGroup.style.display = 'none';
        fatSelect.innerHTML = '<option value="">-- جاري التحميل... --</option>';

        // جلب الأعمدة الخاصة بهذه المنطقة تحديداً من الـ Sub-collection
        const colsSnapshot = await getDocs(collection(db, `zones/${zoneId}/columns`));
        fatSelect.innerHTML = '<option value="">-- اختر رقم العمود --</option>';
        colsSnapshot.forEach(docSnap => {
            fatSelect.innerHTML += `<option value="${docSnap.data().column_id}">${docSnap.data().column_id}</option>`;
        });
    } else {
        // إظهار رسالة الاعتماد على الوصف والـ GPS وإخفاء الأعمدة
        fatGroup.style.display = 'none'; gpsGroup.style.display = 'block';
    }
});


// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني والرابع]: نافذة الدفع والتوجيه الذكي
// --- 5. إدارة نافذة إتمام الطلب (Checkout المحدثة) ---
// ----------------------------------------------------------------------------
const checkoutPanel = document.getElementById('checkout-panel');
const customInput = document.getElementById('custom-order-text');
const summaryText = document.getElementById('order-summary-text');
const merchantSelectionGroup = document.getElementById('merchant-selection-group');
let orderType = '';

// دالة تكييف شاشة الإرسال حسب نوع الطلب (منتج جاهز vs طلب حر)
function openCheckout(type) {
    orderType = type;
    if (type === 'product') {
        summaryText.innerText = `طلب: ${selectedProduct.name} (${selectedProduct.price} د.ع)`;
        customInput.style.display = 'none';
        // إخفاء قائمة اختيار التاجر لأننا اخترنا منتجاً من تاجر محدد بالفعل
        if (merchantSelectionGroup) merchantSelectionGroup.style.display = 'none';
    } else {
        selectedMerchantId = null;
        summaryText.innerText = `طلب توصيل خاص:`;
        customInput.style.display = 'block';
        // إظهار قائمة اختيار التاجر ليتمكن العميل من توجيهه
        if (merchantSelectionGroup) merchantSelectionGroup.style.display = 'block';
    }
    checkoutPanel.classList.add('open');
}

// أزرار فتح وإغلاق نافذة الـ Checkout
document.getElementById('open-direct-order-btn').addEventListener('click', () => openCheckout('custom'));
document.getElementById('close-checkout-btn').addEventListener('click', () => checkoutPanel.classList.remove('open'));
document.getElementById('hero-direct-order-card')?.addEventListener('click', () => openCheckout('custom'));
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الرابع والخامس]: إنشاء الطلب وتوليد الإشعار
// --- 6. إرسال الطلب لقاعدة البيانات ---
// ----------------------------------------------------------------------------
document.getElementById('submit-order-btn').addEventListener('click', async () => {
    if (!currentUser) {
        alert("يرجى تسجيل الدخول أولاً لكي نتمكن من إيصال طلبك بنجاح!");
        window.location.href = 'login.html';
        return;
    }

    const zoneId = document.getElementById('zone-select').value;
    const addressNote = document.getElementById('address-note').value.trim();

    // تحقق من الحقول الإجبارية
    if (!zoneId || !addressNote) {
        alert("يرجى تحديد المنطقة وكتابة ملاحظة العنوان الدقيق!"); return;
    }

    // تحقق من اختيار العمود إذا كانت المنطقة تدعمه
    let columnId = null;
    if (zonesData[zoneId].has_fat) {
        columnId = document.getElementById('fat-select').value;
        if (!columnId) { alert("يرجى اختيار رقم العمود (FAT)!"); return; }
    }

    let orderDetailsText = "";
    let merchantId = null;

    if (orderType === 'product') {
        orderDetailsText = `شراء: ${selectedProduct.name}`;
        merchantId = selectedMerchantId; // التاجر الذي ضغطنا عليه في السلايد شو
    } else {
        orderDetailsText = customInput.value.trim();
        if (!orderDetailsText) { alert("يرجى كتابة ماذا تريد أن تطلب!"); return; }
        // جلب التاجر من القائمة المنسدلة في الطلب الحر (إن وُجد)
        merchantId = document.getElementById('merchant-select').value || null;
    }

    try {
        const btn = document.getElementById('submit-order-btn');
        btn.disabled = true; btn.innerText = "جاري إرسال الطلب...";

        // تحديد الحالة المبدئية: للتاجر مباشرة (PENDING) أو للإدارة لتوجيهه (PENDING_ADMIN)
        const initialStatus = merchantId ? 'PENDING' : 'PENDING_ADMIN';

        // 1. [تطبيقاً للمحرك المالي]: سحب أجرة التوصيل الخاصة بالمنطقة من الذاكرة
        const deliveryFee = Number(zonesData[zoneId].delivery_fee) || 0;

        // 2. المعادلة: إذا كان منتجاً جاهزاً نجمع (السعر + التوصيل)، أما الطلب الحر فيبقى 0 لحين تسعيره من التاجر
        const finalTotalPrice = orderType === 'product' ? (Number(selectedProduct.price) + deliveryFee) : 0;

        // 3. إنشاء الطلب في الفايربيس (والتقاط الـ Ref الخاص به لاستخدامه في الإشعارات)
        const newOrderRef = await addDoc(collection(db, "orders"), {
            created_by_user_id: currentUser.uid,
            customer_id: currentUser.uid,
            merchant_id: merchantId,
            driver_id: null,
            status: initialStatus,
            zone_id: zoneId,
            column_id: columnId,
            address_note: addressNote,
            order_details: orderDetailsText,
            delivery_fee: deliveryFee,   // حفظ الأجرة 
            created_at: serverTimestamp(),
            total_price: finalTotalPrice // حفظ الإجمالي
        });

        // ----------------------------------------------------------------------------
        // 🚀 [تطبيقاً للجزء الخامس: السطر السحري للإشعارات الموجهة]
        // إذا تم توجيه الطلب لتاجر معين، نقوم فوراً برمي إشعار في صندوقه لينتبه للطلب.
        // ----------------------------------------------------------------------------
        if (merchantId) {
            await addDoc(collection(db, "notifications"), {
                target_user: merchantId, // توجيه الإشعار لمعرف التاجر تحديداً
                title: "🔔 طلب جديد بانتظارك!",
                message: `لديك طلب جديد من العميل يحتاج إلى تسعير أو تجهيز: ${orderDetailsText}`,
                order_id: newOrderRef.id, // ربط الإشعار برقم الطلب لكي يفتح عند الضغط في تطبيق التاجر
                is_read: false,
                created_at: serverTimestamp()
            });
        }

        alert("تم استلام طلبك بنجاح! جاري معالجته.");
        checkoutPanel.classList.remove('open');
        window.location.href = "status.html"; // توجيه العميل لشاشة التتبع

    } catch (error) {
        console.error("خطأ في إرسال الطلب:", error);
        alert("حدث خطأ أثناء الإرسال.");
    } finally {
        const btn = document.getElementById('submit-order-btn');
        btn.disabled = false; btn.innerText = "تأكيد وإرسال الطلب";
    }
});
// ============================================================================
// --- 7. محرك التنقل بين الصفحات الكاملة (Page Router) ---
// ============================================================================

// إغلاق أي صفحة كاملة عند الضغط على زر السهم
document.querySelectorAll('.close-page-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).style.display = 'none';
    });
});

// زر "اطلب الآن" الموجود داخل صفحة تفاصيل المنتج
document.getElementById('detail-order-btn').addEventListener('click', () => {
    document.getElementById('page-product-details').style.display = 'none';
    openCheckout('product');
});

// ============================================================================
// --- 8. رادار الإشعارات الذكي والإشعارات الغنية (Rich Notifications) ---
// ============================================================================
let localReadNotifications = JSON.parse(localStorage.getItem('customer_read_notifs')) || [];
let toastedNotifs = new Set(); // ذاكرة مؤقتة لمنع تكرار الـ Toast بدون جعله "مقروءاً"
let globalNotifIds = []; // حفظ كل الإشعارات الحالية

// فتح صفحة قائمة الإشعارات وتصفير العداد
document.getElementById('nav-bell-btn').addEventListener('click', () => {
    document.getElementById('page-notifications').style.display = 'block';
    document.getElementById('unread-badge').style.display = 'none'; // إخفاء العداد

    // بمجرد فتح الصندوق، نعتبر كل الإشعارات الحالية "مقروءة" رسمياً
    globalNotifIds.forEach(id => {
        if (!localReadNotifications.includes(id)) {
            localReadNotifications.push(id);
        }
    });
    localStorage.setItem('customer_read_notifs', JSON.stringify(localReadNotifications));

    // تحديث ألوان البطاقات من الأزرق للأبيض (مقروءة)
    document.querySelectorAll('.notif-card').forEach(card => {
        card.style.background = 'white';
        card.style.borderRight = 'none';
    });
});

function startCustomerNotificationRadar() {
    // 1. توليد "التنبيه المنزلق (Toast)" برمجياً
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; top: -100px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; padding: 15px 25px; border-radius: 30px; box-shadow: 0 10px 30px rgba(59,130,246,0.4); z-index: 9999; display: flex; align-items: center; gap: 15px; transition: top 0.4s; direction: rtl; width: 90%; max-width: 400px;';
    toast.innerHTML = `<i class="fas fa-bell" style="font-size: 20px;"></i> <div><h4 id="c-toast-title" style="margin:0; font-size:15px;"></h4><p id="c-toast-body" style="margin:3px 0 0 0; font-size:13px; opacity:0.9;"></p></div>`;
    document.body.appendChild(toast);

    const qNotifs = query(collection(db, "notifications"), orderBy("created_at", "desc"), limit(30));
    let isFirstLoad = true;

    onSnapshot(qNotifs, (snapshot) => {
        const list = document.getElementById('notifications-list');
        const badge = document.getElementById('unread-badge');
        list.innerHTML = '';
        let unreadCount = 0;
        globalNotifIds = []; // تصفير المصفوفة لتحديثها

        snapshot.forEach(docSnap => {
            const notif = docSnap.data();
            const notifId = docSnap.id;

            // هل الإشعار موجه لي؟
            const isForMe = (notif.target_type === 'all') || (notif.target_type === 'specific' && notif.target_uid === currentUser.uid);
            if (!isForMe) return;

            globalNotifIds.push(notifId); // حفظ المعرف في الذاكرة
            const isRead = localReadNotifications.includes(notifId);

            // إذا لم يكن مقروءاً، قم بزيادة العداد الأحمر!
            if (!isRead) {
                unreadCount++;
            }

            // إظهار التنبيه المنزلق (Toast) إذا كان الإشعار جديداً ولم يظهر له Toast مسبقاً
            if (!isFirstLoad && !isRead && !toastedNotifs.has(notifId)) {
                document.getElementById('c-toast-title').innerText = notif.title;
                document.getElementById('c-toast-body').innerText = notif.body;
                toast.style.top = '20px';
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

                const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                notificationSound.play().catch(e => console.log("الصوت يحتاج لمسة من العميل أولاً"));

                setTimeout(() => toast.style.top = '-100px', 4000);

                // تسجيل أنه "ظهر كمنزلق" ولكن *لا* نسجله كمقروء!
                toastedNotifs.add(notifId);
            }

            // رسم بطاقة الإشعار 
            const bg = isRead ? 'background: white;' : 'background: #eef2ff; border-right: 4px solid #3b82f6;';
            const dateStr = notif.created_at ? notif.created_at.toDate().toLocaleString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'الآن';

            const card = document.createElement('div');
            card.className = 'notif-card'; // لتسهيل تغيير لونها لاحقاً
            card.style.cssText = `padding: 15px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.02); border: 1px solid #e2e8f0; cursor: pointer; transition: 0.3s; ${bg}`;
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: #1e293b; font-size: 14px;">${notif.title}</strong>
                    <span style="font-size: 11px; color: #94a3b8;">${dateStr}</span>
                </div>
                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">${notif.body}</p>
            `;

            // هندسة التفاعل الغني (عند النقر على الإشعار من القائمة)
            card.addEventListener('click', () => {
                card.style.background = 'white'; card.style.borderRight = 'none';
                if (!localReadNotifications.includes(notifId)) {
                    localReadNotifications.push(notifId);
                    localStorage.setItem('customer_read_notifs', JSON.stringify(localReadNotifications));
                }

                if (notif.action_type === 'external_link' && notif.action_value) {
                    window.open(notif.action_value, '_blank');
                }
                else if (notif.action_type === 'internal_page') {
                    document.getElementById('rich-notif-title').innerText = notif.title;
                    document.getElementById('rich-notif-body').innerText = notif.body;
                    const imgEl = document.getElementById('rich-notif-image');
                    if (notif.image_url) { imgEl.src = notif.image_url; imgEl.style.display = 'block'; } else { imgEl.style.display = 'none'; }
                    const actionBtn = document.getElementById('rich-notif-action-btn');
                    if (notif.action_value) { actionBtn.style.display = 'block'; actionBtn.onclick = () => window.open(notif.action_value, '_blank'); } else { actionBtn.style.display = 'none'; }
                    document.getElementById('page-rich-notification').style.display = 'block';
                }
                else if (notif.action_type === 'order_link' && notif.action_value) {
                    localStorage.setItem('target_order_id', notif.action_value);
                    window.location.href = 'status.html';
                }
            });

            list.appendChild(card);
        });

        if (list.innerHTML === '') {
            list.innerHTML = '<p style="text-align: center; color: gray; margin-top: 20px;">لا توجد إشعارات لك حالياً.</p>';
        }

        // 🎯 تحديث العداد الأحمر بدقة عالية
        if (unreadCount > 0) {
            badge.style.display = 'block';
            badge.innerText = unreadCount > 9 ? '+9' : unreadCount;
        } else {
            badge.style.display = 'none';
        }

        isFirstLoad = false;
    });
}

// ============================================================================
// --- 9. رادار ومحرك البانر الإعلاني (Smart Ads Engine) ---
// ============================================================================
let autoSlideInterval;

function startAdsRadar() {
    const adsWrapper = document.getElementById('ads-carousel-wrapper');
    const adsContainer = document.getElementById('ads-carousel-container');
    const dotsContainer = document.getElementById('ad-dots-container');

    // جلب الإعلانات النشطة فقط من الفايربيس
    const qAds = query(collection(db, "ads"), where("is_active", "==", true));

    onSnapshot(qAds, (snapshot) => {
        adsContainer.innerHTML = '';
        dotsContainer.innerHTML = '';
        let validAds = [];
        const now = new Date();

        // تصفية الإعلانات: استبعاد الإعلانات التي تجاوزت تاريخ الانتهاء
        snapshot.forEach(docSnap => {
            const ad = docSnap.data();
            const expDate = ad.expires_at ? ad.expires_at.toDate() : new Date();
            if (now <= expDate) {
                validAds.push({ id: docSnap.id, ...ad });
            }
        });

        // إذا لم تكن هناك إعلانات صالحة، قم بإخفاء البانر بالكامل
        if (validAds.length === 0) {
            adsWrapper.style.display = 'none';
            return;
        }

        adsWrapper.style.display = 'block'; // إظهار البانر

        // رسم شرائح الإعلانات والنقاط
        validAds.forEach((ad, index) => {
            // الشريحة (الصورة)
            const slide = document.createElement('div');
            slide.className = 'ad-slide';
            slide.innerHTML = `<img src="${ad.image_url}" alt="إعلان">`;

            // هندسة التفاعل عند النقر على الصورة (Rich Action)
            slide.addEventListener('click', () => {
                if (ad.action_type === 'external_link' && ad.action_value) {
                    window.open(ad.action_value, '_blank');
                } else if (ad.action_type === 'internal_page') {
                    // استخدام نفس شاشة تفاصيل الإشعار الأنيقة لعرض تفاصيل الإعلان
                    document.getElementById('rich-notif-title').innerText = ad.title || 'عرض خاص!';
                    document.getElementById('rich-notif-body').innerText = ad.body || '';

                    const imgEl = document.getElementById('rich-notif-image');
                    imgEl.src = ad.image_url;
                    imgEl.style.display = 'block';

                    const actionBtn = document.getElementById('rich-notif-action-btn');
                    if (ad.action_value) {
                        actionBtn.style.display = 'block';
                        actionBtn.onclick = () => window.open(ad.action_value, '_blank');
                    } else {
                        actionBtn.style.display = 'none';
                    }
                    document.getElementById('page-rich-notification').style.display = 'block';
                }
            });

            adsContainer.appendChild(slide);

            // النقطة السفلية
            const dot = document.createElement('div');
            dot.className = `ad-dot ${index === 0 ? 'active' : ''}`;
            dotsContainer.appendChild(dot);
        });

        // تشغيل نظام السلايد شو التلقائي
        setupCarouselAutoSlide(validAds.length);
    });
}

function setupCarouselAutoSlide(totalSlides) {
    const adsContainer = document.getElementById('ads-carousel-container');
    const dots = document.querySelectorAll('.ad-dot');

    if (autoSlideInterval) clearInterval(autoSlideInterval);
    if (totalSlides <= 1) return; // لا حاجة للتحريك إذا كان إعلاناً واحداً فقط

    let currentIndex = 0;

    // مراقبة سحب العميل للصورة يدوياً لتحديث النقطة السفلية النشطة
    adsContainer.addEventListener('scroll', () => {
        const scrollPos = Math.abs(adsContainer.scrollLeft);
        const slideWidth = adsContainer.clientWidth;
        // حساب الـ Index بناءً على مسافة السحب
        currentIndex = Math.round(scrollPos / slideWidth);
        dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentIndex));
    }, { passive: true });

    // تقليب السلايد شو آلياً كل 4 ثوانٍ
    autoSlideInterval = setInterval(() => {
        currentIndex++;
        if (currentIndex >= totalSlides) currentIndex = 0; // العودة للأول

        // التمرير السلس نحو الإعلان التالي
        if (adsContainer.children[currentIndex]) {
            adsContainer.children[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, 4000);

    // إيقاف التمرير الآلي إذا وضع العميل إصبعه على الإعلان (لكي يقرأه)
    adsContainer.addEventListener('touchstart', () => clearInterval(autoSlideInterval), { passive: true });
}

// ========================================================================
// 🚀 محرك الفتح التلقائي (التقاط الإشارة من الرابط)
// ========================================================================
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('action') === 'order') {
    // ننتظر أجزاء من الثانية فقط لضمان اكتمال رسم الصفحة والمتاجر
    setTimeout(() => {
        openCheckout('custom'); // فتح نافذة الطلب الحر مباشرة!

        // مسح الإشارة من الرابط بهدوء لكي لا تفتح النافذة مجدداً إذا حدث العميل الصفحة
        window.history.replaceState(null, '', window.location.pathname);
    }, 400);
}