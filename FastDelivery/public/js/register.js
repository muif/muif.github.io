import { auth, db } from './firebase-config.js';
// استدعاء دوال الإنشاء والتوثيق من فايربيس
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const registerBtn = document.getElementById('registerBtn');
    const statusMsg = document.getElementById('statusMsg');
    // 🛡️ القفل الأمني الصارم لرقم هاتف العميل الجديد
    if (!phone.startsWith('07') || phone.length !== 11) {
        statusMsg.style.color = "#ef4444";
        statusMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> رقم الهاتف غير صالح! يجب أن يتكون من 11 رقماً ويبدأ بـ 07';
        return;
    }

    if (password.length < 6) {
        statusMsg.style.color = "#ef4444";
        statusMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
        return;
    }

    try {
        registerBtn.disabled = true;
        statusMsg.style.color = "#3b82f6";
        statusMsg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء الحساب...';

        // 1. إنشاء الحساب في نظام المصادقة
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. إرسال رسالة التوثيق للبريد الإلكتروني
        await sendEmailVerification(user);

        // 3. حفظ بيانات العميل في قاعدة البيانات (Firestore)
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            phone: phone,
            email: email,
            role: 'customer', // تحديد الصلاحية كعميل
            loyalty_points: 0,
            is_active: true,
            created_at: serverTimestamp()
        });

        // 4. تسجيل الخروج فوراً (لإجباره على التوثيق قبل الدخول)
        await signOut(auth);

        // 5. إظهار رسالة النجاح
        statusMsg.style.color = "#10b981";
        statusMsg.innerHTML = '<i class="fas fa-check-circle"></i> تم إنشاء الحساب بنجاح! <br><span style="color:#e11d48; font-size:15px;">يرجى مراجعة بريدك الإلكتروني لتوثيق الحساب قبل تسجيل الدخول.</span>';

        // مسح الحقول
        document.getElementById('registerForm').reset();

        // تحويله لصفحة الدخول بعد 5 ثوانٍ
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 5000);

    } catch (error) {
        console.error("خطأ في التسجيل:", error);
        registerBtn.disabled = false;
        statusMsg.style.color = "#ef4444";

        if (error.code === 'auth/email-already-in-use') {
            statusMsg.innerHTML = '<i class="fas fa-times-circle"></i> هذا البريد الإلكتروني مسجل مسبقاً!';
        } else {
            statusMsg.innerHTML = '<i class="fas fa-times-circle"></i> حدث خطأ، يرجى التأكد من صحة البيانات.';
        }
    }
});