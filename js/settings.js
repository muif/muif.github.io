// ============================================================================
// نظام إعدادات المنظومة (Updates & Tech Support Engine)
// ============================================================================

import { db } from '../../shared/firebase-config.js';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, deleteDoc, updateDoc, query, where, serverTimestamp, arrayUnion, arrayRemove, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// --- 1. برمجة القائمة المنسدلة والتنقل ---
const toggleSettingsMenu = document.getElementById('toggle-settings-menu');
const settingsSubmenu = document.getElementById('settings-submenu');
const icon = toggleSettingsMenu.querySelector('.submenu-icon');

toggleSettingsMenu.addEventListener('click', (e) => {
    e.preventDefault();

    // 🚀 اللمسة الذكية: فتح الشريط الجانبي تلقائياً إذا كان مطوياً
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
    }

    const isOpen = settingsSubmenu.style.display === 'block';
    settingsSubmenu.style.display = isOpen ? 'none' : 'block';
    icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
});

const navUpdates = document.getElementById('nav-settings-updates');
const navSupport = document.getElementById('nav-settings-support');
const viewUpdates = document.getElementById('view-settings-updates');
const viewSupport = document.getElementById('view-settings-support');
const navGas = document.getElementById('nav-settings-gas');
const viewGas = document.getElementById('view-settings-gas');

if (navGas) {
    navGas.addEventListener('click', () => {
        showSettingsView(viewGas, 'سيرفرات الإشعارات (GAS)');
        loadGasServers();
    });
}

function showSettingsView(view, title) {
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => v.style.display = 'none');
    document.getElementById('nav-settings-group').classList.add('active');
    view.style.display = 'block';
    document.getElementById('page-title').innerText = title;
}

navUpdates.addEventListener('click', () => { showSettingsView(viewUpdates, 'إعدادات التحديثات'); loadUpdatesData(); });
navSupport.addEventListener('click', () => { showSettingsView(viewSupport, 'إعدادات الدعم الفني'); loadSupportData(); });

// --- 2. محرك التحديثات (Updates Logic) ---
let currentAppTab = 'driver';
let updatesDataCache = {};

// التبديل بين تابات التطبيقات (مندوب، عميل، تاجر)
document.querySelectorAll('.update-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.update-tab-btn').forEach(b => {
            b.style.background = '#f1f5f9'; b.style.color = '#475569';
        });
        e.target.style.background = '#3b82f6'; e.target.style.color = 'white';
        currentAppTab = e.target.getAttribute('data-app');
        fillUpdateForm(currentAppTab);
    });
});

async function loadUpdatesData() {
    try {
        const docSnap = await getDoc(doc(db, "app_settings", "updates"));
        if (docSnap.exists()) {
            updatesDataCache = docSnap.data();
            fillUpdateForm(currentAppTab);
        }
    } catch (e) { console.error("خطأ في جلب التحديثات:", e); }
}

function fillUpdateForm(app) {
    const data = updatesDataCache[app] || {};
    document.getElementById('upd-current').value = data.current_version || '1.0';
    document.getElementById('upd-new').value = data.new_version || '1.0';
    document.getElementById('upd-title').value = data.title || '';
    document.getElementById('upd-link').value = data.link || '';
    document.getElementById('upd-icon').value = data.icon || '';
    document.getElementById('upd-type').value = data.type || 'optional';
}

document.getElementById('save-update-btn').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    const newData = {
        current_version: document.getElementById('upd-current').value.trim(),
        new_version: document.getElementById('upd-new').value.trim(),
        title: document.getElementById('upd-title').value.trim(),
        link: document.getElementById('upd-link').value.trim(),
        icon: document.getElementById('upd-icon').value.trim(),
        type: document.getElementById('upd-type').value
    };

    try {
        await setDoc(doc(db, "app_settings", "updates"), {
            [currentAppTab]: newData
        }, { merge: true }); // دمج لتحديث تطبيق واحد دون مسح البقية

        updatesDataCache[currentAppTab] = newData;
        alert("✅ تم إطلاق التحديث بنجاح لهذه المنصة!");
    } catch (error) {
        alert("❌ حدث خطأ أثناء الحفظ");
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ ونشر التحديث لهذا التطبيق';
    }
});

// --- 3. محرك الدعم الفني (Support Logic) ---
async function loadSupportData() {
    try {
        const docSnap = await getDoc(doc(db, "app_settings", "support"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            ['driver', 'customer', 'merchant'].forEach(app => {
                if (data[app]) {
                    document.getElementById(`sup-${app}-phone`).value = data[app].phone || '';
                    document.getElementById(`sup-${app}-email`).value = data[app].email || '';
                }
            });
        }
    } catch (e) { console.error("خطأ في جلب الدعم:", e); }
}

document.getElementById('save-support-btn').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    const supportData = {
        driver: { phone: document.getElementById('sup-driver-phone').value.trim(), email: document.getElementById('sup-driver-email').value.trim() },
        customer: { phone: document.getElementById('sup-customer-phone').value.trim(), email: document.getElementById('sup-customer-email').value.trim() },
        merchant: { phone: document.getElementById('sup-merchant-phone').value.trim(), email: document.getElementById('sup-merchant-email').value.trim() }
    };

    try {
        await setDoc(doc(db, "app_settings", "support"), supportData);
        alert("✅ تم حفظ وتخصيص بيانات الدعم الفني بنجاح للمنظومة بالكامل!");
    } catch (error) {
        alert("❌ حدث خطأ أثناء الحفظ");
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ جميع أرقام وإيميلات الدعم';
    }
});

// ============================================================================
// --- 4. محرك إدارة الصفحات الديناميكية (Dynamic Pages Logic) ---
// ============================================================================
const navPages = document.getElementById('nav-settings-pages');
const viewPages = document.getElementById('view-settings-pages');
let currentPageTab = 'driver';

// المتغيرات الجديدة الخاصة بوضع التعديل
let editingPageId = null;
let loadedPagesCache = {};

if (navPages) {
    navPages.addEventListener('click', () => { showSettingsView(viewPages, 'إدارة الصفحات'); loadPagesForTab(); });
}

document.querySelectorAll('.page-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.page-tab-btn').forEach(b => { b.style.background = '#f1f5f9'; b.style.color = '#475569'; });
        e.target.style.background = '#3b82f6'; e.target.style.color = 'white';
        currentPageTab = e.target.getAttribute('data-app');
        resetPageForm(); // تنظيف الفورم عند التبديل بين التابات
        loadPagesForTab();
    });
});

async function loadPagesForTab() {
    const list = document.getElementById('pages-list-container');
    list.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">جاري التحميل...</td></tr>';
    try {
        const q = query(collection(db, "app_pages"), where("target_app", "==", currentPageTab));
        const snap = await getDocs(q);
        list.innerHTML = '';
        loadedPagesCache = {}; // تفريغ الذاكرة

        if (snap.empty) {
            list.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: gray;">لا توجد صفحات مضافة لهذه المنصة.</td></tr>';
            return;
        }

        snap.forEach(docSnap => {
            const page = docSnap.data();
            loadedPagesCache[docSnap.id] = page; // حفظ الصفحة في الذاكرة لتعديلها لاحقاً
            const dateStr = page.created_at ? new Date(page.created_at.toDate()).toLocaleDateString('ar-IQ') : '';
            list.innerHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px; font-weight: bold; color: #1e293b;">${page.title}</td>
                    <td style="padding: 12px; color: #64748b;" dir="ltr">${dateStr}</td>
                    <td style="padding: 12px;">
                        <button class="edit-page-btn" data-id="${docSnap.id}" style="background: none; border: none; color: #3b82f6; cursor: pointer; margin-left: 15px;" title="تعديل"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="delete-page-btn" data-id="${docSnap.id}" style="background: none; border: none; color: #ef4444; cursor: pointer;" title="حذف"><i class="fas fa-trash-alt"></i> حذف</button>
                    </td>
                </tr>
            `;
        });

        // تفعيل أزرار الحذف
        document.querySelectorAll('.delete-page-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('هل أنت متأكد من حذف هذه الصفحة نهائياً؟')) {
                    await deleteDoc(doc(db, "app_pages", e.currentTarget.getAttribute('data-id')));
                    loadPagesForTab();
                }
            });
        });

        // 🚀 تفعيل أزرار التعديل
        document.querySelectorAll('.edit-page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const pageData = loadedPagesCache[id];

                // ملء الفورم بالبيانات القديمة
                document.getElementById('page-title-input').value = pageData.title || '';
                document.getElementById('page-content-input').value = pageData.content || '';
                document.getElementById('page-image-input').value = pageData.image_url || '';

                // تحويل حالة الزر إلى وضع "التحديث"
                editingPageId = id;
                const saveBtn = document.getElementById('save-page-btn');
                saveBtn.innerHTML = '<i class="fas fa-edit"></i> تحديث بيانات الصفحة';
                saveBtn.style.background = '#f59e0b'; // لون برتقالي للتنبيه

                // التمرير للأعلى بسلاسة للتركيز على الفورم
                document.getElementById('page-title-input').focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    } catch (e) { console.error(e); }
}

// دالة لتنظيف الفورم وإعادته لوضع "الإضافة"
function resetPageForm() {
    editingPageId = null;
    document.getElementById('page-title-input').value = '';
    document.getElementById('page-content-input').value = '';
    document.getElementById('page-image-input').value = '';

    const saveBtn = document.getElementById('save-page-btn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ ونشر الصفحة';
        saveBtn.style.background = '#10b981'; // إعادة اللون الأخضر
    }
}

document.getElementById('save-page-btn')?.addEventListener('click', async (e) => {
    const title = document.getElementById('page-title-input').value.trim();
    const content = document.getElementById('page-content-input').value.trim();
    const image = document.getElementById('page-image-input').value.trim();

    if (!title || !content) { alert("العنوان والمحتوى مطلوبان!"); return; }

    const btn = e.currentTarget;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المعالجة...';

    try {
        if (editingPageId) {
            // 🔄 حالة التحديث (تعديل صفحة موجودة)
            await updateDoc(doc(db, "app_pages", editingPageId), {
                title: title,
                content: content,
                image_url: image || null,
                updated_at: serverTimestamp() // إضافة طابع زمني للتعديل
            });
            alert("✅ تم تحديث بيانات الصفحة بنجاح!");
        } else {
            // ➕ حالة الإضافة (صفحة جديدة)
            await addDoc(collection(db, "app_pages"), {
                target_app: currentPageTab,
                title: title,
                content: content,
                image_url: image || null,
                created_at: serverTimestamp()
            });
            alert("✅ تم نشر الصفحة بنجاح، وستظهر في التطبيق فوراً!");
        }

        resetPageForm(); // تنظيف الفورم بعد النجاح
        loadPagesForTab(); // إعادة تحميل الجدول
    } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء الحفظ!");
    } finally {
        btn.disabled = false;
        if (!editingPageId) resetPageForm(); // لضمان عودة شكل الزر
    }
});
// ============================================================================
// --- 5. محرك وضع الصيانة (Maintenance Engine) ---
// ============================================================================
const navMaint = document.getElementById('nav-settings-maintenance');
const viewMaint = document.getElementById('view-settings-maintenance');
let currentMaintTab = 'driver';
let maintDataCache = {};

if(navMaint) {
    navMaint.addEventListener('click', () => { showSettingsView(viewMaint, 'وضع الصيانة'); loadMaintenanceData(); });
}

document.querySelectorAll('.maint-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.maint-tab-btn').forEach(b => { b.style.background = '#f1f5f9'; b.style.color = '#475569'; });
        e.target.style.background = '#3b82f6'; e.target.style.color = 'white';
        currentMaintTab = e.target.getAttribute('data-app');
        fillMaintForm();
    });
});

const maintToggle = document.getElementById('maint-active-toggle');
const maintContainer = document.getElementById('maint-fields-container');

maintToggle.addEventListener('change', (e) => {
    maintContainer.style.opacity = e.target.checked ? '1' : '0.5';
    maintContainer.style.pointerEvents = e.target.checked ? 'auto' : 'none';
});

async function loadMaintenanceData() {
    try {
        const docSnap = await getDoc(doc(db, "app_settings", "maintenance"));
        if (docSnap.exists()) maintDataCache = docSnap.data();
        fillMaintForm();
    } catch (e) { console.error(e); }
}

function fillMaintForm() {
    const data = maintDataCache[currentMaintTab] || {};
    maintToggle.checked = data.is_active || false;
    document.getElementById('maint-title').value = data.title || '';
    document.getElementById('maint-message').value = data.message || '';
    document.getElementById('maint-image').value = data.image_url || '';
    document.getElementById('maint-link').value = data.external_link || '';
    document.getElementById('maint-whitelist').value = data.whitelist ? data.whitelist.join(', ') : '';
    
    // تفعيل التأثير البصري
    maintContainer.style.opacity = maintToggle.checked ? '1' : '0.5';
    maintContainer.style.pointerEvents = maintToggle.checked ? 'auto' : 'none';
}

document.getElementById('save-maint-btn')?.addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.innerHTML = 'جاري الحفظ...';
    
    // تنظيف الأرقام المستثناة وتحويلها لمصفوفة
    const whitelistStr = document.getElementById('maint-whitelist').value;
    const whitelistArr = whitelistStr.split(',').map(s => s.trim()).filter(s => s !== '');

    const newData = {
        is_active: maintToggle.checked,
        title: document.getElementById('maint-title').value.trim(),
        message: document.getElementById('maint-message').value.trim(),
        image_url: document.getElementById('maint-image').value.trim(),
        external_link: document.getElementById('maint-link').value.trim(),
        whitelist: whitelistArr
    };

    try {
        await setDoc(doc(db, "app_settings", "maintenance"), {
            [currentMaintTab]: newData
        }, { merge: true });
        
        maintDataCache[currentMaintTab] = newData;
        if(newData.is_active) alert("⚠️ تم تفعيل وضع الصيانة! التطبيق متوقف الآن للمستخدمين.");
        else alert("✅ تم إيقاف وضع الصيانة وعاد التطبيق للعمل.");
    } catch (err) { alert("حدث خطأ!"); } finally { e.target.disabled = false; e.target.innerHTML = '<i class="fas fa-lock"></i> حفظ إعدادات الصيانة'; }
});

// ============================================================================
// --- 6. محرك إدارة سيرفرات الإشعارات الموزعة (Dynamic GAS Servers) ---
// ============================================================================
const gasInput = document.getElementById('new-gas-url');
const addGasBtn = document.getElementById('add-gas-btn');
const gasList = document.getElementById('gas-servers-list');

// دالة جلب وعرض الروابط لحظياً (Real-time)
function loadGasServers() {
    if (!gasList) return;

    onSnapshot(doc(db, "app_settings", "gas_servers"), (docSnap) => {
        gasList.innerHTML = '';

        if (docSnap.exists() && docSnap.data().urls && docSnap.data().urls.length > 0) {
            const urls = docSnap.data().urls;

            urls.forEach((url, index) => {
                gasList.innerHTML += `
                    <tr style="border-bottom: 1px solid #e2e8f0; background: white; transition: 0.3s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                        <td style="padding: 12px; font-weight: bold; color: #64748b;">${index + 1}</td>
                        <td style="padding: 12px; direction: ltr; text-align: left; font-family: monospace; font-size: 13px; color: #3b82f6; word-break: break-all;">${url}</td>
                        <td style="padding: 12px; text-align: center;">
                            <button class="delete-gas-btn" data-url="${url}" style="background: #fee2e2; color: #ef4444; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;" title="حذف السيرفر"><i class="fas fa-trash-alt"></i></button>
                        </td>
                    </tr>
                `;
            });

            // تفعيل أزرار الحذف
            document.querySelectorAll('.delete-gas-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const urlToDelete = e.currentTarget.getAttribute('data-url');
                    if (confirm("هل أنت متأكد من حذف هذا السيرفر؟ قد تتأثر الإشعارات إذا قمت بحذف السيرفر الوحيد.")) {
                        try {
                            await updateDoc(doc(db, "app_settings", "gas_servers"), {
                                urls: arrayRemove(urlToDelete) // الحذف الذكي من المصفوفة
                            });
                        } catch (error) {
                            console.error("خطأ:", error); alert("حدث خطأ أثناء الحذف.");
                        }
                    }
                });
            });
        } else {
            // حالة الخطر: لا توجد سيرفرات
            gasList.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 30px; color: #ef4444; background: #fef2f2;"><i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i><br><strong style="font-size: 15px;">لا توجد سيرفرات مسجلة!</strong><br><span style="font-size: 13px;">نظام الإشعارات الخارجي متوقف حالياً ولن تصل تنبيهات للمستخدمين. يرجى إضافة رابط.</span></td></tr>';
        }
    });
}

// دالة إضافة رابط جديد
if (addGasBtn) {
    addGasBtn.addEventListener('click', async () => {
        const newUrl = gasInput.value.trim();

        // 🛡️ حماية: التأكد من أن الرابط يبدأ بمسار جوجل سكريبت لضمان عدم إدخال روابط خبيثة
        if (!newUrl || !newUrl.startsWith("https://script.google.com/macros/s/")) {
            alert("يرجى إدخال رابط GAS صحيح يبدأ بـ: https://script.google.com/macros/s/");
            return;
        }

        addGasBtn.disabled = true;
        addGasBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';

        try {
            const docRef = doc(db, "app_settings", "gas_servers");
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                // إذا لم يكن الملف موجوداً في الداتابيس، ننشئه لأول مرة
                await setDoc(docRef, { urls: [newUrl] });
            } else {
                // إذا كان موجوداً، ندمج الرابط الجديد مع المصفوفة (مع منع التكرار تلقائياً)
                await updateDoc(docRef, { urls: arrayUnion(newUrl) });
            }

            gasInput.value = '';
            alert("✅ تم إضافة السيرفر بنجاح! سيتم توجيه الإشعارات إليه فوراً.");
        } catch (error) {
            console.error("خطأ:", error); alert("حدث خطأ أثناء حفظ الرابط.");
        } finally {
            addGasBtn.disabled = false;
            addGasBtn.innerHTML = '<i class="fas fa-plus"></i> إضافة السيرفر';
        }
    });
}