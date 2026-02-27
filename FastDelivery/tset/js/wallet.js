// ============================================================================
// تطبيق المندوب - المحفظة والإيصالات (Driver Wallet & Digital Ledger)
// تطبيقاً لـ [الجزء السادس]: المحافظ الإلكترونية، ونظام التصفية الخالي من الملفات (Paperless Settlement).
// هذا الملف مسؤول عن إدارة شريط التنقل السفلي، وعرض "دفتر الأستاذ الرقمي"
// الذي يحتوي على الإيصالات الديناميكية (TRX) التي تثبت تسديد المندوب لعهدته للإدارة.
// ============================================================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentDriverUid = null;

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: حماية البيانات والجلسات]
// --- 1. التحقق من الدخول وجلب الإيصالات ---
// التأكد من أن المندوب يرى إيصالاته المالية الخاصة به فقط بناءً على الـ UID.
// ----------------------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentDriverUid = user.uid;
        loadTransactions(); // بمجرد التأكد من الهوية، يتم جلب سجله المالي
    }
});

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء السابع: الهيكل البصري وتجربة المستخدم SPA]
// --- 2. منطق شريط التنقل السفلي (Bottom Navigation) ---
// تبديل سلس بين شاشة "المهام والطلبات" وشاشة "المحفظة" دون إعادة تحميل التطبيق.
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء السابع: الهيكل البصري وتجربة المستخدم SPA]
// --- 2. محرك التنقل السفلي المطور (3 تبويبات) ---
// ----------------------------------------------------------------------------

// التقاط عناصر الأزرار السفلية الجديدة
// ----------------------------------------------------------------------------
// --- 2. محرك التنقل السفلي المطور (4 تبويبات) ---
// ----------------------------------------------------------------------------
const navTabAvailable = document.getElementById('nav-tab-available');
const navTabActive = document.getElementById('nav-tab-active');
const navTabWallet = document.getElementById('nav-tab-wallet');
const navTabAccount = document.getElementById('nav-tab-account'); // 👈 الزر الجديد

const sectionAvailable = document.getElementById('available-orders-section');
const sectionActive = document.getElementById('active-order-section');
const sectionWallet = document.getElementById('wallet-section');
const sectionAccount = document.getElementById('account-section'); // 👈 القسم الجديد

function switchDriverTab(activeNav, showSection) {
    [navTabAvailable, navTabActive, navTabWallet, navTabAccount].forEach(nav => {
        if (nav) nav.classList.remove('active');
    });

    [sectionAvailable, sectionActive, sectionWallet, sectionAccount].forEach(sec => {
        if (sec) sec.style.display = 'none';
    });

    if (activeNav) activeNav.classList.add('active');
    if (showSection) showSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

if (navTabAvailable) navTabAvailable.addEventListener('click', () => switchDriverTab(navTabAvailable, sectionAvailable));
if (navTabActive) navTabActive.addEventListener('click', () => switchDriverTab(navTabActive, sectionActive));
if (navTabWallet) navTabWallet.addEventListener('click', () => { switchDriverTab(navTabWallet, sectionWallet); });
if (navTabAccount) navTabAccount.addEventListener('click', () => switchDriverTab(navTabAccount, sectionAccount));// 👈 برمجة النقر// ----------------------------------------------------------------------------
// [تطبيقاً للجزء السادس: الإيصال الرقمي الديناميكي وسجل الحركات الدقيق]
// --- 3. جلب دفتر الأستاذ الرقمي (الإيصالات) لحظياً ---
// ----------------------------------------------------------------------------
function loadTransactions() {
    const transactionsList = document.getElementById('transactions-list');

    // بناء استعلام يجلب الحركات المالية المربوطة بهذا المندوب (user_uid) فقط
    const q = query(
        collection(db, "transactions"),
        where("user_uid", "==", currentDriverUid)
    );

    onSnapshot(q, (snapshot) => {
        transactionsList.innerHTML = '';

        if (snapshot.empty) {
            transactionsList.innerHTML = '<p style="text-align:center; color:gray; padding: 20px;">لا توجد حركات مالية مسجلة حتى الآن.</p>';
            return;
        }

        // [حل برمجي ذكي للـ Firestore]: تحويل البيانات لمصفوفة لترتيبها محلياً 
        // لتجنب رسائل خطأ المطالبة بإنشاء فهارس (Composite Indexes) لكل استعلام.
        let trxArray = [];
        snapshot.forEach(doc => trxArray.push({ id: doc.id, ...doc.data() }));
        // ترتيب من الأحدث للأقدم بناءً على الـ Timestamp
        trxArray.sort((a, b) => b.created_at?.toMillis() - a.created_at?.toMillis());

        // بناء بطاقات الإيصالات الرقمية
        trxArray.forEach(trx => {
            // التمييز البصري بين (تصفية الذمة - تسديد للإدارة) وبين (التحصيل من العميل - دين على المندوب)
            const isSettlement = trx.type === 'تصفية ذمة نقدية';
            const icon = isSettlement ? '<i class="fas fa-check-circle" style="color: #2ecc71; font-size: 24px;"></i>' : '<i class="fas fa-hand-holding-usd" style="color: #e74c3c; font-size: 24px;"></i>';
            const amountColor = trx.amount > 0 ? '#2ecc71' : '#e74c3c';
            const amountPrefix = trx.amount > 0 ? '+' : '';

            // تنسيق التاريخ ليكون مقروءاً محلياً
            const dateStr = trx.created_at ? new Date(trx.created_at.toDate()).toLocaleString('ar-IQ') : 'جاري المعالجة...';

            const card = document.createElement('div');
            card.style.cssText = "background: white; border: 1px dashed #ccc; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";

            // [تطبيقاً للجزء السادس]: تصميم البطاقة لتبدو كإيصال رسمي (يحتوي على رقم الـ TRX والمبلغ والتاريخ)
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${icon}
                        <div>
                            <strong style="color: #2c3e50; font-size: 15px;">${trx.type}</strong>
                            <div style="font-size: 12px; color: gray;">${dateStr}</div>
                        </div>
                    </div>
                    <strong style="color: ${amountColor}; font-size: 16px;">${amountPrefix}${trx.amount.toLocaleString()} د.ع</strong>
                </div>
                <div style="font-size: 13px; color: #555; display: flex; justify-content: space-between;">
                    <span><i class="fas fa-hashtag"></i> ${trx.transaction_id}</span>
                    <button onclick="alert('لقطة الشاشة (Screenshot) كافية للاحتفاظ بهذا الإيصال الرقمي الرسمي.')" style="background:none; border:none; color:#3498db; cursor:pointer;"><i class="fas fa-download"></i> حفظ</button>
                </div>
            `;
            transactionsList.appendChild(card);
        });
    });
}