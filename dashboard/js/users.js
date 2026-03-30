// ============================================================================
// إدارة المستخدمين والصلاحيات (User Management & RBAC)
// تحديث: تم إضافة محرك (Smart Zone Assigner) لاختيار المناطق وتخزين الـ Document ID آلياً.
// ============================================================================

import { db } from '../../shared/firebase-config.js';
import { collection, doc, setDoc, updateDoc, onSnapshot, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// استدعاء أدوات الـ Auth والنسخة الثانوية لإنشاء الحسابات بدون طرد المدير
import { getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// 1. أولاً: نجلب التطبيق الأساسي
const primaryApp = getApp();

// 2. ثانياً: نعرف الـ Auth الخاص بالمدير باستخدام التطبيق الأساسي
const auth = getAuth(primaryApp);

// 3. ثالثاً: نهيئ النسخة الثانوية (لإنشاء الحسابات بصمت)
const secondaryApp = initializeApp(primaryApp.options, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);
const navUsers = document.getElementById('nav-users');
const viewUsers = document.getElementById('view-users');

navUsers.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');

    navUsers.classList.add('active');
    viewUsers.style.display = 'block';
    document.getElementById('page-title').innerText = 'إدارة المستخدمين';
});

// --- 1. إضافة / تحديث بيانات مستخدم (النسخة الآمنة مالياً) ---
// --- 1. إنشاء حساب مستخدم جديد بالكامل (عبر النسخة الثانوية الذكية) ---
document.getElementById('save-user-btn').addEventListener('click', async () => {
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value.trim();
    const name = document.getElementById('user-name').value.trim();
    const role = document.getElementById('user-role').value;

    if (!email || !password || !name) {
        alert("يرجى إدخال البريد الإلكتروني، كلمة المرور، والاسم!");
        return;
    }
    if (password.length < 6) {
        alert("كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل!");
        return;
    }

    try {
        const btn = document.getElementById('save-user-btn');
        btn.disabled = true; btn.innerText = "جاري الإنشاء...";

        // أ. إنشاء الحساب بصمت في Authentication عبر النسخة الثانوية (لن يطردك من الإدارة)
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newUid = userCredential.user.uid;

        // ب. تسجيل الخروج من النسخة الثانوية فوراً لتنظيفها
        await signOut(secondaryAuth);

        // ج. أخذ الـ UID الجديد، وإنشاء ملفه في قاعدة البيانات (Firestore) بصلاحياتك كمدير
        const phone = document.getElementById('user-phone').value.trim(); // سحب رقم الهاتف

        // ج. أخذ الـ UID الجديد، وإنشاء ملفه في قاعدة البيانات (Firestore) بصلاحياتك كمدير
        const userRef = doc(db, "users", newUid);
        await setDoc(userRef, {
            email: email,
            name: name,
            phone: phone || "غير محدد", // حفظ الهاتف
            role: role,
            is_active: true,
            wallet_balance: 0,
            assigned_zones: [],
            created_at: new Date() // توثيق تاريخ الانضمام
        });

        alert(`🎉 تم إنشاء حساب (${name}) بنجاح! يمكنه الآن تسجيل الدخول.`);

        // تفريغ الحقول لإنشاء شخص آخر
        document.getElementById('user-email').value = '';
        document.getElementById('user-password').value = '';
        document.getElementById('user-name').value = '';

    } catch (error) {
        console.error("خطأ في إنشاء الحساب:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("❌ هذا البريد الإلكتروني مستخدم ومسجل في النظام مسبقاً!");
        } else if (error.code === 'auth/invalid-email') {
            alert("❌ صيغة البريد الإلكتروني غير صحيحة!");
        } else {
            alert("حدث خطأ أثناء الإنشاء: " + error.message);
        }
    } finally {
        const btn = document.getElementById('save-user-btn');
        btn.disabled = false; btn.innerText = "إنشاء الحساب فوراً";
    }
});
// ----------------------------------------------------------------------------
// --- 2. محرك عرض المستخدمين والمناطق (مع كاش الأسماء) ---
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// --- 2. محرك عرض المستخدمين، الفلترة الذكية، وتقسيم الصفحات (Pagination) ---
// ----------------------------------------------------------------------------
let zonesCache = {};
let usersDataList = []; // القائمة الأصلية الشاملة
let filteredUsersList = []; // القائمة بعد تطبيق الفلترة
let currentUsersPage = 1;
let usersPerPage = 20; // القيمة الافتراضية

// أ. مراقبة المناطق وتحديث القاموس اللحظي
onSnapshot(collection(db, "zones"), (snapshot) => {
    zonesCache = {};
    snapshot.forEach(doc => {
        zonesCache[doc.id] = doc.data().name;
    });
    renderUsersTable();
});

// ب. مراقبة المستخدمين
onSnapshot(collection(db, "users"), (snapshot) => {
    usersDataList = [];
    snapshot.forEach(doc => usersDataList.push({ id: doc.id, ...doc.data() }));
    applyUsersFilters(); // تطبيق الفلاتر قبل الرسم
});

// ج. محرك الفلترة والبحث المتقدم
function applyUsersFilters() {
    const searchTerm = document.getElementById('filter-user-search').value.toLowerCase();
    const roleFilter = document.getElementById('filter-user-role').value;
    const statusFilter = document.getElementById('filter-user-status').value;
    usersPerPage = parseInt(document.getElementById('filter-user-limit').value);

    filteredUsersList = usersDataList.filter(user => {
        if (user.role === 'super_admin') return false; // إخفاء الإدارة العليا للحماية

        // 1. بحث بالنص (الاسم، الإيميل، الهاتف)
        let matchSearch = true;
        if (searchTerm) {
            const name = (user.name || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const phone = (user.phone || '').toLowerCase();
            matchSearch = name.includes(searchTerm) || email.includes(searchTerm) || phone.includes(searchTerm);
        }

        // 2. فلترة الصلاحية
        let matchRole = true;
        if (roleFilter) {
            if (roleFilter === 'admin') {
                matchRole = (user.role === 'admin' || user.role === 'employee');
            } else {
                matchRole = (user.role === roleFilter);
            }
        }

        // 3. فلترة الحالة (نشط/محظور)
        let matchStatus = true;
        if (statusFilter !== '') {
            const isUserActive = user.is_active ? 'true' : 'false';
            matchStatus = (isUserActive === statusFilter);
        }

        return matchSearch && matchRole && matchStatus;
    });

    currentUsersPage = 1; // إعادة التعيين للصفحة الأولى بعد أي عملية فلترة
    renderUsersTable();
}

// د. دالة رسم الجدول مع نظام تقسيم الصفحات (Pagination)
function renderUsersTable() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    // حسابات الصفحات
    const totalItems = filteredUsersList.length;
    const totalPages = Math.ceil(totalItems / usersPerPage) || 1;

    if (currentUsersPage > totalPages) currentUsersPage = totalPages;
    if (currentUsersPage < 1) currentUsersPage = 1;

    const startIndex = (currentUsersPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const paginatedUsers = filteredUsersList.slice(startIndex, endIndex);

    if (paginatedUsers.length === 0) {
        usersList.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color:red;">لا يوجد مستخدمون يطابقون شروط البحث.</td></tr>';
    } else {
        paginatedUsers.forEach((user) => {
            const uid = user.id;
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #ddd";

            let roleAr = user.role === 'driver' ? '🚚 مندوب' :
                user.role === 'merchant' ? '🏪 تاجر' :
                    user.role === 'customer' ? '👤 عميل' : '👨‍💼 موظف/إدارة';

            let statusBtn = user.is_active
                ? `<button class="toggle-status-btn" data-id="${uid}" data-status="false" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;"><i class="fas fa-ban"></i> حظر</button>`
                : `<button class="toggle-status-btn" data-id="${uid}" data-status="true" style="background:#2ecc71; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;"><i class="fas fa-check"></i> تفعيل</button>`;

            let zonesHtml = '<span style="color:gray;">-</span>';
            if (user.role === 'driver') {
                let assignedNamesArray = (user.assigned_zones || []).map(zId => zonesCache[zId] || 'غير معروفة');
                let assignedNamesStr = assignedNamesArray.length > 0 ? assignedNamesArray.join('، ') : 'لم يتم التعيين';
                let encodedZones = encodeURIComponent(JSON.stringify(user.assigned_zones || []));

                zonesHtml = `
                    <span style="font-size: 12px; background: #eee; padding: 4px 8px; border-radius: 4px; display: inline-block; max-width: 180px; line-height: 1.5;">${assignedNamesStr}</span>
                    <br>
                    <button class="assign-zone-btn" data-id="${uid}" data-zones="${encodedZones}" style="background:#f39c12; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px; margin-top:5px; font-weight:bold;"><i class="fas fa-edit"></i> تعديل المناطق</button>
                `;
            }

            tr.innerHTML = `
                <td style="padding: 12px; font-weight:bold;"><span class="user-profile-link" data-id="${uid}" style="color: #3b82f6; cursor: pointer; text-decoration: underline;" title="عرض الملف الشخصي">${user.name || 'بدون اسم'}</span></td>
                <td style="padding: 12px;">${roleAr}</td>
                <td style="padding: 12px;">${user.is_active ? '<span style="color:#2ecc71; font-weight:bold;">🟢 نشط</span>' : '<span style="color:#e74c3c; font-weight:bold;">🔴 محظور</span>'}</td>
                <td style="padding: 12px;">${zonesHtml}</td>
                <td style="padding: 12px;">${statusBtn}</td>
            `;
            usersList.appendChild(tr);
        });
    }

    // تحديث مؤشرات أزرار الصفحات
    document.getElementById('user-page-indicator').innerText = `صفحة ${currentUsersPage} من ${totalPages} (${totalItems} مستخدم)`;
    document.getElementById('user-prev-page-btn').disabled = (currentUsersPage === 1);
    document.getElementById('user-next-page-btn').disabled = (currentUsersPage === totalPages);

    // ضبط شفافية الأزرار إذا كانت معطلة
    document.getElementById('user-prev-page-btn').style.opacity = (currentUsersPage === 1) ? '0.5' : '1';
    document.getElementById('user-next-page-btn').style.opacity = (currentUsersPage === totalPages) ? '0.5' : '1';

    attachUsersEvents(); // إعادة ربط الأحداث بالأزرار الجديدة
}

// هـ. مستمعات أحداث الفلترة والتنقل
document.getElementById('filter-user-search').addEventListener('input', applyUsersFilters);
document.getElementById('filter-user-role').addEventListener('change', applyUsersFilters);
document.getElementById('filter-user-status').addEventListener('change', applyUsersFilters);
document.getElementById('filter-user-limit').addEventListener('change', applyUsersFilters);

document.getElementById('reset-user-filters-btn').addEventListener('click', () => {
    document.getElementById('filter-user-search').value = '';
    document.getElementById('filter-user-role').value = '';
    document.getElementById('filter-user-status').value = '';
    document.getElementById('filter-user-limit').value = '20';
    applyUsersFilters();
});

document.getElementById('user-prev-page-btn').addEventListener('click', () => {
    if (currentUsersPage > 1) {
        currentUsersPage--;
        renderUsersTable();
    }
});

document.getElementById('user-next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredUsersList.length / usersPerPage);
    if (currentUsersPage < totalPages) {
        currentUsersPage++;
        renderUsersTable();
    }
});
// ----------------------------------------------------------------------------
// --- 3. نافذة تعيين المناطق الذكية (Smart Zone Assigner) ---
// ----------------------------------------------------------------------------
let currentDriverForZones = null;

function attachUsersEvents() {
    // 1. أزرار التفعيل والحظر
    document.querySelectorAll('.toggle-status-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uid = e.target.getAttribute('data-id');
            const newStatus = e.target.getAttribute('data-status') === 'true';
            await updateDoc(doc(db, "users", uid), { is_active: newStatus });
        });
    });

    // 2. زر فتح نافذة المناطق
    document.querySelectorAll('.assign-zone-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const uid = e.target.closest('button').getAttribute('data-id');
            const currentAssigned = JSON.parse(decodeURIComponent(e.target.closest('button').getAttribute('data-zones')));
            currentDriverForZones = uid;

            const container = document.getElementById('zones-checkbox-container');
            container.innerHTML = '<p style="text-align:center; color:gray;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل المناطق...</p>';
            document.getElementById('zone-search-input').value = ''; // تفريغ حقل البحث
            document.getElementById('assign-zones-modal').style.display = 'flex';

            try {
                // جلب جميع المناطق النشطة
                const qZones = query(collection(db, "zones"), where("is_active", "==", true));
                const snap = await getDocs(qZones);

                container.innerHTML = '';
                if (snap.empty) {
                    container.innerHTML = '<p style="color:red; text-align:center;">لا توجد مناطق مضافة في النظام.</p>';
                    return;
                }

                snap.forEach(docSnap => {
                    const zone = docSnap.data();
                    const zId = docSnap.id;
                    // وضع علامة (صح) إذا كانت المنطقة مسندة مسبقاً للمندوب
                    const isChecked = currentAssigned.includes(zId) ? 'checked' : '';

                    container.innerHTML += `
                        <label class="zone-checkbox-label" style="display:flex; align-items:center; gap:10px; padding:12px; background:#f9f9f9; border-radius:8px; border:1px solid #ddd; cursor:pointer; transition: 0.2s;">
                            <input type="checkbox" value="${zId}" class="zone-checkbox" style="width: 18px; height: 18px; cursor: pointer;" ${isChecked}>
                            <span class="zone-name-text" style="font-size: 14px; font-weight: bold; color: #2c3e50;">${zone.name} <span style="color:gray; font-size:12px; font-weight:normal;">(${zone.city})</span></span>
                        </label>
                    `;
                });
            } catch (error) {
                console.error(error);
                container.innerHTML = '<p style="color:red;">حدث خطأ في جلب المناطق.</p>';
            }
        });
    });
}

// 3. نظام البحث الفوري داخل النافذة (Real-time Search)
document.getElementById('zone-search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.zone-checkbox-label').forEach(label => {
        const text = label.querySelector('.zone-name-text').innerText.toLowerCase();
        // إخفاء أو إظهار المنطقة بناءً على مطابقتها لحقل البحث
        label.style.display = text.includes(term) ? 'flex' : 'none';
    });
});

// 4. إغلاق النافذة
document.getElementById('close-assign-zones').addEventListener('click', () => {
    document.getElementById('assign-zones-modal').style.display = 'none';
});

// 5. حفظ المناطق للمندوب
document.getElementById('confirm-assign-zones').addEventListener('click', async (e) => {
    if (!currentDriverForZones) return;

    // جمع الـ Document IDs لجميع الـ Checkboxes المحددة
    const selectedZones = [];
    document.querySelectorAll('.zone-checkbox:checked').forEach(cb => {
        selectedZones.push(cb.value);
    });

    try {
        e.target.disabled = true; e.target.innerText = 'جاري الحفظ...';

        // تحديث مصفوفة المندوب في قاعدة البيانات بالمعرفات الحقيقية
        await updateDoc(doc(db, "users", currentDriverForZones), {
            assigned_zones: selectedZones
        });

        alert("تم تحديث مناطق المندوب بنجاح!");
        document.getElementById('assign-zones-modal').style.display = 'none';
    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء الحفظ.");
    } finally {
        e.target.disabled = false; e.target.innerText = 'حفظ المناطق المحددة';
    }
});


// ----------------------------------------------------------------------------
// --- نظام الملف الشخصي والإحصائيات السريعة (CRM Profile Modal) ---
// ----------------------------------------------------------------------------
const profileModal = document.getElementById('user-profile-modal');
const closeProfileBtn = document.getElementById('close-profile-modal');

// إغلاق النافذة
if (closeProfileBtn) {
    closeProfileBtn.addEventListener('click', () => profileModal.style.display = 'none');
}

// استهداف ضغطات الماوس على أسماء المستخدمين في الجدول
// استهداف ضغطات الماوس على أسماء المستخدمين في الجدول (محدث)
document.getElementById('users-list').addEventListener('click', (e) => {
    const profileLink = e.target.closest('.user-profile-link');
    if (profileLink) {
        const uid = profileLink.getAttribute('data-id'); // استخراج المعرف مباشرة من الاسم
        openUserProfile(uid);
    }
});

// دالة فتح الملف وحساب الإحصائيات
// متغير لحفظ الـ ID الحالي للنافذة
let currentProfileUid = null;

// دالة فتح الملف وحساب الإحصائيات (محدثة لتدعم التعديل)
async function openUserProfile(uid) {
    currentProfileUid = uid;
    profileModal.style.display = 'flex';
    document.getElementById('profile-name-edit').value = "جاري التحميل...";
    document.getElementById('profile-stats').innerHTML = "<i class='fas fa-spinner fa-spin'></i> جاري تحليل البيانات...";

    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (!userDoc.exists()) return;

        const user = userDoc.data();

        // تعبئة البيانات في حقول الإدخال (Inputs) لتكون جاهزة للتعديل
        document.getElementById('profile-name-edit').value = user.name || "";
        document.getElementById('profile-email-readonly').innerText = user.email || "";
        document.getElementById('profile-phone-edit').value = user.phone || "";

        // تحديد الصلاحية في القائمة المنسدلة
        const roleSelect = document.getElementById('profile-role-edit');
        roleSelect.value = user.role || "customer";

        // التاريخ
        if (user.created_at) {
            const dateObj = user.created_at.toDate ? user.created_at.toDate() : new Date(user.created_at);
            document.getElementById('profile-date').innerText = dateObj.toLocaleDateString('ar-IQ');
        } else {
            document.getElementById('profile-date').innerText = "قديم (قبل التحديث)";
        }

        // أزرار التواصل (WhatsApp & Call)
        const phoneClean = (user.phone || "").replace(/\s+/g, '');
        document.getElementById('btn-call').href = phoneClean ? `tel:${phoneClean}` : "#";
        document.getElementById('btn-whatsapp').href = phoneClean ? `https://wa.me/${phoneClean.startsWith('0') ? '964' + phoneClean.substring(1) : phoneClean}` : "#";

        // زر إرسال الباسورد (محدث برسالة تنبيهية)
        const resetBtn = document.getElementById('btn-reset-password');
        resetBtn.onclick = async () => {
            if (confirm(`هل أنت متأكد من إرسال رابط إعادة تعيين كلمة المرور إلى الإيميل: ${user.email}؟`)) {
                try {
                    resetBtn.innerText = "جاري الإرسال...";
                    await sendPasswordResetEmail(auth, user.email);
                    alert("✅ تم إرسال رابط تغيير كلمة المرور بنجاح!\n(ملاحظة: إذا كان الإيميل وهمياً لن تصله الرسالة. تأكد أيضاً من مجلد الـ Spam).");
                } catch (err) {
                    alert("خطأ: " + err.message);
                } finally {
                    resetBtn.innerHTML = "<i class='fas fa-key'></i> إرسال رابط إعادة تعيين كلمة المرور";
                }
            }
        };

        // 📊 محرك الإحصائيات السريعة (Quick Stats)
        const statsBox = document.getElementById('profile-stats');

        if (user.role === 'driver') {
            const balance = (user.wallet_balance || 0).toLocaleString();
            statsBox.innerHTML = `💰 الذمة المالية الحالية: <span style="font-size:18px;">${balance} د.ع</span>`;
        }
        else if (user.role === 'merchant') {
            const q = query(collection(db, "orders"), where("merchant_id", "==", uid), where("status", "==", "DELIVERED"));
            const snap = await getDocs(q);
            statsBox.innerHTML = `📦 إجمالي الطلبات المكتملة: <span style="font-size:18px;">${snap.size} طلب</span>`;
        }
        else if (user.role === 'customer') {
            statsBox.innerHTML = `🌟 نقاط الولاء: <span style="font-size:18px;">${user.loyalty_points || 0} نقطة</span>`;
        }
        else {
            statsBox.innerHTML = `🛡️ حساب إداري آمن`;
        }

    } catch (error) {
        console.error("خطأ:", error);
        document.getElementById('profile-stats').innerText = "حدث خطأ في جلب البيانات.";
    }
}

// ----------------------------------------------------------------------------
// --- برمجة زر "حفظ التعديلات" (تحديث قاعدة البيانات) ---
// ----------------------------------------------------------------------------
document.getElementById('btn-update-profile').addEventListener('click', async (e) => {
    if (!currentProfileUid) return;

    const newName = document.getElementById('profile-name-edit').value.trim();
    const newPhone = document.getElementById('profile-phone-edit').value.trim();
    const newRole = document.getElementById('profile-role-edit').value;

    if (!newName) {
        alert("لا يمكن ترك حقل الاسم فارغاً!");
        return;
    }

    try {
        e.target.disabled = true;
        const originalText = e.target.innerHTML;
        e.target.innerHTML = "<i class='fas fa-spinner fa-spin'></i> جاري الحفظ...";

        // تحديث البيانات في الفايربيس (ستنعكس فوراً على الجدول بفضل onSnapshot)
        await updateDoc(doc(db, "users", currentProfileUid), {
            name: newName,
            phone: newPhone || "غير متوفر",
            role: newRole
        });

        alert("✅ تم تحديث بيانات المستخدم بنجاح!");
        e.target.innerHTML = originalText;
        e.target.disabled = false;

        // إغلاق النافذة بعد الحفظ
        profileModal.style.display = 'none';

    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء حفظ التعديلات!");
        e.target.disabled = false;
        e.target.innerHTML = "<i class='fas fa-save'></i> حفظ التعديلات";
    }
});