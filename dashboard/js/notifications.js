// ============================================================================
// مركز الإشعارات الغنية (Rich Notification Command Center)
// يدعم التوجيه الدقيق، الروابط الخارجية، الصفحات الداخلية، والتوجيه للطلبات.
// ============================================================================

import { db } from '../../shared/firebase-config.js';
import { sendDistributedPush } from '../../shared/push-engine.js';
import { collection, addDoc, onSnapshot, query, where, orderBy, getDocs, getDoc, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";// --- 1. التنقل بين الشاشات وإظهار مركز الإشعارات ---
const navNotifications = document.getElementById('nav-notifications');
const viewNotifications = document.getElementById('view-notifications');

if (navNotifications) {
    navNotifications.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');
        navNotifications.classList.add('active');
        viewNotifications.style.display = 'block';
        document.getElementById('page-title').innerText = 'مركز الإشعارات';
    });
}

// --- 2. إدارة ظهور قائمة "مستخدم محدد (التوجيه الدقيق)" ---
const targetSelect = document.getElementById('notif-target');
const specificUserContainer = document.getElementById('specific-user-container');
const specificUserSelect = document.getElementById('notif-specific-user');
let usersLoaded = false;

if (targetSelect) {
    targetSelect.addEventListener('change', async (e) => {
        if (e.target.value === 'specific') {
            specificUserContainer.style.display = 'block';
            if (!usersLoaded) {
                specificUserSelect.innerHTML = '<option value="">جاري التحميل...</option>';
                try {
                    const snap = await getDocs(collection(db, "users"));
                    specificUserSelect.innerHTML = '<option value="">-- اختر المستخدم المستهدف --</option>';
                    snap.forEach(docSnap => {
                        const user = docSnap.data();
                        if (user.role === 'super_admin') return;
                        let roleAr = user.role === 'driver' ? 'مندوب' : user.role === 'merchant' ? 'تاجر' : 'عميل';
                        specificUserSelect.innerHTML += `<option value="${docSnap.id}">${user.name || 'بدون اسم'} (${roleAr}) - ${user.phone || 'بدون رقم'}</option>`;
                    });
                    usersLoaded = true;
                } catch (error) {
                    console.error("خطأ:", error);
                    specificUserSelect.innerHTML = '<option value="">حدث خطأ في التحميل</option>';
                }
            }
        } else {
            specificUserContainer.style.display = 'none';
        }
    });
}

// --- 3. إدارة التفاعلات الذكية للحقول (هذا هو الجزء المسؤول عن إظهار الحقول!) ---
const actionTypeSelect = document.getElementById('notif-action-type');
const actionValueContainer = document.getElementById('action-value-container');
const actionValueLabel = document.getElementById('action-value-label');
const actionValueInput = document.getElementById('notif-action-value');
const imageUrlContainer = document.getElementById('image-url-container');

if (actionTypeSelect) {
    actionTypeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        actionValueInput.value = ''; // تفريغ الحقل عند تغيير النوع
        document.getElementById('notif-image-url').value = '';

        if (type === 'none') {
            actionValueContainer.style.display = 'none';
            imageUrlContainer.style.display = 'none';
        } else if (type === 'external_link') {
            actionValueContainer.style.display = 'block';
            actionValueLabel.innerText = 'الرابط الخارجي (URL):';
            actionValueInput.placeholder = 'https://google.com';
            imageUrlContainer.style.display = 'none';
        } else if (type === 'internal_page') {
            actionValueContainer.style.display = 'block';
            actionValueLabel.innerText = 'رابط زر الإجراء الداخلي (اختياري):';
            actionValueInput.placeholder = 'رابط إضافي يوضع كزر أسفل التفاصيل (اتركه فارغاً إن لم ترغب به)';
            imageUrlContainer.style.display = 'block'; // إظهار حقل الصورة
        } else if (type === 'order_link') {
            actionValueContainer.style.display = 'block';
            actionValueLabel.innerText = 'رقم الطلب (Order ID):';
            actionValueInput.placeholder = 'انسخ رقم الطلب هنا ليتوجه له فوراً';
            imageUrlContainer.style.display = 'none';
        }
    });
}

// --- 4. محرك إرسال الإشعار الغني ---
const sendBtn = document.getElementById('send-notif-btn');
if (sendBtn) {
    sendBtn.addEventListener('click', async (e) => {
        const title = document.getElementById('notif-title').value.trim();
        const body = document.getElementById('notif-body').value.trim();
        const targetType = targetSelect.value;
        const specificUid = specificUserSelect.value;

        // بيانات الإجراءات الإضافية
        const actionType = actionTypeSelect.value;
        const actionValue = actionValueInput.value.trim();
        const imageUrl = document.getElementById('notif-image-url').value.trim();

        const adminNameEl = document.getElementById('admin-name');
        const adminName = (adminNameEl && adminNameEl.innerText !== 'جاري التحميل...') ? adminNameEl.innerText : 'موظف الإدارة';

        if (!title || !body) { alert("يرجى كتابة عنوان ونص الإشعار!"); return; }
        if (targetType === 'specific' && !specificUid) { alert("يرجى اختيار المستخدم المستهدف أولاً!"); return; }

        // تحقق إضافي للروابط المطلوبة
        if ((actionType === 'external_link' || actionType === 'order_link') && !actionValue) {
            alert("يرجى إدخال الرابط أو رقم الطلب المطلوب في حقل القيمة!"); return;
        }

        try {
            e.target.disabled = true;
            e.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

            await addDoc(collection(db, "notifications"), {

                title: title,
                body: body,
                target_type: targetType,
                target_uid: targetType === 'specific' ? specificUid : null,
                sender_name: adminName,
                is_read: false,

                // خصائص الإشعار الغني
                action_type: actionType,
                action_value: actionValue || null,
                image_url: imageUrl || null,

                created_at: serverTimestamp()
            });

            // --- 🚀 محرك الإطلاق الخارجي الموزع (يدعم الفردي والجماعي) ---
            if (targetType === 'specific') {
                // 1. إرسال لمستخدم واحد
                const userDoc = await getDoc(doc(db, "users", specificUid));
                if (userDoc.exists() && userDoc.data().fcm_token) {
                    sendDistributedPush(userDoc.data().fcm_token, title, body);
                }
            } else {
                // 2. إرسال جماعي (بث لاسلكي Broadcast)
                let qUsers;
                if (targetType === 'drivers') {
                    qUsers = query(collection(db, "users"), where("role", "==", "driver"), where("is_active", "==", true));
                } else if (targetType === 'merchants') {
                    qUsers = query(collection(db, "users"), where("role", "==", "merchant"), where("is_active", "==", true));
                } else if (targetType === 'all') {
                    // جلب كل المستخدمين النشطين (تجار + مناديب + عملاء)
                    qUsers = query(collection(db, "users"), where("is_active", "==", true));
                }

                if (qUsers) {
                    const usersSnap = await getDocs(qUsers);
                    let pushCount = 0;

                    // حلقة تكرار (Loop) لإطلاق الإشعارات دون تجميد شاشة الإدارة
                    usersSnap.forEach(docSnap => {
                        const userData = docSnap.data();
                        if (userData.fcm_token) {
                            sendDistributedPush(userData.fcm_token, title, body);
                            pushCount++;
                        }
                    });
                    console.log(`🚀 تم إطلاق ${pushCount} إشعار بنجاح!`);
                }
            }

            alert("✅ تم إرسال الإشعار وبثه للهواتف بنجاح!");

            // تفريغ الحقول
            document.getElementById('notif-title').value = '';
            document.getElementById('notif-body').value = '';
            actionValueInput.value = '';
            document.getElementById('notif-image-url').value = '';
            actionTypeSelect.value = 'none';
            actionValueContainer.style.display = 'none';
            imageUrlContainer.style.display = 'none';

        } catch (error) {
            console.error("خطأ:", error); alert("حدث خطأ أثناء الإرسال!");
        } finally {
            e.target.disabled = false;
            e.target.innerHTML = '<i class="fas fa-satellite-dish"></i> إرسال الإشعار وبثه الآن';
        }
    });
}

// ============================================================================
// --- 5. محرك عرض الإشعارات الذكي (بحث، فلترة، صفحات، حذف) ---
// ============================================================================

// متغيرات الذاكرة للتحكم بالصفحات والفلترة
let allNotifsData = [];
let filteredNotifsData = [];
let currentNotifPage = 1;
let currentNotifLimit = 20;

// التقاط عناصر الواجهة
const notifSearchInput = document.getElementById('filter-notif-search');
const notifTargetFilter = document.getElementById('filter-notif-target');
const notifLimitSelect = document.getElementById('filter-notif-limit');
const notifResetBtn = document.getElementById('reset-notif-filters-btn');
const notifPrevBtn = document.getElementById('notif-prev-page-btn');
const notifNextBtn = document.getElementById('notif-next-page-btn');
const notifPageIndicator = document.getElementById('notif-page-indicator');
const notifListBody = document.getElementById('notifications-history-list');

// 1. جلب البيانات الخام من القاعدة
const qNotifs = query(collection(db, "notifications"), orderBy("created_at", "desc"));
onSnapshot(qNotifs, (snapshot) => {
    allNotifsData = [];
    snapshot.forEach(docSnap => {
        allNotifsData.push({ id: docSnap.id, ...docSnap.data() });
    });
    applyNotifFilters(); // تطبيق الفلترة بعد جلب البيانات
});

// 2. دالة تطبيق الفلترة والبحث
function applyNotifFilters() {
    const searchTerm = (notifSearchInput?.value || '').toLowerCase();
    const targetVal = notifTargetFilter?.value || '';
    currentNotifLimit = parseInt(notifLimitSelect?.value) || 20;

    filteredNotifsData = allNotifsData.filter(notif => {
        const titleBody = ((notif.title || '') + ' ' + (notif.body || '')).toLowerCase();
        const matchesSearch = titleBody.includes(searchTerm);
        const matchesTarget = targetVal === '' || notif.target_type === targetVal;

        return matchesSearch && matchesTarget;
    });

    currentNotifPage = 1; // العودة للصفحة الأولى عند كل فلترة جديدة
    renderNotifTable();
}

// 3. دالة رسم الجدول بناءً على الصفحة الحالية والعدد المسموح
function renderNotifTable() {
    if (!notifListBody) return;
    notifListBody.innerHTML = '';

    const totalItems = filteredNotifsData.length;
    const totalPages = Math.ceil(totalItems / currentNotifLimit) || 1;

    // تحديث واجهة الأزرار والعداد
    if (notifPageIndicator) notifPageIndicator.innerText = `صفحة ${currentNotifPage} من ${totalPages} (${totalItems} إشعار)`;
    if (notifPrevBtn) notifPrevBtn.disabled = currentNotifPage === 1;
    if (notifNextBtn) notifNextBtn.disabled = currentNotifPage === totalPages;

    // تصميم الأزرار المعطلة
    if (notifPrevBtn) notifPrevBtn.style.opacity = currentNotifPage === 1 ? '0.5' : '1';
    if (notifNextBtn) notifNextBtn.style.opacity = currentNotifPage === totalPages ? '0.5' : '1';

    if (totalItems === 0) {
        notifListBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">لا توجد إشعارات مطابقة للبحث.</td></tr>';
        return;
    }

    // اقتطاع المصفوفة حسب الصفحة (Pagination Slice)
    const startIndex = (currentNotifPage - 1) * currentNotifLimit;
    const endIndex = startIndex + currentNotifLimit;
    const paginatedNotifs = filteredNotifsData.slice(startIndex, endIndex);

    paginatedNotifs.forEach(notif => {
        let targetStr = "";
        if (notif.target_type === 'all') targetStr = '<span style="background:#e2e8f0; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">الجميع 📢</span>';
        else if (notif.target_type === 'drivers') targetStr = '<span style="background:#dbeafe; color:#1e3a8a; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">المناديب 🚚</span>';
        else if (notif.target_type === 'merchants') targetStr = '<span style="background:#fef3c7; color:#92400e; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">التجار 🏪</span>';
        else targetStr = '<span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">مستخدم محدد 🎯</span>';

        let extraIcons = "";
        if (notif.action_type === 'external_link') extraIcons = '<i class="fas fa-globe" style="color: #3b82f6; margin-right: 5px;" title="رابط خارجي"></i>';
        if (notif.action_type === 'internal_page') extraIcons = '<i class="fas fa-file-alt" style="color: #8b5cf6; margin-right: 5px;" title="صفحة داخلية"></i>';
        if (notif.action_type === 'order_link') extraIcons = '<i class="fas fa-box" style="color: #f59e0b; margin-right: 5px;" title="رابط طلب"></i>';
        if (notif.image_url) extraIcons += '<i class="fas fa-image" style="color: #10b981; margin-right: 5px;" title="مرفق صورة"></i>';

        const dateStr = notif.created_at ? notif.created_at.toDate().toLocaleString('ar-IQ') : 'جاري الإرسال...';

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #e2e8f0";
        tr.innerHTML = `
            <td style="padding: 12px; font-weight: bold; color: #1e293b;">${extraIcons} ${notif.title}</td>
            <td style="padding: 12px;">${targetStr}</td>
            <td style="padding: 12px; color: #64748b; font-size: 13px;">${notif.sender_name || 'الإدارة'}</td>
            <td style="padding: 12px; color: #64748b; font-size: 13px;" dir="ltr">${dateStr}</td>
            <td style="padding: 12px; text-align: center;">
                <button class="delete-notif-btn" data-id="${notif.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px;" title="حذف الإشعار من السجل"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        notifListBody.appendChild(tr);
    });

    // 4. تفعيل أزرار الحذف
    document.querySelectorAll('.delete-notif-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("هل أنت متأكد من حذف هذا الإشعار من السجل؟")) {
                try {
                    await deleteDoc(doc(db, "notifications", id));
                } catch (error) {
                    console.error("خطأ في الحذف:", error);
                    alert("حدث خطأ أثناء الحذف.");
                }
            }
        });
    });
}

// 5. ربط أحداث الفلترة والتنقل
if (notifSearchInput) notifSearchInput.addEventListener('input', applyNotifFilters);
if (notifTargetFilter) notifTargetFilter.addEventListener('change', applyNotifFilters);
if (notifLimitSelect) notifLimitSelect.addEventListener('change', applyNotifFilters);

if (notifResetBtn) {
    notifResetBtn.addEventListener('click', () => {
        notifSearchInput.value = '';
        notifTargetFilter.value = '';
        notifLimitSelect.value = '20';
        applyNotifFilters();
    });
}

if (notifPrevBtn) {
    notifPrevBtn.addEventListener('click', () => {
        if (currentNotifPage > 1) { currentNotifPage--; renderNotifTable(); }
    });
}
if (notifNextBtn) {
    notifNextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredNotifsData.length / currentNotifLimit) || 1;
        if (currentNotifPage < totalPages) { currentNotifPage++; renderNotifTable(); }
    });
}
// ============================================================================
// --- إدارة التبويبات الفرعية (الإشعارات vs الإعلانات) ---
// ============================================================================
const btnTabNotifs = document.getElementById('btn-tab-notifs');
const btnTabAds = document.getElementById('btn-tab-ads');
const sectionNotifs = document.getElementById('section-notifs');
const sectionAds = document.getElementById('section-ads');

if (btnTabNotifs && btnTabAds) {
    btnTabNotifs.addEventListener('click', () => {
        btnTabNotifs.style.background = '#3b82f6'; btnTabNotifs.style.color = 'white'; btnTabNotifs.style.boxShadow = '0 4px 10px rgba(59,130,246,0.2)';
        btnTabAds.style.background = '#e2e8f0'; btnTabAds.style.color = '#475569'; btnTabAds.style.boxShadow = 'none';
        sectionNotifs.style.display = 'block';
        sectionAds.style.display = 'none';
    });

    btnTabAds.addEventListener('click', () => {
        btnTabAds.style.background = '#8b5cf6'; btnTabAds.style.color = 'white'; btnTabAds.style.boxShadow = '0 4px 10px rgba(139,92,246,0.2)';
        btnTabNotifs.style.background = '#e2e8f0'; btnTabNotifs.style.color = '#475569'; btnTabNotifs.style.boxShadow = 'none';
        sectionAds.style.display = 'block';
        sectionNotifs.style.display = 'none';
    });
}
// ============================================================================
// --- جزء الإعلانات الذكية (الجديد كلياً - نسخة آمنة ومحدثة) ---
// ============================================================================

// تبديل حقول الإعلان بناءً على نوع الإجراء (مستمع حدث شامل لضمان العمل)
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'ad-action-type') {
        const type = e.target.value;
        const adExternalContainer = document.getElementById('ad-external-container');
        const adInternalContainer = document.getElementById('ad-internal-container');

        if (type === 'external_link') {
            if (adExternalContainer) adExternalContainer.style.display = 'block';
            if (adInternalContainer) adInternalContainer.style.display = 'none';
        } else {
            if (adExternalContainer) adExternalContainer.style.display = 'none';
            if (adInternalContainer) adInternalContainer.style.display = 'block';
        }
    }
});

// محرك نشر الإعلان وحساب تاريخ الانتهاء (مع حماية ضد الأخطاء)
const publishBtn = document.getElementById('publish-ad-btn');
if (publishBtn) {
    publishBtn.addEventListener('click', async (e) => {
        const btn = e.currentTarget; // استخدام الزر بأمان

        // جلب القيم من الواجهة في لحظة الضغط لضمان عدم وجود قيم فارغة (Null Reference)
        const imageUrlEl = document.getElementById('ad-image-url');
        const durationEl = document.getElementById('ad-duration');
        const actionTypeEl = document.getElementById('ad-action-type');

        if (!imageUrlEl || !imageUrlEl.value.trim()) {
            alert("رابط الصورة إجباري لعرض الإعلان!");
            return;
        }

        const imageUrl = imageUrlEl.value.trim();
        const durationDays = durationEl ? parseInt(durationEl.value) : 7;
        const actionType = actionTypeEl ? actionTypeEl.value : 'external_link';

        let actionValue = null;
        let title = null;
        let body = null;

        if (actionType === 'external_link') {
            const extUrlEl = document.getElementById('ad-external-url');
            actionValue = extUrlEl ? extUrlEl.value.trim() : null;
            if (!actionValue) { alert("يرجى إدخال الرابط الخارجي!"); return; }
        } else {
            const titleEl = document.getElementById('ad-title');
            const bodyEl = document.getElementById('ad-body');
            const internalBtnEl = document.getElementById('ad-internal-btn-link');

            title = titleEl ? titleEl.value.trim() : null;
            body = bodyEl ? bodyEl.value.trim() : null;
            actionValue = internalBtnEl ? internalBtnEl.value.trim() : null;

            if (!title || !body) { alert("يرجى إدخال عنوان وتفاصيل الصفحة الداخلية!"); return; }
        }

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري النشر...';

            // 🧠 حساب تاريخ الانتهاء بالملي ثانية
            const now = new Date();
            const expiresAtDate = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));

            await addDoc(collection(db, "ads"), {
                image_url: imageUrl,
                action_type: actionType,
                action_value: actionValue,
                title: title,
                body: body,
                created_at: serverTimestamp(),
                expires_at: expiresAtDate,
                is_active: true
            });

            alert("✅ تم نشر الإعلان بنجاح، وسيظهر للعملاء فوراً!");

            // تفريغ الحقول بعد النجاح
            imageUrlEl.value = '';
            if (document.getElementById('ad-external-url')) document.getElementById('ad-external-url').value = '';
            if (document.getElementById('ad-title')) document.getElementById('ad-title').value = '';
            if (document.getElementById('ad-body')) document.getElementById('ad-body').value = '';

        } catch (error) {
            console.error("خطأ في نشر الإعلان:", error);
            // الآن سيخبرك المتصفح بالسبب الدقيق للخطأ بدلاً من رسالة عامة
            alert("حدث خطأ أثناء النشر! السبب الدقيق: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-upload"></i> نشر الإعلان في التطبيق';
        }
    });
}

// ============================================================================
// --- جلب سجل الإعلانات وعرض العداد التنازلي (نسخة محمية ضد الأعطال) ---
// ============================================================================
const qAds = query(collection(db, "ads"), orderBy("created_at", "desc"));

onSnapshot(qAds, (snapshot) => {
    const list = document.getElementById('ads-history-list');
    if (!list) return;

    list.innerHTML = ''; // مسح جملة "جاري التحميل" أولاً

    if (snapshot.empty) {
        list.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">لا توجد إعلانات مسجلة حالياً.</td></tr>';
        return;
    }

    const now = new Date();

    snapshot.forEach(docSnap => {
        const ad = docSnap.data();
        const adId = docSnap.id;

        // 🛡️ حماية الكود من الانهيار إذا كانت بيانات الإعلان القديمة تالفة
        let expDate = new Date(); // تاريخ افتراضي
        try {
            if (ad.expires_at && typeof ad.expires_at.toDate === 'function') {
                expDate = ad.expires_at.toDate(); // القراءة الصحيحة
            } else if (ad.expires_at) {
                expDate = new Date(ad.expires_at); // لو كانت نصية بالخطأ
            }
        } catch (e) {
            console.warn("تم تخطي خطأ في تاريخ إعلان رقم:", adId);
        }

        const isExpired = now > expDate;

        // حالة الإعلان
        let statusBadge = isExpired
            ? '<span style="background: #fee2e2; color: #b91c1c; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">منتهي الصلاحية 🔴</span>'
            : '<span style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">نشط حالياً 🟢</span>';

        const actionText = ad.action_type === 'external_link' ? 'رابط خارجي 🌐' : 'صفحة داخلية 📄';
        const expDateStr = expDate.toLocaleDateString('ar-IQ');

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #e2e8f0";
        tr.innerHTML = `
            <td style="padding: 12px;"><img src="${ad.image_url || ''}" style="width: 50px; height: 30px; object-fit: cover; border-radius: 4px; border: 1px solid #ccc;" onerror="this.src='https://via.placeholder.com/50x30?text=بدون+صورة'"></td>
            <td style="padding: 12px; font-weight: bold; font-size: 13px; color: #475569;">${actionText}</td>
            <td style="padding: 12px; font-size: 13px; color: #64748b;" dir="ltr">${expDateStr}</td>
            <td style="padding: 12px;">${statusBadge}</td>
            <td style="padding: 12px;">
                <button class="delete-ad-btn" data-id="${adId}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px;" title="حذف نهائي"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        list.appendChild(tr);
    });

    // إضافة وظيفة الحذف للأزرار
    document.querySelectorAll('.delete-ad-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("هل أنت متأكد من حذف هذا الإعلان نهائياً من التطبيق؟")) {
                await deleteDoc(doc(db, "ads", id));
            }
        });
    });

}, (error) => {
    // 🛡️ صيد أخطاء الصلاحيات (Permissions) إذا كان هناك خلل في الفايربيس
    console.error("خطأ في جلب الإعلانات:", error);
    const list = document.getElementById('ads-history-list');
    if (list) list.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444; font-weight: bold;">تعذر جلب الإعلانات. تأكد من إعدادات الفايربيس.</td></tr>`;
});