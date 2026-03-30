// ============================================================================
// إدارة الطلبات المباشرة والسجل الجنائي (Order Management & Audit Log)
// تحديث: إضافة محرك فلترة، بحث متقدم (بالاسم، الهاتف، الرقم)، وتقسيم صفحات (Pagination).
// ============================================================================

import { sendDistributedPush } from '../../shared/push-engine.js';
import { db } from '../../shared/firebase-config.js';
import { collection, onSnapshot, query, orderBy, getDoc, getDocs, doc, updateDoc, addDoc, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- المتغيرات الأساسية للمحرك ---
let allOrders = []; // لتخزين جميع الطلبات المسحوبة
let filteredOrders = []; // لتخزين الطلبات بعد تطبيق الفلترة والبحث
let currentPage = 1;
let itemsPerPage = 20; // القيمة الافتراضية

// ذواكر التخزين المؤقت (Caches) لمنع استهلاك الفايربيس وتسريع البحث
const usersCache = {};
const zonesCache = {};

// ----------------------------------------------------------------------------
// 1. منطق التنقل والتهيئة المبدئية
// ----------------------------------------------------------------------------
const navOrders = document.getElementById('nav-orders');
const viewOrders = document.getElementById('view-orders');
let currentOrderToAssign = null;

navOrders.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');
    navOrders.classList.add('active');
    viewOrders.style.display = 'block';
    document.getElementById('page-title').innerText = 'إدارة الطلبات المباشرة';

    initFiltersData(); // جلب قوائم التجار والمناطق للفلاتر
});

// دالة لجلب البيانات الأولية لملء القوائم المنسدلة (المناطق والتجار)
async function initFiltersData() {
    const merchantSelect = document.getElementById('filter-merchant');
    const zoneSelect = document.getElementById('filter-zone');
    const adminMerchantSelect = document.getElementById('admin-merchant-select'); // قائمة نافذة التوجيه

    // جلب التجار
    if (merchantSelect.options.length <= 1) {
        const qMerchants = query(collection(db, "users"), where("role", "==", "merchant"));
        const snapM = await getDocs(qMerchants);
        let mHtml = '<option value="">-- كل التجار --</option>';
        let adminMHtml = '<option value="">-- اختر التاجر --</option>';
        snapM.forEach(docSnap => {
            const data = docSnap.data();
            const name = data.store_name || data.name;
            mHtml += `<option value="${docSnap.id}">${name}</option>`;
            if (data.is_active) adminMHtml += `<option value="${docSnap.id}">${name}</option>`;
            usersCache[docSnap.id] = data; // حفظ في الكاش
        });
        merchantSelect.innerHTML = mHtml;
        if (adminMerchantSelect) adminMerchantSelect.innerHTML = adminMHtml;
    }

    // جلب المناطق
    if (zoneSelect.options.length <= 1) {
        const qZones = query(collection(db, "zones"));
        const snapZ = await getDocs(qZones);
        let zHtml = '<option value="">-- كل المناطق --</option>';
        snapZ.forEach(docSnap => {
            zHtml += `<option value="${docSnap.id}">${docSnap.data().name}</option>`;
            zonesCache[docSnap.id] = docSnap.data().name; // حفظ في الكاش
        });
        zoneSelect.innerHTML = zHtml;
    }
}

// ----------------------------------------------------------------------------
// 2. محرك جلب الطلبات اللحظي وتغذية الكاش
// ----------------------------------------------------------------------------
const qOrders = query(collection(db, "orders"), orderBy("created_at", "desc"));

onSnapshot(qOrders, async (snapshot) => {
    const tempOrders = [];
    const missingUids = new Set(); // لتجميع الـ IDs غير الموجودة في الكاش لطلبها دفعة واحدة

    snapshot.forEach(docSnap => {
        const order = docSnap.data();
        order.id = docSnap.id;
        tempOrders.push(order);

        // التحقق من وجود المستخدمين في الكاش (العميل، التاجر، المندوب)
        if (order.customer_id && !usersCache[order.customer_id]) missingUids.add(order.customer_id);
        if (order.merchant_id && !usersCache[order.merchant_id]) missingUids.add(order.merchant_id);
        if (order.driver_id && !usersCache[order.driver_id]) missingUids.add(order.driver_id);
    });

    // جلب بيانات المستخدمين الناقصين لتوفير الهاتف والاسم للبحث
    const fetchPromises = Array.from(missingUids).map(uid => getDoc(doc(db, "users", uid)).then(snap => {
        if (snap.exists()) {
            usersCache[uid] = snap.data();
        } else {
            usersCache[uid] = { name: 'محذوف', phone: '' };
        }
    }));
    await Promise.all(fetchPromises); // انتظار جلب جميع الأسماء

    allOrders = tempOrders;
    applyFiltersAndRender(); // تطبيق الفلترة والرسم
});

// ----------------------------------------------------------------------------
// 3. محرك الفلترة والبحث الذكي
// ----------------------------------------------------------------------------
function applyFiltersAndRender() {
    const searchTerm = document.getElementById('filter-search').value.toLowerCase().trim();
    const statusFilter = document.getElementById('filter-status').value;
    const merchantFilter = document.getElementById('filter-merchant').value;
    const zoneFilter = document.getElementById('filter-zone').value;
    const dateFilter = document.getElementById('filter-date').value;
    itemsPerPage = parseInt(document.getElementById('filter-limit').value) || 20;

    filteredOrders = allOrders.filter(order => {
        // أ. فلتر الحالة (مع دمج جميع أنواع الإلغاء تحت خيار واحد)
        if (statusFilter) {
            if (statusFilter === 'CANCELED') {
                if (!order.status.includes('CANCEL')) return false;
            } else {
                if (order.status !== statusFilter) return false;
            }
        }

        // ب. فلتر التاجر
        if (merchantFilter && order.merchant_id !== merchantFilter) return false;

        // ج. فلتر المنطقة
        if (zoneFilter && order.zone_id !== zoneFilter) return false;

        // د. فلتر التاريخ
        if (dateFilter) {
            if (!order.created_at) return false;
            const orderDate = new Date(order.created_at.toDate());
            const filterDateObj = new Date(dateFilter);
            if (orderDate.getFullYear() !== filterDateObj.getFullYear() ||
                orderDate.getMonth() !== filterDateObj.getMonth() ||
                orderDate.getDate() !== filterDateObj.getDate()) {
                return false;
            }
        }

        // هـ. محرك البحث النصي (رقم الطلب، اسم العميل، رقم الهاتف)
        if (searchTerm) {
            const oId = order.id.toLowerCase();
            const cName = order.guest_name ? order.guest_name.toLowerCase() : (usersCache[order.customer_id]?.name || '').toLowerCase();
            const cPhone = order.guest_phone ? order.guest_phone.toLowerCase() : (usersCache[order.customer_id]?.phone || '').toLowerCase();

            // إذا لم يتطابق أي منها، يتم استبعاد الطلب
            if (!oId.includes(searchTerm) && !cName.includes(searchTerm) && !cPhone.includes(searchTerm)) {
                return false;
            }
        }
        return true;
    });

    // حماية: إذا كانت الصفحة الحالية أكبر من إجمالي الصفحات بعد الفلترة، نعود للأولى
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = 1;

    renderTable();
}

// ----------------------------------------------------------------------------
// 4. بناء وعرض الجدول (الرسم + الـ Pagination)
// ----------------------------------------------------------------------------
function renderTable() {
    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = '';

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
    document.getElementById('page-indicator').innerText = `صفحة ${currentPage} من ${totalPages} (${filteredOrders.length} طلب)`;

    // التحكم بتفعيل أو إيقاف أزرار التنقل
    document.getElementById('prev-page-btn').disabled = currentPage === 1;
    document.getElementById('next-page-btn').disabled = currentPage === totalPages;
    document.getElementById('prev-page-btn').style.opacity = currentPage === 1 ? "0.5" : "1";
    document.getElementById('next-page-btn').style.opacity = currentPage === totalPages ? "0.5" : "1";

    // اقتطاع المصفوفة حسب الصفحة الحالية
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    if (paginatedOrders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px; color: gray; font-size: 15px;">لا توجد طلبات تطابق بحثك حالياً.</td></tr>';
        return;
    }

    paginatedOrders.forEach(order => {
        const orderId = order.id;

        // سحب الأسماء وأرقام الهواتف من الكاش فوراً
        const cPhone = order.guest_phone || usersCache[order.customer_id]?.phone || 'لا يوجد هاتف';
        const cName = order.guest_name ? `${order.guest_name} <span style="color:#e67e22; font-size:10px;">(ضيف)</span>` : (usersCache[order.customer_id]?.name || 'عميل مسجل');

        const customerDisplay = `<div style="font-weight:bold;">${cName}</div><div style="font-size:11px; color:#7f8c8d; font-family:monospace;">${cPhone}</div>`;
        const merchantName = usersCache[order.merchant_id]?.store_name || usersCache[order.merchant_id]?.name || 'بانتظار الإدارة';
        const driverName = usersCache[order.driver_id]?.name || 'جاري البحث...';
        const dateStr = order.created_at ? new Date(order.created_at.toDate()).toLocaleString('ar-IQ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

        let statusHtml = '';
        let adminActions = '';

        // [المظهر البصري للحالات]
        switch (order.status) {
            case 'PENDING_ADMIN':
                statusHtml = '<span style="background:#8e44ad; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">👩‍💻 مراجعة الإدارة</span>';
                adminActions = `
                    <div style="margin-top: 8px; display:flex; gap:5px; justify-content:flex-end;">
                        <button class="route-btn" data-id="${orderId}" style="background:#3498db; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">توجيه</button>
                        <button class="cancel-admin-btn" data-id="${orderId}" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">إلغاء</button>
                    </div>`;
                break;
            case 'PENDING': statusHtml = '<span style="background:#f1c40f; color:#000; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">⏳ تسعير</span>'; break;
            case 'AWAITING_APPROVAL': statusHtml = '<span style="background:#e67e22; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">⚠️ موافقة العميل</span>'; break;
            case 'ASSIGNED': statusHtml = '<span style="background:#3498db; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">🛵 للمندوب</span>'; break;
            case 'IN_TRANSIT': statusHtml = '<span style="background:#9b59b6; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">🚚 بالطريق</span>'; break;
            case 'DELIVERED': statusHtml = '<span style="background:#2ecc71; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">✅ مُسلم</span>'; break;
            case 'CANCELED_BY_ADMIN':
            case 'CANCELED': case 'CANCELED_BY_CUSTOMER': case 'CANCELED_BY_MERCHANT':
                statusHtml = '<span style="background:#e74c3c; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">🚫 ملغي</span>'; break;
            default: statusHtml = `<span style="background:#95a5a6; color:#fff; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">${order.status}</span>`;
        }

        const tr = document.createElement('tr');
        tr.className = 'clickable-order-row';
        tr.setAttribute('data-id', orderId);
        tr.style.cssText = "border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;";
        tr.onmouseover = () => tr.style.background = "#f1f8ff";
        tr.onmouseout = () => tr.style.background = "transparent";
        if (order.status.includes('CANCEL')) tr.style.opacity = "0.6";

        tr.innerHTML = `
            <td style="padding: 12px; font-family: monospace; font-size: 11px; color:#3498db;">#...${orderId.substring(orderId.length - 6)} <i class="fas fa-search"></i></td>
            <td style="padding: 12px;">${customerDisplay}</td>
            <td style="padding: 12px;"><i class="fas fa-store" style="color:#7f8c8d; font-size:10px;"></i> ${merchantName}</td>
            <td style="padding: 12px;"><i class="fas fa-motorcycle" style="color:#7f8c8d; font-size:10px;"></i> ${driverName}</td>
            <td style="padding: 12px; color:#27ae60; font-weight:bold;">${order.total_price > 0 ? order.total_price.toLocaleString() + ' د.ع' : '-'}</td>
            <td style="padding: 12px;">${statusHtml} ${adminActions}</td>
            <td style="padding: 12px; font-size: 12px; color: gray; direction: ltr; text-align: right;">${dateStr}</td>
        `;
        ordersList.appendChild(tr);
    });
}

// ----------------------------------------------------------------------------
// 5. الاستماع لأحداث الفلترة والتنقل والجدول
// ----------------------------------------------------------------------------

// أحداث التغيير في الفلاتر
['filter-search', 'filter-status', 'filter-merchant', 'filter-zone', 'filter-date', 'filter-limit'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyFiltersAndRender);
    document.getElementById(id).addEventListener('change', applyFiltersAndRender);
});

// زر مسح الفلاتر
document.getElementById('reset-filters-btn').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-merchant').value = '';
    document.getElementById('filter-zone').value = '';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-limit').value = '20';
    currentPage = 1;
    applyFiltersAndRender();
});

// أزرار الصفحات (Pagination)
document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
});
document.getElementById('next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
    if (currentPage < totalPages) { currentPage++; renderTable(); }
});

// محرك أحداث الجدول (التوجيه، الإلغاء، والسجل الجنائي)
document.getElementById('orders-list').addEventListener('click', async (e) => {
    // أ. التوجيه
    if (e.target.closest('.route-btn')) {
        e.stopPropagation();
        currentOrderToAssign = e.target.closest('.route-btn').getAttribute('data-id');
        document.getElementById('assign-merchant-modal').style.display = 'flex';
        return;
    }

    // ب. الإلغاء
    if (e.target.closest('.cancel-admin-btn')) {
        e.stopPropagation();
        const orderId = e.target.closest('.cancel-admin-btn').getAttribute('data-id');
        const reason = prompt("ما هو سبب إلغاء هذا الطلب؟ (مثال: طلب وهمي، لا يوجد تاجر متاح)");

        if (reason && reason.trim() !== "") {
            try {
                // 1. تحديث حالة الطلب
                await updateDoc(doc(db, "orders", orderId), { status: 'CANCELED_BY_ADMIN', reason: reason.trim() });

                // 2. توثيق السجل
                await addDoc(collection(db, `orders/${orderId}/order_logs`), {
                    timestamp: serverTimestamp(), action_type: 'CANCELED_BY_ADMIN',
                    description: `تم الإلغاء من قبل الإدارة. السبب: ${reason.trim()}`, action_by: 'موظف الإدارة'
                });

                alert("تم إلغاء الطلب بنجاح.");

                // =======================================================
                // 🚀 [أتمتة الإشعارات]: تنبيه المندوب فوراً إذا كان الطلب بعهدته
                // =======================================================
                const canceledOrder = allOrders.find(o => o.id === orderId);

                // نفحص هل الطلب المُلغى كان مسنداً لمندوب بالفعل؟
                if (canceledOrder && canceledOrder.driver_id) {

                    // جلب بيانات المندوب لمعرفة التوكن الخاص به
                    const driverDoc = await getDoc(doc(db, "users", canceledOrder.driver_id));

                    if (driverDoc.exists() && driverDoc.data().fcm_token) {
                        const driverToken = driverDoc.data().fcm_token;
                        const notifTitle = "🚨 طلب مُلغى!";
                        const notifBody = `الإدارة قامت بإلغاء الطلب رقم #${orderId.substring(orderId.length - 5)}. توقف عن التنفيذ فوراً لتجنب الخسارة!`;

                        // إرسال الإشعار الصاروخي لهاتف المندوب
                        sendDistributedPush(driverToken, notifTitle, notifBody);
                    }
                }
                // =======================================================

            } catch (error) {
                console.error("خطأ في الإلغاء:", error);
                alert("حدث خطأ أثناء إلغاء الطلب.");
            }
        }
        return;
    }

    // ج. فتح شاشة تفاصيل الطلب (عين الصقر للإدارة)
    const row = e.target.closest('.clickable-order-row');
    if (row && !e.target.closest('button')) { // نمنع التداخل إذا ضغطنا على زر الإلغاء أو التوجيه
        const orderId = row.getAttribute('data-id');
        // بما أننا حفظنا كل الطلبات في الذاكرة allOrders، نبحث عنه مباشرة
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
            openAdminOrderDetails(order);
        }
    }
});

// إغلاق نوافذ الإدارة
document.getElementById('close-assign-merchant').addEventListener('click', () => {
    document.getElementById('assign-merchant-modal').style.display = 'none';
});

document.getElementById('confirm-assign-merchant').addEventListener('click', async (e) => {
    const merchantId = document.getElementById('admin-merchant-select').value;
    const selectText = document.getElementById('admin-merchant-select').options[document.getElementById('admin-merchant-select').selectedIndex].text;
    if (!merchantId) { alert("يرجى اختيار التاجر أولاً!"); return; }

    try {
        e.target.disabled = true; e.target.innerText = 'جاري التوجيه...';
        await updateDoc(doc(db, "orders", currentOrderToAssign), { merchant_id: merchantId, status: 'PENDING' });
        await addDoc(collection(db, `orders/${currentOrderToAssign}/order_logs`), {
            timestamp: serverTimestamp(), action_type: 'ASSIGNED_TO_MERCHANT',
            description: `تم توجيه الطلب الحر للتاجر: ${selectText}`, action_by: 'موظف الإدارة'
        });
        alert("تم توجيه الطلب للتاجر بنجاح!");
        // =======================================================
        // 🚀 [أتمتة]: تنبيه التاجر أن الإدارة وجهت له طلباً حراً
        // =======================================================
        const merchantDoc = await getDoc(doc(db, "users", merchantId));
        if (merchantDoc.exists() && merchantDoc.data().fcm_token) {
            sendDistributedPush(
                merchantDoc.data().fcm_token,
                "🔔 طلب موجه من الإدارة",
                `تم توجيه طلب حر إليك من قبل الإدارة. يرجى تسعيره الآن.`
            );
        }
        // =======================================================
        document.getElementById('assign-merchant-modal').style.display = 'none';
    } catch (error) { alert("حدث خطأ."); } finally { e.target.disabled = false; e.target.innerText = 'توجيه الطلب'; }
});


// --- [مرحلة 1]: محرك تسجيل طلبات الهاتف من الإدارة ---
const adminOrderModal = document.getElementById('admin-add-order-modal');
const admMerchantSelect = document.getElementById('adm-merchant-select-order');
const admZoneSelect = document.getElementById('adm-zone-select-order');
const admFatSelect = document.getElementById('adm-fat-select-order');

// 1. فتح النافذة وتجهيز القوائم
document.getElementById('open-admin-order-modal').addEventListener('click', async () => {
    adminOrderModal.style.display = 'flex';

    // تعبئة التجار (من الكاش المتوفر في الملف)
    admMerchantSelect.innerHTML = '<option value="">-- اختر التاجر المنفذ --</option>';
    const qMerchants = query(collection(db, "users"), where("role", "==", "merchant"), where("is_active", "==", true));
    const mSnap = await getDocs(qMerchants);
    mSnap.forEach(d => admMerchantSelect.innerHTML += `<option value="${d.id}">${d.data().store_name || d.data().name}</option>`);

    // تعبئة المناطق (من الكاش المتوفر في الملف)
    admZoneSelect.innerHTML = '<option value="">-- اختر منطقة العميل --</option>';
    const qZones = query(collection(db, "zones"), where("is_active", "==", true));
    const zSnap = await getDocs(qZones);
    zSnap.forEach(d => admZoneSelect.innerHTML += `<option value="${d.id}">${d.data().name}</option>`);
});

// 2. إدارة ظهور الأعمدة (FAT) بناءً على المنطقة
admZoneSelect.addEventListener('change', async (e) => {
    const zId = e.target.value;
    if (!zId) { admFatSelect.style.display = 'none'; return; }

    const zDoc = await getDoc(doc(db, "zones", zId));
    if (zDoc.exists() && zDoc.data().has_fat) {
        admFatSelect.style.display = 'block';
        admFatSelect.innerHTML = '<option value="">-- جاري تحميل الأعمدة... --</option>';
        const cols = await getDocs(collection(db, `zones/${zId}/columns`));
        admFatSelect.innerHTML = '<option value="">-- اختر رقم العمود --</option>';
        cols.forEach(c => admFatSelect.innerHTML += `<option value="${c.data().column_id}">${c.data().column_id}</option>`);
    } else {
        admFatSelect.style.display = 'none';
    }
});

// 3. محرك الحفظ والإرسال مع حقن "الملاحظة التحذيرية"
document.getElementById('submit-admin-order').addEventListener('click', async (e) => {
    const phone = document.getElementById('adm-guest-phone').value.trim();
    const details = document.getElementById('adm-order-details').value.trim();
    const merchantId = admMerchantSelect.value;
    const zoneId = admZoneSelect.value;
    const addressNote = document.getElementById('adm-address-note').value.trim();

    if (!phone || !details || !merchantId || !zoneId) {
        alert("يرجى ملء (الهاتف، التفاصيل، التاجر، والمنطقة) كبيانات إجبارية!");
        return;
    }

    try {
        e.target.disabled = true; e.target.innerText = "جاري الإرسال...";

        // جلب أجرة التوصيل آلياً لضمان حق المكتب
        const zSnap = await getDoc(doc(db, "zones", zoneId));
        const fee = zSnap.data().delivery_fee || 0;

        // [المقترح الهندسي]: حقن ملاحظة المندوب الإجبارية
        const mandatoryDriverNote = `⚠️ تنبيه للمندوب: تم إنشاء هذا الطلب هاتفياً من الإدارة. يجب الاتصال بالعميل فوراً على الرقم (${phone}) لتأكيد الطلب والسعر قبل التحرك إليه. \n ملاحظة العنوان: ${addressNote}`;

        const newOrder = await addDoc(collection(db, "orders"), {
            guest_name: document.getElementById('adm-guest-name').value || "عميل هاتف",
            guest_phone: phone,
            order_details: details,
            merchant_id: merchantId,
            zone_id: zoneId,
            column_id: admFatSelect.style.display !== 'none' ? admFatSelect.value : null,
            address_note: mandatoryDriverNote, // حقن الملاحظة المركبة
            status: 'PENDING', // يذهب للتاجر ليضع سعره أولاً
            delivery_fee: fee,
            is_admin_guest: true, // "الوسام الإداري" للقفز فوق موافقة العميل لاحقاً
            created_at: serverTimestamp()
        });

        // توثيق في السجل الجنائي (Audit Log)
        await addDoc(collection(db, `orders/${newOrder.id}/order_logs`), {
            timestamp: serverTimestamp(),
            action_type: 'CREATED_BY_ADMIN',
            description: `تم تسجيل طلب هاتفي وتوجيهه للتاجر للتسعير. ملاحظة المندوب مضافة آلياً.`,
            action_by: "موظف الإدارة"
        });
        // =======================================================
        // 🚀 [أتمتة]: تنبيه التاجر بطلب الهاتف الجديد
        // =======================================================
        const mDoc = await getDoc(doc(db, "users", merchantId));
        if (mDoc.exists() && mDoc.data().fcm_token) {
            sendDistributedPush(
                mDoc.data().fcm_token,
                "📞 طلب هاتف جديد!",
                `سجلت الإدارة طلب هاتف جديد للعميل (${document.getElementById('adm-guest-name').value || "ضيف"}) ووجهته إليك لتجهيزه.`
            );
        }
        // =======================================================
        alert("تم تسجيل الطلب وتوجيهه للتاجر بنجاح! سيظهر الآن في لوحة التحكم.");
        adminOrderModal.style.display = 'none';
    } catch (err) { console.error(err); alert("حدث خطأ أثناء الإرسال."); }
    finally { e.target.disabled = false; e.target.innerText = "إرسال للتاجر للتسعير"; }
});

document.getElementById('close-admin-order-modal').addEventListener('click', () => adminOrderModal.style.display = 'none');

// ============================================================================
// --- شاشة تفاصيل الطلب والسجل الجنائي للإدارة (Admin Details Engine) ---
// ============================================================================
const adminOrderDetailsModal = document.getElementById('admin-order-details-modal');
const closeAdminOrderDetailsBtn = document.getElementById('close-admin-order-details');
let adminOpenedOrderId = null;

// إغلاق النافذة
if (closeAdminOrderDetailsBtn) {
    closeAdminOrderDetailsBtn.addEventListener('click', () => adminOrderDetailsModal.style.display = 'none');
}

// زر نسخ رقم الطلب
document.getElementById('copy-adm-order-id')?.addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('modal-adm-order-id').innerText);
    alert("تم نسخ المعرف بنجاح!");
});

// نظام التبويبات (Tabs Logic)
document.querySelectorAll('.a-order-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.a-order-tab-btn').forEach(b => {
            b.classList.remove('active'); b.style.color = '#64748b'; b.style.borderBottomColor = 'transparent';
        });
        e.target.classList.add('active'); e.target.style.color = '#3b82f6'; e.target.style.borderBottomColor = '#3b82f6';

        document.querySelectorAll('.a-order-tab-content').forEach(c => c.style.display = 'none');
        const targetTab = e.target.getAttribute('data-tab');
        document.getElementById(targetTab).style.display = 'block';

        if (targetTab === 'a-tab-logs' && adminOpenedOrderId) {
            fetchAdminOrderLogs(adminOpenedOrderId);
        }
    });
});

// دالة تعبئة وعرض البيانات في النافذة
async function openAdminOrderDetails(order) {
    adminOpenedOrderId = order.id;
    document.querySelector('[data-tab="a-tab-details"]').click(); // العودة للتبويب الأول افتراضياً

    document.getElementById('modal-adm-order-id').innerText = order.id;
    document.getElementById('modal-adm-status').innerText = order.status;
    document.getElementById('modal-adm-c-fat').innerText = order.column_id || "غير محدد";
    document.getElementById('modal-adm-c-note').innerText = order.address_note || "لا توجد ملاحظات إضافية";
    document.getElementById('modal-adm-c-zone').innerText = zonesCache[order.zone_id] || "منطقة غير معروفة";

    document.getElementById('modal-adm-p-merchant').innerText = (order.merchant_price || 0) + ' د.ع';
    document.getElementById('modal-adm-p-delivery').innerText = (order.delivery_fee || 0) + ' د.ع';
    document.getElementById('modal-adm-p-total').innerText = (order.total_price || 0) + ' د.ع';

    // 🧠 الذكاء: تحديد المصدر وبيانات العميل
    let sourceTxt = "📱 تطبيق العميل";
    let cName = "غير متوفر", cPhone = "غير متوفر";

    if (order.is_admin_guest) {
        sourceTxt = "🎧 هاتف (أضافته الإدارة)";
        cName = order.guest_name || "عميل إدارة"; cPhone = order.guest_phone || "غير متوفر";
    } else if (order.customer_id === null) {
        sourceTxt = "🏪 هاتف (سجله التاجر)";
        cName = order.guest_name || "عميل ضيف"; cPhone = order.guest_phone || "غير متوفر";
    } else if (order.customer_id) {
        // البحث في الـ Cache أولاً لتوفير القراءة من الفايربيس
        const cust = usersCache[order.customer_id];
        if (cust) {
            cName = cust.name; cPhone = cust.phone;
        } else {
            try {
                const docR = await getDoc(doc(db, "users", order.customer_id));
                if (docR.exists()) { cName = docR.data().name; cPhone = docR.data().phone; }
            } catch (e) { }
        }
    }
    document.getElementById('modal-adm-source').innerText = sourceTxt;
    document.getElementById('modal-adm-c-name').innerText = cName;
    document.getElementById('modal-adm-c-phone').innerText = cPhone;

    // 🧠 جلب بيانات التاجر
    let mName = "غير محدد", mPhone = "---";
    if (order.merchant_id) {
        const merch = usersCache[order.merchant_id];
        if (merch) {
            mName = merch.store_name || merch.name; mPhone = merch.phone;
        } else {
            try {
                const docR = await getDoc(doc(db, "users", order.merchant_id));
                if (docR.exists()) { mName = docR.data().store_name || docR.data().name; mPhone = docR.data().phone; }
            } catch (e) { }
        }
    }
    document.getElementById('modal-adm-m-name').innerText = mName;
    document.getElementById('modal-adm-m-phone').innerText = mPhone;

    // 🧠 جلب بيانات المندوب
    let dName = "لم يُسند بعد", dPhone = "---";
    if (order.driver_id) {
        const drv = usersCache[order.driver_id];
        if (drv) {
            dName = drv.name; dPhone = drv.phone;
        } else {
            try {
                const docR = await getDoc(doc(db, "users", order.driver_id));
                if (docR.exists()) { dName = docR.data().name; dPhone = docR.data().phone; }
            } catch (e) { }
        }
    }
    document.getElementById('modal-adm-d-name').innerText = dName;
    document.getElementById('modal-adm-d-phone').innerText = dPhone;

    // سبب الإلغاء
    const cancelSec = document.getElementById('modal-adm-cancel-section');
    if (order.status.includes('CANCEL')) {
        cancelSec.style.display = 'block';
        document.getElementById('modal-adm-cancel-reason').innerText = order.reason || order.cancel_reason || "لم يتم ذكر سبب.";
    } else {
        cancelSec.style.display = 'none';
    }

    // عرض النافذة (استخدمنا flex لتوسيطها كما طلبت)
    adminOrderDetailsModal.style.display = 'flex';
}

// دالة جلب ورسم السجل الجنائي للإدارة
async function fetchAdminOrderLogs(orderId) {
    const content = document.getElementById('audit-log-content-admin');
    content.innerHTML = '<p style="text-align: center; color: gray; margin-top: 20px;"><i class="fas fa-spinner fa-spin"></i> جاري جلب السجل...</p>';

    try {
        const qLogs = query(collection(db, `orders/${orderId}/order_logs`), orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(qLogs);

        if (querySnapshot.empty) {
            content.innerHTML = `<p style="text-align:center; padding:20px;">لا يوجد سجل حركات بعد.</p>`;
            return;
        }

        let timelineHtml = '<div style="position: relative; padding-right: 25px; border-right: 3px solid #bdc3c7; margin-top: 10px;">';

        querySnapshot.forEach((docSnap) => {
            const log = docSnap.data();
            const timeStr = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString('ar-IQ') : '';

            // تلوين الدائرة حسب نوع الإجراء
            let dotColor = '#7f8c8d';
            if (log.action_type === 'PRICE_SET') dotColor = '#f39c12';
            if (log.action_type === 'ASSIGNED') dotColor = '#3498db';
            if (log.action_type === 'MERCHANT_PAID' || log.action_type === 'DELIVERED') dotColor = '#2ecc71';
            if (log.action_type.includes('CANCEL')) dotColor = '#e74c3c';

            timelineHtml += `
                <div style="margin-bottom: 25px; position: relative;">
                    <div style="position: absolute; right: -38px; top: 0; background: ${dotColor}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 12px; border: 4px solid #f4f7f6;">
                        <i class="fas fa-dot-circle"></i>
                    </div>
                    <div style="background: white; padding: 12px 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #e0e0e0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <strong style="color: #2c3e50; font-size: 14px;">${log.action_by}</strong>
                            <span style="font-size: 11px; color: #95a5a6; direction: ltr;">${timeStr}</span>
                        </div>
                        <div style="font-size: 13px; color: #555;">${log.description}</div>
                    </div>
                </div>`;
        });
        timelineHtml += '</div>';
        content.innerHTML = timelineHtml;
    } catch (error) {
        content.innerHTML = '<p>حدث خطأ.</p>';
    }
}