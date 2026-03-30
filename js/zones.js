// ============================================================================
// إدارة المناطق والأعمدة (Zones & FAT Engine)
// تحديث: تم بناء نظام (إدارة الأعمدة الذكي) في نافذة منبثقة للتحكم الشامل بـ FAT.
// ============================================================================

import { db } from '../../shared/firebase-config.js';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء السابع: الهيكل البصري للواجهات SPA]
// --- 1. منطق التنقل بين الشاشات (Navigation) ---
// ----------------------------------------------------------------------------
const navHome = document.getElementById('nav-home');
const navZones = document.getElementById('nav-zones');
const viewHome = document.getElementById('view-home');
const viewZones = document.getElementById('view-zones');

function switchView(activeNav, showView) {
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');

    activeNav.classList.add('active');
    showView.style.display = 'block';
    document.getElementById('page-title').innerText = activeNav.innerText;
}

if (navHome) navHome.addEventListener('click', () => switchView(navHome, viewHome));
if (navZones) navZones.addEventListener('click', () => switchView(navZones, viewZones));


// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثالث: بناء هيكلية قاعدة البيانات - Firebase CRUD]
// --- 2. منطق إدارة المناطق وإضافة خصائصها ---
// ----------------------------------------------------------------------------
const addZoneBtn = document.getElementById('add-zone-btn');
const zonesList = document.getElementById('zones-list');

// أ. إضافة منطقة جغرافية جديدة
addZoneBtn.addEventListener('click', async () => {
    const name = document.getElementById('zone-name').value.trim();
    const city = document.getElementById('zone-city').value.trim();
    const fee = Number(document.getElementById('zone-delivery-fee').value) || 0;
    const hasFat = document.getElementById('zone-has-fat').checked;

    if (!name || !city) { alert("يرجى إدخال اسم المنطقة والمدينة!"); return; }

    try {
        addZoneBtn.disabled = true; addZoneBtn.innerText = "جاري الحفظ...";
        await addDoc(collection(db, "zones"), {
            name: name, city: city, delivery_fee: fee, has_fat: hasFat, is_active: true
        });

        document.getElementById('zone-name').value = '';
        document.getElementById('zone-city').value = '';
        document.getElementById('zone-delivery-fee').value = '';
        document.getElementById('zone-has-fat').checked = false;
        alert("تمت إضافة المنطقة وأجرة التوصيل بنجاح!");
    } catch (error) {
        console.error("خطأ: ", error); alert("حدث خطأ أثناء الإضافة.");
    } finally {
        addZoneBtn.disabled = false; addZoneBtn.innerText = "حفظ المنطقة";
    }
});

// ----------------------------------------------------------------------------
// ب. جلب وعرض المناطق لحظياً (Real-time listener) مع أزرار الإدارة الشاملة
// ----------------------------------------------------------------------------
onSnapshot(collection(db, "zones"), (snapshot) => {
    const zonesList = document.getElementById('zones-list');
    zonesList.innerHTML = '';

    snapshot.forEach((zoneDoc) => {
        const zone = zoneDoc.data();
        const zoneId = zoneDoc.id;

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #ddd";

        // أزرار التفعيل والتعطيل (التي كانت مفقودة)
        const fatBtn = zone.has_fat
            ? `<button class="toggle-fat-btn" data-id="${zoneId}" data-status="false" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px; margin-top:5px;">إيقاف FAT</button>`
            : `<button class="toggle-fat-btn" data-id="${zoneId}" data-status="true" style="background:#2ecc71; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px; margin-top:5px;">تفعيل FAT</button>`;

        const statusBtn = zone.is_active
            ? `<button class="toggle-status-btn" data-id="${zoneId}" data-status="false" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px; margin-top:5px;">تعطيل المنطقة</button>`
            : `<button class="toggle-status-btn" data-id="${zoneId}" data-status="true" style="background:#2ecc71; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px; margin-top:5px;">تنشيط المنطقة</button>`;

        let columnsBtnHtml = zone.has_fat
            ? `<button class="manage-fat-btn" data-id="${zoneId}" data-name="${zone.name}" style="background:#3498db; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; font-weight:bold;"><i class="fas fa-network-wired"></i> إدارة الأعمدة</button>`
            : `<span style="color:gray;">يعتمد على GPS</span>`;

        // 🚀 أزرار التعديل والحذف الجديدة
        const editBtn = `<button class="edit-zone-btn" data-id="${zoneId}" data-name="${zone.name}" data-city="${zone.city}" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; font-size:12px; margin-left:5px;" title="تعديل الاسم والمدينة"><i class="fas fa-edit"></i></button>`;
        const deleteBtn = `<button class="delete-zone-btn" data-id="${zoneId}" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; font-size:12px;" title="حذف المنطقة نهائياً"><i class="fas fa-trash"></i></button>`;

        tr.innerHTML = `
            <td style="padding: 10px; font-weight:bold;">${zone.name}</td>
            <td style="padding: 10px;">${zone.city}</td>
            <td style="padding: 10px; color:#27ae60; font-weight:bold;">
                ${zone.delivery_fee || 0} د.ع
                <br>
                <button class="edit-fee-btn" data-id="${zoneId}" data-current="${zone.delivery_fee || 0}" style="background:#f39c12; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer; font-size:11px; margin-top:5px;">تعديل الأجرة</button>
            </td>
            <td style="padding: 10px; text-align:center;">${zone.has_fat ? '✅' : '❌'}<br>${fatBtn}</td>
            <td style="padding: 10px; text-align:center;">${zone.is_active ? '🟢 نشط' : '🔴 معطل'}<br>${statusBtn}</td>
            <td style="padding: 10px;">${columnsBtnHtml}</td>
            <td style="padding: 10px; border-right: 1px solid #ddd;">${editBtn} ${deleteBtn}</td>
        `;
        zonesList.appendChild(tr);
    });

    attachZoneEvents();
});

function attachZoneEvents() {
    // 1. تعديل الأجرة
    document.querySelectorAll('.edit-fee-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const zId = e.target.getAttribute('data-id');
            const currentFee = e.target.getAttribute('data-current');
            const newFee = prompt(`أدخل أجرة التوصيل الجديدة للمنطقة (د.ع):`, currentFee);

            if (newFee !== null && newFee.trim() !== "") {
                try {
                    e.target.disabled = true; e.target.innerText = "...";
                    await updateDoc(doc(db, "zones", zId), { delivery_fee: Number(newFee) });
                } catch (error) {
                    alert("حدث خطأ أثناء تعديل الأجرة."); e.target.disabled = false;
                }
            }
        });
    });

    // 2. إدارة الأعمدة
    document.querySelectorAll('.manage-fat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const zId = e.target.closest('button').getAttribute('data-id');
            const zName = e.target.closest('button').getAttribute('data-name');
            openFatManager(zId, zName);
        });
    });

    // 3. تعديل اسم ومدنية المنطقة
    document.querySelectorAll('.edit-zone-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const zId = e.target.closest('button').getAttribute('data-id');
            const currentName = e.target.closest('button').getAttribute('data-name');
            const currentCity = e.target.closest('button').getAttribute('data-city');

            const newName = prompt("تعديل اسم المنطقة:", currentName);
            if (newName === null) return;

            const newCity = prompt("تعديل اسم المدينة:", currentCity);
            if (newCity === null) return;

            if (newName.trim() !== "" && newCity.trim() !== "") {
                try {
                    await updateDoc(doc(db, "zones", zId), {
                        name: newName.trim(),
                        city: newCity.trim()
                    });
                } catch (error) {
                    alert("حدث خطأ أثناء التعديل.");
                }
            }
        });
    });

    // 4. الحذف النهائي للمنطقة
    document.querySelectorAll('.delete-zone-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const zId = e.target.closest('button').getAttribute('data-id');
            if (confirm("🚨 تحذير: هل أنت متأكد من حذف هذه المنطقة نهائياً؟\nسيؤدي ذلك إلى اختفائها من قوائم المناديب والتجار!")) {
                try {
                    await deleteDoc(doc(db, "zones", zId));
                } catch (error) {
                    alert("حدث خطأ أثناء الحذف.");
                }
            }
        });
    });

    // 5. تفعيل / تعطيل نظام FAT
    document.querySelectorAll('.toggle-fat-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const zId = e.target.getAttribute('data-id');
            const newStatus = e.target.getAttribute('data-status') === 'true';
            await updateDoc(doc(db, "zones", zId), { has_fat: newStatus });
        });
    });

    // 6. تنشيط / تعطيل المنطقة
    document.querySelectorAll('.toggle-status-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const zId = e.target.getAttribute('data-id');
            const newStatus = e.target.getAttribute('data-status') === 'true';
            await updateDoc(doc(db, "zones", zId), { is_active: newStatus });
        });
    });
}
// ----------------------------------------------------------------------------
// [النظام الجديد]: محرك نافذة إدارة الأعمدة (FAT Manager Modal)
// ----------------------------------------------------------------------------
let currentZoneForFat = null;
let currentFatSnapshotUnsubscribe = null; // لفصل الاتصال بقاعدة البيانات عند إغلاق النافذة توفيراً للموارد

// أ. دالة فتح النافذة وجلب الأعمدة
function openFatManager(zoneId, zoneName) {
    currentZoneForFat = zoneId;
    document.getElementById('manage-fat-modal').style.display = 'flex';
    document.getElementById('fat-zone-name-display').innerText = `المنطقة الحالية: ${zoneName}`;
    document.getElementById('new-fat-input').value = '';

    // إيقاف أي استماع سابق لمنطقة أخرى (لحماية الأداء)
    if (currentFatSnapshotUnsubscribe) currentFatSnapshotUnsubscribe();

    const fatListContainer = document.getElementById('fat-list-container');
    fatListContainer.innerHTML = '<tr><td colspan="2" style="text-align: center; color: gray; padding: 10px;"><i class="fas fa-spinner fa-spin"></i> جاري جلب الأعمدة...</td></tr>';

    // الاستماع اللحظي للـ Sub-collection الخاصة بأعمدة هذه المنطقة تحديداً
    currentFatSnapshotUnsubscribe = onSnapshot(collection(db, `zones/${zoneId}/columns`), (snapshot) => {
        fatListContainer.innerHTML = '';

        if (snapshot.empty) {
            fatListContainer.innerHTML = '<tr><td colspan="2" style="text-align: center; color: gray; padding: 10px;">لا توجد أعمدة مضافة في هذه المنطقة حالياً.</td></tr>';
            return;
        }

        snapshot.forEach(docSnap => {
            const fat = docSnap.data();
            const fatId = docSnap.id;

            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #eee";
            tr.innerHTML = `
                <td style="padding: 10px; font-weight: bold; color: #2c3e50; font-family: monospace; font-size: 14px;">${fat.column_id}</td>
                <td style="padding: 10px; text-align: left;">
                    <button class="edit-single-fat-btn" data-id="${fatId}" data-code="${fat.column_id}" style="background: #f39c12; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px; margin-left: 5px;"><i class="fas fa-edit"></i></button>
                    <button class="delete-single-fat-btn" data-id="${fatId}" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            fatListContainer.appendChild(tr);
        });

        attachFatActionEvents(); // ربط أزرار التعديل والحذف الداخلي
    });
}

// ب. دالة إضافة عمود جديد من داخل النافذة
document.getElementById('add-fat-btn').addEventListener('click', async () => {
    if (!currentZoneForFat) return;
    const inputEl = document.getElementById('new-fat-input');
    const fatCode = inputEl.value.trim();

    if (!fatCode) { alert("يرجى إدخال كود العمود أولاً!"); return; }

    try {
        const btn = document.getElementById('add-fat-btn');
        btn.disabled = true; btn.innerText = "...";

        await addDoc(collection(db, `zones/${currentZoneForFat}/columns`), {
            column_id: fatCode,
            notes: ""
        });

        inputEl.value = ''; // تفريغ الحقل فوراً بعد النجاح لكي يضيف غيره بسرعة
    } catch (error) {
        console.error(error); alert("حدث خطأ أثناء الإضافة.");
    } finally {
        const btn = document.getElementById('add-fat-btn');
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> إضافة';
    }
});

// ج. دوال التعديل والحذف للأعمدة الموجودة
function attachFatActionEvents() {
    // التعديل
    document.querySelectorAll('.edit-single-fat-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const fatId = e.target.closest('button').getAttribute('data-id');
            const oldCode = e.target.closest('button').getAttribute('data-code');

            const newCode = prompt("تعديل كود العمود:", oldCode);

            if (newCode && newCode.trim() !== "" && newCode !== oldCode) {
                try {
                    await updateDoc(doc(db, `zones/${currentZoneForFat}/columns`, fatId), {
                        column_id: newCode.trim()
                    });
                } catch (error) {
                    console.error(error); alert("حدث خطأ أثناء التعديل.");
                }
            }
        });
    });

    // الحذف
    document.querySelectorAll('.delete-single-fat-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const fatId = e.target.closest('button').getAttribute('data-id');
            if (confirm("🚨 هل أنت متأكد من حذف هذا العمود نهائياً؟ قد يؤثر ذلك على المناديب المتواجدين عنده حالياً.")) {
                try {
                    await deleteDoc(doc(db, `zones/${currentZoneForFat}/columns`, fatId));
                } catch (error) {
                    console.error(error); alert("حدث خطأ أثناء الحذف.");
                }
            }
        });
    });
}

// د. إغلاق النافذة وإيقاف الاستماع
document.getElementById('close-fat-modal').addEventListener('click', () => {
    document.getElementById('manage-fat-modal').style.display = 'none';
    currentZoneForFat = null;
    if (currentFatSnapshotUnsubscribe) {
        currentFatSnapshotUnsubscribe(); // إيقاف سحب البيانات لتخفيف الضغط على الفايربيس
        currentFatSnapshotUnsubscribe = null;
    }
});