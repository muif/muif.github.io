// ============================================================================
// نظام المصادقة المركزي وآلية التوجيه الذكي (Smart Routing)
// ============================================================================
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. دالة تسجيل الدخول
async function loginUser(email, password) {
    try {
        // المصادقة عبر البريد الإلكتروني وكلمة المرور لجميع الأدوار 
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // بعد نجاح المصادقة، نرسل المستخدم لمحرك التوجيه لفحص صلاحياته
        await routeUserBasedOnRole(user.uid, user);
        return { success: true };

    } catch (error) {
        console.error("خطأ في تسجيل الدخول:", error.message);

        // 🚀 تخصيص رسائل الخطأ لتكون واضحة للمستخدم
        let errorMsg = "فشل تسجيل الدخول. تأكد من البريد وكلمة المرور.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        } else if (error.code === 'auth/too-many-requests') {
            errorMsg = "تم حظر الحساب مؤقتاً بسبب محاولات كثيرة خاطئة.";
        }
        return { success: false, message: errorMsg };
    }
}

// 2. دالة التوجيه الذكي بناءً على الدور (Role)
async function routeUserBasedOnRole(uid, user) {
    // الاستعلام من مجموعة users لمعرفة حقل role
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
        const userData = userDoc.data();

        // 🚀 القفل الأمني الجديد: التحقق من توثيق الإيميل (للعملاء فقط لتجنب حظر المناديب والتجار)
        if (userData.role === 'customer' && !user.emailVerified) {
            await logoutUser(); // طرده فوراً
            throw new Error("حسابك غير مفعل! يرجى مراجعة صندوق الوارد في بريدك الإلكتروني والضغط على رابط التوثيق.");
        }

        // التحقق من حالة الحساب (نشط/محظور) 
        if (userData.is_active === false) {
            await logoutUser();
            throw new Error("عذراً، حسابك موقوف أو قيد المراجعة. يرجى مراجعة الإدارة.");
        }

        const role = userData.role;

        // 🚀 التوجيه للواجهات المخصصة (تم إصلاح المسارات لتعمل مع الهيكلة الجديدة index.html)
        if (role === 'super_admin' || role === 'sub_admin' || role === 'employee') {
            window.location.href = '../admin_dashboard/index.html';
        } else if (role === 'merchant') {
            window.location.href = '../merchant_app/index.html';
        } else if (role === 'driver') {
            window.location.href = '../driver_app/index.html';
        } else if (role === 'customer') {
            window.location.href = '../customer_app/index.html';
        } else {
            throw new Error("صلاحية غير معروفة.");
        }
    } else {
        await logoutUser();
        throw new Error("بيانات المستخدم غير موجودة في قاعدة البيانات. يرجى مراجعة الإدارة.");
    }
}

// 3. دالة تسجيل الخروج 
async function logoutUser() {
    await signOut(auth);
    // 🚀 توجيه ذكي لصفحة الدخول الخاصة بالتطبيق الحالي (بدلاً من توجيه الجميع للإدارة)
    window.location.href = 'login.html';
}

// تصدير الدوال لاستخدامها في واجهات HTML
export { loginUser, logoutUser, onAuthStateChanged, auth };