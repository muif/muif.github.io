// ============================================================================
// تطبيق التاجر - إدارة المنتجات (Merchant App - Inventory Management)
// تطبيقاً لـ [الجزء الثالث]: واجهة التاجر لإدارة المنيو والمنتجات الجاهزة.
// وتطبيقاً لـ [الجزء السابع]: الاعتماد على الأيقونات التعبيرية (Emojis) بدلاً من الصور
// لتسريع تحميل التطبيق، تقليل استهلاك البيانات، وتوفير مساحات التخزين السحابية (Storage).
// ============================================================================

import { auth, db } from '../../shared/firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, where, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
let currentMerchantId = null;

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثاني: نظام الجلسات، وحماية الواجهات (Route Guards)]
// --- 1. حماية الواجهة والتحقق من التاجر ---
// يضمن هذا الجزء عدم تمكن أي مستخدم غير التاجر من الدخول، ويقوم بعزل البيانات 
// ليجلب التاجر منتجاته الخاصة به فقط (Data Isolation).
// ----------------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'merchant') {
            currentMerchantId = user.uid;

            // تحديث واجهة المستخدم باسم المتجر الحقيقي
            document.getElementById('merchant-name').innerText = userDoc.data().name || 'متجري';

            // جلب منتجات هذا التاجر فقط بمجرد التحقق من هويته
            loadProducts();
        } else {
            // توجيه المتطفلين (المناديب أو العملاء) أو الحسابات المحظورة إلى شاشة الدخول
            alert("غير مصرح لك بدخول واجهة التاجر.");
            await signOut(auth);
            window.location.href = '../admin_dashboard/index.html'; // توجيه مؤقت للداشبورد
        }
    } else {
        window.location.href = '../admin_dashboard/index.html';
    }
});

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثالث: إنشاء وتحديث قائمة المنتجات (Menu)]
// --- 3. إضافة منتج جديد لقاعدة البيانات ---
// ----------------------------------------------------------------------------
document.getElementById('add-product-btn').addEventListener('click', async () => {
    const name = document.getElementById('prod-name').value.trim();
    const desc = document.getElementById('prod-desc').value.trim();
    const price = document.getElementById('prod-price').value.trim();

    // [تطبيقاً لقرار الأداء السريع]: سحب الإيموجي المختار بدلاً من معالجة ورفع صور
    const emoji = document.getElementById('prod-emoji').value;

    if (!name || !price) {
        alert("يرجى إدخال اسم المنتج والسعر!");
        return;
    }

    try {
        const btn = document.getElementById('add-product-btn');
        btn.disabled = true;
        btn.innerText = "جاري الحفظ...";

        // حفظ المنتج في جدول (products) مع ربطه بمعرف التاجر الحالي (merchant_id)
        await addDoc(collection(db, "products"), {
            merchant_id: currentMerchantId,
            name: name,
            description: desc,
            price: Number(price), // حماية برمجية للتأكد من حفظ السعر كرقم وليس نصاً
            emoji: emoji,
            is_available: true    // حقل مستقبلي يمكن استخدامه لإيقاف منتج مؤقتاً
        });

        // تفريغ الحقول بعد نجاح الإضافة ليتمكن من إضافة منتج آخر مباشرة
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-desc').value = '';
        document.getElementById('prod-price').value = '';
        alert("تمت الإضافة بنجاح!");
    } catch (error) {
        console.error("خطأ:", error);
        alert("حدث خطأ أثناء إضافة المنتج.");
    } finally {
        const btn = document.getElementById('add-product-btn');
        btn.disabled = false;
        btn.innerText = "إضافة للقائمة";
    }
});

// ----------------------------------------------------------------------------
// [تطبيقاً للجزء الثالث والسابع: العرض اللحظي وإدارة الموارد]
// --- 4. جلب وعرض المنتجات لحظياً (مع زر الحذف) ---
// يعتمد على onSnapshot لتحديث قائمة التاجر فوراً عند إضافة أو حذف أي منتج.
// ----------------------------------------------------------------------------
function loadProducts() {
    // استعلام يجلب المنتجات الخاصة بهذا التاجر حصراً
    const q = query(collection(db, "products"), where("merchant_id", "==", currentMerchantId));

    onSnapshot(q, (snapshot) => {
        const productsList = document.getElementById('products-list');
        productsList.innerHTML = '';

        // حالة الصفر (Zero State) إذا كان المنيو فارغاً
        if (snapshot.empty) {
            productsList.innerHTML = '<p style="text-align:center; color:gray;">لا توجد منتجات حتى الآن.</p>';
            return;
        }

        // بناء بطاقات المنتجات
        snapshot.forEach((docSnap) => {
            const prod = docSnap.data();
            const prodId = docSnap.id; // التقاط الآيدي الخاص بالوثيقة لتمكين عملية الحذف لاحقاً

            const div = document.createElement('div');
            div.className = 'product-item';
            div.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 15px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);";

            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px; flex: 1;">
                    <div style="font-size:30px; background:#f4f4f4; padding:10px; border-radius:10px;">${prod.emoji}</div>
                    <div class="product-info">
                        <h4 style="margin: 0; color: #2c3e50;">${prod.name}</h4>
                        <p style="margin: 5px 0 0 0; font-size: 12px; color: gray;">${prod.description}</p>
                        <div style="margin-top: 5px; font-weight: bold; color: #2ecc71;">${prod.price.toLocaleString()} د.ع</div>
                    </div>
                </div>
                <button class="delete-prod-btn" data-id="${prodId}" style="background: none; border: none; color: #e74c3c; font-size: 20px; cursor: pointer; padding: 10px;">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
            productsList.appendChild(div);
        });

        // ----------------------------------------------------------------------------
        // --- 5. تفعيل أزرار الحذف (إجراء الإزالة Delete Record) ---
        // ----------------------------------------------------------------------------
        document.querySelectorAll('.delete-prod-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                // التقاط الآيدي من الزر الذي تم الضغط عليه
                const prodId = e.target.closest('button').getAttribute('data-id');

                // رسالة تأكيد لحماية التاجر من الحذف بالخطأ
                if (confirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟")) {
                    try {
                        // حذف الوثيقة من جدول المنتجات في الفايربيس
                        await deleteDoc(doc(db, "products", prodId));
                    } catch (error) {
                        console.error("خطأ في الحذف:", error);
                        alert("حدث خطأ أثناء الحذف.");
                    }
                }
            });
        });
    });
}