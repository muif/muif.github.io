// ============================================================================
// نظام المالية، المحافظ، وتصفية الذمم (Finance & Settlement ERP System)
// ============================================================================

import { auth, db } from '../../shared/firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ----------------------------------------------------------------------------
// --- 1. التنقل وعرض الشاشة ---
// ----------------------------------------------------------------------------
const navFinance = document.getElementById('nav-finance');
const viewFinance = document.getElementById('view-finance');

navFinance.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');
    navFinance.classList.add('active');
    viewFinance.style.display = 'block';
    document.getElementById('page-title').innerText = 'المالية والتصفيات';
});

// ----------------------------------------------------------------------------
// --- 2. المتغيرات العامة وإعدادات المحاسبة ---
// ----------------------------------------------------------------------------
const DANGER_DEBT_LIMIT = 50000; // الحد الائتماني (50 ألف دينار)
let currentSettleDriverId = null;
let currentSettleDriverDebt = 0;
let currentDriverName = "";
let totalDebtAmount = 0;
let dangerDriversCount = 0;

// ----------------------------------------------------------------------------
// --- 3. محرك جلب الذمم والمؤشرات العلوية (KPIs) ---
// ----------------------------------------------------------------------------
const qDrivers = query(collection(db, "users"), where("role", "==", "driver"));

onSnapshot(qDrivers, (snapshot) => {
    const list = document.getElementById('finance-drivers-list');
    list.innerHTML = '';
    totalDebtAmount = 0;
    dangerDriversCount = 0;

    let hasDebts = false;

    snapshot.forEach(docSnap => {
        const driver = docSnap.data();
        const driverId = docSnap.id;
        const balance = driver.wallet_balance || 0;

        // في نظامك، الرصيد السالب يعني أن المندوب مدين للمكتب.
        // إذا كان الرصيد صفراً أو موجباً، نتجاوزه
        if (balance >= 0) return;

        hasDebts = true;

        // تحويل الرصيد السالب إلى موجب للعرض المحاسبي
        const debtAmount = Math.abs(balance);
        totalDebtAmount += debtAmount;

        let rowColor = "";
        let dangerIcon = "";

        // تلوين الصف باللون الأحمر الخفيف إذا تخطى المندوب الحد الائتماني
        if (debtAmount >= DANGER_DEBT_LIMIT) {
            dangerDriversCount++;
            rowColor = "background-color: #fef2f2;";
            dangerIcon = '<i class="fas fa-exclamation-triangle" style="color: #ef4444; margin-right: 5px;" title="تخطى الحد المسموح!"></i>';
        }

        const tr = document.createElement('tr');
        tr.style = `border-bottom: 1px solid #e2e8f0; ${rowColor}`;
        tr.innerHTML = `
            <td style="padding: 15px; font-weight: bold; color: #1e293b;">${dangerIcon} ${driver.name || 'بدون اسم'}</td>
            <td style="padding: 15px; font-weight: bold; color: #b91c1c;">${debtAmount.toLocaleString()} د.ع</td>
            <td style="padding: 15px; color: #64748b; font-size: 14px;">---</td>
            <td style="padding: 15px;">
                <button class="open-settle-modal-btn" data-id="${driverId}" data-name="${driver.name}" data-debt="${debtAmount}" data-original-balance="${balance}" style="background: #3b82f6; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;"><i class="fas fa-hand-holding-usd"></i> استلام نقد</button>
            </td>
        `;
        list.appendChild(tr);
    });

    if (!hasDebts) {
        list.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #10b981; font-weight: bold;">🎉 لا توجد ديون مستحقة على أي مندوب حالياً.</td></tr>';
    }

    document.getElementById('kpi-total-debt').innerText = totalDebtAmount.toLocaleString() + ' د.ع';
    document.getElementById('kpi-danger-drivers').innerText = dangerDriversCount + ' مندوب';

    attachSettleModalEvents();
});

// ----------------------------------------------------------------------------
// --- 4. محرك دفتر الأستاذ (سجل الإيصالات) ومقبوضات اليوم ---
// ----------------------------------------------------------------------------
const qTransactions = query(collection(db, "transactions"), orderBy("created_at", "desc"), limit(100));

onSnapshot(qTransactions, (snapshot) => {
    const ledgerList = document.getElementById('transactions-ledger-list');
    ledgerList.innerHTML = '';

    let todayCollection = 0;
    let receiptsCount = 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    snapshot.forEach(docSnap => {
        const trx = docSnap.data();
        const trxId = docSnap.id;

        // إرجاع النص القديم بالضبط لكي يطابق تطبيق المندوب ولا يختفي الإيصال منه!
        if (trx.type !== 'تصفية ذمة نقدية') return;

        receiptsCount++;

        let trxDate = trx.created_at ? trx.created_at.toDate() : new Date();
        if (trxDate >= startOfToday) {
            todayCollection += (trx.amount || 0);
        }

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #e2e8f0";
        tr.innerHTML = `
            <td style="padding: 12px; font-family: monospace; color: #3b82f6; font-weight: bold;">${trx.transaction_id || trxId.substring(0, 8).toUpperCase()}</td>
            <td style="padding: 12px; font-weight: bold;">${trx.driver_name || 'مندوب غير محدد'}</td>
            <td style="padding: 12px; color: #047857; font-weight: bold;">+${(trx.amount || 0).toLocaleString()} د.ع</td>
            <td style="padding: 12px; color: #64748b; font-size: 13px;">${trx.admin_name || 'موظف الإدارة'}</td>
            <td style="padding: 12px; color: #64748b; font-size: 13px;" dir="ltr">${trxDate.toLocaleString('ar-IQ')}</td>
        `;
        ledgerList.appendChild(tr);
    });

    if (receiptsCount === 0) {
        ledgerList.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">لا توجد إيصالات تصفية نقدية مسجلة بعد.</td></tr>';
    }

    document.getElementById('kpi-today-collection').innerText = todayCollection.toLocaleString() + ' د.ع';
});

// ----------------------------------------------------------------------------
// --- 5. منطق النافذة المنبثقة للتصفية (الجزئية والكلية) ---
// ----------------------------------------------------------------------------
const settleModal = document.getElementById('settlement-modal');
const amountInput = document.getElementById('settle-amount-input');
let originalWalletBalance = 0;

function attachSettleModalEvents() {
    document.querySelectorAll('.open-settle-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentSettleDriverId = e.target.closest('button').getAttribute('data-id');
            currentDriverName = e.target.closest('button').getAttribute('data-name');
            currentSettleDriverDebt = parseFloat(e.target.closest('button').getAttribute('data-debt'));
            originalWalletBalance = parseFloat(e.target.closest('button').getAttribute('data-original-balance'));

            document.getElementById('settle-driver-name').innerText = currentDriverName || "مندوب غير معروف";
            document.getElementById('settle-total-debt').innerText = currentSettleDriverDebt.toLocaleString() + ' د.ع';
            amountInput.value = '';

            settleModal.style.display = 'flex';
        });
    });
}

document.getElementById('btn-settle-full').addEventListener('click', () => { amountInput.value = currentSettleDriverDebt; });
document.getElementById('btn-settle-half').addEventListener('click', () => { amountInput.value = Math.floor(currentSettleDriverDebt / 2); });
document.getElementById('cancel-settlement-btn').addEventListener('click', () => { settleModal.style.display = 'none'; currentSettleDriverId = null; });

// زر التأكيد وإصدار الإيصال (العملية المحاسبية)
document.getElementById('confirm-settlement-btn').addEventListener('click', async (e) => {
    const payAmount = parseFloat(amountInput.value);

    if (!payAmount || payAmount <= 0) {
        alert("يرجى إدخال مبلغ صحيح أكبر من الصفر!");
        return;
    }
    if (payAmount > currentSettleDriverDebt) {
        alert("المبلغ المدخل أكبر من الذمة المطلوبة من المندوب!");
        return;
    }

    try {
        e.target.disabled = true;
        e.target.innerText = "جاري الإصدار...";

        // 1. حساب الرصيد الجديد بذكاء (يحافظ على إشارة السالب دائماً لأنها ذمة)
        const remainingDebt = currentSettleDriverDebt - payAmount;
        const newWalletBalance = remainingDebt === 0 ? 0 : -Math.abs(remainingDebt);

        // 2. تحديث رصيد المندوب
        await updateDoc(doc(db, "users", currentSettleDriverId), {
            wallet_balance: newWalletBalance
        });

        // 3. قراءة اسم المدير بطريقة آمنة لا تسبب خطأ في الفايربيس (جلب من الشاشة مباشرة)
        const adminNameEl = document.getElementById('admin-name');
        const adminNameStr = (adminNameEl && adminNameEl.innerText !== 'جاري التحميل..') ? adminNameEl.innerText : 'موظف الإدارة';

        // 4. إنشاء الإيصال المالي (مع إرجاع نوع 'تصفية ذمة نقدية' ليطابق المندوب)
        const trxRef = await addDoc(collection(db, "transactions"), {
            transaction_id: `TRX-${Math.floor(Math.random() * 1000000)}`,
            user_uid: currentSettleDriverId,
            driver_name: currentDriverName,
            amount: payAmount,
            type: 'تصفية ذمة نقدية', // <-- تم إرجاعها كالسابق ليعمل تطبيق المندوب
            admin_uid: auth.currentUser.uid,
            admin_name: adminNameStr,
            created_at: serverTimestamp()
        });

        alert(`✅ تمت العملية بنجاح!\nالمبلغ المستلم: ${payAmount.toLocaleString()} د.ع\nتم إصدار إيصال رقم: ${trxRef.id}`);
        settleModal.style.display = 'none';

    } catch (error) {
        console.error("خطأ في التصفية:", error);
        alert("حدث خطأ أثناء حفظ الإيصال.");
    } finally {
        e.target.disabled = false;
        e.target.innerText = "تأكيد وإصدار إيصال";
    }
});

// ----------------------------------------------------------------------------
// --- 6. ميزة التصدير إلى الإكسل المحاسبي (Export to Excel / CSV) ---
// ----------------------------------------------------------------------------
const exportBtn = document.getElementById('export-finance-btn');

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const table = document.querySelector('#transactions-ledger-list').closest('table');
        let csvContent = "\uFEFF";

        const headers = [];
        table.querySelectorAll('thead th').forEach(th => headers.push(th.innerText));
        csvContent += headers.join(",") + "\n";

        const rows = table.querySelectorAll('tbody tr');
        if (rows.length === 1 && rows[0].innerText.includes("لا توجد")) {
            alert("لا توجد إيصالات مسجلة لتصديرها!");
            return;
        }

        rows.forEach(row => {
            const rowData = [];
            row.querySelectorAll('td').forEach(td => {
                let text = td.innerText.replace(/,/g, "،").replace(/\n/g, " ");
                rowData.push(text);
            });
            csvContent += rowData.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        const date = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        link.setAttribute("href", url);
        link.setAttribute("download", `سجل_المالية_${date}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}