import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
let currentUserId = null;
let currentUserEmail = null;

// ============================================================================
// 1. حارس الجلسة وجلب البيانات
// ============================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'customer') {
            document.body.style.display = 'block';

            currentUserId = user.uid;
            currentUserEmail = user.email; // نحتاجه لاحقاً لتغيير الباسورد
            const userData = userDoc.data();

            document.getElementById('acc-name').innerText = userData.name || "عميلنا العزيز";
            document.getElementById('acc-phone').innerText = userData.phone || "رقم غير مسجل";

            const points = userData.loyalty_points || 0;
            document.getElementById('acc-points').innerText = points;

            let tier = "برونزي";
            if (points >= 100) tier = "فضي";
            if (points >= 500) tier = "ذهبي";
            if (points >= 1500) tier = "VIP 🔥";
            document.getElementById('acc-tier').innerText = tier;

            fetchCompletedOrdersCount(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

async function fetchCompletedOrdersCount(uid) {
    try {
        const q = query(collection(db, "orders"), where("customer_id", "==", uid), where("status", "==", "DELIVERED"));
        const snap = await getDocs(q);
        document.getElementById('acc-orders').innerText = snap.size;
    } catch (e) { console.error(e); }
}

// ============================================================================
// 2. إدارة النوافذ المنبثقة (Modals)
// ============================================================================
// إغلاق النوافذ
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('active');
    });
});

// فتح نافذة التعديل وتعبئة البيانات الحالية فيها
document.getElementById('btn-edit-profile').addEventListener('click', () => {
    document.getElementById('edit-name-input').value = document.getElementById('acc-name').innerText;
    document.getElementById('edit-phone-input').value = document.getElementById('acc-phone').innerText;
    document.getElementById('modal-edit-profile').classList.add('active');
});

// فتح نافذة الباسورد
document.getElementById('btn-change-password').addEventListener('click', () => {
    document.getElementById('current-pwd-input').value = '';
    document.getElementById('new-pwd-input').value = '';
    document.getElementById('pwd-error-msg').style.display = 'none';
    document.getElementById('modal-change-password').classList.add('active');
});

// ============================================================================
// 3. محرك حفظ البيانات في Firestore
// ============================================================================
document.getElementById('save-profile-btn').addEventListener('click', async (e) => {
    const newName = document.getElementById('edit-name-input').value.trim();
    const newPhone = document.getElementById('edit-phone-input').value.trim();

    if (!newName || !newPhone) { alert("يرجى تعبئة جميع الحقول!"); return; }
    // 🛡️ القفل الأمني الصارم لرقم هاتف العميل
    if (!newPhone.startsWith('07') || newPhone.length !== 11) {
        alert("🚨 رقم الهاتف غير صالح! يجب أن يتكون من 11 رقماً ويبدأ بـ 07");
        return;
    }

    try {
        e.target.disabled = true; e.target.innerText = "جاري الحفظ...";

        // تحديث البيانات في قاعدة البيانات
        await updateDoc(doc(db, "users", currentUserId), {
            name: newName,
            phone: newPhone
        });

        // تحديث الواجهة فوراً لكي يرى العميل التغيير
        document.getElementById('acc-name').innerText = newName;
        document.getElementById('acc-phone').innerText = newPhone;

        alert("تم تحديث بياناتك بنجاح! ✅");
        document.getElementById('modal-edit-profile').classList.remove('active');

    } catch (error) {
        console.error("خطأ:", error); alert("حدث خطأ أثناء التحديث.");
    } finally {
        e.target.disabled = false; e.target.innerText = "حفظ التعديلات";
    }
});

// ============================================================================
// 4. المحرك الأمني لتغيير كلمة المرور (Re-Authentication)
// ============================================================================
document.getElementById('save-pwd-btn').addEventListener('click', async (e) => {
    const currentPwd = document.getElementById('current-pwd-input').value;
    const newPwd = document.getElementById('new-pwd-input').value;
    const errorMsg = document.getElementById('pwd-error-msg');

    if (!currentPwd || !newPwd) {
        errorMsg.innerText = "يرجى إدخال كلمة المرور القديمة والجديدة!";
        errorMsg.style.display = 'block';
        return;
    }
    if (newPwd.length < 6) {
        errorMsg.innerText = "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل!";
        errorMsg.style.display = 'block';
        return;
    }

    try {
        e.target.disabled = true; e.target.innerText = "جاري التحقق...";
        errorMsg.style.display = 'none';

        const user = auth.currentUser;
        // 1. إعادة المصادقة (إجبار الفايربيس على التأكد من الباسورد القديم)
        const credential = EmailAuthProvider.credential(currentUserEmail, currentPwd);
        await reauthenticateWithCredential(user, credential);

        // 2. إذا نجحت المصادقة، نقوم بتحديث الباسورد
        e.target.innerText = "جاري التحديث...";
        await updatePassword(user, newPwd);

        alert("تم تغيير كلمة المرور بنجاح! 🔒");
        document.getElementById('modal-change-password').classList.remove('active');

    } catch (error) {
        console.error(error);
        errorMsg.style.display = 'block';
        if (error.code === 'auth/invalid-credential') {
            errorMsg.innerText = "❌ كلمة المرور الحالية (القديمة) غير صحيحة!";
        } else {
            errorMsg.innerText = "حدث خطأ غير متوقع، حاول مجدداً.";
        }
    } finally {
        e.target.disabled = false; e.target.innerText = "تحديث كلمة المرور";
    }
});

// ============================================================================
// 5. تسجيل الخروج وزر الطلب الحر
// ============================================================================
document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm("هل أنت متأكد أنك تريد تسجيل الخروج؟")) {
        await signOut(auth);
        window.location.href = 'login.html';
    }
});

const fabBtn = document.getElementById('open-direct-order-btn');
if (fabBtn) {
    fabBtn.addEventListener('click', () => { window.location.href = 'index.html?action=order'; });
}

// ============================================================================
// 6. إدارة حذف الحساب نهائياً (Account Deletion)
// ============================================================================
// فتح نافذة الحذف
document.getElementById('btn-delete-account').addEventListener('click', () => {
    document.getElementById('delete-pwd-input').value = '';
    document.getElementById('delete-error-msg').style.display = 'none';
    document.getElementById('modal-delete-account').classList.add('active');
});

// تنفيذ عملية الحذف
document.getElementById('confirm-delete-btn').addEventListener('click', async (e) => {
    const pwd = document.getElementById('delete-pwd-input').value;
    const errorMsg = document.getElementById('delete-error-msg');

    if (!pwd) {
        errorMsg.innerText = "يجب إدخال كلمة المرور لتأكيد الحذف!";
        errorMsg.style.display = 'block';
        return;
    }

    const confirmAction = confirm("🚨 هل أنت متأكد بنسبة 100% أنك تريد مسح حسابك؟ هذا الإجراء لا يمكن التراجع عنه!");
    if (!confirmAction) return;

    try {
        e.target.disabled = true;
        e.target.innerText = "جاري مسح البيانات...";
        errorMsg.style.display = 'none';

        const user = auth.currentUser;

        // 1. إعادة المصادقة (للتأكد من أن المالك الحقيقي هو من يقوم بالحذف)
        const credential = EmailAuthProvider.credential(currentUserEmail, pwd);
        await reauthenticateWithCredential(user, credential);

        // 2. مسح ملف المستخدم من قاعدة البيانات (Firestore)
        await deleteDoc(doc(db, "users", currentUserId));

        // 3. مسح الحساب نهائياً من نظام المصادقة (Auth)
        await deleteUser(user);

        alert("تم حذف حسابك وجميع بياناتك بنجاح. نتمنى أن نراك مجدداً! 👋");
        window.location.href = 'login.html'; // توجيه لصفحة الدخول

    } catch (error) {
        console.error("خطأ أثناء الحذف:", error);
        errorMsg.style.display = 'block';
        if (error.code === 'auth/invalid-credential') {
            errorMsg.innerText = "❌ كلمة المرور غير صحيحة!";
        } else {
            errorMsg.innerText = "حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.";
        }
    } finally {
        e.target.disabled = false;
        e.target.innerText = "حذف حسابي للأبد";
    }
});

// ============================================================================
// --- 7. جلب إعدادات الدعم الفني ---
// ============================================================================
async function loadSupportSettings() {
    try {
        const docSnap = await getDoc(doc(db, "app_settings", "support"));
        if (docSnap.exists()) {
            const data = docSnap.data().customer; // جلب بيانات دعم العميل فقط
            if (data) {
                if (data.phone) {
                    const waClean = data.phone.replace(/\s+/g, '');
                    const waUrl = `https://wa.me/${waClean.startsWith('0') ? '964' + waClean.substring(1) : waClean}`;
                    document.getElementById('btn-support-whatsapp').onclick = () => window.open(waUrl, '_blank');
                }
                if (data.email) {
                    const emailBtn = document.getElementById('btn-support-email');
                    emailBtn.style.display = 'flex';
                    emailBtn.onclick = () => {
                        // 1. محاولة فتح تطبيق البريد الإلكتروني
                        window.location.href = `mailto:${data.email}`;

                        // 2. الخطة البديلة (UX): نسخ الإيميل وعرض رسالة للمستخدم
                        navigator.clipboard.writeText(data.email).then(() => {
                            alert(`تم نسخ البريد الإلكتروني للمراسلة: \n${data.email}`);
                        }).catch(err => console.log('تعذر النسخ التلقائي'));
                    };
                }
            }
        }
    } catch (e) { console.error("خطأ في جلب الدعم:", e); }
}

// ============================================================================
// --- 8. إظهار بطاقة التحديث الاختياري إن وجدت ---
// ============================================================================
function checkOptionalUpdateBanner() {
    const updDataStr = localStorage.getItem('available_optional_update');
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

// تشغيل المحركات بمجرد فتح الشاشة
loadSupportSettings();
checkOptionalUpdateBanner();